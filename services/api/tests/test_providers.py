"""The AI providers, without calling them: each SDK client is replaced by a stub that returns a
response in the provider's own format (built from the fixtures with the SDK's response types).
"""

import base64
import io
import json
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from google.genai import types as genai_types
from openai.types import ImagesResponse
from PIL import Image

from api.config import Settings
from api.editors import (
    EditorError,
    FakeEditor,
    GeminiEditor,
    OpenAIEditor,
    build_editor,
    staging_prompt,
)
from api.schemas import FurnitureItem, FurnitureList, Listing, ListingFacts, Style
from api.writer import ClaudeWriter, FakeWriter, WriterError, build_writer
from conftest import jpeg_bytes, room_photo

FIXTURES = Path(__file__).parent / "fixtures"
PHOTO = jpeg_bytes(room_photo(400, 300))
STAGED = jpeg_bytes(room_photo(400, 300, window_x=0.5))
FACTS = ListingFacts(
    property_type="apartment",
    bedrooms=2,
    bathrooms=1.5,
    area_sqm=95,
    location="Lahore",
    notes="Corner unit",
)


def fixture(name: str, image: bytes) -> str:
    return (FIXTURES / name).read_text().replace("{{IMAGE_B64}}", base64.b64encode(image).decode())


class Recorder:
    """Stands in for an SDK method: records the call, returns a canned response."""

    def __init__(self, response: Any) -> None:
        self.response = response
        self.calls: list[dict[str, Any]] = []

    async def __call__(self, **kwargs: Any) -> Any:
        self.calls.append(kwargs)
        return self.response


# ── OpenAI ──────────────────────────────────────────────────────────────


def openai_client(response: ImagesResponse) -> tuple[Any, Recorder]:
    edit = Recorder(response)
    return SimpleNamespace(images=SimpleNamespace(edit=edit)), edit


async def test_openai_editor_decodes_the_image_and_keeps_the_room() -> None:
    response = ImagesResponse.model_validate_json(fixture("openai_images_edit.json", STAGED))
    client, edit = openai_client(response)
    result = await OpenAIEditor(client, "gpt-image-2").stage(PHOTO, Style.modern)

    assert result == STAGED
    call = edit.calls[0]
    assert call["model"] == "gpt-image-2"
    assert call["input_fidelity"] == "high"  # Keep the original photo's structure.
    assert call["image"] == ("room.jpg", PHOTO, "image/jpeg")
    assert "Keep every wall, window" in call["prompt"]


async def test_openai_editor_without_an_image_raises() -> None:
    client, _ = openai_client(ImagesResponse.model_validate({"created": 1, "data": []}))
    with pytest.raises(EditorError):
        await OpenAIEditor(client, "gpt-image-2").stage(PHOTO, Style.modern)


# ── Gemini ──────────────────────────────────────────────────────────────


def gemini_client(response: genai_types.GenerateContentResponse) -> tuple[Any, Recorder]:
    generate = Recorder(response)
    return SimpleNamespace(
        aio=SimpleNamespace(models=SimpleNamespace(generate_content=generate))
    ), generate


async def test_gemini_editor_returns_the_image_part() -> None:
    response = genai_types.GenerateContentResponse.model_validate_json(
        fixture("gemini_generate_content.json", STAGED)
    )
    client, generate = gemini_client(response)
    result = await GeminiEditor(client, "gemini-3.1-flash-image").stage(PHOTO, Style.japandi)

    assert result == STAGED
    call = generate.calls[0]
    assert call["model"] == "gemini-3.1-flash-image"
    parts = call["contents"].parts
    assert parts[0].inline_data.data == PHOTO
    assert "Japandi" in parts[1].text
    assert call["config"].response_modalities == ["TEXT", "IMAGE"]


async def test_gemini_editor_with_only_text_raises() -> None:
    response = genai_types.GenerateContentResponse.model_validate(
        {
            "candidates": [
                {"content": {"role": "model", "parts": [{"text": "I can't edit this photo."}]}}
            ]
        }
    )
    client, _ = gemini_client(response)
    with pytest.raises(EditorError):
        await GeminiEditor(client, "gemini-3.1-flash-image").stage(PHOTO, Style.japandi)


# ── Fake editor and factories ──────────────────────────────────────────


async def test_fake_editor_returns_a_same_size_jpeg() -> None:
    out = Image.open(io.BytesIO(await FakeEditor().stage(PHOTO, Style.industrial)))
    assert out.format == "JPEG"
    assert out.size == (400, 300)


def test_every_style_prompt_keeps_the_room() -> None:
    for style in Style:
        assert "Add furniture and decor only" in staging_prompt(style)


def test_build_editor_and_writer(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENAI_API_KEY", "test")
    monkeypatch.setenv("GEMINI_API_KEY", "test")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test")
    assert build_editor(Settings(image_provider="openai")).name == "openai"
    assert build_editor(Settings(image_provider="gemini")).name == "gemini"
    assert build_editor(Settings()).name == "fake"
    assert build_writer(Settings(writer_provider="claude")).name == "claude"
    assert build_writer(Settings()).name == "fake"
    with pytest.raises(ValueError, match="IMAGE_PROVIDER"):
        build_editor(Settings(image_provider="dalle"))
    with pytest.raises(ValueError, match="WRITER_PROVIDER"):
        build_writer(Settings(writer_provider="gpt"))


# ── Claude ──────────────────────────────────────────────────────────────


def claude_client(response: Any) -> tuple[Any, Recorder]:
    parse = Recorder(response)
    return SimpleNamespace(beta=SimpleNamespace(messages=SimpleNamespace(parse=parse))), parse


def parsed(output: Any, stop_reason: str = "end_turn") -> SimpleNamespace:
    return SimpleNamespace(stop_reason=stop_reason, parsed_output=output)


async def test_claude_furniture_request() -> None:
    items = json.loads((FIXTURES / "claude_furniture.json").read_text())
    client, parse = claude_client(parsed(FurnitureList.model_validate(items)))
    result = await ClaudeWriter(client, "claude-opus-5-5").furniture(STAGED)

    assert [i.category for i in result] == ["seating", "table", "lighting"]
    call = parse.calls[0]
    assert call["model"] == "claude-opus-5-5"
    assert call["fallbacks"] == "default"
    assert call["betas"] == ["server-side-fallback-2026-07-01"]
    assert call["output_format"] is FurnitureList
    assert call["output_config"] == {"effort": "low"}
    image = call["messages"][0]["content"][0]
    assert image["source"]["media_type"] == "image/jpeg"
    assert base64.standard_b64decode(image["source"]["data"]) == STAGED


async def test_claude_listing_sends_every_photo_and_the_facts() -> None:
    listing = Listing(headline="h", description="d", highlights=["a"])
    client, parse = claude_client(parsed(listing))
    assert await ClaudeWriter(client, "claude-opus-5-5").listing([STAGED, PHOTO], FACTS) == listing

    content = parse.calls[0]["messages"][0]["content"]
    assert [b["type"] for b in content] == ["image", "image", "text"]
    for expected in ("Bathrooms: 1.5", "Area: 95 m²", "Agent's notes: Corner unit"):
        assert expected in content[-1]["text"]
    assert parse.calls[0]["output_format"] is Listing


@pytest.mark.parametrize(
    "response",
    [parsed(None, stop_reason="refusal"), parsed(None, stop_reason="max_tokens")],
)
async def test_claude_without_usable_output_raises(response: Any) -> None:
    client, _ = claude_client(response)
    with pytest.raises(WriterError):
        await ClaudeWriter(client, "claude-opus-5-5").furniture(STAGED)


async def test_fake_writer() -> None:
    items = await FakeWriter().furniture(STAGED)
    assert all(isinstance(i, FurnitureItem) for i in items)
    listing = await FakeWriter().listing([STAGED], FACTS)
    assert "Lahore" in listing.headline
    assert "1.5 bathrooms" in listing.highlights
