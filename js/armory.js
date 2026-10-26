// 每个玩家独立的武器实例仓库；调试存档仅在内存中。
(() => {
  const D=AFFIX_DATA,KEY='wzb-equipment-v2',debug=/[?&]debug(?:=|&|$)/.test(location.search);
  const memory=Object.create(null); let cache=null,cacheName='',baseline=null,freshLocal=false,selection=new Set(),message='';
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
  function equip(uid){const p=state(),item=p.items.find(i=>i.uid===uid);if(!item)return false;const slot=D.slots[item.type],old=p.equipped[slot];p.equipped[slot]=uid;if(!save()){p.equipped[slot]=old;return false;}selection.delete(uid);return true;}
  function unequip(slot){const p=state(),old=p.equipped[slot];p.equipped[slot]=null;if(!save()){p.equipped[slot]=old;return false;}return true;}

  function reforge(ids){
    const p=state(),items=ids.map(id=>p.items.find(i=>i.uid===id));
    if(ids.length<3||ids.length>5||new Set(ids).size!==ids.length||items.some(i=>!i||i.locked||Object.values(p.equipped).includes(i.uid)))return false;
    const plan=EQUIPMENT_RULES.forgePlan(items),type=D.pick(plan.types),base=D.pick(plan.qualities);
    const upgraded=Math.random()<EQUIPMENT_RULES.upgrades[ids.length][base],q=base+(upgraded?1:0);
    const fresh=D.generate(type,'boss','',q),old=p.items;
    if(upgraded)fresh.forgeFrom=base;
    p.items=p.items.filter(i=>!ids.includes(i.uid));p.items.push(fresh);
    if(!save()){p.items=old;return false;}selection.clear();return fresh;
  }
  function setupStyle(){if(document.getElementById('armoryStyle'))return;
    const style=document.createElement('style');style.id='armoryStyle';style.textContent=`
    #tChapterPanel{overflow-y:auto!important} #tPrepMain,#tPrepFooter,#aTools{flex-shrink:0} #tPrepBag{height:220px!important;max-height:230px;overflow-y:auto;align-content:start;grid-template-rows:none!important;grid-auto-rows:minmax(110px,auto)}
    .aCard{position:relative;min-height:110px;padding:7px;border:1px solid #78603e;border-top:3px solid var(--quality);border-radius:3px;background:linear-gradient(135deg,#453324,#261e18);color:#e8d4ad;font-size:12px}
    .aCard.selected{outline:2px solid #edc465;background:#574124}.aCard button,#aTools button{font:inherit;color:#ecd6ac;background:linear-gradient(#60472c,#38281b);border:1px solid #a6834d;border-radius:3px;cursor:pointer;padding:4px 7px}
    .tPrepName{overflow-wrap:anywhere}.aUnequip{font-size:11px;color:#dcc493;border:1px solid #80613c;background:#38291d;cursor:pointer}
    .aCard button:active,#aTools button:active{transform:translateY(1px);filter:brightness(.8)}
    .aCard .aEquip{display:flex;flex-direction:column;align-items:center;width:100%;border:0;background:none;color:var(--quality)}
    .aCard img{width:40px;height:40px;object-fit:contain;image-rendering:pixelated}.aCard .aActions{display:flex;gap:4px;justify-content:center;margin-top:5px}
    .aCard input{accent-color:#b28a4a}#aTools{font-size:12px;color:#cdb78f;line-height:1.5;padding:8px 0}#aTools p{margin:4px 0}#aTools details{margin:5px 0}#aTools button{margin-right:6px}#aTools button:disabled{opacity:.45;cursor:default}#aMessage{color:#f2d28b}
    @media(max-height:450px){#tPrepBag{height:130px!important;max-height:150px}.aCard{min-height:95px;font-size:11px}#aTools{font-size:11px}}
    `;document.head.append(style);
  }
  function render(root,icon,preview){
    setupStyle();const p=state(),bag=root.querySelector('#tPrepBag');if(!bag)return;
    const countLabel=root.querySelector('#tPrepBagTitle > span');if(countLabel){countLabel.textContent='武器 '+p.items.length+'/'+EQUIPMENT_RULES.CAPACITY+'（含已装备）';countLabel.style.color=p.items.length>=50?'#efa18e':p.items.length>=40?'#edce83':'';}
    const slots=root.querySelectorAll('.tPrepSlot');slots.forEach(node=>{const item=equipped(node.dataset.slot);if(item){node.dataset.uid=item.uid;const label=node.querySelector('.tPrepName');label.textContent=D.label(item);label.style.color=D.qualities[item.q].color;const remove=document.createElement('button');remove.type='button';remove.className='aUnequip';remove.textContent='卸下';remove.onclick=e=>{e.stopPropagation();if(unequip(node.dataset.slot))window.TITLE.refreshPreparation();};node.append(remove);}});
    bag.replaceChildren();bag.style.gridTemplateColumns='repeat(auto-fill,minmax(116px,1fr))';
    const eq=new Set(Object.values(p.equipped));
    for(const item of p.items.filter(i=>!eq.has(i.uid))){
      const card=document.createElement('div');card.className='aCard'+(selection.has(item.uid)?' selected':'');card.style.setProperty('--quality',D.qualities[item.q].color);card.dataset.uid=item.uid;
      const button=document.createElement('button');button.type='button';button.className='aEquip';button.dataset.weapon=item.type;button.dataset.uid=item.uid;
      const image=document.createElement('span');image.innerHTML=icon(item.type);button.append(image);
      const title=document.createElement('span');title.textContent=D.label(item)+(item.special?' ✦':'');button.append(title);
      button.onclick=()=>{if(equip(item.uid)){window.TITLE.refreshPreparation();preview(item.type);}else showMessage('保存失败，未能装备');};
      card.dataset.weapon=item.type;card.append(button);
      const actions=document.createElement('div');actions.className='aActions';
      const info=document.createElement('button');info.type='button';info.textContent='详情';info.dataset.weaponDetail=item.uid;info.onclick=e=>{e.stopPropagation();if(window.WEAPON_TIP)WEAPON_TIP.open(item,info);};actions.append(info);
      const lock=document.createElement('button');lock.textContent=item.locked?'已锁':'锁定';lock.setAttribute('aria-pressed',String(item.locked));lock.onclick=()=>{item.locked=!item.locked;selection.delete(item.uid);save();window.TITLE.refreshPreparation();};actions.append(lock);
      const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.disabled=item.locked;check.checked=selection.has(item.uid);check.onchange=()=>{if(check.checked){if(selection.size>=5){check.checked=false;showMessage('熔炼最多选择5把');return;}selection.add(item.uid);}else selection.delete(item.uid);card.classList.toggle('selected',check.checked);if(window.WEAPON_TIP)WEAPON_TIP.hide();updateForgePreview();};label.append(check,'熔炼');actions.append(label);card.append(actions);bag.append(card);

    }
    let tools=root.querySelector('#aTools');if(!tools){tools=document.createElement('section');tools.id='aTools';bag.after(tools);}
    tools.innerHTML='<p>主线第一章：精英必掉1把，小兵0.5%掉1把，BOSS掉1～3把。校场演武更容易掉落好武器。身上＋仓库最多50把；满仓不能收入新武器，请先熔炼或丢弃。</p><details><summary>掉落与熔炼规则</summary><p>主线品质（普通／优良／精致／极品／传说）：管亥12／42／26／15／5%；老卒36／40／17／6／1%；小兵65／25／8／1.8／0.2%。校场按层数使用独立掉落表。</p><p>投入3～5把，造型和基础品质分别取多数，平票随机。同等基础品质下，多放材料提高升阶概率，每次最多升一级。天工按传说统计，特殊不继承，独立5%重抽。已装备、已锁定武器不能投入。</p><p>3／4／5把升阶率：普通10%／15%／20%；优良6%／10%／15%；精致3%／5%／8%；极品1%／2%／3%。传说不再升品质。</p></details><div id="aForgePreview" role="status" style="margin:8px 0;padding:9px;border:1px solid #8c6a3f;background:#392a1e;white-space:pre-line;line-height:1.7"></div><p><button id="aForge" type="button">熔炼所选武器</button><button id="aDiscard" type="button">丢弃所选</button><span id="aMessage" role="status"></span></p>';
    tools.querySelector('#aForge').onclick=()=>{if(selection.size<3||selection.size>5){showMessage('请选择3～5把未装备、未锁定武器');return;}const selected=[...selection].map(id=>p.items.find(i=>i.uid===id)),plan=EQUIPMENT_RULES.forgePlan(selected);if(!confirm('消耗以下'+selected.length+'把武器，词条与特殊均重抽：\n'+selected.map(D.label).join('\n')+'\n'+forgeSummary(plan)+'\n天工按传说统计，特殊独立5%。'))return;const result=reforge([...selection]);message=result?'熔炼获得：'+D.label(result)+(result.forgeFrom!=null?'（升阶成功）':''):'熔炼失败，材料未消耗';window.TITLE.refreshPreparation();};
    tools.querySelector('#aDiscard').onclick=()=>{const ids=[...selection];if(!ids.length)return;if(!confirm('丢弃选中的'+ids.length+'把武器？无法找回。'))return;const old=p.items;p.items=p.items.filter(i=>!ids.includes(i.uid)||i.locked||eq.has(i.uid));if(!save()){p.items=old;showMessage('保存失败，未丢弃');return;}selection.clear();message='已丢弃所选武器';window.TITLE.refreshPreparation();};
    updateForgePreview();showMessage(message|| (p.items.length>=50?'已满50把，请先整理再出征':p.items.length>=40?'仓库将满，建议熔炼或丢弃闲置武器':''));message='';
  }
  const percent=n=>Number((n*100).toFixed(2))+'%';
  function forgeSummary(plan){return '造型：'+plan.types.map(t=>D.names[t]+' '+percent(1/plan.types.length)).join('、')+'\n基础品质：'+plan.qualities.map(q=>D.qualities[q].name+' '+percent(1/plan.qualities.length)).join('、')+'\n升阶机会：'+percent(plan.upgradeChance)+'\n最终基础品质：'+Object.entries(plan.outcomes).filter(([,chance])=>chance>0).map(([q,chance])=>D.qualities[q].name+' '+percent(chance)).join('、');}
  function updateForgePreview(){const box=document.getElementById('aForgePreview'),button=document.getElementById('aForge');if(!box||!button)return;const p=state(),items=[...selection].map(id=>p.items.find(i=>i.uid===id)).filter(Boolean),plan=EQUIPMENT_RULES.forgePlan(items);button.disabled=!plan;button.textContent=plan?'熔炼所选'+items.length+'把':'熔炼（至少3把）';box.textContent='已选择 '+items.length+'/5 把。'+(plan?forgeSummary(plan)+'。词条重抽，特殊独立5%；传说附特殊成为天工。':'至少选择3把，多放提高升阶机会。');}
  function showMessage(text){const n=document.getElementById('aMessage');if(n)n.textContent=text;}
  function exportProfile(){const p=copy(state());p.campaign=CLOUD_MERGE.merge({campaign:p.campaign},{campaign:window.TITLE?TITLE.campaignProgress():{}}).campaign;return p;}
  function mergeCloud(profile){
    const before=copy(state()),local=exportProfile();
    // 全新设备尚未出征时，默认赠送武器不重复塞进已有的云端仓库。
    if(freshLocal&&profile.items?.length){local.items=[];local.equipped={};local._equipAt={};}
    const merged=CLOUD_MERGE.merge(profile,local);
    if(merged.items.length>EQUIPMENT_RULES.CAPACITY){message='云端合并后超过50把，请先在原设备熔炼或丢弃，再同步';return false;}
    // 保留首份云同步前本机备份；同步失败不会移除本机装备。
    if(!debug)try{const backupKey=KEY+'-backup:'+cacheName;if(!localStorage.getItem(backupKey))localStorage.setItem(backupKey,JSON.stringify(before));}catch(e){}
    Object.assign(cache,merged);if(!save({remote:true})){cache=before;baseline=copy(before);return false;}
    freshLocal=false;
    if(window.TITLE)TITLE.applyCloudProgress(merged.campaign);
    selection.clear();return true;
  }
  window.ARMORY={count:()=>state().items.length,capacity:()=>EQUIPMENT_RULES.CAPACITY,state,equipped,active,add,grant,equip,unequip,reforge,render,exportProfile,mergeCloud,byId:uid=>state().items.find(i=>i.uid===uid),
    played:()=>!!state().played,markPlayed(){state().played=true;save();},
    owns:type=>state().items.some(i=>i.type===type),prepared:()=>['long','short','ranged'].map(equipped).find(Boolean)?.type||null};
})();
