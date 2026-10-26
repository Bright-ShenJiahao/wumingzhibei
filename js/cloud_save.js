// 同名云存档；只发送用户明确授权的本游戏装备与进度。
(() => {
  const debug=/[?&]debug(?:=|&|$)/.test(location.search),writer=globalThis.crypto?.randomUUID?.()||'tab-'+Date.now()+'-'+Math.random().toString(36).slice(2);
  let sequence=0,tail=Promise.resolve(),timer=null,lastMessage='尚未同步',retryAt=0;
  const pending=new Set(),inFlight=new Map();
  function status(text){lastMessage=text;const node=document.getElementById('cloudStatus');if(node)node.textContent=text;}
  const name=()=>window.TITLE?TITLE.playerName():'';
  function payload(player){
    if(player===name())return ARMORY.exportProfile();
    try{const p=JSON.parse(localStorage.getItem('wzb-equipment-v2')||'{}')[player]||null;if(p)p.campaign=CLOUD_MERGE.merge({campaign:p.campaign},{campaign:JSON.parse(localStorage.getItem('wzb-campaign-clear-v1')||'{}')[player]}).campaign;return p;}catch{return null;}
  }
  async function request(url,options={}){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
    try{const response=await fetch(url,{...options,signal:controller.signal,cache:'no-store'});const result=await response.json();if(!response.ok||!result.ok||!result.profile)throw new Error(result.error||'同步失败');return result.profile;}finally{clearTimeout(timeout);}
  }
  async function exchange(player,download){
    if(debug||!player||player==='__debug__')return true;
    status('正在同步云存档…');
    try{
      if(download){
        const remote=await request('/api/profile?name='+encodeURIComponent(player));
        if(player!==name())return false;
        if(!ARMORY.mergeCloud(remote))throw new Error('合并失败：请检查50把容量限制或本机存储空间');
      }
      const profile=payload(player);if(!profile)return false;
      const sent=JSON.stringify(profile),revision=++sequence;
      const remote=await request('/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:player,writer,sequence:revision,profile})});
      if(player===name()){
        const changedDuringRequest=JSON.stringify(payload(player))!==sent;
        // 战斗中只上传，返回标题/备战后再合并云端装备，避免中途换掉手持实例。
        if(TITLE.active()&&!ARMORY.mergeCloud(remote))throw new Error('合并失败：请检查50把容量限制或本机存储空间');
        if(changedDuringRequest)pending.add(player);
      }
      retryAt=0;status('云存档已同步');return true;
    }catch(e){pending.add(player);retryAt=Date.now()+15000;status('已保存在本机 · '+(e.message&&e.message!=='Failed to fetch'?e.message:'云同步失败，稍后重试'));return false;}
  }
  function schedule(player,download=false){
    const key=player+':'+download;if(inFlight.has(key))return inFlight.get(key);
    const job=tail.catch(()=>{}).then(()=>exchange(player,download));tail=job;
    inFlight.set(key,job);job.finally(()=>inFlight.delete(key));return job;
  }
  function queue(player){if(debug||!player||player==='__debug__')return;pending.add(player);clearTimeout(timer);timer=setTimeout(flush,1000);}
  async function flush(){
    if(debug||navigator.onLine===false||Date.now()<retryAt)return;
    const names=[...pending];pending.clear();for(const player of names)await schedule(player,false);
  }
  function attach(root){
    if(root.querySelector('#cloudStatus'))return;
    const line=document.createElement('p');line.style.cssText='font-size:12px;color:#d0b980;display:flex;gap:8px;align-items:center;flex-wrap:wrap';
    const text=document.createElement('span');text.id='cloudStatus';text.setAttribute('role','status');text.textContent=lastMessage;
    const button=document.createElement('button');button.type='button';button.textContent='同步存档';button.className='tChapterButton';button.style.padding='4px 8px';
    button.onclick=async()=>{button.disabled=true;await schedule(name(),true);button.disabled=false;if(TITLE.active())TITLE.refreshPreparation();};
    line.append(text,button);root.querySelector('#tPrepHeader')?.after(line);
  }
  window.addEventListener('online',()=>{retryAt=0;queue(name());});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(window.TITLE&&TITLE.active())schedule(name(),true).then(()=>{if(TITLE.active())TITLE.refreshPreparation();});else queue(name());}});
  setInterval(flush,15000);
  window.CLOUD_SAVE={queue,attach,sync:player=>schedule(player,true)};
})();
