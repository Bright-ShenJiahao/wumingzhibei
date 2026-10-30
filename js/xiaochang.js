// 每章独立五层；地图、波次、掉落、许愿和无评分结算均由本模块管理。
window.XIAOCHANG = (() => {
  let active = false;
  let run = null, panel = null;
  let magicFx = [], ghostLinks = [];
  const selection = { chapter: 1, floor: 1, wish: '' };
  const CONFIG = {
    1: {
      name: '乱世初鸣', pool: ['grunt', 'blade', 'slinger', 'archer', 'priest', 'elite'], boss: { person: '管亥', start: () => Boss.start(660) },
      melee: ['grunt', 'blade'], ranged: ['slinger', 'archer'],
      weapons: ['staff', 'hammer', 'stone', 'halberd'],
      hp: [1.2, 1.45, 1.75, 2.1, 2.5, 3.5], damage: [1, 1.12, 1.25, 1.4, 1.55, 1.9],
      waves: [
        { budget: 4, pool: ['grunt', 'blade'] },
        { budget: 5, pool: ['grunt', 'blade'], ranged: true },
        { budget: 4, pool: ['grunt', 'blade', 'slinger', 'archer'], core: ['elite'], ranged: true },
        { budget: 6, pool: ['grunt', 'blade', 'slinger', 'archer', 'priest'], core: ['grunt'], ranged: true },
        { budget: 3, pool: ['grunt', 'blade'], eliteChoice: true },
        { boss: true },
      ],
      drops: {
        boss: [[65,35,0,0,0],[35,45,20,0,0],[15,40,30,15,0],[10,40,25,15,10],[5,35,27,18,15],[0,25,25,20,30]],
        elite: [[85,15,0,0,0],[60,32,8,0,0],[40,40,15,5,0],[35,40,17,6,2],[28,40,20,8,4],[20,35,25,12,8]],
        grunt: [[95,5,0,0,0],[80,17,3,0,0],[68,24,7,1,0],[65,25,8,1.5,.5],[60,27,9,3,1],[45,30,15,6,4]],
      },
    },
  };
  const debug = () => /[?&]debug(?:=|&|$)/.test(location.search);
  const config = () => CONFIG[run ? run.chapter : selection.chapter];
  const ranged = type => type === 'slinger' || type === 'archer';
  const MAGIC_POOL = ['rage', 'armor', 'leech', 'blink', 'split'];
  const AFFIX_NAMES = { rage: '狂暴', armor: '铁甲', leech: '嗜血', blink: '鬼影', split: '分裂' };
  const affixNames = z => (z.xAffixes && z.xAffixes.length ? z.xAffixes : (z.xAffix ? [z.xAffix] : [])).map(id => AFFIX_NAMES[id]).filter(Boolean);
  const affixText = z => affixNames(z).join(' · ');
  const magic = () => !!(active && run && run.floor >= 6);
  const pick = values => values[Math.floor(Math.random() * values.length)];
  const highest = chapter => window.TITLE && TITLE.xiaochangProgress ? TITLE.xiaochangProgress(chapter) : 0;
  const maxFloor = chapter => debug() ? 6 : Math.min(6, highest(chapter) + 1);
  const FENCE_RATIO = 264 / 434;

  function refillXiaochangProps() {
    if (!active) return;
    const pool = ['hay', 'cart', 'mill'];
    const cartH = ASSETS.props.cart[2];
    let count = props.filter(p => p.xiaochang && !p.broken).length;
    for (let tries = 0; count < 3 && tries < 200; tries++) {
      const g = pool[Math.floor(Math.random() * pool.length)];
      const [, pw, ph] = ASSETS.props[g];
      const sc = g === 'cart' ? .5 : g === 'mill' ? cartH * .5 / ph : 1;
      const x = Math.random() < .5 ? rnd(60, 220) : rnd(500, 660);
      const y = rnd(M.top + 24, M.bot - 8), w = pw * .75 * sc, h = ph * sc;
      if (props.some(p => !p.broken && Math.abs(p.x - x) < (p.w + w) / 2 + 8 && Math.abs(p.y - y) < 28)) continue;
      props.push({ g, x, y, sc, w, h, solid: true, broken: false, hp: 3, hitT: 0, xiaochang: true });
      count++;
    }
  }

  function start(options = {}) {
    const chapter = options.chapter || selection.chapter, c = CONFIG[chapter];
    if (!c || (!debug() && !(window.TITLE && TITLE.hasCleared(chapter)))) return false;
    if (ARMORY.count() >= ARMORY.capacity()) { toast('已满50把，请先熔炼或卖出，再出征'); return false; }
    const floor = Math.max(1, Math.min(maxFloor(chapter), Math.floor(options.floor || selection.floor)));
    const wish = c.weapons.includes(options.wish ?? selection.wish) ? options.wish ?? selection.wish : '';
    Object.assign(selection, { chapter, floor, wish });
    if (window.TITLE) TITLE.skip();
    if (window.ROOM) ROOM.skip();
    reset();
    M.top = chapter === 2 ? 190 : 168;   // 第二章校场同样避开更低的栅栏
    active = true;
    run = { chapter, floor, wish, wave: 0, status: 'ready', nextAt: gameT, debug: debug(), initial: new Set(ARMORY.state().items.map(i => i.uid)) };
    magicFx = []; ghostLinks = [];
    M.W = 720;
    props = [];
    hero.x = 360; hero.y = (M.top + M.bot) / 2;
    cam.x = Math.max(0, Math.min(M.W - viewW(), hero.x - viewW() / 2));
    tutorialQueue = []; say('', 0);
    refillXiaochangProps();
    hero.hp = maxHeroHp();
    slowT = 0; critT = 0; pdCd = 0; ghosts = []; qiFx = []; blessFx = [];
    joy = null; pressAtk = false; pressRoll = false;
    for (const k in key) delete key[k];
    const chapterPanel = document.getElementById('tChapter'); if (chapterPanel) chapterPanel.classList.remove('open');
    offerWave();
    return true;
  }

  function setHeading() {
    const title = document.querySelector('#top b');
    if (title && run) title.textContent = run.floor >= 6
      ? `校场演武 · 魔化演武 · 第${run.wave}/6波`
      : `校场演武 · 第${run.floor}层 · 第${run.wave}/6波`;
  }
  function offerWave() {
    run.wave++; run.status = 'cards';
    cancelCharge(); pressAtk=false; pressRoll=false;
    for (const k in key) delete key[k];
    // 保留未拾取装备；清掉上一波飞行物和火场，选卡期间不偷袭玩家。
    shots = []; eshots = []; fires = []; allyShots = []; allyFires = [];
    catapults = []; if (typeof Boss !== 'undefined') Boss.reset();
    zs = [];
    if (run.wave === 3 || run.wave === 5) refillXiaochangProps();
    setHeading(); ROGUE.offer();
  }
  function waveTypes(wave = run.wave, floor = run.floor, chapter = run.chapter) {
    const c = CONFIG[chapter], spec = c.waves[wave - 1], melee = c.melee;
    if (spec.boss) {
      const remotes = 1 + Math.floor(Math.random() * 2), count = remotes === 2 ? 3 : 2 + Math.floor(Math.random() * 2);
      return [...Array.from({length: count}, () => pick(melee)), ...Array.from({length: remotes}, () => pick(c.ranged))];
    }
    const out = [...(spec.core || [])];
    if (spec.ranged) out.push(...Array.from({length: 1 + Math.floor(Math.random() * 2)}, () => pick(c.ranged)));
    if (spec.eliteChoice) out.push(...(Math.random() < .5 ? ['elite', 'elite'] : ['elite', pick(c.ranged), pick(c.ranged)]));
    out.push(...rollFill(spec.pool.filter(t => c.pool.includes(t)), spec.budget + floor - 1));
    let priests = 0;
    for (let i = 0; i < out.length; i++) if (out[i] === 'priest' && ++priests > 1) out[i] = pick(melee);
    // 不削掉固定远程兵，以近战补足比例；预算只用于随机填充，固定骨架另计。
    while (out.filter(ranged).length * 3 > out.length) out.push(pick(melee));
    return out;
  }
  function decorate(z) {
    if (!active || !run || z.xiaochang) return;
    z.xiaochang = true;
    z.x=Math.max(12,Math.min(708,z.x));
    if(Math.abs(z.x-hero.x)<90)z.x=hero.x<360?700:20;
    if (run.floor >= 6) {
      const boss = !!(z.T.boss || z.T.chapterBoss);
      const pool = boss ? ['rage', 'armor', 'leech'] : MAGIC_POOL;
      z.xAffixes = [];
      const count = boss ? 2 : 1;
      while (z.xAffixes.length < count) {
        const id = pick(pool.filter(x => !z.xAffixes.includes(x)));
        if (!id) break;
        z.xAffixes.push(id);
      }
      z.xAffix = z.xAffixes[0];
      z.dark = true;
      z.ghost = z.ghost || 0;
      z.blinkT = 6;
      z.affixT = 0; z.affixHold = 4;
      return;
    }
    if (run.floor >= 3 && z.T.elite) z.xAffix = Math.random() < .5 ? 'rage' : 'armor';
    if (run.floor >= 4 && (z.T.boss || z.T.chapterBoss)) z.xAffix = Math.random() < .5 ? 'rage' : 'armor';
    if (z.xAffix) { z.xAffixes = [z.xAffix]; z.affixT = 0; z.affixHold = 4; }
  }
  function spawnSide(type, index = 0) {
    // 出生点与玩家至少相距90，极端贴边时全部改从另一侧进入。
    const left = hero.x > 540 || (hero.x >= 180 && index % 2 === 0);
    const x = left ? 18 + (index % 3) * 12 : 702 - (index % 3) * 12;
    let y = M.top + 12 + (index * 27) % 100;
    spawn(type, x, y);
    const z = zs[zs.length - 1]; decorate(z);
    z.x = Math.max(12, Math.min(708, z.x));
    if (Math.abs(z.x - hero.x) < 90) z.x = hero.x < 360 ? 700 : 20;
    return z;
  }
  function spawnWave() {
    if (run.wave === 6) {
      const z = config().boss.start(); decorate(z);
      z.x = hero.x < 360 ? 680 : 40; z.st = 'idle'; z.t = 0; z.cd = 1.2;
      arenaL = null; lockR = Infinity;
    }
    waveTypes().forEach((type, i) => spawnSide(type, i));
    run.status = 'fight';
  }
  function nearestLiving(z) {
    let best = null, dist = Infinity;
    for (const o of zs) {
      if (o === z || o.dead) continue;
      const d = Math.abs(o.x - z.x) + Math.abs(o.y - z.y);
      if (d < dist) { dist = d; best = o; }
    }
    return best;
  }
  function magicDeath(z) {
    if (!magic() || z.magicDeathDone) return;
    z.magicDeathDone = true;
    const target = nearestLiving(z);
    if (target) ghostLinks.push({ x0: z.x, y0: z.y - 20, target, t: 0, T: .5 });
    if (z.xAffixes && z.xAffixes.includes('split') && !z.noSplit && !z.T.boss && !z.T.chapterBoss) {
      spawn('grunt', z.x, z.y);
      const child = zs[zs.length - 1];
      if (child) {
        child.xiaochang = true; child.dark = true; child.noSplit = true; child.ghost = 0; child.blinkT = 6;
        child.hp = Math.max(1, Math.ceil((child.T.hp || 3) * .5));
        const pool = ['rage', 'armor', 'leech', 'blink'];
        child.xAffixes = [pick(pool)];
        child.xAffix = child.xAffixes[0];
        child.x = Math.max(12, Math.min(708, child.x));
      }
    }
    magicFx.push({ x: z.x, y: z.y - 12, t: 0, T: .55, size: 1.3 });
  }
  function magicUpdate(dt) {
    if (!magic()) return;
    for (const z of zs) {
      if (z.dead || !z.xAffixes || !z.xAffixes.includes('blink') || z.T.boss || z.T.chapterBoss) continue;
      z.blinkT = (z.blinkT == null ? 6 : z.blinkT) - dt;
      if (z.blinkT > 0) continue;
      const ox = z.x, oy = z.y;
      z.x = Math.max(12, Math.min(708, hero.x - hero.f * 30));
      z.y = hero.y;
      z.blinkT = 6;
      magicFx.push({ x: ox, y: oy - 14, t: 0, T: .5, size: 1 }, { x: z.x, y: z.y - 14, t: 0, T: .5, size: 1 });
    }
    for (const link of ghostLinks) link.t += dt;
    for (const link of ghostLinks) {
      if (link.t >= link.T) {
        if (link.target && !link.target.dead) {
          link.target.ghost = Math.min(3, (link.target.ghost || 0) + 1);
          link.target.affixT = 0; link.target.affixHold = 2;
        }
        link.done = true;
      }
    }
    ghostLinks = ghostLinks.filter(link => !link.done);
    for (const q of magicFx) q.t += dt;
    magicFx = magicFx.filter(q => q.t < q.T);
  }
  function update(dt = 0) {
    if (!active || !run || run.status === 'result' || over) return;
    for (const z of zs) if (z.affixT != null) z.affixT += dt;
    magicUpdate(dt);
    if (run.status === 'cards') { if (!ROGUE.blocks()) spawnWave(); return; }
    if (run.status === 'fight' && !zs.some(z => !z.dead)) { run.status = 'rest'; run.nextAt = gameT + 1.5; }
    if (run.status === 'rest' && gameT >= run.nextAt) {
      if (run.wave === 6) finish(true); else offerWave();
    }
  }
  function dropEnemy(z) {
    if (!run || z.gearDropped) return;
    z.gearDropped = true;
    magicDeath(z);
    const source = (z.T.boss || z.T.chapterBoss) ? 'boss' : z.T.elite ? 'elite' : 'grunt';
    const magicFloor = run.floor >= 6;
    const dropChance = source === 'boss' || source === 'elite' ? 1 : (magicFloor ? .05 : .01);
    if (source !== 'boss' && Math.random() >= dropChance) return;
    const roll = Math.random();
    const count = source === 'boss'
      ? (magicFloor ? 2 + Math.floor(Math.random() * 3) : (roll < .5 ? 1 : roll < .8 ? 2 : 3))
      : 1;
    const c = config();
    for (let i = 0; i < count; i++) {
      const type = run.wish && Math.random() < .5 ? run.wish : pick(c.weapons);
      const item = AFFIX_DATA.generate(type, source, source === 'boss' ? c.boss.person : '', undefined, c.drops[source][run.floor - 1]);
      if (magicFloor && Math.random() < .1) {
        if (!item.special) item.special = 'soul';
        else item.special2 = 'soul';
        if (item.q === 4) item.q = 5;
      }
      drops.push({k:'weapon', weapon:type, item, x:Math.max(16,Math.min(704,z.x+(i-(count-1)/2)*18)), y:z.y, z:10, vy:130, t:0, life:Infinity, got:0});
    }
  }
  function summonArchers() {
    // 场地内入场；保留二阶段召兵，不沿用村口的出屏逃离坐标。
    const alive = zs.filter(z => !z.dead), existing = alive.filter(z => ranged(z.type)).length;
    const count = Math.max(0, 2 - existing);
    const support = Math.max(0, (existing + count) * 3 - alive.length - count);
    for (let i = 0; i < support; i++) spawnSide('grunt', i);
    for (let i = 0; i < count; i++) spawnSide('archer', i + support);
  }
  function finish(win) {
    if (!run || run.status === 'result') return;
    if (win) {
      GEAR.collectDrops();
      if (!run.debug) TITLE.markXiaochang(run.chapter, run.floor);
      if (!run.debug && window.MERIDIAN) { if (run.floor === 5) MERIDIAN.award('xc' + run.chapter); if (run.floor === 6) MERIDIAN.award('mo'); }   // 通脉丹
    }
    run.coins = window.WALLET ? WALLET.runCoins() : 0;
    if (window.WALLET) WALLET.flush();
    run.status = 'result'; run.win = win;
    cancelCharge(); if(hero.st==='atk')set(hero,'idle'); hero.atk = null; pressAtk = false; pressRoll = false;
    for (const k in key) delete key[k];
    ROGUE.reset();
    showResult();
  }

  function ensureStyle() {
    if (document.getElementById('xStyle')) return;
    const style = document.createElement('style'); style.id = 'xStyle';
    style.textContent = `#tChapterPick{overflow-y:auto}#xPrep{padding:8px 10px;margin:5px 0;border:1px solid #9d7845;border-radius:6px;background:#3b2c20;color:#e7d1a9;font:14px/1.7 sans-serif;flex:none}#xPrep{flex:1;padding:clamp(14px,2vw,24px)}#xPrep h2{margin:12px 0 5px;color:#f1d58f;font-size:clamp(20px,2.5vw,28px)}#xPrep h3{margin:16px 0 7px;font-size:15px}#xPrep .x-progress{margin:0;color:#cdb78e}#xPrep button{min-height:44px;padding:9px 17px;border:1px solid #9c7843;border-radius:6px;background:linear-gradient(#62482d,#34261b);color:#e9d4aa;font:inherit;cursor:pointer;touch-action:manipulation}#xPrep .x-options{display:flex;flex-wrap:wrap;gap:9px}#xPrep button.selected{border:2px solid #e2b85c;background:#75542e;color:#ffe8af}#xPrep button:active{transform:translateY(1px)}#xStrength{padding:12px;background:#20180fa6;border:1px solid #836239;border-radius:5px;color:#f2ddb0}#xPrep .x-back{min-height:36px;padding:5px 10px;color:#d4bc91;font-size:13px}#xPrep small{display:block}#xPrep .x-chapters{display:flex;gap:7px;flex-wrap:wrap;margin:8px 0}#xPrep .x-chapters button{min-height:35px;padding:5px 12px}#xResult{position:fixed;inset:0;z-index:18;display:flex;align-items:center;justify-content:center;background:#130e0bcc;color:#432b1b;font-family:MaShanZheng,serif}#xResult article{box-sizing:border-box;width:min(650px,92vw);max-height:92dvh;padding:clamp(18px,4vh,40px) clamp(24px,5vw,55px);background:#dfc596 center/100% 100% no-repeat;box-shadow:0 12px 60px #0009;overflow:auto;border-radius:14px}#xResult h2{margin:clamp(22px,5vh,48px) 0 10px;text-align:center;font-size:28px}#xResult ul{max-height:35vh;overflow:auto;padding:10px 22px;background:#35271de8;border:1px solid #805d37;color:#e9d8b7;overflow-wrap:anywhere}#xResult li{margin:5px 0}#xResult article>p{padding:9px 12px;background:#2c201acc;color:#f1dfbc;border-radius:5px;font:14px/1.6 sans-serif}#xResult nav{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}#xResult button{min-height:40px;padding:8px 18px;background:#5a3923 center/100% 100% no-repeat;color:#f5dfb2;border:1px solid #b98e51;border-radius:7px;font:18px MaShanZheng,serif;cursor:pointer}#xResult button:active{transform:translateY(2px)}#xResult button:disabled{opacity:.5;cursor:default}.wzb-xresult #bA,.wzb-xresult #bK,.wzb-xresult #joy{pointer-events:none}@media(max-height:450px){#xPrep{font-size:12px;padding:3px 8px}#xResult article{padding:12px 30px}#xResult h2{font-size:22px}#xResult ul{max-height:27vh;margin:6px 0}}`;
    style.textContent += '#tChapterPanel{min-height:0;overflow:hidden!important;padding-bottom:0!important}.x-preparation #tChapterPanel{min-height:0;overflow:hidden!important}#tPrepScroll{min-height:0;flex:1 1 auto;overflow-y:auto;overscroll-behavior:contain;padding-bottom:82px;box-sizing:border-box}#xPrep{min-height:0;flex:none;overflow:visible;padding-bottom:12px;box-sizing:border-box}@media (orientation:landscape) and (max-height:430px){#tPrepScroll{padding-bottom:64px}}';
    document.head.appendChild(style);
  }
  function renderPreparation(root, selected, chapter=selection.chapter) {
    ensureStyle();
    const c=CONFIG[chapter];
    let box=root.querySelector('#xPrep');
    if(!box){box=document.createElement('section');box.id='xPrep';root.querySelector('#tPrepHeader').after(box);}
    const scroll=root.querySelector('#tPrepScroll');if(scroll)scroll.scrollTop=0;
    box.hidden=!selected||!c;
    if(!selected||!c)return;
    if(selection.chapter!==chapter){selection.chapter=chapter;selection.floor=1;selection.wish='';}
    selection.floor=Math.min(selection.floor,maxFloor(chapter));
    const full=ARMORY.count()>=ARMORY.capacity(),go=root.querySelector('#tPrepGo');
    go.disabled=go.disabled||full||(!debug()&&!TITLE.hasCleared(chapter));
    root.querySelector('#tPrepStatus').textContent=full?'已满50把，请先熔炼或卖出，再出征':'锦囊仅本局有效 · 已拾取装备永久保留';
    const completed=highest(chapter);box.innerHTML=`<button type="button" class="x-back">← 返回整备</button><h2>校场演武</h2><p class="x-progress">已通过第${completed}层</p><div class="x-chapters" role="group" aria-label="校场章节"><span>章节</span>${Object.entries(CONFIG).map(([id,item])=>`<button type="button" data-x-chapter="${id}" class="${Number(id)===chapter?'selected':''}">${item.name}</button>`).join('')}</div><h3>选择层数</h3><div class="x-options" role="group" aria-label="层数">${Array.from({length:maxFloor(chapter)},(_,i)=>`<button type="button" data-x-floor="${i+1}">${i+1===6?'第6层·魔化':'第'+(i+1)+'层'}</button>`).join('')}</div><h3>许愿武器</h3><div class="x-options" role="group" aria-label="许愿"><button type="button" data-x-wish="">不许愿</button>${c.weapons.map(t=>`<button type="button" data-x-wish="${t}">${AFFIX_DATA.names[t]}</button>`).join('')}</div><p id="xStrength"></p><small>许愿：每次掉落50%固定为所选类型，另外50%从本章武器池随机。</small>`;
    box.querySelector('.x-back').onclick=()=>TITLE.openPreparation({chapter,view:'campaign'});
    box.querySelectorAll('[data-x-chapter]').forEach(b=>b.onclick=()=>TITLE.openPreparation({chapter:Number(b.dataset.xChapter),view:'xiaochang'}));
    function update(){
      box.querySelector('.x-progress').textContent=completed?'已通过第'+completed+'层':'尚未通过';
      box.querySelectorAll('[data-x-floor]').forEach(b=>{const on=Number(b.dataset.xFloor)===selection.floor;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});
      box.querySelectorAll('[data-x-wish]').forEach(b=>{const on=b.dataset.xWish===selection.wish;b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));});
      const i=selection.floor-1,quality=i>=3?'传说（5%概率为天工）':['优良','精致','极品'][i];
      box.querySelector('#xStrength').textContent=`敌人血量×${c.hp[i].toFixed(2)} · 伤害×${c.damage[i].toFixed(2)} · 本层最高可掉：${quality}${i===4?' · 传说概率最高':''}`;
    }
    box.querySelectorAll('[data-x-floor]').forEach(b=>b.onclick=()=>{selection.floor=Number(b.dataset.xFloor);update();});
    box.querySelectorAll('[data-x-wish]').forEach(b=>b.onclick=()=>{selection.wish=b.dataset.xWish;update();});
    update();
  }
  function showResult() {
    ensureStyle(); if (panel) panel.remove();
    panel=document.createElement('section');panel.id='xResult';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');
    const article=document.createElement('article');article.style.backgroundImage=`url("${ASSETS.ui.scroll}")`;
    const heading=document.createElement('h2');heading.textContent=`第${run.floor}层 · ${run.win?'通过':'败北'}`;article.appendChild(heading);
    const list=document.createElement('ul'), earned=ARMORY.state().items.filter(i=>!run.initial.has(i.uid));
    for(const item of earned){const li=document.createElement('li');li.style.color=AFFIX_DATA.qualities[item.q].color;li.textContent=AFFIX_DATA.label(item);list.appendChild(li);}
    if(!earned.length){const li=document.createElement('li');li.textContent='本局未拾取武器';list.appendChild(li);}article.appendChild(list);
    const coins=document.createElement('p');coins.textContent=`本局获得金币 ${run.coins || 0}`;article.appendChild(coins);
    const space=document.createElement('p');space.textContent=`仓库格数 ${ARMORY.count()}/50 · ${ARMORY.count()>=50?'已满，请返回整备熔炼或丢弃':'已拾取装备全部保留'}`;article.appendChild(space);
    const nav=document.createElement('nav');
    const button=(text,action,disabled=false)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.disabled=disabled;b.style.backgroundImage=`url("${ASSETS.ui.btn}")`;b.onclick=action;nav.appendChild(b);};
    if(run.win&&run.floor<6&&(run.debug||highest(run.chapter)>=run.floor))button('下一层',()=>start({...selection,floor:run.floor+1}),ARMORY.count()>=50);
    button('再战本层',()=>start({...selection,floor:run.floor}),ARMORY.count()>=50);
    button('返回整备',()=>{const chapter=run.chapter;leave();ROGUE.reset();TITLE.openPreparation({chapter,view:'xiaochang'});});
    article.appendChild(nav);panel.appendChild(article);document.body.appendChild(panel);document.body.classList.add('wzb-xresult');
  }
  function leave() {
    active=false;run=null;magicFx=[];ghostLinks=[];M.top=168;
    if(panel){panel.remove();panel=null;}document.body.classList.remove('wzb-xresult');
  }
  function skipToSix() {
    if (!debug() || !active || run.status==='result') return;
    ROGUE.reset();zs=[];run.wave=5;offerWave();
  }

  function clampActors() {
    if (!active || !run) return;
    for (const actor of [hero, ...zs]) {
      if (actor !== hero) decorate(actor);
      actor.x = Math.max(10, Math.min(710, actor.x));
      actor.y = Math.max(M.top, Math.min(M.bot, actor.y));
      if (actor.spear) {
        const p=actor.spear;
        if(p.x<12||p.x>708){p.x=Math.max(12,Math.min(708,p.x));p.land=1;p.y=actor.y;actor.pickX=p.x;}
      }
      if (actor.pickX != null) actor.pickX=Math.max(12,Math.min(708,actor.pickX));
    }
    cam.x = Math.max(0, Math.min(Math.max(0, M.W - viewW()), cam.x));
    if (over && run.status!=='result' && deathLandedAt!=null && gameT>=deathLandedAt+1.5) finish(false);
  }

  function drawAffix(z) {
    if (!active || !z || z.dead) return;
    if (magic()) {
      const glow = .08 + .045 * (z.ghost || 0), pulse = .7 + .3 * Math.sin(gameT * 5 + (z.slot || 0));
      ctx.save(); ctx.globalAlpha = glow;
      ctx.fillStyle = '#240b38';
      ctx.beginPath(); ctx.ellipse(z.x, z.y - 1, (z.T.boss ? 30 : 17) * pulse, (z.T.boss ? 9 : 5) * pulse, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = .10 + .04 * (z.ghost || 0);
      for (let i = 0; i < 3; i++) {
        const yy = z.y - 6 - ((gameT * 18 + i * 13 + (z.slot || 0) * 7) % 34);
        const xx = z.x + Math.sin(gameT * 2.2 + i * 2 + (z.slot || 0)) * (8 + i * 2);
        ctx.fillStyle = i % 2 ? '#6d3a92' : '#2a103f';
        ctx.beginPath(); ctx.arc(xx, yy, 3 + i, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    const names = affixNames(z);
    if (!names.length) return;
    const t = z.affixT == null ? 0 : z.affixT, hold = z.affixHold == null ? 4 : z.affixHold;
    if (t >= hold + .5) return;
    const y = z.y - (z.T.boss ? 69 : 43);
    const color = z.xAffixes && z.xAffixes.includes('armor') ? '#9b9b94' : '#bd594d';
    ctx.save(); ctx.globalAlpha = .20 + .06 * Math.sin(gameT * 4); ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(z.x, z.y - 18, z.T.boss ? 27 : 16, z.T.boss ? 36 : 25, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = t > hold ? Math.max(0, 1 - (t - hold) / .5) : 1;
    ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 2.5; ctx.strokeStyle = '#38291f';
    ctx.fillStyle = z.xAffixes && z.xAffixes.includes('rage') ? '#f3a18d' : '#dad6ca';
    const text = names.join(' · ');
    ctx.strokeText(text, z.x, y); ctx.fillText(text, z.x, y); ctx.restore();
  }
  function drawMagicFx() {
    if (!active || !magic()) return;
    ctx.save();
    for (const q of magicFx) {
      const k = Math.min(1, q.t / q.T), a = (1 - k) * .6;
      ctx.globalAlpha = a; ctx.fillStyle = '#1b0729';
      for (let i = 0; i < 4; i++) {
        const ang = i * 1.57 + q.t * 2, r = (8 + k * 18) * q.size;
        ctx.beginPath(); ctx.arc(q.x + Math.cos(ang) * r, q.y - k * 28 + Math.sin(ang) * r * .35, 5 + k * 7, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (const link of ghostLinks) {
      const k = Math.min(1, link.t / link.T), x = link.x0 + (link.target.x - link.x0) * k, y = link.y0 + (link.target.y - 18 - link.y0) * k;
      ctx.globalAlpha = .7 * (1 - k * .2); ctx.fillStyle = '#2a0b3f';
      ctx.beginPath(); ctx.arc(x, y, 4 + Math.sin(k * Math.PI) * 4, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = .35; ctx.fillStyle = '#9a5dc4';
      ctx.beginPath(); ctx.arc(x + 2, y - 2, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawBackground() {
    const im = IMG.xiaochang;
    if (!im || !im.complete || !im.naturalWidth) {
      // 地图还没下载完：先铺一层夯土色，避免画面残影；同时确保开始下载
      ctx.fillStyle = '#6e5636'; ctx.fillRect(-200, 0, 1120, 300);
      ctx.fillStyle = '#b8955c'; ctx.fillRect(-200, 166, 1120, 134);
      if (window.ensureAssets) ensureAssets('xiaochang', { silent: true });
      return;
    }
    const scale = Math.max(720 / im.width, 134 / ((1 - FENCE_RATIO) * im.height));
    const w = im.width * scale, h = im.height * scale;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(im, (720 - w) / 2, 166 - h * FENCE_RATIO, w, h);
    ctx.imageSmoothingEnabled = false;
    if (magic()) { ctx.fillStyle = 'rgba(40,10,60,.25)'; ctx.fillRect(0, 0, 720, 300); }
  }

  return { CONFIG, active: () => active, state: () => run, tokenCap: () => active && run ? (run.floor >= 4 ? 3 : 2) : M.token, blocks: () => active && run?.status === 'result', leave, start, update, decorate, dropEnemy, summonArchers, affixText,
    renderPreparation, drawAffix, drawMagicFx, skipToSix, clampActors, drawBackground, refillXiaochangProps,
    cardAllowed: card => { if(!active)return true;const long=!!ARMORY.equipped('long'),short=!!ARMORY.equipped('short'),ranged=!!ARMORY.equipped('ranged');return card.school==='长武器'?long:card.school==='短武器'?short:card.school==='远程'?ranged:card.school==='近战'?(long||short):true; },
    enemyDamage: (z,n) => active && run ? n/config().hp[run.floor-1]*(z.xAffixes && z.xAffixes.includes('armor') ? .75 : 1) : n,
    heroDamage: (n,z) => active && run ? n*config().damage[run.floor-1]*(1+.1*(z?.ghost||0)) : n,
    onHitHero: z => { if (!magic() || !z || z.dead || !z.xAffixes || !z.xAffixes.includes('leech')) return; z.hp = Math.min(z.T.hp, z.hp + z.T.hp * .05); },
    actionScale: z => active && z.xAffixes && z.xAffixes.includes('rage') ? 1.2 : 1,
    moveScale: z => active ? (z.xAffixes && z.xAffixes.includes('rage') && !z.T.boss ? 1.2 : 1) * (1 + .1 * (z.ghost || 0)) : 1,
  };
})();
function refillXiaochangProps() { XIAOCHANG.refillXiaochangProps(); }
