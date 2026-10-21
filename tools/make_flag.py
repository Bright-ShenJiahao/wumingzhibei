"""旗手大旗的旗面贴图：从 Gemini 旗幡原图里抠出黄布（去掉旗杆和横杆），用隶书（临海隶书）把「苍天已死 / 黄天当立」
竖排两列写成血红色，按 2 倍分辨率导出 art/ui/flag_cloth.png。游戏里旗杆、横杆、枪头用代码画，旗面按这张图切条做飘动。
用法：python3 tools/make_flag.py"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(R, 'art', 'gemini', '旗手_旗幡.png')
FONT = os.path.join(R, 'tools', 'fonts', 'LinHaiLiShu-flag.ttf')   # 只含这 8 个字的子集
OUT = os.path.join(R, 'art', 'ui', 'flag_cloth.png')
LINES = ('苍天已死', '黄天当立')   # 从右往左
K = 2

a = np.asarray(Image.open(SRC).convert('RGB')).astype(float)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
H, W = r.shape
yy, xx = np.mgrid[0:H, 0:W]
green = (g - np.maximum(r, b)) > 45
yellow = (r > 185) & (g > 135) & (b < 120) & (r > g)
cloth0 = yellow & (xx > 290) & (xx < 475)
ys, xs = np.nonzero(cloth0)
x0, x1, y0, y1 = xs.min() - 6, xs.max() + 6, ys.min(), ys.max() + 4
wood = (r > 70) & (r < 190) & (g < 120) & (b < 80) & ~yellow
mask = ~green
mask &= ~(wood & (yy < y0 + 40))                       # 顶部横杆
mask &= ~(wood & (np.abs(xx - 382) < 13) & (yy > 600))  # 破口下方露出的旗杆
mask &= (xx >= x0) & (xx <= x1) & (yy >= y0) & (yy <= y1)
# 只保留和黄布连在一起的部分（焦边保留，旗杆碎块去掉）
from scipy import ndimage
lab, n = ndimage.label(mask)
keep = np.unique(lab[cloth0 & mask]); keep = keep[keep > 0]
mask = np.isin(lab, keep)
crop = np.dstack([a, mask * 255]).astype('uint8')[y0:y1, x0:x1]
img = Image.fromarray(crop, 'RGBA').resize(((x1 - x0) * K, (y1 - y0) * K), Image.LANCZOS)
A = np.asarray(img).astype(float); cw, ch = img.size
cl = (A[..., 0] > 170) & (A[..., 1] > 120) & (A[..., 2] < 130) & (A[..., 3] > 200)

txt = Image.new('L', img.size, 0); d = ImageDraw.Draw(txt)
colw = cw * .86 / 2; top = ch * .1; step = ch * .66 / 4
f = ImageFont.truetype(FONT, int(colw * .9))
for ci, line in enumerate(LINES):
    cx = cw * .94 - colw * (ci + .5)
    for i, c in enumerate(line):
        bb = d.textbbox((0, 0), c, font=f); w, h = bb[2] - bb[0], bb[3] - bb[1]
        d.text((cx - w / 2 - bb[0], top + i * step + (step - h) / 2 - bb[1]), c, font=f, fill=255)
m = np.asarray(txt).astype(float) / 255 * cl
rng = np.random.default_rng(3)
sp = np.asarray(Image.fromarray((rng.random(m.shape) * 255).astype('uint8')).filter(ImageFilter.GaussianBlur(1.5))).astype(float) / 255
m *= .85 + .15 * sp
shade = (A[..., :3].mean(-1) / A[..., :3][cl].mean())[..., None]
red = np.array([140, 14, 14.]) * np.clip(shade, .6, 1.15)
A[..., :3] = A[..., :3] * (1 - m[..., None]) + red * m[..., None]
Image.fromarray(A.clip(0, 255).astype('uint8'), 'RGBA').save(OUT); Image.open(OUT).save(OUT.replace('.png', '.webp'), quality=88)
print(OUT, img.size)
