#!/usr/bin/env python3
"""
Normalize club badge PNGs to a consistent 128×128 canvas with ~11% padding.

Usage:
  python3 scripts/normalize-badges.py
  python3 scripts/normalize-badges.py public/assets/badges/WIM.png

Trims transparent (or uniform opaque) borders, then fits content inside
FIT of the canvas so optical size matches across crests.
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BADGE_DIR = ROOT / "public" / "assets" / "badges"
SIZE = 128
FIT = 0.78


def content_bbox(im: Image.Image, alpha_thresh: int = 12) -> tuple[int, int, int, int]:
    rgba = im.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            if px[x, y][3] > alpha_thresh:
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)
    if maxx < 0:
        return (0, 0, w, h)
    return (minx, miny, maxx + 1, maxy + 1)


def opaque_content_bbox(im: Image.Image) -> tuple[int, int, int, int]:
    px = im.load()
    w, h = im.size
    corner = px[0, 0][:3]
    minx, miny, maxx, maxy = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            r, g, b, _a = px[x, y]
            if abs(r - corner[0]) >= 8 or abs(g - corner[1]) >= 8 or abs(b - corner[2]) >= 8:
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)
    if maxx < 0:
        return (0, 0, w, h)
    return (minx, miny, maxx + 1, maxy + 1)


def make_near_white_transparent(im: Image.Image, thresh: int = 245) -> Image.Image:
    rgba = im.convert("RGBA")
    px = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a > 0 and r >= thresh and g >= thresh and b >= thresh:
                px[x, y] = (r, g, b, 0)
    return rgba


def normalize(path: Path, *, whiten_bg: bool = False) -> str:
    im = Image.open(path).convert("RGBA")
    if whiten_bg:
        im = make_near_white_transparent(im)
    extrema = im.getextrema()
    opaque = extrema[3][0] >= 250
    box = opaque_content_bbox(im) if opaque else content_bbox(im)
    cropped = im.crop(box)
    cw, ch = cropped.size
    target = int(SIZE * FIT)
    scale = min(target / cw, target / ch)
    nw = max(1, int(round(cw * scale)))
    nh = max(1, int(round(ch * scale)))
    resized = cropped.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(resized, ((SIZE - nw) // 2, (SIZE - nh) // 2), resized)
    canvas.save(path, optimize=True)
    return f"{path.name}: {im.size[0]}x{im.size[1]} → placed {nw}x{nh}"


def main() -> None:
    args = [Path(a) for a in sys.argv[1:]]
    paths = args if args else sorted(BADGE_DIR.glob("*.png"))
    for p in paths:
        whiten = p.name.upper() == "WIM.PNG"
        print(normalize(p, whiten_bg=whiten))


if __name__ == "__main__":
    main()
