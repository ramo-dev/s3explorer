#!/usr/bin/env python3
"""Regenerate the PWA launcher icons from public/s3e.png.

Run by hand, outputs committed -- the Docker build has no image toolchain, and
these five files total well under 100KB:

    python3 scripts/generate-icons.py

s3e.png is a 7864x7800 white sunburst on transparency, which is why the app's
favicon is invisible on a light tab. Every icon here is that artwork flattened
onto the app's dark background (--background, #0a0a0a) so it reads in both
themes and against any launcher wallpaper.

The inset ratios are the whole reason this is a script rather than five
`sips` calls. `purpose: "maskable"` lets the launcher crop to any shape
inscribed in the inner 80% circle, so the artwork has to be scaled *into* that
circle. At 0.82 the ray tips sit just inside the safe radius; sizing maskable
art the same as `any` art is the common mistake -- it looks fine in a manifest
viewer and gets guillotined by the launcher.

Outputs are quantised to a palette. Flat white line art on a dark ground is the
worst case for PNG, and truecolor at 512px is ~145KB per icon for no visible
gain; a 32-colour palette lands near 20KB because the only thing the extra
channels carry is the antialiasing ramp.
"""

import pathlib

from PIL import Image

# --background in dark / [data-theme="dark"], oklch(0.145 0 0). Must match the
# critical CSS in index.html or the icon is a different colour from the app.
BACKGROUND = (10, 10, 10, 255)

HERE = pathlib.Path(__file__).resolve().parent
PUBLIC = HERE.parent / "public"
SOURCE = PUBLIC / "s3e.png"

# (filename, size, artwork inset as a fraction of the canvas)
TARGETS = [
    ("icons/pwa-192.png", 192, 0.88),
    ("icons/pwa-512.png", 512, 0.88),
    ("icons/pwa-maskable-512.png", 512, 0.82),
    # iOS masks apple-touch-icon itself and wants the art near full bleed, so
    # this one is deliberately *less* inset than the maskable icon.
    ("icons/apple-touch-icon.png", 180, 0.94),
]


def square_art() -> Image.Image:
    """s3e.png is 7864x7800, so centre-crop it before it can be scaled square."""
    art = Image.open(SOURCE).convert("RGBA")
    side = min(art.size)
    left = (art.width - side) // 2
    top = (art.height - side) // 2
    return art.crop((left, top, left + side, top + side))


def render(art: Image.Image, size: int, inset: float) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), BACKGROUND)
    side = max(1, round(size * inset))
    resized = art.resize((side, side), Image.LANCZOS)
    offset = (size - side) // 2
    canvas.alpha_composite(resized, (offset, offset))
    return canvas


def main() -> None:
    art = square_art()
    for name, size, inset in TARGETS:
        out = PUBLIC / name
        icon = render(art, size, inset)
        # RGB before quantising: iOS composites a transparent apple-touch-icon
        # onto black, and Android warns about a transparent maskable icon.
        icon = icon.convert("RGB").quantize(colors=32, method=Image.MEDIANCUT)
        icon.save(out, "PNG", optimize=True)
        kb = out.stat().st_size / 1024
        print(f"{out.relative_to(PUBLIC.parent)}  {size}x{size}  inset {inset}  {kb:.0f}KB")


if __name__ == "__main__":
    main()
