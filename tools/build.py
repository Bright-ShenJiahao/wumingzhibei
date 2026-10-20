"""把 game.js 和 art/ 里的素材打包成单文件 index.html。用法：python3 tools/build.py（在仓库根目录运行）"""
import base64, json, os

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *p: os.path.join(R, *p)


def uri(path):
    ext = os.path.splitext(path)[1][1:].lower().replace('jpg', 'jpeg')
    return f'data:image/{ext};base64,' + base64.b64encode(open(path, 'rb').read()).decode()


ph = P('art', 'sprites', 'placeholder')
meta = json.load(open(os.path.join(ph, 'meta.json')))
assets = {
    'hero': uri(P('art', 'sprites', 'farmer_sheet.png')),
    'z1': uri(os.path.join(ph, 'zombie.png')), 'z2': uri(os.path.join(ph, 'zombie_attack.png')),
    'tree': uri(os.path.join(ph, 'tree.png')),
    'houses': [[uri(os.path.join(ph, f'house{i}.png'))] + m for i, m in enumerate(meta['houses'])],
}
pm = json.load(open(P('art', 'props', 'meta.json')))
assets['props'] = {k: [uri(P('art', 'props', k + '.png'))] + v for k, v in pm.items()}
bg = {'mid': uri(P('art', 'bg', 'village_mid.webp')), 'far': uri(P('art', 'bg', 'village_far.jpg')),
      'gnd': uri(P('art', 'bg', 'village_ground.jpg'))}
h = open(P('index.src.html'), encoding='utf-8').read()
h = h.replace('__ASSETS__', json.dumps(assets)).replace('__BG__', json.dumps(bg)).replace('__GAME__', open(P('game.js'), encoding='utf-8').read())
open(P('index.html'), 'w', encoding='utf-8').write(h)
print('index.html', len(h) // 1024, 'KB')
