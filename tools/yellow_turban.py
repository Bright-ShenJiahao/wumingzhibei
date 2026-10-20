"""黄巾兵像素图：喽啰 / 刀手 / 投石手 / 弓箭手（火箭）
与主角同一套画法和尺寸（56×44，脚底在 (15+?, 40)）。
用法：python3 tools/yellow_turban.py <jiangshi/src 路径> <输出目录>"""
import math, os, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SRC, OUT = sys.argv[1], sys.argv[2]
cwd = os.getcwd()
g = {'__name__': 'lib'}
sys.argv = ['x', SRC, OUT]
exec(open(os.path.join(HERE, 'farmer.py'), encoding='utf-8').read(), g)
os.chdir(cwd)
PAL, C, W, H, OX, BASE = g['PAL'], g['C'], g['W'], g['H'], g['OX'], g['BASE']
farmer_frame = g['frame']
PAL.update({
    'u': (132, 128, 120), 'U': (92, 88, 86),        # 灰色短褐
    'a': (214, 166, 120), 'A': (170, 120, 80),      # 黝黑皮肤
    'n': (98, 62, 36),                               # 棕发
    'l': (196, 186, 160), 'L2': (150, 140, 118),     # 绑腿
    'f': (255, 210, 80), 'F2': (240, 110, 30),       # 火焰
    'o': (122, 80, 44), 'O2': (84, 52, 28),          # 木
})


def head(c, dx, dy, face='n', tails=3):
    X, Y = OX + dx, BASE - 33 + dy
    rows = {1: (8, 16), 2: (7, 17), 3: (7, 17), 4: (7, 17), 5: (7, 17), 6: (7, 17), 7: (7, 17),
            8: (7, 17), 9: (7, 17), 10: (7, 17), 11: (8, 16), 12: (9, 15)}
    for yy, (x0, x1) in rows.items():
        c.rect(X + x0, Y + yy, X + x1, Y + yy, 'a'); c.px(X + x0, Y + yy, 'A')
    c.rect(X + 7, Y - 1, X + 16, Y + 1, 'n'); c.rect(X + 6, Y + 0, X + 8, Y + 6, 'n')   # 棕色乱发
    c.px(X + 9, Y - 2, 'n'); c.px(X + 13, Y - 2, 'n'); c.px(X + 17, Y + 0, 'n')
    c.rect(X + 6, Y + 2, X + 17, Y + 4, 'y'); c.rect(X + 6, Y + 4, X + 17, Y + 4, 'Y')  # 黄头巾
    for k in range(tails):                                                               # 脑后飘带
        c.px(X + 5 - k, Y + 3 + k, 'y'); c.px(X + 5 - k, Y + 4 + k, 'Y')
    c.rect(X + 9, Y + 7, X + 10, Y + 8, 'A')                                            # 耳
    if face == 'hurt':
        for ex in (12, 15):
            c.px(X + ex, Y + 6, 'k'); c.px(X + ex + 1, Y + 7, 'k'); c.px(X + ex, Y + 8, 'k')
        c.rect(X + 13, Y + 10, X + 15, Y + 11, 'k')
    else:
        c.px(X + 12, Y + 5, 'k'); c.rect(X + 13, Y + 6, X + 13, Y + 6, 'k')             # 斜眉（凶）
        c.px(X + 17, Y + 5, 'k'); c.px(X + 16, Y + 6, 'k')
        c.rect(X + 13, Y + 7, X + 13, Y + 8, 'k'); c.rect(X + 16, Y + 7, X + 16, Y + 8, 'k')
        c.rect(X + 12, Y + 10, X + 17, Y + 11, 'A')                                    # 胡茬
        c.rect(X + 14, Y + 10, X + 16, Y + 10, 'k' if face == 'yell' else 'A')
        if face == 'yell': c.rect(X + 14, Y + 11, X + 16, Y + 11, 'r')


def torso(c, dx, dy, quiver=False, sleeveless=False):
    X, Y = OX + dx, BASE - 20 + dy
    if quiver:   # 背后箭筒
        c.rect(X + 2, Y - 4, X + 5, Y + 7, 'o'); c.rect(X + 2, Y - 4, X + 3, Y + 7, 'O2')
        for k in range(3): c.px(X + 2 + k, Y - 6, 'w'); c.px(X + 2 + k, Y - 5, 'r')
    c.rect(X + 11, Y - 1, X + 14, Y, 'A')
    c.rect(X + 6, Y + 1, X + 18, Y + 9, 'u'); c.rect(X + 6, Y + 1, X + 8, Y + 9, 'U')
    c.line(X + 10, Y + 1, X + 14, Y + 6, 'U', 1)                                        # 交领
    c.rect(X + 6, Y + 7, X + 18, Y + 8, 'y'); c.rect(X + 6, Y + 8, X + 18, Y + 8, 'Y')  # 黄腰带
    c.rect(X + 15, Y + 9, X + 16, Y + 11, 'y')                                          # 腰带垂头
    c.rect(X + 7, Y + 9, X + 17, Y + 12, 'U')                                           # 下摆


def leg(c, hip, foot, dy=0, lift=0, back=False):
    X = OX
    y0, y1 = BASE - 7 + dy, BASE - 2 - lift
    c.line(X + hip, y0 - 2, X + hip, y0, 'U', 3)
    c.line(X + hip, y0 + 1, X + foot, y1, 'L2' if back else 'l', 3)                     # 绑腿
    c.px(X + (hip + foot) / 2, (y0 + y1) / 2, 'L2')
    c.rect(X + foot - 1, y1 + 1, X + foot + 2, y1 + 1, 'B'); c.rect(X + foot - 1, y1, X + foot + 2, y1, 'b')


def arm(c, sx, sy, hx, hy, back=False, sleeve=True):
    X, Y = OX, BASE - 20
    col = 'A' if back else 'a'
    mx, my = sx + (hx - sx) * 0.4, sy + (hy - sy) * 0.4
    c.line(X + sx, Y + sy, X + hx, Y + hy, col, 3)
    if sleeve: c.line(X + sx, Y + sy, X + mx, Y + my, 'U' if back else 'u', 3)
    c.rect(X + hx - 1, Y + hy - 1, X + hx + 1, Y + hy + 1, col)


def club(c, hx, hy, ang, L=13):
    X, Y = OX, BASE - 20
    a = math.radians(ang); ca, sa = math.cos(a), -math.sin(a)
    c.line(X + hx - ca * 2, Y + hy - sa * 2, X + hx + ca * L, Y + hy + sa * L, 'o', 2)
    c.line(X + hx + ca * (L - 4), Y + hy + sa * (L - 4), X + hx + ca * L, Y + hy + sa * L, 'O2', 3)


def dao(c, hx, hy, ang):   # 环首刀
    X, Y = OX, BASE - 20
    a = math.radians(ang); ca, sa = math.cos(a), -math.sin(a)
    rx, ry = X + hx - ca * 4, Y + hy - sa * 4
    for t in range(12): c.px(rx + math.cos(t / 12 * 6.28) * 1.6, ry + math.sin(t / 12 * 6.28) * 1.6, 'Y')
    c.line(X + hx - ca * 2, Y + hy - sa * 2, X + hx + ca * 1, Y + hy + sa * 1, 'B', 2)
    c.line(X + hx + ca * 2, Y + hy + sa * 2, X + hx + ca * 14, Y + hy + sa * 14, 'i', 2)
    c.line(X + hx + ca * 2 + sa, Y + hy + sa * 2 - ca, X + hx + ca * 13 + sa, Y + hy + sa * 13 - ca, 'w', 1)


def bow(c, hx, hy, drawn):
    X, Y = OX, BASE - 20
    for t in range(-7, 8):
        bx = X + hx + (2 if drawn else 1) - abs(t) * abs(t) / 14 * (1.6 if drawn else 1)
        c.px(bx + 1, Y + hy + t, 'o'); c.px(bx + 2, Y + hy + t, 'O2')
    sx = X + hx - (5 if drawn else 0)
    c.line(X + hx - 1.5, Y + hy - 7, sx, Y + hy, 'w', 1); c.line(sx, Y + hy, X + hx - 1.5, Y + hy + 7, 'w', 1)
    return sx


def fire(c, x, y):
    for dx, dy, col in ((0, 0, 'f'), (1, 0, 'f'), (0, -1, 'F2'), (1, -1, 'f'), (2, 0, 'F2'), (-1, 0, 'F2'), (0, -2, 'F2'), (1, 1, 'F2')):
        c.px(x + dx, y + dy, col)


def base_pose(c, b=0, face='n', lean=0, step=(10, 9, 15, 16), quiver=False, tails=3):
    leg(c, step[0], step[1], back=True); leg(c, step[2], step[3])
    torso(c, lean, b, quiver)
    head(c, lean + 1, b, face, tails)


def frame(kind, act, i=0):
    c = C()
    sw = (3, -3)[i % 2] if act == 'walk' else 0
    step = (11, 11 - sw, 14, 14 + sw) if act == 'walk' else (10, 9, 15, 16)
    q = kind == 'archer'
    tails = 5 if kind == 'blade' else 3
    if act == 'hurt':
        arm(c, 7, 4, 2, 0, back=True); leg(c, 8, 6, back=True); leg(c, 13, 13)
        torso(c, -3, 1, q); head(c, -2, 1, 'hurt', tails); arm(c, 14, 4, 20, -1)
    elif act == 'down':
        X, Y = OX, BASE
        c.rect(X + 2, Y - 6, X + 12, Y - 1, 'u'); c.rect(X + 2, Y - 3, X + 12, Y - 2, 'y')
        c.rect(X + 13, Y - 6, X + 16, Y - 1, 'U'); c.line(X + 17, Y - 4, X + 25, Y - 3, 'l', 3); c.rect(X + 25, Y - 5, X + 27, Y - 1, 'B')
        c.rect(X - 8, Y - 10, X + 0, Y - 1, 'a'); c.rect(X - 9, Y - 9, X - 7, Y - 2, 'n'); c.rect(X - 6, Y - 10, X - 5, Y - 1, 'y')
        c.px(X - 3, Y - 8, 'k'); c.px(X - 1, Y - 8, 'k'); c.px(X - 2, Y - 7, 'k'); c.px(X - 3, Y - 6, 'k'); c.px(X - 1, Y - 6, 'k')
    elif kind == 'grunt':
        if act == 'walk':
            arm(c, 7, 3, 6 - sw, 10, back=True); base_pose(c, i % 2, step=step, tails=tails); arm(c, 17, 3, 19, 8); club(c, 19, 8, 60)
        elif act == 'wind':
            arm(c, 7, 3, 4, 9, back=True); base_pose(c, 1, 'yell', -1, tails=tails); arm(c, 15, 3, 10, -4); club(c, 10, -4, 130)
        else:
            arm(c, 7, 3, 6, 10, back=True); base_pose(c, 2, 'yell', 2, (9, 6, 16, 20), tails=tails); arm(c, 18, 4, 23, 7); club(c, 23, 7, -20)
            g['swoosh'](c, 16, 4, 14, 110, -30, 2)
    elif kind == 'blade':
        if act == 'walk':
            arm(c, 7, 3, 6 - sw, 10, back=True); base_pose(c, i % 2, step=step, tails=tails); arm(c, 17, 3, 20, 9); dao(c, 20, 9, 20)
        elif act == 'wind':   # 高举刀，明显停顿
            arm(c, 7, 3, 3, 8, back=True); base_pose(c, 0, 'yell', -2, (9, 7, 15, 17), tails=tails); arm(c, 14, 2, 11, -8); dao(c, 11, -8, 115)
        else:
            arm(c, 7, 3, 6, 10, back=True); base_pose(c, 2, 'yell', 3, (9, 5, 17, 21), tails=tails); arm(c, 19, 4, 24, 9); dao(c, 24, 9, -35)
            g['swoosh'](c, 18, 3, 16, 100, -45, 3)
    elif kind == 'slinger':
        if act == 'walk':
            arm(c, 7, 3, 6 - sw, 10, back=True); base_pose(c, i % 2, step=step, tails=tails); arm(c, 17, 3, 19, 10)
            c.rect(OX + 19, BASE - 9, OX + 20, BASE - 8, 'i')
        elif act == 'wind':   # 甩投石索
            arm(c, 17, 3, 21, 9, back=True); base_pose(c, 1, 'n', -2, tails=tails); arm(c, 9, 3, 4, -4)
            X, Y = OX, BASE - 20
            for t in range(16): c.px(X + 4 + math.cos(t / 16 * 6.28) * 5, Y - 9 + math.sin(t / 16 * 6.28) * 2, 'o')
            c.rect(X + 9, Y - 10, X + 10, Y - 9, 'i')
        else:
            arm(c, 7, 3, 4, 9, back=True); base_pose(c, 2, 'yell', 2, (9, 6, 16, 20), tails=tails); arm(c, 18, 3, 25, 0)
            c.line(OX + 25, BASE - 20, OX + 29, BASE - 23, 'o', 1); c.rect(OX + 33, BASE - 24, OX + 34, BASE - 23, 'i')
    elif kind == 'archer':
        if act == 'walk':
            arm(c, 7, 3, 6 - sw, 10, back=True); base_pose(c, i % 2, step=step, quiver=True, tails=tails); arm(c, 17, 3, 19, 6); bow(c, 19, 6, False)
        elif act == 'wind':   # 拉满弓，箭头点火
            base_pose(c, 0, 'n', 0, quiver=True, tails=tails)
            sx = bow(c, 23, 3, True); arm(c, 17, 3, 23, 3); arm(c, 9, 3, int(sx - OX), 3, back=True)
            c.line(sx, BASE - 17, OX + 28, BASE - 17, 'o', 1); fire(c, OX + 29, BASE - 17)
        else:
            base_pose(c, 1, 'yell', 0, quiver=True, tails=tails)
            bow(c, 23, 3, False); arm(c, 17, 3, 23, 3); arm(c, 9, 3, 12, 6, back=True)
            c.line(OX + 32, BASE - 17, OX + 39, BASE - 17, 'o', 1); fire(c, OX + 40, BASE - 17)
            for k in range(3): c.px(OX + 29 - k * 2, BASE - 17, 'x')
    c.outline()
    return c.img()


KINDS = [('grunt', '喽啰', '木棍 · 血少 · 数量多'), ('blade', '刀手', '环首刀 · 举刀停顿后猛劈'),
         ('slinger', '投石手', '甩投石索 · 后排远程'), ('archer', '弓箭手', '火箭 · 落地会燃烧')]
ACTS = [('walk', 2), ('wind', 1), ('strike', 1), ('hurt', 1), ('down', 1)]

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
    f1, f2, f3 = (ImageFont.truetype(FONT, n, index=2) for n in (26, 16, 34))
    sc = 4
    cellw, cellh = W * sc, H * sc
    lab = 190
    GW = lab + cellw * 5 + 30
    GH = 96 + len(KINDS) * (cellh + 16) + 110
    allframes = {}
    for k, *_ in KINDS:
        allframes[k] = [frame(k, a, i) for a, n in ACTS for i in range(n)]

    def compose(t):
        im = Image.new('RGB', (GW, GH), (250, 248, 244)); d = ImageDraw.Draw(im)
        d.text((20, 16), '黄巾兵 · 像素预览（与主角同尺寸）', font=f3, fill=(40, 30, 40))
        for ci, (title) in enumerate(['走路', '预备（前摇）', '出手', '受击', '倒地']):
            d.text((lab + ci * cellw + cellw // 2, 80), title, font=f2, fill=(120, 110, 120), anchor='mm')
        for r, (k, name, sub) in enumerate(KINDS):
            y0 = 96 + r * (cellh + 16)
            d.rounded_rectangle([16, y0, GW - 16, y0 + cellh], 10, fill=(238, 233, 224))
            d.text((30, y0 + cellh // 2 - 16), name, font=f1, fill=(40, 30, 40), anchor='lm')
            d.text((30, y0 + cellh // 2 + 16), sub, font=f2, fill=(120, 110, 120), anchor='lm')
            fr = allframes[k]
            show = [fr[(t // 5) % 2], fr[2], fr[3], fr[4], fr[5]]
            for ci, f in enumerate(show):
                x0 = lab + ci * cellw
                d.ellipse([x0 + (OX + 4) * sc, y0 + BASE * sc - 8, x0 + (OX + 24) * sc, y0 + BASE * sc + 6], fill=(205, 196, 182))
                if ci == 1 and k == 'blade' and (t // 3) % 2:
                    d.rectangle([x0 + (OX + 12) * sc, y0 + 2, x0 + (OX + 14) * sc, y0 + 2 + 5 * sc], fill=(224, 58, 42))
                big = f.resize((cellw, cellh), Image.NEAREST); im.paste(big, (x0, y0), big)
        # 主角对比
        hero = farmer_frame('idle', 0)
        d.text((GW - 470, GH - 60), '对比：黄巾喽啰 vs 主角', font=f2, fill=(120, 110, 120))
        return im

    gif = [compose(t) for t in range(20)]
    for im in gif:
        hb = farmer_frame('idle', 0).resize((W * 2, H * 2), Image.NEAREST)
        gb = allframes['grunt'][0].resize((W * 2, H * 2), Image.NEAREST)
        im.paste(gb, (GW - 260, GH - 100), gb); im.paste(hb, (GW - 160, GH - 100), hb)
    gif[0].save(os.path.join(OUT, 'yellow_turban_preview.gif'), save_all=True, append_images=gif[1:], duration=80, loop=0)
    gif[0].save(os.path.join(OUT, 'yellow_turban_still.png'))
    sheet = Image.new('RGBA', (W * 6, H * len(KINDS)), (0, 0, 0, 0))
    for r, (k, *_) in enumerate(KINDS):
        for i, f in enumerate(allframes[k]): sheet.paste(f, (i * W, r * H), f)
    sheet.save(os.path.join(OUT, 'yellow_turban_sheet.png'))
    print('ok')
