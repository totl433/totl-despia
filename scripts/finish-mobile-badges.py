#!/usr/bin/env python3
"""
Finish crests from scripts/fetch-mobile-badges.mjs: drop white backgrounds that
touch the edges, trim, and fit onto a 512x512 canvas (content at 78%, matching
scripts/normalize-badges.py). Luton has no outline, so it goes on a white disc.

Usage: python3 scripts/finish-mobile-badges.py <raw-dir> apps/mobile/assets/badges
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ERA_CRESTS = ["HUL", "SHW", "OLD", "DER", "WIM"]  # copied from public/assets/badges
SIZE = 512
FIT = 0.78
MAGENTA = (255, 0, 255)


def remove_white_background(im: Image.Image) -> Image.Image:
    w, h = im.size
    rgb = Image.new("RGB", im.size, (255, 255, 255))
    rgb.paste(im, mask=im.split()[3])
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]
    for seed in seeds:
        if min(rgb.getpixel(seed)) > 225:
            ImageDraw.floodfill(rgb, seed, MAGENTA, thresh=40)
    bg = Image.new("L", im.size, 0)
    px, mp = rgb.load(), bg.load()
    for y in range(h):
        for x in range(w):
            if px[x, y] == MAGENTA:
                mp[x, y] = 255
    im.putalpha(ImageChops.subtract(im.split()[3], bg))
    return im


def on_white_disc(im: Image.Image) -> Image.Image:
    d = int(im.width * 1.12)
    mask = Image.new("L", (d * 2, d * 2), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, d * 2 - 1, d * 2 - 1), fill=255)
    out = Image.new("RGBA", (d, d), (255, 255, 255, 255))
    out.paste(im, ((d - im.width) // 2, (d - im.height) // 2), im)
    out.putalpha(mask.resize((d, d), Image.Resampling.LANCZOS))
    return out


def fit_to_canvas(im: Image.Image) -> Image.Image:
    im = im.crop(im.split()[3].point(lambda v: 255 if v > 12 else 0).getbbox())
    target = int(SIZE * FIT)
    scale = min(target / im.width, target / im.height)
    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    canvas.paste(im, ((SIZE - im.width) // 2, (SIZE - im.height) // 2), im)
    return canvas


def main() -> None:
    raw, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    for path in sorted(raw.glob("*.png")):
        im = Image.open(path).convert("RGBA")
        r, g, b, a = im.getpixel((2, 2))
        white_bg = a > 200 and min(r, g, b) > 225
        if path.stem == "LUT":
            im = on_white_disc(im)
        elif white_bg:
            im = remove_white_background(im)
        fit_to_canvas(im).save(out / path.name, optimize=True)
        print(f"{path.stem}{' (white background removed)' if white_bg and path.stem != 'LUT' else ''}")
    for code in ERA_CRESTS:
        shutil.copy(ROOT / "public" / "assets" / "badges" / f"{code}.png", out / f"{code}.png")
        print(f"{code} (era crest)")


if __name__ == "__main__":
    main()
