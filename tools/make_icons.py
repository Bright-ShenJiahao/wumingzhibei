# 生成主屏幕图标（安卓 manifest / iOS apple-touch-icon）
# 用法：python tools/make_icons.py
# 有 art/gemini/主屏幕图标.png 就直接用它裁切缩放；没有则用代码画的备用图。
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets'
OUT.mkdir(exist_ok=True)
SRC = ROOT / 'art' / 'gemini' / '主屏幕图标.png'
FONT = ROOT / 'tools' / 'fonts' / 'MaShanZheng-Regular.ttf'


def from_art(size: int) -> Image.Image:
    """原图是 1254 方图（四角为深色圆角），裁成正方形后缩放。
    iOS/安卓会自动再加圆角，所以这里把圆角外的深色角补成边缘色，避免出现两层圆角。"""
    im = Image.open(SRC).convert('RGB')
    # 稍微内缩一点，去掉原图自带的圆角边缘
    pad = int(im.width * 0.018)
    im = im.crop((pad, pad, im.width - pad, im.height - pad))
    # 用中心区域的平均色填满四个角（避免缩放后出现黑角）
    w, h = im.size
    corner = im.crop((0, 0, 8, 8)).resize((1, 1), Image.LANCZOS).getpixel((0, 0))
    canvas = Image.new('RGB', (w, h), corner)
    mask = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(mask)
    inset = int(w * 0.02)
    d.rounded_rectangle([inset, inset, w - inset, h - inset], radius=int(w * 0.16), fill=255)
    canvas.paste(im, (0, 0), mask)
    return canvas.resize((size, size), Image.LANCZOS)


def fallback(size: int) -> Image.Image:
    S = 512
    BG, GOLD, CREAM, RED = (26, 16, 32), (201, 151, 31), (247, 224, 170), (176, 44, 34)
    img = Image.new('RGB', (S, S), BG)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([18, 18, S - 18, S - 18], radius=88, outline=GOLD, width=7)
    d.rounded_rectangle([86, 86, S - 86, S - 86], radius=28, fill=RED)
    font = ImageFont.truetype(str(FONT), 168)
    for i, line in enumerate(('无名', '之辈')):
        tw = d.textlength(line, font=font)
        d.text(((S - tw) / 2, 100 + i * 158), line, font=font, fill=CREAM)
    return img.resize((size, size), Image.LANCZOS)


def build(size: int) -> Image.Image:
    return from_art(size) if SRC.exists() else fallback(size)


for name, size in (('icon-512.png', 512), ('icon-192.png', 192), ('apple-touch-icon.png', 180)):
    img = build(size)
    # 图标不需要 24 位色，量化到 256 色能省 80% 体积
    img.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG).save(OUT / name, optimize=True)
    print('写出', OUT / name, size, '(来源：%s)' % ('原图' if SRC.exists() else '备用'))
