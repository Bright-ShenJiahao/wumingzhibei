"""把 game.js 和 art/ 里的素材打包成单文件 index.html。用法：python3 tools/build.py（在仓库根目录运行）"""
import base64, json, os

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *p: os.path.join(R, *p)


def uri(path):
    ext = os.path.splitext(path)[1][1:].lower().replace('jpg', 'jpeg')
    return f'data:image/{ext};base64,' + base64.b64encode(open(path, 'rb').read()).decode()


atlas = json.load(open(P('art', 'sprites', 'atlas.json'), encoding='utf-8'))
assets = {'chars': {ch: {f: [uri(P('art', 'sprites', ch, f + '.png'))] + v for f, v in fr.items()} for ch, fr in atlas.items()}}
pm = json.load(open(P('art', 'props', 'meta.json')))
assets['props'] = {k: [uri(P('art', 'props', k + '.png'))] + v for k, v in pm.items()}
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
