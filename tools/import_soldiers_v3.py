"""导入六兵 v3。原图只读；修复/排版在临时目录，通过 pixelize_sheet 转换。
运行 python tools/import_soldiers_v3.py；可重复运行，不会再次缩放已生成帧。
旧版（368313c）六个 idle 的头顶至鞋底均为74px（含描边），不含武器。
"""
from pathlib import Path
import json, subprocess, sys, tempfile, shutil
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
ROOT=Path(__file__).resolve().parents[1]
NAMES={'blade':'刀手','elite':'老卒','archer':'弓箭手','yellow_heavy':'大刀兵','yellow_shield':'刀盾兵','yellow_spear':'长枪兵'}
FR10=['idle','walk1','walk2','wind','strike','hurt','fly1','fly2','down','getup']
FR9=['idle','walk1','wind','strike','hurt','fly1','fly2','down','getup']
# 手工核对头部采样框，只包含头巾/头盔；脚底从 idle 下半部读取。
HEAD={'blade':(70,40,140,85),'elite':(70,20,140,65),'archer':(73,40,145,82),'yellow_heavy':(72,40,145,85),'yellow_shield':(70,25,135,80),'yellow_spear':(72,43,145,88)}
OLD_BODY={k:74 for k in NAMES}

def key(im):
 a=np.array(im.convert('RGBA'));r,g,b=[a[:,:,i].astype(int) for i in range(3)]
 # 深绿地影也属于绿幕；保留黄色衣物及暗黑轮廓。
 green=(g>r*1.25+8)&(g>b*1.25+8)
 a[green,3]=0
 a[:,:,1]=np.minimum(a[:,:,1],np.maximum(a[:,:,0],a[:,:,2]).astype(int)+6)
 return Image.fromarray(a)

def extract(im,poly):
 mask=Image.new('L',im.size);ImageDraw.Draw(mask).polygon(poly,fill=255)
 a=np.array(im);a[:,:,3]=np.minimum(a[:,:,3],np.array(mask))
 return Image.fromarray(a)

def rect(x0,y0,x1,y1):return [(x0,y0),(x1-1,y0),(x1-1,y1-1),(x0,y1-1)]

def frames(k,raw):
 if k=='elite':
  raw=raw.copy();d=ImageDraw.Draw(raw)
  for x in [204,409,615,819]:d.rectangle((x-2,0,x+2,571),fill=(0,255,0))
  d.rectangle((0,283,1023,289),fill=(0,255,0))
 im=key(raw)
 if k in ['blade','elite','yellow_heavy','yellow_shield']:
  xs=[0,205,410,615,820,1024]
  polys=[rect(xs[i],y,xs[i+1],y+286) for y in [0,286] for i in range(5)]
 elif k=='archer':
  xs=[0,205,410,625,820,1024]
  polys=[rect(xs[i],0,xs[i+1],286) for i in range(5)]+[rect(a,286,b,572) for a,b in [(0,300),(300,520),(520,810),(810,1024)]]
 else:
  polys=[rect(0,0,250,286),[(250,0),(438,0),(438,175),(400,200),(400,285),(240,285),(240,60)],[(438,0),(645,0),(645,135),(592,145),(592,285),(400,285),(400,200),(438,175)],[(645,0),(810,0),(810,130),(874,145),(874,175),(815,185),(815,285),(592,285),(592,145),(645,135)],[(810,0),(1023,0),(1023,285),(815,285),(815,185),(874,175),(874,145),(810,130)],rect(0,286,280,572),rect(280,286,540,572),rect(520,420,805,572),rect(805,286,1024,572)]
 out=[extract(im,p) for p in polys]
 if k in ['blade','yellow_heavy']:
  # 第5帧原图右边切断：向右续画刀身的上下轮廓，收成弧尖。
  f=Image.new('RGBA',(1060,572));f.alpha_composite(out[4]);d=ImageDraw.Draw(f)
  d.polygon([(1016,192),(1033,202),(1046,202),(1037,215),(1026,218),(1016,214)],fill=(30,29,29,255))
  d.polygon([(1017,196),(1032,206),(1040,205),(1034,212),(1026,214),(1017,211)],fill=(154,159,157,255))
  d.line([(1017,211),(1027,215),(1035,212),(1041,205)],fill=(223,225,219,255),width=2)
  out[4]=f
 if k=='archer':
  d=ImageDraw.Draw(out[5]);d.rectangle((231,291,299,367),fill=(0,0,0,0))
  # 第4帧已离弦的火箭归投射物系统，不让它粘进第5帧。
  ImageDraw.Draw(out[4]).rectangle((795,105,843,138),fill=(0,0,0,0))
 if k=='yellow_spear':
  ImageDraw.Draw(out[0]).rectangle((239,65,260,110),fill=(0,0,0,0))
  ImageDraw.Draw(out[2]).rectangle((630,125,650,175),fill=(0,0,0,0))
  ImageDraw.Draw(out[3]).rectangle((810,0,880,149),fill=(0,0,0,0))
  ImageDraw.Draw(out[7]).rectangle((0,0,558,465),fill=(0,0,0,0))
 if k=='archer':
  ImageDraw.Draw(out[2]).rectangle((607,0,625,89),fill=(0,0,0,0))
 if k=='yellow_shield':
  # 第7帧大盾的外轮廓；复用原盾，手部仍留在原人物帧。
  shield=extract(im,[(337,328),(390,311),(424,430),(370,445)]);shield=shield.crop(shield.getbbox())
  for idx,pos,angle in [(7,(588,430),-18),(8,(780,458),74)]:
   f=Image.new('RGBA',(1100,620));f.alpha_composite(out[idx]);sh=shield.rotate(angle,resample=Image.Resampling.NEAREST,expand=True);f.alpha_composite(sh,pos);out[idx]=f
 # 去掉切割边界留下的小碎片，不删主体或脱手武器。
 for i,f in enumerate(out):
  a=np.array(f);lab,n=ndimage.label(a[:,:,3]>0)
  for j in range(1,n+1):
   if np.sum(lab==j)<120:a[lab==j,3]=0
  out[i]=Image.fromarray(a)
 return out

def main():
 report={}
 with tempfile.TemporaryDirectory(prefix='soldiers-v3-') as td:
  tmp=Path(td)
  for k,name in NAMES.items():
   fs=frames(k,Image.open(ROOT/'art/gemini'/f'黄巾_{name}_v3.png'))
   idle=fs[0];head=idle.crop(HEAD[k]).getbbox();assert head
   top=HEAD[k][1]+head[1];bottom=idle.getbbox()[3]-1
   body=bottom-top+1
   crops=[f.crop(f.getbbox()) for f in fs]
   # pixelize 会额外画1px轮廓，故人物内部目标72，再按完整idle/本体比换算 ref。
   target=round((OLD_BODY[k]-2)*crops[0].height/body)
   # 每帧单独一行，给脱手武器和盾足够空间，避免串帧。
   sheet=Image.new('RGB',(650,len(crops)*430),(0,255,0))
   for i,c in enumerate(crops):sheet.paste(c,(100,i*430+60),c)
   path=tmp/(k+'.png');sheet.save(path)
   names=FR9 if len(fs)==9 else FR10
   subprocess.run([sys.executable,str(ROOT/'tools/pixelize_sheet.py'),str(path),k+':'+','.join(names),f'ref=idle:{target}'],check=True)
   atlas_path=ROOT/'art/sprites/atlas.json';atlas=json.loads(atlas_path.read_text())
   if k in ['elite','yellow_spear']:
    # 通用自动分组会丢弃位于身体上方且不重叠的脱手武器；按原帧完整外框补回。
    # 使用相同BOX缩放、32色调色板、1px描边，比例来自本角色idle而非武器。
    idx=names.index('fly1');f=crops[idx];sc=target/crops[0].height
    w,h=round(f.width*sc),round(f.height*sc)
    a=np.array(f).astype(float);m=a[:,:,3]/255
    P=np.array(Image.fromarray((a[:,:,:3]*m[:,:,None]).astype('uint8')).resize((w,h),Image.Resampling.BOX)).astype(float)
    A=np.array(Image.fromarray((m*255).astype('uint8')).resize((w,h),Image.Resampling.BOX)).astype(float)/255
    rgb=(P/np.maximum(A,1e-3)[:,:,None]).clip(0,255).astype('uint8');al=A>.45
    palette_pixels=[]
    for fn in names:
     src=np.array(Image.open(ROOT/f'art/sprites/{k}/{fn}.png'));palette_pixels.extend(src[src[:,:,3]>0,:3].tolist())
    pal=Image.fromarray(np.array(palette_pixels,dtype='uint8')[None]).quantize(colors=32)
    q=np.array(Image.fromarray(rgb).quantize(palette=pal,dither=Image.Dither.NONE).convert('RGB'))
    dest=np.zeros((h+2,w+2,4),dtype='uint8');dest[1:-1,1:-1,:3]=q;dest[1:-1,1:-1,3]=al*255
    on=dest[:,:,3]>0;edge=ndimage.binary_dilation(on)&~on
    nb=np.zeros((h+2,w+2,3));cnt=np.zeros((h+2,w+2))
    for dy,dx in [(1,0),(-1,0),(0,1),(0,-1)]:
     nb+=np.roll(np.roll(dest[:,:,:3].astype(float)*on[:,:,None],dy,0),dx,1);cnt+=np.roll(np.roll(on,dy,0),dx,1)
    dest[edge,:3]=(nb/np.maximum(cnt,1)[:,:,None]*.3).astype('uint8')[edge];dest[edge,3]=255
    Image.fromarray(dest).save(ROOT/f'art/sprites/{k}/fly1.png')
    ys,xs=np.nonzero(al);ax=(xs.min()+xs.max())/2 if w>h*1.3 else xs[ys>=ys.max()-max(2,h*.15)].mean()
    atlas[k]['fly1']=[w+2,h+2,round(float(ax)+1,1),int(ys.max())+1]
   if k in ['archer','yellow_spear','yellow_shield']:
    shutil.copyfile(ROOT/f'art/sprites/{k}/idle.png',ROOT/f'art/sprites/{k}/walk2.png');atlas[k]['walk2']=atlas[k]['idle'][:]
   shutil.copyfile(ROOT/f'art/sprites/{k}/down.png',ROOT/f'art/sprites/{k}/land.png');atlas[k]['land']=atlas[k]['down'][:]
   atlas_path.write_text(json.dumps(atlas,ensure_ascii=False,indent=0),encoding='utf-8')
   # 按原图本体顶/脚底映射回输出像素，包含转换器加的上下1px轮廓。
   exported=np.array(Image.open(ROOT/f'art/sprites/{k}/idle.png'))
   # 输出像素再次实测，头部横向采样窗避开枪尖/弓梢（见验收放大图）。
   hx0,hx1={'blade':(15,37),'elite':(20,37),'archer':(20,37),'yellow_heavy':(25,46),'yellow_shield':(20,40),'yellow_spear':(25,46)}[k]
   head_top=np.nonzero(exported[:int(exported.shape[0]*.4),hx0:hx1,3])[0].min()
   foot_bottom=np.nonzero(exported[:,:,3])[0].max()
   new_body=int(foot_bottom-head_top+1)
   assert abs(new_body-OLD_BODY[k])<=1,(k,new_body)
   report[k]={'old_body':OLD_BODY[k],'source_body':body,'source_head_y':top,'source_foot_y':bottom,'ref_idle':target,'new_body':new_body}
 print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
