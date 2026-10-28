"""The staging workflow: upload, stage, check, label, store; then furniture and listing text."""

from __future__ import annotations

import logging
import time
import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from api import images
from api.schemas import (
    FurnitureItem,
    Listing,
    ListingFacts,
    Staging,
    StructureCheck,
    Style,
    UploadResponse,
)
from api.store import StagingRecord
from api.structure import structure_score

if TYPE_CHECKING:
    from api.config import Settings
    from api.editors import ImageEditor
    from api.storage import PhotoStorage
    from api.store import Store
    from api.writer import Writer

log = logging.getLogger("api.staging")


class StagingService:
    def __init__(
        self,
        settings: Settings,
        storage: PhotoStorage,
        store: Store,
        editor: ImageEditor,
        writer: Writer,
    ) -> None:
        self._settings = settings
        self._storage = storage
        self._store = store
        self._editor = editor
        self._writer = writer

    def ensure_resources(self) -> None:
        """Create the bucket and table for local runs (AUTO_CREATE_RESOURCES=true)."""
        self._storage.ensure_bucket()
        self._store.ensure_table()

    def create_upload(self, content_type: str) -> UploadResponse:
        upload_id = uuid.uuid4().hex
        url, fields = self._storage.presign_upload(f"uploads/{upload_id}", content_type)
        return UploadResponse(
            upload_id=upload_id,
            url=url,
            fields=fields,
            expires_in=self._settings.upload_url_ttl_seconds,
        )

    async def stage(self, upload_id: str, style: Style, visitor: str, ip: str) -> Staging:
        # Validate the photo before spending anything on it.
        raw = await self._storage.get(f"uploads/{upload_id}")
        original = images.prepare_upload(raw)
        await self._store.consume(visitor, ip)

        started = time.perf_counter()
        staged_raw = await self._editor.stage(original, style)
        seconds = round(time.perf_counter() - started, 2)

        original_img = images.open_rgb(original)
        staged_img = images.match_size(staged_raw, original_img.size)
        score = structure_score(original_img, staged_img)
        structure = StructureCheck(score=score, flagged=score < self._settings.structure_threshold)

        staging_id = uuid.uuid4().hex
        rec = StagingRecord(
            id=staging_id,
            style=style,
            created_at=datetime.now(UTC).isoformat(timespec="seconds"),
            provider=self._editor.name,
            original_key=f"originals/{upload_id}.jpg",
            staged_key=f"staged/{staging_id}.jpg",
            structure=structure,
        )
        await self._storage.put(rec.original_key, original)
        await self._storage.put(rec.staged_key, images.add_label(staged_img))
        await self._store.put_staging(rec)
        log.info(
            "staged",
            extra={
                "staging_id": staging_id,
                "style": style.value,
                "provider": self._editor.name,
                "editor_seconds": seconds,
                "structure_score": score,
                "flagged": structure.flagged,
            },
        )
        return self._view(rec)

    async def get(self, staging_id: str) -> Staging | None:
        rec = await self._store.get_staging(staging_id)
        return self._view(rec) if rec else None

    async def furniture(self, staging_id: str, visitor: str, ip: str) -> list[FurnitureItem] | None:
        rec = await self._store.get_staging(staging_id)
        if rec is None:
            return None
        if rec.furniture is not None:
            return rec.furniture  # Asked before: no second AI call.
        await self._store.consume(visitor, ip)
        items = await self._writer.furniture(
            images.for_vision(await self._storage.get(rec.staged_key))
        )
        await self._store.save_furniture(staging_id, items)
        return items

    async def listing(
        self, staging_ids: list[str], facts: ListingFacts, visitor: str, ip: str
    ) -> Listing | None:
        recs = [await self._store.get_staging(s) for s in dict.fromkeys(staging_ids)]
        if any(r is None for r in recs):
            return None
        await self._store.consume(visitor, ip)
        photos = [images.for_vision(await self._storage.get(r.staged_key)) for r in recs if r]
        return await self._writer.listing(photos, facts)

    def _view(self, rec: StagingRecord) -> Staging:
        return Staging(
            id=rec.id,
            style=rec.style,
            created_at=rec.created_at,
            provider=rec.provider,
            original_url=self._storage.presign_view(rec.original_key),
            staged_url=self._storage.presign_view(rec.staged_key),
            structure=rec.structure,
            furniture=rec.furniture,
        )
