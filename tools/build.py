"""把 game.js、js/ 模块打包成 index.html；图片、字体、音频优化后写进 pack/，index.html 只引用它们的网址。
用法：python3 tools/build.py（在仓库根目录运行）。需要 Pillow、fontTools；装了 brotli 才能输出 WOFF2 字体（否则退回 TTF）。

为什么不再把素材塞进 index.html：
- 素材单独成文件后，网址带内容指纹（?v=哈希），netlify.toml 给 /pack/* 设长期缓存。
  没改过的图片，玩家第二次打开就不用再下载；每次更新只下载改动的文件。
- index.html 本身只剩代码（约 0.5MB），每次发布玩家重新拿到的也只有这些。
"""
import base64, hashlib, io, json, os, re, glob

R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *p: os.path.join(R, *p)
PACK = P('pack')
_emitted = set()


def emit(rel, data):
    """把字节写到 pack/rel（内容没变就不改动文件），返回带指纹的网址。"""
    path = os.path.join(PACK, rel)
    norm = os.path.normpath(path)
    if norm in _emitted and open(path, 'rb').read() != data:
        raise SystemExit('打包冲突：两个不同的素材都要写到 pack/' + rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not (os.path.exists(path) and open(path, 'rb').read() == data):
        open(path, 'wb').write(data)
    _emitted.add(os.path.normpath(path))
    return 'pack/' + rel.replace(os.sep, '/') + '?v=' + hashlib.sha1(data).hexdigest()[:10]


def rel_of(path, ext=None):
    r = os.path.relpath(path, P('art'))
    # 转格式时保留原扩展名（home.png → home.png.webp），避免和同名的 home.webp 撞成同一个文件
    if ext and not r.lower().endswith('.' + ext): r = r + '.' + ext
    return r


from PIL import Image


def to_webp(im, lossless=False, quality=86):
    buf = io.BytesIO()
    if lossless: im.save(buf, 'WEBP', lossless=True, quality=100, method=6)
    else: im.save(buf, 'WEBP', quality=quality, method=6)
    return buf.getvalue()


# 转换缓存：源文件内容不变就直接复用 pack/ 里上次的结果（无损 webp 编码很慢，全量要一分多钟）
_CACHE_PATH = os.path.join(PACK, '.cache.json')
try: _cache = json.load(open(_CACHE_PATH, encoding='utf-8'))
except Exception: _cache = {}
_cache_used = {}


def cached(kind, path, make):
    raw = open(path, 'rb').read()
    key = kind + ':' + hashlib.sha1(raw).hexdigest()
    hit = _cache.get(key)
    if hit and os.path.isfile(os.path.join(PACK, hit)):
        _cache_used[key] = hit
        return emit(hit, open(os.path.join(PACK, hit), 'rb').read())
    url = make(raw)
    _cache_used[key] = url.split('?')[0][len('pack/'):]
    return url


def uri(path):
    return cached('img', path, lambda raw: _uri(path, raw))


def _uri(path, raw):
    """普通图片：webp 原样拷贝；png（带透明）转无损 webp；jpg 原样。取更小的那个。"""
    ext = os.path.splitext(path)[1][1:].lower()
    if ext == 'png':
        webp = to_webp(Image.open(path).convert('RGBA'), lossless=True)
        if len(webp) < len(raw): return emit(rel_of(path, 'webp'), webp)
    return emit(rel_of(path), raw)


def photo_uri(path, quality=86):
    return cached('photo', path, lambda raw: _photo_uri(path, raw, quality))


def _photo_uri(path, raw, quality):
    """手绘立绘这类照片质感的 png：有损 webp（保留透明）。"""
    webp = to_webp(Image.open(path).convert('RGBA'), quality=quality)
    return emit(rel_of(path, 'webp'), webp) if len(webp) < len(raw) else emit(rel_of(path), raw)


def file_uri(path):
    return emit(rel_of(path), open(path, 'rb').read())


atlas = json.load(open(P('art', 'sprites', 'atlas.json'), encoding='utf-8'))
def sprite_uri(path):
    return cached('sprite', path, lambda raw: _sprite_uri(path, raw))


def _sprite_uri(path, raw):
    # 像素图颜色很少：转成 256 色调色板（透明度只有全透明/不透明），再取 png / 无损 webp 中更小的
    im = Image.open(path).convert('RGBA')
    a = im.getchannel('A').point(lambda v: 255 if v > 127 else 0)
    im.putalpha(a)
    q = im.quantize(colors=255, method=Image.Quantize.FASTOCTREE)
    buf = io.BytesIO(); q.save(buf, 'PNG', optimize=True)
    best = min([(len(buf.getvalue()), 'png', buf.getvalue()), (len(raw), 'png', raw)], key=lambda t: t[0])
    webp = to_webp(q.convert('RGBA'), lossless=True)
    if len(webp) < best[0]: return emit(rel_of(path, 'webp'), webp)
    return emit(rel_of(path, 'png'), best[2])


# Atlas may contain optional frames not present in this checkout; package only available files.
assets = {'chars': {ch: {f: [sprite_uri(P('art', 'sprites', ch, f + '.png'))] + v
                         for f, v in fr.items() if os.path.isfile(P('art', 'sprites', ch, f + '.png'))}
                     for ch, fr in atlas.items()}}
# 主角换色区域图：只提供网址，不进首次加载；OUTFIT 在选中非默认颜色时才按需下载。
assets['heroMask'] = {f: sprite_uri(P('art', 'sprites', 'hero_mask', f + '.png'))
                      for f in atlas.get('hero', {})
                      if os.path.isfile(P('art', 'sprites', 'hero_mask', f + '.png'))}
pm = json.load(open(P('art', 'props', 'meta.json')))
_src = open(P('game.js'), encoding='utf-8').read()
# 只打包 game.js 里实际用到的道具（按名字出现与否判断），减小网页体积
assets['props'] = {k: [uri(P('art', 'props', k + '.png'))] + v for k, v in pm.items() if f"'{k}'" in _src}
# 配音：art/voice/*.mp3 → ASSETS.voice[名字]
assets['title'] = uri(P('art', 'title', 'home.webp'))
assets['room'] = uri(P('art', 'room', 'wake_outside.webp'))   # 农房内景
assets['tvMask'] = uri(P('art', 'title', 'tv_mask.png'))
# UI（卷轴/木牌按钮/印章）与回血食物
assets['ui'] = {k: uri(P('art', 'ui', k + '.webp')) for k in ('scroll', 'btn', 'btn_red', 'seal_square', 'seal_round', 'w_staff', 'w_hammer', 'w_stone', 'w_bow', 'arrow', 'fire0', 'fire1', 'fire2', 'fire3', 'rogue_card', 'charge_hit_staff', 'charge_hit_stone', 'stone_shot', 'stone_shot_final', 'stone_shot_charge', 'stone_hit', 'staff_sweep', 'hit_blunt', 'hit_finisher', 'halberd_rip', 'bleed_splash', 'bleed_drip', 'hammer_spin', 'hammer_slam', 'blade_slash', 'blade_crescent', 'bow_sky', 'bow_impact', 'bow_volley', 'enemy_slash', 'enemy_wave', 'tip_water1', 'tip_water2', 'tip_water3', 'tip_wave1', 'tip_wave2', 'tip_scare', 'tip_scare_hit', 'tip_scare_break1', 'tip_scare_break2', 'tip_wind1', 'tip_wind2', 'tip_wind3', 'tip_shield', 'tip_shield_break1', 'tip_shield_break2', 'tip_arrow', 'fj_ride', 'fj_stuck', 'fj_icon')}
assets['dialogPortraits'] = {
    'caocao': photo_uri(P('art', 'ui', 'portrait_caocao.png')),
    'messenger': photo_uri(P('art', 'ui', 'portrait_messenger.png')),
}
assets['ui']['w_blade'] = uri(P('art', 'ui', 'w_blade.webp'))
assets['ui']['w_halberd'] = uri(P('art', 'ui', 'w_halberd.webp'))
for _k in ('shopkeeper', 'shopkeeper_happy', 'shopkeeper_annoyed'):   # 商店老板三种表情
    if os.path.exists(P('art', 'ui', _k + '.webp')): assets['ui'][_k] = uri(P('art', 'ui', _k + '.webp'))
assets['music'] = {'southernDrum': file_uri(P('art', 'audio', 'southern_drum.wav'))}
_fm = json.load(open(P('art', 'food', 'meta.json'), encoding='utf-8'))
assets['food'] = {k: [uri(P('art', 'food', k + '.png'))] + v for k, v in _fm.items()}

# 结算字体的毛笔字子集（Ma Shan Zheng，OFL）：只保留游戏里真正用到的字，压到 100KB 以内
FONT_SRC = P('tools', 'fonts', 'MaShanZheng-Regular.ttf')
FONT_OUT = P('art', 'fonts', 'result.ttf')
os.makedirs(P('art', 'fonts'), exist_ok=True)
_gsrc = open(P('game.js'), encoding='utf-8').read()
_i = _gsrc.find('const DEATH_LINES')
_body = _gsrc + ''.join(open(f, encoding='utf-8').read() for f in __import__('glob').glob(P('js', '*.js')))  # 全部游戏字符串都进子集，避免结算/UI 某些字回退成系统字体
_chars = set()
for _m in __import__('re').findall(r"'([^'\\]*)'|\"([^\"\\]*)\"|`([^`\\]*)`", _body):
    for _t in _m:
        _chars |= set(_t)
_chars |= set('通关倒下败分享再来一局返回首页评价击倒用时被击全程无伤名次SSSABCDE0123456789:·— ！？，。')
_chars = {c for c in _chars if c.strip()}
_chars |= set('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ')
if os.path.exists(FONT_SRC):
    from fontTools import subset as _sub
    _o = _sub.Options(); _o.name_IDs = ['*']; _o.recalc_bounds = True
    _f = _sub.load_font(FONT_SRC, _o)
    _ss = _sub.Subsetter(_o); _ss.populate(text=''.join(sorted(_chars)))
    _ss.subset(_f); _sub.save_font(_f, FONT_OUT, _o)
    print('font subset', ''.join(sorted(_chars)).__len__(), 'chars,', os.path.getsize(FONT_OUT) // 1024, 'KB')
FONT_FACE = ''
if os.path.exists(FONT_OUT):
    try:
        import brotli  # noqa: F401  （fontTools 输出 woff2 需要）
        from fontTools.ttLib import TTFont
        _tt = TTFont(FONT_OUT); _tt.flavor = 'woff2'; _b = io.BytesIO(); _tt.save(_b)
        _font_url, _fmt = emit('fonts/result.woff2', _b.getvalue()), 'woff2'
    except ImportError:
        print('提示：没装 brotli（pip install brotli），字体退回 TTF，体积大一倍')
        _font_url, _fmt = emit('fonts/result.ttf', open(FONT_OUT, 'rb').read()), 'truetype'
    FONT_FACE = '<link rel="preload" href="' + _font_url + '" as="font" type="font/' + ('woff2' if _fmt == 'woff2' else 'ttf') + '" crossorigin><style>@font-face{font-family:"MaShanZheng";src:url(' + _font_url + ')format("' + _fmt + '");font-display:swap}</style>'
assets['voice'] = {os.path.splitext(os.path.basename(f))[0]: file_uri(f)
                   for f in sorted(__import__('glob').glob(P('art', 'voice', '*.mp3')))}
bg = {'mid': uri(P('art', 'bg', 'village_mid.webp')), 'far': uri(P('art', 'bg', 'village_far.jpg')),
      'gnd': uri(P('art', 'bg', 'village_ground.jpg'))}
assets['chapter2'] = {
    'far': uri(P('art', 'bg', 'chapter2_far.webp')),
    'battlefield': uri(P('art', 'bg', 'chapter2_battlefield.webp')),
    'altar': uri(P('art', 'bg', 'chapter2_altar.webp')),
    'altarFar': uri(P('art', 'bg', 'chapter2_altar_far.webp')),
}
assets['chapter2']['zj'] = {os.path.basename(f)[3:-5]: uri(f) for f in sorted(glob.glob(P('art', 'ui', 'zj_*.webp')))}
assets['xiaochang'] = uri(P('art', 'bg', 'xiaochang.webp'))
assets['chapter2Intro'] = uri(P('art', 'bg', 'chapter2_intro.webp'))
# js/ 里的模块（按文件名排序）先于 game.js 载入，供 game.js 调用
import glob
mods = sorted(glob.glob(P('js', '*.js')))
game = '\n'.join(open(f, encoding='utf-8').read() for f in mods) + '\n' + open(P('game.js'), encoding='utf-8').read()

def _art_literal(m):
    path = P(*m.group(0).split('/'))
    if not os.path.isfile(path): return m.group(0)
    if path.lower().endswith('.png'):
        return sprite_uri(path) if os.sep + 'sprites' + os.sep in path else uri(path)
    return file_uri(path)
_ART_RE = r"(?<=['\"(])art/[A-Za-z0-9_\-/]+\.(?:webp|png|jpg|jpeg)"   # 只换引号、括号里的路径，注释里的不动
game = re.sub(_ART_RE, _art_literal, game)
h = open(P('index.src.html'), encoding='utf-8').read()
h = re.sub(_ART_RE, _art_literal, h)
h = h.replace('__FONT_FACE__', FONT_FACE)
h = h.replace('__ASSETS__', json.dumps(assets)).replace('__BG__', json.dumps(bg)).replace('__GAME__', game)
# 版本号：首页内容指纹，写进首页和 version.json，页面据此判断线上有没有新版本（自动更新）
_build_id = __import__('hashlib').sha256(h.encode('utf-8')).hexdigest()[:12]
h = h.replace('__BUILD__', _build_id)
open(P('version.json'), 'w', encoding='utf-8').write(json.dumps({'v': _build_id}))
open(P('index.html'), 'w', encoding='utf-8').write(h)
_stale = 0
for root, _, files in os.walk(PACK):
    for f in files:
        full = os.path.normpath(os.path.join(root, f))
        if full not in _emitted and f != '.cache.json': os.remove(full); _stale += 1
json.dump(_cache_used, open(_CACHE_PATH, 'w', encoding='utf-8'), ensure_ascii=False, indent=0, sort_keys=True)
total = sum(os.path.getsize(f) for f in _emitted)
print('index.html', len(h.encode('utf-8')) // 1024, 'KB；pack/', len(_emitted), '个文件', total // 1024, 'KB' + ('；清理旧文件 %d 个' % _stale if _stale else ''))

# 每次打包使用首页内容指纹；首页必需素材在此维护。
_sw_template = open(P('tools', 'sw.template.js'), encoding='utf-8-sig').read()
_sw_hash = __import__('hashlib').sha256(h.encode('utf-8')).hexdigest()[:16]
_pre_cache = ['/index.html', '/' + assets['title'], '/' + assets['tvMask']]
if FONT_FACE: _pre_cache.append('/' + _font_url)
open(P('sw.js'), 'w', encoding='utf-8').write(_sw_template.replace('__CACHE__', 'wzb-' + _sw_hash).replace('__PRECACHE__', json.dumps(_pre_cache)))
