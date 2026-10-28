// 武器详情仅此一套：桌面只读悬停预览，点击/触屏长按打开可交互的居中对比弹窗。
(() => {
  let tip, dialog, panels, closeButton, root, active=null, mode='', hideTimer, longTimer, touch=null;
  let suppressClickUntil=0, suppressFocusUntil=0, returnFocus=null;
  const coarse=()=>matchMedia('(pointer: coarse)').matches;
  let actions;
  const now=()=>performance.now();
  function close(){
    clearTimeout(hideTimer);clearTimeout(longTimer);
    if(active)active.removeAttribute('aria-describedby');
    const restore=mode==='modal'?returnFocus:null;
    active=null;mode='';returnFocus=null;
    if(tip)tip.hidden=true;
    if(restore?.isConnected){suppressFocusUntil=now()+300;restore.focus({preventScroll:true});}
  }
  function hide(){if(mode==='hover')close();}
  function later(){clearTimeout(hideTimer);hideTimer=setTimeout(hide,60);}   // 鼠标移开后很快关闭（只留一点点时间让鼠标移进浮窗）
  function inBridge(x,y){
    // 只算武器卡、浮窗本身，和两者之间那条窄通道；不再用两者的外接大矩形（浮窗很大时，鼠标移开也还在矩形里，浮窗关不掉）
    if(mode!=='hover'||!active||!tip||tip.hidden)return false;
    const a=active.getBoundingClientRect(),t=(dialog||tip).getBoundingClientRect(),pad=4;
    const inside=(r)=>x>=r.left-pad&&x<=r.right+pad&&y>=r.top-pad&&y<=r.bottom+pad;
    if(inside(a)||inside(t))return true;
    const gapL=Math.min(a.right,t.right),gapR=Math.max(a.left,t.left);
    return x>=Math.min(gapL,gapR)-pad&&x<=Math.max(gapL,gapR)+pad&&y>=a.top-pad&&y<=a.bottom+pad;
  }
  function weaponNode(target){
    const el=target?.closest?.('.aCard[data-uid],.tPrepSlot[data-uid]') || target?.closest?.('[data-item],[data-weapon]');
    return el&&root?.contains(el)?el:null;
  }
  function itemAt(node){
    if(!node||!window.ARMORY)return null;
    return node.dataset.uid?ARMORY.byId(node.dataset.uid):ARMORY.active(node.dataset.weapon||node.dataset.item);
  }
  function place(){
    if(!tip||tip.hidden||mode!=='hover'||!active)return;
    const r=active.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight,gap=10,margin=10;
    const leftSpace=r.left-margin-gap,rightSpace=innerWidth-margin-gap-r.right;
    let x,y,availableHeight=innerHeight-margin*2;
    if(r.left+r.width/2>=innerWidth/2&&leftSpace>=w){x=r.left-gap-w;y=Math.max(margin,Math.min(r.top,innerHeight-h-margin));}
    else if(r.left+r.width/2<innerWidth/2&&rightSpace>=w){x=r.right+gap;y=Math.max(margin,Math.min(r.top,innerHeight-h-margin));}
    else if(leftSpace>=w){x=r.left-gap-w;y=Math.max(margin,Math.min(r.top,innerHeight-h-margin));}
    else if(rightSpace>=w){x=r.right+gap;y=Math.max(margin,Math.min(r.top,innerHeight-h-margin));}
    else {
      x=Math.max(margin,(innerWidth-w)/2);
      const above=Math.max(0,r.top-margin-gap),below=Math.max(0,innerHeight-margin-gap-r.bottom);
      if(above>=below){availableHeight=Math.max(40,above);y=Math.max(margin,r.top-gap-availableHeight);}
      else {availableHeight=Math.max(40,below);y=r.bottom+gap;}
      tip.style.maxHeight=Math.min(availableHeight,innerHeight-margin*2)+'px';
    }
    if(leftSpace>=w||rightSpace>=w)tip.style.maxHeight=`calc(100dvh - ${margin*2}px)`;
    tip.style.left=Math.round(x)+'px';tip.style.top=Math.round(y)+'px';
  }
  function content(item){
    panels.replaceChildren();
    const equipped=ARMORY.equipped(AFFIX_DATA.slots[item.type]);
    const compare=equipped&&equipped.uid!==item.uid?equipped:null;
    dialog.classList.toggle('two',!!compare);
    function frame(value,label,kind,other,peer=null){
      const section=document.createElement('section');section.className='wt-frame '+kind;
      const title=document.createElement('header');title.textContent=label;
      const body=document.createElement('div');WEAPON_DETAIL.render(body,value,{compare:other,peer,compact:mode==='hover'||coarse()});
      section.append(title,body);panels.append(section);
    }
    if(compare)frame(compare,'已装备','wt-equipped',null,item);   // 手机/桌面都用同一顺序：已装备在左，待选在右
    frame(item,compare?'待选':equipped?'已装备':'武器详情',compare?'wt-candidate':'',compare);
  }
  function show(node){
    if(mode==='modal'||!root?.classList.contains('open'))return;
    const item=itemAt(node);if(!item){hide();return;}
    close();active=node;mode='hover';content(item);
    tip.classList.remove('is-modal');tip.style.pointerEvents='auto';tip.style.maxHeight=`calc(100dvh - 20px)`;tip.setAttribute('aria-modal','false');tip.hidden=false;
    node.setAttribute('aria-describedby',tip.id);place();
  }
  function open(item,trigger){
    if(!tip||!item)return;
    close();active=trigger||null;returnFocus=trigger||document.activeElement;mode='modal';content(item);
    tip.style.left='';tip.style.top='';tip.style.maxHeight='';tip.style.pointerEvents='auto';tip.classList.add('is-modal');tip.setAttribute('aria-modal','true');tip.hidden=false;
    actions.replaceChildren();actions.hidden=!coarse();
    if(coarse()){
      const slot=AFFIX_DATA.slots[item.type],isEquipped=ARMORY.equipped(slot)?.uid===item.uid;
      const add=(label,fn)=>{const b=document.createElement('button');b.className='wt-close';b.textContent=label;b.onclick=fn;actions.append(b);};
      add(isEquipped?'卸下':'装备',()=>{isEquipped?ARMORY.unequip(slot):ARMORY.equip(item.uid);TITLE.refreshPreparation();close();});
      add(item.locked?'解锁':'锁定',()=>{ARMORY.toggleLock(item.uid);TITLE.refreshPreparation();open(ARMORY.byId(item.uid));});
      add('关闭',close);
    }
    closeButton.focus({preventScroll:true});
  }
  function attach(container){
    if(root)return;root=container;
    const style=document.createElement('style');style.textContent=`
      #wWeaponTip{position:fixed;z-index:10000;width:min(640px,90vw);max-width:calc(100vw - 20px);max-height:calc(100dvh - 20px);overflow:auto;color:#e8d6af;font:13px/1.5 sans-serif;pointer-events:none;box-sizing:border-box}
      #wWeaponTip[hidden]{display:none!important}#wWeaponTip:not(.is-modal):has(.wt-dialog:not(.two)){width:min(380px,96vw)}
      .wt-dialog{width:100%;box-sizing:border-box;position:relative}.wt-panels{display:grid;grid-template-columns:minmax(0,1fr);gap:10px;align-items:start}
      .wt-dialog.two .wt-panels{grid-template-columns:repeat(2,minmax(0,1fr))}.wt-dialog.two .wd-title{min-height:58px}.wt-frame{min-width:0;overflow:hidden;border:2px solid #ba9250;border-radius:6px;background:repeating-linear-gradient(3deg,#d3ab6808 0 1px,transparent 1px 7px),linear-gradient(135deg,#403022,#211b16);box-shadow:inset 0 0 0 3px #2c231b,0 5px 22px #160f0ab3}
      .wt-frame>header{font-size:13px;font-weight:700;padding:6px 12px;background:#b18b4920;border-bottom:1px solid #80623b;letter-spacing:2px}.wt-equipped{border-color:#6f8fa8}.wt-equipped>header{color:#b7cfdf;background:#6f8fa820}.wt-candidate{border-color:#e2b85c}.wt-candidate>header{color:#f0ce83}
      .wt-frame>.weapon-detail{padding:12px 14px;box-sizing:border-box;max-height:calc(100dvh - 38px);overflow:auto;overscroll-behavior:contain;touch-action:pan-y}
      .wt-bar{display:none}#wWeaponTip.is-modal{inset:0;max-width:none;width:auto;max-height:none;overflow:auto;display:flex;align-items:center;justify-content:center;background:#100b08c7;padding:12px;overscroll-behavior:contain}
      #wWeaponTip.is-modal .wt-dialog{width:min(380px,96vw)}#wWeaponTip.is-modal .wt-dialog.two{width:min(800px,96vw)}.is-modal .wt-bar{display:flex;justify-content:flex-end;margin-bottom:7px}.wt-close{border:1px solid #b89459;color:#f0dab0;background:#3e2b1f;border-radius:5px;padding:7px 14px;font:14px sans-serif;cursor:pointer;min-height:36px}
      .is-modal .wt-frame>.weapon-detail{max-height:calc(100dvh - 115px)}
      @media(max-width:559px){.wt-dialog.two .wd-title{min-height:0}.wt-dialog.two .wt-panels{grid-template-columns:minmax(0,1fr)}.wt-dialog.two .wt-frame>.weapon-detail{max-height:calc(50dvh - 80px)}}
      @media(max-height:430px){.wt-frame>.weapon-detail{padding:8px 11px}.wt-frame>header{padding:3px 10px}}
      @media(pointer:coarse){.aCard,.tPrepSlot,#wWeaponTip{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}#wWeaponTip.is-modal{justify-content:flex-end;padding:6px}#wWeaponTip.is-modal .wt-dialog,#wWeaponTip.is-modal .wt-dialog.two{width:min(480px,50vw);max-height:calc(100dvh - 12px);overflow:auto}.wt-dialog.two .wt-panels{grid-template-columns:1fr}.is-modal .wt-frame>.weapon-detail{max-height:none}.wt-actions{position:sticky;bottom:0;display:flex;justify-content:space-around;gap:5px;padding:8px 2px;background:#271c15}.wt-actions[hidden]{display:none}.wt-dialog.two .wd-title{min-height:0}}
      @media(pointer:coarse) and (orientation:portrait){#wWeaponTip.is-modal .wt-dialog,#wWeaponTip.is-modal .wt-dialog.two{width:96vw}}
    `;document.head.append(style);
    tip=document.createElement('aside');tip.id='wWeaponTip';tip.hidden=true;tip.setAttribute('role','dialog');tip.setAttribute('aria-label','武器详情与装备对比');
    dialog=document.createElement('div');dialog.className='wt-dialog';
    const bar=document.createElement('div');bar.className='wt-bar';
    closeButton=document.createElement('button');closeButton.type='button';closeButton.textContent='关闭 ×';closeButton.className='wt-close';closeButton.onclick=close;bar.append(closeButton);
    panels=document.createElement('div');panels.className='wt-panels';actions=document.createElement('div');actions.className='wt-actions';actions.hidden=true;dialog.append(bar,panels,actions);tip.append(dialog);document.body.append(tip);
    tip.addEventListener('click',e=>{if(mode==='modal'&&e.target===tip)close();});
    tip.addEventListener('pointerenter',()=>{if(mode==='hover')clearTimeout(hideTimer);});
    tip.addEventListener('pointerleave',()=>{if(mode==='hover')later();});
    let wasIn=false;document.addEventListener('pointermove',e=>{const inside=inBridge(e.clientX,e.clientY);if(inside)clearTimeout(hideTimer);else if(wasIn&&mode==='hover')later();wasIn=inside;},true);   // 离开浮窗与武器之间的区域时重新计时关闭
    tip.addEventListener('toggle',()=>place(),true);
    tip.addEventListener('touchend',e=>e.stopPropagation(),{passive:true});
    root.addEventListener('touchend',e=>e.stopPropagation(),{passive:true});
    tip.addEventListener('touchmove',e=>e.stopPropagation(),{passive:true});
    root.addEventListener('touchmove',e=>e.stopPropagation(),{passive:true});
    root.addEventListener('pointerover',e=>{
      if(coarse()||e.pointerType==='touch'||mode==='modal')return;
      // 鼠标在勾选框上时只是想勾选，不弹详情；移回卡片其他地方照常显示
      if(e.target.closest?.('.aSelect')){if(mode==='hover')hide();return;}
      const n=weaponNode(e.target);
      if(mode==='hover'&&active?.contains(e.target)){clearTimeout(hideTimer);return;}
      if(n&&n!==active)show(n);
    });
    root.addEventListener('pointermove',e=>{
      if(touch&&e.pointerId===touch.id&&Math.hypot(e.clientX-touch.x,e.clientY-touch.y)>10){clearTimeout(longTimer);touch.moved=true;}
    });
    root.addEventListener('pointerout',e=>{if(mode==='hover'&&active&&e.target!==active&&!active.contains(e.target))return;if(mode==='hover'&&active&&!active.contains(e.relatedTarget))later();});
    root.addEventListener('pointerleave',e=>{if(!tip.contains(e.relatedTarget))later();});
    root.addEventListener('focusin',e=>{const n=weaponNode(e.target);if(now()>=suppressFocusUntil&&n&&e.target.matches(':focus-visible'))show(n);});
    root.addEventListener('focusout',e=>{if(mode==='hover'&&!active?.contains(e.relatedTarget)&&!tip.contains(e.relatedTarget))later();});
    document.addEventListener('pointerdown',e=>{
      if(mode==='hover'&&!active?.contains(e.target)&&!tip.contains(e.target))hide();
      if(e.pointerType!=='touch')return;
      const n=weaponNode(e.target);if(!n||e.target.closest('.aSelect,button,input'))return;
      clearTimeout(longTimer);touch={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false,opened:false};
      longTimer=setTimeout(()=>{const item=itemAt(n);if(touch&&!touch.moved&&n.isConnected&&item){touch.opened=true;suppressClickUntil=now()+800;open(item,n);}},400);
    },true);
    function release(e){if(!touch||e.pointerId!==touch.id)return;clearTimeout(longTimer);if(touch.opened)suppressClickUntil=now()+700;touch=null;}
    document.addEventListener('pointerup',release,true);document.addEventListener('pointercancel',release,true);
    root.addEventListener('click',e=>{if(now()<suppressClickUntil){e.preventDefault();e.stopImmediatePropagation();return;}if(coarse()&&!e.target.closest('.aSelect,button,input')){const n=weaponNode(e.target),item=itemAt(n);if(item){e.preventDefault();e.stopImmediatePropagation();open(item,n);}}},true);
    root.addEventListener('contextmenu',e=>{if(touch||mode==='modal')e.preventDefault();});
    document.addEventListener('keydown',e=>{
      if(!mode)return;
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();return;}
      if(mode==='modal'&&e.key==='Tab'){
        const focus=[...tip.querySelectorAll('button,summary,[tabindex="0"]')].filter(el=>el.getClientRects().length);
        const first=focus[0],last=focus[focus.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
      }
    },true);
    document.addEventListener('scroll',e=>{if(!tip.contains(e.target))hide();},true);
    window.addEventListener('resize',()=>{if(mode==='hover')place();});window.addEventListener('blur',hide);
    new MutationObserver(()=>{
      if(!root.classList.contains('open'))close();
      else if(mode==='hover'&&active&&!active.isConnected)hide();
    }).observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  }
  window.WEAPON_TIP={attach,hide,open,close};
})();
