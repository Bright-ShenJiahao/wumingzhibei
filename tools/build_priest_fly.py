"""黄巾方士被击飞三帧：fly1 / fly2 / land。

源图：art/gemini/方士_击飞.png（透明背景，三姿横排）
输出：art/sprites/priest/fly1.png、fly2.png、land.png + atlas.json
"""
import json, os
import numpy as np
from PIL import Image

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SP = os.path.join(R, 'art', 'sprites')
src = Image.open(os.path.join(R, 'art', 'gemini', '方士_击飞.png')).convert('RGBA')
w, h = src.size
a = np.asarray(src)
alpha = a[..., 3] > 8

# 三姿大致三等分；每段取所有 alpha 的包围盒（包含飘带等小碎块）
regions = [(0, 640), (640, 1280), (1280, w)]
frames = [('fly1', 78), ('fly2', 78), ('land', 37)]
atlas = json.load(open(os.path.join(SP, 'atlas.json'), encoding='utf-8'))
atlas.setdefault('priest', {})
for (name, target_h), (x0, x1) in zip(frames, regions):
    sub = alpha[:, x0:x1]
    ys, xs = np.nonzero(sub)
    if not len(xs):
        continue
    bx0, bx1 = xs.min() + x0, xs.max() + x0 + 1
    by0, by1 = ys.min(), ys.max() + 1
    crop = src.crop((bx0, by0, bx1, by1))
    scale = target_h / crop.height
    nw, nh = max(1, round(crop.width * scale)), target_h
    # 像素图用 LANCZOS 缩到目标高度，再保持透明
    out = crop.resize((nw, nh), Image.LANCZOS)
    # 加 1px 透明边，保证锚点和描边不被切
    canvas = Image.new('RGBA', (nw + 2, nh + 2), (0, 0, 0, 0))
    canvas.alpha_composite(out, (1, 1))
    os.makedirs(os.path.join(SP, 'priest'), exist_ok=True)
    canvas.save(os.path.join(SP, 'priest', name + '.png'))
    atlas['priest'][name] = [canvas.width, canvas.height, round(canvas.width / 2, 1), canvas.height - 1]
    print(name, canvas.size, atlas['priest'][name])
json.dump(atlas, open(os.path.join(SP, 'atlas.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
