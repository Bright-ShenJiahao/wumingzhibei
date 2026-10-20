"""新版像素人物（敦实"热血"比例：大方头、宽身、短腿、身体朝向镜头、三层明暗、深色描边）
画布 48×58，脚底中心在 (24, 54)。光源左上，暗部在右下。
用法：python3 tools/chunky.py <输出目录>"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

W, H = 48, 58
OY = 4          # 整体下移，给头顶留出描边空间
FOOT = (24, 54)

# 每种材质三层：亮 / 中 / 暗
MAT = {
    'skin':  ((255, 214, 170), (240, 180, 130), (196, 128, 86)),
    'tan':   ((236, 184, 132), (208, 148, 98), (160, 100, 62)),
    'hairK': ((70, 64, 86), (40, 36, 52), (22, 18, 30)),
    'hairB': ((150, 96, 52), (112, 68, 36), (74, 42, 22)),
    'white': ((255, 255, 255), (232, 234, 240), (182, 188, 204)),
    'black': ((76, 74, 88), (46, 44, 56), (26, 24, 34)),
    'grey':  ((176, 172, 162), (138, 134, 126), (96, 92, 90)),
    'dgrey': ((120, 116, 118), (86, 82, 86), (58, 54, 60)),
    'yel':   ((255, 226, 96), (240, 188, 40), (186, 128, 24)),
    'sand':  ((176, 112, 60), (134, 80, 42), (92, 52, 26)),
    'wrap':  ((232, 222, 196), (200, 188, 160), (156, 142, 118)),
    'wood':  ((178, 124, 70), (138, 90, 48), (96, 60, 30)),
}
EYE, EYEW, MOUTH, BLUSH = (30, 24, 40), (255, 255, 255), (150, 50, 50), (250, 150, 140)


class Spr:
    def __init__(s):
        s.c = [[None] * W for _ in range(H)]   # (rgb, matkey)

    def px(s, x, y, col, mat=None):
        y += OY
        if 0 <= x < W and 0 <= y < H: s.c[y][x] = (col, mat)

    def shade_rect(s, x0, y0, x1, y1, mat, r=0, light='tl'):
        """带圆角的块，左上亮、右下暗"""
        hi, mid, lo = MAT[mat]
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                dx = min(x - x0, x1 - x); dy = min(y - y0, y1 - y)
                if r and dx < r and dy < r and (r - dx - .5) ** 2 + (r - dy - .5) ** 2 > r * r: continue
                col = mid
                if x - x0 <= 1 or y - y0 <= 0: col = hi
                if x1 - x <= 1 or y1 - y <= 0: col = lo
                s.px(x, y, col, mat)

    def fill(s, pts, mat, tone=1):
        for x, y in pts: s.px(x, y, MAT[mat][tone], mat)

    def hline(s, x0, x1, y, mat, tone=1):
        for x in range(x0, x1 + 1): s.px(x, y, MAT[mat][tone], mat)

    def outline(s):
        add = []
        for y in range(H):
            for x in range(W):
                if s.c[y][x] is None:
                    for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        xx, yy = x + dx, y + dy
                        if 0 <= xx < W and 0 <= yy < H and s.c[yy][xx]:
                            col, mat = s.c[yy][xx]
                            base = MAT[mat][2] if mat else col
                            add.append((x, y, tuple(int(v * .42) for v in base))); break
        for x, y, col in add: s.c[y][x] = (col, None)

    def img(s):
        im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        for y in range(H):
            for x in range(W):
                if s.c[y][x]: im.putpixel((x, y), s.c[y][x][0] + (255,))
        return im


def body(s, skin, top, shorts, legs, shoes, hair, headband=False, pads=False, belt=None, bob=0):
    b = bob
    # 腿（短粗）+ 鞋
    for lx in (15, 26):
        s.shade_rect(lx, 41 + b, lx + 6, 47, legs)
        s.shade_rect(lx - 1, 48, lx + 7, 50, shoes, r=1)
    # 下装
    s.shade_rect(13, 36 + b, 34, 42 + b, shorts, r=1)
    s.hline(23, 24, 39 + b, shorts, 2); s.hline(23, 24, 40 + b, shorts, 2); s.hline(23, 24, 41 + b, shorts, 2)
    # 远侧手臂（右后，被身体挡一部分）
    s.shade_rect(33, 25 + b, 38, 32 + b, top if pads is False else 'dgrey', r=2)
    s.shade_rect(31, 30 + b, 37, 35 + b, skin, r=2)             # 远侧拳头
    # 躯干（宽）
    s.shade_rect(11, 23 + b, 35, 37 + b, top, r=3)
    if belt:
        s.shade_rect(11, 34 + b, 35, 36 + b, belt)
        s.shade_rect(21, 33 + b, 26, 37 + b, belt, r=1); s.fill([(23, 35 + b), (24, 35 + b)], belt, 2)
    if pads:   # 护肩 + 交领
        s.shade_rect(8, 22 + b, 17, 28 + b, 'dgrey', r=3); s.shade_rect(29, 22 + b, 38, 28 + b, 'dgrey', r=3)
        for k in range(7): s.px(18 + k, 24 + b + k, MAT[top][2], top); s.px(29 - k, 24 + b + k, MAT[top][2], top)
    else:      # T恤圆领
        s.hline(19, 28, 23 + b, skin, 1); s.hline(20, 27, 24 + b, skin, 2)
        s.shade_rect(8, 23 + b, 14, 29 + b, top, r=2)            # 近侧袖子
    # 近侧手臂：弯曲护在胸前
    s.shade_rect(9, 28 + b, 14, 34 + b, skin, r=2)
    s.shade_rect(13, 30 + b, 21, 35 + b, skin, r=2)              # 近侧拳头
    s.fill([(15, 31 + b), (17, 31 + b), (19, 31 + b)], skin, 2)
    # 头（大方头，略圆角）
    s.shade_rect(12, 3 + b, 36, 23 + b, skin, r=4)
    s.fill([(12, y) for y in range(12 + b, 16 + b)], skin, 2)     # 左耳
    # 头发
    if hair == 'hairK':   # 主角：黑色蓬松短发 + 刘海
        s.shade_rect(11, 0 + b, 37, 8 + b, hair, r=4)
        for x, d in ((13, 4), (14, 5), (16, 3), (19, 4), (20, 2), (23, 4), (26, 3), (27, 5), (30, 3), (33, 4), (35, 6), (36, 7)):
            for k in range(d): s.px(x, 9 + b + k - 1, MAT[hair][1 if k < d - 1 else 2], hair)
        s.shade_rect(11, 5 + b, 14, 14 + b, hair, r=1)
        for x in (15, 21, 28): s.px(x, 0 + b, MAT[hair][0], hair)
    else:                 # 黄巾兵：棕色乱发
        s.shade_rect(11, 0 + b, 37, 7 + b, hair, r=3)
        for x in (12, 16, 21, 25, 30, 35): s.px(x, -1 + b + 1, MAT[hair][0], hair); s.px(x + 1, 0 + b, MAT[hair][0], hair)
        s.shade_rect(11, 6 + b, 13, 12 + b, hair)
    if headband:
        s.shade_rect(11, 6 + b, 37, 9 + b, 'yel')
        for k in range(6):                                          # 脑后飘带
            s.px(10 - k // 2, 8 + b + k, MAT['yel'][1], 'yel'); s.px(9 - k // 2, 9 + b + k, MAT['yel'][2], 'yel')


def face(s, kind, bob=0):
    b = bob
    if kind == 'hero':   # 年轻、大眼
        for x0, x1 in ((19, 22), (27, 31)): s.hline(x0, x1, 11 + b, 'hairK', 1)          # 眉
        for ex, w in ((20, 2), (28, 3)):
            for y in range(13 + b, 17 + b):
                for x in range(ex, ex + w): s.px(x, y, EYE)
            s.px(ex, 13 + b, EYEW)
        s.fill([(18, 18 + b), (19, 18 + b), (32, 18 + b), (33, 18 + b)], 'skin', 0)
        for p in ((18, 18 + b), (19, 18 + b), (32, 18 + b)): s.px(*p, BLUSH)
        s.hline(25, 28, 20 + b, 'skin', 2); s.px(26, 20 + b, MOUTH); s.px(27, 20 + b, MOUTH)
        s.fill([(33, 14 + b), (34, 15 + b)], 'skin', 2)                                  # 鼻
    else:                # 黄巾兵：凶眉、小眼、胡茬、咧嘴
        for k in range(4): s.px(18 + k, 10 + b + k // 2, EYE); s.px(32 - k, 10 + b + k // 2, EYE)
        s.hline(17, 21, 10 + b, 'hairB', 2); s.hline(29, 33, 10 + b, 'hairB', 2)
        for ex in (20, 28):
            for y in range(13 + b, 16 + b): s.px(ex, y, EYE); s.px(ex + 1, y, EYE)
        for x in range(17, 34):
            for y in range(18 + b, 23 + b):
                if (x + y) % 2 == 0: s.px(x, y, MAT['tan'][2], 'tan')
        s.hline(22, 29, 19 + b, 'tan', 2); s.hline(23, 28, 20 + b, 'tan', 2)
        for x in range(23, 29): s.px(x, 20 + b, (255, 250, 240))
        s.hline(23, 28, 21 + b, 'tan', 2)
        s.fill([(33, 14 + b), (34, 15 + b), (33, 16 + b)], 'tan', 2)


def hero(bob=0):
    s = Spr()
    body(s, 'skin', 'white', 'black', 'skin', 'sand', 'hairK', bob=bob)
    face(s, 'hero', bob)
    s.outline(); return s.img()


def grunt(bob=0):
    s = Spr()
    # 木棍扛在近侧肩后
    for k in range(20):
        x, y = 15 - k // 3, 34 - k
        for t in range(3): s.px(x + t, y + bob, MAT['wood'][min(2, t)], 'wood')
    s.shade_rect(4, 9 + bob, 10, 15 + bob, 'wood', r=2)
    body(s, 'tan', 'grey', 'dgrey', 'wrap', 'sand', 'hairB', headband=True, pads=True, belt='yel', bob=bob)
    face(s, 'grunt', bob)
    s.outline(); return s.img()


if __name__ == '__main__':
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    for name, f in (('hero', hero), ('grunt', grunt)):
        for i in (0, 1): f(i).save(os.path.join(out, f'chunky_{name}_{i}.png'))
    print('ok')
