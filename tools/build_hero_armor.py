"""披甲主角：用上传的武器动作表 + 现有身体帧补出可用的披甲皮肤。

运行：python tools/build_hero_armor.py
- 已由 pixelize_sheet.py 生成 hero_armor_{staff,hammer,stone,halberd} 的攻击/持械帧
- 本脚本补：通用 idle/走/翻滚/受击/倒地/击飞，以及各武器的 idle/走/收尾帧
- 补出来的帧沿用现有帧的尺寸、脚底锚点和动作，只做披甲配色，保证游戏不会缺帧
"""
import json, os, shutil
import numpy as np
from PIL import Image
from scipy import ndimage

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SP = os.path.join(R, 'art', 'sprites')
ATLAS = os.path.join(SP, 'atlas.json')
atlas = json.load(open(ATLAS, encoding='utf-8'))
HERO = os.path.join(SP, 'hero')

GENERIC = ['idle', 'walk1', 'walk2', 'walk3', 'roll1', 'roll2', 'hurt', 'down', 'fly1', 'fly2', 'bounce', 'getup']
SPEC = {
    'hero_armor_staff': ['staff0', 'staffw1', 'staffw2', 'staffw3', 'staffp_a', 'staffp_b'],
    'hero_armor_hammer': ['hammer0', 'hammerw1', 'hammerw2', 'hammerw3'],
    'hero_armor_stone': ['stone0', 'stonew1', 'stonew2', 'stonew3'],
    'hero_armor_halberd': ['staffw1', 'staffw2', 'staffw3', 'staffp_a', 'staffp_b'],
}


def recolor(im):
    """白衬衫→暗甲/红边，浅蓝高光→暗甲，深色短裤→灰裤；保留脸、眼睛、头发和武器。"""
    a = np.asarray(im.convert('RGBA')).copy()
    h, w = a.shape[:2]
    r, g, b = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int)
    white = (a[..., 3] > 0) & (r > 185) & (g > 185) & (b > 185)
    blue = (a[..., 3] > 0) & (b > r + 18) & (b > g + 10) & (b > 150)
    dark = (a[..., 3] > 0) & (np.abs(r - 47) < 11) & (np.abs(g - 47) < 11) & (np.abs(b - 53) < 11)
    yy, xx = np.mgrid[0:h, 0:w]
    # 白衬衫/白布：只处理较大的连通块，保留眼睛、牙齿这类小白点
    lab, n = ndimage.label(white)
    for i in range(1, n + 1):
        comp = lab == i
        if comp.sum() < 12:
            continue
        center = comp & (np.abs(xx - w / 2) < w * .20) & (yy > h * .30) & (yy < h * .68)
        sleeve = comp & ~center
        a[center, 0], a[center, 1], a[center, 2] = 52, 45, 43
        a[sleeve, 0], a[sleeve, 1], a[sleeve, 2] = 128, 37, 35
    # 浅蓝衬里
    a[blue, 0], a[blue, 1], a[blue, 2] = 66, 55, 50
    # 短裤：只改深色填充，不碰黑描边（描边更暗）
    pants = dark & (yy > h * .45)
    a[pants, 0], a[pants, 1], a[pants, 2] = 94, 88, 84
    return Image.fromarray(a, 'RGBA')


def put(dst, frame, src_name, src_frame, recolor_it=True):
    src = os.path.join(SP, src_name, src_frame + '.png')
    if not os.path.exists(src):
        return False
    im = Image.open(src).convert('RGBA')
    if recolor_it:
        im = recolor(im)
    os.makedirs(os.path.join(SP, dst), exist_ok=True)
    im.save(os.path.join(SP, dst, frame + '.png'))
    w, h = im.size
    if src_name in atlas and src_frame in atlas[src_name]:
        _, _, ax, ay = atlas[src_name][src_frame]
        # 重绘不会改变尺寸；若源帧有偏移，保持
        atlas.setdefault(dst, {})[frame] = [w, h, ax, ay]
    else:
        atlas.setdefault(dst, {})[frame] = [w, h, round(w / 2, 1), h - 1]
    return True


def copy_frame(dst, frame, src_name, src_frame):
    src = os.path.join(SP, src_name, src_frame + '.png')
    if not os.path.exists(src):
        return False
    os.makedirs(os.path.join(SP, dst), exist_ok=True)
    shutil.copyfile(src, os.path.join(SP, dst, frame + '.png'))
    if src_name in atlas and src_frame in atlas[src_name]:
        w, h, ax, ay = atlas[src_name][src_frame]
        atlas.setdefault(dst, {})[frame] = [w, h, ax, ay]
    return True


# 1) 通用帧：每轮都从现有 hero 帧重刷，确保白色补丁清干净
for ns in ['hero_armor_staff', 'hero_armor_hammer', 'hero_armor_stone', 'hero_armor_halberd']:
    os.makedirs(os.path.join(SP, ns), exist_ok=True)
    for f in GENERIC:
        put(ns, f, 'hero', f, recolor_it=True)

# 2) 各武器还缺的 idle/走/收尾帧
for ns, frames in SPEC.items():
    for f in frames:
        if f in atlas.get(ns, {}):
            continue
        # 默认用同名 hero 帧补（staff/hammer/stone 的持械待机和走路）
        src_f = f
        src_ns = 'hero'
        # 长戟没有专用走帧：先用上传的持戟 idle 顶住，避免走路时突然变回棍子
        if ns == 'hero_armor_halberd' and f in ('staffw1', 'staffw2', 'staffw3'):
            src_ns, src_f = 'hero_armor_halberd', 'staff0'
        if ns == 'hero_armor_halberd' and f in ('staffp_a', 'staffp_b'):
            src_ns, src_f = 'hero_armor_halberd', 'staff_1a' if f.endswith('a') else 'staff_1b'
        if src_ns == 'hero_armor_halberd':
            copy_frame(ns, f, src_ns, src_f)
        else:
            put(ns, f, src_ns, src_f, recolor_it=True)

# 3) 长戟的 staff0 已由上传图生成；确保 atlas 存在
for ns in SPEC:
    atlas.setdefault(ns, {})

json.dump(atlas, open(ATLAS, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for ns in ['hero_armor_staff', 'hero_armor_hammer', 'hero_armor_stone', 'hero_armor_halberd']:
    print(ns, len(atlas.get(ns, {})), sorted(atlas.get(ns, {})))
print('done')
