"""把 game.js 和 art/ 里的素材打包成单文件 index.html。用法：python3 tools/build.py（在仓库根目录运行）"""
import base64, json, os

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *p: os.path.join(R, *p)


def uri(path):
    ext = os.path.splitext(path)[1][1:].lower().replace('jpg', 'jpeg')
    return f'data:image/{ext};base64,' + base64.b64encode(open(path, 'rb').read()).decode()


atlas = json.load(open(P('art', 'sprites', 'atlas.json'), encoding='utf-8'))
import io
from PIL import Image


def sprite_uri(path):
    # 像素图颜色很少：转成 256 色调色板 PNG（透明度只有全透明/不透明），体积小很多且看不出差别
    im = Image.open(path).convert('RGBA')
    a = im.getchannel('A').point(lambda v: 255 if v > 127 else 0)
    im.putalpha(a)
    q = im.quantize(colors=255, method=Image.Quantize.FASTOCTREE)
    buf = io.BytesIO(); q.save(buf, 'PNG', optimize=True)
    raw = open(path, 'rb').read()
    data = buf.getvalue() if len(buf.getvalue()) < len(raw) else raw
    return 'data:image/png;base64,' + base64.b64encode(data).decode()


assets = {'chars': {ch: {f: [sprite_uri(P('art', 'sprites', ch, f + '.png'))] + v for f, v in fr.items()} for ch, fr in atlas.items()}}
pm = json.load(open(P('art', 'props', 'meta.json')))
_src = open(P('game.js'), encoding='utf-8').read()
# 只打包 game.js 里实际用到的道具（按名字出现与否判断），减小网页体积
assets['props'] = {k: [uri(P('art', 'props', k + '.png'))] + v for k, v in pm.items() if f"'{k}'" in _src}
# 配音：art/voice/*.mp3 → ASSETS.voice[名字]
assets['title'] = uri(P('art', 'title', 'home.webp'))
assets['tvMask'] = uri(P('art', 'title', 'tv_mask.png'))   # 电视屏幕遮罩（绿幕形状，含猫爪镂空）   # 首页背景（电视屏幕是绿的，留给实时演示）
assets['voice'] = {os.path.splitext(os.path.basename(f))[0]: 'data:audio/mpeg;base64,' + base64.b64encode(open(f, 'rb').read()).decode()
                   for f in sorted(__import__('glob').glob(P('art', 'voice', '*.mp3')))}
bg = {'mid': uri(P('art', 'bg', 'village_mid.webp')), 'far': uri(P('art', 'bg', 'village_far.jpg')),
      'gnd': uri(P('art', 'bg', 'village_ground.jpg'))}
# js/ 里的模块（按文件名排序）先于 game.js 载入，供 game.js 调用
import glob
mods = sorted(glob.glob(P('js', '*.js')))
game = '\n'.join(open(f, encoding='utf-8').read() for f in mods) + '\n' + open(P('game.js'), encoding='utf-8').read()
h = open(P('index.src.html'), encoding='utf-8').read()
h = h.replace('__ASSETS__', json.dumps(assets)).replace('__BG__', json.dumps(bg)).replace('__GAME__', game)
open(P('index.html'), 'w', encoding='utf-8').write(h)
print('index.html', len(h) // 1024, 'KB')
