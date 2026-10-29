# 锦囊特效图（art/gemini/锦囊特效_水稻草人风护盾暗箭.png）：抠绿 → 按行、按列切 → 裁空 → 缩一半存到 art/ui/tip_*.png
# 用法：python3 tools/process_tipfx.py
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from process_ui import key
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(R, 'art', 'gemini', '锦囊特效_水稻草人风护盾暗箭.png')
ROWS = [  # (y0, y1, 名字...)
    (40, 200, ['tip_water1', 'tip_water2', 'tip_water3', 'tip_wave1', 'tip_wave2'], 6),
    (195, 445, ['tip_scare', 'tip_scare_hit', 'tip_scare_break1', 'tip_scare_break2'], 25),
    (470, 600, ['tip_wind1', 'tip_wind2', 'tip_wind3'], 25),
    (600, 860, ['tip_shield', 'tip_shield_break1', 'tip_shield_break2'], 25),
    (860, 960, ['tip_arrow'], 25),
]
rgba = key(Image.open(SRC))
for y0, y1, names, gap in ROWS:
    band = rgba[y0:y1]
    cols = (band[..., 3] > 120).sum(0) > 2
    segs, x = [], 0
    while x < len(cols):
        if cols[x]:
            s = x
            while x < len(cols) and cols[x]: x += 1
            segs.append([s, x])
        x += 1
    m = []
    for s in segs:
        if m and s[0] - m[-1][1] < gap: m[-1][1] = s[1]
        else: m.append(s)
    m = [s for s in m if s[1] - s[0] > 20]
    assert len(m) == len(names), (names, m)
    for (x0, x1), n in zip(m, names):
        sub = band[:, x0:x1]
        ys = np.where((sub[..., 3] > 20).any(1))[0]
        sub = sub[ys[0]:ys[-1] + 1]
        im = Image.fromarray(sub, 'RGBA')
        if not n.startswith(('tip_water', 'tip_wave')):   # 水面/浪头保留原分辨率（水淹七军放大后不糊）
            im = im.resize((max(1, im.width // 2), max(1, im.height // 2)), Image.LANCZOS)
        im.save(os.path.join(R, 'art', 'ui', n + '.png')); im.save(os.path.join(R, 'art', 'ui', n + '.webp'), quality=88, method=6)
        print(n, im.size)
