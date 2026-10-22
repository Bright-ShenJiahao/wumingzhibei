# 生成主屏幕图标（安卓 manifest / iOS apple-touch-icon）
# 用法：python tools/make_icons.py
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets'
OUT.mkdir(exist_ok=True)
FONT = ROOT / 'tools' / 'fonts' / 'MaShanZheng-Regular.ttf'

S = 512
BG = (26, 16, 32, 255)
GOLD = (201, 151, 31, 255)
CREAM = (247, 224, 170, 255)
RED = (176, 44, 34, 255)


def build(size: int) -> Image.Image:
    img = Image.new('RGBA', (S, S), BG)
    d = ImageDraw.Draw(img)
    # 外框：暗金圆角
    d.rounded_rectangle([18, 18, S - 18, S - 18], radius=88, outline=GOLD, width=7)
    d.rounded_rectangle([34, 34, S - 34, S - 34], radius=74, outline=(120, 90, 34, 255), width=2)
    # 朱印底：中间一块暗红方印
    d.rounded_rectangle([86, 86, S - 86, S - 86], radius=28, fill=RED, outline=(120, 28, 22, 255), width=4)
    # 文字：无名 / 之辈 两行
    font = ImageFont.truetype(str(FONT), 168)
    for i, line in enumerate(('无名', '之辈')):
        w = d.textlength(line, font=font)
        d.text(((S - w) / 2, 100 + i * 158), line, font=font, fill=CREAM)
    return img.resize((size, size), Image.LANCZOS)


for name, size in (('icon-512.png', 512), ('icon-192.png', 192), ('apple-touch-icon.png', 180)):
    build(size).convert('RGB').save(OUT / name, optimize=True)
    print('写出', OUT / name, size)
