"""Image handling: validate uploads, strip metadata (rule R3), and label staged photos (rule R1)."""

from __future__ import annotations

import io

from PIL import Image, ImageDraw, ImageFont, ImageOps, UnidentifiedImageError

from api.schemas import LABEL

# Large enough for a listing photo, small enough for the image models' input limits.
MAX_EDGE = 2048
# Pillow's decompression-bomb guard, set explicitly: 40 MP is far beyond any phone photo.
Image.MAX_IMAGE_PIXELS = 40_000_000
_FORMATS = {"JPEG", "PNG", "WEBP"}


class ImageError(ValueError):
    """The upload is not a usable photo. The message is safe to show to the user."""


def prepare_upload(data: bytes) -> bytes:
    """Return a clean JPEG: orientation applied, at most MAX_EDGE wide, and no metadata.

    Re-encoding from pixels drops EXIF entirely, including GPS, so a photo can't reveal
    where the home is.
    """
    try:
        with Image.open(io.BytesIO(data)) as img:
            if img.format not in _FORMATS:
                raise ImageError("Upload a JPEG, PNG or WebP photo.")
            img.load()
            upright = ImageOps.exif_transpose(img)
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError) as exc:
        raise ImageError("That file isn't a photo we can read.") from exc
    if min(upright.size) < 256:
        raise ImageError("The photo is too small. Use one at least 256 pixels on each side.")
    rgb = upright.convert("RGB")
    rgb.thumbnail((MAX_EDGE, MAX_EDGE), Image.Resampling.LANCZOS)
    return to_jpeg(rgb)


def to_jpeg(img: Image.Image, quality: int = 90) -> bytes:
    buf = io.BytesIO()
    img.convert("RGB").save(buf, "JPEG", quality=quality, optimize=True)
    return buf.getvalue()


def open_rgb(data: bytes) -> Image.Image:
    with Image.open(io.BytesIO(data)) as img:
        return img.convert("RGB")


def match_size(staged: bytes, size: tuple[int, int]) -> Image.Image:
    """Image models return their own sizes; bring the result back to the original's."""
    img = open_rgb(staged)
    return img if img.size == size else img.resize(size, Image.Resampling.LANCZOS)


def add_label(img: Image.Image) -> bytes:
    """Burn "Virtually staged" into the bottom-right corner, so the label survives any download.

    Right, not left: before/after sliders show the staged photo on the right, so the label stays
    in view while people compare.
    """
    out = img.copy()
    draw = ImageDraw.Draw(out, "RGBA")
    size = max(14, out.width // 48)
    font = ImageFont.load_default(size=size)
    pad = size // 2
    left, top, right, bottom = draw.textbbox((0, 0), LABEL, font=font)
    w, h = right - left, bottom - top
    x, y = out.width - w - pad * 2, out.height - h - pad * 4
    draw.rectangle((x - pad, y - pad, x + w + pad, y + h + pad * 1.5), fill=(0, 0, 0, 150))
    draw.text((x - left, y - top), LABEL, font=font, fill=(255, 255, 255, 235))
    return to_jpeg(out)


def for_vision(data: bytes, max_edge: int = 1568) -> bytes:
    """Downscale before sending to Claude: beyond ~1568 px the extra pixels only cost tokens."""
    img = open_rgb(data)
    img.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
    return to_jpeg(img, quality=85)
