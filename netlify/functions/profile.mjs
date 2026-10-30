// 已获用户授权：只保存本游戏的同名武器仓库、装备槽及章节进度。
import { getStore } from '@netlify/blobs';
import { createHash } from 'node:crypto';
import '../../js/cloud_merge.js';
import '../../js/equipment_rules.js';
import { pinStore, checkPin } from '../lib/pins.mjs';
export const config={path:'/api/profile'};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const TYPES=new Set(['staff','hammer','blade','stone','halberd','bow']);
function validate(p){
  if(!p||!Array.isArray(p.items)||p.items.length>globalThis.EQUIPMENT_RULES.capacityOf(p))throw new Error('身上与仓库合计最多50把武器，请先熔炼或丢弃');
  const clean=JSON.parse(JSON.stringify(p));
  if(!clean.items.every(i=>i&&TYPES.has(i.type)&&typeof i.uid==='string'&&i.uid.length<=100&&Number.isInteger(i.q)&&i.q>=0&&i.q<=5&&Array.isArray(i.affixes)&&i.affixes.length<=2))throw new Error('装备数据不合法');
  for(const key of ['_removed','_equipAt','equipped','campaign'])if(!clean[key]||typeof clean[key]!=='object'||Array.isArray(clean[key]))clean[key]={};
  const int=(v,fallback=0)=>{const n=Number(v);return Number.isInteger(n)&&n>=0&&n<=1e9?n:fallback;};
  if(clean.wallet!=null&&(typeof clean.wallet!=='object'||Array.isArray(clean.wallet)))throw new Error('金币数据不合法');
  if(clean.fruit!=null&&(typeof clean.fruit!=='object'||Array.isArray(clean.fruit)))throw new Error('彩色果数据不合法');
  clean.wallet={earned:int(clean.wallet?.earned),spent:int(clean.wallet?.spent)};
  clean.fruit={got:clean.fruit?int(clean.fruit.got,0):6,used:int(clean.fruit?.used)};
  if(clean.outfit!=null){
    const o=clean.outfit;
    if(typeof o!=='object'||Array.isArray(o)||!['hair','shirt','pants'].every(k=>Number.isInteger(o[k])&&o[k]>=0&&o[k]<=7))throw new Error('时装配色不合法');
    const at=Number(o._at), stamp=Number.isInteger(at)&&at>=0&&at<=Number.MAX_SAFE_INTEGER?at:0;
    clean.outfit={hair:o.hair,shirt:o.shirt,pants:o.pants,_at:stamp};
  }
  if(clean.artifacts!=null){
    const a=clean.artifacts;if(typeof a!=='object'||Array.isArray(a))throw new Error('神器数据不合法');
    const owned={};for(const k of ['feijian'])if(a.owned?.[k])owned[k]=1;
    const at=Number(a._at);clean.artifacts={owned,eq:typeof a.eq==='string'&&owned[a.eq]?a.eq:'',_at:Number.isInteger(at)&&at>=0&&at<=Number.MAX_SAFE_INTEGER?at:0};
  }
  if(clean.goods!=null){   // 商店消耗品
    const g=clean.goods;if(typeof g!=='object'||Array.isArray(g))throw new Error('商品数据不合法');
    const ok=k=>/^[a-z_]{1,12}$/.test(k),c={},off={};for(const k in (g.c||{}))if(ok(k))c[k]=Math.min(999,int(g.c[k]));for(const k in (g.off||{}))if(ok(k))off[k]=g.off[k]?1:0;
    const at=Number(g._at);clean.goods={c,off,bag:Math.min(3,int(g.bag)),fu:typeof g.fu==='string'&&ok(g.fu)?g.fu:'',_at:Number.isInteger(at)&&at>=0&&at<=Number.MAX_SAFE_INTEGER?at:0};
  }
  if(clean.meridian!=null){
    const m=clean.meridian;if(typeof m!=='object'||Array.isArray(m))throw new Error('经脉数据不合法');
    const got={};for(const k of ['ch1','ch2','ch3','xc1','xc2','xc3','tg'])if(m.got?.[k])got[k]=1;
    const path=[];if(Array.isArray(m.path))for(const v of m.path.slice(0,7)){if(v!==0&&v!==1&&v!==2)break;if(path.length&&Math.abs(v-path[path.length-1])>1)break;path.push(v);}
    const at=Number(m._at);clean.meridian={got,path:path.slice(0,Object.keys(got).length),_at:Number.isInteger(at)&&at>=0&&at<=Number.MAX_SAFE_INTEGER?at:0};
  }
  if(clean.tipLocks!=null){
    const t=clean.tipLocks,out={};
    if(typeof t!=='object'||Array.isArray(t))throw new Error('锦囊锁定数据不合法');
    for(const k of ['gong','ji','shu','shou','zhuan'])if(typeof t[k]==='string'&&t[k].length<=12)out[k]=t[k];
    const at=Number(t._at);out._at=Number.isInteger(at)&&at>=0&&at<=Number.MAX_SAFE_INTEGER?at:0;clean.tipLocks=out;
  }
  // 校场进度属于 campaign；统一按章节白名单和0～6层校验，云合并取最大值。
  clean.campaign = globalThis.CLOUD_MERGE.merge({campaign:clean.campaign}).campaign;
  return clean;
}
async function loadLegacy(store,prefix){
  const {blobs}=await store.list({prefix});const latest=new Map();
  for(const b of blobs||[]){const [writer,sequence]=b.key.slice(prefix.length).split('/');const n=Number(sequence);if(!writer||!Number.isFinite(n))continue;const old=latest.get(writer);if(!old||n>old.n)latest.set(writer,{n,key:b.key});}
  const profiles=[],keys=[...latest.values()];
  for(let i=0;i<keys.length;i+=8){const batch=await Promise.all(keys.slice(i,i+8).map(async b=>{const raw=await store.get(b.key);return raw?JSON.parse(raw):null;}));profiles.push(...batch);}
  return globalThis.CLOUD_MERGE.merge(...profiles);
}
async function current(store,prefix){
  const entry=await store.getWithMetadata(prefix+'current',{type:'json'});
  return {entry,profile:entry?entry.data:await loadLegacy(store,prefix)};
}
// 试玩网址（raw.githack 读 preview 分支）只能"只读"拉取存档：允许它跨域 GET，POST 仍被下面的来源检查拒绝（用户定：方案 A）
const PREVIEW_ORIGIN='https://raw.githack.com';
export default async function handler(req){
  const fromPreview=req.headers.get('origin')===PREVIEW_ORIGIN;
  if(req.method==='OPTIONS'&&fromPreview)return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':PREVIEW_ORIGIN,'Access-Control-Allow-Methods':'GET','Access-Control-Allow-Headers':'X-Save-Pin','Access-Control-Max-Age':'86400'}});
  if(fromPreview&&req.method!=='GET')return reply({ok:false,error:'试玩网址只能读取存档'},403);
  const res=await inner(req);
  if(fromPreview)res.headers.set('Access-Control-Allow-Origin',PREVIEW_ORIGIN);
  return res;
}
async function inner(req){
  if(!['GET','POST'].includes(req.method))return reply({ok:false,error:'Method not allowed'},405);
  const url=new URL(req.url);let body;
  if(req.method==='POST'){
    if(req.headers.get('origin')&&req.headers.get('origin')!==url.origin)return reply({ok:false,error:'Origin rejected'},403);
    const text=await req.text();if(text.length>1500000)return reply({ok:false,error:'存档过大'},413);
    try{body=JSON.parse(text);}catch{return reply({ok:false,error:'Invalid JSON'},400);}
  }
  const name=String(body?.name||url.searchParams.get('name')||'').trim();
  if(!name||name.length>8||/[\u0000-\u001f]/.test(name))return reply({ok:false,error:'名字不合法'},400);
  const prefix='player/'+createHash('sha256').update(name).digest('hex')+'/';
  try{
    const store=getStore({name:'wumingzhibei-profiles',consistency:'strong'});
    // 设了存档口令的名字：读档、写档都要带对口令（GET 用请求头 X-Save-Pin，POST 用 body.pin）
    const pinCheck=await checkPin(pinStore(),name,body?String(body.pin||''):String(req.headers.get('x-save-pin')||''));
    if(!pinCheck.ok)return reply(pinCheck.body,pinCheck.status);
    const pinSet=pinCheck.pinSet;
    if(body){
      if(!/^[a-zA-Z0-9-]{8,80}$/.test(body.writer||'')||!Number.isSafeInteger(body.sequence)||body.sequence<1)return reply({ok:false,error:'Invalid revision'},400);
      let profile;try{profile=validate(body.profile);}catch(e){return reply({ok:false,error:e.message},400);}
      // 按ETag条件更新整份存档，防止两台设备同时领取第50格而合并出第51把。
      for(let attempt=0;attempt<6;attempt++){
        const {entry,profile:existing}=await current(store,prefix),merged=globalThis.CLOUD_MERGE.merge(existing,profile);
        if(merged.items.length>globalThis.EQUIPMENT_RULES.capacityOf(merged))return reply({ok:false,capacity:true,error:'云端合并后超过50把，请先在原设备熔炼或丢弃，再同步'},409);
        const condition=entry?{onlyIfMatch:entry.etag}:{onlyIfNew:true};
        const result=await store.set(prefix+'current',JSON.stringify(merged),condition);
        if(!result.modified)continue;
        // 既有历史快照保留，新的快照也继续备份；不删除原云档。
        await store.set(prefix+body.writer+'/'+String(body.sequence).padStart(16,'0'),JSON.stringify(merged)).catch(()=>{});
        const latest=await store.get(prefix+'current',{type:'json'});
        return reply({ok:true,pinSet,limit:globalThis.EQUIPMENT_RULES.capacityOf(latest||merged),profile:latest||merged});
      }
      return reply({ok:false,error:'存档正在其他设备更新，请稍后重试'},409);
    }
    return reply({ok:true,pinSet,limit:globalThis.EQUIPMENT_RULES.CAPACITY,profile:(await current(store,prefix)).profile});
  }catch{return reply({ok:false,error:'云存档暂时不可用，请保留本机存档后重试'},503);}
}
