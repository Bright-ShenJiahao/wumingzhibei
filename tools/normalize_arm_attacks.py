"""把披甲长戟的 8 个攻击帧按“人物本体高度”统一到 74px。

只量中间 25%~75% 的 alpha 区域，避开横向/竖向伸出的长戟和刀光；
改完会更新 atlas.json 里的 hero 条目。
"""
import json, os
import numpy as np
from PIL import Image

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HERO = os.path.join(R, 'art', 'sprites', 'hero')
ATLAS = os.path.join(R, 'art', 'sprites', 'atlas.json')
TARGET = 74
NAMES = ['arm_h1a', 'arm_h1b', 'arm_h2a', 'arm_h2b', 'arm_h3a', 'arm_h3b', 'arm_h4a', 'arm_h4b']

atlas = json.load(open(ATLAS, encoding='utf-8'))
for name in NAMES:
    path = os.path.join(HERO, name + '.png')
    im = Image.open(path).convert('RGBA')
    a = np.asarray(im)[..., 3] > 0
    h, w = a.shape
    x0, x1 = int(w * .25), int(w * .75)
    ys = np.nonzero(a[:, x0:x1].any(axis=1))[0]
    if not len(ys):
        raise SystemExit('no body pixels: ' + name)
    body_h = ys.max() - ys.min() + 1
    scale = TARGET / body_h
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    out = im.resize((nw, nh), Image.BOX)
    out.save(path)
    atlas['hero'][name] = [nw, nh, round(nw / 2, 1), nh - 1]
    print(f'{name}: body {body_h}px -> scale {scale:.3f} -> {nw}x{nh}')

json.dump(atlas, open(ATLAS, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('atlas updated')
