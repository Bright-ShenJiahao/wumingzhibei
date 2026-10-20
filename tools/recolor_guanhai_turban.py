"""把管亥的头巾改成黄巾色（黄巾头目应该是黄头巾）。

原图里头巾本来就是黄的，是缩成 64 色像素图时被调色板冲淡成了米黄，所以在成品精灵上改色。
颜色取自黄巾兵（art/sprites/grunt）的头巾，保证是同一个黄系。

- 地面帧（art/sprites/guanhai/）：头巾主体是 #d1c261（已逐帧确认不含腰带/护甲），整色换成中黄；
  紧贴它的高光 #d7dbab、阴影 #ada878 一并提纯（只改与头巾相连的那一圈，不会碰到长戟刀刃）。
- 骑马帧（art/sprites/guanhai_horse/）：同样的浅色也被刀刃用着，只改"骑手头部"区域里的小连通块。

用法：python tools/recolor_guanhai_turban.py（可重复执行，已经是黄色的会被跳过）
"""
import glob, os
from collections import deque
from PIL import Image

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SP = lambda *p: os.path.join(R, 'art', 'sprites', *p)

MID = (0xee, 0xbd, 0x1e)      # 中黄（头巾主体）
LIGHT = (0xf6, 0xcb, 0x01)    # 高光，取黄巾兵头巾的亮黄
DARK = (0xc9, 0x92, 0x1a)     # 阴影

GROUND_MAIN = (0xd1, 0xc2, 0x61)
GROUND_LIGHT = (0xd7, 0xdb, 0xab)
GROUND_DARK = (0xad, 0xa8, 0x78)
HORSE_MAIN = (0xd8, 0xd9, 0xa2)
YELLOWED = {MID, LIGHT, DARK}


def comps(im, color):
    w, h = im.size
    px = im.load()
    seen, out = set(), []
    for y in range(h):
        for x in range(w):
            if (x, y) in seen: continue
            p = px[x, y]
            if not (p[3] > 200 and tuple(p[:3]) == color): continue
            q, blob = deque([(x, y)]), []
            seen.add((x, y))
            while q:
                cx, cy = q.popleft()
                blob.append((cx, cy))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in seen:
                            pp = px[nx, ny]
                            if pp[3] > 200 and tuple(pp[:3]) == color:
                                seen.add((nx, ny)); q.append((nx, ny))
            out.append(blob)
    return out


def grow_from(im, base_mask, color, rounds=2):
    """把紧贴 base_mask 的 color 像素圈进来（避免误伤远处同色像素）"""
    w, h = im.size
    px = im.load()
    cur = set(base_mask)
    for _ in range(rounds):
        add = set()
        for (x, y) in cur:
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    nx, ny = x + dx, y + dy
                    if not (0 <= nx < w and 0 <= ny < h) or (nx, ny) in cur: continue
                    p = px[nx, ny]
                    if p[3] > 200 and tuple(p[:3]) == color:
                        add.add((nx, ny))
        cur |= add
        if not add: break
    return cur


def do_ground():
    files = 0; px_count = 0
    for f in sorted(glob.glob(SP('guanhai', '*.png'))):
        im = Image.open(f).convert('RGBA')
        px = im.load()
        main = set()
        for y in range(im.height):
            for x in range(im.width):
                p = px[x, y]
                if p[3] > 200 and tuple(p[:3]) == GROUND_MAIN:
                    main.add((x, y))
        if not main:
            continue
        hi = grow_from(im, main, GROUND_LIGHT, 2)
        lo = grow_from(im, main, GROUND_DARK, 1)
        for (x, y) in main: px[x, y] = MID + (255,)
        for (x, y) in hi - main: px[x, y] = LIGHT + (255,)
        for (x, y) in lo - main: px[x, y] = DARK + (255,)
        im.save(f); files += 1; px_count += len(main)
    print('地面帧：改了 %d 帧（头巾主体 %d 像素）' % (files, px_count))


def do_horse():
    files = 0
    for f in sorted(glob.glob(SP('guanhai_horse', '*.png'))):
        im = Image.open(f).convert('RGBA')
        px = im.load()
        hit = 0
        for blob in comps(im, HORSE_MAIN):
            xs = [p[0] for p in blob]; ys = [p[1] for p in blob]
            cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
            # 骑手头部：画面左侧靠上；刀刃在右侧（x>115），腰带/马具在下（y>32）
            if len(blob) <= 30 and cx < 115 and cy < 32:
                for (x, y) in blob: px[x, y] = MID + (255,)
                hit += len(blob)
        if hit:
            im.save(f); files += 1
    print('骑马帧：改了 %d 帧' % files)


if __name__ == '__main__':
    do_ground()
    do_horse()
