"""切分「披甲男主戟」动作表。

源图：art/gemini/披甲男主戟.png（5×2，纯绿背景）
输出：
  art/sprites/hero_armored_halberd/full/01..10_*.png   原尺寸透明帧
  art/sprites/hero_armored_halberd/game/01..10_*.png   游戏用缩放帧
  art/sprites/hero_armored_halberd/atlas.json
  art/sprites/hero_armored_halberd/contact.png
"""
import json, os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(R, 'art', 'gemini', '披甲男主戟.png')
OUT = os.path.join(R, 'art', 'sprites', 'hero_armored_halberd')
NAMES = [
    '01_idle', '02_thrust', '03_sweep_low', '04_uppercut', '05_recover',
    '06_low_guard', '07_sweep_back', '08_thrust_low', '09_smash', '10_recover2',
]
SCALE = 0.29          # 260px 左右的人物 -> 游戏里约 75px
PAD = 2

os.makedirs(os.path.join(OUT, 'full'), exist_ok=True)
os.makedirs(os.path.join(OUT, 'game'), exist_ok=True)

im = Image.open(SRC).convert('RGB')
rgb = np.asarray(im).astype(np.float32)
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]

# 绿幕 -> alpha：绿色优势越大越透明；同时去绿
d = g - np.maximum(r, b)
alpha = np.clip(1.0 - (d - 6.0) / 30.0, 0.0, 1.0)
alpha[d >= 32] = 0.0
# 纯绿残留直接清掉
alpha[(g > r * 1.45 + 10) & (g > b * 1.45 + 10) & (g > 80)] = 0.0
alpha[(g > r * 1.5) & (g > b * 1.5) & (g > 150)] = 0.0
gg = np.minimum(g, np.maximum(r, b))
clean = np.dstack([r, gg, b]).clip(0, 255)
a8 = (alpha * 255).astype(np.uint8)
rgba = np.dstack([clean, a8]).astype(np.uint8)

# 连通域：10 个主体 + 刀光/碎片
fg = alpha > 0.2
lab, n = ndimage.label(fg, structure=np.ones((3, 3), dtype=np.uint8))
objs = ndimage.find_objects(lab)
sizes = ndimage.sum(fg, lab, range(1, n + 1))
main = [i + 1 for i in range(n) if sizes[i] > 12000]
if len(main) != 10:
    raise SystemExit(f'expected 10 main frames, got {len(main)} (components={n})')

def box_of(i):
    o = objs[i - 1]
    return o[1].start, o[0].start, o[1].stop, o[0].stop

def center(i):
    x0, y0, x1, y1 = box_of(i)
    return (x0 + x1) / 2, (y0 + y1) / 2

# 按行分组，再按 x 排序
mains = [(i, center(i)) for i in main]
top = sorted([m for m in mains if m[1][1] < im.height / 2], key=lambda t: t[1][0])
bottom = sorted([m for m in mains if m[1][1] >= im.height / 2], key=lambda t: t[1][0])
order = top + bottom
if len(order) != 10:
    raise SystemExit('row split failed')

# 小连通域（白刀光、飘带碎块）归到最近的主体包围盒
groups = {i: [i] for i in main}
for i in range(1, n + 1):
    if i in main or sizes[i - 1] < 20:
        continue
    x0, y0, x1, y1 = box_of(i)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    def dist(m):
        mx0, my0, mx1, my1 = box_of(m)
        dx = max(mx0 - cx, 0, cx - mx1)
        dy = max(my0 - cy, 0, cy - my1)
        return dx * dx + dy * dy
    groups[min(main, key=dist)].append(i)

atlas = {}
for idx, (main_i, _) in enumerate(order):
    name = NAMES[idx]
    members = groups[main_i]
    mask = np.isin(lab, members)
    # 只保留本帧的像素，避免相邻帧包围盒重叠时把别人带进来
    ys, xs = np.nonzero(mask)
    x0, x1 = xs.min(), xs.max() + 1
    y0, y1 = ys.min(), ys.max() + 1
    frame = rgba[y0:y1, x0:x1].copy()
    frame_mask = mask[y0:y1, x0:x1]
    frame[..., 3] = (frame[..., 3] * frame_mask).astype(np.uint8)
    # 加透明边，锚点按底边中心
    canvas = Image.new('RGBA', (frame.shape[1] + PAD * 2, frame.shape[0] + PAD * 2), (0, 0, 0, 0))
    canvas.alpha_composite(Image.fromarray(frame), (PAD, PAD))
    canvas.save(os.path.join(OUT, 'full', name + '.png'))

    gw = max(1, round(canvas.width * SCALE))
    gh = max(1, round(canvas.height * SCALE))
    gimg = canvas.resize((gw, gh), Image.LANCZOS)
    gimg.save(os.path.join(OUT, 'game', name + '.png'))
    atlas[name] = [gw, gh, round(gw / 2, 1), gh - 1]
    print(f'{name}: full {canvas.width}x{canvas.height} -> game {gw}x{gh}')

with open(os.path.join(OUT, 'atlas.json'), 'w', encoding='utf-8') as f:
    json.dump({'hero_armored_halberd': atlas}, f, ensure_ascii=False, indent=1)

# 拼接检查图
cols, rows = 5, 2
cell_w, cell_h = 260, 300
sheet = Image.new('RGB', (cols * cell_w, rows * cell_h), (28, 24, 20))
dr = ImageDraw.Draw(sheet)
for idx, name in enumerate(NAMES):
    img = Image.open(os.path.join(OUT, 'game', name + '.png')).convert('RGBA')
    img.thumbnail((cell_w - 20, cell_h - 42), Image.LANCZOS)
    cx = (idx % cols) * cell_w + (cell_w - img.width) // 2
    cy = (idx // cols) * cell_h + (cell_h - img.height) // 2 - 8
    sheet.paste(img, (cx, cy), img)
    dr.text(((idx % cols) * cell_w + 8, (idx // cols) * cell_h + cell_h - 28), name, fill=(230, 210, 170))
dr.text((8, sheet.height - 18), f'hero_armored_halberd  scale={SCALE}', fill=(180, 160, 120))
sheet.save(os.path.join(OUT, 'contact.png'))
print('saved', OUT)
