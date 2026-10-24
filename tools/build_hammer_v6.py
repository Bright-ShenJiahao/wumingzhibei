"""Hammer sheet: remove bright cyan/white slash, group character components."""
import os
import numpy as np
from PIL import Image
from scipy import ndimage

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(R, 'art', 'gemini', '披甲男主_锤子_总表_v5.png')
OUT = os.path.join(R, 'build', 'hammer_v6_char')
os.makedirs(OUT, exist_ok=True)
im = Image.open(SRC).convert('RGB')
a = np.asarray(im).astype(np.float32)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
d = g - np.maximum(r, b)
alpha = np.clip(1 - (d - 6) / 30, 0, 1)
alpha[d >= 32] = 0
alpha[(g > r * 1.45 + 10) & (g > b * 1.45 + 10) & (g > 80)] = 0
fg = alpha > .2
effect = ((b > 170) & (g > 150) & (b > r * 1.25)) | ((r > 220) & (g > 220) & (b > 220))
char = fg & ~effect
lab, n = ndimage.label(char, np.ones((3, 3)))
objs = ndimage.find_objects(lab)
sizes = ndimage.sum(char, lab, range(1, n + 1))
rows = [[], []]
for i in range(n):
    if sizes[i] < 15000:
        continue
    o = objs[i]
    cy = (o[0].start + o[0].stop) / 2
    rows[0 if cy < im.height / 2 else 1].append(i + 1)
for row in rows:
    row.sort(key=lambda i: objs[i - 1][1].start)
print('main', [len(x) for x in rows])
assert len(rows[0]) == 6 and len(rows[1]) == 6

for row_i, mains in enumerate(rows):
    groups = {i: [i] for i in mains}
    for i in range(1, n + 1):
        if i in mains or sizes[i - 1] < 20:
            continue
        o = objs[i - 1]
        cy = (o[0].start + o[0].stop) / 2
        if (row_i == 0 and cy >= im.height / 2) or (row_i == 1 and cy < im.height / 2):
            continue
        cx = (o[1].start + o[1].stop) / 2
        best = min(mains, key=lambda j: abs(cx - (objs[j - 1][1].start + objs[j - 1][1].stop) / 2))
        groups[best].append(i)
    for k, main in enumerate(mains):
        ids = groups[main]
        ys = [objs[j - 1][0] for j in ids]
        xs = [objs[j - 1][1] for j in ids]
        y0, y1 = min(o.start for o in ys), max(o.stop for o in ys)
        x0, x1 = min(o.start for o in xs), max(o.stop for o in xs)
        mask = np.isin(lab[y0:y1, x0:x1], ids)
        arr = np.dstack([np.asarray(im), (alpha * 255).astype('uint8')])[y0:y1, x0:x1].copy()
        arr[..., 3] = (arr[..., 3] * mask).astype('uint8')
        Image.fromarray(arr, 'RGBA').save(os.path.join(OUT, ('t' if row_i == 0 else 'b') + str(k + 1) + '.png'))
        print(('t' if row_i == 0 else 'b') + str(k + 1), 'body', (objs[main - 1][0].stop - objs[main - 1][0].start))
