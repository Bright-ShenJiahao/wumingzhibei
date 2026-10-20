"""把 Gemini 出的绿底图抠成透明图（含去绿边），并缩放。
用法：python3 process_bg.py 输入.jpg 输出.png [缩放=0.61] [裁掉底部行号]"""
import sys
import numpy as np
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
scale = float(sys.argv[3]) if len(sys.argv) > 3 else 0.61
a = np.asarray(Image.open(src).convert('RGB')).astype(float)
if len(sys.argv) > 4:
    a = a[:int(sys.argv[4])]
r, g, b = a[..., 0], a[..., 1], a[..., 2]
d = g - np.maximum(r, b)
alpha = np.clip(1 - (d - 25) / 110, 0, 1)
g = np.minimum(g, np.maximum(r, b) + 8)
im = Image.fromarray(np.dstack([r, g, b, alpha * 255]).clip(0, 255).astype('uint8'), 'RGBA')
im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS).save(dst)
