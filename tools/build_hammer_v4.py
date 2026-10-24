"""新锤子总表：固定 6×2 格子切，避免第二排刀光粘连。

只用一个全局缩放（以第1格人物本体高度为基准），不逐帧缩。
"""
import json, os
import numpy as np
from PIL import Image

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERO = os.path.join(R, 'art', 'sprites', 'hero')
ATLAS = os.path.join(R, 'art', 'sprites', 'atlas.json')
SRC = os.path.join(R, 'art', 'gemini', '披甲男主_锤子_总表_v4.png')
TARGET = 74
atlas = json.load(open(ATLAS, encoding='utf-8'))

rgb = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float32)
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
d = g - np.maximum(r, b)
a = np.clip(1.0 - (d - 6.0) / 30.0, 0.0, 1.0)
a[d >= 32] = 0.0
a[(g > r * 1.45 + 10) & (g > b * 1.45 + 10) & (g > 80)] = 0.0
g2 = np.minimum(g, np.maximum(r, b))
im = Image.fromarray(np.dstack([np.dstack([r, g2, b]).clip(0, 255), a * 255]).astype(np.uint8))
W, H = im.size


def cell(c, row):
    x0, x1 = round(c * W / 6), round((c + 1) * W / 6)
    y0, y1 = round(row * H / 2), round((row + 1) * H / 2)
    return im.crop((x0, y0, x1, y1))


def body_h(img):
    aa = np.asarray(img)[..., 3] > 0
    h, w = aa.shape
    x0, x1 = int(w * .25), int(w * .75)
    ys = np.nonzero(aa[:, x0:x1].any(1))[0]
    return int(ys.max() - ys.min() + 1) if len(ys) else 0


def crop(img):
    aa = np.asarray(img)[..., 3] > 0
    ys, xs = np.nonzero(aa)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    out = Image.new('RGBA', (x1 - x0 + 4, y1 - y0 + 4), (0, 0, 0, 0))
    out.alpha_composite(img.crop((x0, y0, x1, y1)), (2, 2))
    return out


top = [cell(c, 0) for c in range(6)]
bottom = [cell(c, 1) for c in range(6)]
ref = body_h(top[0])
scale = TARGET / ref
print('ref body', ref, 'scale', scale)

names = ['arm_hammer0', 'arm_hammerw1', 'arm_hammerw2', 'arm_hammerw3',
         'arm_hammer_1a', 'arm_hammer_1b', 'arm_hammer_2a', 'arm_hammer_2b',
         'arm_hammer_3a', 'arm_hammer_3b', 'arm_hammer_3c']
imgs = [top[0], top[1], top[3], top[5], bottom[0], bottom[1], bottom[2], bottom[3], bottom[4], bottom[4], bottom[5]]
for n, img in zip(names, imgs):
    o = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.BOX)
    o = crop(o)
    o.save(os.path.join(HERO, n + '.png'))
    atlas['hero'][n] = [o.width, o.height, round(o.width / 2, 1), o.height - 1]
    print(n, o.size)

json.dump(atlas, open(ATLAS, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('done')
