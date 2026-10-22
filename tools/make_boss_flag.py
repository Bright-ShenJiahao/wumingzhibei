from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
source = root / 'art' / 'gemini' / 'boss_flag.png'
output = root / 'art' / 'ui' / 'boss_flag.webp'
font_path = root / 'tools' / 'fonts' / 'LinHaiLiShu-flag.ttf'

rgb = np.asarray(Image.open(source).convert('RGB'))
spread = rgb.max(axis=2).astype(np.int16) - rgb.min(axis=2).astype(np.int16)
alpha = np.where(spread < 14, 0, 255).astype(np.uint8)
rgba = np.dstack((rgb, alpha))
ys, xs = np.nonzero(alpha)
if len(xs) == 0:
    raise RuntimeError('去除灰底后没有剩余图像内容')
img = Image.fromarray(rgba).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
W, H = img.size
font = ImageFont.truetype(str(font_path), int(W * 0.28))
draw = ImageDraw.Draw(img)
chars = '苍天已死'
center_x = W * 0.44
# 原图裁切框包含旗尖和下垂旗杆；首字下移到横杆与绳索以下的布面上。
first_top = H * 0.18
step = H * 0.67 / 4
for i, ch in enumerate(chars):
    box = draw.textbbox((0, 0), ch, font=font)
    glyph_w = box[2] - box[0]
    x = center_x - glyph_w / 2 - box[0]
    y = first_top + step * i - box[1]
    # 轻微透出布面纹理，让汉隶字像写在旗布上，不像后贴的纯色字块。
    draw.text((round(x), round(y)), ch, font=font, fill=(122, 20, 14, 232))
    ink = draw.textbbox((round(x), round(y)), ch, font=font)
    cloth_left, cloth_right = W * 0.14, W * 0.88
    if ink[0] < cloth_left + 8 or ink[2] > cloth_right - 8:
        raise RuntimeError(f'文字「{ch}」超出旗面左右 8 px 安全区：{ink}, 旗面约 {cloth_left:.0f}..{cloth_right:.0f}')
output.parent.mkdir(parents=True, exist_ok=True)
img.save(output, 'WEBP', quality=92, method=6)
print(f'生成 {output.relative_to(root)}：{W}×{H}，字号 {font.size}，文字安全边距至少 8 px')
