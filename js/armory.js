// 每个玩家独立的武器实例仓库；调试存档仅在内存中。
(() => {
  const D=AFFIX_DATA,KEY='wzb-equipment-v2',debug=/[?&]debug(?:=|&|$)/.test(location.search);
  const memory=Object.create(null); let cache=null,cacheName='',baseline=null,freshLocal=false,selection=new Set(),message='',lastChanged=false;
  const player=()=>window.TITLE?TITLE.playerName()||'__debug__':'__debug__';
  function read(){try{const value=JSON.parse(localStorage.getItem(KEY)||'{}');return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}catch(e){return {};}}
  const copy=value=>JSON.parse(JSON.stringify(value));
  function save({remote=false}={}){
    if(debug){memory[cacheName]=cache;baseline=copy(cache);return true;}
    try{
      const next=copy(cache),now=Date.now();next._removed ||= {};next._equipAt ||= {};
      if(!remote&&baseline){
        freshLocal=false;
        const old=new Map(baseline.items.map(i=>[i.uid,i]));
        for(const item of next.items){const previous=old.get(item.uid);if(!previous||JSON.stringify(previous)!==JSON.stringify(item))item._at=Math.max(now,(previous?._at||0)+1);old.delete(item.uid);}
        for(const id of old.keys())next._removed[id]=now;
        for(const slot of ['long','short','ranged'])if(next.equipped[slot]!==baseline.equipped[slot])next._equipAt[slot]=Math.max(now,(baseline._equipAt?.[slot]||0)+1);
      }
      const all=read();all[cacheName]=next;localStorage.setItem(KEY,JSON.stringify(all));
      Object.assign(cache,next);baseline=copy(cache);
      if(!remote&&window.CLOUD_SAVE)CLOUD_SAVE.queue(cacheName);
      return true;
    }catch(e){return false;}
  }
  function starter(type){const item=D.generate(type,'boss','',0);item.special=null;item.inscription='';return item;}
  function state(){
    const name=player();if(cache&&cacheName===name)return cache;
    cacheName=name;baseline=null;const all=debug?memory:read();freshLocal=!Object.prototype.hasOwnProperty.call(all,name);cache=!freshLocal&&all[name]&&typeof all[name]==='object'?all[name]:{items:[],equipped:{},played:false};
    selection.clear();
    if(!Array.isArray(cache.items))cache.items=[];
    cache.items=cache.items.filter(i=>i&&D.names[i.type]&&Number.isInteger(i.q)&&i.q>=0&&i.q<=5&&typeof i.uid==='string');
    for(const item of cache.items){item.affixes=(item.affixes||[]).filter(a=>D.positive[a.id]&&Number.isInteger(a.tier)&&a.tier>=0&&a.tier<=2).map(a=>({...a,value:D.positive[a.id].values[a.tier]}));if(!D.special[item.special])item.special=null;if(item.negative&&!D.negative[item.negative.id])item.negative=null;}
    cache.equipped ||= {};
    for(const slot of ['long','short','ranged'])if(!cache.items.some(i=>i.uid===cache.equipped[slot]&&D.slots[i.type]===slot))cache.equipped[slot]=null;
    const legacy=window.TITLE&&TITLE.legacyLoadout?TITLE.legacyLoadout():null;
    // 旧版v1会自动赠送大刀，不把这份误赠记录再次迁入；已存在的v2实例不批量删除。
    for(const type of cache.migrated?[]:(legacy?.owned||['staff','hammer','stone']))if(cache.items.length<EQUIPMENT_RULES.CAPACITY&&D.names[type]&&(debug||type!=='blade')&&!cache.items.some(i=>i.type===type)){
      const item=starter(type);cache.items.push(item);
      const slot=D.slots[type];if(!cache.equipped[slot]&&(!legacy||legacy.equipped[slot]===type))cache.equipped[slot]=item.uid;
    }
    // 只迁移一次。后来重铸/丢弃的旧武器不会被旧存档再次补回。
    cache.migrated=true;save({remote:true});return cache;
  }
  function equipped(slot){const p=state();return p.items.find(i=>i.uid===p.equipped[slot])||null;}
  function active(type){const item=equipped(D.slots[type]);return item&&item.type===type?item:null;}
  let nextFullNotice=0;
  function fullNotice(){if(Date.now()<nextFullNotice)return;nextFullNotice=Date.now()+4000;if(typeof toast==='function')toast('武器已满50把，不能拾取；未拾取武器离场不会带回');}
  function add(item){const p=state();if(p.items.some(i=>i.uid===item.uid))return true;if(p.items.length>=EQUIPMENT_RULES.CAPACITY){fullNotice();return false;}p.items.push(item);if(!save()){p.items.pop();return false;}return true;}
  function grant(type,equip=false){const p=state();let item=p.items.find(i=>i.type===type);if(!item){if(p.items.length>=EQUIPMENT_RULES.CAPACITY){fullNotice();return false;}item=starter(type);p.items.push(item);}if(equip)p.equipped[D.slots[type]]=item.uid;return save();}
  function equip(uid){const p=state(),item=p.items.find(i=>i.uid===uid);if(!item)return false;const slot=D.slots[item.type],old=p.equipped[slot];if(old===uid)return true;const oldItem=p.items.find(i=>i.uid===old);if(oldItem&&oldItem.locked){showMessage('当前装备已锁定，先解锁才能更换');return false;}p.equipped[slot]=uid;if(!save()){p.equipped[slot]=old;return false;}selection.delete(uid);return true;}
  function unequip(slot){const p=state(),old=p.equipped[slot],oldItem=p.items.find(i=>i.uid===old);if(oldItem&&oldItem.locked){showMessage('已锁定，先解锁才能卸下');return false;}p.equipped[slot]=null;if(!save()){p.equipped[slot]=old;return false;}return true;}

  function reforge(ids){
    const p=state(),items=ids.map(id=>p.items.find(i=>i.uid===id));
    if(ids.length<3||ids.length>5||new Set(ids).size!==ids.length||items.some(i=>!i||i.locked||Object.values(p.equipped).includes(i.uid)))return false;
    const plan=EQUIPMENT_RULES.forgePlan(items,p.pity),type=D.pick(plan.types),base=D.pick(plan.qualities);
    const upgraded=Math.random()<EQUIPMENT_RULES.chanceOf(ids.length,base,p.pity),q=base+(upgraded?1:0);
    const oldPity=p.pity,oldPityAt=p._pityAt;
    if(EQUIPMENT_RULES.upgrades[ids.length][base]){p.pity={...(p.pity||{})};p.pity[base]=upgraded?0:(Number(p.pity[base])||0)+1;p._pityAt=Date.now();}
    const fresh=D.generate(type,'boss','',q),old=p.items;
    if(upgraded)fresh.forgeFrom=base;
    p.items=p.items.filter(i=>!ids.includes(i.uid));p.items.push(fresh);
    if(!save()){p.items=old;p.pity=oldPity;p._pityAt=oldPityAt;return false;}selection.clear();return fresh;
  }
  function setupStyle(){if(document.getElementById('armoryStyle'))return;const style=document.createElement('style');style.id='armoryStyle';style.textContent=`
    #tChapterPanel{min-height:0;overflow:hidden!important}#tPrepScroll{min-height:0;flex:1 1 auto;overflow:auto;overscroll-behavior:contain;padding:0 10px 72px 0;box-sizing:border-box}#tPrepMain,#tPrepFooter{flex-shrink:0}
    .aCard{position:relative;min-width:0;aspect-ratio:1;box-sizing:border-box;overflow:hidden;padding:5px;border:1px solid #78603e;border-top:3px solid var(--quality);border-radius:5px;background:linear-gradient(145deg,#453324,#261e18);color:#e8d4ad;cursor:pointer;display:grid;grid-template-rows:minmax(0,1fr) auto;align-items:center;justify-items:center;transition:box-shadow .12s,border-color .12s}
    .aCard.selected{border-color:#edc465;box-shadow:0 0 9px #d3a95c88,inset 0 0 0 1px #edc465;background:#574124}.aCard .aSelect{position:absolute;left:4px;top:4px;z-index:1;width:14px;height:14px;margin:0;accent-color:#e5be68;cursor:pointer}.aCard .aLockMark{position:absolute;right:4px;top:3px;color:#f0d58f;font-size:12px;line-height:1}.aCardIcon{min-width:0;min-height:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden}.aCardIcon img{display:block;max-width:78%;max-height:78%;width:auto;height:auto;object-fit:contain;image-rendering:pixelated}.aCardName{width:100%;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;font-size:11px;line-height:1.2;color:var(--quality)}
    .tPrepSlot[data-uid]{grid-template-columns:42px minmax(0,1fr);grid-template-rows:12px minmax(10px,1fr) auto}.tPrepSlot[data-uid] .tPrepName{grid-column:2;grid-row:2}.tPrepSlot[data-uid] .aUnequip,.tPrepSlot[data-uid] .aSlotLock{border:1px solid #80613c;border-radius:3px;background:#38291d;color:#dcc493;cursor:pointer}.tPrepSlot[data-uid] .aUnequip:disabled{opacity:.42;cursor:not-allowed;filter:grayscale(1)}
    .aSlotActions{grid-column:2;grid-row:3;display:flex;gap:4px;align-self:end}.aSlotActions button{max-width:50%;overflow:hidden;text-overflow:ellipsis}
    #aTools{font-size:12px;color:#cdb78f;line-height:1.5;padding:2px 10px 8px 0}#aTools details{margin:0}#aTools summary{cursor:pointer;color:#ddb96f;padding:4px 2px}#aTools p{margin:5px 2px}
    #aConfirm{position:fixed;inset:0;z-index:10001;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;background:#100b08c9;color:#f2dfb9;font:14px/1.55 sans-serif}#aConfirm[hidden]{display:none!important}.a-confirm-paper{box-sizing:border-box;width:min(560px,94vw);max-height:92dvh;overflow:auto;padding:clamp(24px,5vh,44px) clamp(20px,5vw,46px);background:center/100% 100% no-repeat;filter:drop-shadow(0 12px 26px #000b)}.a-confirm-paper h3{margin:6px 0 12px;text-align:center;color:#593d23;font:700 24px MaShanZheng,"STKaiti",serif}.a-confirm-paper p{margin:6px 0;color:#543b25}.a-confirm-paper ul{max-height:32vh;overflow:auto;margin:8px 0;padding:8px 22px;border:1px solid #8c673c;border-radius:5px;background:#291d14d9;color:#ecd8b2}.a-confirm-paper li{margin:3px 0}.a-confirm-paper .a-confirm-summary{white-space:pre-line;padding:8px 10px;background:#291d14d9;color:#f0dfbf;border-radius:4px}.a-confirm-actions{display:flex;justify-content:center;gap:10px;margin-top:14px}.a-confirm-actions button{min-width:105px;min-height:44px;padding:6px 15px;border:1px solid #a8844e;border-radius:5px;background:center/100% 100% no-repeat;color:#f7e5bd;font:700 16px MaShanZheng,"STKaiti",serif;cursor:pointer}
    @media(max-height:430px){#tPrepScroll{padding-bottom:64px!important}.tPrepSlot[data-uid]{grid-template-columns:34px minmax(0,1fr);grid-template-rows:10px minmax(7px,1fr) auto}.aSlotActions{grid-row:3;gap:2px}.aSlotActions button{font-size:8px!important;padding:0 3px!important}.aCard{padding:3px}.aCard .aSelect{left:2px;top:2px;width:12px;height:12px}.aCard .aLockMark{right:2px;top:1px;font-size:10px}.aCardName{font-size:9px}}
  `;document.head.append(style);}
  function ensureConfirm(){let overlay=document.getElementById('aConfirm');if(overlay)return overlay;overlay=document.createElement('div');overlay.id='aConfirm';overlay.hidden=true;overlay.innerHTML='<section class="a-confirm-paper"><h3></h3><p class="a-confirm-desc"></p><ul></ul><div class="a-confirm-summary"></div><div class="a-confirm-actions"><button type="button" data-confirm="yes">确定</button><button type="button" data-confirm="no">取消</button></div></section>';overlay.querySelector('.a-confirm-paper').style.backgroundImage=`url("${ASSETS.ui.scroll}")`;overlay.querySelectorAll('button').forEach(b=>b.style.backgroundImage=`url("${ASSETS.ui.btn}")`);document.body.append(overlay);overlay.addEventListener('click',e=>{if(e.target===overlay||e.target.closest('[data-confirm="no"]'))overlay.hidden=true;if(e.target.closest('[data-confirm="yes"]')){const action=overlay._action;overlay.hidden=true;action?.();}});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)overlay.hidden=true;});return overlay;}
  function askConfirm({title,description='',items=[],summary='',action,warn=false}){const overlay=ensureConfirm();overlay._action=action;overlay.querySelector('h3').textContent=title;overlay.querySelector('.a-confirm-desc').textContent=description;const list=overlay.querySelector('ul');list.replaceChildren(...items.map(item=>{const li=document.createElement('li');li.textContent=D.label(item);li.style.color=D.qualities[item.q].color;return li;}));list.hidden=!items.length;const notes=overlay.querySelector('.a-confirm-summary');notes.textContent=summary;notes.hidden=!summary;notes.style.color=warn?'#9b1c12':'';notes.style.fontWeight=warn?'700':'';overlay.hidden=false;}
  function render(root,icon,preview){
    setupStyle();const p=state(),bag=root.querySelector('#tPrepBag');if(!bag)return;
    const countLabel=root.querySelector('.tBagCount');if(countLabel){countLabel.textContent='武器 '+p.items.length+'/'+EQUIPMENT_RULES.CAPACITY;countLabel.style.color=p.items.length>=50?'#efa18e':p.items.length>=40?'#edce83':'';}
    const equippedIds=new Set(Object.values(p.equipped).filter(Boolean));
    const slots=root.querySelectorAll('.tPrepSlot');slots.forEach(node=>{const item=equipped(node.dataset.slot),iconBox=node.querySelector('.tPrepIcon'),label=node.querySelector('.tPrepName');node.querySelector('.aSlotActions')?.remove();node.removeAttribute('data-uid');node.removeAttribute('data-weapon');if(!item){label.textContent='空';label.style.color='';iconBox.innerHTML='<span aria-hidden="true">—</span>';return;}node.dataset.uid=item.uid;node.dataset.weapon=item.type;label.textContent=D.label(item);label.style.color=D.qualities[item.q].color;iconBox.innerHTML=icon(item.type);const actions=document.createElement('div');actions.className='aSlotActions';const remove=document.createElement('button');remove.type='button';remove.className='aUnequip';remove.textContent='卸下';remove.onclick=e=>{e.stopPropagation();if(unequip(node.dataset.slot))window.TITLE.refreshPreparation();};remove.disabled=!!item.locked;const lock=document.createElement('button');lock.type='button';lock.className='aSlotLock';lock.textContent=item.locked?'🔒 已锁':'锁定';lock.onclick=e=>{e.stopPropagation();item.locked=!item.locked;save();window.TITLE.refreshPreparation();};actions.append(remove,lock);node.append(actions);});
    for(const uid of [...selection])if(!p.items.some(i=>i.uid===uid)||equippedIds.has(uid))selection.delete(uid);
    bag.replaceChildren();
    const items=p.items.filter(i=>!equippedIds.has(i.uid)).map((item,index)=>({item,index})).sort((a,b)=>Number(!!b.item.locked)-Number(!!a.item.locked)||a.index-b.index).map(x=>x.item);
    for(const item of items){
      const card=document.createElement('div');card.className='aCard'+(selection.has(item.uid)?' selected':'');card.style.setProperty('--quality',D.qualities[item.q].color);card.dataset.uid=item.uid;card.dataset.weapon=item.type;card.setAttribute('role','button');card.setAttribute('tabindex','0');card.setAttribute('aria-label',D.label(item)+'，点击装备');
      const check=document.createElement('input');check.className='aSelect';check.type='checkbox';check.checked=selection.has(item.uid);check.setAttribute('aria-label','选择用于熔炼或丢弃');check.onclick=e=>e.stopPropagation();check.onchange=()=>{if(check.checked&&selection.size>=5){check.checked=false;showMessage('最多选择5把');return;}if(check.checked)selection.add(item.uid);else selection.delete(item.uid);card.classList.toggle('selected',check.checked);if(window.WEAPON_TIP)WEAPON_TIP.hide();updateFooter(root);};card.append(check);
      if(item.locked){const badge=document.createElement('span');badge.className='aLockMark';badge.textContent='🔒';badge.setAttribute('aria-label','已锁定');card.append(badge);}
      const image=document.createElement('span');image.className='aCardIcon';image.innerHTML=icon(item.type);card.append(image);const title=document.createElement('span');title.className='aCardName';title.textContent=D.label(item);card.append(title);
      card.onclick=e=>{if(e.target===check||e.target.closest('.aSelect'))return;if(e.target.closest('.aLockMark'))return;if(equip(item.uid)){window.TITLE.refreshPreparation();preview(item.type);}else showMessage('保存失败，未能装备');};card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();card.click();}};bag.append(card);
    }
    let tools=root.querySelector('#aTools');if(!tools){tools=document.createElement('section');tools.id='aTools';bag.after(tools);}
    if(!tools.querySelector('details'))tools.innerHTML='<details><summary>掉落与熔炼规则</summary><p><b>哪里掉武器</b><br>精英必掉1把；首领掉1～3把；小兵偶尔掉。首领掉的品质最好，精英其次，小兵最差。</p><p><b>去哪里刷</b><br>校场演武比主线更容易出好武器：第1层最高掉优良，每往上一层多一档，第4层起能掉传说。通关第5层后开放第6层·魔化演武：敌人全部魔化，更难，掉落更多，还会掉专属特殊词条「噬魂」。</p><p><b>仓库</b><br>身上加仓库一共50格，满了就捡不起来，记得熔炼或丢弃。</p><p><b>熔炼</b><br>勾选3～5把熔成1把新武器：造型和品质取数量最多的那种，词条全部重新随机。放得越多，越容易升一档品质（每次最多升一档，传说不再升）。<br><b>保底：</b>某档品质熔炼没升阶，下次熔这档品质的升阶概率会提高，升阶后清零。放5把时，普通最多第5次、优良最多第7次、精致最多第9次、史诗最多第14次必定升阶。具体概率看熔炼按钮上的数字。已装备、已锁定的武器不能熔炼。</p></details>';
    tools.querySelector('details').open=tools.dataset.open==='1';tools.querySelector('details').ontoggle=e=>tools.dataset.open=e.target.open?'1':'0';
    const forge=root.querySelector('#aForge'),lock=root.querySelector('#aLock'),discard=root.querySelector('#aDiscard');
    forge.onclick=()=>{const ids=[...selection],selected=ids.map(id=>p.items.find(i=>i.uid===id)).filter(Boolean),plan=EQUIPMENT_RULES.forgePlan(selected,state().pity);if(!plan){showMessage('请选择3～5把未装备、未锁定武器');return;}
      // 吃亏提醒：材料里有比熔出品质更高的，或带特殊词条的
      const top=Math.max(...plan.qualities),costly=selected.filter(i=>Math.min(4,i.q)>top||i.special),warn=costly.length?`\n\n⚠ 注意：目前搭配会出${plan.qualities.map(q=>D.qualities[q].name).join('或')}，${costly.map(i=>D.label(i)+(i.special?'（带特殊词条）':'')).join('、')} 也会被熔掉！`:'';
      askConfirm({title:'确认熔炼',description:`将消耗以下${selected.length}把武器，词条与特殊均重抽：`,items:selected,summary:forgeSummary(plan)+'\n天工按传说统计，特殊独立5%。'+warn,warn:!!warn,action:async()=>{
        // 熔的就是确认框里列出的那几把；先和云端核对，防止另一台设备已经用掉
        showMessage('正在核对存档…');
        if(window.CLOUD_SAVE&&CLOUD_SAVE.sync)await CLOUD_SAVE.sync(window.TITLE?TITLE.playerName():'');
        const now=state(),eq=new Set(Object.values(now.equipped));
        if(ids.some(id=>{const i=now.items.find(x=>x.uid===id);return !i||i.locked||eq.has(id);})){message='这些武器有的已在其他设备使用或已装备、锁定，熔炼取消，材料未消耗';window.TITLE.refreshPreparation();return;}
        const result=reforge(ids);message=result?'熔炼获得：'+D.label(result)+(result.forgeFrom!=null?'（升阶成功）':''):'熔炼失败，材料未消耗';window.TITLE.refreshPreparation();}});};
    lock.onclick=()=>{const selected=[...selection].map(id=>p.items.find(i=>i.uid===id)).filter(Boolean);if(!selected.length)return;const makeLocked=!selected.every(i=>i.locked);for(const item of selected)item.locked=makeLocked;save();window.TITLE.refreshPreparation();};
    discard.onclick=()=>{const selected=[...selection].map(id=>p.items.find(i=>i.uid===id)).filter(Boolean);if(!selected.length||selected.some(i=>i.locked||equippedIds.has(i.uid))){showMessage('已装备或已锁定的武器不能丢弃');return;}askConfirm({title:'确认丢弃',description:'以下武器将被丢弃，无法找回。',items:selected,action:()=>{const ids=new Set(selected.map(i=>i.uid)),old=p.items;p.items=p.items.filter(i=>!ids.has(i.uid));if(!save()){p.items=old;showMessage('保存失败，未丢弃');return;}selection.clear();message='已丢弃所选武器';window.TITLE.refreshPreparation();}});};
    updateFooter(root);showMessage(message|| (p.items.length>=50?'已满50把，请先熔炼或丢弃':p.items.length>=40?'仓库将满，建议整理闲置武器':''));message='';
  }
  const percent=n=>Number((n*100).toFixed(2))+'%';
  const shortPercent=n=>{const v=n*100;return (v>0&&v<1?v.toFixed(1):String(Math.round(v)))+'%';};   // 按钮标签空间小：取整，不足1%留一位小数
  function forgeSummary(plan){return '造型：'+plan.types.map(t=>D.names[t]+' '+percent(1/plan.types.length)).join('、')+'\n基础品质：'+plan.qualities.map(q=>D.qualities[q].name+' '+percent(1/plan.qualities.length)).join('、')+'\n升阶机会：'+percent(plan.upgradeChance)+(plan.pityBonus>0?'（其中保底加成 +'+percent(plan.pityBonus)+'）':'')+'\n最终基础品质：'+Object.entries(plan.outcomes).filter(([,chance])=>chance>0).map(([q,chance])=>D.qualities[q].name+' '+percent(chance)).join('、');}
  function updateFooter(root=document){const p=state(),items=[...selection].map(id=>p.items.find(i=>i.uid===id)).filter(Boolean),equippedIds=new Set(Object.values(p.equipped)),invalidLocked=items.some(i=>i.locked),invalidEquipped=items.some(i=>equippedIds.has(i.uid)),plan=EQUIPMENT_RULES.forgePlan(items,state().pity),forge=root.querySelector('#aForge'),tag=root.querySelector('#aForgeTag'),lock=root.querySelector('#aLock'),discard=root.querySelector('#aDiscard');if(!forge||!tag||!lock||!discard)return;const valid=!!plan&&!invalidLocked&&!invalidEquipped;forge.disabled=!valid;const prefix=`已选 ${items.length}/5`;tag.textContent=invalidEquipped?`${prefix} · 含已装备`:invalidLocked?`${prefix} · 含已锁定`:!plan?`${prefix} · 至少选3把`: `${prefix} · 升阶 ${shortPercent(plan.upgradeChance)}${plan.pityBonus>0?'（含保底）':''}`;lock.disabled=!items.length;lock.textContent=items.length&&items.every(i=>i.locked)?'解锁':'锁定';discard.disabled=!items.length||invalidLocked||invalidEquipped;}
  function showMessage(text){const n=document.getElementById('aMessage')||document.getElementById('tPrepStatus');if(n)n.textContent=text;}
  function exportProfile(){const p=copy(state());p.campaign=CLOUD_MERGE.merge({campaign:p.campaign},{campaign:window.TITLE?TITLE.campaignProgress():{}}).campaign;return p;}
  function mergeCloud(profile){
    const before=copy(state()),local=exportProfile();
    // 全新设备尚未出征时，默认赠送武器不重复塞进已有的云端仓库。
    if(freshLocal&&profile.items?.length){local.items=[];local.equipped={};local._equipAt={};}
    const merged=CLOUD_MERGE.merge(profile,local);
    // 武器顺序以本机为准，云端新来的排在最后：同步后卡片位置不跳，防止勾错。
    const order=new Map(before.items.map((i,n)=>[i.uid,n]));
    merged.items=merged.items.map((item,n)=>({item,n})).sort((a,b)=>(order.has(a.item.uid)?order.get(a.item.uid):1e6+a.n)-(order.has(b.item.uid)?order.get(b.item.uid):1e6+b.n)).map(x=>x.item);
    const sig=p=>JSON.stringify([p.items,p.equipped,p.campaign]);
    if(merged.items.length>EQUIPMENT_RULES.CAPACITY){message='云端合并后超过50把，请先在原设备熔炼或丢弃，再同步';return false;}
    // 保留首份云同步前本机备份；同步失败不会移除本机装备。
    if(!debug)try{const backupKey=KEY+'-backup:'+cacheName;if(!localStorage.getItem(backupKey))localStorage.setItem(backupKey,JSON.stringify(before));}catch(e){}
    Object.assign(cache,merged);if(!save({remote:true})){cache=before;baseline=copy(before);return false;}
    freshLocal=false;
    if(window.TITLE)TITLE.applyCloudProgress(merged.campaign);
    lastChanged=sig(exportProfile())!==sig(local);
    // 同步不清空勾选：只去掉已经不存在的武器（重画时还会去掉已装备的）。
    for(const uid of [...selection])if(!state().items.some(i=>i.uid===uid))selection.delete(uid);
    return true;
  }
  function setMastery(next){const p=state();p.mastery=next;save();}
  window.ARMORY={setMastery,toggleLock(uid){const i=state().items.find(x=>x.uid===uid);if(i){i.locked=!i.locked;save();}},count:()=>state().items.length,capacity:()=>EQUIPMENT_RULES.CAPACITY,state,equipped,active,add,grant,equip,unequip,reforge,render,exportProfile,mergeCloud,lastMergeChanged:()=>lastChanged,byId:uid=>state().items.find(i=>i.uid===uid),
    played:()=>!!state().played,markPlayed(){state().played=true;save();},
    owns:type=>state().items.some(i=>i.type===type),prepared:()=>['long','short','ranged'].map(equipped).find(Boolean)?.type||null};
})();
