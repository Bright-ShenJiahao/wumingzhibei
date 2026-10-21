#!/usr/bin/env python3
"""把某个角色的精灵调色板对齐到参考角色，并可选做水平加宽。

用法：
    python tools/match_palette.py banner --ref grunt blade --widen 1.12

为什么要这个：pixelize_sheet.py 是按每张图各自量化调色板的，
不同批次生成的图会带来不同的色系（比如橄榄黄 vs 亮黄），
同一批小兵站在一起画风就不一致。这个脚本把目标角色吸附到
"标准色卡"（参考角色所有帧出现过的颜色）上，顺带可以微调宽高比。
"""
import argparse, glob, json, os, sys
import numpy as np
from PIL import Image

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def palette_of(names):
    cols = []
    for n in names:
        for p in glob.glob(os.path.join(R, 'art', 'sprites', n, '*.png')):
            im = Image.open(p).convert('RGBA')
            a = np.asarray(im)
            m = a[..., 3] > 200
            cols.append(a[..., :3][m])
    a = np.concatenate(cols).astype(int)
    # 直接用参考图的原始颜色（不量化，避免把亮黄压成橄榄色）
    u, c = np.unique(a, axis=0, return_counts=True)
    keep = c >= 2
    u = u[keep]
    # 色卡太大时按出现次数裁到 220 色
    c2 = c[keep]
    if len(u) > 220:
        idx = np.argsort(-c2)[:220]
        u = u[idx]
    return u


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('char')
    ap.add_argument('--ref', nargs='+', default=['grunt', 'blade'])
    ap.add_argument('--widen', type=float, default=1.0)
    args = ap.parse_args()

    pal = palette_of(args.ref).astype(float)
    print('标准色卡：%d 色（来自 %s）' % (len(pal), ', '.join(args.ref)))

    files = sorted(glob.glob(os.path.join(R, 'art', 'sprites', args.char, '*.png')))
    total = 0
    for p in files:
        im = Image.open(p).convert('RGBA')
        if args.widen != 1.0:
            nw = max(1, round(im.width * args.widen))
            im = im.resize((nw, im.height), Image.NEAREST)   # 像素图用最近邻，保持硬边
        a = np.asarray(im).astype(int)
        rgb, al = a[..., :3], a[..., 3]
        m = al > 0
        px = rgb[m].astype(float)
        # 每个像素吸附到最近的色卡颜色（RGB 平方距离）
        d = ((px[:, None, :] - pal[None, :, :]) ** 2).sum(2)
        rgb[m] = pal[d.argmin(1)].astype(int)
        Image.fromarray(np.dstack([rgb, al]).astype('uint8')).save(p)
        total += 1
    print('已对齐 %d 帧，宽度 ×%.2f' % (total, args.widen))

    # 更新 atlas 里的宽（宽度变了的话）
    ap_ = os.path.join(R, 'art', 'sprites', 'atlas.json')
    if os.path.exists(ap_):
        at = json.load(open(ap_, encoding='utf-8'))
        if args.char in at:
            for k, v in at[args.char].items():
                p = os.path.join(R, 'art', 'sprites', args.char, k + '.png')
                if os.path.exists(p):
                    w, h = Image.open(p).size
                    ax = v[2] + (w - v[0]) / 2.0    # 锚点按中心同步平移
                    at[args.char][k] = [w, h, round(ax, 1), v[3]]
            json.dump(at, open(ap_, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            print('atlas 已更新')


if __name__ == '__main__':
    main()
