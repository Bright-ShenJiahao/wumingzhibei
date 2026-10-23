"""第二章中景：绿幕去背 + 去绿边（保留烟/火，不把整张图洗灰）。"""
import sys
import numpy as np
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
a = np.asarray(Image.open(src).convert('RGB')).astype(float)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
d = g - np.maximum(r, b)
# 更硬的绿幕阈值：绿占明显优势的像素直接透明，半透明边缘快速衰减
alpha = np.clip(1 - (d - 8) / 42, 0, 1)
alpha[d >= 44] = 0
# 半透明边缘去绿：可见像素的绿不超过红/蓝的最大值
g2 = np.minimum(g, np.maximum(r, b))
# 绿烟/绿边改成暖灰，避免整片烟在红天空下发绿
greenish = (g2 > r * 1.02) & (g2 > b * 1.02) & (alpha > 0)
lum = .3 * r + .59 * g2 + .11 * b
r2, g3, b2 = r.copy(), g2.copy(), b.copy()
r2[greenish] = lum[greenish] * 1.08
g3[greenish] = lum[greenish] * .98
b2[greenish] = lum[greenish] * .88
alpha[alpha < .04] = 0
out = np.dstack([r2, g3, b2, alpha * 255]).clip(0, 255).astype('uint8')
if len(sys.argv) > 3 and sys.argv[3] == 'trim':
    aa = out[..., 3]
    ys, xs = np.nonzero(aa > 0)
    if len(xs):
        out = out[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
Image.fromarray(out, 'RGBA').save(dst)
print('saved', dst, out.shape[1], out.shape[0])
