"""Generate TheraClock PWA icons. Run from repo root: python3 tools/make_icons.py"""
import math
from PIL import Image, ImageDraw

S = 1024  # master size, downscaled for crisp antialiasing
BLUE = (42, 120, 214)       # #2a78d6
BLUE_DEEP = (28, 92, 171)   # #1c5cab
INK = (16, 66, 129)         # #104281
FACE = (252, 252, 251)      # #fcfcfb


def gradient_bg(size):
    img = Image.new("RGB", (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / (size - 1)
        c = tuple(round(a + (b - a) * t) for a, b in zip(BLUE, BLUE_DEEP))
        d.line([(0, y), (size, y)], fill=c)
    return img


def draw_clock(img, cx, cy, r):
    """White clock face, hands pointing at 4:30 — clock-out time."""
    d = ImageDraw.Draw(img)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=FACE)
    # ticks at 12/3/6/9
    tick_w = round(r * 0.055)
    for ang in (0, 90, 180, 270):
        a = math.radians(ang - 90)
        x1 = cx + math.cos(a) * r * 0.80
        y1 = cy + math.sin(a) * r * 0.80
        x2 = cx + math.cos(a) * r * 0.90
        y2 = cy + math.sin(a) * r * 0.90
        d.line([x1, y1, x2, y2], fill=INK, width=tick_w)
    # hour hand -> between 4 and 5 (4:30 => 135 deg from 12)
    a = math.radians(135 - 90)
    d.line([cx, cy, cx + math.cos(a) * r * 0.48, cy + math.sin(a) * r * 0.48],
           fill=INK, width=round(r * 0.13))
    # minute hand -> 6 (180 deg)
    a = math.radians(180 - 90)
    d.line([cx, cy, cx + math.cos(a) * r * 0.72, cy + math.sin(a) * r * 0.72],
           fill=INK, width=round(r * 0.10))
    d.ellipse([cx - r * 0.09, cy - r * 0.09, cx + r * 0.09, cy + r * 0.09], fill=BLUE)


def rounded_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def save(img, path, size):
    img.resize((size, size), Image.LANCZOS).save(path)
    print("wrote", path)


# --- standard icons: rounded-rect with transparent corners ---
base = gradient_bg(S)
draw_clock(base, S // 2, S // 2, round(S * 0.335))
rounded = Image.new("RGBA", (S, S), (0, 0, 0, 0))
rounded.paste(base, (0, 0), rounded_mask(S, round(S * 0.225)))
save(rounded, "icons/icon-512.png", 512)
save(rounded, "icons/icon-192.png", 192)

# --- maskable: full-bleed square, art inside the 80% safe zone ---
mask_icon = gradient_bg(S)
draw_clock(mask_icon, S // 2, S // 2, round(S * 0.30))
save(mask_icon, "icons/maskable-512.png", 512)

# --- apple touch icon: full-bleed square (iOS rounds it itself) ---
save(mask_icon, "icons/apple-touch-icon.png", 180)
