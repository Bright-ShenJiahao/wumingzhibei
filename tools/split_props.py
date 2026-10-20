"""把 Gemini 出的绿底道具图自动切开、抠绿、按比例缩放，存到 art/props/ 并更新 meta.json。
用法：python3 tools/split_props.py 原图 名字1,名字2,... 世界高度1,世界高度2,...
世界高度以主角身高约 29 为基准（例：草垛 48）。名字数量要和图中从左到右的物体数量一致。
可选参数：warm —— 按背景的黄昏暖光调色（推荐，和村子背景统一）。
输出图保留原图分辨率（不缩小），游戏里按 meta.json 的世界尺寸绘制，放大也不会糊。"""
import json, os, sys
import numpy as np
from PIL import Image

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src, names, heights = sys.argv[1], sys.argv[2].split(','), [float(v) for v in sys.argv[3].split(',')]
a = np.asarray(Image.open(src).convert('RGB')).astype(float)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
d = g - np.maximum(r, b)
alpha = np.clip(1 - (d - 25) / 110, 0, 1)
g2 = np.minimum(g, np.maximum(r, b) + 8)
if 'warm' in sys.argv[4:]:   # 黄昏暖光：红黄加强、蓝色压低（按村子背景的颜色比例算出）
    r, g2, b = r * 1.15, g2 * 1.05, b * .8
rgba = np.dstack([r, g2, b, alpha * 255]).clip(0, 255).astype('uint8')
solid = d < 60
cols = solid.sum(0) > 2
segs, x, W = [], 0, len(cols)
while x < W:
    if cols[x]:
        s = x
        while x < W and cols[x]: x += 1
        segs.append([s, x])
    x += 1
merged = []
for s in segs:
    if merged and s[0] - merged[-1][1] < 4: merged[-1][1] = s[1]
    else: merged.append(s)
merged = [s for s in merged if s[1] - s[0] > 20]
if len(merged) != len(names):
    sys.exit(f'找到 {len(merged)} 个物体，但给了 {len(names)} 个名字：{merged}')
mp = os.path.join(R, 'art', 'props', 'meta.json')
meta = json.load(open(mp)) if os.path.exists(mp) else {}
for n, h, (x0, x1) in zip(names, heights, merged):
    x0, x1 = max(0, x0 - 3), min(W, x1 + 3)
    rows = np.where(solid[:, x0:x1].sum(1) > 1)[0]
    y0, y1 = rows[0], min(a.shape[0], rows[-1] + 4)
    sc = h / (y1 - y0)
    Image.fromarray(rgba[y0:y1, x0:x1], 'RGBA').save(os.path.join(R, 'art', 'props', n + '.png'))
    meta[n] = [round((x1 - x0) * sc, 1), round(h, 1)]
    print(n, meta[n])
json.dump(meta, open(mp, 'w'))
