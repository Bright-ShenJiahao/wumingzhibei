# 处理 Gemini 出的绿底 UI / 食物图：抠绿 → 自动切开 → 裁空 → 按名字存到 art/ui 和 art/food。
# 抠绿算法照搬 tools/split_props.py（alpha 按绿色差值渐变，G 压到 max(R,B)+8，天然没有绿边）。
#
# 用法：python tools/process_ui.py
import json
import os
import numpy as np
from PIL import Image
from scipy import ndimage

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
G = lambda *p: os.path.join(R, 'art', 'gemini', *p)

# 源图 → (输出目录, [名字...]，按从左到右的顺序)
JOBS = [
    ('UI_卷轴.png', 'ui', ['scroll']),
    ('UI_按钮.png', 'ui', ['btn', 'btn_red']),
    ('UI_印章.png', 'ui', ['seal_square', 'seal_round', 'seal_rect']),
    ('食物_包子鸡腿.png', 'food', ['bun', 'leg']),
    ('食物_烤乳猪.png', 'food', ['pig']),
]

# 食物在游戏里的世界尺寸（宽, 高）：主角身高约 32 世界单位，食物约 1/4
FOOD_SIZE = {'bun': [11, 8], 'leg': [13, 10], 'pig': [21, 15]}


def key(img):
    """抠绿（和 split_props.py 同一套算法）"""
    a = np.asarray(img.convert('RGB')).astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    d = g - np.maximum(r, b)
    alpha = np.clip(1 - (d - 25) / 110, 0, 1)
    g2 = np.minimum(g, np.maximum(r, b) + 8)
    return np.dstack([r, g2, b, alpha * 255]).clip(0, 255).astype('uint8')


def split(rgba, n):
    """按列切分（每个素材之间都有整列空白）；找不到就退回连通块切分"""
    solid = rgba[..., 3] > 40
    cols = solid.sum(0) > 2
    segs, x, W = [], 0, len(cols)
    while x < W:
        if cols[x]:
            s = x
            while x < W and cols[x]: x += 1
            segs.append([s, x])
        x += 1
    merged = []
    for s in segs:
        if merged and s[0] - merged[-1][1] < 6: merged[-1][1] = s[1]
        else: merged.append(s)
    merged = [s for s in merged if s[1] - s[0] > 12]
    if len(merged) != n:
        # 退回连通块（适合图形之间有重叠列的情况）
        lab, k = ndimage.label(solid)
        objs = ndimage.find_objects(lab)
        sizes = ndimage.sum(solid, lab, range(1, k + 1))
        keep = [i for i in range(k) if sizes[i] > 400]
        keep.sort(key=lambda i: objs[i][1].start)
        if len(keep) != n:
            raise SystemExit(f'切出 {len(merged)}/%d 个，给的名字是 {n} 个' % len(keep))
        return [objs[i] for i in keep]
    return merged


def main():
    out_meta = {}
    for src, outdir, names in JOBS:
        p = G(src)
        img = Image.open(p)
        rgba = key(img)
        boxes = split(rgba, len(names))
        d = os.path.join(R, 'art', outdir)
        os.makedirs(d, exist_ok=True)
        for (box, name) in zip(boxes, names):
            if isinstance(box, list):          # 列区间
                x0, x1 = box
                sub = rgba[:, x0:x1]
            else:                              # 连通块 slice
                sy, sx = box
                sub = rgba[max(0, sy.start - 1):sy.stop + 1, max(0, sx.start - 1):sx.stop + 1]
            im = Image.fromarray(sub, 'RGBA')
            bb = im.getbbox()
            if bb: im = im.crop(bb)
            if outdir == 'food':
                w, h = FOOD_SIZE.get(name, [12, 10])
                # 按世界尺寸换算像素高度（1 世界单位 ≈ 6 像素，足够清晰）
                scale = h * 6 / im.height
                im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
                out_meta[name] = [w, h]
            im.save(os.path.join(d, name + '.png'))
            if outdir == 'ui':   # 手绘风：只换编码（webp），不调色板，体积小 7 倍
                im.save(os.path.join(d, name + '.webp'), 'WEBP', quality=90, method=6)
            print('  %-12s %-12s %dx%d' % (src, name, im.width, im.height))
    if out_meta:
        json.dump(out_meta, open(os.path.join(R, 'art', 'food', 'meta.json'), 'w'), ensure_ascii=False)
        print('食物尺寸 meta:', out_meta)


if __name__ == '__main__':
    main()
