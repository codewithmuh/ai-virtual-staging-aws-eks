import io

import pytest
from PIL import Image

from api import images
from api.structure import structure_score
from conftest import jpeg_bytes, room_photo


def test_prepare_upload_strips_all_metadata() -> None:
    """Rule R3: nothing in the stored photo can say where the home is."""
    exif = Image.Exif()
    exif[0x010F] = "PhoneMaker"  # Make
    exif[0x8825] = {1: "N", 2: (31.0, 31.0, 12.0), 3: "E", 4: (74.0, 21.0, 30.0)}  # GPS
    raw = jpeg_bytes(room_photo(), exif=exif)
    assert Image.open(io.BytesIO(raw)).getexif()  # The test photo really has EXIF.

    clean = Image.open(io.BytesIO(images.prepare_upload(raw)))
    assert clean.format == "JPEG"
    assert not clean.getexif()
    assert "exif" not in clean.info


def test_prepare_upload_applies_orientation_and_limits_size() -> None:
    exif = Image.Exif()
    exif[0x0112] = 6  # Rotated 90°: the phone was held upright.
    raw = jpeg_bytes(room_photo(3000, 2000), exif=exif)
    clean = Image.open(io.BytesIO(images.prepare_upload(raw)))
    assert clean.size == (1365, 2048)  # Upright, and the long edge capped at MAX_EDGE.


@pytest.mark.parametrize(
    ("data", "message"),
    [
        (b"not an image", "isn't a photo"),
        (jpeg_bytes(Image.new("RGB", (100, 100))), "too small"),
    ],
)
def test_prepare_upload_rejects_bad_files(data: bytes, message: str) -> None:
    with pytest.raises(images.ImageError, match=message):
        images.prepare_upload(data)


def test_prepare_upload_rejects_other_formats() -> None:
    buf = io.BytesIO()
    room_photo().save(buf, "GIF")
    with pytest.raises(images.ImageError, match="JPEG, PNG or WebP"):
        images.prepare_upload(buf.getvalue())


def test_add_label_marks_the_bottom_right_corner() -> None:
    plain = Image.new("RGB", (1200, 800), (240, 240, 240))
    labelled = Image.open(io.BytesIO(images.add_label(plain)))
    corner = labelled.crop((800, 700, 1200, 800)).convert("L")
    darkest, _ = corner.getextrema()
    assert isinstance(darkest, int)
    assert darkest < 120
    assert labelled.getpixel((100, 100)) == plain.getpixel((100, 100))  # The rest is untouched.
    assert labelled.getpixel((100, 760)) == plain.getpixel((100, 760))


def test_match_size_and_for_vision() -> None:
    small = jpeg_bytes(room_photo(600, 400))
    assert images.match_size(small, (1200, 800)).size == (1200, 800)
    assert images.open_rgb(images.for_vision(jpeg_bytes(room_photo(3000, 2000)))).size == (
        1568,
        1045,
    )


# ── Rule R2: structure check ───────────────────────────────────────────


def test_structure_score_is_high_when_only_furniture_is_added() -> None:
    from PIL import ImageDraw

    original = room_photo()
    staged = original.copy()
    d = ImageDraw.Draw(staged)
    d.rectangle((200, 480, 760, 660), fill=(90, 80, 70))  # a sofa, low in the frame
    d.ellipse((150, 620, 820, 780), fill=(200, 190, 170))  # a rug
    assert structure_score(original, original) == 1.0
    assert structure_score(original, staged) > 0.8


def test_structure_score_drops_when_the_window_moves() -> None:
    original = room_photo(window_x=0.55)
    moved = room_photo(window_x=0.30)
    assert structure_score(original, moved) < 0.55


def test_structure_score_of_a_blank_wall_is_one() -> None:
    blank = Image.new("RGB", (800, 600), (200, 200, 200))
    assert structure_score(blank, blank) == 1.0
