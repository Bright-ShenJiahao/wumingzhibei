// 已获用户授权：只保存本游戏的同名武器仓库、装备槽及章节进度。
import { getStore } from '@netlify/blobs';
import { createHash } from 'node:crypto';
import '../../js/cloud_merge.js';
import '../../js/equipment_rules.js';
export const config={path:'/api/profile'};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
const TYPES=new Set(['staff','hammer','blade','stone','halberd','bow']);
function validate(p){
  if(!p||!Array.isArray(p.items)||p.items.length>globalThis.EQUIPMENT_RULES.CAPACITY)throw new Error('身上与仓库合计最多50把武器，请先熔炼或丢弃');
  const clean=JSON.parse(JSON.stringify(p));
  if(!clean.items.every(i=>i&&TYPES.has(i.type)&&typeof i.uid==='string'&&i.uid.length<=100&&Number.isInteger(i.q)&&i.q>=0&&i.q<=5&&Array.isArray(i.affixes)&&i.affixes.length<=2))throw new Error('装备数据不合法');
  for(const key of ['_removed','_equipAt','equipped','campaign'])if(!clean[key]||typeof clean[key]!=='object'||Array.isArray(clean[key]))clean[key]={};
  // 校场进度属于 campaign；统一按章节白名单和0～5层校验，云合并取最大值。
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
export default async function handler(req){
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
    if(body){
      if(!/^[a-zA-Z0-9-]{8,80}$/.test(body.writer||'')||!Number.isSafeInteger(body.sequence)||body.sequence<1)return reply({ok:false,error:'Invalid revision'},400);
      let profile;try{profile=validate(body.profile);}catch(e){return reply({ok:false,error:e.message},400);}
      // 按ETag条件更新整份存档，防止两台设备同时领取第50格而合并出第51把。
      for(let attempt=0;attempt<6;attempt++){
        const {entry,profile:existing}=await current(store,prefix),merged=globalThis.CLOUD_MERGE.merge(existing,profile);
        if(merged.items.length>globalThis.EQUIPMENT_RULES.CAPACITY)return reply({ok:false,capacity:true,error:'云端合并后超过50把，请先在原设备熔炼或丢弃，再同步'},409);
        const condition=entry?{onlyIfMatch:entry.etag}:{onlyIfNew:true};
        const result=await store.set(prefix+'current',JSON.stringify(merged),condition);
        if(!result.modified)continue;
        // 既有历史快照保留，新的快照也继续备份；不删除原云档。
        await store.set(prefix+body.writer+'/'+String(body.sequence).padStart(16,'0'),JSON.stringify(merged)).catch(()=>{});
        const latest=await store.get(prefix+'current',{type:'json'});
        return reply({ok:true,limit:globalThis.EQUIPMENT_RULES.CAPACITY,profile:latest||merged});
      }
      return reply({ok:false,error:'存档正在其他设备更新，请稍后重试'},409);
    }
    return reply({ok:true,limit:globalThis.EQUIPMENT_RULES.CAPACITY,profile:(await current(store,prefix)).profile});
  }catch{return reply({ok:false,error:'云存档暂时不可用，请保留本机存档后重试'},503);}
}
