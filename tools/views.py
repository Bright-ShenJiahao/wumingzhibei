"""两种视角对比示意图（白底）"""
import sys, os, math
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))
SRC, OUT = sys.argv[1], sys.argv[2]
sys.argv = ['x', SRC, OUT]
g = {'__name__': 'lib'}
exec(open(os.path.join(HERE, 'farmer.py')).read(), g)
frame, OX, BASE, Wd, Hd, zombie = g['frame'], g['OX'], g['BASE'], g['W'], g['H'], g['g']['zombie']

FONT = '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'
F = lambda n: ImageFont.truetype(FONT, n, index=2)
f_t, f_h, f_b, f_s = F(40), F(28), F(22), F(18)
INK, SUB, LINE = (34, 30, 44), (110, 104, 124), (190, 186, 200)
ACC = (214, 70, 50)

W, H = 1500, 1080
im = Image.new('RGB', (W, H), 'white'); d = ImageDraw.Draw(im)
d.text((40, 26), '两种俯视角的区别', font=f_t, fill=INK)

hero = frame('walk', 1)
zom = zombie().img()


def put(sp, x, footy, sc, flip=False, shadow=True):
    """把精灵按脚底贴到 (x, footy)"""
    if flip: sp = sp.transpose(Image.FLIP_LEFT_RIGHT)
    big = sp.resize((sp.width * sc, sp.height * sc), Image.NEAREST)
    bb = sp.getbbox(); bottom = bb[3]
    cx = (bb[0] + bb[2]) / 2
    if shadow:
        d.ellipse([x - 9 * sc, footy - 2 * sc, x + 9 * sc, footy + 2 * sc], fill=(170, 160, 150))
    im.paste(big, (int(x - cx * sc), int(footy - bottom * sc)), big)


def arrow(x0, y0, x1, y1, col=ACC, w=5):
    d.line([x0, y0, x1, y1], fill=col, width=w)
    a = math.atan2(y1 - y0, x1 - x0)
    for s in (2.6, -2.6):
        d.line([x1, y1, x1 - 18 * math.cos(a + s * 0.2), y1 - 18 * math.sin(a + s * 0.2)], fill=col, width=w)


def camera(x, y, ang):
    """小摄像机 + 视线锥，ang 为向下俯角"""
    a = math.radians(ang)
    d.rounded_rectangle([x - 26, y - 16, x + 26, y + 16], 6, fill=INK)
    d.ellipse([x + 10, y - 9, x + 28, y + 9], fill=(120, 120, 140))
    return a


# ---------- 左右两栏 ----------
cols = [(40, 'A  斜俯视（清版）', '三国战纪 / 吞食天地 —— 本作采用', True),
        (770, 'B  正上方俯视', '暂时停止呼吸（割草版）', False)]
for x0, title, sub, belt in cols:
    pw = 690
    d.rounded_rectangle([x0, 90, x0 + pw, H - 40], 18, outline=ACC if belt else LINE, width=4 if belt else 2)
    d.text((x0 + 24, 106), title, font=f_h, fill=ACC if belt else INK)
    d.text((x0 + 24, 146), sub, font=f_b, fill=SUB)

    # —— ① 侧面剖视：镜头角度 ——
    d.text((x0 + 24, 196), '① 镜头怎么看（侧面剖视）', font=f_b, fill=INK)
    gy = 380
    d.line([x0 + 60, gy, x0 + pw - 60, gy], fill=INK, width=4)
    for k in range(x0 + 70, x0 + pw - 60, 22):
        d.line([k, gy, k - 12, gy + 12], fill=LINE, width=2)
    cx, cy = (x0 + 150, 250) if belt else (x0 + pw // 2, 248)
    if belt:
        tx = x0 + 470
        d.polygon([(cx, cy), (x0 + 330, gy), (x0 + 610, gy)], fill=(255, 232, 224))
        d.line([cx, cy, tx, gy], fill=ACC, width=3)
        camera(cx, cy, 30)
        d.arc([cx - 70, cy - 70, cx + 70, cy + 70], 0, 22, fill=ACC, width=3)
        d.text((cx + 80, cy - 12), '约 30°–45°', font=f_s, fill=ACC)
        put(hero, tx - 40, gy, 2, shadow=False)
        d.text((x0 + 60, gy + 22), '镜头在前上方斜着看：既看到地面，也看到人和房子的正面', font=f_s, fill=SUB)
    else:
        d.polygon([(cx, cy), (cx - 170, gy), (cx + 170, gy)], fill=(236, 236, 244))
        d.line([cx, cy, cx, gy], fill=INK, width=3)
        d.rounded_rectangle([cx - 16, cy - 26, cx + 16, cy + 26], 6, fill=INK)
        d.ellipse([cx - 9, cy + 10, cx + 9, cy + 28], fill=(120, 120, 140))
        d.text((cx + 22, cy - 10), '90°', font=f_s, fill=INK)
        put(hero, cx + 70, gy, 2, shadow=False)
        d.text((x0 + 60, gy + 22), '镜头在正上方往下看：主要看到地面和屋顶', font=f_s, fill=SUB)

    # —— ② 玩家看到的画面 ——
    d.text((x0 + 24, 450), '② 玩家看到的画面', font=f_b, fill=INK)
    sx, sy, sw, sh = x0 + 40, 490, pw - 80, 360
    d.rectangle([sx, sy, sx + sw, sy + sh], outline=INK, width=3)
    if belt:
        hz = sy + 150   # 地面与背景交界
        d.rectangle([sx + 3, sy + 3, sx + sw - 3, hz], fill=(238, 242, 250))
        for i, hx in enumerate(range(sx + 30, sx + sw - 80, 150)):   # 立着的房子（看到正面）
            d.rectangle([hx, hz - 70, hx + 110, hz], fill=(226, 214, 196), outline=INK, width=2)
            d.polygon([(hx - 12, hz - 70), (hx + 55, hz - 112), (hx + 122, hz - 70)], fill=(200, 180, 140), outline=INK)
            d.rectangle([hx + 44, hz - 40, hx + 66, hz], fill=(150, 120, 90))
        d.rectangle([sx + 3, hz, sx + sw - 3, sy + sh - 3], fill=(244, 236, 222))
        for k, yy in enumerate((hz + 30, hz + 70, hz + 120, hz + 180)):   # 纵深线：越近越疏
            if yy < sy + sh: d.line([sx + 3, yy, sx + sw - 3, yy], fill=(222, 208, 186), width=2)
        put(hero, sx + 200, hz + 85, 2)      # 后面一条线（稍小）
        put(hero, sx + 330, hz + 175, 3)     # 前面一条线
        put(zom, sx + 520, hz + 140, 3, flip=True)
        arrow(sx + 400, hz + 150, sx + 480, hz + 150); arrow(sx + 260, hz + 150, sx + 180, hz + 150)
        arrow(sx + 40, hz + 170, sx + 40, hz + 30, w=4); arrow(sx + 40, hz + 30, sx + 40, hz + 172, w=4)
        d.text((sx + 56, hz + 80), '上下：换线\n（范围窄）', font=f_s, fill=ACC)
        d.text((sx + sw - 170, sy + 12), '只向右卷动 →', font=f_s, fill=ACC)
    else:
        d.rectangle([sx + 3, sy + 3, sx + sw - 3, sy + sh - 3], fill=(232, 240, 226))
        for xx in range(sx, sx + sw, 40): d.line([xx, sy + 3, xx, sy + sh - 3], fill=(214, 226, 206))
        for yy in range(sy, sy + sh, 40): d.line([sx + 3, yy, sx + sw - 3, yy], fill=(214, 226, 206))
        for hx, hy in ((sx + 40, sy + 30), (sx + sw - 150, sy + 40), (sx + 60, sy + sh - 110)):   # 只看到屋顶
            d.rectangle([hx, hy, hx + 100, hy + 70], fill=(200, 180, 140), outline=INK, width=2)
            d.line([hx, hy + 35, hx + 100, hy + 35], fill=INK, width=2)
        mx, my = sx + sw // 2, sy + sh // 2 + 40
        for k in range(8):   # 敌人从四周包围
            a = k * math.pi / 4 + 0.3
            put(zom, mx + math.cos(a) * 150, my + math.sin(a) * 110, 2, flip=math.cos(a) > 0)
        put(hero, mx, my, 2)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            arrow(mx + dx * 40, my - 20 + dy * 40, mx + dx * 85, my - 20 + dy * 85, w=4)
        d.text((sx + sw - 220, sy + 12), '上下左右都能卷动', font=f_s, fill=ACC)

    # —— ③ 要点 ——
    pts = (['• 背景房子是立着的，看得到门窗', '• 地面是一条长带，主要往右推进', '• 敌人从左右两边来，适合近战连招']
           if belt else
           ['• 只看到屋顶和地面，地图四面延伸', '• 可以往任何方向走，镜头跟着人', '• 敌人从四周包围，适合割草'])
    for i, t in enumerate(pts):
        d.text((x0 + 40, 872 + i * 34), t, font=f_b, fill=INK)

d.text((40, H - 34), '注：两种视角的人物都是侧身像素画，区别在镜头角度、地面和地图走向。', font=f_s, fill=SUB)
im.save(OUT)
print('ok')
