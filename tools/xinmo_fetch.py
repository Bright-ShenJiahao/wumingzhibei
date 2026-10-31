"""下载心魔对局数据（训练神经网络用）。
用法：python3 tools/xinmo_fetch.py 站长密钥 [网址，默认 https://wumingzhibei.netlify.app]
数据存到 data/xinmo/ep_*.json（已下过的跳过）；每局：cols 列名 + rows 每 0.1 秒一行。"""
import json, os, sys, urllib.parse, urllib.request
key = sys.argv[1]; base = (sys.argv[2] if len(sys.argv) > 2 else 'https://wumingzhibei.netlify.app').rstrip('/')
out = os.path.join(os.path.dirname(__file__), '..', 'data', 'xinmo'); os.makedirs(out, exist_ok=True)
get = lambda q: urllib.request.urlopen(base + '/api/xinmo?' + urllib.parse.urlencode(q), timeout=30).read()
eps = json.loads(get({'key': key}))['eps']; new = 0
for ep in eps:
    path = os.path.join(out, ep.replace(':', '_') + '.json')
    if os.path.exists(path): continue
    open(path, 'wb').write(get({'key': key, 'ep': ep})); new += 1
print(f'共 {len(eps)} 局，新下载 {new} 局 → {os.path.abspath(out)}')
