# 张角棺材：把 GPT 出的斜 45° 棺材图，按祭台的视角重新投影（用户：先算角度）。
# 祭台台面量出来：正对镜头、俯角很小——台面投影深度只有宽度的约 6%，正面几乎不缩。
# 所以棺材也改成「长边水平、正面朝镜头、顶面是一条很扁的梯形」：按三个面（顶面/正面/右端面）分别做透视变换再拼起来。
# 用法：python3 tools/warp_coffin.py   → art/props/coffin.png、coffin_open.png（并按原 meta 世界尺寸登记）
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(__file__))
from process_ui import key
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(R, 'art', 'gemini', '第二章_棺材_俯视.png')
src = Image.fromarray(key(Image.open(SRC)), 'RGBA')

# 原图量的角点（全图像素）：前左上 / 前右上 / 后右上 / 后左上 / 前左下 / 前右下 / 后右下
SHAPES = {
    'coffin':      dict(fl=(40, 245),  fr=(590, 392),  br=(712, 292),  bl=(200, 163), dfl=(62, 400),  dfr=(552, 552),  dbr=(690, 448)),
    'coffin_open': dict(fl=(785, 247), fr=(1345, 395), br=(1462, 300), bl=(955, 170), dfl=(800, 408), dfr=(1300, 555), dbr=(1445, 450)),
}
# 目标：宽 W、正面高 H、顶面投影深 D；棺材在画面消失点左边 → 后沿往右上收，右端面露一窄条
W, H, D, SHIFT, END = 520, 150, 30, 14, 10
PAD = 6
T = dict(fl=(PAD, PAD + D), fr=(PAD + W, PAD + D), br=(PAD + W + END, PAD), bl=(PAD + SHIFT, PAD),
         dfl=(PAD, PAD + D + H), dfr=(PAD + W, PAD + D + H), dbr=(PAD + W + END, PAD + D + H - 8))

def coeffs(dst, srcq):   # PIL PERSPECTIVE：输出坐标 → 输入坐标
    A, b = [], []
    for (x, y), (u, v) in zip(dst, srcq):
        A += [[x, y, 1, 0, 0, 0, -u * x, -u * y], [0, 0, 0, x, y, 1, -v * x, -v * y]]; b += [u, v]
    return np.linalg.solve(np.array(A, float), np.array(b, float)).tolist()

def face(out, s, quad_keys):
    dq = [T[k] for k in quad_keys]; sq = [s[k] for k in quad_keys]
    warped = src.transform(out.size, Image.PERSPECTIVE, coeffs(dq, sq), Image.BICUBIC)
    mask = Image.new('L', out.size, 0); ImageDraw.Draw(mask).polygon(dq, fill=255)
    out.paste(warped, (0, 0), Image.composite(warped, Image.new('RGBA', out.size), mask).split()[3])

meta_p = os.path.join(R, 'art', 'props', 'meta.json'); meta = json.load(open(meta_p))
for name, s in SHAPES.items():
    out = Image.new('RGBA', (PAD * 2 + W + END, PAD * 2 + D + H), (0, 0, 0, 0))
    face(out, s, ['dfr', 'fr', 'br', 'dbr'])     # 右端面（先画，被正面压住接缝）
    face(out, s, ['fl', 'fr', 'dfr', 'dfl'])     # 正面
    face(out, s, ['bl', 'br', 'fr', 'fl'])       # 顶面（棺盖 / 敞口）
    out.save(os.path.join(R, 'art', 'props', name + '.png'))
    old = meta.get(name)
    if old: meta[name] = [old[0], round(old[0] * out.height / out.width, 1)] if isinstance(old[0], (int, float)) else old
    print(name, out.size, meta.get(name))
open(meta_p, 'w').write(json.dumps(meta, ensure_ascii=False))
