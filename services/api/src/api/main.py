"""HTTP API: the staging endpoints, plus probes, Prometheus metrics, request IDs and JSON logs."""

from __future__ import annotations

import asyncio
import logging
import re
import time
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import FastAPI, Header, HTTPException, Path, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    CollectorRegistry,
    Counter,
    Histogram,
    generate_latest,
)

from api.config import Settings, load_settings
from api.editors import EditorError, build_editor
from api.images import ImageError
from api.logs import configure_logging
from api.schemas import (
    STYLE_BRIEFS,
    FurnitureList,
    Listing,
    ListingRequest,
    Staging,
    StagingRequest,
    StyleInfo,
    UploadRequest,
    UploadResponse,
)
from api.service import StagingService
from api.storage import NotFoundError, PhotoStorage
from api.store import LimitReachedError, Store
from api.writer import WriterError, build_writer

log = logging.getLogger("api")

StagingId = Annotated[str, Path(pattern=r"^[0-9a-f]{32}$")]
_VISITOR = re.compile(r"^[A-Za-z0-9-]{8,64}$")


def build_service(settings: Settings) -> StagingService:
    return StagingService(
        settings,
        PhotoStorage(settings),
        Store(settings),
        build_editor(settings),
        build_writer(settings),
    )


def _seconds_to_utc_midnight() -> int:
    now = datetime.now(UTC)
    midnight = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return int((midnight - now).total_seconds()) + 1


def create_app(settings: Settings | None = None, service: StagingService | None = None) -> FastAPI:
    settings = settings or load_settings()
    configure_logging(settings.log_level)
    staging = service or build_service(settings)

    # A registry per app keeps tests independent and avoids duplicate-metric errors on reload.
    registry = CollectorRegistry()
    requests_total = Counter(
        "http_requests_total", "HTTP requests.", ["method", "route", "status"], registry=registry
    )
    latency = Histogram(
        "http_request_duration_seconds",
        "HTTP request latency.",
        ["method", "route"],
        registry=registry,
        # Staging waits on an image model for tens of seconds; the default buckets stop at 10 s.
        buckets=(0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 20, 40, 60, 90),
    )
    state = {"ready": False}

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        if settings.auto_create_resources:
            await asyncio.to_thread(staging.ensure_resources)
        state["ready"] = True
        log.info(
            "startup",
            extra={
                "service": settings.service_name,
                "version": settings.version,
                "image_provider": settings.image_provider,
                "writer_provider": settings.writer_provider,
            },
        )
        yield
        # Fail readiness first so the load balancer stops sending traffic,
        # then let in-flight requests finish.
        state["ready"] = False
        log.info("shutdown")

    app = FastAPI(title=settings.service_name, version=settings.version, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "X-Visitor-Id", "X-Request-Id"],
        expose_headers=["X-Request-Id"],
    )

    @app.middleware("http")
    async def observe(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
        start = time.perf_counter()
        response = await call_next(request)
        elapsed = time.perf_counter() - start
        # Label by the route template (/v1/stagings/{staging_id}), never the raw path, so ids
        # and random 404 URLs can't explode metric cardinality.
        route = getattr(request.scope.get("route"), "path", None) or "unmatched"
        requests_total.labels(request.method, route, str(response.status_code)).inc()
        latency.labels(request.method, route).observe(elapsed)
        response.headers["x-request-id"] = request_id
        log.info(
            "request",
            extra={
                "request_id": request_id,
                "method": request.method,
                "route": route,
                "status": response.status_code,
                "duration_ms": round(elapsed * 1000, 2),
            },
        )
        return response

    @app.exception_handler(LimitReachedError)
    async def limit_reached(_: Request, exc: LimitReachedError) -> JSONResponse:
        return JSONResponse(
            {
                "error": "daily_limit",
                "scope": exc.scope,
                "message": "Today's limit is used up. Try again tomorrow.",
            },
            status_code=429,
            headers={"Retry-After": str(_seconds_to_utc_midnight())},
        )

    @app.exception_handler(ImageError)
    async def bad_image(_: Request, exc: ImageError) -> JSONResponse:
        return JSONResponse({"error": "bad_image", "message": str(exc)}, status_code=422)

    @app.exception_handler(EditorError)
    @app.exception_handler(WriterError)
    async def provider_failed(_: Request, exc: Exception) -> JSONResponse:
        log.warning("provider_failed", extra={"error": str(exc)})
        return JSONResponse(
            {
                "error": "provider_failed",
                "message": "The AI provider couldn't finish this one. Try again.",
            },
            status_code=502,
        )

    @app.get("/healthz")
    async def healthz() -> dict[str, str]:
        """Liveness: the process is up. Never checks dependencies (that causes restart storms)."""
        return {"status": "ok"}

    @app.get("/readyz")
    async def readyz() -> JSONResponse:
        """Readiness: safe to receive traffic."""
        if state["ready"]:
            return JSONResponse({"status": "ready"})
        return JSONResponse({"status": "not ready"}, status_code=503)

    @app.get("/metrics")
    async def metrics() -> Response:
        return Response(generate_latest(registry), media_type=CONTENT_TYPE_LATEST)

    def caller(request: Request, visitor_id: str | None) -> tuple[str, str]:
        """Who to count against the daily limits: the browser's id and the client address."""
        visitor = visitor_id if visitor_id and _VISITOR.match(visitor_id) else "anonymous"
        return visitor, request.client.host if request.client else "unknown"

    @app.get("/v1/styles")
    async def styles() -> list[StyleInfo]:
        return [StyleInfo(id=s, brief=b) for s, b in STYLE_BRIEFS.items()]

    @app.post("/v1/uploads", status_code=201)
    async def create_upload(body: UploadRequest) -> UploadResponse:
        if body.size_bytes > settings.max_upload_bytes:
            raise HTTPException(
                413, f"Photos can be up to {settings.max_upload_bytes // 1_048_576} MB."
            )
        return staging.create_upload(body.content_type)

    @app.post("/v1/stagings", status_code=201)
    async def create_staging(
        body: StagingRequest, request: Request, x_visitor_id: Annotated[str | None, Header()] = None
    ) -> Staging:
        visitor, ip = caller(request, x_visitor_id)
        try:
            return await staging.stage(body.upload_id, body.style, visitor, ip)
        except NotFoundError as exc:
            raise HTTPException(404, "Upload not found. Upload the photo first.") from exc

    @app.get("/v1/stagings/{staging_id}")
    async def get_staging(staging_id: StagingId) -> Staging:
        found = await staging.get(staging_id)
        if found is None:
            raise HTTPException(404, "Staging not found.")
        return found

    @app.post("/v1/stagings/{staging_id}/furniture")
    async def furniture(
        staging_id: StagingId,
        request: Request,
        x_visitor_id: Annotated[str | None, Header()] = None,
    ) -> FurnitureList:
        visitor, ip = caller(request, x_visitor_id)
        items = await staging.furniture(staging_id, visitor, ip)
        if items is None:
            raise HTTPException(404, "Staging not found.")
        return FurnitureList(items=items)

    @app.post("/v1/listings")
    async def listing(
        body: ListingRequest, request: Request, x_visitor_id: Annotated[str | None, Header()] = None
    ) -> Listing:
        visitor, ip = caller(request, x_visitor_id)
        result = await staging.listing(body.staging_ids, body.facts, visitor, ip)
        if result is None:
            raise HTTPException(404, "One of the stagings was not found.")
        return result

    return app


app = create_app()
