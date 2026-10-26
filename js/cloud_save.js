// 同名云存档；战斗中只上传，整备与结算安全时机才下载合并。
(() => {
  const debug=/[?&]debug(?:=|&|$)/.test(location.search);
  const writer=globalThis.crypto?.randomUUID?.()||'tab-'+Date.now()+'-'+Math.random().toString(36).slice(2);
  let sequence=0,tail=Promise.resolve(),timer=null,retryAt=0,seenMain=null,seenArena=null;
  const pending=new Set(),wanted=new Set(),inFlight=new Map(),states=new Map();
  const name=()=>window.TITLE?TITLE.playerName():'';
  const state=player=>{if(!states.has(player))states.set(player,{phase:'syncing',at:0,detail:''});return states.get(player);};
  function isPreparation(){return !!(window.TITLE&&TITLE.active()&&document.querySelector('#tChapter.open'));}
  function settlement(){
    if(window.XIAOCHANG&&XIAOCHANG.blocks())return true;
    return typeof result!=='undefined'&&!!result&&typeof gameT!=='undefined'&&gameT>=result.born;
  }
  const canMerge=()=>!!(window.TITLE&&(TITLE.active()||settlement()));
  function text(){
    if(debug)return '开发者存档 · 不上传';
    const s=state(name());
    if(s.phase==='syncing')return '同步中…';
    if(s.phase==='error')return s.detail?'已保存在本机 · '+s.detail:'已保存在本机 · 稍后自动重试';
    const minutes=Math.max(0,Math.floor((Date.now()-s.at)/60000));
    return minutes?'已同步 · '+minutes+'分钟前':'已同步 · 刚刚';
  }
  function renderStatus(){
    const node=document.getElementById('cloudStatus');if(node)node.textContent=text();
    const button=document.getElementById('cloudRetry'),busy=!debug&&state(name()).phase==='syncing';
    if(button){button.disabled=debug||busy;button.classList.toggle('cloud-spinning',busy);button.setAttribute('aria-busy',String(busy));}
  }
  function status(player,phase,detail=''){
    const s=state(player);s.phase=phase;s.detail=detail;if(phase==='ready')s.at=Date.now();
    if(player===name())renderStatus();
  }
  function payload(player){
    if(player===name())return ARMORY.exportProfile();
    try{const p=JSON.parse(localStorage.getItem('wzb-equipment-v2')||'{}')[player]||null;if(p)p.campaign=CLOUD_MERGE.merge({campaign:p.campaign},{campaign:JSON.parse(localStorage.getItem('wzb-campaign-clear-v1')||'{}')[player]}).campaign;return p;}catch{return null;}
  }
  async function request(url,options={}){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
    try{
      const response=await fetch(url,{...options,signal:controller.signal,cache:'no-store'}),data=await response.json();
      if(!response.ok||!data.ok||!data.profile){const error=new Error(data.error||'同步失败');error.profileError=response.status>=400&&response.status<500;throw error;}
      return data.profile;
    }finally{clearTimeout(timeout);}
  }
  function merge(remote){
    if(!ARMORY.mergeCloud(remote)){const error=new Error('合并失败：请检查50把容量限制或本机存储空间');error.profileError=true;throw error;}
  }
  async function exchange(player,download){
    if(debug||!player||player==='__debug__')return true;
    // 串行队列可能等到玩家已出征才开始；再次检查，不能在战斗中发起下载。
    const pull=download&&player===name()&&canMerge();
    if(download&&!pull&&player===name())wanted.add(player);
    status(player,'syncing');let applied=false;
    try{
      if(pull){
        wanted.add(player);
        const remote=await request('/api/profile?name='+encodeURIComponent(player));
        // 下载途中出征/换名字：绝不把迟到的结果合进战斗装备，留待下个安全时机。
        if(player===name()&&canMerge()){merge(remote);applied=true;wanted.delete(player);}
      }
      const profile=payload(player);if(!profile){status(player,'error');return false;}
      const sent=JSON.stringify(profile),revision=++sequence;
      const remote=await request('/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:player,writer,sequence:revision,profile})});
      if(player===name()){
        const changedDuringRequest=JSON.stringify(payload(player))!==sent;
        if(canMerge()){merge(remote);applied=true;}
        if(changedDuringRequest)pending.add(player);
        if(applied&&canMerge())TITLE.refreshPreparation();
      }
      retryAt=0;status(player,'ready');return true;
    }catch(e){
      pending.add(player);retryAt=Date.now()+15000;
      status(player,'error',e.profileError?e.message:'');return false;
    }
  }
  function schedule(player,download=false){
    if(debug||!player||player==='__debug__'){renderStatus();return Promise.resolve(true);}
    const key=player+':'+download;if(inFlight.has(key))return inFlight.get(key);
    const job=tail.catch(()=>{}).then(()=>exchange(player,download));tail=job;
    inFlight.set(key,job);job.finally(()=>inFlight.delete(key));return job;
  }
  function enterPreparation(){return schedule(name(),true);}
  function queue(player){
    if(debug||!player||player==='__debug__')return;
    pending.add(player);clearTimeout(timer);
    if(navigator.onLine===false)status(player,'error');
    timer=setTimeout(flush,1000);
  }
  async function flush(){
    if(debug||Date.now()<retryAt)return;
    if(navigator.onLine===false){if(pending.size||wanted.has(name()))status(name(),'error');return;}
    const names=new Set(pending);if(wanted.has(name())&&canMerge())names.add(name());pending.clear();
    for(const player of names)await schedule(player,player===name()&&wanted.has(player)&&canMerge());
  }
  function attach(root){
    if(!root.querySelector('#cloudStatus')){
      const style=document.createElement('style');style.textContent='@keyframes cloudSpin{to{transform:rotate(360deg)}}#cloudRetry{padding:2px 6px;min-width:28px;min-height:26px;font-size:20px;line-height:1;border:1px solid #997343;border-radius:50%;background:#38281d;color:#ddc18b;cursor:pointer}#cloudRetry.cloud-spinning{animation:cloudSpin 1s linear infinite}#cloudRetry:disabled{cursor:default;opacity:.65}';document.head.append(style);
      const line=document.createElement('p');line.style.cssText='font-size:12px;color:#d0b980;display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:4px 0;flex:none';
      const label=document.createElement('span');label.id='cloudStatus';label.setAttribute('role','status');label.setAttribute('aria-live','polite');
      const button=document.createElement('button');button.id='cloudRetry';button.type='button';button.textContent='↻';button.title='重新同步存档';button.setAttribute('aria-label','重新同步存档');
      button.onclick=()=>schedule(name(),true);line.append(label,button);root.querySelector('#tPrepHeader')?.after(line);
    }
    renderStatus();
  }
  function watchSettlements(){
    if(debug)return;
    const main=typeof result!=='undefined'&&result&&typeof gameT!=='undefined'&&gameT>=result.born?result:null;
    const arena=window.XIAOCHANG&&XIAOCHANG.blocks()?XIAOCHANG.state():null;
    if(main&&main!==seenMain){seenMain=main;schedule(name(),true);}else if(!main)seenMain=null;
    if(arena&&arena!==seenArena){seenArena=arena;schedule(name(),true);}else if(!arena)seenArena=null;
  }
  window.addEventListener('offline',()=>{if(!debug&&name())status(name(),'error');});
  window.addEventListener('online',()=>{retryAt=0;queue(name());if(canMerge())schedule(name(),true);});
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden){if(canMerge())schedule(name(),true);else queue(name());}
  });
  setInterval(flush,15000);
  setInterval(()=>{renderStatus();if(!document.hidden&&isPreparation())schedule(name(),true);},30000);
  setInterval(watchSettlements,250);
  window.CLOUD_SAVE={queue,attach,enterPreparation,sync:player=>schedule(player,true)};
})();
