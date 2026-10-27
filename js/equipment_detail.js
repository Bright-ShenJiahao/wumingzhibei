// 桌面悬浮详情和手机点击详情共用同一份内容；只展示装备后的静态属性。
(() => {
  const fmt=n=>Number(n.toFixed(2)).toString();
  const MOVES = {
    staff: ['四段连招：劈 → 扫 → 回身扫 → 戳', '终段攻击·戳：必定眩晕。', '蓄力攻击·横扫：身前大范围横扫，50%眩晕。'],
    halberd: ['四段连招：劈 → 扫 → 回身扫 → 撕开', '终段攻击·撕开：引爆裂伤造成额外伤害。', '蓄力攻击·回马突：向前冲刺穿刺，沿途叠裂伤。', '每次命中叠1层裂伤，最多5层，持续流血。'],
    hammer: ['三段连招：下砸 → 横抡 → 回旋锤', '终段攻击·回旋锤：环绕一圈，击倒身边所有敌人。', '蓄力攻击·千斤坠：举锤砸地，击倒前方一片敌人。'],
    blade: ['三段连招：斜劈 → 横砍 → 举刀重劈', '终段攻击·举刀重劈：必定暴击，斩杀残血敌人。', '蓄力攻击·半月斩：前方上下大范围横扫，高概率暴击。'],
    stone: ['三段连招：左手掷 → 右手掷 → 全力投', '终段攻击·全力投：必定眩晕，附带左右散射。', '蓄力攻击·连掷：按蓄力档位掷出3/4/5颗。'],
    bow: ['三段连招：速射 → 速射 → 穿透箭', '终段攻击·穿透箭：贯穿一排敌人。', '蓄力攻击·重箭：射出一支重箭。'],
  };
  function node(tag,text,cls){const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;}
  function style(){if(document.getElementById('weaponDetailStyle'))return;const e=node('style');e.id='weaponDetailStyle';e.textContent=`
    .weapon-detail{white-space:normal!important;font-size:13px;line-height:1.5;color:#e8d6af;overflow-wrap:anywhere}
    .weapon-detail .wd-title{font-size:20px;line-height:1.45;font-weight:700;margin:0 0 4px;letter-spacing:.5px}
    .weapon-detail .wd-origin{font-size:13px;color:#c2ac88;font-weight:500}
    .weapon-detail .wd-category{font-size:11px;color:#bca47e;margin:0 0 10px}
    .weapon-detail h4{font-size:12px;letter-spacing:1px;color:#d8bb83;margin:12px 0 7px;border-bottom:1px solid #765a37;padding-bottom:4px}
    .weapon-detail .wd-affix{padding:8px 10px;margin:6px 0;border-left:3px solid #91bd83;border-radius:3px;background:linear-gradient(100deg,#82965a17,#35291e22)}
    .weapon-detail .wd-affix-title{display:flex;justify-content:space-between;gap:8px;color:#ede0c8;font-weight:700}
    .weapon-detail .wd-badge{font-size:11px;color:#c8b58e;font-weight:500;white-space:nowrap}
    .weapon-detail .wd-effect{margin:3px 0 0;color:#acda98;font-size:14px;font-weight:600}
    .weapon-detail .wd-negative{border-color:#d9877a;background:linear-gradient(100deg,#b957421c,#35291e22)}
    .weapon-detail .wd-negative .wd-effect,.weapon-detail .wd-negative .wd-badge{color:#efa18e}
    .weapon-detail .wd-special{border:1px solid #b38d4a;border-left:3px solid #e0bc67;background:linear-gradient(100deg,#bc8e351c,#35291e22)}
    .weapon-detail .wd-special .wd-effect,.weapon-detail .wd-special .wd-badge{color:#edce83}
    .weapon-detail .wd-inactive{opacity:.65;border-color:#8a8173}.weapon-detail .wd-inactive .wd-effect{color:#b3aa9b}
    .weapon-detail .wd-muted{font-size:11px;color:#baa787;margin:5px 0}
    .weapon-detail dl{display:grid;grid-template-columns:76px minmax(0,1fr);gap:5px 10px;margin:7px 0}
    .weapon-detail dt{color:#bca47e}.weapon-detail dd{margin:0;color:#efdfbe}
    .weapon-detail .wd-copy{margin:5px 0;font-size:12px;color:#dcc9a7}
    .weapon-detail details{font-size:12px;margin-top:10px;border-top:1px solid #705435;padding-top:7px}
    .weapon-detail .wd-up{color:#9bd481;font-weight:bold}.weapon-detail .wd-down{color:#ef8c7a;font-weight:bold}
    .weapon-detail summary{cursor:pointer;color:#c9af7d}.weapon-detail summary:focus-visible{outline:1px solid #d5b46d}
    @media(max-height:430px){.weapon-detail{font-size:12px}.weapon-detail .wd-title{font-size:17px}.weapon-detail .wd-affix{padding:6px 8px}.weapon-detail .wd-effect{font-size:13px}}
  `;document.head.append(e);}
  function positiveText(a){const v=a.value;const ordinary={sharp:'攻击伤害',swift:'攻击速度',reach:'攻击距离／射程',health:'最大生命',move:'移动速度',charge:'蓄力攻击伤害'};
    if(ordinary[a.id])return ordinary[a.id]+'＋'+v+'%';
    const text={
      critical:`暴击率＋${v}个百分点`,severity:`暴击伤害＋${v}个百分点`,guard:`受到伤害减少${v}%`,dodge:`普攻闪避率＋${v}个百分点`,focus:`主动技能冷却与蓄力时间减少${v}%`,
      hunt:`对首领伤害＋${v}%`,troops:`对小兵、精英伤害＋${v}%`,exploit:`对异常状态敌人伤害＋${v}%`,victory:`击杀后伤害＋${v}%，持续4秒`,chain:`连续命中同一敌人，每层伤害＋${v}%，最多3层`,
      push:`命中有${v}%概率额外击退`,leech:`命中有${v}%概率回复0.25生命，冷却2秒`,survive:`击杀有${v}%概率回复0.5生命，冷却1秒`,interrupt:`命中有${v}%概率打断可打断施法，冷却3秒`,
      slow:`命中有20%概率使敌人减速${v}%，持续2秒`,numb:`命中有20%概率使敌人攻速降低${v}%，持续2秒`,blind:`命中有20%概率致盲2秒，敌方普攻有${v}%概率未命中`,
      poison:`命中有20%概率中毒，每层每秒造成主攻击非暴击伤害的${v}%，持续3秒，最多2层`,bleed:`命中有15%概率流血，每秒造成主攻击非暴击伤害的${v}%，持续2秒，不叠层`,burn:`命中有20%概率点燃，每层每秒造成主攻击非暴击伤害的${v}%，持续3秒，最多3层`,ice:`命中有${v}%概率积寒，3层冻结0.8秒；首领需6层，冻结0.3秒`,
      pierce:`${v}%概率额外穿透1人，后续伤害50%，不能穿盾`,split:`命中有${v}%概率分裂，对附近最多3名其他敌人造成25%伤害`,scatter:`${v}%概率向随机一侧30°多射1支，伤害35%`,repeat:`${v}%概率追加1次射击，伤害50%`,double:`${v}%概率快速追加1次近战命中，伤害50%`,return:`${v}%概率在最大射程返回，返回伤害35%`,
    };return text[a.id]||'';
  }
  function metrics(item){
    const w=WEAP[item.type],st=AFFIX_DATA.stats(item),combos=w.combo;
    const total=combos.reduce((n,c)=>n+c.d.reduce((a,b)=>a+b,0),0);
    const qBase=AFFIX_DATA.qualities[item.q].base||1,aspd=w.aspd||1;
    const damages=combos.map(c=>c.dmg*st.damage*qBase);
    const ranges=combos.map(c=>(w.proj?c.spd*(c.life||(c.pierce?1.1:.8)):w.reach*(c.thrust?1.35:1))*st.range);
    return {damage:damages.reduce((a,b)=>a+b,0)/damages.length,speed:combos.length*st.speed/total*aspd,range:ranges.reduce((a,b)=>a+b,0)/ranges.length,crit:st.crit,critDamage:st.critDamage,health:st.health,guard:st.guard,move:st.move,dodge:st.dodge,focus:st.focus,quality:qBase};
  }
  function render(container,item,{compare=null,compact=false,peer=null}={}){
    if(!item||typeof WEAP==='undefined'||!WEAP[item.type])return;style();container.replaceChildren();container.classList.add('weapon-detail');
    const D=AFFIX_DATA,w=WEAP[item.type],st=D.stats(item),combos=w.combo,total=combos.reduce((n,c)=>n+c.d.reduce((a,b)=>a+b,0),0);
    const qBase=D.qualities[item.q].base||1,qPct=Math.round((qBase-1)*100);
    const heading=node('div',null,'wd-title');if(item.inscription)heading.append(node('span',item.inscription+'·','wd-origin'));
    const title=node('span',D.label(item));title.style.color=D.qualities[item.q].color;heading.append(title);container.append(heading);if(!compact)container.append(node('div',({long:'长武器',short:'短武器',ranged:'远程武器'})[w.class]+' · 仅当前手持时生效','wd-category'));
    const affixes=node('section',null,'wd-affixes');affixes.append(node('h4','词条'));
    function affix(name,badge,text,cls=''){
      const card=node('section',null,'wd-affix '+cls),head=node('div',null,'wd-affix-title');head.append(node('span',name),node('span',badge,'wd-badge'));card.append(head,node('div',text,'wd-effect'));affixes.append(card);return card;
    }
    for(const a of item.affixes){const valid=D.applicable(a,item.type);const card=affix('◆ '+D.positive[a.id].name,['初级','中级','高级'][a.tier],positiveText(a),valid?'':'wd-inactive');if(!valid)card.append(node('div','当前武器不生效','wd-muted'));}
    if(item.negative){const a=item.negative,d=D.negative[a.id];const card=affix('▼ '+d.name,'负面',d.desc+(a.id==='fragile'?'＋':'－')+a.value+(d.unit==='pp'?'个百分点':'%'),'wd-negative');if(a.id==='inaccurate'&&st.crit===0)card.append(node('div','抵消基础暴击后，当前暴击率最低为0%。','wd-muted'));}
    if(item.special)affix('✦ '+D.special[item.special].name,'特殊',D.special[item.special].desc,'wd-special');
    if(!item.affixes.length&&!item.negative&&!item.special)affixes.append(node('div','无词条','wd-muted'));
    container.append(node('h4','装备后属性'));
    const list=node('dl'),values=metrics(item),other=compare?metrics(compare):null,peerValues=peer?metrics(peer):other;
    const diffMark=(dd,key)=>{if(!other)return;const diff=values[key]-other[key];if(Math.abs(diff)<=1e-9)return;const delta=node('span',diff>0?' ▲':' ▼',diff>0?'wd-up':'wd-down');delta.title=diff>0?'高于已装备':'低于已装备';delta.setAttribute('aria-label',delta.title);dd.append(delta);};
    const row=(label,value,target=list,key='')=>{const dd=node('dd',value);if(key){dd.dataset.stat=key;diffMark(dd,key);}target.append(node('dt',label),dd);};
    const conditional=(label,value,key,base)=>{if(Math.abs(values[key]-base)>1e-9||(peerValues&&Math.abs(peerValues[key]-base)>1e-9))row(label,value,list,key);};
    row('连招伤害（'+combos.length+'段）',combos.map(c=>fmt(c.dmg*st.damage*qBase)).join('／'),list,'damage');
    if(qPct>0)row('品阶加成','+'+qPct+'%',list,'quality');
    row('平均攻速',fmt(values.speed)+'次/秒',list,'speed');
    const ranges=combos.map(c=>Math.round((w.proj?c.spd*(c.life||(c.pierce?1.1:.8)):w.reach*(c.thrust?1.35:1))*st.range));
    const rangeText=ranges.every(n=>n===ranges[0])?String(ranges[0]):ranges.slice(0,-1).every(n=>n===ranges[0])?'普通'+ranges[0]+'／终段'+ranges[ranges.length-1]:'各段 '+ranges.join('／');
    row(w.proj?'射程':'攻击距离',rangeText,list,'range');
    const crit=node('dd',null);crit.dataset.stat='crit';crit.append(node('span',fmt(st.crit*100)+'%'));diffMark(crit,'crit');crit.append(node('span',' · '));crit.append(node('span',fmt(st.critDamage*100)+'%'));diffMark(crit,'critDamage');list.append(node('dt','暴击'),crit);
    conditional('最大生命',fmt(st.health),'health',10);conditional('减伤',fmt(st.guard*100)+'%','guard',0);conditional('移动速度',fmt(st.move*100)+'%（相对基础）','move',1);
    conditional('普攻闪避',fmt(st.dodge*100)+'%','dodge',0);conditional('冷却缩减',fmt(st.focus*100)+'%','focus',0);
    container.append(list);
    const moves = MOVES[item.type];
    if (moves) {
      const details = node('details', null, 'wd-moves');
      details.append(node('summary', '招式'));
      moves.forEach((text, i) => details.append(node('div', text, item.type === 'halberd' && i === moves.length - 1 ? 'wd-muted' : '')));
      container.append(details);
    }
    if(!compact)container.append(node('div','伤害按连招顺序列出；平均攻速按连续命中、完整连招动作计算。','wd-muted'));
    container.append(affixes);
    if(compact)return;
    container.append(node('h4','攻击方式'));
    const features=combos.map((c,i)=>{const labels=[c.pierce&&'穿透敌人',c.both&&'前后攻击',c.multi&&'多目标命中',c.knock&&'击飞',c.thrust&&'前刺更远',c.daze&&'可造成眩晕'].filter(Boolean);return labels.length?'第'+(i+1)+'段：'+labels.join('、'):'';}).filter(Boolean);
    container.append(node('div',combos.length+'段'+(w.proj?'远程连击':'近战连击')+'；命中后可衔接下一段。'+(w.interrupt?'命中可打断普通敌人蓄力。':''),'wd-copy'));
    if(features.length)container.append(node('div',features.join('；')+'。','wd-copy'));
    container.append(node('h4','蓄力攻击'));
    const start=.4*(1-st.focus),full=2*(1-st.focus),charge=item.affixes.find(a=>a.id==='charge')?.value||0;
    const chargedDamage=(w.proj?1:item.type==='staff'?1.6:2.4)*(st.damage+charge/100)*qBase;
    let chargeText=w.proj?`松开发射3枚扇形${item.type==='bow'?'箭矢':'石子'}，满蓄每枚伤害${fmt(chargedDamage)}。`:item.type==='staff'?`松开使出前方扇形重扫，可击飞；满蓄伤害${fmt(chargedDamage)}。`:item.type==='hammer'?`松开使出前方重砸，可打断并有概率眩晕；满蓄伤害${fmt(chargedDamage)}。`:`松开使出前方蓄力重击；满蓄伤害${fmt(chargedDamage)}。`;
    container.append(node('div',`长按攻击${fmt(start)}秒开始蓄力，${fmt(full)}秒蓄满。`+chargeText+'蓄力越久伤害越高，受击会中断。','wd-copy'));
    const detail=node('details'),summary=node('summary','展开基础数值与计算说明'),base=node('dl');detail.append(summary);
    row('基础伤害',combos.map(c=>fmt(c.dmg)).join('／'),base);row('基础暴击','1% · 基础暴击伤害150%',base);row('首段动作',fmt(combos[0].d.reduce((a,b)=>a+b,0))+'秒（未计装备加速）',base);row('完整连招',fmt(total/st.speed)+'秒（装备后）',base);
    detail.append(base,node('div','距离为游戏单位，不是米；分段距离是招式差异，不是随机射程。属性包含当前武器常驻词条，不含难度、锦囊、暴击和条件触发加成。','wd-muted'));container.append(detail);
  }
  window.WEAPON_DETAIL={render,metrics};
})();
