"""把披甲男主基础动作表切成游戏用帧，并把新戟动作（v2，已像素化）并入 hero 图集。

输出：art/sprites/hero/arm_*.png + atlas.json 的 hero 条目
"""
import json, os, shutil
import numpy as np
from PIL import Image
from scipy import ndimage

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(R, 'art', 'gemini', '披甲男主基础.png')
HAL = os.path.join(R, 'art', 'sprites', 'hero_armored_halberd_v2')
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

BASE_MAP = {
    'arm_w1': 3, 'arm_w2': 4, 'arm_w3': 5,
    'arm_roll1': 12, 'arm_roll2': 11,
    'arm_hurt': 6, 'arm_down': 24,
    'arm_bounce': 9, 'arm_getup': 10,
    'arm_fly1': 18, 'arm_fly2': 17,
}
atlas = json.load(open(ATLAS, encoding='utf-8'))
atlas.setdefault('hero', {})


def pixelize(frame, scale):
    """BOX 缩小 + 32 色 + 1px 深色描边，贴近白T的像素质感。"""
    h, w = max(1, round(frame.shape[0] * scale)), max(1, round(frame.shape[1] * scale))
    arr = frame.astype(np.float32)
    a = arr[..., 3:4] / 255.0
    # 预乘，避免透明区颜色在缩小后渗出
    pre = np.concatenate([arr[..., :3] * a, arr[..., 3:4]], axis=2).astype(np.uint8)
    small = np.asarray(Image.fromarray(pre).resize((w, h), Image.BOX)).astype(np.float32)
    aa = small[..., 3:4] / 255.0
    rgb2 = (small[..., :3] / np.maximum(aa, 1e-3)).clip(0, 255)
    pal = Image.fromarray(rgb2.astype(np.uint8)).quantize(colors=32, method=Image.Quantize.MEDIANCUT)
    rgb2 = np.asarray(pal.convert('RGB')).astype(np.uint8)
    al = (aa[..., 0] > .35).astype(np.uint8) * 255
    out = np.zeros((h + 2, w + 2, 4), dtype=np.uint8)
    out[1:-1, 1:-1, :3] = rgb2
    out[1:-1, 1:-1, 3] = al
    on = out[..., 3] > 0
    edge = ndimage.binary_dilation(on) & ~on
    nb = np.zeros_like(out[..., :3], dtype=np.float32)
    cnt = np.zeros(on.shape)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        sh = np.roll(np.roll(out[..., :3].astype(np.float32) * on[..., None], dy, 0), dx, 1)
        c = np.roll(np.roll(on, dy, 0), dx, 1)
        nb += sh; cnt += c
    col = (nb / np.maximum(cnt, 1)[..., None] * .3).astype(np.uint8)
    out[edge, :3] = col[edge]
    out[edge, 3] = 255
    return out


def save_component(name, cid):
    mask = lab == cid
    ys, xs = np.nonzero(mask)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    crop = rgba[y0:y1, x0:x1].copy()
    crop[..., 3] = (crop[..., 3] * mask[y0:y1, x0:x1]).astype(np.uint8)
    full = Image.new('RGBA', (crop.shape[1] + PAD * 2, crop.shape[0] + PAD * 2), (0, 0, 0, 0))
    full.alpha_composite(Image.fromarray(crop), (PAD, PAD))
    out = pixelize(np.asarray(full), SCALE)
    Image.fromarray(out, 'RGBA').save(os.path.join(HERO, name + '.png'))
    atlas['hero'][name] = [out.shape[1], out.shape[0], round(out.shape[1] / 2, 1), out.shape[0] - 1]
    print(name, out.shape[1], out.shape[0])


for name, cid in BASE_MAP.items():
    save_component(name, cid)

HAL_MAP = {
    'arm_idle': 'h1a',
    'arm_h1a': 'h1a',
    'arm_h1b': 'h1b',
    'arm_h2a': 'h2a',
    'arm_h2b': 'h2b',
    'arm_h3a': 'h3a',
    'arm_h3b': 'h3b',
    'arm_h4a': 'h4a',
    'arm_h4b': 'h4b',
}
hatlas = json.load(open(ATLAS, encoding='utf-8'))['hero_armored_halberd_v2']
for name, src in HAL_MAP.items():
    shutil.copyfile(os.path.join(HAL, src + '.png'), os.path.join(HERO, name + '.png'))
    atlas['hero'][name] = hatlas[src]
    print(name, '=', src, atlas['hero'][name])

json.dump(atlas, open(ATLAS, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('atlas updated')
