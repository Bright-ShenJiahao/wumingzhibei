# 登录页电视屏幕：生成"绿幕遮罩"，让游戏演示只在绿幕区域显示。
#
# 为什么要遮罩：电视在画里是带透视的，屏幕不是正矩形；而且布偶猫的爪子垂在屏幕上，
# 用矩形去贴永远对不齐、还会盖住猫爪。改成"只显示绿幕像素"后：
#   - 猫爪、电视边框不是绿色 → 自动留在游戏画面之上；
#   - 透视形状由遮罩本身决定 → 四角天然吻合。
#
# 输出：
#   art/title/tv_mask.png   同尺寸遮罩（绿幕处不透明，其余透明，边缘 1 像素羽化）
#   art/title/home.webp     去绿后的背景（打包用）
# 同时打印绿幕外接矩形（比例形式），用来给 js/title.js 定位离屏画布。
#
# 用法：python tools/make_tv_mask.py
import os
import numpy as np
from PIL import Image, ImageFilter

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(R, 'art', 'title', 'home.png')
OUT_MASK = os.path.join(R, 'art', 'title', 'tv_mask.png')
OUT_WEBP = os.path.join(R, 'art', 'title', 'home.webp')

RING = 6        # 绿幕周围多少像素内的过渡绿要压掉
FEATHER = 1     # 遮罩边缘羽化半径（像素）


def main():
    im = Image.open(SRC).convert('RGB')
    W, H = im.size
    a = np.asarray(im).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]

    # 1) 绿幕像素：G 明显高于红蓝，且够亮
    m = (g > np.maximum(r, b) + 40) & (g > 150)
    ys, xs = np.nonzero(m)
    if len(xs) == 0:
        raise SystemExit('没找到绿幕，检查原图')
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    print('绿幕像素 %d 个，外接矩形 (%d,%d)-(%d,%d)  %dx%d'
          % (len(xs), x0, y0, x1, y1, x1 - x0 + 1, y1 - y0 + 1))
    print('js/title.js 用的比例: x=%.4f y=%.4f w=%.4f h=%.4f'
          % (x0 / W, y0 / H, (x1 - x0 + 1) / W, (y1 - y0 + 1) / H))

    # 2) 遮罩：绿幕处不透明，边缘羽化 1 像素
    mask = (m * 255).astype('uint8')
    mask_im = Image.fromarray(mask, 'L').filter(ImageFilter.GaussianBlur(FEATHER))
    alpha = np.asarray(mask_im).astype('uint8')
    mask_rgba = Image.merge('RGBA', [Image.new('L', (W, H), 255)] * 3 + [mask_im])
    mask_rgba.save(OUT_MASK)
    print('遮罩已写入 %s (%.0f KB)' % (os.path.basename(OUT_MASK), os.path.getsize(OUT_MASK) / 1024))

    # 3) 去绿：绿幕外一圈（6 像素内）的过渡绿压掉，G 降到 max(R,B)+4
    from PIL import ImageFilter as _F
    grow = np.asarray(Image.fromarray((m * 255).astype('uint8')).filter(_F.MaxFilter(RING * 2 + 1))) > 0
    greenish = (g > np.maximum(r, b) + 10)
    # 注意：这里是 grow（含遮罩内部）而不是只取外圈 —— 遮罩边缘羽化后是半透明，
    # 底下的绿会透出来一条绿线；内部反正被演示画面完全盖住，一起去绿最省事。
    fix = grow & greenish
    out = a.copy()
    cap = np.maximum(r, b) + 4
    out[..., 1] = np.where(fix, cap, g)
    fixed = int(fix.sum())
    print('去绿：%d 个像素（绿幕内部 + 外侧 %d 像素内）' % (fixed, RING))

    # 4) 导出背景（打包用）
    Image.fromarray(out.clip(0, 255).astype('uint8')).save(OUT_WEBP, 'WEBP', quality=90, method=6)
    print('背景已写入 %s (%.0f KB)' % (os.path.basename(OUT_WEBP), os.path.getsize(OUT_WEBP) / 1024))


if __name__ == '__main__':
    main()
