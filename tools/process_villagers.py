"""清理用户提供的村民动作表棋盘格背景，并按项目像素流程生成精灵。"""
import os
import subprocess
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, 'art', 'gemini', '村民_老人和年轻女子.png')
OUT = os.path.join(ROOT, 'build', '.villagers_green.png')

im = Image.open(SOURCE).convert('RGB')
w, h = im.size
if w % 4 or h % 2:
    sys.exit(f'动作图尺寸 {w}x{h} 不能平均切成 4 列、2 行')
cell_w, cell_h = w // 4, h // 2
arr = np.asarray(im)
clean = np.empty_like(arr)

for row in range(2):
    for col in range(4):
        y0, y1 = row * cell_h, (row + 1) * cell_h
        x0, x1 = col * cell_w, (col + 1) * cell_w
        cell = arr[y0:y1, x0:x1]
        hi, lo = cell.max(axis=2), cell.min(axis=2)
        gray = cell.mean(axis=2)
        # 棋盘格是低饱和的浅灰色；从格子边缘做连通泛洪，保留被轮廓包围的灰白衣物和头发。
        candidate = ((hi - lo) < 20) & (gray > 162)
        seed = np.zeros(candidate.shape, dtype=bool)
        seed[[0, -1], :] = candidate[[0, -1], :]
        seed[:, [0, -1]] = candidate[:, [0, -1]]
        bg = ndimage.binary_propagation(seed, mask=candidate)
        # 清掉棋盘格与人物抗锯齿边界的浅灰混色像素，避免缩小后留下灰边。
        fringe = ((hi - lo) < 28) & (gray > 148) & ndimage.binary_dilation(bg, iterations=1)
        bg |= fringe
        out = cell.copy()
        out[bg] = (0, 255, 0)
        clean[y0:y1, x0:x1] = out

spec = 'villager_old:run1,run2,idle,bow;villager_woman:run1,run2,idle,bow'
Image.fromarray(clean).save(OUT)
try:
    subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'pixelize_sheet.py'), OUT, spec, '72'], cwd=ROOT, check=True)
finally:
    if os.path.exists(OUT): os.remove(OUT)
print('村民棋盘背景已清理，老人和年轻女子像素帧已生成。')
