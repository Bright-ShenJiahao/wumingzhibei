"""把披甲男主基础动作表切成游戏用帧，并把已切好的戟帧并入 hero 图集。

输出：art/sprites/hero/arm_*.png + atlas.json 的 hero 条目
"""
import json, os, shutil
import numpy as np
from PIL import Image
from scipy import ndimage

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(R, 'art', 'gemini', '披甲男主基础.png')
HAL = os.path.join(R, 'art', 'sprites', 'hero_armored_halberd', 'game')
HERO = os.path.join(R, 'art', 'sprites', 'hero')
ATLAS = os.path.join(R, 'art', 'sprites', 'atlas.json')
SCALE = 0.27
PAD = 2

im = Image.open(BASE).convert('RGB')
rgb = np.asarray(im).astype(np.float32)
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
d = g - np.maximum(r, b)
alpha = np.clip(1.0 - (d - 6.0) / 30.0, 0.0, 1.0)
alpha[d >= 32] = 0.0
alpha[(g > r * 1.45 + 10) & (g > b * 1.45 + 10) & (g > 80)] = 0.0
gg = np.minimum(g, np.maximum(r, b))
rgba = np.dstack([np.dstack([r, gg, b]).clip(0, 255), alpha * 255]).astype(np.uint8)

fg = alpha > 0.2
lab, n = ndimage.label(fg, structure=np.ones((3, 3), dtype=np.uint8))
objs = ndimage.find_objects(lab)
sizes = ndimage.sum(fg, lab, range(1, n + 1))

# 由 base_sheet_labels.png 人工确认的组件
BASE_MAP = {
    'arm_w1': 3, 'arm_w2': 4, 'arm_w3': 5,
    'arm_roll1': 12, 'arm_roll2': 11,
    'arm_hurt': 6, 'arm_down': 24,
    'arm_bounce': 9, 'arm_getup': 10,
    'arm_fly1': 18, 'arm_fly2': 17,
}
atlas = json.load(open(ATLAS, encoding='utf-8'))
atlas.setdefault('hero', {})

def save_component(name, cid):
    mask = lab == cid
    ys, xs = np.nonzero(mask)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    crop = rgba[y0:y1, x0:x1].copy()
    crop[..., 3] = (crop[..., 3] * mask[y0:y1, x0:x1]).astype(np.uint8)
    full = Image.new('RGBA', (crop.shape[1] + PAD * 2, crop.shape[0] + PAD * 2), (0, 0, 0, 0))
    full.alpha_composite(Image.fromarray(crop), (PAD, PAD))
    gw, gh = max(1, round(full.width * SCALE)), max(1, round(full.height * SCALE))
    img = full.resize((gw, gh), Image.LANCZOS)
    img.save(os.path.join(HERO, name + '.png'))
    atlas['hero'][name] = [gw, gh, round(gw / 2, 1), gh - 1]
    print(name, f'{gw}x{gh}')

for name, cid in BASE_MAP.items():
    save_component(name, cid)

# 戟帧：直接使用已切好的 game 图，补成 arm_ 命名
HAL_MAP = {
    'arm_idle': '01_idle',
    'arm_h1a': '01_idle',
    'arm_h1b': '02_thrust',
    'arm_h2a': '06_low_guard',
    'arm_h2b': '03_sweep_low',
    'arm_h3a': '07_sweep_back',
    'arm_h3b': '04_uppercut',
    'arm_h4a': '08_thrust_low',
    'arm_h4b': '09_smash',
}
hatlas = json.load(open(os.path.join(R, 'art', 'sprites', 'hero_armored_halberd', 'atlas.json'), encoding='utf-8'))['hero_armored_halberd']
for name, src in HAL_MAP.items():
    shutil.copyfile(os.path.join(HAL, src + '.png'), os.path.join(HERO, name + '.png'))
    atlas['hero'][name] = hatlas[src]
    print(name, '=', src, atlas['hero'][name])

json.dump(atlas, open(ATLAS, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('atlas updated')
