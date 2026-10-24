"""从用户提供的参考音频分离单次大鼓。参考原曲不打包，仅保留鼓击音色。"""
import subprocess
import sys
import wave
from pathlib import Path
import numpy as np
from scipy import signal, ndimage

ROOT = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]) if len(sys.argv)>1 else Path('C:/Users/hangs/Downloads/videoplayback (1).m4a')
temp = ROOT/'build/music/reference-analysis.wav'
temp.parent.mkdir(parents=True, exist_ok=True)
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(source),'-ac','1','-ar','22050',str(temp)],check=True)
with wave.open(str(temp),'rb') as w:
    sr=w.getframerate(); raw=np.frombuffer(w.readframes(w.getnframes()),'<i2').astype(float)/32768
f,t,z=signal.stft(raw,fs=sr,nperseg=1024,noverlap=768)
mag=abs(z)
harmonic=ndimage.median_filter(mag,size=(1,25))
percussive=ndimage.median_filter(mag,size=(21,1))
mask=percussive**2/(percussive**2+harmonic**2+1e-12)
_,perc=signal.istft(z*mask,fs=sr,nperseg=1024,noverlap=768)
perc=perc[:len(raw)]
low=signal.sosfilt(signal.butter(3,270,fs=sr,output='sos'),raw)
high=signal.sosfilt(signal.butter(3,[270,2600],fs=sr,btype='bandpass',output='sos'),perc)
# 重鼓4.59秒前预留少量起音；在下一个鼓点前淡出，保留鼓腔余韵。
start=round(4.565*sr); n=round(.49*sr)
hit=(low[start:start+n]+high[start:start+n]*.8)
hit-=hit.mean()
hit[:round(.004*sr)]*=np.linspace(0,1,round(.004*sr))
tail=round(.16*sr);hit[-tail:]*=np.linspace(1,0,tail)**1.5
hit/=max(abs(hit).max(),1e-6);hit*=.82
# 只为鼓击增加短距离早期反射，不复制参考曲的其他音乐。
room=np.zeros(n+round(.17*sr))
room[:n]=hit
for delay,gain in [(.037,.12),(.073,.08),(.127,.045)]:
    j=round(delay*sr);room[j:j+n]+=hit*gain
room/=max(1,abs(room).max()/.86)
out=ROOT/'art/audio/southern_drum.wav';out.parent.mkdir(exist_ok=True)
with wave.open(str(out),'wb') as w:
    w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr);w.writeframes((room*32767).astype('<i2').tobytes())
print(out)
