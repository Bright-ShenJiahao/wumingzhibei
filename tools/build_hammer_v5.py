"""锤子总表按身体中心切，不用等分格子，避免切到相邻动作/刀光。"""
import os, json
import numpy as np
from PIL import Image
from scipy import ndimage

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(R, 'art', 'gemini', '披甲男主_锤子_总表_v5.png')
OUT = os.path.join(R, 'build', 'hammer_v5_cut')
os.makedirs(OUT, exist_ok=True)

im = Image.open(SRC).convert('RGB')
a = np.asarray(im).astype(np.float32)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
d = g - np.maximum(r, b)
alpha = np.clip(1 - (d - 6) / 30, 0, 1)
alpha[d >= 32] = 0
alpha[(g > r * 1.45 + 10) & (g > b * 1.45 + 10) & (g > 80)] = 0
g2 = np.minimum(g, np.maximum(r, b))
rgba = np.dstack([np.dstack([r, g2, b]).clip(0, 255), alpha * 255]).astype('uint8')
fg = alpha > .2
body = fg & ((r > b * 1.08) | ((r < 120) & (g < 120) & (b < 120)))
lab, n = ndimage.label(body, np.ones((3, 3)))
objs = ndimage.find_objects(lab)
sizes = ndimage.sum(body, lab, range(1, n + 1))

rows = [[], []]
for i in range(n):
    if sizes[i] < 20000:
        continue
    o = objs[i]
    cy = (o[0].start + o[0].stop) / 2
    rows[0 if cy < im.height / 2 else 1].append(i + 1)
for row in rows:
    row.sort(key=lambda i: objs[i - 1][1].start)
print('counts', [len(x) for x in rows])
assert len(rows[0]) == 6 and len(rows[1]) == 6, [len(x) for x in rows]

for row_i, ids in enumerate(rows):
    centers = [(objs[i - 1][1].start + objs[i - 1][1].stop) / 2 for i in ids]
    bounds = [0] + [round((centers[k] + centers[k + 1]) / 2) for k in range(5)] + [im.width]
    if row_i == 0:
        y0, y1 = 0, im.height // 2
    else:
        y0, y1 = im.height // 2, im.height
    for k, x in enumerate(zip(bounds, bounds[1:])):
        crop = rgba[y0:y1, x[0]:x[1]]
        m = fg[y0:y1, x[0]:x[1]]
        crop[..., 3] = (crop[..., 3] * m).astype('uint8')
        Image.fromarray(crop).save(os.path.join(OUT, ('t' if row_i == 0 else 'b') + str(k + 1) + '.png'))
        print(('t' if row_i == 0 else 'b') + str(k + 1), x, 'body', (objs[ids[k]-1][0].stop - objs[ids[k]-1][0].start))
