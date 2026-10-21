"""管亥：空手动作图 + 单独的长戟 → 合成后转成像素精灵（武器分离方案）

做法：
1. 从 Gemini 的空手动作图里切出每一帧（高分辨率）。
2. 按每帧手动标好的拳头位置，把长戟旋转后贴上去，再把拳头盖回戟杆上面（看起来握在手里）。
3. 缩小成像素图（64 色、深色描边），脚底锚点只按身体计算（不受长戟影响）。
4. 输出 art/sprites/guanhai/、art/sprites/guanhai_horse/，更新 atlas.json，并打印各攻击帧戟尖的位置（世界单位）。

用法：python3 tools/build_guanhai.py
改握持位置：修改下面 SHEETS 里每帧的 spear 参数。
"""
import json, math, os, shutil
import numpy as np
from PIL import Image
from scipy import ndimage

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
G = lambda n: os.path.join(R, 'art', 'gemini', n)
PX = 0.4            # 游戏里 1 精灵像素 = 0.4 世界单位
SPEAR_LEN = 205     # 长戟长度（精灵像素）≈ 管亥身高的 2 倍
COLORS = 64
PAD = 800

# spear 参数：
#   a, b：两只拳头的位置（原图坐标），戟头从 a 指向 b 的方向；g：a 手离铁镦的比例
#   c, ang, g：两拳握在一起时，用中心点 c 和角度 ang（度，0=朝右，正数向下）
#   butt, ang：用铁镦落地点和角度（拄地）
#   spin：在头顶水平旋转的角度（度），c 为两拳中点，握在戟杆中间
#   ground：长戟横躺在地上（脱手）
SHEETS = [
dict(char='guanhai', file='管亥_空手_冲刺.png', ref=('dash_a', 103), r=20, frames=[
  ('dash_a', dict(c=(380, 245), ang=0, g=.3)),     # 蓄力：戟尖朝右平举
  ('dash_b', dict(c=(950, 240), ang=0, g=.3)),     # 突刺：双手前推
]),

    dict(char='guanhai_horse', file='管亥_空手_马上上.png', ref=('run1', 127), r=13, frames=[
        ('idle', dict(a=(122, 158), b=(212, 123), g=.32)),
        ('run1', dict(a=(470, 153), b=(555, 139), g=.32)),
        ('run2', dict(a=(813, 153), b=(899, 137), g=.32)),
        ('rear', dict(a=(113, 370), b=(212, 368), g=.32)),
        ('leap', dict(a=(490, 453), b=(573, 443), g=.32)),
        ('stomp', dict(a=(827, 490), b=(912, 475), g=.32)),
    ]),
    dict(char='guanhai_horse', file='管亥_空手_马上下.png', ref=('sweep_b', 127), r=13, frames=[
        ('sweep_a', dict(a=(182, 85), b=(135, 62), g=.32)),
        ('sweep_b', dict(a=(870, 115), b=(895, 112), g=.3)),
        ('fall_rider', None),
        ('fall_horse', None),
    ]),
    dict(char='guanhai', file='管亥_空手_步战上.png', ref=('walk1', 103), r=20, frames=[
        ('idle', dict(a=(83, 242), b=(262, 174), g=.3)),
        ('walk1', dict(a=(415, 228), b=(579, 191), g=.3)),
        ('walk2', dict(a=(756, 210), b=(963, 214), g=.3)),
        ('chop_a', dict(a=(243, 415), b=(98, 415), g=.3)),
        ('chop_b', dict(c=(613, 608), ang=17, g=.3)),
        ('spin', dict(c=(855, 412), spin=[0, 60, 120, 180, 240, 300])),
    ]),
    dict(char='guanhai', file='管亥_空手_步战下.png', ref=('thrust_a', 'guanhai:idle'), r=20, frames=[
        ('thrust_a', dict(a=(122, 212), b=(268, 178), g=.25)),
        ('thrust_b', dict(a=(605, 152), b=(642, 152), g=.15)),
        ('hurt', None), ('stagger', None), ('dizzy', None),
        ('roar', dict(fist=(973, 562), ang=-90)),
    ]),
    dict(char='guanhai', file='管亥_空手_状态.png', ref='prev', r=20, frames=[
        ('fly', None), ('kneel', dict(ground=True)), ('down', dict(ground=True)),
    ]),
    # 空手（掷戟后 / 捡戟前用）：同一张「步战上」原图，跳过长戟合成，只出人物本身
    dict(char='guanhai', file='管亥_空手_步战上.png', ref=('bare_walk1', 103), r=20, frames=[
        ('bare_idle', None), ('bare_walk1', None), ('bare_walk2', None),
        ('bare_chop_a', None), ('bare_chop_b', None), ('bare_spin', None),
    ]),
]


def key(path, pad=0):
    a = np.asarray(Image.open(path).convert('RGB')).astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    d = g - np.maximum(r, b)
    al = np.clip(1 - (d - 25) / 110, 0, 1)
    g2 = np.minimum(g, np.maximum(r, b) + 8)
    rgba = np.dstack([r, g2, b, al * 255]).clip(0, 255).astype('uint8')
    if pad:   # 四周留白，避免长戟伸出原图边缘被裁掉
        rgba = np.pad(rgba, ((pad, pad), (pad, pad), (0, 0))); d = np.pad(d, pad, constant_values=255)
    return rgba, d < 45


def frames_of(rgba, fg, n):
    lab, k = ndimage.label(ndimage.binary_opening(fg, iterations=1))
    sz = ndimage.sum(fg, lab, range(1, k + 1)); objs = ndimage.find_objects(lab)
    big = [i for i in range(k) if sz[i] > .15 * sz.max()]
    groups = {i: [i] for i in big}
    for i in range(k):   # 星星、碎石等小块并入最近的人物
        if i in groups or sz[i] < 20: continue
        sy, sx = objs[i]; cy, cx = (sy.start + sy.stop) / 2, (sx.start + sx.stop) / 2
        best = min(big, key=lambda j: max(0, objs[j][1].start - cx, cx - objs[j][1].stop) + max(0, objs[j][0].start - cy, cy - objs[j][0].stop))
        groups[best].append(i)
    items = []
    for j, ids in groups.items():
        ys = [objs[i][0] for i in ids]; xs = [objs[i][1] for i in ids]
        y0, y1 = min(s.start for s in ys), max(s.stop for s in ys); x0, x1 = min(s.start for s in xs), max(s.stop for s in xs)
        items.append(((y0, y1, x0, x1), ids))
    cy = lambda it: (it[0][0] + it[0][1]) / 2
    items.sort(key=cy); rows, cur = [], [items[0]]
    for it in items[1:]:
        if cy(it) - cy(cur[-1]) > 120: rows.append(cur); cur = [it]
        else: cur.append(it)
    rows.append(cur)
    seq = [it for row in rows for it in sorted(row, key=lambda it: it[0][2])]
    assert len(seq) == n, f'找到 {len(seq)} 帧，需要 {n} 帧：{[len(r) for r in rows]}'
    out = []
    for (y0, y1, x0, x1), ids in seq:
        m = np.isin(lab, [i + 1 for i in ids])
        m = ndimage.binary_dilation(m, iterations=3) & (rgba[..., 3] > 0)
        sub = rgba.copy(); sub[~m] = 0
        out.append((sub, (y0, y1, x0, x1)))
    return out


SPEAR, _ = key(G('管亥_长戟.png'))
SPEAR = Image.fromarray(SPEAR, 'RGBA'); SPEAR = SPEAR.crop(SPEAR.getbbox())


def spear_layer(size, L, base, ang_deg, sx=1.0):
    """长戟图层：铁镦在 base，朝 ang 方向，长度 L（原图像素）；sx<1 表示透视缩短（头顶旋转用）"""
    w = max(2, int(round(L * abs(sx))))
    img = SPEAR.resize((w, max(3, round(SPEAR.height * L / SPEAR.width))), Image.LANCZOS)
    if sx < 0: img = img.transpose(Image.FLIP_LEFT_RIGHT)
    rot = img.rotate(-ang_deg, expand=True, resample=Image.BICUBIC)
    t = math.radians(ang_deg); cx, cy = img.width / 2, img.height / 2
    px = (-img.width / 2 if sx >= 0 else img.width / 2)   # 铁镦端相对中心
    rx = px * math.cos(t); ry = px * math.sin(t)
    layer = Image.new('RGBA', size, (0, 0, 0, 0))
    layer.alpha_composite(rot, (int(round(base[0] - (rot.width / 2 + rx))), int(round(base[1] - (rot.height / 2 + ry)))))
    tip = (base[0] + w * math.cos(t) * (1 if sx >= 0 else -1), base[1] + w * math.sin(t) * (1 if sx >= 0 else -1))
    return layer, tip


def fist_mask(size, pts, r):
    yy, xx = np.mgrid[0:size[1], 0:size[0]]
    m = np.zeros((size[1], size[0]), bool)
    for x, y in pts: m |= (xx - x) ** 2 + (yy - y) ** 2 <= r * r
    return m


def compose(body, spec, L, r, bottom):
    """返回 [(rgba 图, 身体 alpha, 戟尖坐标或 None, 后缀名)]"""
    H, W = body.shape[:2]; size = (W, H); B = Image.fromarray(body, 'RGBA')
    if spec is None: return [(B, body[..., 3], None, '')]
    outs = []
    if 'spin' in spec:
        c = spec['c']
        for k, th in enumerate(spec['spin']):
            t = math.radians(th); sx = math.cos(t); tilt = math.degrees(math.atan2(.22 * math.sin(t), 1))
            Lp = L * math.sqrt(math.cos(t) ** 2 + (.22 * math.sin(t)) ** 2)
            base = (c[0] - (Lp / 2) * (1 if sx >= 0 else -1) * math.cos(math.radians(tilt)), c[1] - (Lp / 2) * math.sin(math.radians(tilt)) * (1 if sx >= 0 else -1))
            sp, tip = spear_layer(size, Lp, base, tilt, 1 if sx >= 0 else -1)
            img = B.copy(); img.alpha_composite(sp)
            # 拳头（两拳中点左右各一个）盖回戟杆上面
            fm = fist_mask(size, [(c[0] - 55, c[1]), (c[0] + 55, c[1])], r)
            arr = np.asarray(img).copy(); arr[fm & (body[..., 3] > 0)] = body[fm & (body[..., 3] > 0)]
            outs.append((Image.fromarray(arr, 'RGBA'), body[..., 3], tip, str(k + 1)))
        return outs
    if spec.get('ground'):
        ys, xs = np.nonzero(body[..., 3] > 0)
        base = (xs.mean() - L * .15, bottom - 4)
        sp, tip = spear_layer(size, L, base, 0)
        img = Image.new('RGBA', size, (0, 0, 0, 0)); img.alpha_composite(sp); img.alpha_composite(B)
        return [(img, body[..., 3], None, '')]
    if 'a' in spec:
        a, b = spec['a'], spec['b']; ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0])); fists = [a, b]
        base = (a[0] - L * spec['g'] * math.cos(math.radians(ang)), a[1] - L * spec['g'] * math.sin(math.radians(ang)))
    elif 'c' in spec:
        c, ang = spec['c'], spec['ang']; fists = [c]
        base = (c[0] - L * spec['g'] * math.cos(math.radians(ang)), c[1] - L * spec['g'] * math.sin(math.radians(ang)))
    else:   # 拄地：单手握，铁镦落在脚底高度
        f, ang = spec['fist'], spec['ang']; fists = [f]
        base = (f[0], bottom)
    sp, tip = spear_layer(size, L, base, ang)
    img = B.copy(); img.alpha_composite(sp)
    fm = fist_mask(size, fists, r) & (body[..., 3] > 0)
    arr = np.asarray(img).copy(); arr[fm] = body[fm]
    return [(Image.fromarray(arr, 'RGBA'), body[..., 3], tip, '')]


def pixelize(img, body_a, sc, tip):
    W, H = img.size
    bb = img.getbbox(); img = img.crop(bb); body = Image.fromarray(body_a).crop(bb)
    w, h = max(1, round(img.width * sc)), max(1, round(img.height * sc))
    a = np.asarray(img).astype(float); al = a[..., 3:] / 255
    P = np.asarray(Image.fromarray((a[..., :3] * al).astype('uint8')).resize((w, h), Image.BOX)).astype(float)
    A = np.asarray(img.getchannel('A').resize((w, h), Image.BOX)).astype(float) / 255
    rgb = (P / np.maximum(A, 1e-3)[..., None]).clip(0, 255); on = A > .45
    BA = np.asarray(body.resize((w, h), Image.BOX)).astype(float) / 255 > .45
    ys, xs = np.nonzero(BA)
    ax = (xs.min() + xs.max()) / 2 if w > h * 1.3 else xs[ys >= ys.max() - max(2, h * .15)].mean()
    ay = ys.max()
    t = None if tip is None else ((tip[0] - bb[0]) * sc - ax, (tip[1] - bb[1]) * sc - ay)
    return rgb, on, ax, ay, t, ys.max() - ys.min() + 1


def finish(rgb, on, pal):
    q = np.asarray(Image.fromarray(rgb.astype('uint8')).quantize(palette=pal, dither=Image.Dither.NONE).convert('RGB'))
    H, W = on.shape
    out = np.zeros((H + 2, W + 2, 4), 'uint8'); out[1:-1, 1:-1, :3] = q; out[1:-1, 1:-1, 3] = on * 255
    o = out[..., 3] > 0; edge = ndimage.binary_dilation(o) & ~o
    nb = np.zeros(out.shape[:2] + (3,)); cnt = np.zeros(o.shape)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nb += np.roll(np.roll(out[..., :3].astype(float) * o[..., None], dy, 0), dx, 1); cnt += np.roll(np.roll(o, dy, 0), dx, 1)
    col = (nb / np.maximum(cnt, 1)[..., None] * .3).astype('uint8')
    out[edge, :3] = col[edge]; out[edge, 3] = 255
    return Image.fromarray(out, 'RGBA')


def main():
    res = {'guanhai': {}, 'guanhai_horse': {}}; tips = {}; scale = {}; prev_sc = None; ground_sc = .1
    for S in SHEETS:
        rgba, fg = key(G(S['file']), PAD)
        fr = frames_of(rgba, fg, len(S['frames']))
        names = [n for n, _ in S['frames']]
        if S['ref'] == 'prev': sc = prev_sc
        else:
            rn, rh = S['ref']; (y0, y1, _, _) = fr[names.index(rn)][1]
            if isinstance(rh, str):   # 和另一张图里的某帧一样高
                rh = scale[rh]
            sc = rh / (y1 - y0)
        prev_sc = sc
        if S['char'] == 'guanhai': ground_sc = sc
        for (body, (y0, y1, x0, x1)), (name, spec) in zip(fr, S['frames']):
            if spec:   # 坐标加上留白偏移
                spec = {k: ((v[0] + PAD, v[1] + PAD) if isinstance(v, tuple) else v) for k, v in spec.items()}
            L = SPEAR_LEN / sc
            for img, ba, tip, suf in compose(body, spec, L, S['r'], y1):
                rgb, on, ax, ay, t, bh = pixelize(img, ba, sc, tip)
                res[S['char']][name + suf] = (rgb, on, ax, ay)
                scale[f"{S['char']}:{name + suf}"] = bh
                if t: tips[f"{S['char']}:{name + suf}"] = (round(t[0] * PX, 1), round(t[1] * PX, 1))
    atlas_p = os.path.join(R, 'art', 'sprites', 'atlas.json'); atlas = json.load(open(atlas_p, encoding='utf-8'))
    pals = {}
    for ch in ('guanhai', 'guanhai_horse'):
        frames = res[ch]
        allpx = np.concatenate([rgb[on] for rgb, on, _, _ in frames.values()]).astype('uint8')
        pals[ch] = Image.fromarray(allpx[None]).quantize(colors=COLORS, method=Image.Quantize.MEDIANCUT).getpalette()[:COLORS * 3]
    for ch, frames in res.items():
        # 骑马帧大部分是马的棕色，单独算调色板会把头巾的黄、皮肤冲淡：并上步战帧的调色板（共 128 色），人物颜色两边一致
        cols = pals[ch] if ch == 'guanhai' else pals['guanhai_horse'] + pals['guanhai']
        pal = Image.new('P', (1, 1)); pal.putpalette(cols + cols[-3:] * (256 - len(cols) // 3))
        d = os.path.join(R, 'art', 'sprites', ch); shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
        atlas[ch] = {}
        for name, (rgb, on, ax, ay) in frames.items():
            im = finish(rgb, on, pal); im.save(os.path.join(d, name + '.png'))
            atlas[ch][name] = [im.width, im.height, round(float(ax) + 1, 1), int(ay) + 1]
        print(ch, {k: v[:2] for k, v in atlas[ch].items()})
    # 单独的长戟：投掷飞行 / 落地待捡时用（长度和手里那把一致）
    sc_g = scale['guanhai:walk1'] if 'guanhai:walk1' in scale else 100
    gw = SPEAR_LEN; gh = max(3, round(SPEAR.height * SPEAR_LEN / SPEAR.width))   # 和手里那把一样长
    sp = np.asarray(SPEAR.resize((gw, gh), Image.LANCZOS).convert('RGBA')).astype(float)
    al = sp[..., 3:] / 255
    rgb2 = np.clip(sp[..., :3], 0, 255); on2 = al[..., 0] > .45
    pal2 = Image.new('P', (1, 1)); cols2 = pals['guanhai']; pal2.putpalette(cols2 + cols2[-3:] * (256 - len(cols2) // 3))
    im = finish(rgb2, on2, pal2)
    im.save(os.path.join(R, 'art', 'sprites', 'guanhai', 'halberd.png'))
    atlas['guanhai']['halberd'] = [im.width, im.height, round(im.width / 2, 1), im.height - 1]
    print('halberd', im.size)
    # 斜插在地上的长戟（投出去落地后）：旋转 58°，戟尖朝下插进土里
    k = SPEAR_LEN / SPEAR.width
    rot = SPEAR.rotate(-58, expand=True, resample=Image.BICUBIC)
    w3 = max(2, round(rot.width * k)); h3 = max(2, round(rot.height * k))
    sp3 = np.asarray(rot.resize((w3, h3), Image.LANCZOS).convert('RGBA')).astype(float)
    al3 = sp3[..., 3:] / 255
    rgb3 = np.clip(sp3[..., :3], 0, 255); on3 = al3[..., 0] > .45
    im3 = finish(rgb3, on3, pal2)
    im3.save(os.path.join(R, 'art', 'sprites', 'guanhai', 'halberd_ground.png'))
    a3 = np.asarray(im3)[..., 3] > 0
    ys3, xs3 = np.nonzero(a3)
    tipx = float(xs3[ys3 >= ys3.max() - 3].mean())
    atlas['guanhai']['halberd_ground'] = [im3.width, im3.height, round(tipx, 1), int(ys3.max())]
    print('halberd_ground', im3.size)
    json.dump(atlas, open(atlas_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print('戟尖位置（世界单位，相对脚底；x 朝前为正，y 向下为正）：')
    for k, v in tips.items(): print(' ', k, v)


if __name__ == '__main__':
    main()
