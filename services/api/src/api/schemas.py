"""Request and response models for the staging API, and the styles a room can be staged in."""

from __future__ import annotations

from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field

ImageType = Literal["image/jpeg", "image/png", "image/webp"]
LABEL = "Virtually staged"


class Style(StrEnum):
    japandi = "japandi"
    scandinavian = "scandinavian"
    industrial = "industrial"
    modern = "modern"


# What each style means to the image model. Kept short: the room-keeping rules matter more.
STYLE_BRIEFS: dict[Style, str] = {
    Style.japandi: (
        "Japandi: low natural-oak furniture, linen and wool, beige and charcoal, "
        "a few ceramics and plants"
    ),
    Style.scandinavian: (
        "Scandinavian: light wood, white and soft grey textiles, simple shapes, "
        "a wool rug, warm lamps"
    ),
    Style.industrial: (
        "Industrial: leather and dark metal, reclaimed wood, Edison bulbs, deep greens and browns"
    ),
    Style.modern: (
        "Modern: clean-lined sofa, marble or glass surfaces, matte black accents, "
        "one bold art piece"
    ),
}


class StyleInfo(BaseModel):
    id: Style
    brief: str


class UploadRequest(BaseModel):
    content_type: ImageType
    size_bytes: int = Field(gt=0)


class UploadResponse(BaseModel):
    """A presigned POST: the browser sends the file straight to S3 with these form fields."""

    upload_id: str
    url: str
    fields: dict[str, str]
    expires_in: int


class StagingRequest(BaseModel):
    upload_id: str = Field(pattern=r"^[0-9a-f]{32}$")
    style: Style


class StructureCheck(BaseModel):
    """Rule R2. `score` is the share of the original room's edges still present after staging."""

    score: float
    flagged: bool


class FurnitureItem(BaseModel):
    name: str = Field(description="What the piece is, e.g. 'three-seat linen sofa'")
    category: str = Field(
        description="One of: seating, table, storage, bed, lighting, rug, decor, plant, art"
    )
    color: str
    material: str
    search_query: str = Field(description="A short shopping search that would find a similar piece")


class FurnitureList(BaseModel):
    items: list[FurnitureItem]


class Staging(BaseModel):
    id: str
    style: Style
    label: str = LABEL
    created_at: str
    provider: str
    original_url: str
    staged_url: str
    structure: StructureCheck
    furniture: list[FurnitureItem] | None = None


class ListingFacts(BaseModel):
    property_type: str = Field(min_length=1, max_length=40, examples=["apartment"])
    bedrooms: int = Field(ge=0, le=20)
    bathrooms: float = Field(ge=0, le=20)
    area_sqm: int | None = Field(default=None, gt=0, le=10_000)
    location: str = Field(min_length=1, max_length=120)
    notes: str = Field(
        default="", max_length=600, description="Anything else the agent wants mentioned"
    )


class ListingRequest(BaseModel):
    staging_ids: list[str] = Field(min_length=1, max_length=6)
    facts: ListingFacts


class Listing(BaseModel):
    headline: str
    description: str
    highlights: list[str]
