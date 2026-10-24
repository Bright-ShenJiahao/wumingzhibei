"""按人工确认的独立区域导入Gemini汉弓；不合并脱手箭，不按武器高度缩放人物。"""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art'
SOURCE = ART / 'gemini/白衣男主_汉弓_Gemini_v2.png'


def main():
    rgb = np.asarray(Image.open(SOURCE).convert('RGB'))
    # 区域、头顶/下巴、脚底中心。右列第5格缺弓，禁止接入；飞箭由游戏投射物绘制。
    specs = {
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
    frames = {}
    for name, (box, head, foot_x) in specs.items():
        x0, y0, x1, y1 = box
        color = rgb[y0:y1, x0:x1].copy()
        mask = color[..., 1].astype(int) - np.maximum(color[..., 0], color[..., 2]).astype(int) < 45
        labels, _ = ndimage.label(mask)
        sizes = np.bincount(labels.ravel()); sizes[0] = 0
        # 严格只取这一格的人物连通块：邻帧箭头、独立飞箭一律不并入。
        mask = labels == sizes.argmax()
        ys, xs = np.nonzero(mask)
        bx, by, ex, ey = xs.min(), ys.min(), xs.max() + 1, ys.max() + 1
        color, mask = color[by:ey, bx:ex], mask[by:ey, bx:ex]
        scale = 29 / (head[1] - head[0])
        size = (round(color.shape[1] * scale), round(color.shape[0] * scale))
        color[..., 1] = np.minimum(color[..., 1], np.maximum(color[..., 0], color[..., 2]) + 6)
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
        frames[name] = (color.copy(), mask, ax)

    reference = []
    for name in ['staff0', 'hammer0', 'stone0']:
        a = np.asarray(Image.open(ART / 'sprites/hero' / (name + '.png')).convert('RGBA'))
        reference.append(a[..., :3][a[..., 3] > 0])
    skin_colors = np.array([(112, 70, 58), (145, 93, 76), (190, 116, 94), (204, 130, 103), (229, 152, 117), (251, 183, 136), (252, 189, 140)], dtype='uint8')
    weight = np.array([np.all(reference[0] == c, axis=1).sum() for c in skin_colors])
    target = np.cumsum(weight) / weight.sum()
    for color, mask, _ in frames.values():
        c = color.astype(float)
        skin = mask & (c[..., 0] > 95) & (c[..., 0] > c[..., 1] * 1.15) & (c[..., 0] < c[..., 1] * 2.05) & (c[..., 1] > c[..., 2] * 1.05)
        light = np.rint(c[skin] @ np.array([.299, .587, .114])).astype(int)
        hist = np.bincount(light, minlength=256)
        cdf = (np.cumsum(hist) - hist / 2) / max(1, hist.sum())
        color[skin] = skin_colors[np.searchsorted(target, cdf[light]).clip(0, 6)]
    donors = np.concatenate(reference * 6 + [c[m] for c, m, _ in frames.values()])
    palette = Image.fromarray(donors[None]).quantize(colors=32, method=Image.Quantize.MEDIANCUT)
    mapping = {'bow0': 'idle', 'boww1': 'walk1', 'boww2': 'walk2', 'boww3': 'walk3',
               'bow_1a': 'draw1', 'bow_1b': 'release1', 'bow_2a': 'draw2', 'bow_2b': 'release2',
               'bow_3a': 'draw3', 'bow_3b': 'release2'}
    atlas_path = ART / 'sprites/atlas.json'
    atlas = json.loads(atlas_path.read_text(encoding='utf-8'))
    for name, pose in mapping.items():
        color, mask, ax = frames[pose]
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
        out[edge, :3] = (neighbor / np.maximum(count, 1)[..., None] * .3).astype('uint8')[edge]
        out[edge, 3] = 255; out[out[..., 3] == 0] = 0
        im = Image.fromarray(out)
        im.save(ART / 'sprites/hero' / (name + '.png'))
        ay = int(np.nonzero(out[..., 3])[0].max()) + 1
        atlas['hero'][name] = [im.width, im.height, round(ax, 1), ay]
        print(name, im.size, 'anchor=', round(ax, 1), ay)
    atlas_path.write_text(json.dumps(atlas, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    preview = Image.new('RGBA', (1500, 760), (226, 216, 192, 255))
    d = ImageDraw.Draw(preview)
    for i, name in enumerate(['hammer0', 'staff0'] + list(mapping)):
        w, h, ax, ay = atlas['hero'][name]
        x, y = i % 6 * 250, i // 6 * 380
        im = Image.open(ART / 'sprites/hero' / (name + '.png')).convert('RGBA')
        preview.alpha_composite(im.resize((w * 3, h * 3), Image.Resampling.NEAREST), (round(x + 90 - ax * 3), round(y + 330 - ay * 3)))
        d.line((x + 5, y + 330, x + 245, y + 330), fill=(160, 140, 110))
        d.text((x + 10, y + 10), name, fill=(40, 30, 25))
    (ROOT / 'build').mkdir(exist_ok=True)
    preview.save(ROOT / 'build/bow-gemini-contact.png')


if __name__ == '__main__':
    main()
