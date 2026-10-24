"""导入用户确认的白衣长戟总表和独立武器图标，不改变原图。

长戟按显式头部/脚底标记校准，排除武器、刀光和邻帧。
所有帧共用一套以旧棍子为主的调色板，并沿用pixelize_sheet.py的描边流程。
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


def strengthen_body(color, mask, xx, yy, head, foot, bounds, head_x, shaft):
    """仅加宽下巴以下的身体约9%，头部、脚底和刚性戟杆保留原坐标。"""
    lo, hi = bounds
    (sx, sy), (ex, ey) = shaft
    length2 = (ex - sx) ** 2 + (ey - sy) ** 2
    along = np.clip(((xx - sx) * (ex - sx) + (yy - sy) * (ey - sy)) / length2, 0, 1)
    weapon = (xx - sx - along * (ex - sx)) ** 2 + (yy - sy - along * (ey - sy)) ** 2 < 36
    body = mask & (xx >= lo) & (xx <= hi) & (yy > head[1] + 3) & (yy < foot[1] - 5) & ~weapon
    blend = np.clip((yy - head[1] - 3) / 14, 0, 1) * np.clip((foot[1] - 5 - yy) / 14, 0, 1)
    progress = np.clip((yy - head[1]) / (foot[1] - head[1]), 0, 1)
    center = head_x * (1 - progress) + foot[0] * progress
    source_x = np.rint(center + (xx - center) / (1 + .09 * blend) - xx[0, 0]).astype(int)
    source_x = source_x.clip(0, mask.shape[1] - 1)
    source_y = np.arange(mask.shape[0])[:, None]
    expanded = body[source_y, source_x] & ~weapon
    out, alpha = color.copy(), mask.copy()
    alpha[body] = False
    out[expanded] = color[source_y, source_x][expanded]
    alpha[expanded] = True
    return out, alpha


def import_halberd():
    rgb = np.asarray(Image.open(ART / 'gemini' / '白衣男主_长戟_旧风格_v3.png').convert('RGB')).copy()
    # 名称: (切帧区域, 脚底中心, 头顶/下巴)。空手走路格不纳入持戟循环。
    specs = {
        'idle': ((43, 0, 165, 199), (94, 192), (17, 89)),
        'walk1': ((0, 204, 205, 385), (91, 379), (211, 281)),
        'walk2': ((4, 385, 209, 542), (95, 539), (392, 455)),
        'walk3': ((0, 541, 204, 691), (96, 687), (545, 606)),
        'walk4': ((1, 851, 201, 1024), (89, 1020), (856, 927)),
        'walk5': ((201, 847, 390, 1024), (288, 1019), (853, 925)),
        'wind': ((377, 0, 582, 199), (457, 192), (37, 109)),
        'recover': ((394, 207, 681, 379), (464, 372), (216, 286)),
        'thrust': ((393, 382, 738, 535), (468, 534), (391, 460)),
        'overhead': ((387, 527, 608, 696), (471, 690), (566, 626)),
        'down1': ((390, 686, 584, 853), (467, 849), (704, 775)),
        'down2': ((390, 844, 581, 1024), (470, 1019), (870, 940)),
    }
    # 身体范围、颈部中心和戟杆轴线：用来保护头部与武器，只加厚人物本体。
    bodies = {
        'idle': ((48, 136), 96, ((140, 191), (140, 45))),
        'walk1': ((44, 142), 98, ((9, 357), (193, 266))),
        'walk2': ((48, 139), 100, ((15, 527), (198, 438))),
        'walk3': ((44, 142), 98, ((8, 680), (191, 591))),
        'walk4': ((47, 143), 98, ((11, 996), (195, 901))),
        'walk5': ((244, 334), 292, ((203, 996), (380, 900))),
        'wind': ((395, 517), 477, ((385, 174), (568, 13))),
        'recover': ((410, 546), 492, ((401, 298), (669, 298))),
        'thrust': ((410, 566), 509, ((430, 461), (725, 461))),
        'overhead': ((438, 534), 494, ((398, 533), (591, 602))),
        'down1': ((412, 532), 492, ((398, 692), (575, 839))),
        'down2': ((410, 531), 492, ((397, 849), (566, 1015))),
    }
    frames, face_masks = {}, {}
    for name, (box, foot, head) in specs.items():
        x0, y0, x1, y1 = box
        sub = rgb[y0:y1, x0:x1].copy()
        mask = sub[..., 1].astype(int) - np.maximum(sub[..., 0], sub[..., 2]).astype(int) < 45
        yy, xx = np.mgrid[y0:y1, x0:x1]
        # 平刺的后脚与下一格的戟杆接触，沿戟杆边界拆开，不能整块误合并。
        boundary = 532 + (xx - 397) * .37
        if name == 'thrust': mask &= yy < boundary - 2
        if name == 'overhead': mask &= yy >= boundary - 4
        mask = ndimage.binary_opening(mask, iterations=1)
        labels, count = ndimage.label(mask)
        sizes = ndimage.sum(mask, labels, range(1, count + 1))
        mask = labels == int(np.argmax(sizes) + 1)
        bounds, head_x, shaft = bodies[name]
        sub, mask = strengthen_body(sub, mask, xx, yy, head, foot, bounds, head_x, shaft)
        c = sub.astype(float)
        skin = mask & (c[..., 0] > 95) & (c[..., 0] > c[..., 1] * 1.15) & (c[..., 0] < c[..., 1] * 2.05) & (c[..., 1] > c[..., 2] * 1.05)
        skin &= (xx >= bounds[0] - 6) & (xx <= bounds[1] + 6) & (yy >= head[0]) & (yy < foot[1] - 5)
        face = skin & (yy <= head[1] + 2)
        ys, xs = np.nonzero(mask)
        bx, by, ex, ey = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        skin = skin[by:ey, bx:ex]
        face = face[by:ey, bx:ex]
        sub, mask = sub[by:ey, bx:ex], mask[by:ey, bx:ex]
        # 旧棍子的头部约31像素（含两侧描边）；这里统一为29像素，再补1px描边。
        scale = 29 / (head[1] - head[0])
        size = (round(sub.shape[1] * scale), round(sub.shape[0] * scale))
        sub[..., 1] = np.minimum(sub[..., 1], np.maximum(sub[..., 0], sub[..., 2]) + 6)
        alpha = np.asarray(Image.fromarray((mask * 255).astype('uint8')).resize(size, Image.Resampling.BOX)).astype(float) / 255
        premult = np.asarray(Image.fromarray((sub * mask[..., None]).astype('uint8')).resize(size, Image.Resampling.BOX)).astype(float)
        color = (premult / np.maximum(alpha, 1e-3)[..., None]).clip(0, 255).astype('uint8')
        on = alpha > .45
        skin = np.asarray(Image.fromarray((skin * 255).astype('uint8')).resize(size, Image.Resampling.BOX)) > 127
        face_masks[name] = np.asarray(Image.fromarray((face * 255).astype('uint8')).resize(size, Image.Resampling.BOX)) > 127
        ax = (foot[0] - x0 - bx) * scale + 1
        ay = round((foot[1] - y0 - by + 1) * scale)
        frames[name] = (color, on, ax, ay, skin & on)

    # 旧素材提供肤色、黑发、白衣和阴影；新图补充戟头、红缨和白色轨迹颜色。
    reference = []
    for name in ['staff0', 'hammer0', 'stone0']:
        a = np.asarray(Image.open(ART / 'sprites' / 'hero' / (name + '.png')).convert('RGBA'))
        reference.append(a[..., :3][a[..., 3] > 0])
    # 从旧棍原帧取同一组肤色，匹配明暗分布；不能仅靠混合调色板碰运气。
    skin_colors = np.array([(112, 70, 58), (145, 93, 76), (190, 116, 94), (204, 130, 103), (229, 152, 117), (251, 183, 136), (252, 189, 140)], dtype='uint8')
    weights = np.array([np.all(reference[0] == color, axis=1).sum() for color in skin_colors], dtype=float)
    def match_skin(regions, target_weights):
        target_cdf = np.cumsum(target_weights) / target_weights.sum()
        skin_pixels = np.concatenate([color[selection] for color, selection in regions])
        lightness = np.rint(skin_pixels @ np.array([.299, .587, .114])).astype(int)
        histogram = np.bincount(lightness, minlength=256)
        source_cdf = (np.cumsum(histogram) - histogram / 2) / histogram.sum()
        for color, selection in regions:
            light = np.rint(color[selection] @ np.array([.299, .587, .114])).astype(int)
            indices = np.searchsorted(target_cdf, source_cdf[light]).clip(0, len(skin_colors) - 1)
            color[selection] = skin_colors[indices]
    match_skin([(c, s & ~face_masks[n]) for n, (c, _, _, _, s) in frames.items()], weights)
    ref_face = np.asarray(Image.open(ART / 'sprites' / 'hero' / 'staff0.png').convert('RGB'))[12:32, 19:51].reshape(-1, 3)
    face_weights = np.array([np.all(ref_face == color, axis=1).sum() for color in skin_colors], dtype=float)
    match_skin([(c, s & face_masks[n]) for n, (c, _, _, _, s) in frames.items()], face_weights)
    donors = np.concatenate(reference * 6 + [c[m] for c, m, _, _, _ in frames.values()])
    palette = Image.fromarray(donors[None]).quantize(colors=22, method=Image.Quantize.MEDIANCUT)
    # 给红缨保留3个色阶，避免旧素材的大面积黑白肤色把小块红色挤成棕色。
    red = donors[(donors[:, 0] > donors[:, 1] * 1.8) & (donors[:, 0] > donors[:, 2] * 1.8) & (donors[:, 0] > 70) & (donors[:, 1] < 75)]
    red_palette = Image.fromarray(red[None]).quantize(colors=3, method=Image.Quantize.MEDIANCUT)
    colors = palette.getpalette()[:22 * 3] + skin_colors.flatten().tolist() + red_palette.getpalette()[:3 * 3]
    palette.putpalette(colors + [0] * (768 - len(colors)))

    mapping = dict(zip(['halberd0'] + [f'halberdw{i}' for i in range(1, 6)], ['idle'] + [f'walk{i}' for i in range(1, 6)]))
    mapping.update(dict(zip([f'halberd_{i}{p}' for i in range(1, 5) for p in 'ab'], ['wind', 'down1', 'recover', 'thrust', 'overhead', 'down2', 'recover', 'thrust'])))
    atlas_path = ART / 'sprites' / 'atlas.json'
    atlas = json.loads(atlas_path.read_text(encoding='utf-8'))
    for name, pose in mapping.items():
        color, on, ax, ay, _ = frames[pose]
        color = np.asarray(Image.fromarray(color).quantize(palette=palette, dither=Image.Dither.NONE).convert('RGB'))
        h, w = on.shape
        out = np.zeros((h + 2, w + 2, 4), dtype='uint8')
        out[1:-1, 1:-1, :3] = color
        out[1:-1, 1:-1, 3] = on * 255
        mask = out[..., 3] > 0
        edge = ndimage.binary_dilation(mask) & ~mask
        neighbor = np.zeros(out.shape[:2] + (3,), dtype=float)
        count = np.zeros(mask.shape)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            neighbor += np.roll(np.roll(out[..., :3].astype(float) * mask[..., None], dy, 0), dx, 1)
            count += np.roll(np.roll(mask, dy, 0), dx, 1)
        out[edge, :3] = (neighbor / np.maximum(count, 1)[..., None] * .3).astype('uint8')[edge]
        out[edge, 3] = 255
        out[out[..., 3] == 0] = 0
        im = Image.fromarray(out)
        im.save(ART / 'sprites' / 'hero' / (name + '.png'))
        atlas['hero'][name] = [im.width, im.height, round(ax, 1), ay]
    atlas_path.write_text(json.dumps(atlas, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print('长戟：旧素材共享调色、1px描边、头部校准，输出', len(mapping), '帧')


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
