# 登录页背景图预处理：去掉电视屏幕四周那圈绿边（原图绿幕的抗锯齿过渡）。
#
# 做法：自动量出绿幕矩形 → 取「外扩 6px」到「内缩 2px」之间的这一圈像素，
# 只要绿色通道明显高于红蓝（G > max(R,B) + 10）就把 G 压到 max(R,B) + 4
# （和 tools/split_props.py 的去绿边规则一致），画面其他地方一个像素都不动。
#
# 用法：python tools/fix_title_green.py
#   art/title/home.png（源图，不改） → art/title/home_fixed.png（检查用）+ art/title/home.webp（打包用）
# 换登录页图时：替换 home.png 后跑这个脚本，再把打印出来的 TV 比例更新到 js/title.js 顶部。
import json
import os
from PIL import Image

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(R, 'art', 'title', 'home.png')
OUT_PNG = os.path.join(R, 'art', 'title', 'home_fixed.png')
OUT_WEBP = os.path.join(R, 'art', 'title', 'home.webp')

EXPAND = 10    # 屏幕矩形向外扩多少像素（这一圈要处理）
# 实测：绿幕的绿边延伸到 6px，但电视外壳本身也带一点墨绿，8~10px 还有零星绿像素；
# 再往外 26px 起是房间里的绿植，绝对不能碰，所以 10 是安全上限。
INSET = 12      # 向内处理多少像素：WebP 的色度抽样会把屏幕内部的绿"渗"回边缘，
               # 所以内侧也要压一段（屏幕内部会被演示画面盖住，不影响观感）


def green_box(im):
    """量出绿幕矩形：取所有"明显偏绿"像素的包围盒"""
    W, H = im.size
    px = im.load()
    xs, ys = [], []
    for y in range(H):
        for x in range(W):
            r, g, b = px[x, y]
            if g > 90 and g - max(r, b) > 35:
                xs.append(x); ys.append(y)
    if not xs:
        raise SystemExit('没找到绿幕，检查一下原图')
    return min(xs), min(ys), max(xs), max(ys)


def main():
    im = Image.open(SRC).convert('RGB')
    W, H = im.size
    x0, y0, x1, y1 = green_box(im)
    print('绿幕矩形: (%d,%d)-(%d,%d)  尺寸 %dx%d' % (x0, y0, x1, y1, x1 - x0, y1 - y0))
    print('TV 比例（js/title.js）: x=%.4f y=%.4f w=%.4f h=%.4f'
          % (x0 / W, y0 / H, (x1 - x0) / W, (y1 - y0) / H))

    px = im.load()
    ox0, oy0 = x0 - EXPAND, y0 - EXPAND           # 外圈
    ox1, oy1 = x1 + EXPAND, y1 + EXPAND
    ix0, iy0 = x0 + INSET, y0 + INSET             # 内圈（这之内不处理）
    ix1, iy1 = x1 - INSET, y1 - INSET
    fixed = 0
    for y in range(max(0, oy0), min(H, oy1 + 1)):
        for x in range(max(0, ox0), min(W, ox1 + 1)):
            if ix0 <= x <= ix1 and iy0 <= y <= iy1:
                continue                           # 屏幕内部，跳过
            r, g, b = px[x, y]
            if g > max(r, b) + 10:                 # 明显偏绿 → 压下去
                px[x, y] = (r, max(r, b) + 4, b)
                fixed += 1
    print('处理了 %d 个绿像素（外扩 %d、内缩 %d 的那一圈）' % (fixed, EXPAND, INSET))

    im.save(OUT_PNG)
    im.save(OUT_WEBP, 'WEBP', quality=90, method=6)
    print('输出: %s (%.0f KB) / %s (%.0f KB)'
          % (os.path.basename(OUT_PNG), os.path.getsize(OUT_PNG) / 1024,
             os.path.basename(OUT_WEBP), os.path.getsize(OUT_WEBP) / 1024))


if __name__ == '__main__':
    main()
