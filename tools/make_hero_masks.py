"""给主角每张动作图标出「头发 / 上衣 / 裤子」区域，供时装换色使用。
输出 art/sprites/hero_mask/<帧名>.png：R=头发，G=上衣，B=裤子（255=属于该部位）。
另出一张检查图 build/hero_mask_check.png：头发染红、上衣染蓝、裤子染绿。

难点：头发和裤子是同一组深灰色；武器的钢铁部分和白上衣都是浅灰白。
做法（按位置关系分，不按颜色分）：
  1. 浅灰白像素里，挨着皮肤、并且连在身体主干上的 → 上衣（细长的刀刃/戟头被开运算去掉，不会算进来）
  2. 深灰像素分块：挨着上衣的 → 裤子；剩下最大的一块且挨着皮肤 → 头发
用法：python tools/make_hero_masks.py
"""
import glob, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(R, 'art', 'sprites', 'hero')
OUT = os.path.join(R, 'art', 'sprites', 'hero_mask')
ONLY = sys.argv[1:]   # 可只处理指定帧（调试用）


TILTED = {'fly1', 'fly2', 'down', 'bounce', 'roll1', 'roll2', 'getup', 'hurt'}   # 不是直立的帧，按接触关系判断


def classify(rgba, name=''):
    rgb = rgba[..., :3].astype(float); a = rgba[..., 3] > 0
    mx = rgb.max(2); mn = rgb.min(2); val = mx / 255; sat = (mx - mn) / (mx + 1e-6)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    skin = a & (r > g) & (g > b) & (sat > .15) & (val > .35) & (r - b > 30)
    light = a & (val > .55) & (sat < .22)
    dark = a & (val > .07) & (val < .36) & (sat < .3)
    near = lambda m, k=1: ndimage.binary_dilation(m, iterations=k)
    thick = lambda m: ndimage.distance_transform_edt(np.pad(m, 1))[1:-1, 1:-1].max()
    st = np.ones((3, 3))

    # 身体范围：皮肤外接框外扩 4 像素；框外的（刀光、戟头、远处的武器）一律不算
    ys, xs = np.where(skin)
    zone = np.zeros_like(a)
    if len(ys): zone[max(0, ys.min() - 16):ys.max() + 5, max(0, xs.min() - 4):xs.max() + 5] = True   # 往上多留，头发在脸上方
    # 深色块：先开运算切断细长的戟杆、锤柄，再在原深色里长回边缘
    blobs = []
    lab, n = ndimage.label(ndimage.binary_opening(dark, structure=st) & zone, structure=st)
    for i in range(1, n + 1):
        m = near(lab == i, 2) & dark
        if m.sum() < 15 or thick(m) < 2: continue
        cy, cx = ndimage.center_of_mass(m)
        blobs.append(dict(m=m, s=int(m.sum()), cy=cy, tk=int((near(m, 1) & skin).sum())))
    bodyDark = np.zeros_like(a)
    for d in blobs: bodyDark |= d['m']
    # 上衣：浅色块要厚、在身体范围内、同时挨着皮肤和头发/裤子（刀刃只挨着手）
    shirt = np.zeros_like(a)
    lab, n = ndimage.label(ndimage.binary_opening(light, structure=st) & zone, structure=st)
    parts = []
    for i in range(1, n + 1):
        m = near(lab == i, 1) & light
        if m.sum() < 20 or thick(m) < 2.5 or not (near(m, 2) & skin).any(): continue
        yy, xx = np.nonzero(m); ev = np.linalg.eigvalsh(np.cov(np.vstack([yy, xx])) + 1e-3 * np.eye(2))
        if ev[1] / ev[0] > 20: continue   # 细长的（刀身、刀光）不是衣服；长宽比约>4.5
        parts.append(m)
    for m in parts:                      # 先收挨着头发/裤子的
        if (near(m, 5) & bodyDark).any(): shirt |= m
    if not shirt.any():                  # 一块都没找到时，取最大最厚的一块（被武器挡开的情况）
        big = [m for m in parts if m.sum() >= 60 and thick(m) >= 3.5]
        if big: shirt |= max(big, key=lambda m: m.sum())
    for _ in range(3):                   # 再收挨着已认定上衣的（被手臂隔开的另一半衣服）
        for m in parts:
            if not (m & shirt).any() and (near(m, 3) & shirt).any(): shirt |= m
    for d in blobs: d['ts'] = int((near(d['m'], 2) & shirt).sum())
    hair = np.zeros_like(a); pants = np.zeros_like(a)
    if not blobs: return hair, shirt, pants
    if name in TILTED:
        # 歪着的帧：挨上衣最多的是裤子，其余挨皮肤最多的是头发
        p = max(blobs, key=lambda d: d['ts']); pants |= p['m']
        rest = [d for d in blobs if d is not p and d['tk'] > 0]
        if rest: hair |= max(rest, key=lambda d: d['tk'])['m']
    else:
        # 直立的帧：最靠上、挨皮肤的是头发；在上衣下方的是裤子
        sy = ndimage.center_of_mass(shirt)[0] if shirt.any() else rgba.shape[0] * .5
        tops = [d for d in blobs if d['tk'] > 0 and d['cy'] < sy and thick(d['m']) >= 3]
        h = max(tops, key=lambda d: d['tk']) if tops else None   # 挨脸最多的才是头发（锤头只挨着手）
        if h: hair |= h['m']
        for d in blobs:
            if d is not h and d['cy'] > sy: pants |= d['m']
        # 裤子只留在上衣左右范围内（伸出去的戟杆、锤头不算）
        if shirt.any():
            yy, xx = np.where(shirt); box = np.zeros_like(a)
            box[yy.min():, max(0, xx.min() - 6):xx.max() + 7] = True; pants &= box
    return hair, shirt, pants


def main():
    os.makedirs(OUT, exist_ok=True)
    files = sorted(glob.glob(os.path.join(SRC, '*.png')))
    if ONLY: files = [f for f in files if os.path.splitext(os.path.basename(f))[0] in ONLY]
    tiles = []
    for f in files:
        name = os.path.splitext(os.path.basename(f))[0]
        rgba = np.asarray(Image.open(f).convert('RGBA'))
        hair, shirt, pants = classify(rgba, name)
        mask = np.zeros(rgba.shape[:2] + (4,), np.uint8)
        mask[..., 0] = hair * 255; mask[..., 1] = shirt * 255; mask[..., 2] = pants * 255; mask[..., 3] = 255
        Image.fromarray(mask).save(os.path.join(OUT, name + '.png'))
        chk = rgba.copy().astype(float)
        for m, c in ((hair, (230, 40, 40)), (shirt, (40, 90, 230)), (pants, (40, 200, 60))):
            v = chk[m, :3].max(1, keepdims=True) / 255
            chk[m, :3] = np.array(c) * (.45 + .55 * v)
        tiles.append((name, Image.fromarray(chk.clip(0, 255).astype(np.uint8))))
    # 检查图：每行 10 张，放大 3 倍
    S, cw, ch = 3, 150 * 3, 140 * 3
    cols = 10; rows = (len(tiles) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cw // 3 * 1 + 0, rows * ch // 3), (70, 64, 78))
    sheet = Image.new('RGB', (cols * 150, rows * 140), (70, 64, 78))
    from PIL import ImageDraw
    d = ImageDraw.Draw(sheet)
    for k, (name, im) in enumerate(tiles):
        x, y = (k % cols) * 150, (k // cols) * 140
        im2 = im.resize((im.width * 1, im.height * 1), Image.NEAREST)
        sheet.paste(im2, (x + (150 - im2.width) // 2, y + 125 - im2.height), im2)
        d.text((x + 4, y + 126), name, fill=(230, 230, 230))
    os.makedirs(os.path.join(R, 'build'), exist_ok=True)
    sheet = sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST)
    sheet.save(os.path.join(R, 'build', 'hero_mask_check.png'))
    print('处理', len(tiles), '帧；检查图 build/hero_mask_check.png', sheet.size)


if __name__ == '__main__':
    main()
