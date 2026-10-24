"""从真实BGM曲谱导出第二章试听小样；音色为离线近似，游戏仍使用Web Audio合成。"""
import json
import subprocess
import wave
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'build/music'
OUT.mkdir(parents=True, exist_ok=True)
exporter = r"""
const fs=require('fs'),vm=require('vm');
const src=fs.readFileSync('js/bgm.js','utf8').replace('buildTracks();','buildTracks(); globalThis.score = TRACKS;');
const ctx={window:{AudioContext:function(){}},addEventListener(){},console};
vm.runInNewContext(src,ctx);
process.stdout.write(JSON.stringify(ctx.score));
"""
tracks = json.loads(subprocess.check_output(['node', '-e', exporter], cwd=ROOT, encoding='utf-8'))
SR = 22050
rng = np.random.default_rng(126)
pent = [0, 3, 5, 7, 10]
def dn(d):
    return 45 + 12 * (d // 5) + pent[d % 5]
def freq(m):
    return 440 * 2 ** ((m - 69) / 12)
def add(out, start, samples):
    i = round(start * SR)
    n = min(len(samples), len(out) - i)
    if n > 0:
        out[i:i+n] += samples[:n]
def pluck(m, vel, dur=.7):
    t = np.arange(round((dur + .1) * SR)) / SR
    f = freq(m)
    env = np.exp(-9.2 * t / dur) * np.minimum(1, t / .005)
    return vel * env * (np.sin(2*np.pi*f*t) + .4*np.sin(4*np.pi*f*t) + .18*np.sin(6*np.pi*f*t))
def drum(kind, vel):
    t = np.arange(round(.8 * SR)) / SR
    start, end, decay = (250, 105, .32) if kind == 'tom' else (150, 44, .46)
    k = np.log(end / start) / .2
    phase = 2*np.pi*start*(np.exp(k*np.minimum(t,.2))-1)/k + 2*np.pi*end*np.maximum(0,t-.2)
    s = vel*np.sin(phase)*np.exp(-9.2*t/decay)*np.minimum(1,t/.006)
    s += vel*.15*rng.normal(size=len(t))*np.exp(-t/.025)
    if kind == 'kick' and vel > .45:
        s += vel*.6*np.sin(2*np.pi*(36*t+36*.12*(1-np.exp(-t/.12))))*np.exp(-t/.18)
    if kind == 'snare':
        s = vel*.45*rng.normal(size=len(t))*np.exp(-t/.03)
    return s
def voice(m, dur, vel, horn=False):
    t = np.arange(round((dur+.05)*SR))/SR
    f = freq(m)
    s = np.sin(2*np.pi*f*t)
    if horn:
        s += .35*np.sin(4*np.pi*f*t)+.18*np.sin(6*np.pi*f*t)
    return vel*s*np.minimum(1,t/(.065 if horn else .025))*np.exp(-6*t/dur)
DRUM = {'1':('kick',.3),'2':('kick',.5),'3':('kick',.78),'4':('snare',.34),'5':('tom',.5)}
def render(name, first_bar):
    tr = tracks[name]; beat = 60/tr['bpm']; duration = 8*4*beat
    out = np.zeros(round((duration+1)*SR))
    for b in range(8):
        bar = first_bar+b; base = b*4*beat; root = [0,0,3,2][(bar//4)%4]
        for st,c in enumerate(tr['drums'][tr['drumArr'][bar]]):
            if c in DRUM:
                kind,v=DRUM[c]; add(out,base+st*beat/4,drum(kind,v*tr['lv']['drum']))
        for ev in tr['ph'][tr['melArr'][bar]]:
            st,d,*rest=ev; add(out,base+st*beat/4,pluck(dn(d),(rest[0] if rest else .34)*tr['lv']['pluck']))
        for st in range(16):
            at = base+st*beat/4
            if st==0 or (tr['war']>1 and st==8):
                add(out,at,voice(dn(root),.33,.075 if tr['war']>1 else .035)); add(out,at,drum('tom',.18))
            if tr['war']>1 and st%2==0:
                add(out,at,pluck(dn(root+(5 if st%4==0 else 7)),.065,.16))
            if tr['war']>1 and bar%4==0 and st in [0,6,10]:
                add(out,at,voice(dn({0:5,6:8,10:7}[st]),.42,.045,True))
        if str(bar) in tr.get('tones',{}):
            d,beats=tr['tones'][str(bar)]; add(out,base,voice(dn(d),beats*beat,.18))
    # 小样淡尾。真实游戏曲目按乐句时钟交叉淡入，不使用这个离线音频。
    out[-SR:] *= np.linspace(1,0,SR)
    return out[:round(duration*SR)]

parts=[render('warField',0),render('warBattle',8),render('warBoss',16)]
audio=np.concatenate(parts)
audio=np.tanh(audio*.9)*.68
audio[:round(.2*SR)]*=np.linspace(0,1,round(.2*SR))
audio[-SR:]*=np.linspace(1,0,SR)
with wave.open(str(OUT/'chapter2-battle-demo.wav'),'wb') as w:
    w.setnchannels(1);w.setsampwidth(2);w.setframerate(SR);w.writeframes((audio*32767).astype('<i2').tobytes())
print('Preview:',OUT/'chapter2-battle-demo.wav')
print('行军 0:00；交战 0:15.24；首领 0:30.48；音色为离线近似。')
