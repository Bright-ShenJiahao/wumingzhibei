# 生成旗手扛的大旗（像素风，写「黄天当立」）。
# 用法：python tools/make_props.py   （会覆盖 art/props/banner.png，并更新 meta.json）
import json, os
from PIL import Image, ImageDraw, ImageFont

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(R, 'art', 'props')


def cjk(size):
    for p in ('C:/Windows/Fonts/msyhbd.ttc', 'C:/Windows/Fonts/msyh.ttc', 'C:/Windows/Fonts/simsun.ttc'):
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


def banner():
    """48x120：长杆 + 竖幅，两列两行写「黄天当立」"""
    W, H = 48, 120
    im = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # 杆
    for y in range(2, H - 2):
        d.point((7, y), (74, 52, 24, 255))
        d.point((8, y), (58, 40, 18, 255))
        d.point((9, y), (110, 78, 36, 255))
    # 杆头（铜帽）
    d.rectangle([5, 1, 10, 4], fill=(201, 162, 39, 255))
    d.rectangle([5, 1, 10, 1], fill=(255, 216, 110, 255))
    # 幅面（两块布，做出随风起伏）
    cloth = [(11, 8, 46, 66), (12, 66, 45, 78)]
    for (x0, y0, x1, y1) in cloth:
        d.rectangle([x0, y0, x1, y1], fill=(201, 162, 42, 255))
        d.rectangle([x0, y0, x1, y0], fill=(232, 199, 96, 255))      # 上沿亮
        d.rectangle([x0, y1, x1, y1], fill=(125, 99, 22, 255))       # 下沿暗
        d.line([(x1, y0), (x1, y1)], fill=(125, 99, 22, 255))
        d.line([(x0, y0), (x0, y1)], fill=(232, 199, 96, 255))
    # 布的下摆做锯齿
    for i, x in enumerate(range(12, 46, 4)):
        d.rectangle([x, 79, x + 2, 79 + (2 if i % 2 else 4)], fill=(201, 162, 42, 255))
        d.rectangle([x, 79 + (2 if i % 2 else 4), x + 2, 79 + (2 if i % 2 else 4)], fill=(125, 99, 22, 255))
    # 折痕
    for x in (20, 31, 40):
        d.line([(x, 9), (x, 66)], fill=(176, 140, 34, 255))
    # 字：黄天当立（2 列 × 2 行）
    f = cjk(17)
    chars = '黄天当立'
    pos = [(13, 12), (29, 12), (13, 38), (29, 38)]
    for ch, (x, y) in zip(chars, pos):
        g = Image.new('L', (18, 22), 0)
        ImageDraw.Draw(g).text((0, -2), ch, font=f, fill=255)
        g = g.point(lambda v: 255 if v > 110 else 0)          # 阈值 → 硬边像素字
        ink = Image.new('RGBA', (18, 22), (58, 36, 16, 255))
        im.paste(ink, (x, y), g)
    return im


def main():
    b = banner()
    b.save(os.path.join(OUT, 'banner.png'))
    p = os.path.join(OUT, 'meta.json')
    m = json.load(open(p, encoding='utf-8'))
    m['banner'] = [40.0, 100.0]     # 世界单位
    json.dump(m, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
    print('banner', b.size, 'meta ok')


if __name__ == '__main__':
    main()
