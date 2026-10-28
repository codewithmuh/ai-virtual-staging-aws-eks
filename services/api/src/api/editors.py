"""Image editors: the model that stages a room. One interface, swappable providers (ADR 0002)."""

from __future__ import annotations

import base64
import io
from typing import TYPE_CHECKING, ClassVar, Protocol

from PIL import Image, ImageDraw

from api.schemas import STYLE_BRIEFS, Style

if TYPE_CHECKING:
    from google import genai
    from openai import AsyncOpenAI

    from api.config import Settings


class EditorError(RuntimeError):
    """The provider returned no usable image (an error, a safety block, or an empty response)."""


class ImageEditor(Protocol):
    name: str

    async def stage(self, photo: bytes, style: Style) -> bytes:
        """Return the staged photo as image bytes. `photo` is a clean JPEG."""
        ...


def staging_prompt(style: Style) -> str:
    """The same instruction for every provider, so their results can be compared fairly."""
    return (
        f"Virtually stage this real-estate photo. Style: {STYLE_BRIEFS[style]}.\n"
        "Add furniture and decor only. Keep every wall, window, door, floor, ceiling, light "
        "fixture and the view outside exactly as they are, with the same camera angle and "
        "framing. Photorealistic, natural light that matches the photo. No people, no text, "
        "no watermarks."
    )


class OpenAIEditor:
    name = "openai"

    def __init__(self, client: AsyncOpenAI, model: str) -> None:
        self._client = client
        self._model = model

    async def stage(self, photo: bytes, style: Style) -> bytes:
        result = await self._client.images.edit(
            model=self._model,
            image=("room.jpg", photo, "image/jpeg"),
            prompt=staging_prompt(style),
            # High input fidelity keeps more of the original photo: what rule R2 asks for.
            input_fidelity="high",
            size="auto",
            output_format="jpeg",
        )
        b64 = result.data[0].b64_json if result.data else None
        if not b64:
            raise EditorError("OpenAI returned no image")
        return base64.b64decode(b64)


class GeminiEditor:
    name = "gemini"

    def __init__(self, client: genai.Client, model: str) -> None:
        self._client = client
        self._model = model

    async def stage(self, photo: bytes, style: Style) -> bytes:
        from google.genai import types

        response = await self._client.aio.models.generate_content(
            model=self._model,
            contents=types.Content(
                role="user",
                parts=[
                    types.Part.from_bytes(data=photo, mime_type="image/jpeg"),
                    types.Part.from_text(text=staging_prompt(style)),
                ],
            ),
            config=types.GenerateContentConfig(response_modalities=["TEXT", "IMAGE"]),
        )
        for candidate in response.candidates or []:
            for part in (candidate.content.parts if candidate.content else None) or []:
                if part.inline_data and part.inline_data.data:
                    return part.inline_data.data
        raise EditorError("Gemini returned no image")


class FakeEditor:
    """No API key, no cost: tints the photo and draws simple furniture blocks.

    It exists so the app, the web UI and CI run end to end without a paid provider.
    """

    name = "fake"
    _TINTS: ClassVar[dict[Style, tuple[int, int, int]]] = {
        Style.japandi: (196, 170, 132),
        Style.scandinavian: (226, 222, 214),
        Style.industrial: (92, 74, 58),
        Style.modern: (40, 40, 44),
    }

    async def stage(self, photo: bytes, style: Style) -> bytes:
        with Image.open(io.BytesIO(photo)) as src:
            img = src.convert("RGB")
        w, h = img.size
        color = self._TINTS[style]
        draw = ImageDraw.Draw(img, "RGBA")
        # A sofa, a rug and a lamp, low in the frame where real furniture would sit.
        draw.rectangle((w * 0.18, h * 0.62, w * 0.62, h * 0.82), fill=(*color, 230))
        draw.ellipse((w * 0.14, h * 0.80, w * 0.70, h * 0.95), fill=(*color, 120))
        draw.rectangle((w * 0.74, h * 0.45, w * 0.76, h * 0.80), fill=(30, 30, 30, 220))
        draw.ellipse((w * 0.70, h * 0.38, w * 0.80, h * 0.47), fill=(250, 240, 210, 230))
        buf = io.BytesIO()
        img.save(buf, "JPEG", quality=90)
        return buf.getvalue()


def build_editor(settings: Settings) -> ImageEditor:
    if settings.image_provider == "openai":
        from openai import AsyncOpenAI

        return OpenAIEditor(AsyncOpenAI(), settings.openai_image_model)
    if settings.image_provider == "gemini":
        from google import genai

        return GeminiEditor(genai.Client(), settings.gemini_image_model)
    if settings.image_provider == "fake":
        return FakeEditor()
    raise ValueError(f"Unknown IMAGE_PROVIDER: {settings.image_provider!r}")
