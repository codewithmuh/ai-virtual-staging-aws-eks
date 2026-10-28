"""Rule R2: flag staged photos where the room itself changed.

Staging should only add furniture. Walls, windows, doors and the floor line are the long,
strong edges of a room photo, so we find those edges in the original and measure how many
are still there after staging. Furniture covers some of them (mostly low in the frame), so
the score is never 1.0, but a moved window or a new wall drops it sharply.

This is a heuristic that flags photos for a person to review. It does not prove a photo is
honest, and the threshold is tuned on real stagings (see docs/adr/0002).
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray
from PIL import Image, ImageFilter

_WORK_WIDTH = 512  # Edges are compared at a fixed, small size: fast and resolution-independent.
_TOLERANCE_PX = 3  # An edge may shift this far (the model redraws pixels) and still count.
# Furniture lives in the lower part of the frame; the top 60% is mostly walls, windows and ceiling.
_STRUCTURE_ROWS = 0.6


def _edges(img: Image.Image) -> NDArray[np.bool_]:
    h = round(img.height * _WORK_WIDTH / img.width)
    gray = img.convert("L").resize((_WORK_WIDTH, h), Image.Resampling.BILINEAR)
    gray = gray.filter(ImageFilter.GaussianBlur(1.2))
    a = np.asarray(gray, dtype=np.float32)
    gx = np.zeros_like(a)
    gy = np.zeros_like(a)
    gx[:, 1:-1] = a[:, 2:] - a[:, :-2]
    gy[1:-1, :] = a[2:, :] - a[:-2, :]
    mag = np.hypot(gx, gy)
    # Keep the strongest ~8% of gradients: the room's structural lines, not texture.
    threshold = max(float(np.percentile(mag, 92)), 12.0)
    edges: NDArray[np.bool_] = mag >= threshold
    return edges[: round(h * _STRUCTURE_ROWS)]


def _dilate(mask: NDArray[np.bool_], radius: int) -> NDArray[np.bool_]:
    """Grow every edge pixel into a square of `radius`, without wrapping around the borders."""
    h, w = mask.shape
    padded = np.pad(mask, radius)
    out = np.zeros_like(mask)
    for dy in range(2 * radius + 1):
        for dx in range(2 * radius + 1):
            out |= padded[dy : dy + h, dx : dx + w]
    return out


def structure_score(original: Image.Image, staged: Image.Image) -> float:
    """Share of the original's structural edges (top of the frame) that survive staging, 0..1."""
    before = _edges(original)
    after = _edges(staged.resize(original.size, Image.Resampling.BILINEAR))
    total = int(before.sum())
    if total == 0:
        return 1.0  # A blank wall has nothing to move.
    kept = int((before & _dilate(after, _TOLERANCE_PX)).sum())
    return round(kept / total, 3)
