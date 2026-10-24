"""长戟固定3倍预览；全部帧按atlas脚底锚点绘制，不按武器外接框缩放。"""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'build' / 'halberd-length'
OUT.mkdir(parents=True, exist_ok=True)
atlas = json.loads((ROOT / 'art/sprites/atlas.json').read_text(encoding='utf-8'))['hero']
try:
    font = ImageFont.truetype('C:/Windows/Fonts/msyh.ttc', 18)
except OSError:
    font = ImageFont.load_default()


def draw_frame(canvas, name, x, y, k=3):
    w, h, ax, ay = atlas[name]
    im = Image.open(ROOT / 'art/sprites/hero' / (name + '.png')).convert('RGBA')
    im = im.resize((w * k, h * k), Image.Resampling.NEAREST)
    canvas.alpha_composite(im, (round(x - ax * k), round(y - ay * k)))


names = ['hammer0', 'halberd0'] + [f'halberdw{i}' for i in range(1, 6)]
names += [f'halberd_{i}{j}' for i in range(1, 5) for j in 'ab']
sheet = Image.new('RGBA', (2400, 2000), (226, 216, 192, 255))
d = ImageDraw.Draw(sheet)
for i, name in enumerate(names):
    x, y = i % 4 * 600, i // 4 * 500
    draw_frame(sheet, name, x + 170, y + 410)
    d.line((x + 10, y + 410, x + 590, y + 410), fill=(160, 140, 110))
    d.text((x + 12, y + 12), name, font=font, fill=(50, 35, 23))
sheet.save(OUT / 'contact.png')

sequence = [('halberd0', 650)]
sequence += [(f'halberdw{i}', 125) for _ in range(2) for i in [1, 2, 3, 4, 5, 2]]
sequence += [(f'halberd_{i}{j}', ms) for i in range(1, 5) for j, ms in [('a', 180), ('b', 260)]]
sequence += [('halberd0', 650)]
frames = []
for name, _ in sequence:
    canvas = Image.new('RGBA', (660, 540), (226, 216, 192, 255))
    draw_frame(canvas, name, 170, 420)
    d = ImageDraw.Draw(canvas)
    d.line((12, 420, 648, 420), fill=(160, 140, 110))
    d.text((14, 14), name, font=font, fill=(50, 35, 23))
    frames.append(canvas.convert('RGB'))
frames[0].save(OUT / 'animation.gif', save_all=True, append_images=frames[1:],
               duration=[ms for _, ms in sequence], loop=0, disposal=2)
print(OUT)
