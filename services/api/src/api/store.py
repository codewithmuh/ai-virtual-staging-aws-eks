"""Stagings and daily usage in one DynamoDB table (partition key `pk`, no servers to run).

Items:
  staging#<id>                    one staged photo
  usage#<date>#visitor#<visitor>  AI calls by one browser today
  usage#<date>#ip#<address>       AI calls from one IP address today
  usage#<date>#all                AI calls across the whole site today

Usage counters expire on their own through DynamoDB TTL (`expires_at`).
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

import boto3
from botocore.exceptions import ClientError

from api.schemas import FurnitureItem, StructureCheck, Style

if TYPE_CHECKING:
    from types_boto3_dynamodb.client import DynamoDBClient

    from api.config import Settings

_TWO_DAYS = 2 * 24 * 3600


class LimitReachedError(RuntimeError):
    """Rule R4: one of the daily limits is used up. `scope` says which one."""

    def __init__(self, scope: str) -> None:
        super().__init__(f"daily {scope} limit reached")
        self.scope = scope


@dataclass
class StagingRecord:
    """What we keep about a staging. Photos stay in S3; this holds their keys."""

    id: str
    style: Style
    created_at: str
    provider: str
    original_key: str
    staged_key: str
    structure: StructureCheck
    furniture: list[FurnitureItem] | None = None


def _hash(value: str) -> str:
    """Visitor ids and IP addresses are stored hashed: enough to count, not to identify."""
    return hashlib.sha256(value.encode()).hexdigest()[:24]


class Store:
    def __init__(self, settings: Settings) -> None:
        self._table = settings.dynamodb_table
        self._limits = {
            "visitor": settings.visitor_daily_limit,
            "ip": settings.ip_daily_limit,
            "site": settings.global_daily_limit,
        }
        self._db: DynamoDBClient = boto3.client(
            "dynamodb", region_name=settings.aws_region, endpoint_url=settings.dynamodb_endpoint_url
        )

    def ensure_table(self) -> None:
        """Local runs only (AUTO_CREATE_RESOURCES). In AWS the table comes from Terraform."""
        try:
            self._db.describe_table(TableName=self._table)
        except self._db.exceptions.ResourceNotFoundException:
            self._db.create_table(
                TableName=self._table,
                KeySchema=[{"AttributeName": "pk", "KeyType": "HASH"}],
                AttributeDefinitions=[{"AttributeName": "pk", "AttributeType": "S"}],
                BillingMode="PAY_PER_REQUEST",
            )
            self._db.get_waiter("table_exists").wait(TableName=self._table)

    async def consume(self, visitor: str, ip: str) -> None:
        """Count one AI call against all three daily limits, all or nothing.

        A transaction, so a request that is over any one limit increments none of the counters.
        """
        today = datetime.now(UTC).date().isoformat()
        expires = str(int(time.time()) + _TWO_DAYS)
        counters = [
            ("visitor", f"usage#{today}#visitor#{_hash(visitor)}"),
            ("ip", f"usage#{today}#ip#{_hash(ip)}"),
            ("site", f"usage#{today}#all"),
        ]

        def _consume() -> None:
            try:
                self._db.transact_write_items(
                    TransactItems=[
                        {
                            "Update": {
                                "TableName": self._table,
                                "Key": {"pk": {"S": pk}},
                                "UpdateExpression": "ADD #n :one SET expires_at = :exp",
                                "ConditionExpression": "attribute_not_exists(#n) OR #n < :limit",
                                "ExpressionAttributeNames": {"#n": "count"},
                                "ExpressionAttributeValues": {
                                    ":one": {"N": "1"},
                                    ":exp": {"N": expires},
                                    ":limit": {"N": str(self._limits[scope])},
                                },
                            }
                        }
                        for scope, pk in counters
                    ]
                )
            except ClientError as exc:
                if exc.response.get("Error", {}).get("Code") != "TransactionCanceledException":
                    raise
                reasons = exc.response.get("CancellationReasons", [])
                failed = [
                    scope
                    for (scope, _), reason in zip(counters, reasons, strict=False)
                    if reason.get("Code") == "ConditionalCheckFailed"
                ]
                raise LimitReachedError(failed[0] if failed else "usage") from exc

        await asyncio.to_thread(_consume)

    async def put_staging(self, rec: StagingRecord) -> None:
        item: dict[str, Any] = {
            "pk": {"S": f"staging#{rec.id}"},
            "style": {"S": rec.style.value},
            "created_at": {"S": rec.created_at},
            "provider": {"S": rec.provider},
            "original_key": {"S": rec.original_key},
            "staged_key": {"S": rec.staged_key},
            "structure": {"S": rec.structure.model_dump_json()},
        }
        await asyncio.to_thread(self._db.put_item, TableName=self._table, Item=item)

    async def get_staging(self, staging_id: str) -> StagingRecord | None:
        resp = await asyncio.to_thread(
            self._db.get_item, TableName=self._table, Key={"pk": {"S": f"staging#{staging_id}"}}
        )
        item = resp.get("Item")
        if not item:
            return None
        furniture = item.get("furniture", {}).get("S")
        return StagingRecord(
            id=staging_id,
            style=Style(item["style"]["S"]),
            created_at=item["created_at"]["S"],
            provider=item["provider"]["S"],
            original_key=item["original_key"]["S"],
            staged_key=item["staged_key"]["S"],
            structure=StructureCheck.model_validate_json(item["structure"]["S"]),
            furniture=[FurnitureItem.model_validate(f) for f in json.loads(furniture)]
            if furniture
            else None,
        )

    async def save_furniture(self, staging_id: str, items: list[FurnitureItem]) -> None:
        payload = json.dumps([i.model_dump() for i in items])
        await asyncio.to_thread(
            self._db.update_item,
            TableName=self._table,
            Key={"pk": {"S": f"staging#{staging_id}"}},
            UpdateExpression="SET furniture = :f",
            ExpressionAttributeValues={":f": {"S": payload}},
        )
