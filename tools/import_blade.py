"""精确绿幕遮罩去掉右列第4格副刀，再按独立区域导入大刀动作。"""
from PIL import Image, ImageDraw
import numpy as np
from import_bow_gemini import ROOT, ART, main as import_sheet


def main():
    source = Image.open(ART / 'gemini/白衣男主_大刀_原图_v1.png').convert('RGB')
    # 只覆盖副刀与刀柄；不涉及第3格的正常刀，也不覆盖第4格手掌/手臂。
    green = source.getpixel((370, 553))
    d = ImageDraw.Draw(source)
    d.polygon([(376, 540), (404, 539), (455, 568), (458, 576), (451, 580), (376, 556)], fill=green)
    (ROOT / 'build').mkdir(exist_ok=True)
    cleaned = ROOT / 'build/blade-cleaned-sheet.png'
    source.save(cleaned)
    specs = {
        'idle': ((48, 25, 184, 204), (34, 104), 109),
        'walk1': ((35, 206, 180, 372), (210, 282), 117),
        'walk2': ((410, 858, 626, 1024), (865, 934), 483),
        'walk3': ((14, 857, 187, 1024), (862, 932), 111),
        'guard': ((49, 373, 200, 536), (390, 460), 119),
        'overhead': ((35, 539, 202, 697), (545, 614), 114),
        'back': ((20, 699, 210, 857), (705, 773), 116),
        'thrust': ((411, 47, 731, 204), (53, 119), 477),
        'sweep': ((412, 194, 704, 373), (222, 286), 482),
        'spin': ((362, 387, 678, 535), (395, 464), 486),
        'down': ((376, 539, 658, 697), (552, 619), 482),
        'slam': ((416, 695, 694, 861), (711, 779), 488),
    }
    regions = {
        'idle': ((73, 148), 110, ((74, 158), (169, 50))),
        'walk1': ((60, 151), 122, ((61, 290), (149, 362))),
        'walk2': ((420, 547), 495, ((539, 952), (615, 918))),
        'walk3': ((58, 171), 130, ((22, 1008), (88, 918))),
        'guard': ((74, 163), 136, ((167, 482), (178, 379))),
        'overhead': ((70, 160), 120, ((57, 566), (186, 576))),
        'back': ((65, 167), 131, ((39, 717), (102, 813))),
        'thrust': ((420, 556), 503, ((555, 125), (653, 122))),
        'sweep': ((422, 575), 515, ((576, 290), (665, 285))),
        'spin': ((429, 555), 534, ((453, 440), (372, 461))),
        'down': ((431, 562), 527, ((558, 652), (645, 681))),
        'slam': ((430, 569), 526, ((561, 730), (616, 850))),
    }
    mapping = {'blade0': 'idle', 'bladew1': 'walk1', 'bladew2': 'walk2', 'bladew3': 'walk3',
               'blade_1a': 'guard', 'blade_1b': 'thrust',
               'blade_2a': 'overhead', 'blade_2b': 'sweep',
               'blade_3a': 'back', 'blade_3b': 'spin',
               'blade_4a': 'overhead', 'blade_4b': 'down', 'blade_4c': 'slam'}
    import_sheet(cleaned, specs, mapping, 'blade-contact.png', regions)
    # 图标取第1格的同一把刀，单独限定轮廓，避免夹带人物。
    mask = Image.new('L', source.size)
    md = ImageDraw.Draw(mask)
    md.polygon([(69, 157), (82, 142), (104, 118), (130, 96), (151, 71), (166, 47),
                (171, 47), (172, 64), (161, 86), (139, 111), (111, 135), (86, 159), (76, 167)], fill=255)
    md.polygon([(60, 158), (73, 153), (74, 168), (69, 185), (61, 179)], fill=255)
    rgb = np.asarray(source)
    alpha = np.asarray(mask).copy()
    alpha[rgb[..., 1].astype(int) - np.maximum(rgb[..., 0], rgb[..., 2]).astype(int) > 45] = 0
    c = rgb.astype(float)
    skin = (c[..., 0] > 95) & (c[..., 0] > c[..., 1] * 1.15) & (c[..., 0] < c[..., 1] * 2.05) & (c[..., 1] > c[..., 2] * 1.05)
    alpha[skin] = 0
    icon = Image.fromarray(np.dstack((rgb, alpha)))
    icon = icon.crop(icon.getbbox())
    icon.thumbnail((48, 54), Image.Resampling.NEAREST)
    canvas = Image.new('RGBA', (64, 64))
    canvas.alpha_composite(icon, ((64 - icon.width) // 2, (64 - icon.height) // 2))
    canvas.save(ART / 'ui/w_blade.webp', lossless=True)


if __name__ == '__main__':
    main()
