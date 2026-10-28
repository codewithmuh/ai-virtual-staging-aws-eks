"""Shared fixtures: a moto-backed S3 and DynamoDB, a synthetic room photo, and an app client.

No test talks to AWS or to an AI provider: moto keeps S3 and DynamoDB in memory, and the
providers are fakes or SDK clients replaced with recorded-shape responses.
"""

import asyncio
import io
from collections.abc import Callable, Iterator

import pytest
from fastapi.testclient import TestClient
from moto import mock_aws
from PIL import Image, ImageDraw

from api.config import Settings
from api.editors import FakeEditor, ImageEditor
from api.main import create_app
from api.service import StagingService
from api.storage import PhotoStorage
from api.store import Store
from api.writer import FakeWriter, Writer


def room_photo(width: int = 1200, height: int = 800, *, window_x: float = 0.55) -> Image.Image:
    """An empty room: back wall, floor line, a door and a window. Enough edges to check."""
    img = Image.new("RGB", (width, height), (214, 208, 196))
    d = ImageDraw.Draw(img)
    d.rectangle((0, height * 0.7, width, height), fill=(150, 120, 90))  # floor
    d.line((0, height * 0.7, width, height * 0.7), fill=(60, 50, 40), width=4)  # floor line
    d.rectangle(
        (width * 0.08, height * 0.2, width * 0.24, height * 0.7), outline=(70, 60, 50), width=6
    )
    wx = width * window_x
    d.rectangle(
        (wx, height * 0.15, wx + width * 0.3, height * 0.5),
        fill=(180, 215, 240),
        outline=(40, 40, 40),
        width=6,
    )
    d.line(
        (wx + width * 0.15, height * 0.15, wx + width * 0.15, height * 0.5),
        fill=(40, 40, 40),
        width=4,
    )
    return img


def jpeg_bytes(img: Image.Image, exif: Image.Exif | None = None) -> bytes:
    buf = io.BytesIO()
    if exif is not None:
        img.save(buf, "JPEG", quality=92, exif=exif)
    else:
        img.save(buf, "JPEG", quality=92)
    return buf.getvalue()


@pytest.fixture
def photo() -> bytes:
    return jpeg_bytes(room_photo())


@pytest.fixture
def settings() -> Settings:
    return Settings(
        s3_bucket="test-photos",
        dynamodb_table="test-heya",
        visitor_daily_limit=3,
        ip_daily_limit=5,
        global_daily_limit=50,
    )


@pytest.fixture
def aws(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    for key, value in {
        "AWS_ACCESS_KEY_ID": "testing",
        "AWS_SECRET_ACCESS_KEY": "testing",
        "AWS_SESSION_TOKEN": "testing",
        "AWS_DEFAULT_REGION": "us-east-1",
    }.items():
        monkeypatch.setenv(key, value)
    with mock_aws():
        yield


def make_service(
    settings: Settings, editor: ImageEditor | None = None, writer: Writer | None = None
) -> StagingService:
    service = StagingService(
        settings,
        PhotoStorage(settings),
        Store(settings),
        editor or FakeEditor(),
        writer or FakeWriter(),
    )
    service.ensure_resources()
    return service


@pytest.fixture
def service(aws: None, settings: Settings) -> StagingService:
    return make_service(settings)


@pytest.fixture
def client(service: StagingService, settings: Settings) -> Iterator[TestClient]:
    # Entering the context runs the lifespan, so the app reports ready.
    with TestClient(create_app(settings, service)) as c:
        yield c


def do_upload(client: TestClient, settings: Settings, data: bytes) -> str:
    """Ask the API for an upload, then do what the browser does: send the file to S3."""
    r = client.post("/v1/uploads", json={"content_type": "image/jpeg", "size_bytes": len(data)})
    assert r.status_code == 201
    upload_id: str = r.json()["upload_id"]
    asyncio.run(PhotoStorage(settings).put(f"uploads/{upload_id}", data))
    return upload_id


@pytest.fixture
def upload(client: TestClient, settings: Settings) -> Callable[[bytes], str]:
    return lambda data: do_upload(client, settings, data)
