"""按人工确认的独立区域导入Gemini汉弓；不合并脱手箭，不按武器高度缩放人物。"""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from import_hero_weapons import strengthen_body

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art'
SOURCE = ART / 'gemini/白衣男主_汉弓_Gemini_v2.png'


def main(source=SOURCE, specs=None, mapping=None, preview_name='bow-gemini-contact.png', body_regions=None):
    is_bow = mapping is None
    rgb = np.asarray(Image.open(source).convert('RGB'))
    # 区域、头顶/下巴、脚底中心。右列第5格缺弓，禁止接入；飞箭由游戏投射物绘制。
    specs = specs or {
        'idle': ((60, 23, 205, 201), (31, 97), 119),
        'walk1': ((44, 208, 206, 378), (216, 282), 122),
        'walk2': ((42, 527, 210, 694), (533, 600), 121),
        'walk3': ((44, 695, 210, 859), (700, 764), 121),
        'draw1': ((425, 10, 642, 199), (31, 100), 503),
        'draw2': ((422, 207, 619, 375), (216, 283), 504),
        'draw3': ((420, 378, 618, 528), (384, 451), 503),
        'release1': ((422, 531, 580, 694), (536, 605), 501),
        'release2': ((420, 856, 580, 1024), (866, 935), 500),
    }
    body_regions = body_regions or {
        'idle': ((73, 156), 116, ((154, 156), (180, 62))),
        'walk1': ((60, 155), 121, ((157, 319), (182, 240))),
        'walk2': ((57, 158), 128, ((162, 638), (181, 550))),
        'walk3': ((65, 159), 128, ((161, 796), (181, 714))),
        'draw1': ((433, 563), 501, ((564, 190), (546, 17))),
        'draw2': ((435, 563), 503, ((560, 367), (546, 213))),
        'draw3': ((437, 563), 505, ((560, 519), (548, 383))),
        'release1': ((436, 558), 502, ((558, 679), (549, 536))),
        'release2': ((435, 553), 500, ((553, 1007), (546, 868))),
    }
    frames = {}
    for name, (box, head, foot_x) in specs.items():
        x0, y0, x1, y1 = box
        color = rgb[y0:y1, x0:x1].copy()
        mask = color[..., 1].astype(int) - np.maximum(color[..., 0], color[..., 2]).astype(int) < 45
        labels, _ = ndimage.label(mask)
        sizes = np.bincount(labels.ravel()); sizes[0] = 0
        # 严格只取这一格的人物连通块：邻帧箭头、独立飞箭一律不并入。
        mask = labels == sizes.argmax()
        yy, xx = np.mgrid[y0:y1, x0:x1]
        bounds, head_x, shaft = body_regions[name]
        foot_y = y0 + np.nonzero(mask)[0].max()
        color, mask = strengthen_body(color, mask, xx, yy, head, (foot_x, foot_y), bounds, head_x, shaft)
        if is_bow:
            # 白衣躯干用纵向体积明暗替换腹部的两道横向灰褶；皮肤、黑描边不参与。
            c = color.astype(int)
            depth = (yy - head[1]) / max(1, foot_y - head[1])
            cloth = mask & (np.abs(xx - head_x) < 32) & (depth > .04) & (depth < .56)
            cloth &= (c.min(axis=2) > 115) & (c.max(axis=2) - c.min(axis=2) < 42)
            shade = np.clip((xx - head_x + 28) / 56 * .7 + depth * .3, 0, .99)
            ramp = np.array([(239, 242, 247), (220, 224, 232), (196, 202, 214)], dtype='uint8')
            color[cloth] = ramp[(shade * 3).astype(int)[cloth]]
        ys, xs = np.nonzero(mask)
        bx, by, ex, ey = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        color, mask = color[by:ey, bx:ex], mask[by:ey, bx:ex]
        scale = 29 / (head[1] - head[0])
        size = (round(color.shape[1] * scale), round(color.shape[0] * scale))
        # 高亮可达255，先转整型再加容差，避免uint8溢出把白色变紫。
        color[..., 1] = np.minimum(color[..., 1], np.maximum(color[..., 0], color[..., 2]).astype('int16') + 6)
        alpha = np.asarray(Image.fromarray((mask * 255).astype('uint8')).resize(size, Image.Resampling.BOX)) / 255
        premult = np.asarray(Image.fromarray((color * mask[..., None]).astype('uint8')).resize(size, Image.Resampling.BOX)).astype(float)
        color = (premult / np.maximum(alpha, 1e-3)[..., None]).clip(0, 255).astype('uint8')
        mask = alpha > .45
        if name == 'idle' or name.startswith('walk'):
            cut = round((head[1] - y0 - by) * scale)
            # 排除武器后的头顶/鞋底标记校准；保持头部29px，身体约75px含描边。
            foot_rows = np.nonzero(mask[:, max(0, round((foot_x - x0 - bx) * scale) - 22):round((foot_x - x0 - bx) * scale) + 23])[0]
            body_top = round((head[0] - y0 - by) * scale)
            lower_h = max(1, 73 - (cut - body_top))
            lower = Image.fromarray(np.dstack((color, mask.astype('uint8') * 255))[cut:])
            lower = lower.crop((0, 0, size[0], int(foot_rows.max()) + 1 - cut)).resize((size[0], lower_h), Image.Resampling.NEAREST)
            joined = np.concatenate((np.dstack((color, mask.astype('uint8') * 255))[:cut], np.asarray(lower)))
            color, mask = joined[..., :3], joined[..., 3] > 0
        ax = (foot_x - x0 - bx) * scale + 1
        # 弓弦在最终像素层单独绘制，避免连通块过滤和BOX采样丢掉细线。
        string_points = None
        if is_bow:
            anchors = {
                'idle': [(185, 61), (137, 167)], 'walk1': [(185, 239), (130, 348)],
                'walk2': [(184, 548), (134, 660)], 'walk3': [(184, 712), (135, 826)],
                'draw1': [(546, 18), (477, 99), (546, 184)],
                'draw2': [(546, 213), (478, 275), (546, 365)],
                'draw3': [(548, 383), (479, 438), (551, 520)],
                'release1': [(536, 533), (538, 672)],
                'release2': [(537, 866), (532, 980)],
            }
            def convert(p):
                x, y = p
                px, py = (x - x0 - bx) * scale + 1, (y - y0 - by) * scale + 1
                if name == 'idle' or name.startswith('walk'):
                    if py - 1 > cut:
                        py = cut + (py - 1 - cut) * lower_h / max(1, int(foot_rows.max()) + 1 - cut) + 1
                return round(px), round(py)
            string_points = [convert(p) for p in anchors[name]]
        frames[name] = (color.copy(), mask, ax, string_points)

    reference = []
    for name in ['staff0', 'hammer0', 'stone0']:
        a = np.asarray(Image.open(ART / 'sprites/hero' / (name + '.png')).convert('RGBA'))
        reference.append(a[..., :3][a[..., 3] > 0])
    skin_colors = np.array([(112, 70, 58), (145, 93, 76), (190, 116, 94), (204, 130, 103), (229, 152, 117), (251, 183, 136), (252, 189, 140)], dtype='uint8')
    weight = np.array([np.all(reference[0] == c, axis=1).sum() for c in skin_colors])
    target = np.cumsum(weight) / weight.sum()
    for color, mask, _, _ in frames.values():
        c = color.astype(float)
        skin = mask & (c[..., 0] > 95) & (c[..., 0] > c[..., 1] * 1.15) & (c[..., 0] < c[..., 1] * 2.05) & (c[..., 1] > c[..., 2] * 1.05)
        light = np.rint(c[skin] @ np.array([.299, .587, .114])).astype(int)
        hist = np.bincount(light, minlength=256)
        cdf = (np.cumsum(hist) - hist / 2) / max(1, hist.sum())
        color[skin] = skin_colors[np.searchsorted(target, cdf[light]).clip(0, 6)]
    donors = np.concatenate(reference * 6 + [c[m] for c, m, _, _ in frames.values()])
    palette = Image.fromarray(donors[None]).quantize(colors=32, method=Image.Quantize.MEDIANCUT)
    mapping = mapping or {'bow0': 'idle', 'boww1': 'walk1', 'boww2': 'walk2', 'boww3': 'walk3',
               'bow_1a': 'draw1', 'bow_1b': 'release1', 'bow_2a': 'draw2', 'bow_2b': 'release2',
               'bow_3a': 'draw3', 'bow_3b': 'release2'}
    atlas_path = ART / 'sprites/atlas.json'
    atlas = json.loads(atlas_path.read_text(encoding='utf-8'))
    for name, pose in mapping.items():
        color, mask, ax, string_points = frames[pose]
        color = np.asarray(Image.fromarray(color).quantize(palette=palette, dither=Image.Dither.NONE).convert('RGB'))
        h, w = mask.shape
        out = np.zeros((h + 2, w + 2, 4), dtype='uint8')
        out[1:-1, 1:-1, :3], out[1:-1, 1:-1, 3] = color, mask * 255
        on = out[..., 3] > 0
        edge = ndimage.binary_dilation(on) & ~on
        neighbor = np.zeros_like(out[..., :3], dtype=float); count = np.zeros(on.shape)
        for dy, dx in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
            neighbor += np.roll(np.roll(out[..., :3] * on[..., None], dy, 0), dx, 1)
            count += np.roll(np.roll(on, dy, 0), dx, 1)
        average = neighbor / np.maximum(count, 1)[..., None]
        out[edge, :3] = (average * .3).astype('uint8')[edge]
        out[edge, 3] = 255; out[out[..., 3] == 0] = 0
        # 人物原有深色外轮廓保留；白/青刀光的外沿不额外套一圈黑边。
        bright_edge = edge & (average.min(axis=2) > 175)
        out[bright_edge] = 0
        im = Image.fromarray(out)
        if string_points:
            # 线放在人物后面，再叠人物，弦经过手指处自然被手掌遮挡。
            layer = Image.new('RGBA', im.size)
            ImageDraw.Draw(layer).line(string_points, fill=(169, 154, 119, 255), width=1)
            layer.alpha_composite(im)
            im = layer
        im.save(ART / 'sprites/hero' / (name + '.png'))
        ay = int(np.nonzero(out[..., 3])[0].max()) + 1
        atlas['hero'][name] = [im.width, im.height, round(ax, 1), ay]
        print(name, im.size, 'anchor=', round(ax, 1), ay)
    atlas_path.write_text(json.dumps(atlas, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    columns = 4
    names = ['hammer0', 'staff0'] + list(mapping)
    preview = Image.new('RGBA', (columns * 500, ((len(names) + columns - 1) // columns) * 400), (226, 216, 192, 255))
    d = ImageDraw.Draw(preview)
    for i, name in enumerate(names):
        w, h, ax, ay = atlas['hero'][name]
        x, y = i % columns * 500, i // columns * 400
        im = Image.open(ART / 'sprites/hero' / (name + '.png')).convert('RGBA')
        preview.alpha_composite(im.resize((w * 3, h * 3), Image.Resampling.NEAREST), (round(x + 160 - ax * 3), round(y + 330 - ay * 3)))
        d.line((x + 5, y + 330, x + 495, y + 330), fill=(160, 140, 110))
        d.text((x + 10, y + 10), name, fill=(40, 30, 25))
    (ROOT / 'build').mkdir(exist_ok=True)
    preview.save(ROOT / 'build' / preview_name)


if __name__ == '__main__':
    main()
