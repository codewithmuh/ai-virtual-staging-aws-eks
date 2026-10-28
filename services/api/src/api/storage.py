"""Photos in S3. Browsers upload with a presigned POST and view with presigned GET URLs.

boto3 is synchronous, so every call runs in a worker thread to keep the event loop free.
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

if TYPE_CHECKING:
    from types_boto3_s3.client import S3Client

    from api.config import Settings


class NotFoundError(LookupError):
    pass


class PhotoStorage:
    def __init__(self, settings: Settings) -> None:
        self._bucket = settings.s3_bucket
        self._max_bytes = settings.max_upload_bytes
        self._upload_ttl = settings.upload_url_ttl_seconds
        self._view_ttl = settings.view_url_ttl_seconds
        config = Config(
            signature_version="s3v4", s3={"addressing_style": "path"}, retries={"mode": "standard"}
        )
        self._s3: S3Client = boto3.client(
            "s3",
            region_name=settings.aws_region,
            endpoint_url=settings.s3_endpoint_url,
            config=config,
        )
        # Presigned URLs are signed for the host the browser will call (see Settings).
        self._s3_public: S3Client = boto3.client(
            "s3",
            region_name=settings.aws_region,
            endpoint_url=settings.s3_public_endpoint_url or settings.s3_endpoint_url,
            config=config,
        )

    def ensure_bucket(self) -> None:
        """Local runs only (AUTO_CREATE_RESOURCES). In AWS the bucket comes from Terraform."""
        try:
            self._s3.head_bucket(Bucket=self._bucket)
        except ClientError:
            self._s3.create_bucket(Bucket=self._bucket)

    def presign_upload(self, key: str, content_type: str) -> tuple[str, dict[str, str]]:
        """A POST policy, not a PUT URL, so S3 itself rejects wrong types and oversized files."""
        post = self._s3_public.generate_presigned_post(
            Bucket=self._bucket,
            Key=key,
            Fields={"Content-Type": content_type},
            Conditions=[
                {"Content-Type": content_type},
                ["content-length-range", 1, self._max_bytes],
            ],
            ExpiresIn=self._upload_ttl,
        )
        return post["url"], {k: str(v) for k, v in post["fields"].items()}

    def presign_view(self, key: str) -> str:
        return self._s3_public.generate_presigned_url(
            "get_object", Params={"Bucket": self._bucket, "Key": key}, ExpiresIn=self._view_ttl
        )

    async def get(self, key: str) -> bytes:
        def _get() -> bytes:
            try:
                obj = self._s3.get_object(Bucket=self._bucket, Key=key)
            except ClientError as exc:
                if exc.response.get("Error", {}).get("Code") in {"NoSuchKey", "404"}:
                    raise NotFoundError(key) from exc
                raise
            return obj["Body"].read()

        return await asyncio.to_thread(_get)

    async def put(self, key: str, data: bytes, content_type: str = "image/jpeg") -> None:
        await asyncio.to_thread(
            self._s3.put_object, Bucket=self._bucket, Key=key, Body=data, ContentType=content_type
        )
