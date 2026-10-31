"""下载心魔训练数据（公开接口，不用密钥）。
用法：python3 tools/xinmo_fetch.py [网址，默认 https://wumingzhibei.netlify.app]
数据存到 data/xinmo/（不进仓库）；已下过的跳过。"""
import json, os, sys, urllib.parse, urllib.request
base = (sys.argv[1] if len(sys.argv) > 1 else 'https://wumingzhibei.netlify.app').rstrip('/')
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data', 'xinmo'); os.makedirs(out, exist_ok=True)
get = lambda q: urllib.request.urlopen(base + '/api/xinmo' + ('?' + urllib.parse.urlencode(q) if q else ''), timeout=60).read()
eps = json.loads(get({}))['eps']; new = 0
for ep in eps:
    path = os.path.join(out, ep.replace(':', '_') + '.json')
    if os.path.exists(path): continue
    open(path, 'wb').write(get({'ep': ep})); new += 1
print(f'服务器上 {len(eps)} 局，新下载 {new} 局 → {os.path.abspath(out)}')
