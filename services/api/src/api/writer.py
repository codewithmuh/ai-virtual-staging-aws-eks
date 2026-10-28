"""Claude reads the staged photos: the "shop this look" list and the listing description."""

from __future__ import annotations

import base64
from typing import TYPE_CHECKING, Any, Protocol

from api.schemas import FurnitureItem, FurnitureList, Listing, ListingFacts

if TYPE_CHECKING:
    from anthropic import AsyncAnthropic
    from anthropic.types.beta import BetaImageBlockParam, BetaTextBlockParam

    from api.config import Settings

# If Claude declines a request, the API re-runs it on the model Anthropic recommends for that
# kind of decline, inside the same call, instead of failing the user's request.
FALLBACK_BETA = "server-side-fallback-2026-07-01"

FURNITURE_SYSTEM = (
    "You list the furniture and decor in a virtually staged room photo so a buyer can shop the "
    "look. Name only pieces you can actually see, the most noticeable first, at most 10. Ignore "
    "walls, windows, floors and built-in fixtures: they are part of the home, not for sale. The "
    "photo carries a 'Virtually staged' label; ignore it."
)

LISTING_SYSTEM = (
    "You write real-estate listing descriptions. Use only what the photos show and the facts "
    "you are given; never invent features, distances or amenities. The photos are virtually "
    "staged, so describe the space and light, not the furniture, which does not come with the "
    "home. Warm and specific, no clichés like 'nestled' or 'boasts'. A headline under 12 words, "
    "a description of 120 to 180 words, and three to five short highlights."
)


class WriterError(RuntimeError):
    """Claude declined the request or returned nothing usable."""


class Writer(Protocol):
    name: str

    async def furniture(self, photo: bytes) -> list[FurnitureItem]: ...

    async def listing(self, photos: list[bytes], facts: ListingFacts) -> Listing: ...


def _image(jpeg: bytes) -> BetaImageBlockParam:
    data = base64.standard_b64encode(jpeg).decode("ascii")
    return {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": data}}


def _text(text: str) -> BetaTextBlockParam:
    return {"type": "text", "text": text}


def _facts_text(facts: ListingFacts) -> str:
    lines = [
        f"Property type: {facts.property_type}",
        f"Bedrooms: {facts.bedrooms}",
        f"Bathrooms: {facts.bathrooms:g}",
        f"Location: {facts.location}",
    ]
    if facts.area_sqm:
        lines.append(f"Area: {facts.area_sqm} m²")
    if facts.notes:
        lines.append(f"Agent's notes: {facts.notes}")
    return "\n".join(lines)


class ClaudeWriter:
    name = "claude"

    def __init__(self, client: AsyncAnthropic, model: str) -> None:
        self._client = client
        self._model = model

    async def furniture(self, photo: bytes) -> list[FurnitureItem]:
        response = await self._client.beta.messages.parse(
            model=self._model,
            max_tokens=16000,
            betas=[FALLBACK_BETA],
            fallbacks="default",
            output_config={"effort": "low"},  # A visual inventory, not a reasoning task.
            system=FURNITURE_SYSTEM,
            messages=[{"role": "user", "content": [_image(photo), _text("List the pieces.")]}],
            output_format=FurnitureList,
        )
        return self._parsed(response, FurnitureList).items

    async def listing(self, photos: list[bytes], facts: ListingFacts) -> Listing:
        content: list[BetaImageBlockParam | BetaTextBlockParam] = [_image(p) for p in photos]
        content.append(_text(f"Facts:\n{_facts_text(facts)}\n\nWrite the listing."))
        response = await self._client.beta.messages.parse(
            model=self._model,
            max_tokens=16000,
            betas=[FALLBACK_BETA],
            fallbacks="default",
            output_config={"effort": "medium"},
            system=LISTING_SYSTEM,
            messages=[{"role": "user", "content": content}],
            output_format=Listing,
        )
        return self._parsed(response, Listing)

    @staticmethod
    def _parsed[T](response: Any, kind: type[T]) -> T:
        # Check why the model stopped before reading its answer: a refusal has no usable output.
        if response.stop_reason == "refusal":
            raise WriterError("Claude declined this request")
        parsed = response.parsed_output
        if not isinstance(parsed, kind):
            raise WriterError(
                f"Claude returned no {kind.__name__} (stop_reason={response.stop_reason})"
            )
        return parsed


class FakeWriter:
    """Deterministic output for keyless local runs and tests."""

    name = "fake"

    async def furniture(self, photo: bytes) -> list[FurnitureItem]:
        return [
            FurnitureItem(
                name="three-seat sofa",
                category="seating",
                color="oat",
                material="linen",
                search_query="three seat linen sofa oat",
            ),
            FurnitureItem(
                name="round wool rug",
                category="rug",
                color="cream",
                material="wool",
                search_query="round cream wool rug",
            ),
            FurnitureItem(
                name="arc floor lamp",
                category="lighting",
                color="black",
                material="metal",
                search_query="black arc floor lamp",
            ),
        ]

    async def listing(self, photos: list[bytes], facts: ListingFacts) -> Listing:
        rooms = f"{facts.bedrooms}-bedroom {facts.property_type}"
        return Listing(
            headline=f"Bright {rooms} in {facts.location}",
            description=(
                f"A {rooms} in {facts.location} with generous light and an easy, open layout. "
                "This text comes from the fake writer: set WRITER_PROVIDER=claude for a real one."
            ),
            highlights=[
                f"{facts.bedrooms} bedrooms",
                f"{facts.bathrooms:g} bathrooms",
                facts.location,
            ],
        )


def build_writer(settings: Settings) -> Writer:
    if settings.writer_provider == "claude":
        from anthropic import AsyncAnthropic

        return ClaudeWriter(AsyncAnthropic(), settings.claude_model)
    if settings.writer_provider == "fake":
        return FakeWriter()
    raise ValueError(f"Unknown WRITER_PROVIDER: {settings.writer_provider!r}")
