import json
import logging
from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient

from api.config import Settings, load_settings
from api.editors import EditorError
from api.logs import JsonFormatter
from api.main import create_app
from api.schemas import FurnitureItem, Listing, ListingFacts, Style
from api.service import StagingService
from api.writer import FakeWriter, WriterError
from conftest import do_upload, make_service

VISITOR = {"X-Visitor-Id": "visitor-0001"}
FACTS = {
    "property_type": "apartment",
    "bedrooms": 2,
    "bathrooms": 1,
    "location": "DHA Phase 5, Lahore",
}


def stage(client: TestClient, upload_id: str, headers: dict[str, str] = VISITOR) -> Any:
    return client.post(
        "/v1/stagings", json={"upload_id": upload_id, "style": "japandi"}, headers=headers
    )


# ── Probes, metrics, logs ───────────────────────────────────────────────


def test_healthz(client: TestClient) -> None:
    assert client.get("/healthz").json() == {"status": "ok"}


def test_readyz_when_started(client: TestClient) -> None:
    assert client.get("/readyz").json() == {"status": "ready"}


def test_readyz_before_startup_is_503(service: StagingService, settings: Settings) -> None:
    # Without the context manager the lifespan never runs: the app must not claim readiness.
    r = TestClient(create_app(settings, service)).get("/readyz")
    assert r.status_code == 503


def test_request_id_is_echoed_or_generated(client: TestClient) -> None:
    assert client.get("/healthz", headers={"x-request-id": "abc"}).headers["x-request-id"] == "abc"
    assert len(client.get("/healthz").headers["x-request-id"]) == 32


def test_metrics_label_routes_by_template(client: TestClient) -> None:
    client.get("/healthz")
    client.get("/v1/stagings/" + "0" * 32)
    client.get("/does-not-exist")
    body = client.get("/metrics").text
    assert 'http_requests_total{method="GET",route="/healthz",status="200"}' in body
    assert 'route="/v1/stagings/{staging_id}",status="404"' in body
    assert 'route="unmatched"' in body


def test_json_formatter_includes_extra_fields() -> None:
    record = logging.makeLogRecord(
        {"msg": "hi", "levelname": "INFO", "name": "t", "request_id": "r1"}
    )
    out = json.loads(JsonFormatter().format(record))
    assert out["msg"] == "hi"
    assert out["request_id"] == "r1"
    assert out["level"] == "info"


def test_load_settings_from_env() -> None:
    s = load_settings(
        {
            "SERVICE_NAME": "svc",
            "APP_VERSION": "2.0.0",
            "LOG_LEVEL": "debug",
            "AUTO_CREATE_RESOURCES": "true",
            "IMAGE_PROVIDER": "OpenAI",
            "S3_ENDPOINT_URL": "http://minio:9000",
            "VISITOR_DAILY_LIMIT": "7",
            "STRUCTURE_THRESHOLD": "0.4",
            "CORS_ORIGINS": "http://a.test, http://b.test",
        }
    )
    assert s.service_name == "svc"
    assert s.version == "2.0.0"
    assert s.log_level == "DEBUG"
    assert s.auto_create_resources is True
    assert s.image_provider == "openai"
    assert s.s3_endpoint_url == "http://minio:9000"
    assert s.dynamodb_endpoint_url is None
    assert s.visitor_daily_limit == 7
    assert s.structure_threshold == 0.4
    assert s.cors_origins == ("http://a.test", "http://b.test")
    assert load_settings({}) == Settings()


# ── Uploads ─────────────────────────────────────────────────────────────


def test_styles(client: TestClient) -> None:
    ids = [s["id"] for s in client.get("/v1/styles").json()]
    assert ids == [s.value for s in Style]


def test_upload_is_a_presigned_post_with_limits(client: TestClient) -> None:
    r = client.post("/v1/uploads", json={"content_type": "image/png", "size_bytes": 1000})
    body = r.json()
    assert r.status_code == 201
    assert body["fields"]["key"] == f"uploads/{body['upload_id']}"
    assert body["fields"]["Content-Type"] == "image/png"
    assert "policy" in body["fields"]
    assert body["expires_in"] == 300


def test_upload_rejects_large_files_and_other_types(client: TestClient) -> None:
    too_big = client.post(
        "/v1/uploads", json={"content_type": "image/jpeg", "size_bytes": 11 * 1024 * 1024}
    )
    assert too_big.status_code == 413
    gif = client.post("/v1/uploads", json={"content_type": "image/gif", "size_bytes": 10})
    assert gif.status_code == 422


# ── Staging ─────────────────────────────────────────────────────────────


def test_stage_a_room(client: TestClient, upload: Callable[[bytes], str], photo: bytes) -> None:
    r = stage(client, upload(photo))
    assert r.status_code == 201
    body = r.json()
    assert body["label"] == "Virtually staged"
    assert body["style"] == "japandi"
    assert body["provider"] == "fake"
    assert body["structure"]["flagged"] is False
    assert "originals/" in body["original_url"]
    assert "staged/" in body["staged_url"]
    assert client.get(f"/v1/stagings/{body['id']}").json()["id"] == body["id"]


def test_stage_unknown_upload_is_404(client: TestClient) -> None:
    assert stage(client, "f" * 32).status_code == 404


def test_stage_a_file_that_is_not_a_photo_is_422(
    client: TestClient, upload: Callable[[bytes], str]
) -> None:
    r = stage(client, upload(b"definitely not a jpeg"))
    assert r.status_code == 422
    assert r.json()["error"] == "bad_image"


def test_bad_photos_do_not_use_the_daily_limit(
    client: TestClient, upload: Callable[[bytes], str]
) -> None:
    for _ in range(4):  # The visitor limit is 3.
        assert stage(client, upload(b"nope")).status_code == 422


def test_visitor_limit(client: TestClient, upload: Callable[[bytes], str], photo: bytes) -> None:
    for _ in range(3):
        assert stage(client, upload(photo)).status_code == 201
    r = stage(client, upload(photo))
    assert r.status_code == 429
    assert r.json()["scope"] == "visitor"
    assert 0 < int(r.headers["retry-after"]) <= 86401


def test_ip_limit_covers_many_visitor_ids(
    client: TestClient, upload: Callable[[bytes], str], photo: bytes
) -> None:
    for n in range(5):
        assert stage(client, upload(photo), {"X-Visitor-Id": f"visitor-{n:04}"}).status_code == 201
    r = stage(client, upload(photo), {"X-Visitor-Id": "visitor-9999"})
    assert r.status_code == 429
    assert r.json()["scope"] == "ip"


def test_invalid_visitor_ids_share_one_anonymous_bucket(
    client: TestClient, upload: Callable[[bytes], str], photo: bytes
) -> None:
    for _ in range(3):
        assert stage(client, upload(photo), {"X-Visitor-Id": "bad id!"}).status_code == 201
    assert stage(client, upload(photo), {}).status_code == 429


# ── Furniture and listing ───────────────────────────────────────────────


def test_furniture_is_generated_once_then_cached(
    client: TestClient, upload: Callable[[bytes], str], photo: bytes
) -> None:
    staging_id = stage(client, upload(photo)).json()["id"]  # 1 of 3
    first = client.post(f"/v1/stagings/{staging_id}/furniture", headers=VISITOR)  # 2 of 3
    assert first.status_code == 200
    assert first.json()["items"][0]["category"] == "seating"
    for _ in range(3):  # Cached: these don't count, or the third would be over the limit.
        assert (
            client.post(f"/v1/stagings/{staging_id}/furniture", headers=VISITOR).status_code == 200
        )
    assert client.get(f"/v1/stagings/{staging_id}").json()["furniture"] == first.json()["items"]


def test_furniture_for_unknown_staging_is_404(client: TestClient) -> None:
    assert client.post("/v1/stagings/" + "a" * 32 + "/furniture").status_code == 404


def test_listing(client: TestClient, upload: Callable[[bytes], str], photo: bytes) -> None:
    staging_id = stage(client, upload(photo)).json()["id"]
    r = client.post(
        "/v1/listings", json={"staging_ids": [staging_id], "facts": FACTS}, headers=VISITOR
    )
    assert r.status_code == 200
    assert "Lahore" in r.json()["headline"]


def test_listing_with_unknown_staging_is_404(client: TestClient) -> None:
    r = client.post("/v1/listings", json={"staging_ids": ["b" * 32], "facts": FACTS})
    assert r.status_code == 404


# ── Provider failures ───────────────────────────────────────────────────


class BrokenEditor:
    name = "broken"

    async def stage(self, photo: bytes, style: Style) -> bytes:
        raise EditorError("no image")


class RefusingWriter(FakeWriter):
    async def furniture(self, photo: bytes) -> list[FurnitureItem]:
        raise WriterError("declined")

    async def listing(self, photos: list[bytes], facts: ListingFacts) -> Listing:
        raise WriterError("declined")


@pytest.mark.usefixtures("aws")
def test_provider_failures_are_502(settings: Settings, photo: bytes) -> None:
    service = make_service(settings, editor=BrokenEditor(), writer=RefusingWriter())
    with TestClient(create_app(settings, service)) as client:
        r = stage(client, do_upload(client, settings, photo))
        assert r.status_code == 502
        assert r.json()["error"] == "provider_failed"

    service = make_service(settings, writer=RefusingWriter())
    with TestClient(create_app(settings, service)) as client:
        staging_id = stage(client, do_upload(client, settings, photo)).json()["id"]
        assert client.post(f"/v1/stagings/{staging_id}/furniture").status_code == 502


@pytest.mark.usefixtures("aws")
def test_startup_creates_resources_when_asked(settings: Settings) -> None:
    local = Settings(
        **{
            **settings.__dict__,
            "auto_create_resources": True,
            "s3_bucket": "fresh",
            "dynamodb_table": "fresh",
        }
    )
    service = make_service(local)
    with TestClient(create_app(local, service)) as client:
        assert client.get("/readyz").status_code == 200
