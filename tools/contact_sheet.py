"""美术自检：把某个角色的所有帧按脚底锚点对齐排成一排，旁边放主角和喽啰做大小对比，标出帧名和锚点。
改完任何人物美术后必须跑一次，并亲眼看输出图，确认：帧名和动作对得上、大小和别的兵一致、没有残缺/杂点/绿边。

用法：python3 tools/contact_sheet.py 角色名 [输出路径=/tmp/contact_<角色>.png]
例：  python3 tools/contact_sheet.py banner
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ch = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else f'/tmp/contact_{ch}.png'
A = json.load(open(os.path.join(R, 'art', 'sprites', 'atlas.json'), encoding='utf-8'))
if ch not in A: sys.exit(f'atlas.json 里没有角色 {ch}，现有：{list(A)}')

# 游戏里的缩放（game.js 里 TYPES 的 scale），找不到就按 1
scale = {}
try:
    import re
    src = open(os.path.join(R, 'game.js'), encoding='utf-8').read()
    for m in re.finditer(r"(\w+):\s*\{[^}]*?sprite: '(\w+)'[^}]*?scale: ([\d.]+)", src): scale[m.group(2)] = float(m.group(3))
    for m in re.finditer(r"^\s*(\w+):\s*\{ name: '[^']+'[^}]*?scale: ([\d.]+)", src, re.M): scale.setdefault(m.group(1), float(m.group(2)))
except Exception:
    pass

try: font = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc', 11, index=2)
except Exception: font = ImageFont.load_default()

def row(name, frames, k=2):
    ims = []
    for f in frames:
        w, h, ax, ay = A[name][f]
        im = Image.open(os.path.join(R, 'art', 'sprites', name, f + '.png')).convert('RGBA')
        s = scale.get(name, 1)
        if s != 1: im = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.NEAREST); ax *= s; ay *= s
        ims.append((f, im, ax, ay))
    up = max(ay for _, _, _, ay in ims); dn = max(im.height - ay for _, im, _, ay in ims)
    W = sum(im.width + 8 for _, im, _, _ in ims) + 8; H = int(up + dn) + 22
    r = Image.new('RGBA', (W, H), (226, 216, 192, 255)); d = ImageDraw.Draw(r); x = 8; base = int(up) + 4
    d.line([0, base, W, base], fill=(160, 140, 110))
    for f, im, ax, ay in ims:
        r.alpha_composite(im, (int(x), int(base - ay)))
        d.line([x + ax - 2, base, x + ax + 2, base], fill=(220, 30, 30)); d.line([x + ax, base - 2, x + ax, base + 2], fill=(220, 30, 30))
        d.text((x, H - 15), f, font=font, fill=(40, 30, 40)); x += im.width + 8
    return r.resize((r.width * k, r.height * k), Image.NEAREST)

rows = [row(ch, list(A[ch]))]
ref = [n for n in ('hero', 'grunt') if n in A and n != ch]
if ref: rows.append(Image.new('RGBA', (1, 6), (0, 0, 0, 0)))
for n in ref: rows.append(row(n, ['idle'] if 'idle' in A[n] else list(A[n])[:1]))
W = max(r.width for r in rows); H = sum(r.height for r in rows)
o = Image.new('RGBA', (W, H), (200, 190, 170, 255)); y = 0
for r in rows: o.alpha_composite(r, (0, y)); y += r.height
o.save(out)
print('已输出', out, '——请打开看：帧名对不对、和下方主角/喽啰比大小、脚底红十字是否踩在横线上')
