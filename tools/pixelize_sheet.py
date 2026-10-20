"""把 Gemini 出的"仿像素"绿底人物动作图转成真正的像素精灵。
- 自动找出每个姿势（小碎块如飞出的石子、箭会并入最近的姿势）
- 按行分组；每行一个角色时，用 rows 参数给每行起名
- 同一角色共用一个缩放比例（以第一帧站立高度 = target 像素）和一套调色板
- 输出 art/sprites/<角色>/<帧名>.png 和 art/sprites/atlas.json（记录尺寸和脚底锚点）

用法：python3 tools/pixelize_sheet.py 原图 '角色名:帧1,帧2,...;角色名2:...' [目标高度=72 | area | ref=帧名:高度] [strict]
同一行里出现两个角色时，按顺序写多个角色即可（帧按从左到右、从上到下依次分配）。"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src, spec = sys.argv[1], sys.argv[2]
MODE = sys.argv[3] if len(sys.argv) > 3 else '72'   # 数字=第一帧高度；area=按已有 idle 帧的面积匹配大小（用于补帧，保证和原来同样大）
chars = []
for part in spec.split(';'):
    n, fr = part.split(':'); chars.append((n.strip(), [f.strip() for f in fr.split(',')]))

a = np.asarray(Image.open(src).convert('RGB')).astype(float)
d = a[..., 1] - np.maximum(a[..., 0], a[..., 2])
mask = d < 45
mask = ndimage.binary_opening(mask, iterations=1)
lab, n = ndimage.label(mask)
objs = ndimage.find_objects(lab)
sizes = ndimage.sum(mask, lab, range(1, n + 1))
thr = max(600, .3 * np.median(sorted(sizes)[-8:]))   # 比人物小很多的块（飞出的棍、石子、箭）算附属物
big = [i for i in range(n) if sizes[i] > thr]
small = [i for i in range(n) if 25 < sizes[i] <= thr]
groups = {i: [i] for i in big}
for i in small:   # 小碎块并入水平距离最近、垂直有重叠的大块
    sy, sx = objs[i]
    cy, cx = (sy.start + sy.stop) / 2, (sx.start + sx.stop) / 2
    best, bd = None, 1e9
    for j in big:
        jy, jx = objs[j]
        if not (jy.start - 10 < cy < jy.stop + 10): continue
        dist = max(0, jx.start - sx.stop, sx.start - jx.stop)   # 用碎块边缘到人物边界的距离
        if dist < bd: best, bd = j, dist
    # 很小又离得远的碎块（飞出去的石子、箭）直接丢弃，游戏里用代码画投射物
    tiny = sizes[i] < .04 * np.median(sorted(sizes)[-8:])
    strict = len(sys.argv) > 4 and sys.argv[4] == 'strict'   # strict：只合并贴在身上的碎块（被打飞时脱手的武器丢掉）
    if best is not None and (bd < 2 or (tiny and bd < 10) or (not tiny and not strict and bd < 160)): groups[best].append(i)


def bbox(ids):
    ys = [objs[i][0] for i in ids]; xs = [objs[i][1] for i in ids]
    return min(s.start for s in ys), max(s.stop for s in ys), min(s.start for s in xs), max(s.stop for s in xs)


items = [(bbox(v), v) for v in groups.values()]
# 按行排序：先按竖直中心聚类成行，再按 x
cy = lambda it: (it[0][0] + it[0][1]) / 2
items.sort(key=cy)
rows, cur = [], [items[0]]
for it in items[1:]:
    if cy(it) - cy(cur[-1]) > 60: rows.append(cur); cur = [it]
    else: cur.append(it)
rows.append(cur)
seq = [it for row in rows for it in sorted(row, key=lambda it: it[0][2])]
need = sum(len(f) for _, f in chars)
if len(seq) != need:
    sys.exit(f'找到 {len(seq)} 个姿势，但给了 {need} 个帧名。各行数量：{[len(r) for r in rows]}')

atlas_p = os.path.join(R, 'art', 'sprites', 'atlas.json')
atlas = json.load(open(atlas_p)) if os.path.exists(atlas_p) else {}
k = 0
for name, frames in chars:
    its = seq[k:k + len(frames)]; k += len(frames)
    if MODE.startswith('ref='):   # ref=帧名:高度 —— 让指定的那一帧缩放到这个像素高度（用不受武器长短影响的帧做基准，比如 walk1）
        rf, rh = MODE[4:].split(':'); (ry0, ry1, _, _), _ = its[frames.index(rf)]
        sc = int(rh) / (ry1 - ry0)
    elif MODE.startswith('area'):   # area 或 area*0.85（再乘一个修正系数）
        ref = np.asarray(Image.open(os.path.join(R, 'art', 'sprites', name, 'idle.png')))[..., 3] > 0
        areas = [np.isin(lab[y0:y1, x0:x1], [i + 1 for i in ids]).sum() for (y0, y1, x0, x1), ids in its]
        sc = float(np.median([np.sqrt(ref.sum() / a_) for a_ in areas])) * (float(MODE.split('*')[1]) if '*' in MODE else 1)
    else:
        (y0, y1, _, _), _ = its[0]
        sc = int(MODE) / (y1 - y0)
    outs = []
    for (y0, y1, x0, x1), ids in its:
        m = np.isin(lab[y0:y1, x0:x1], [i + 1 for i in ids]).astype(float)
        sub = a[y0:y1, x0:x1].copy()
        sub[..., 1] = np.minimum(sub[..., 1], np.maximum(sub[..., 0], sub[..., 2]) + 6)
        w, h = max(1, round((x1 - x0) * sc)), max(1, round((y1 - y0) * sc))
        P = np.asarray(Image.fromarray((sub * m[..., None]).clip(0, 255).astype('uint8')).resize((w, h), Image.BOX)).astype(float)
        A = np.asarray(Image.fromarray((m * 255).astype('uint8')).resize((w, h), Image.BOX)).astype(float) / 255
        rgb = (P / np.maximum(A, 1e-3)[..., None]).clip(0, 255)
        al = A > .45
        # 脚底锚点：底部 15% 行里像素的平均 x（躺倒的姿势用整体中心）
        ys, xs = np.nonzero(al)
        if w > h * 1.3: ax = (xs.min() + xs.max()) / 2
        else:
            sel = ys >= ys.max() - max(2, h * .15); ax = xs[sel].mean()
        outs.append((rgb, al, ax, ys.max()))
    allpx = np.concatenate([o[0][o[1]] for o in outs]).astype('uint8')
    pal = Image.fromarray(allpx[None]).quantize(colors=32, method=Image.Quantize.MEDIANCUT)
    os.makedirs(os.path.join(R, 'art', 'sprites', name), exist_ok=True)
    atlas.setdefault(name, {})
    for fname, (rgb, al, ax, ay) in zip(frames, outs):
        q = np.asarray(Image.fromarray(rgb.astype('uint8')).quantize(palette=pal, dither=Image.Dither.NONE).convert('RGB'))
        H, W = al.shape
        out = np.zeros((H + 2, W + 2, 4), 'uint8'); out[1:-1, 1:-1, :3] = q; out[1:-1, 1:-1, 3] = al * 255
        on = out[..., 3] > 0
        edge = ndimage.binary_dilation(on) & ~on
        # 描边颜色 = 相邻像素颜色 × 0.3
        nb = np.zeros_like(out[..., :3], dtype=float); cnt = np.zeros(on.shape)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sh = np.roll(np.roll(out[..., :3].astype(float) * on[..., None], dy, 0), dx, 1); c = np.roll(np.roll(on, dy, 0), dx, 1)
            nb += sh; cnt += c
        col = (nb / np.maximum(cnt, 1)[..., None] * .3).astype('uint8')
        out[edge, :3] = col[edge]; out[edge, 3] = 255
        Image.fromarray(out, 'RGBA').save(os.path.join(R, 'art', 'sprites', name, fname + '.png'))
        atlas[name][fname] = [W + 2, H + 2, round(float(ax) + 1, 1), int(ay) + 1]
    print(name, {f: atlas[name][f][:2] for f in frames})
json.dump(atlas, open(atlas_p, 'w'), ensure_ascii=False, indent=0)
