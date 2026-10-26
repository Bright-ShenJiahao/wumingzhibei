// 同名云存档；战斗中只上传，整备与结算安全时机才下载合并。
(() => {
  const debug=/[?&]debug(?:=|&|$)/.test(location.search);
  const writer=globalThis.crypto?.randomUUID?.()||'tab-'+Date.now()+'-'+Math.random().toString(36).slice(2);
  let lastVisiblePull=0,sequence=0,tail=Promise.resolve(),timer=null,retryAt=0,seenMain=null,seenArena=null;
  const pending=new Set(),wanted=new Set(),inFlight=new Map(),states=new Map();
  const name=()=>window.TITLE?TITLE.playerName():'';
  const state=player=>{if(!states.has(player))states.set(player,{phase:'syncing',at:0,detail:''});return states.get(player);};
  function isPreparation(){return !!(window.TITLE&&TITLE.active()&&document.querySelector('#tChapter.open'));}
  function settlement(){
    if(window.XIAOCHANG&&XIAOCHANG.blocks())return true;
    return typeof result!=='undefined'&&!!result&&typeof gameT!=='undefined'&&gameT>=result.born;
  }
  const canMerge=()=>!!(window.TITLE&&(TITLE.active()||settlement()));
  // ---------- 存档口令 ----------
  const PIN_KEY='wzb-save-pin';
  const pinSetFor=new Map(), pinBlocked=new Map();   // 名字 → 是否设了口令；名字 → 'need' | 解锁时间戳
  function pinFor(player){try{return (JSON.parse(localStorage.getItem(PIN_KEY)||'{}')||{})[player]||'';}catch{return '';}}
  function rememberPin(player,pin){try{const all=JSON.parse(localStorage.getItem(PIN_KEY)||'{}')||{};if(pin)all[player]=pin;else delete all[player];localStorage.setItem(PIN_KEY,JSON.stringify(all));}catch{}}
  let pinWaiters=[];   // 标题页等玩家输口令（或选择离线玩）再决定进哪个界面
  function releasePinWait(){const w=pinWaiters;pinWaiters=[];w.forEach(f=>f());}
  function waitPin(){return state(name()).phase==='needpin'?new Promise(ok=>pinWaiters.push(ok)):Promise.resolve();}
  function blocked(player){const b=pinBlocked.get(player);if(!b)return false;if(b==='need')return true;if(Date.now()<b)return true;pinBlocked.delete(player);return false;}
  function text(){
    if(debug)return '开发者存档 · 不上传';
    const s=state(name());
    if(s.phase==='needpin')return s.detail||'需要存档口令 · 点🔒输入';
    if(s.phase==='syncing')return '同步中…';
    if(s.phase==='error')return s.detail?'已保存在本机 · '+s.detail:'已保存在本机 · 稍后自动重试';
    const minutes=Math.max(0,Math.floor((Date.now()-s.at)/60000));
    return minutes?'已同步 · '+minutes+'分钟前':'已同步 · 刚刚';
  }
  function renderStatus(){
    const node=document.getElementById('cloudStatus');if(node)node.textContent=text();
    const button=document.getElementById('cloudRetry'),busy=!debug&&state(name()).phase==='syncing';
    if(button){button.disabled=debug||busy;button.classList.toggle('cloud-spinning',busy);button.setAttribute('aria-busy',String(busy));}
    const lock=document.getElementById('cloudPin');
    if(lock){const set=!!pinSetFor.get(name()),need=state(name()).phase==='needpin';lock.textContent=set?'🔒':'🔓';lock.classList.toggle('pin-set',set);lock.classList.toggle('pin-need',need);
      lock.title=need?'输入存档口令':set?'已设存档口令 · 点击修改':'设置存档口令（防止别人用你的名字改装备）';lock.setAttribute('aria-label',lock.title);lock.disabled=debug;}
  }

  // ---------- 口令弹窗（卷轴风格，沿用暂停菜单的样式类） ----------
  let pinBox=null;
  function openPin(mode,message=''){
    const player=name();if(!player||debug)return;
    if(!mode)mode=state(player).phase==='needpin'?'enter':pinSetFor.get(player)?'change':'set';
    if(!pinBox){
      pinBox=document.createElement('div');pinBox.id='pinScreen';
      pinBox.style.cssText='position:fixed;inset:0;z-index:45;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;background:rgba(8,6,5,.76)';
      const css=document.createElement('style');css.textContent='#pinScreen .pause-paper{width:min(400px,92vw);padding-top:clamp(34px,8vh,56px);padding-bottom:clamp(26px,6vh,44px)}#pinScreen .pause-paper h2{margin-top:6px}#pinScreen p{margin:4px 0 10px;color:#4d341e;font-size:14px;line-height:1.6}#pinScreen label{display:block;margin:7px 0;color:#4d341e;font-size:13px;text-align:left}#pinScreen input{box-sizing:border-box;width:100%;margin-top:3px;padding:8px 10px;border:1px solid #8b673b;border-radius:5px;background:#f7ead0;color:#3a2614;font-size:18px;letter-spacing:4px;text-align:center}#pinScreen .pin-msg{min-height:20px;color:#a1321e;font-size:13px}#pinScreen .pin-row{display:flex;gap:10px;margin-top:10px}#pinScreen .pin-row .pause-action{flex:1}#cloudPin{min-width:28px;min-height:26px;padding:2px 5px;border:1px solid #997343;border-radius:50%;background:#38281d;color:#ddc18b;font-size:14px;line-height:1;cursor:pointer;filter:grayscale(1) brightness(1.3)}#cloudPin.pin-set{filter:none;border-color:#e2b85c;box-shadow:0 0 6px #e2b85c66}#cloudPin.pin-need{filter:none;border-color:#e07a5f;animation:cloudSpin 0s}';
      document.head.append(css);document.body.append(pinBox);
    }
    const scroll=typeof ASSETS!=='undefined'&&ASSETS.ui&&ASSETS.ui.scroll,btn=typeof ASSETS!=='undefined'&&ASSETS.ui&&ASSETS.ui.btn;
    const field=(id,label)=>`<label>${label}<input id="${id}" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off"></label>`;
    const title={set:'设置存档口令',change:'修改存档口令',enter:'输入存档口令'}[mode];
    const intro={set:'设了口令后，在别的设备用这个名字进游戏，要输对口令才能同步装备。',change:'先输入现在的口令，再设置新口令。',enter:'这个名字设了存档口令。输对后会在这台设备上记住，以后不用再输。'}[mode];
    pinBox.innerHTML=`<section class="pause-paper"><h2>${title}</h2><p>${intro}</p>${mode==='change'?field('pinOld','现在的口令'):''}${mode==='enter'?field('pinNew','口令'):field('pinNew','新口令（4～6位数字）')+field('pinAgain','再输一次')}<div class="pin-msg" role="alert">${message||''}</div><div class="pin-row"><button type="button" class="pause-action" data-pin="ok">确定</button><button type="button" class="pause-action" data-pin="cancel">${mode==='enter'?'先离线玩':'取消'}</button></div></section>`;
    if(scroll)pinBox.querySelector('.pause-paper').style.backgroundImage=`url("${scroll}")`;
    pinBox.querySelectorAll('.pause-action').forEach(b=>{if(btn)b.style.backgroundImage=`url("${btn}")`;});
    pinBox.hidden=false;pinBox.style.display='flex';
    const msg=pinBox.querySelector('.pin-msg'),val=id=>(pinBox.querySelector('#'+id)?.value||'').trim();
    setTimeout(()=>pinBox.querySelector('input')?.focus(),30);
    const close=()=>{pinBox.hidden=true;pinBox.style.display='none';};
    pinBox.querySelector('[data-pin="cancel"]').onclick=()=>{close();if(mode==='enter')releasePinWait();};
    pinBox.onkeydown=e=>{if(e.key==='Enter')pinBox.querySelector('[data-pin="ok"]').click();if(e.key==='Escape')close();};
    pinBox.querySelector('[data-pin="ok"]').onclick=async()=>{
      const pin=val('pinNew');
      if(!/^\d{4,6}$/.test(pin)){msg.textContent='口令要4～6位数字';return;}
      if(mode==='enter'){rememberPin(player,pin);pinBlocked.delete(player);close();status(player,'syncing');schedule(player,true);return;}
      if(pin!==val('pinAgain')){msg.textContent='两次输入的口令不一样';return;}
      msg.textContent='保存中…';
      try{
        const r=await fetch('/api/pin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:player,pin,oldPin:mode==='change'?val('pinOld'):pinFor(player)})});
        const data=await r.json().catch(()=>({}));
        if(!r.ok||!data.ok){msg.textContent=data.error||'设置失败，请稍后再试';return;}
        rememberPin(player,pin);pinSetFor.set(player,true);close();renderStatus();
        const node=document.getElementById('cloudStatus');if(node)node.textContent='口令已设置 · 请记好它';
      }catch{msg.textContent='网络不通，稍后再试';}
    };
  }
  function status(player,phase,detail=''){
    const s=state(player);s.phase=phase;s.detail=detail;if(phase==='ready'){s.at=Date.now();if(player===name())releasePinWait();}
    if(player===name())renderStatus();
  }
  function payload(player){
    if(player===name())return ARMORY.exportProfile();
    try{const p=JSON.parse(localStorage.getItem('wzb-equipment-v2')||'{}')[player]||null;if(p)p.campaign=CLOUD_MERGE.merge({campaign:p.campaign},{campaign:JSON.parse(localStorage.getItem('wzb-campaign-clear-v1')||'{}')[player]}).campaign;return p;}catch{return null;}
  }
  async function request(url,options={},player=''){
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
    try{
      const headers={...(options.headers||{})};const pin=player&&pinFor(player);if(pin)headers['X-Save-Pin']=pin;
      const response=await fetch(url,{...options,headers,signal:controller.signal,cache:'no-store'}),data=await response.json();
      if(!response.ok||!data.ok||!data.profile){const error=new Error(data.error||'同步失败');error.status=response.status;error.data=data;error.profileError=response.status>=400&&response.status<500;throw error;}
      if(player)pinSetFor.set(player,!!data.pinSet);
      return data.profile;
    }finally{clearTimeout(timeout);}
  }
  function merge(remote){
    if(!ARMORY.mergeCloud(remote)){const error=new Error('合并失败：请检查50把容量限制或本机存储空间');error.profileError=true;throw error;}
    return ARMORY.lastMergeChanged?ARMORY.lastMergeChanged():true;
  }
  async function exchange(player,download){
    if(debug||!player||player==='__debug__')return true;
    if(blocked(player)){renderStatus();return false;}
    // 串行队列可能等到玩家已出征才开始；再次检查，不能在战斗中发起下载。
    const pull=download&&player===name()&&canMerge();
    if(download&&!pull&&player===name())wanted.add(player);
    status(player,'syncing');let changed=false;
    try{
      if(pull){
        wanted.add(player);
        const remote=await request('/api/profile?name='+encodeURIComponent(player),{},player);
        // 下载途中出征/换名字：绝不把迟到的结果合进战斗装备，留待下个安全时机。
        if(player===name()&&canMerge()){changed=merge(remote)||changed;wanted.delete(player);}
      }
      const profile=payload(player);if(!profile){status(player,'error');return false;}
      const sent=JSON.stringify(profile),revision=++sequence;
      const remote=await request('/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:player,writer,sequence:revision,profile,pin:pinFor(player)})},player);
      if(player===name()){
        const changedDuringRequest=JSON.stringify(payload(player))!==sent;
        if(canMerge())changed=merge(remote)||changed;
        if(changedDuringRequest)pending.add(player);
        // 只有云端真的带来了变化才重画整备页；内容一样就不动页面（不打断勾选）
        if(changed&&canMerge())TITLE.refreshPreparation();
      }
      retryAt=0;status(player,'ready');return true;
    }catch(e){
      if(e.data&&e.data.needPin){
        pinSetFor.set(player,true);
        if(e.data.locked)pinBlocked.set(player,Date.now()+(e.data.retryAfter||10)*60000);else pinBlocked.set(player,'need');
        if(e.data.wrong||e.data.locked)rememberPin(player,'');
        status(player,'needpin',e.data.error);
        if(player===name()&&canMerge())openPin('enter',e.data.error);
        return false;
      }
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
      button.onclick=()=>{if(blocked(name()))openPin('enter');else schedule(name(),true);};
      const lock=document.createElement('button');lock.id='cloudPin';lock.type='button';lock.textContent='🔓';lock.onclick=()=>openPin();
      line.append(label,button,lock);root.querySelector('#tPrepHeader')?.after(line);
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
    // 切回页面时下载一次（换设备玩能接上），10秒内最多一次
    if(!document.hidden){if(canMerge()&&Date.now()-lastVisiblePull>10000){lastVisiblePull=Date.now();schedule(name(),true);}else queue(name());}
  });
  setInterval(flush,15000);
  // 不再定时下载：整备页定时刷新会打断勾选、熔错武器。只在进整备页、结算、切回页面、点↻和熔炼前同步。
  setInterval(renderStatus,30000);
  setInterval(watchSettlements,250);
  window.CLOUD_SAVE={queue,attach,enterPreparation,openPin,waitPin,sync:player=>schedule(player,true)};
})();
