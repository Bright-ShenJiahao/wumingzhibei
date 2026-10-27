"""Split the supplied charge-hit VFX sheet into transparent animation strips."""
from pathlib import Path
from PIL import Image
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'art' / 'gemini' / '蓄力命中特效表.png'
OUT = ROOT / 'art' / 'ui'
CELL_W, CELL_H = 160, 120

# Manual frame bounds for the irregularly spaced rows in the supplied sheet.
SHEETS = {
    'charge_hit_staff': [(82, 35, 196, 225), (275, 30, 504, 230), (515, 15, 770, 245), (886, 40, 1005, 230)],
    'charge_hit_stone': [(94, 535, 188, 635), (325, 520, 440, 640), (576, 515, 730, 640)],
}


def remove_flattened_checker(rgb):
    """The attachment's checkerboard is flattened RGB, so key its two gray tones."""
    pix = rgb.astype(np.int16)
    spread = pix.max(axis=2) - pix.min(axis=2)
    level = pix.mean(axis=2)
    # Screenshot checker cells are near neutral gray #323232 and #626262.
    # Keep the much brighter white/blue VFX and their soft edge pixels.
    # The supplied PNG was scaled from a checker preview, leaving blended gray
    # transition pixels between squares (roughly 65–85). Key that full neutral
    # band too; the painted effects are white/cool and remain well above it.
    checker = (spread < 9) & (level >= 30) & (level <= 118)
    alpha = np.where(checker, 0, 255).astype(np.uint8)
    return np.dstack((rgb, alpha))


def make_strip(rgba, bounds, frames):
    strip = Image.new('RGBA', (CELL_W * frames, CELL_H), (0, 0, 0, 0))
    for i, box in enumerate(bounds):
        frame = Image.fromarray(rgba).crop(box)
        alpha = frame.getchannel('A')
        bbox = alpha.getbbox()
        if not bbox:
            raise ValueError(f'No visible pixels in frame {box}')
        frame = frame.crop(bbox)
        # Keep each effect centered in the same fixed canvas; no smoothing blur.
        scale = min((CELL_W - 12) / frame.width, (CELL_H - 10) / frame.height)
        size = (max(1, round(frame.width * scale)), max(1, round(frame.height * scale)))
        frame = frame.resize(size, Image.Resampling.NEAREST)
        strip.alpha_composite(frame, (i * CELL_W + (CELL_W - size[0]) // 2,
                                      (CELL_H - size[1]) // 2))
    return strip


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rgb = np.array(Image.open(SOURCE).convert('RGB'))
    rgba = remove_flattened_checker(rgb)
    for name, bounds in SHEETS.items():
        strip = make_strip(rgba, bounds, len(bounds))
        path = OUT / (name + '.webp')
        strip.save(path, 'WEBP', lossless=True, method=6)
        print(f'{path.relative_to(ROOT)}: {strip.width}x{strip.height}, {path.stat().st_size} bytes')


if __name__ == '__main__':
    main()
