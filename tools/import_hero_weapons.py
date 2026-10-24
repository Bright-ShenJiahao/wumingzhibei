"""导入用户确认的白衣长戟总表和独立武器图标，不改变原图。

长戟全表使用一个固定比例（人物头顶到脚底197源像素→74游戏像素），
按连通块分帧，显式标记脚底；不会把武器和刀光当作人物高度。
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art'


def keyed(path):
    rgb = np.asarray(Image.open(path).convert('RGB')).copy()
    d = rgb[..., 1].astype(int) - np.maximum(rgb[..., 0], rgb[..., 2]).astype(int)
    alpha = d < 45
    rgb[..., 1] = np.minimum(rgb[..., 1], np.maximum(rgb[..., 0], rgb[..., 2]))
    rgba = np.dstack((rgb, alpha.astype('uint8') * 255))
    rgba[~alpha] = 0
    return Image.fromarray(rgba), alpha


def import_halberd():
    sheet, mask = keyed(ART / 'gemini' / '白衣男主_长戟_行走攻击_v2.png')
    labels, count = ndimage.label(mask)
    sizes = ndimage.sum(mask, labels, range(1, count + 1))
    boxes = ndimage.find_objects(labels)
    ids = [i for i, size in enumerate(sizes) if size > 1000]
    rows = [[i for i in ids if boxes[i][0].start < 260],
            [i for i in ids if boxes[i][0].start >= 260]]
    rows = [sorted(row, key=lambda i: boxes[i][1].start) for row in rows]
    assert list(map(len, rows)) == [6, 5], '必须是6个待机/走路姿势和5个攻击姿势'
    ids = rows[0] + rows[1]
    feet_x = [109, 269, 434, 585, 742, 892, 85, 287, 475, 684, 867]
    feet_y = [231] * 6 + [530] * 5
    scale = 74 / 197
    frames = []
    for i, ax, ay in zip(ids, feet_x, feet_y):
        sy, sx = boxes[i]
        pixels = np.asarray(sheet.crop((sx.start, sy.start, sx.stop, sy.stop))).copy()
        pixels[labels[sy, sx] != i + 1] = 0
        im = Image.fromarray(pixels)
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.Resampling.BOX)
        rgba = np.asarray(im).copy()
        rgba[..., 3] = np.where(rgba[..., 3] >= 128, 255, 0)
        rgba[rgba[..., 3] == 0] = 0
        im = Image.fromarray(rgba).quantize(colors=64, method=Image.Quantize.FASTOCTREE).convert('RGBA')
        frames.append((im, round((ax - sx.start) * scale, 1), round((ay - sy.start + 1) * scale) - 1))

    mapping = dict(zip(['halberd0'] + [f'halberdw{i}' for i in range(1, 6)], range(6)))
    # 五个攻击姿势复用于四段连击的起手/命中阶段，保留现有帧名接口。
    mapping.update(dict(zip([f'halberd_{i}{p}' for i in range(1, 5) for p in 'ab'], [7, 6, 7, 8, 8, 9, 9, 10])))
    atlas_path = ART / 'sprites' / 'atlas.json'
    atlas = json.loads(atlas_path.read_text(encoding='utf-8'))
    for name, i in mapping.items():
        im, ax, ay = frames[i]
        im.save(ART / 'sprites' / 'hero' / (name + '.png'))
        atlas['hero'][name] = [im.width, im.height, ax, ay]
    atlas_path.write_text(json.dumps(atlas, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print('长戟：统一缩放', round(scale, 4), '，输出', len(mapping), '帧')


def icon(path, box, size, bounds, out, rotate=0):
    im, _ = keyed(path)
    im = im.crop(box)
    im = im.crop(im.getbbox())
    if rotate:
        im = im.rotate(rotate, expand=True, resample=Image.Resampling.NEAREST)
    im.thumbnail(bounds, Image.Resampling.NEAREST)
    canvas = Image.new('RGBA', size)
    canvas.alpha_composite(im, ((size[0] - im.width) // 2, (size[1] - im.height) // 2))
    canvas.save(ART / 'ui' / (out + '.webp'), lossless=True)


if __name__ == '__main__':
    import_halberd()
    # 中间一把拉弓含箭的独立图：弓弦、上下弓梢及箭尖都完整保留。
    icon(ART / 'gemini' / '武器_汉弓_图标.png', (345, 25, 665, 540), (64, 64), (54, 56), 'w_bow')
    icon(ART / 'gemini' / '武器_长戟_图标.jpg', (0, 0, 1024, 572), (96, 72), (86, 62), 'w_halberd', rotate=25)
