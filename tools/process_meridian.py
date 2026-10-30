"""经脉素材：切 21 个图标、3 张横幅（经脉/神器/时装）、主角剪影；绿幕去背后存 art/ui/。"""
import numpy as np
from PIL import Image
from scipy import ndimage

def key(im):
    a = np.asarray(im.convert('RGB')).astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    d = g - np.maximum(r, b)
    al = np.clip(1 - (d - 20) / 50, 0, 1)
    g2 = np.minimum(g, np.maximum(r, b))
    return np.dstack([r, g2, b, al * 255]).clip(0, 255).astype('uint8')

src = key(Image.open('art/gemini/经脉_图标横幅.png'))
lab, n = ndimage.label(src[..., 3] > 128)
boxes = [s for s in ndimage.find_objects(lab) if (s[0].stop - s[0].start) * (s[1].stop - s[1].start) > 3000]
icons = [b for b in boxes if (b[1].stop - b[1].start) < 200 and (b[0].stop - b[0].start) < 200]
banners = sorted([b for b in boxes if (b[1].stop - b[1].start) > 600], key=lambda b: b[0].start)
print(len(icons), 'icons', len(banners), 'banners')
icons.sort(key=lambda b: (round(b[1].start / 150), b[0].start))   # 按列再按行
cols = sorted({round(b[1].start / 150) for b in icons})
for b in icons:
    c = cols.index(round(b[1].start / 150)); col = [x for x in icons if round(x[1].start / 150) == cols[c]]; r = col.index(b)
    Image.fromarray(src[b]).resize((96, 96), Image.LANCZOS).save(f'art/ui/mer_{r}{c}.png')
for name, b in zip(['banner_meridian', 'banner_artifact', 'banner_outfit'], banners):
    im = Image.fromarray(src[b]); im = im.resize((640, round(640 * im.height / im.width)), Image.LANCZOS); im.save(f'art/ui/{name}.png')
s = key(Image.open('art/gemini/经脉_主角剪影.png')); bb = Image.fromarray(s).getbbox(); im = Image.fromarray(s).crop(bb)
im.resize((round(520 * im.width / im.height), 520), Image.LANCZOS).save('art/ui/mer_body.png')
print('ok')
