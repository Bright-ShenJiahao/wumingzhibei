"""穿越农民 像素主角预览 —— 与《暂时停止呼吸》同一套调色板和比例（大头 Q 版，约 26×34）"""
import math, sys, os
from PIL import Image, ImageDraw, ImageFont

SRC = sys.argv[1]  # jiangshi/src 目录
OUT = sys.argv[2]
g = {}
os.chdir(SRC)
exec(open('sprites.py').read().split('\nsheet()')[0], g)
PAL, taoist = g['PAL'], g['taoist']
PAL.update({
    'T': (236, 238, 240),   # 白T恤
    't': (186, 192, 204),   # T恤暗部
    'K': (34, 32, 40),      # 黑短裤
    'J': (62, 60, 72),      # 短裤亮边
    'i': (150, 152, 160),   # 刀刃/石头
    'I': (98, 100, 110),    # 刀刃暗部
    'F': (255, 170, 60), 'P': (246, 160, 150),    # 火光
    'x': (255, 255, 255),   # 挥砍残影
})

W, H = 56, 44
OX, BASE = 15, 40   # 角色原点 / 脚底


class C:
    def __init__(s):
        s.g = [[None] * W for _ in range(H)]

    def px(s, x, y, c):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < W and 0 <= y < H:
            s.g[y][x] = c

    def rect(s, x0, y0, x1, y1, c):
        for y in range(int(y0), int(y1) + 1):
            for x in range(int(x0), int(x1) + 1):
                s.px(x, y, c)

    def line(s, x0, y0, x1, y1, c, t=1):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for i in range(n + 1):
            x = x0 + (x1 - x0) * i / n
            y = y0 + (y1 - y0) * i / n
            for dx in range(t):
                for dy in range(t):
                    s.px(x + dx - (t - 1) / 2, y + dy - (t - 1) / 2, c)

    def outline(s, skip=('x', 'F')):
        add = []
        for y in range(H):
            for x in range(W):
                if s.g[y][x] is None:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        xx, yy = x + dx, y + dy
                        if 0 <= xx < W and 0 <= yy < H and s.g[yy][xx] not in (None, *skip):
                            add.append((x, y)); break
        for x, y in add:
            s.g[y][x] = 'k'

    def img(s):
        im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        for y in range(H):
            for x in range(W):
                if s.g[y][x]:
                    im.putpixel((x, y), PAL[s.g[y][x]] + (255,))
        return im


# ---------- 身体部件（相对坐标，面朝右） ----------
def head(c, dx, dy, face='n'):
    """圆脸、年轻；3/4 侧脸，能看到两只眼"""
    X, Y = OX + dx, BASE - 33 + dy
    rows = {1: (9, 15), 2: (8, 16), 3: (7, 17), 4: (7, 17), 5: (7, 17), 6: (7, 17), 7: (7, 17),
            8: (7, 17), 9: (7, 17), 10: (8, 16), 11: (9, 15), 12: (10, 14)}
    for yy, (x0, x1) in rows.items():
        c.rect(X + x0, Y + yy, X + x1, Y + yy, 's')
        c.px(X + x0, Y + yy, 'S')
    c.rect(X + 8, Y + 9, X + 9, Y + 10, 'S')
    # 蓬松短发 + 刘海
    for yy, (x0, x1) in {-1: (9, 15), 0: (7, 17), 1: (6, 17), 2: (6, 17), 3: (6, 17)}.items():
        c.rect(X + x0, Y + yy, X + x1, Y + yy, 'h')
    c.px(X + 11, Y - 2, 'h'); c.px(X + 14, Y - 2, 'h')
    c.rect(X + 6, Y + 4, X + 8, Y + 8, 'h')
    for x, l in ((9, 2), (10, 1), (12, 2), (13, 1), (15, 1), (16, 2), (17, 1)):
        c.rect(X + x, Y + 4, X + x, Y + 3 + l, 'h')
    c.rect(X + 10, Y + 0, X + 13, Y + 0, 'H')           # 头发高光
    c.rect(X + 9, Y + 7, X + 10, Y + 8, 'S')            # 耳朵（偏后）
    if face == 'hurt':
        for ex in (12, 15):
            c.px(X + ex, Y + 6, 'k'); c.px(X + ex + 1, Y + 7, 'k'); c.px(X + ex, Y + 8, 'k')
        c.rect(X + 14, Y + 10, X + 15, Y + 11, 'k')
    else:
        c.rect(X + 12, Y + 6, X + 12, Y + 8, 'k')       # 远侧眼（小）
        c.rect(X + 15, Y + 6, X + 16, Y + 8, 'k')       # 近侧眼（大）
        c.px(X + 15, Y + 6, 'w')                          # 高光
        c.px(X + 17, Y + 9, 'P'); c.px(X + 11, Y + 9, 'P')   # 腮红
        if face == 'yell':
            c.rect(X + 14, Y + 10, X + 15, Y + 11, 'k'); c.px(X + 14, Y + 11, 'r')
        else:
            c.rect(X + 14, Y + 10, X + 15, Y + 10, 'S')


def torso(c, dx, dy):
    X, Y = OX + dx, BASE - 20 + dy
    c.rect(X + 11, Y - 1, X + 14, Y, 'S')              # 脖子
    c.rect(X + 6, Y + 1, X + 18, Y + 9, 'T')            # 宽肩白T
    c.rect(X + 6, Y + 1, X + 8, Y + 9, 't')
    c.rect(X + 6, Y + 9, X + 18, Y + 9, 't')
    c.rect(X + 11, Y + 1, X + 14, Y + 1, 't'); c.px(X + 12, Y + 2, 't'); c.px(X + 13, Y + 2, 't')   # 圆领
    c.rect(X + 17, Y + 2, X + 18, Y + 8, 'w')           # 近侧受光
    c.rect(X + 7, Y + 10, X + 17, Y + 12, 'K')          # 黑短裤
    c.rect(X + 15, Y + 10, X + 17, Y + 10, 'J')


def leg(c, hip, foot, dy=0, lift=0, back=False):
    """hip/foot 为相对 x；从短裤下沿到脚底"""
    X = OX
    y0, y1 = BASE - 7 + dy, BASE - 2 - lift
    col = 'S' if back else 's'
    c.line(X + hip, y0 - 2, X + hip, y0, 'K', 3)        # 裤腿
    c.line(X + hip, y0 + 1, X + foot, y1, col, 3)
    c.rect(X + foot - 1, y1 + 1, X + foot + 2, y1 + 1, 'B')   # 草鞋
    c.rect(X + foot - 1, y1, X + foot + 2, y1, 'b')


def arm(c, sx, sy, hx, hy, back=False):
    """肩 → 手；袖子白色，肌肉手臂"""
    X, Y = OX, BASE - 20
    col = 'S' if back else 's'
    mx, my = sx + (hx - sx) * 0.35, sy + (hy - sy) * 0.35
    c.line(X + sx, Y + sy, X + hx, Y + hy, col, 3)
    c.line(X + sx, Y + sy, X + mx, Y + my, 't' if back else 'T', 3)
    c.rect(X + hx - 1, Y + hy - 1, X + hx + 1, Y + hy + 1, col)


def stick(c, hx, hy, ang, L=24, back=0.25):
    X, Y = OX, BASE - 20
    a = math.radians(ang)
    x0, y0 = X + hx - math.cos(a) * L * back, Y + hy + math.sin(a) * L * back
    x1, y1 = X + hx + math.cos(a) * L * (1 - back), Y + hy - math.sin(a) * L * (1 - back)
    c.line(x0, y0, x1, y1, 'b', 2)
    c.line(x0, y0, x1, y1, 'L', 1)
    return x1, y1


def machete(c, hx, hy, ang):
    X, Y = OX, BASE - 20
    a = math.radians(ang)
    ca, sa = math.cos(a), -math.sin(a)
    c.line(X + hx - ca * 2, Y + hy - sa * 2, X + hx + ca * 2, Y + hy + sa * 2, 'B', 2)     # 木柄
    bx, by = X + hx + ca * 3, Y + hy + sa * 3
    c.line(bx, by, bx + ca * 9, by + sa * 9, 'i', 3)                                        # 宽刀身
    c.line(bx + 1 - sa, by - ca, bx + ca * 9 - sa, by + sa * 9 - ca, 'I', 1)
    c.px(bx + ca * 10, by + sa * 10, 'i')


def swoosh(c, cx, cy, r, a0, a1, w=2):
    X, Y = OX, BASE - 20
    for i in range(60):
        a = math.radians(a0 + (a1 - a0) * i / 59)
        for k in range(w):
            c.px(X + cx + math.cos(a) * (r - k), Y + cy - math.sin(a) * (r - k), 'x')


def body(c, dy=0, face='n', lean=0):
    torso(c, lean, dy)
    head(c, lean + 1, dy, face)


# ---------- 动作帧 ----------
def frame(kind, i):
    c = C()
    if kind == 'idle':
        b = (0, 1)[i]
        arm(c, 7, 3 + b, 5, 10 + b, back=True)
        leg(c, 10, 9, back=True); leg(c, 15, 16)
        body(c, b)
        arm(c, 17, 3 + b, 19, 10 + b)
    elif kind == 'walk':
        sw = (4, 0, -4, 0)[i]; b = (0, 1, 0, 1)[i]
        arm(c, 7, 3 + b, 6 - sw // 2, 10 + b, back=True)
        leg(c, 11, 11 - sw, back=True, lift=1 if sw < 0 else 0)
        leg(c, 14, 14 + sw, lift=1 if sw > 0 else 0)
        body(c, b)
        arm(c, 17, 3 + b, 18 + sw // 2, 10 + b)
    elif kind == 'roll':
        X, Y = OX, BASE
        if i in (0, 4):   # 下蹲起跳 / 起身
            arm(c, 7, 7, 6, 13, back=True)
            leg(c, 10, 8, dy=3, back=True); leg(c, 15, 18, dy=3)
            body(c, 5, lean=2)
            arm(c, 17, 7, 21, 12)
        else:             # 抱团翻滚：缩成一团的小人整体旋转
            t = C(); cx, cy = 28, 22
            for y in range(-8, 9):
                for x in range(-9, 9):
                    if (x / 9) ** 2 + (y / 8) ** 2 <= 1:
                        t.px(cx + x, cy + y, 't' if y > 3 else 'T')
            t.rect(cx - 9, cy - 1, cx - 4, cy + 6, 'K')                 # 屁股/短裤
            t.rect(cx + 2, cy - 2, cx + 9, cy + 6, 's'); t.rect(cx + 2, cy - 3, cx + 9, cy - 1, 'h')   # 低头的脑袋
            t.px(cx + 7, cy + 2, 'k'); t.px(cx + 9, cy + 4, 's')
            t.line(cx - 4, cy + 7, cx + 3, cy + 8, 's', 2); t.rect(cx + 3, cy + 7, cx + 5, cy + 9, 'B')   # 收起的腿
            t.line(cx - 1, cy + 1, cx + 3, cy + 5, 's', 2)               # 抱膝的手
            t.outline()
            patch = t.img().crop((cx - 12, cy - 12, cx + 12, cy + 12)).rotate(-90 * (i - 1), Image.NEAREST)
            out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            px0 = X + 2 + i * 5
            out.paste(patch, (px0, Y - 22), patch)
            for k in range(i):   # 扬起的尘土
                for dx, dy, col in ((0, 0, 'L'), (1, 1, 'b'), (-1, 1, 'b')):
                    x, y = px0 - 2 - k * 4 + dx, Y - 3 - (k % 2) + dy
                    if 0 <= x < W: out.putpixel((x, y), PAL[col] + (255,))
            return out
    elif kind == 'hurt':
        arm(c, 7, 4, 2, 0, back=True)
        leg(c, 8, 6, back=True); leg(c, 13, 13)
        body(c, 1, 'hurt', lean=-3)
        arm(c, 14, 4, 20, -1)
    elif kind == 'down':
        X, Y = OX, BASE
        c.rect(X + 2, Y - 6, X + 12, Y - 1, 'T'); c.rect(X + 2, Y - 2, X + 12, Y - 1, 't')   # 躺倒的身体
        c.rect(X + 13, Y - 6, X + 16, Y - 1, 'K')
        c.line(X + 17, Y - 4, X + 25, Y - 3, 's', 3); c.rect(X + 25, Y - 5, X + 27, Y - 1, 'B')
        c.rect(X - 8, Y - 10, X + 0, Y - 1, 's'); c.rect(X - 9, Y - 9, X + 1, Y - 2, 's'); c.rect(X - 9, Y - 9, X - 7, Y - 2, 'h'); c.rect(X - 8, Y - 10, X - 7, Y - 1, 'h')
        c.px(X - 4, Y - 8, 'k'); c.px(X - 2, Y - 8, 'k'); c.px(X - 3, Y - 7, 'k'); c.px(X - 4, Y - 6, 'k'); c.px(X - 2, Y - 6, 'k')
        c.line(X + 4, Y - 7, X + 9, Y - 11, 's', 3)
        for k, (sx, sy) in enumerate(((-6, -14), (-3, -16), (0, -14))):   # 冒星星
            c.px(X + sx, Y + sy, 'p')
    elif kind == 'staff':   # 棍：蓄力 → 横扫 → 收势
        if i == 0:
            stick(c, 4, 0, 160, 26, 0.35)
            arm(c, 7, 3, 3, 2, back=True); leg(c, 9, 6, back=True); leg(c, 15, 18)
            body(c, 1, 'yell', lean=-2)
            arm(c, 15, 3, 5, 1)
        elif i == 1:
            arm(c, 7, 3, 16, 5, back=True); leg(c, 9, 5, back=True); leg(c, 16, 20)
            body(c, 2, 'yell', lean=2)
            arm(c, 18, 4, 23, 6); stick(c, 21, 6, 2, 28, 0.15)
            swoosh(c, 14, 6, 26, 140, 10, 3)
        else:
            arm(c, 7, 4, 15, 8, back=True); leg(c, 9, 6, back=True); leg(c, 16, 19)
            body(c, 2, 'n', lean=2)
            arm(c, 18, 4, 22, 9); stick(c, 20, 9, -25, 26, 0.2)
    elif kind == 'stone':   # 石子：后引 → 甩出 → 石子飞行
        if i == 0:
            arm(c, 17, 3, 21, 9, back=True); leg(c, 10, 8, back=True); leg(c, 15, 17)
            body(c, 1, 'n', lean=-2)
            arm(c, 9, 3, 2, -2); c.rect(OX + 1, BASE - 23, OX + 2, BASE - 22, 'i')
        elif i == 1:
            arm(c, 7, 3, 4, 9, back=True); leg(c, 9, 6, back=True); leg(c, 16, 20)
            body(c, 2, 'yell', lean=2)
            arm(c, 18, 3, 25, 1)
            c.rect(OX + 28, BASE - 20, OX + 29, BASE - 19, 'i'); c.px(OX + 29, BASE - 20, 'w')
        else:
            arm(c, 7, 3, 5, 10, back=True); leg(c, 9, 7, back=True); leg(c, 16, 19)
            body(c, 2, 'n', lean=2)
            arm(c, 18, 4, 23, 9)
            for k in range(3): c.px(OX + 30 + k * 2, BASE - 21, 'x')
            c.rect(OX + 37, BASE - 22, OX + 38, BASE - 21, 'i'); c.px(OX + 38, BASE - 22, 'w')
    elif kind == 'knife':   # 柴刀：举刀 → 下劈 → 回手反撩
        if i == 0:
            arm(c, 7, 3, 4, 9, back=True); leg(c, 10, 8, back=True); leg(c, 15, 17)
            body(c, 1, 'yell', lean=-1)
            arm(c, 16, 3, 15, -6); machete(c, 15, -6, 100)
        elif i == 1:
            arm(c, 7, 3, 6, 10, back=True); leg(c, 9, 6, back=True); leg(c, 16, 20)
            body(c, 2, 'yell', lean=2)
            arm(c, 18, 4, 23, 8); machete(c, 23, 8, -40)
            swoosh(c, 17, 4, 14, 95, -45, 2)
        else:
            arm(c, 7, 3, 6, 10, back=True); leg(c, 9, 7, back=True); leg(c, 15, 18)
            body(c, 1, 'n', lean=1)
            arm(c, 17, 4, 22, 2); machete(c, 22, 2, 30)
            swoosh(c, 15, 6, 13, -40, 50, 2)
    c.outline()
    return c.img()


ANIMS = [
    ('idle', 2, '站立'), ('walk', 4, '走路'), ('roll', 5, '翻滚闪避'),
    ('hurt', 1, '受击'), ('down', 1, '倒地'),
    ('staff', 3, '棍 · 横扫'), ('knife', 3, '柴刀 · 劈砍'), ('stone', 3, '石子 · 投掷'),
]

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
    f1, f2, f3 = (ImageFont.truetype(FONT, n, index=2) for n in (30, 18, 40))
    sc = 5
    cw, ch = W * sc + 20, H * sc + 70
    cols = 4
    top = 70
    GW, GH = cols * cw + 20, top + 2 * ch + 260
    BG, CELL = (30, 22, 48), (42, 32, 66)
    frames = {k: [frame(k, i) for i in range(n)] for k, n, _ in ANIMS}
    tao = taoist().img()

    def compose(t):
        im = Image.new('RGB', (GW, GH), BG); d = ImageDraw.Draw(im)
        d.text((20, 18), '穿越农民 · 像素主角预览 v2（圆脸 · 3/4 侧身）', font=f3, fill=(244, 214, 110))
        for n, (k, cnt, name) in enumerate(ANIMS):
            x0 = 20 + (n % cols) * cw; y0 = top + (n // cols) * ch
            d.rectangle([x0, y0, x0 + cw - 20, y0 + ch - 20], fill=CELL)
            fr = frames[k][(t // (3 if k == 'roll' else 4)) % cnt]
            big = fr.resize((W * sc, H * sc), Image.NEAREST)
            d.ellipse([x0 + OX * sc + 20, y0 + BASE * sc - 12, x0 + OX * sc + 120, y0 + BASE * sc + 6], fill=(22, 14, 34))
            im.paste(big, (x0, y0), big)
            d.text((x0 + (cw - 20) // 2, y0 + ch - 42), f'{name}（{cnt}帧）', font=f1, fill=(244, 214, 110), anchor='mm')
        # 比例对照：原尺寸 ×2，与原版道长并排
        y0 = top + 2 * ch
        d.rectangle([20, y0, GW - 20, GH - 20], fill=CELL)
        d.text((40, y0 + 22), '比例对照（同一倍率）：原版道长  vs  农民', font=f2, fill=(200, 190, 225))
        s2 = 4
        T = tao.resize((tao.width * s2, tao.height * s2), Image.NEAREST)
        fy = GH - 50
        im.paste(T, (90, fy - 36 * s2), T)
        Fm = frames['walk'][(t // 4) % 4]
        F2 = Fm.resize((W * s2, H * s2), Image.NEAREST)
        im.paste(F2, (300 - OX * s2, fy - 41 * s2), F2)
        d.text((560, GH - 150), '原尺寸：', font=f2, fill=(200, 190, 225))
        im.paste(tao, (660, fy - 36), tao)
        im.paste(Fm, (700 - OX, fy - 41), Fm)
        return im

    gif = [compose(t) for t in range(24)]
    gif[0].save(os.path.join(OUT, 'farmer_preview.gif'), save_all=True, append_images=gif[1:], duration=60, loop=0, disposal=2)
    gif[0].save(os.path.join(OUT, 'farmer_still.png'))
    # 单帧素材表（原尺寸，供游戏使用）
    allf = [f for k, n, _ in ANIMS for f in frames[k]]
    sheet = Image.new('RGBA', (W * len(allf), H), (0, 0, 0, 0))
    for i, f in enumerate(allf): sheet.paste(f, (i * W, 0), f)
    sheet.save(os.path.join(OUT, 'farmer_sheet.png'))
    print('ok', GW, GH)
