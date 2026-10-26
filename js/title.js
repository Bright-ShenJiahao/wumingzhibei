// 开始界面（登录页）：标题 / 电视演示 / 名字输入 / 开始按钮 / 操作说明 / 穿越转场。
// 只在 game.js 里挂 3 处：update 开头挡推进、draw 开头接管整屏、HUD 取名字。
// 换正式背景图时只改下面 TV 和 drawBg() 里的图片即可。
(() => {
  // 电视屏幕区域：按首页原图（art/title/home.png）里的绿幕实测出来的比例
  const TV = { x: .5684, y: .1958, w: .3320, h: .3601 };   // 绿幕外接矩形（tools/make_tv_mask.py 输出）
  const NAME_KEY = 'wzb-name';
  const HARD_KEY = 'wzb-hard-mode';   // 困难模式（默认关 = 简单：玩家受伤减半，击倒判定按减半前伤害）
  const CAMPAIGN_KEY = 'wzb-campaign-clear-v1'; // 与英雄榜积分完全分离的本机章节进度
  const ARMORY_KEY = 'wzb-armory-v1';
  const DEBUG = /[?&]debug(?:=|&|$)/.test(location.search);
  const ITEMS = Object.freeze({
    staff: Object.freeze({ name: '棍子', slot: 'long', icon: 'w_staff' }),
    halberd: Object.freeze({ name: '长戟', slot: 'long', icon: 'w_halberd' }),
    hammer: Object.freeze({ name: '锤子', slot: 'short', icon: 'w_hammer' }),
    blade: Object.freeze({ name: '大刀', slot: 'short', icon: 'w_blade' }),
    stone: Object.freeze({ name: '石子', slot: 'ranged', icon: 'w_stone' }),
    bow: Object.freeze({ name: '汉弓', slot: 'ranged', icon: 'w_bow' }),
  });
  const EQUIPMENT_SLOTS = Object.freeze([
    Object.freeze({ id: 'long', name: '长武器', combat: true }),
    Object.freeze({ id: 'short', name: '短武器', combat: true }),
    Object.freeze({ id: 'ranged', name: '远程', combat: true }),
    Object.freeze({ id: 'talisman', name: '法器', combat: true }),
    Object.freeze({ id: 'artifact', name: '神器', combat: false }),
    Object.freeze({ id: 'fashion', name: '时装', combat: false }),
  ]);
  const S = { mode: 'title', intro: 0, flash: 1, name: '', msg: '', msgT: 0, shake: 0, t: 0, chapterReturn: false };
  const L = {};                 // 布局（CSS 像素）
  let tvMask = null, maskCv = null, layerCv = null, layerX = null, bgHome = null, bgFar = null, bgMid = null, bgGnd = null, demoCv = null, dctx = null, dom = {}, built = false, helpOpen = false;
  let hardMode = false;
  let selectedChapter = 1, prepView = 'campaign', pointerDrag = null, suppressItemClick = false;
  let previewAnimation = null, previewRaf = 0, previewWeapon = 'staff';
  const debugLoadouts = Object.create(null); // 开发者试用装备不写入正式仓库。

  // ---------- 名字（localStorage，读写都兜住异常） ----------
  function readName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } }
  function writeName(n) { try { localStorage.setItem(NAME_KEY, n); } catch (e) {} }
  function readCampaign() { try { const v = JSON.parse(localStorage.getItem(CAMPAIGN_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
  function playerKey(n) { return String(n || '').trim().slice(0, 8); }
  function hasCleared(n, chapter = 1) { const k = playerKey(n); return !!(k && readCampaign()[k] && readCampaign()[k][chapter]); }
  function markCleared(n, chapter = 1) {
    const k = playerKey(n); if (!k) return false;
    const progress = readCampaign(); progress[k] = Object.assign({}, progress[k], { [chapter]: true });
    try { localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(progress)); } catch (e) { return false; }
    if (chapter === 1) {
      const p = playerLoadout(n);
      if (!p.owned.includes('halberd')) p.owned.push('halberd');
      saveLoadout(n, p);
    }
    if (window.CLOUD_SAVE) CLOUD_SAVE.queue(n);
    return true;
  }
  function defaultLoadout() {
    return { owned: ['staff', 'hammer', 'stone'], long: 'staff', equipped: { long: 'staff', short: 'hammer', ranged: 'stone', talisman: null, artifact: null, fashion: null } };
  }
  function readLoadouts() { try { const v = JSON.parse(localStorage.getItem(ARMORY_KEY) || '{}'); return Object.assign(v && typeof v === 'object' ? v : {}, DEBUG ? debugLoadouts : {}); } catch (e) { return DEBUG ? Object.assign({}, debugLoadouts) : {}; } }
  function saveLoadout(n, p) {
    const k = playerKey(n) || (DEBUG ? '__debug__' : ''); if (!k) return false;
    if (DEBUG) { debugLoadouts[k] = JSON.parse(JSON.stringify(p)); return true; }
    const all = readLoadouts();
    if (!all[k] && (Array.isArray(all.owned) || Object.prototype.hasOwnProperty.call(all, 'long'))) {
      delete all.owned; delete all.long; delete all.equipped;
    }
    all[k] = p;
    try { localStorage.setItem(ARMORY_KEY, JSON.stringify(all)); return true; } catch (e) { return false; }
  }
  function playerLoadout(n = S.name) {
    const k = playerKey(n) || (DEBUG ? '__debug__' : ''), all = readLoadouts();
    const legacy = k && !all[k] && (Array.isArray(all.owned) || Object.prototype.hasOwnProperty.call(all, 'long')) ? all : null;
    const raw = k ? (all[k] || legacy) : null;
    const p = raw && typeof raw === 'object' ? raw : defaultLoadout();
    const oldOwned = raw && Array.isArray(raw.owned) ? JSON.stringify(raw.owned) : '';
    p.owned = Array.isArray(p.owned) ? p.owned.filter(id => ITEMS[id]) : defaultLoadout().owned;
    for (const id of defaultLoadout().owned) if (!p.owned.includes(id)) p.owned.push(id);
    if (hasCleared(n, 1) && !p.owned.includes('halberd')) p.owned.push('halberd');
    if (DEBUG) for (const id of ['staff', 'halberd', 'hammer', 'blade', 'stone', 'bow']) if (!p.owned.includes(id)) p.owned.push(id);
    const oldLong = p.long;
    const hadEquipped = !!(raw && raw.equipped);
    const oldEquipped = raw && raw.equipped ? JSON.stringify(raw.equipped) : '';
    const saved = p.equipped && typeof p.equipped === 'object' ? p.equipped : {};
    const restored = (slot, fallback) => Object.prototype.hasOwnProperty.call(saved, slot) ? saved[slot] : fallback;
    p.equipped = {
      long: restored('long', oldLong || 'staff'), short: restored('short', 'hammer'), ranged: restored('ranged', 'stone'),
      talisman: restored('talisman', null), artifact: restored('artifact', null), fashion: restored('fashion', null),
    };
    for (const slot of EQUIPMENT_SLOTS) {
      const id = p.equipped[slot.id];
      if (!ITEMS[id] || ITEMS[id].slot !== slot.id || !p.owned.includes(id)) p.equipped[slot.id] = null;
    }
    if (!k) return p;
    const changed = !raw || !hadEquipped || oldLong !== p.equipped.long || oldEquipped !== JSON.stringify(p.equipped) || oldOwned !== JSON.stringify(p.owned);
    p.long = p.equipped.long || null;
    if (changed) saveLoadout(n, p);
    return p;
  }
  function readHard() { try { return localStorage.getItem(HARD_KEY) === '1'; } catch (e) { return false; } }
  function setNoviceClass() { document.body.classList.toggle('wzb-pro', !hardMode); }
  function writeNovice(v) { hardMode = !!v; setNoviceClass(); try { localStorage.setItem(HARD_KEY, hardMode ? '1' : '0'); } catch (e) {} }
  S.name = readName();
  hardMode = readHard();

  // ---------- 演示用的迷你世界（离屏 canvas） ----------
  const D = { camX: 0, t: 0, hero: null, foes: [], props: [], loop: 0, over: 0 };
  const VIEWH = 300, PX = .4;
  const ATK = [[.16, .2], [.12, .2], [.18, .26]];   // 三段前摇/后摇（和棍子一致）
  const AF = [['staff_1a', 'staff_1b'], ['staff_2a', 'staff_2b'], ['staff_3a', 'staff_3b']];
  const DUR = ATK.reduce((a, c) => a + c[0] + c[1], 0);
  function gap(i) { return ATK[i][0] + ATK[i][1]; }

  function demoReset() {
    D.t = 0; D.camX = 40; D.loop++;
    D.hero = { x: 60, y: 232, f: 1, st: 'walk', t: 0, c: 0, fi: 0, atk: false, killed: 0 };
    D.foes = [
      { x: 190, y: 226, hp: 2, f: -1, dead: 0, vx: 0, st: 'idle', t: 0, flash: 0, kind: 'grunt' },
      { x: 330, y: 244, hp: 2, f: -1, dead: 0, vx: 0, st: 'idle', t: 0, flash: 0, kind: 'blade' },
      { x: 470, y: 220, hp: 2, f: -1, dead: 0, vx: 0, st: 'idle', t: 0, flash: 0, kind: 'grunt' },
    ];
    D.props = [{ x: 270, y: 250, g: 'hay' }, { x: 560, y: 236, g: 'flag' }];
  }

  function demoStep(dt) {
    D.t += dt;
    const h = D.hero, SC = demoCv.height / VIEWH;
    // 主角：走向最近的活着的敌人 → 贴身打一套
    const foe = D.foes.find(f => !f.dead);
    if (!foe) {
      if (h.st !== 'walk') { h.st = 'walk'; h.t = 0; }
      h.f = 1; h.x += 70 * dt;
      if (h.x > 700) { if (!D.over) D.over = D.t; if (D.t - D.over > 1.2) { D.over = 0; demoReset(); } }
    } else if (h.atk) {
      h.t += dt;
      const [a, b] = ATK[h.c];
      if (h.fi === 0 && h.t >= a) {
        h.fi = 1;   // 出手
        const dx = (foe.x - h.x) * h.f;
        if (dx > -6 && dx < 40 && Math.abs(foe.y - h.y) < 14) {
          foe.hp--; foe.flash = .12; foe.vx = h.f * 90;
          if (foe.hp <= 0) { foe.dead = 1; foe.vy = 120; foe.z = 1; foe.t = 0; h.killed++; }
        }
        if (h.c === 2) {   // 第三段扫到旁边的人
          for (const o of D.foes) if (!o.dead && o !== foe && Math.abs(o.x - h.x) < 45) { o.hp--; o.flash = .12; o.vx = h.f * 80; if (o.hp <= 0) { o.dead = 1; o.vy = 120; o.z = 1; o.t = 0; h.killed++; } }
        }
      }
      if (h.t >= a + b) {
        h.t = 0; h.fi = 0; h.c++;
        if (h.c > 2) { h.c = 0; h.atk = false; h.st = 'idle'; }
      }
    } else {
      const dx = foe.x - h.x;
      h.f = Math.sign(dx) || h.f;
      if (Math.abs(dx) > 34) { h.st = 'walk'; h.x += Math.sign(dx) * 76 * dt; }
      else { h.st = 'atk'; h.atk = true; h.c = 0; h.fi = 0; h.t = 0; }
    }
    // 敌人：被击退 → 落地
    for (const f of D.foes) {
      f.flash = Math.max(0, f.flash - dt);
      if (f.vx) { f.x += f.vx * dt; f.vx *= .82; if (Math.abs(f.vx) < 3) f.vx = 0; }
      if (f.dead) { f.t += dt; if (f.z) { f.vy -= 420 * dt; f.z += f.vy * dt; if (f.z <= 0) { f.z = 0; f.vy = 0; } } }
    }
    // 镜头：跟着主角，但限制在演示世界里
    const vw = demoCv.width / SC;
    const want = h.x - vw * .42;
    D.camX += (Math.max(0, Math.min(640 - vw, want)) - D.camX) * Math.min(1, dt * 4);
  }

  function dChar(c, name, f, x, y, flip, alpha, white) {
    const fr = CH[name] && CH[name][f]; if (!fr || !fr.img.complete) return;
    const SC = demoCv.height / VIEWH, sp = Math.max(.5, SC * PX);
    const sx = Math.round(x * SC), sy = Math.round(y * SC);
    c.save(); c.setTransform(1, 0, 0, 1, sx, sy); if (flip) c.scale(-1, 1);
    c.globalAlpha = alpha == null ? 1 : alpha;
    c.imageSmoothingEnabled = false;
    c.drawImage(white && fr.white ? fr.white : fr.img, -fr.ax * sp, -fr.ay * sp, fr.w * sp, fr.h * sp);
    c.restore();
  }

  function demoRender() {
    const c = dctx, W = demoCv.width, H = demoCv.height, SC = H / VIEWH;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#160f1a'; c.fillRect(0, 0, W, H);
    // 背景（视差）—— 和游戏里同样的贴图方式
    const layer = (img, s, par, y) => {
      if (!img || !img.complete || !img.width) return;
      const tw = img.width * s, vw = W / SC, ox = D.camX * (1 - par);
      for (let i = Math.floor((D.camX - ox) / tw) - 1; i * tw + ox < D.camX + vw; i++) {
        const x = i * tw + ox;
        c.save(); c.translate((x - D.camX) * SC, y * SC); c.scale(SC, SC);
        c.drawImage(img, 0, 0, tw + .5, img.height * s);
        c.restore();
      }
    };
    const ms = .24 / .61, my = 165 - 619 * .24;
    layer(bgFar, .577, .3, 0);
    layer(bgGnd, .62, 1, my + 560 * ms);
    layer(bgMid, ms, 1, my);
    // 地面上的东西按 y 排序
    const list = [];
    for (const p of D.props) list.push({ y: p.y, d: () => {
      const pr = ASSETS.props[p.g]; if (!pr) return;
      const [, w, h] = pr; const im = IMG['p_' + p.g];
      if (!im || !im.complete) return;
      c.save(); c.translate((p.x - D.camX) * SC, p.y * SC); c.scale(SC, SC); c.drawImage(im, -w / 2, -h + 2, w, h); c.restore();
    } });
    for (const f of D.foes) list.push({ y: f.y, d: () => {
      const fr = f.dead ? 'down' : (f.flash > 0 ? 'hurt' : (f.vx ? 'hurt' : 'walk1'));
      const x = f.x - D.camX, a = f.dead ? Math.max(0, 1 - Math.max(0, f.t - .5)) : 1;
      dChar(c, f.kind, fr, x, f.y - (f.z || 0), f.f > 0, a, f.flash > 0);
    } });
    const h = D.hero;
    list.push({ y: h.y, d: () => {
      const fr = h.atk ? AF[h.c][h.fi] : (h.st === 'walk' ? 'staffw' + (Math.floor(h.t * 8) % 4 + 1) : 'staff0');
      const nm = h.st === 'walk' ? 'staffw' + ([1, 2, 3, 2][Math.floor(h.t * 8) % 4]) : fr;
      dChar(c, 'hero', h.st === 'walk' ? nm : fr, h.x - D.camX, h.y, h.f < 0, 1, false);
    } });
    c.setTransform(1, 0, 0, 1, 0, 0);
    list.sort((a, b) => a.y - b.y).forEach(o => o.d());
  }

  // ---------- 界面骨架 ----------
  function build() {
    if (built) return;
    built = true;
    const st = document.createElement('style');
    st.textContent = `
      body.wzb-title #top, body.wzb-title #help, body.wzb-title #joy,
      body.wzb-title #bA, body.wzb-title #bR { display: none !important; }
      body.wzb-title #wp button[data-w], body.wzb-title #bWeapon { display: none !important; }
      body.wzb-intro #wp, body.wzb-intro #bMute, body.wzb-intro #bWeapon { display: none !important; }
      #tStyle0 { display: none; }
      #tName, #tStart, #tHelp, #tNovice, #tBoard, #tHintOff {
        position: fixed; z-index: 7; font-family: "PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif;
        box-sizing: border-box; -webkit-tap-highlight-color: transparent;
      }
      #tName {
        background: rgba(18,12,26,.62); border: 1.5px solid #c9971f; border-radius: 9px;
        color: #f7e7c2; font-size: 16px; font-weight: 700; text-align: center; outline: none;
        letter-spacing: .06em; transition: box-shadow .15s, border-color .15s;
        box-shadow: 0 0 0 1px rgba(0,0,0,.4), inset 0 0 12px rgba(0,0,0,.5);
      }
      #tName::placeholder { color: rgba(247,231,194,.42); font-weight: 600; }
      #tName:focus { border-color: #ffd86e; box-shadow: 0 0 12px rgba(255,216,110,.35); }
      #tName.shake { animation: tshake .32s; }
      @keyframes tshake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-7px)} 40%{transform:translateX(7px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(4px)} }
      #tStart {
        background: linear-gradient(180deg,#f7dd8a 0%,#e8bc46 42%,#c9931a 100%);
        border: 2px solid #8a5f12; border-radius: 12px; color: #2b1a06; font-weight: 900;
        letter-spacing: .22em; text-shadow: 0 1px 0 rgba(255,255,255,.45);
        box-shadow: 0 4px 0 #8a5f12, 0 8px 18px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.7);
        cursor: pointer; transition: transform .06s, box-shadow .06s;
      }
      #tStart:active { transform: translateY(4px); box-shadow: 0 0 0 #8a5f12, 0 3px 8px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.5); }
      #tNovice {
        display:flex; align-items:center; justify-content:flex-start; gap:7px; color:#f7e7c2;
        font-size:14px; font-weight:700; text-shadow:0 1px 3px #000; cursor:pointer;
      }
      #tNovice input { width:18px; height:18px; accent-color:#ffd86e; }
      #tHintOff {
        display:flex; align-items:center; justify-content:flex-start; gap:6px; color:#c9b691;
        font-size:12.5px; font-weight:600; text-shadow:0 1px 3px #000; cursor:pointer;
      }
      #tHintOff input { width:15px; height:15px; accent-color:#c9971f; }
      #tHelp {
        background: rgba(20,14,30,.55); border: 1.5px solid rgba(255,255,255,.5); border-radius: 8px;
        color: #fff; font-size: 15px; font-weight: 700; text-shadow: 0 1px 2px #000; cursor: pointer;
      }
      #tHelp:active { background: rgba(255,255,255,.25); }
      #tBoard {
        background: rgba(20,14,30,.62); border: 1.5px solid #c9971f; border-radius: 9px;
        color: #ffd86e; font-size: 14px; font-weight: 800; letter-spacing: .08em;
        text-shadow: 0 1px 3px #000; cursor: pointer; padding: 6px 14px;
      }
      #tBoard:active { background: rgba(255,216,110,.22); }
      #tModeTip {
        position: fixed; z-index: 8; transform: translate(-50%, 0); pointer-events: none;
        background: rgba(18,12,26,.94); border: 1.5px solid #c9971f; border-radius: 8px;
        color: #f2e6c9; font: 700 13px/1.5 "PingFang SC",sans-serif; padding: 5px 10px;
        opacity: 0; transition: opacity .18s; white-space: nowrap;
      }
      #tTip {
        position: fixed; z-index: 8; color: #ff8f7a; font: 700 14px/1.4 "PingFang SC",sans-serif;
        text-shadow: 0 1px 3px #000; transform: translate(-50%,0); pointer-events: none; opacity: 0;
        transition: opacity .2s;
      }
      #tHelpPanel {
        position: fixed; z-index: 9; left: 50%; top: 50%; transform: translate(-50%,-50%);
        background: rgba(18,12,26,.94); border: 2px solid #c9971f; border-radius: 14px; padding: 18px 22px;
        color: #f2e6c9; font: 600 14px/1.9 "PingFang SC","Noto Sans CJK SC",sans-serif;
        box-shadow: 0 12px 40px rgba(0,0,0,.6); display: none; max-width: 86vw; text-align: left;
      }
      #tHelpPanel b { color: #ffd86e; }
      #tHelpPanel h3 { margin: 0 0 8px; font-size: 16px; color: #ffd86e; text-align: center; }
      #tFlash {
        position: fixed; inset: 0; z-index: 10; background: #fff; opacity: 1; pointer-events: none;
        transition: opacity .3s ease-out;
      }
      #tChapter {
        position:fixed; inset:0; z-index:9; display:none; box-sizing:border-box; padding:20px;
        align-items:center; justify-content:center; overflow:auto;
        background:rgba(8,6,5,.5); -webkit-backdrop-filter:blur(2px); backdrop-filter:blur(2px);
        color:#ead9b8; font-family:"PingFang SC","Microsoft YaHei",sans-serif;
      }
      #tChapter.open { display:flex; }
      #tChapter [hidden] { display:none !important; }
      #tChapterShell { display:grid; grid-template-columns:minmax(0,35%) minmax(0,65%); width:min(62vw,1180px); min-width:min(860px,96vw); height:78vh; grid-template-rows:minmax(0,1fr); max-height:78vh; min-height:min(560px,78vh); box-sizing:border-box; overflow:hidden; border:2px solid #98713e; border-radius:12px; background:repeating-linear-gradient(3deg,rgba(222,185,124,.025) 0 2px,transparent 2px 12px),linear-gradient(135deg,#453123,#241d18 65%,#33261b); box-shadow:0 18px 48px #0009,inset 0 0 0 1px rgba(227,194,132,.16); }
      #tChapterPick,#tChapterPanel { min-width:0; min-height:0; box-sizing:border-box; padding:clamp(12px,1.6vw,22px); }
      #tChapterPick { display:flex; flex-direction:column; border-right:2px solid #8b693c; background:linear-gradient(90deg,rgba(26,20,16,.3),rgba(15,12,10,.12)); }
      #tChapterPanel { display:flex; flex-direction:column; gap:clamp(7px,1.2vh,13px); overflow:hidden; }
      #tPrepScroll { min-height:0; flex:1 1 auto; display:flex; flex-direction:column; gap:clamp(7px,1.2vh,13px); overflow-y:auto; overscroll-behavior:contain; padding-bottom:82px; box-sizing:border-box; }
      #tChapter h2 { margin:0; color:#f0d58f; font:700 clamp(19px,2.4vw,29px)/1.2 "PingFang SC","Microsoft YaHei",sans-serif; letter-spacing:.08em; }
      #tChapter p { margin:3px 0 0; color:#c4b18e; font-size:clamp(11px,1.2vw,14px); }
      #tChapterNotice { margin:8px 0 0 !important; color:#d7b579 !important; font-size:clamp(10px,1.05vw,12px) !important; line-height:1.5; text-align:left; }
      .tChapterCard { width:100%; min-height:clamp(91px,17vh,150px); margin-top:clamp(8px,1.5vh,15px); padding:clamp(11px,1.5vw,18px); box-sizing:border-box; border:1px solid #9d7845; border-radius:9px; color:#e9d8b7; text-align:left; background:repeating-linear-gradient(4deg,rgba(225,187,121,.035) 0 2px,transparent 2px 12px),linear-gradient(145deg,#62462c,#382a20); cursor:pointer; touch-action:manipulation; }
      .tChapterCard strong { display:block; color:#f4d88e; font-size:clamp(15px,1.7vw,20px); }
      .tChapterCard small { display:block; margin-top:8px; color:#c8b590; font-size:clamp(10px,1.1vw,13px); }
      .tChapterCard.selected { border:2px solid #e0b86c; box-shadow:inset 0 0 0 1px #76572f,0 0 14px rgba(223,177,93,.22); }
      .tChapterCard:disabled { filter:grayscale(.8); opacity:.56; cursor:default; }
      #tChapterPickBack { margin-top:auto; width:100%; padding:10px; }
      .tChapterButton { border:1px solid #b18a4b; border-radius:8px; color:#f0dfbd; background:linear-gradient(#715233,#3b2b20); font-weight:700; cursor:pointer; touch-action:manipulation; }
      .tChapterButton:active:not(:disabled) { filter:brightness(1.25); transform:translateY(1px); }
      .tChapterButton:disabled { opacity:.45; color:#a89c88; cursor:default; }
      #tPrepHeader { display:flex; align-items:center; justify-content:space-between; gap:8px; flex:none; }
      #tPrepHeader p { margin:0; }
      #tPrepTarget { text-align:right; white-space:nowrap; }
      #tPrepMain { min-height:0; flex:none; display:grid; grid-template-columns:160px minmax(0,1fr); gap:clamp(8px,1.2vw,16px); }
      #tPrepPreview { width:160px; height:180px; position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; overflow:hidden; box-sizing:border-box; border:1px solid #a78049; border-radius:8px; background:radial-gradient(ellipse at 50% 68%,rgba(161,112,48,.23),transparent 70%),linear-gradient(145deg,#38291e,#201a15); color:#cbb894; cursor:pointer; touch-action:manipulation; }
      #tPrepPreview canvas { position:static; inset:auto; width:100%; height:calc(100% - 20px); image-rendering:pixelated; }
      #tPrepPreview small { font-size:10px; }
      #tPrepSlots { min-width:0; min-height:0; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); grid-template-rows:repeat(3,minmax(0,1fr)); gap:clamp(5px,.8vw,10px); }
      .tPrepSlot { min-width:0; min-height:0; box-sizing:border-box; overflow:hidden; display:grid; grid-template-columns:52px minmax(0,1fr); grid-template-rows:auto minmax(0,1fr); gap:2px 6px; align-items:center; padding:clamp(5px,.8vw,9px); border:1px solid #a78049; border-radius:8px; background:repeating-linear-gradient(2deg,rgba(231,196,135,.025) 0 2px,transparent 2px 10px),linear-gradient(145deg,#513a28,#30251d); cursor:pointer; touch-action:none; }
      .tPrepSlot > b { grid-column:1/-1; min-width:0; padding:0 1px 1px; box-sizing:border-box; color:#eccd87; font-size:clamp(11px,1.2vw,15px); line-height:1.15; }
      .tPrepIcon { box-sizing:border-box; width:52px; height:100%; max-height:34px; display:flex; align-items:center; justify-content:center; overflow:hidden; border:1px solid rgba(174,132,71,.68); border-radius:5px; background:#201a15; }
      .tPrepIcon img,.tBagIcon img { display:block; width:auto; height:auto; max-width:92%; max-height:88%; object-fit:contain; image-rendering:pixelated; }
      .tPrepIcon img.icon-halberd,.tBagIcon img.icon-halberd { width:44px; height:auto; max-width:100%; max-height:100%; transform:none; }
      .tPrepIcon img.icon-w_staff,.tBagIcon img.icon-w_staff { width:38px; height:auto; max-width:100%; max-height:100%; }
      .tPrepIcon img.icon-w_hammer,.tBagIcon img.icon-w_hammer { width:24px; height:24px; max-width:100%; max-height:100%; }
      .tPrepIcon img.icon-w_blade,.tBagIcon img.icon-w_blade { width:32px; height:32px; max-width:92%; max-height:92%; }
      .tPrepIcon img.icon-w_stone,.tBagIcon img.icon-w_stone { width:18px; height:18px; max-width:100%; max-height:100%; }
      .tPrepIcon img.icon-w_bow,.tBagIcon img.icon-w_bow { width:30px; height:30px; max-width:90%; max-height:90%; }
      .tPrepIcon img.icon-w_halberd,.tBagIcon img.icon-w_halberd { width:44px; height:33px; max-width:92%; max-height:92%; }
      .tPrepName { min-width:0; max-width:100%; overflow:hidden; color:#eee0c5; font-size:clamp(11px,1.2vw,15px); line-height:1.15; text-overflow:ellipsis; white-space:nowrap; }
      .tPrepName small { display:block; max-width:100%; margin-top:2px; overflow:hidden; color:#c3ae88; font-size:10px; text-overflow:ellipsis; white-space:nowrap; }
      .tPrepSlot.drop-ok { border-color:#f0ce7d; box-shadow:inset 0 0 0 2px rgba(229,186,101,.35),0 0 12px rgba(229,186,101,.28); }
      .tPrepSlot.drag-incompatible { border-color:#a78049; }
      #tPrepBagTitle { display:flex; align-items:center; justify-content:space-between; color:#e7d5af; font-size:clamp(12px,1.4vw,16px); font-weight:700; }
      #tPrepBag { display:grid; grid-template-columns:repeat(6,minmax(0,1fr)); grid-template-rows:none; grid-auto-rows:minmax(110px,auto); gap:clamp(4px,.7vw,8px); height:auto; flex:none; }
      .tBagItem,.tBagEmpty { min-width:0; position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; overflow:hidden; border:1px solid #9f7945; border-radius:6px; background:#292119; color:#e8d7b3; touch-action:none; }
      .tBagItem { cursor:grab; }
      .tBagItem:active { cursor:grabbing; }
      .tBagIcon { width:100%; height:62%; display:flex; align-items:center; justify-content:center; overflow:hidden; }
      .tBagItem span { max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:clamp(9px,1vw,12px); }
      .tBagEmpty { border-style:dashed; border-color:#66533a; color:#81745d; font-size:12px; }
      #tPrepFooter { display:flex; align-items:center; justify-content:space-between; gap:8px; min-height:82px; padding:10px 0; box-sizing:border-box; flex:none; }
      #tPrepStatus { min-width:0; color:#cbb894; font-size:clamp(10px,1.1vw,13px); }
      #tPrepGo { min-width:clamp(110px,16vw,180px); padding:9px 18px; font-size:clamp(15px,1.7vw,20px); }
      #tPrepFooter{position:relative;background:#2c2119f5;z-index:2;box-shadow:0 -5px 12px #2b20194d}#tPrepActions{display:flex;gap:8px;width:min(70%,520px);flex:none}#tPrepActions>button{flex:1;min-width:0;min-height:62px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px 10px;font-size:clamp(15px,1.7vw,20px)}
      #tPrepTraining small{font-size:clamp(9px,1vw,12px);line-height:1.4;margin-top:3px}#tPrepTraining[hidden],#xPrep[hidden]{display:none!important}
      #tPrepActions:has(#tPrepTraining[hidden]){width:clamp(110px,16vw,180px)}.x-preparation #tPrepActions{width:min(65%,340px)}
      .x-preparation #tPrepHeader,.x-preparation #tPrepMain,.x-preparation #tPrepBagTitle,.x-preparation #tPrepBag,.x-preparation #aTools{display:none!important}
      #tPrepTarget{white-space:normal}#tPrepStatus{flex:1;min-width:0}
      #tPrepGo:not(:disabled) { border-color:#d3a95f; color:#ffe8b0; }
      #tPrepGhost { position:fixed; z-index:30; pointer-events:none; width:90px; height:70px; display:flex; flex-direction:column; align-items:center; justify-content:center; border:2px solid #f0cf81; border-radius:8px; background:rgba(42,31,22,.94); color:#f4e2bb; box-shadow:0 8px 24px #0009; transform:translate(-50%,-50%); }
      #tPrepGhost img { width:48px; height:42px; object-fit:contain; image-rendering:pixelated; }
      @media (orientation:landscape) and (max-height:430px) {
        #tChapter { padding:2px; }
        #tChapterShell { width:96vw; min-width:0; min-height:0; height:96dvh; max-height:96dvh; grid-template-columns:minmax(0,27%) minmax(0,73%); }
        #tChapterPick,#tChapterPanel { padding:clamp(4px,1vw,8px); }
        #tChapterPick h2,#tChapterPanel h2 { font-size:clamp(15px,2.3vh,19px); }
        #tChapterPick .tChapterCard { min-height:clamp(46px,12vh,58px); margin-top:4px; padding:6px; }
        #tChapterPick .tChapterCard small { margin-top:3px; }
        #tChapterPickBack { padding:6px; }
        #tChapterPanel,#tPrepScroll { gap:4px; }
        #tPrepScroll { padding-bottom:64px; }
        #tPrepHeader h2 { font-size:clamp(16px,2.5vh,20px); }
        #tPrepMain { min-height:0; flex:none; grid-template-columns:clamp(78px,14vw,102px) minmax(0,1fr); gap:5px; }
        #tPrepPreview { width:clamp(78px,14vw,102px); height:clamp(88px,27vh,112px); min-height:0; }
        #tPrepSlots { grid-template-columns:repeat(3,minmax(0,1fr)); grid-template-rows:repeat(2,minmax(0,1fr)); gap:3px; }
        .tPrepSlot { grid-template-columns:36px minmax(0,1fr); gap:2px 3px; padding:3px; }
        .tPrepSlot > b { font-size:clamp(9px,1.5vh,11px); }
        .tPrepIcon { width:36px; }
        .tPrepName { font-size:10px; }
        .tPrepName small { font-size:8px; }
        #tPrepBagTitle { font-size:12px; }
        #tPrepBagTitle small { font-size:9px; }
        #tPrepBag { grid-template-columns:repeat(3,minmax(0,1fr)); grid-template-rows:none; grid-auto-rows:minmax(104px,auto); gap:4px; }
        .tBagIcon { height:48%; }
        #tPrepFooter { min-height:64px; padding:4px 0; gap:5px; }
        #tPrepStatus { font-size:10px; line-height:1.25; }
        #tPrepActions { width:min(67%,340px); gap:5px; }
        #tPrepActions>button { min-height:54px; padding:5px 6px; font-size:clamp(13px,1.8vh,16px); }
        #tPrepTraining small { font-size:9px; line-height:1.1; }
      }
    `;
    document.head.appendChild(st);
    setNoviceClass();
    const mk = (tag, id, text) => { const e = document.createElement(tag); e.id = id; if (text) e.textContent = text; document.body.appendChild(e); return e; };
    dom.name = mk('input', 'tName'); dom.name.type = 'text'; dom.name.maxLength = 8;
    dom.name.placeholder = '输入你的名字'; dom.name.value = S.name;
    dom.name.setAttribute('autocomplete', 'off'); dom.name.setAttribute('spellcheck', 'false');
    dom.start = mk('button', 'tStart', '开始游戏');
    dom.novice = mk('label', 'tNovice', '困难模式');
    dom.noviceInput = document.createElement('input'); dom.noviceInput.type = 'checkbox'; dom.noviceInput.checked = hardMode;
    dom.novice.prepend(dom.noviceInput); dom.novice.title = '敌人更强，积分 1.25 倍';
    dom.board = mk('button', 'tBoard', '英雄榜');
    dom.board.addEventListener('click', e => { e.preventDefault(); if (window.BOARD) BOARD.open(); });
    dom.hintOff = mk('label', 'tHintOff', '关闭提醒');
    dom.hintOffInput = document.createElement('input');
    dom.hintOffInput.type = 'checkbox';
    try { dom.hintOffInput.checked = localStorage.getItem('wzb-hint-off') === '1'; } catch (e) {}
    dom.hintOff.prepend(dom.hintOffInput);
    dom.hintOff.title = '勾选后不再显示手机全屏提示';
    dom.hintOffInput.addEventListener('change', () => {
      try { localStorage.setItem('wzb-hint-off', dom.hintOffInput.checked ? '1' : '0'); } catch (e) {}
    });
    dom.modeTip = mk('div', 'tModeTip', '');
    const showModeTip = (text, anchor) => {
      const r = anchor.getBoundingClientRect();
      dom.modeTip.textContent = text;
      dom.modeTip.style.left = Math.round(r.left + r.width / 2) + 'px';
      dom.modeTip.style.top = Math.round(r.bottom + 8) + 'px';
      dom.modeTip.style.opacity = '1';
      clearTimeout(dom.modeTip._t);
      dom.modeTip._t = setTimeout(() => { dom.modeTip.style.opacity = '0'; }, 2600);
    };
    const coarse = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints || 0) > 0;
    if (coarse) {
      dom.novice.addEventListener('click', () => showModeTip('敌人更强，积分 1.25 倍', dom.novice));
      dom.hintOff.addEventListener('click', () => showModeTip('勾选后不再显示手机全屏提示', dom.hintOff));
    }
    dom.help = mk('button', 'tHelp', '?');
    dom.help.title = '操作说明'; dom.help.setAttribute('aria-label', '操作说明');
    dom.tip = mk('div', 'tTip', '请输入名字');
    dom.panel = document.createElement('div'); dom.panel.id = 'tHelpPanel';
    dom.panel.innerHTML = `<h3>操作说明</h3>
      <div><b>电脑</b>：WASD / 方向键 移动 · J 攻击/长按蓄力（棍四连击，锤/石子三连击）· K 或空格 翻滚 · 1 / 2 / 3 换武器· R 重来</div>
      <div><b>手机</b>：左下摇杆移动 · 右下「攻击」短按出招、长按蓄力；棍四连击，锤/石子三连击 · 「翻滚」闪避 · 右上换武器</div>
      <div><b>武器</b>：棍攻击范围大、四连击；锤重击可打断；石子可远程攻击。</div>
      <div><b>蓄力</b>：按住攻击 0.4 秒开始蓄力，最多 2 秒；受击会打断，松开释放。</div>
      <div style="margin-top:6px;color:#c9b68a">打中敌人才能接着连招；被打中会打断连招。草垛和推车可以打坏。</div>`;
    document.body.appendChild(dom.panel);
    dom.flash = mk('div', 'tFlash', '');
    dom.chapter = mk('div', 'tChapter', '');
    dom.chapter.innerHTML = `<div id="tChapterShell">
      <section id="tChapterPick" aria-label="选择关卡"><h2>选择关卡</h2><p id="tChapterNote"></p>
        <button class="tChapterCard selected" data-chapter="1" type="button"><strong>第一章　黄巾劫村</strong><small>重返村庄，迎战黄巾流寇</small></button>
        <button class="tChapterCard" data-chapter="2" type="button"><strong>第二章　黄巾决战</strong><small id="tChapter2State">黄巾后阵 · 追击张梁或张宝</small></button>
        <p id="tChapterNotice"></p>
        <button class="tChapterButton" id="tChapterPickBack" type="button">返回</button>
      </section>
      <section id="tChapterPanel" aria-label="整军备战">
       <div id="tPrepScroll">
        <header id="tPrepHeader"><h2>整军备战</h2><p id="tPrepTarget"></p></header>
        <div id="tPrepMain">
          <button id="tPrepPreview" type="button" aria-label="点击播放当前武器攻击预览"><canvas width="400" height="400"></canvas><small>点击预览攻击</small></button>
          <div id="tPrepSlots"></div>
        </div>
        <div id="tPrepBagTitle"><span>物品栏</span><small>点击装备 · 详情比较 · 选3～5把熔炼</small></div>
        <div id="tPrepBag"></div>
       </div>
       <footer id="tPrepFooter"><span id="tPrepStatus" role="status"></span><div id="tPrepActions"><button class="tChapterButton" id="tPrepGo" type="button">出征</button><button class="tChapterButton" id="tPrepTraining" type="button"><span>校场演武</span><small>试炼刷武器 · 更易出好装备</small></button></div></footer>
      </section></div>`;
    dom.pick = dom.chapter.querySelector('#tChapterPick');
    dom.prep = dom.chapter.querySelector('#tChapterPanel');
    dom.chapter.querySelector('#tChapterPickBack').addEventListener('click', () => closeChapterSelect());
    dom.chapter.addEventListener('click', e => {
      if (suppressItemClick) { suppressItemClick = false; return; }
      const chapter = e.target.closest('[data-chapter]');
      if (chapter) {
        const id = Number(chapter.dataset.chapter);
        if (id === 2 && (!window.CHAPTER2 || !CHAPTER2.canEnter())) return;
        selectedChapter = id === 2 ? 2 : 1; prepView = 'campaign';
        renderPreparation();
        return;
      }
      const item = e.target.closest('[data-item]');
      if (item) { equipItem(item.dataset.item); return; }
      const slot = e.target.closest('[data-slot]');
      if (slot) previewEquippedSlot(slot.dataset.slot);
    });
    dom.chapter.querySelector('#tPrepGo').addEventListener('click', () => startSelectedChapter());
    dom.chapter.querySelector('#tPrepTraining').addEventListener('click', () => {
      if (!window.XIAOCHANG || !XIAOCHANG.CONFIG[selectedChapter] || !hasCleared(S.name,selectedChapter)) return;
      prepView='xiaochang';renderPreparation();if(window.CLOUD_SAVE)CLOUD_SAVE.enterPreparation();
    });
    dom.chapter.querySelector('#tPrepPreview').addEventListener('click', () => playWeaponPreview(previewWeapon));
    if (window.WEAPON_TIP) WEAPON_TIP.attach(dom.chapter, id => ITEMS[id]);
    dom.chapter.addEventListener('pointerdown', beginLoadoutPointer);
    document.addEventListener('pointermove', moveLoadoutPointer, { passive: false });
    document.addEventListener('pointerup', endLoadoutPointer);
    document.addEventListener('pointercancel', cancelLoadoutPointer);
    dom.name.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') start();
      if (e.key === 'Escape') dom.name.blur();
    });
    dom.name.addEventListener('input', () => { if (dom.name.value.length > 8) dom.name.value = dom.name.value.slice(0, 8); });
    dom.start.addEventListener('click', start);
    dom.noviceInput.addEventListener('change', () => writeNovice(dom.noviceInput.checked));
    dom.help.addEventListener('click', () => { helpOpen = !helpOpen; dom.panel.style.display = helpOpen ? 'block' : 'none'; });
    dom.panel.addEventListener('click', () => { helpOpen = false; dom.panel.style.display = 'none'; });
    // 首次进入：把白闪淡出
    requestAnimationFrame(() => { dom.flash.style.opacity = 0; });
    layout();
  }

  function layout() {
    const w = innerWidth, h = innerHeight;
    L.w = w; L.h = h;
    L.title = Math.max(24, Math.min(58, h * .115));
    L.sub = Math.max(12, Math.min(18, h * .033));
    L.inW = Math.max(180, Math.min(320, w * .42));
    L.inH = Math.max(34, Math.min(46, h * .095));
    L.inY = h * .64;
    L.btnW = Math.max(190, Math.min(300, w * .38));
    L.btnH = Math.max(44, Math.min(58, h * .12));
    L.btnY = L.inY + L.inH + Math.max(42, h * .075);
    L.tvX = w * TV.x; L.tvY = h * TV.y; L.tvW = w * TV.w; L.tvH = h * TV.h;
    if (dom.name) {
      const s = dom.name.style;
      s.left = (w - L.inW) / 2 + 'px'; s.top = L.inY + 'px';
      s.width = L.inW + 'px'; s.height = L.inH + 'px';
    }
    if (dom.start) {
      const s = dom.start.style;
      s.left = (w - L.btnW) / 2 + 'px'; s.top = L.btnY + 'px';
      s.width = L.btnW + 'px'; s.height = L.btnH + 'px';
      s.fontSize = Math.round(Math.max(16, Math.min(24, h * .045))) + 'px';
    }
    if (dom.board) {
      const s = dom.board.style;
      const bw = Math.max(132, Math.min(190, w * .26));
      const bh2 = Math.max(30, Math.min(38, h * .09));
      s.left = (w - bw) / 2 + 'px';
      s.top = (L.inY - bh2 - Math.max(8, h * .022)) + 'px';   // 输入名字上方
      s.width = bw + 'px'; s.height = bh2 + 'px';
      s.fontSize = Math.max(12, Math.min(15, h * .032)) + 'px';
    }
    if (dom.novice) {
      const s = dom.novice.style;
      const gapX = 10;
      const nameRight = (w + L.inW) / 2;                 // 输入框右边缘
      const space = w - nameRight;                        // 右边剩余空间
      s.height = Math.max(28, L.inH) + 'px';
      s.width = ''; s.right = '';
      L._narrow = space <= 118;
      if (space > 118) {                                  // 右边放得下：放在输入框右边
        s.left = (nameRight + gapX) + 'px';
        s.top = L.inY + 'px';
        s.width = Math.min(space - gapX - 8, 108) + 'px';   // 只占文字那么宽，别把整条右边都做成按钮
        s.justifyContent = 'flex-start';
      } else {                                            // 太窄：退回输入框下方居中
        s.left = '0'; s.right = '0';
        s.top = (L.inY + L.inH + 8) + 'px';
        s.justifyContent = 'center';
      }
    }
    if (dom.help) {
      const s = dom.help.style;
      const sz = Math.max(26, Math.min(34, h * .07));
      s.width = sz + 'px'; s.height = sz + 'px';
      s.right = (10 + sz + 8) + 'px'; s.top = '8px';
      s.fontSize = Math.round(sz * .5) + 'px';
    }
    if (dom.hintOff) {
      const s = dom.hintOff.style;
      s.height = '24px'; s.width = '104px';
      if (!L._narrow) {                                  // 简单模式下面
        s.left = ((w + L.inW) / 2 + 10) + 'px';
        s.top = (L.inY + L.inH + 4) + 'px';
      } else {                                           // 窄屏：跟在简单模式右边，别再往下堆
        s.left = Math.round(w / 2 + 52) + 'px';
        s.top = (L.inY + L.inH + 8) + 'px';
      }
    }
    if (dom.tip) dom.tip.style.left = (w / 2) + 'px', dom.tip.style.top = (L.inY - 26) + 'px';
  }

  // ---------- 整屏绘制 ----------
  function drawBg(c, W, H) {
    let placed = false;
    if (bgHome && bgHome.complete && bgHome.width) {
      // cover 铺满，再把电视矩形按同一套缩放算出来，保证画面严丝合缝嵌进屏幕
      const s = Math.max(W / bgHome.width, H / bgHome.height);
      const dw = bgHome.width * s, dh = bgHome.height * s, dx = (W - dw) / 2, dy = (H - dh) / 2;
      c.drawImage(bgHome, dx, dy, dw, dh);
      L.tvX = dx + TV.x * dw; L.tvY = dy + TV.y * dh;
      L.tvW = TV.w * dw; L.tvH = TV.h * dh;
      placed = true;
    }
    if (!placed) {   // 图还没加载好：先用深色打底，避免白屏
      c.fillStyle = '#241816'; c.fillRect(0, 0, W, H);
      L.tvX = W * TV.x; L.tvY = H * TV.y; L.tvW = W * TV.w; L.tvH = H * TV.h;
    }
    // 左侧/上下轻微压暗，让标题和按钮更清楚（不挡住画面本身）
    const gl = c.createLinearGradient(0, 0, W * .42, 0);
    gl.addColorStop(0, 'rgba(8,5,10,.62)'); gl.addColorStop(1, 'rgba(8,5,10,0)');
    c.fillStyle = gl; c.fillRect(0, 0, W * .42, H);
    const gb = c.createLinearGradient(0, H * .62, 0, H);
    gb.addColorStop(0, 'rgba(8,5,10,0)'); gb.addColorStop(1, 'rgba(8,5,10,.72)');
    c.fillStyle = gb; c.fillRect(0, H * .62, W, H * .38);
  }

  // 离屏图层：尺寸跟着当前缩放走，避免推镜时糊成马赛克
  function layerFor(w, h) {
    if (!layerCv || Math.abs(layerX - w) > 2 || layerCv.height !== h) {
      layerCv = layerCv || document.createElement('canvas');
      layerCv.width = w; layerCv.height = h; layerX = w;
    }
    return layerCv;
  }

  function drawTV(c) {
    const x = L.tvX, y = L.tvY, w = L.tvW, h = L.tvH;
    if (!demoCv || !maskCv) return;
    // 推镜时按放大后的实际像素尺寸画，避免糊
    const zoom = c.getTransform ? Math.sqrt(Math.abs(c.getTransform().a)) || 1 : 1;
    const lw = Math.max(2, Math.round(w * zoom)), lh = Math.max(2, Math.round(h * zoom));
    const cv = layerFor(lw, lh), g = cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, lw, lh);
    // 演示画面：铺满、裁边、不拉伸
    const da = demoCv.width / demoCv.height, sa = lw / lh;
    let sw = demoCv.width, sh = demoCv.height, sx0 = 0, sy0 = 0;
    if (sa < da) { sw = demoCv.height * sa; sx0 = (demoCv.width - sw) / 2; }
    else { sh = demoCv.width / sa; sy0 = (demoCv.height - sh) / 2; }
    g.imageSmoothingEnabled = false;
    g.drawImage(demoCv, sx0, sy0, sw, sh, 0, 0, lw, lh);
    // 扫描线
    g.fillStyle = 'rgba(0,0,0,.22)';
    for (let yy = 0; yy < lh; yy += 3) g.fillRect(0, yy, lw, 1);
    // 暗角
    const rg = g.createRadialGradient(lw / 2, lh / 2, Math.min(lw, lh) * .25, lw / 2, lh / 2, Math.max(lw, lh) * .62);
    rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,.55)');
    g.fillStyle = rg; g.fillRect(0, 0, lw, lh);
    // 冷色反光 + 玻璃高光
    g.fillStyle = 'rgba(120,180,255,.05)'; g.fillRect(0, 0, lw, lh * .5);
    const gl = g.createLinearGradient(0, 0, lw * .6, lh);
    gl.addColorStop(0, 'rgba(255,255,255,.10)'); gl.addColorStop(.4, 'rgba(255,255,255,0)');
    g.fillStyle = gl; g.fillRect(0, 0, lw, lh);
    // 用绿幕遮罩裁形：猫爪、边框不是绿色 → 自动留在画面上方
    g.globalCompositeOperation = 'destination-in';
    g.imageSmoothingEnabled = true;
    g.drawImage(maskCv, 0, 0, lw, lh);
    g.globalCompositeOperation = 'source-over';
    // 画回主画布（整块按屏幕矩形缩放）
    c.save();
    c.imageSmoothingEnabled = true;
    c.drawImage(cv, x, y, w, h);
    c.restore();
  }

  function drawTitleText(c) {
    const pad = Math.max(16, L.w * .035);
    c.save();
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    const fs = L.title;
    c.font = `900 ${fs}px "KaiTi","STKaiti","Kaiti SC","楷体","Noto Serif CJK SC",serif`;
    c.lineJoin = 'round'; c.lineWidth = Math.max(4, fs * .12); c.strokeStyle = 'rgba(10,6,16,.9)';
    c.fillStyle = '#ffd86e';
    const y = pad + fs * 1.02;
    c.strokeText('无名之辈', pad, y); c.fillText('无名之辈', pad, y);
    // 副标题
    c.font = `700 ${L.sub}px "PingFang SC","Noto Sans CJK SC",sans-serif`;
    c.lineWidth = Math.max(3, L.sub * .35); c.strokeStyle = 'rgba(10,6,16,.9)'; c.fillStyle = '#f2e6c9';
    c.strokeText('序章 · 幻想三国录', pad + 4, y + L.sub * 1.9);
    c.fillText('序章 · 幻想三国录', pad + 4, y + L.sub * 1.9);
    // 角落的小字：操作提示（电脑/手机自适应）
    const coarse = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints || 0) > 0;
    if (true) {   // 角落操作提示始终显示
      c.font = '600 12px "PingFang SC",sans-serif'; c.fillStyle = 'rgba(242,230,201,.5)';
      c.fillText(coarse ? '手机：左下摇杆移动 · 右下攻击/翻滚' : 'WASD 移动 · J 攻击 · K 翻滚 · 1/2/3 换武器', pad, L.h - 10);
    }
    c.restore();
  }

  function draw() {
    if (S.mode === 'game') return false;
    const W = cv.width / DPR, H = cv.height / DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // 转场：向电视推近
    let zoom = 1;
    if (S.mode === 'intro') {
      const p = Math.min(1, S.intro);
      const e = p * p * (3 - 2 * p);
      const need = Math.max(W / L.tvW, H / L.tvH);
      zoom = 1 + e * (need - 1);
    }
    ctx.save();
    if (zoom > 1) {
      const cx = L.tvX + L.tvW / 2, cy = L.tvY + L.tvH / 2;
      ctx.translate(cx, cy); ctx.scale(zoom, zoom); ctx.translate(-cx, -cy);
    }
    drawBg(ctx, W, H);
    drawTV(ctx);
    drawTitleText(ctx);
    ctx.restore();
    // 白闪（转场尾段）
    if (S.mode === 'intro' && S.intro > .78) {
      const a = Math.min(1, (S.intro - .78) / .22);
      ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fillRect(0, 0, W, H);
    }
    return true;
  }

  // ---------- 状态切换 ----------
  function setDomVisible(v) {
    const d = v ? '' : 'none';
    for (const k of ['name', 'start', 'help', 'novice', 'board', 'hintOff']) if (dom[k]) dom[k].style.display = d;
    if (!v && dom.modeTip) { dom.modeTip.style.opacity = '0'; }
    if (!v && dom.panel) { dom.panel.style.display = 'none'; helpOpen = false; }
  }

  let startPending = false;
  async function start() {
    if (S.mode !== 'title' || startPending) return;
    const n = (dom.name.value || '').trim().slice(0, 8);
    if (!n) {
      S.msg = '请输入名字'; S.msgT = 1.6;
      dom.tip.style.opacity = 1;
      dom.name.classList.remove('shake'); void dom.name.offsetWidth; dom.name.classList.add('shake');
      dom.name.focus();
      return;
    }
    S.name = n; writeName(n);
    if (window.CLOUD_SAVE && !DEBUG) {
      startPending=true; dom.start.disabled=true; dom.name.disabled=true;
      const savedLabel=dom.start.textContent; dom.start.textContent='同步存档…';
      try { await CLOUD_SAVE.sync(n); } finally { startPending=false; dom.start.disabled=false; dom.name.disabled=false; dom.start.textContent=savedLabel; }
    }
    if (hasCleared(n, 1) || (window.ARMORY && ARMORY.played())) { openChapterSelect(); return; }
    if (window.ARMORY) ARMORY.markPlayed();
    S.mode = 'intro'; S.intro = 0;
    document.body.classList.add('wzb-intro');
    S.msgT = 0; if (dom.tip) dom.tip.style.opacity = 0;   // 清掉“请输入名字”
    setDomVisible(false);   // 输入框/按钮先藏起来；游戏 UI 等真正进场再放出来
  }

  function openChapterSelect(target = 1) {
    S.mode = 'chapter'; S.chapterReturn = true;
    document.body.classList.add('wzb-intro');
    setDomVisible(false);
    const note = dom.chapter.querySelector('#tChapterNote');
    if (note) note.textContent = `玩家：${S.name || '未命名'}`;
    if (target && typeof target === 'object') { selectedChapter=target.chapter || 1;prepView=target.view==='xiaochang'?'xiaochang':'campaign'; }
    else if (target === 'xiaochang') { prepView='xiaochang'; }
    else { selectedChapter=target===2?2:1;prepView='campaign'; }
    renderPreparation();
    dom.chapter.classList.add('open');
    if(window.CLOUD_SAVE)CLOUD_SAVE.enterPreparation();
  }

  function closeChapterSelect() {
    dom.chapter.classList.remove('open');
    previewAnimation = null;
    if (previewRaf) cancelAnimationFrame(previewRaf);
    previewRaf = 0;
    document.body.classList.remove('wzb-intro');
    S.mode = 'title'; S.chapterReturn = false;
    setDomVisible(true);
  }

  function itemIconSrc(id) {
    const item = ITEMS[id];
    if (!item) return '';
    if (item.icon === 'halberd') {
      return typeof ASSETS !== 'undefined' && ASSETS.chars && ASSETS.chars.guanhai && ASSETS.chars.guanhai.halberd
        ? ASSETS.chars.guanhai.halberd[0]
        : 'art/sprites/guanhai/halberd.png';
    }
    if (typeof ASSETS === 'undefined') return '';
    return ASSETS.ui && ASSETS.ui[item.icon] ? ASSETS.ui[item.icon] : '';
  }

  function itemIcon(id) {
    const src = itemIconSrc(id);
    return src ? `<img class="icon-${ITEMS[id].icon}" src="${src}" alt="${ITEMS[id].name}" draggable="false">` : '<span aria-hidden="true">—</span>';
  }

  function renderPreparation(status = '') {
    if (!dom.chapter) return;
    if (window.WEAPON_TIP) WEAPON_TIP.hide();
    const p = playerLoadout();
    if (window.ARMORY) for (const slot of ['long','short','ranged']) p.equipped[slot] = ARMORY.equipped(slot)?.type || null;
    const chapterName = selectedChapter === 2 ? '第二章　黄巾决战' : '第一章　黄巾劫村';
    const c2 = dom.chapter.querySelector('[data-chapter="2"]');
    const canEnter2 = !!(window.CHAPTER2 && CHAPTER2.canEnter());
    if (c2) {
      c2.disabled = !canEnter2;
      c2.classList.toggle('selected', selectedChapter === 2);
      const state = dom.chapter.querySelector('#tChapter2State');
      if (state) state.textContent = canEnter2 ? '选择后可整备出征' : '未开放';
    }
    const notice = dom.chapter.querySelector('#tChapterNotice');
    if (notice) {
      notice.style.display = canEnter2 ? 'none' : 'block';
      notice.textContent = '第二章暂未开放；可在第一章挑战精英与BOSS，收集和重铸武器。';
    }
    const c1 = dom.chapter.querySelector('[data-chapter="1"]');
    if (c1) c1.classList.toggle('selected', selectedChapter === 1);
    const chapterNote = dom.chapter.querySelector('#tChapterNote');
    if (chapterNote) chapterNote.textContent = `玩家：${S.name || '未命名'}`;
    const target = dom.chapter.querySelector('#tPrepTarget');
    if (target) target.textContent = `出征目标：${chapterName}`;

    const slots = dom.chapter.querySelector('#tPrepSlots');
    slots.innerHTML = EQUIPMENT_SLOTS.map(slot => {
      const id = p.equipped[slot.id], item = ITEMS[id];
      const display = item ? item.name : (slot.id === 'artifact' ? '未装备' : '空');
      const extra = slot.id === 'fashion' && !item ? '<small>联系作者购买</small>' : '';
      const icon = item ? itemIcon(id) : '<span aria-hidden="true">—</span>';
      return `<div class="tPrepSlot" data-slot="${slot.id}" ${item ? `data-weapon="${id}"` : ''} data-inventory-drop="slot" role="button" tabindex="0" aria-label="${slot.name}：${display}">
        <b>${slot.name}</b><span class="tPrepIcon">${icon}</span><span class="tPrepName">${display}${extra}</span></div>`;
    }).join('');

    const equipped = new Set(Object.values(p.equipped).filter(Boolean));
    const items = p.owned.filter(id => ITEMS[id] && !equipped.has(id));
    const bag = dom.chapter.querySelector('#tPrepBag');
    bag.innerHTML = Array.from({ length: 12 }, (_, i) => {
      const id = items[i];
      return id
        ? `<button class="tBagItem" type="button" data-item="${id}" data-inventory-drop="item" aria-label="${ITEMS[id].name}，点击装备或拖动"><span class="tBagIcon">${itemIcon(id)}</span><span>${ITEMS[id].name}</span></button>`
        : '<div class="tBagEmpty" data-inventory-drop="empty" aria-hidden="true">空</div>';
    }).join('');
    const ready = EQUIPMENT_SLOTS.some(slot => slot.combat && !!p.equipped[slot.id]);
    const go = dom.chapter.querySelector('#tPrepGo');
    go.disabled = !!(window.ARMORY && ARMORY.count() >= ARMORY.capacity()) || !ready || (selectedChapter === 2 && !canEnter2);
    const message = status || (!ready ? '至少装备一件武器' : selectedChapter === 2 && !canEnter2 ? '第二章未开放' : '装备会自动保存');
    dom.chapter.querySelector('#tPrepStatus').textContent = message;
    if (window.ARMORY) ARMORY.render(dom.chapter, itemIcon, playWeaponPreview);
    dom.chapter.dataset.prepView=prepView;
    dom.prep.classList.toggle('x-preparation',prepView==='xiaochang');
    if (window.XIAOCHANG) XIAOCHANG.renderPreparation(dom.chapter, prepView === 'xiaochang',selectedChapter);
    if (window.CLOUD_SAVE) CLOUD_SAVE.attach(dom.chapter);
    if (!previewAnimation) drawPreviewIdle(p.equipped.long || p.equipped.short || p.equipped.ranged || 'staff');
  }

  function saveEquipment(p) {
    p.long = p.equipped.long || null;
    const ok = saveLoadout(S.name, p);
    renderPreparation(ok ? '' : '保存失败，请检查浏览器存储设置');
    return ok;
  }

  function equipItem(id) {
    const item = ITEMS[id], p = playerLoadout();
    if (!item || !p.owned.includes(id)) return false;
    p.equipped[item.slot] = id;
    const ok = saveEquipment(p);
    if (ok) playWeaponPreview(id);
    return ok;
  }

  function previewEquippedSlot(slot) {
    if (!EQUIPMENT_SLOTS.some(s => s.id === slot)) return false;
    const p = playerLoadout();
    const id = window.ARMORY ? ARMORY.equipped(slot)?.type : p.equipped[slot];
    if (!id) return false;
    playWeaponPreview(id);
    return true;
  }

  function drawPreviewFrame(frameName) {
    const canvas = dom.chapter && dom.chapter.querySelector('#tPrepPreview canvas');
    if (!canvas || typeof CH === 'undefined') return;
    const g = canvas.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = 'rgba(12,9,7,.3)';
    g.beginPath(); g.ellipse(canvas.width / 2, canvas.height - 27, 60, 9, 0, 0, Math.PI * 2); g.fill();
    const frame = CH.hero && CH.hero[frameName];
    if (!frame) return;
    if (!frame.img.complete) {
      if (!frame.previewPending) {
        frame.previewPending = true;
        frame.img.addEventListener('load', () => {
          frame.previewPending = false;
          if (dom.chapter && dom.chapter.classList.contains('open')) drawPreviewFrame(frameName);
        }, { once: true });
      }
      return;
    }
    if (!frame.img.naturalWidth) return;
    const baseH = 74;   // 以主角身高为基准，所有武器/攻击帧统一比例
    // 不能用 frame.w（武器长度）限制缩放，否则长戟攻击帧会把人物缩小，预览忽大忽小。
    const scale = Math.max(1, Math.min(2, Math.floor(canvas.height * .78 / baseH)));
    // 长戟按人物同倍率画，锚点向左留出完整135px武器和轨迹的空间。
    const centerX = previewWeapon === 'halberd' ? canvas.width * .32 : canvas.width / 2;
    const x = Math.round(centerX - frame.ax * scale);
    const y = Math.round(canvas.height - 28 - frame.ay * scale);
    g.imageSmoothingEnabled = false;
    g.drawImage(frame.img, x, y, frame.w * scale, frame.h * scale);
  }

  function idlePreviewFrame(id) {
    if (id === 'halberd') return 'halberd0';
    if (id === 'hammer') return 'hammer0';
    if (id === 'staff') return 'staff0';
    if (id === 'stone') return 'stone0';
    if (id === 'bow') return 'bow0';
    return id + '0';
  }

  function drawPreviewIdle(id) {
    previewWeapon = ITEMS[id] ? id : 'staff';
    drawPreviewFrame(idlePreviewFrame(previewWeapon));
  }

  function playWeaponPreview(id) {
    if (!ITEMS[id]) return;
    previewWeapon = id;
    const base = id === 'halberd' ? 'halberd' : id;
    const combo = typeof WEAP !== 'undefined' && WEAP[base] ? WEAP[base].combo : [];
    const frames = [];
    combo.forEach(step => step.f.forEach((frame, i) => frames.push({ frame, duration: Math.max(.06, (step.d[i] || .12) * 1000) })));
    if (!frames.length) { drawPreviewIdle(id); return; }
    if (previewRaf) cancelAnimationFrame(previewRaf);
    previewAnimation = { id, frames, start: performance.now(), total: frames.reduce((sum, frame) => sum + frame.duration, 0) };
    const tick = now => {
      if (!previewAnimation || !dom.chapter.classList.contains('open')) { previewAnimation = null; previewRaf = 0; return; }
      const elapsed = now - previewAnimation.start;
      let frameName = frames[frames.length - 1].frame;
      if (elapsed < previewAnimation.total) {
        let time = elapsed;
        for (const frame of frames) {
          if (time < frame.duration) { frameName = frame.frame; break; }
          time -= frame.duration;
        }
      } else if (elapsed >= previewAnimation.total + 1000) {
        previewAnimation = null; previewRaf = 0;
        drawPreviewIdle(id);
        return;
      }
      drawPreviewFrame(frameName);
      previewRaf = requestAnimationFrame(tick);
    };
    tick(performance.now());
  }

  function beginLoadoutPointer(e) {
    if (window.ARMORY) return;
    if (!dom.prep || !dom.prep.contains(e.target)) return;
    const itemNode = e.target.closest('[data-item]');
    const slotNode = e.target.closest('[data-slot]');
    const p = playerLoadout();
    const itemId = itemNode ? itemNode.dataset.item : slotNode ? p.equipped[slotNode.dataset.slot] : null;
    if (!itemId || !ITEMS[itemId]) return;
    pointerDrag = { id: itemId, source: itemNode ? 'bag' : 'slot', sourceSlot: slotNode && slotNode.dataset.slot, pointerId: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    try { e.target.setPointerCapture(e.pointerId); } catch (_) {}
  }

  function moveLoadoutPointer(e) {
    if (!pointerDrag || e.pointerId !== pointerDrag.pointerId) return;
    const drag = pointerDrag, dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 7) return;
    drag.moved = true; e.preventDefault();
    if (!dom.chapter.querySelector('#tPrepGhost')) {
      const ghost = document.createElement('div'); ghost.id = 'tPrepGhost'; ghost.innerHTML = `${itemIcon(drag.id)}<span>${ITEMS[drag.id].name}</span>`; dom.chapter.appendChild(ghost);
    }
    const ghost = dom.chapter.querySelector('#tPrepGhost');
    ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px';
    dom.chapter.querySelectorAll('.tPrepSlot.drop-ok').forEach(el => el.classList.remove('drop-ok'));
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const slot = target && target.closest('[data-slot]');
    if (slot && slot.dataset.slot === ITEMS[drag.id].slot) slot.classList.add('drop-ok');
  }

  function endLoadoutPointer(e) {
    if (!pointerDrag || (e.pointerId !== undefined && e.pointerId !== pointerDrag.pointerId)) return;
    const drag = pointerDrag; pointerDrag = null;
    const ghost = dom.chapter && dom.chapter.querySelector('#tPrepGhost');
    if (ghost) ghost.remove();
    if (dom.chapter) dom.chapter.querySelectorAll('.tPrepSlot.drop-ok').forEach(el => el.classList.remove('drop-ok'));
    if (!drag.moved) return;
    suppressItemClick = true; setTimeout(() => { suppressItemClick = false; }, 0);
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const targetSlot = target && target.closest('[data-slot]');
    const targetBag = target && target.closest('#tPrepBag');
    const p = playerLoadout(), item = ITEMS[drag.id];
    if (targetSlot && targetSlot.dataset.slot === item.slot) p.equipped[item.slot] = drag.id;
    else if (targetBag && drag.source === 'slot') p.equipped[drag.sourceSlot] = null;
    else return;
    const equipped = !!(targetSlot && targetSlot.dataset.slot === item.slot);
    const saved = saveEquipment(p);
    if (saved && equipped) playWeaponPreview(drag.id);
  }

  function cancelLoadoutPointer(e) {
    if (!pointerDrag || e.pointerId !== pointerDrag.pointerId) return;
    pointerDrag = null;
    const ghost = dom.chapter && dom.chapter.querySelector('#tPrepGhost');
    if (ghost) ghost.remove();
    if (dom.chapter) dom.chapter.querySelectorAll('.tPrepSlot.drop-ok').forEach(el => el.classList.remove('drop-ok'));
  }

  function startSelectedChapter() {
    if(window.ARMORY && ARMORY.count() >= ARMORY.capacity()){renderPreparation('已满50把，请先熔炼或丢弃，再出征');return;}
    if (window.ARMORY) ARMORY.markPlayed();
    const p = playerLoadout();
    if (window.ARMORY) for (const slot of ['long','short','ranged']) p.equipped[slot] = ARMORY.equipped(slot)?.type || null;
    if (!EQUIPMENT_SLOTS.some(slot => slot.combat && !!p.equipped[slot.id])) { renderPreparation('至少装备一件武器'); return; }
    if (prepView === 'xiaochang') {
      if (window.XIAOCHANG && XIAOCHANG.start({chapter:selectedChapter})) { dom.chapter.classList.remove('open'); }
      return;
    }
    if (selectedChapter === 2) {
      if (!window.CHAPTER2 || !CHAPTER2.canEnter()) { renderPreparation('第二章未开放'); return; }
      const begin = window.startChapter2 || window.startChapter2Debug;
      if (typeof begin !== 'function') { renderPreparation('第二章战斗入口尚未接入'); return; }
      dom.chapter.classList.remove('open'); S.mode = 'game';
      document.body.classList.remove('wzb-title', 'wzb-intro');
      begin();
      return;
    }
    finish({ skipWake: true });
  }

  function finish(options = {}) {
    dom.chapter.classList.remove('open');
    S.mode = 'game';
    document.body.classList.remove('wzb-title');   // 这时候才把游戏 UI（摇杆/攻击/血条）露出来
    document.body.classList.remove('wzb-intro');
    if (options.skipWake) { if (window.ROOM) ROOM.skip(); if (typeof reset === 'function') reset(); }
    else if (window.ROOM) ROOM.begin(); else if (typeof reset === 'function') reset();
    if (dom.flash) {
      dom.flash.style.transition = 'none'; dom.flash.style.opacity = 1;
      requestAnimationFrame(() => { dom.flash.style.transition = 'opacity .32s ease-out'; dom.flash.style.opacity = 0; });
    }
  }

  function show() {
    S.mode = 'title'; S.intro = 0;
    if (dom.chapter) dom.chapter.classList.remove('open');
    if (typeof reset === 'function') reset();   // 回首页时把这一局清掉（背景音乐也会回到村庄曲）
    document.body.classList.remove('wzb-intro');
    document.body.classList.add('wzb-title');
    setDomVisible(true);
    if (dom.name) { dom.name.value = S.name; dom.name.blur(); }
    if (dom.flash) { dom.flash.style.transition = 'none'; dom.flash.style.opacity = 1; requestAnimationFrame(() => { dom.flash.style.transition = 'opacity .32s ease-out'; dom.flash.style.opacity = 0; }); }
    layout();
  }

  // ---------- 对外接口（game.js 只调这几个） ----------
  window.TITLE = {
    blocks: () => S.mode !== 'game',            // true = 游戏逻辑不推进
    draw: () => draw(),                          // 返回 true = 这一帧由标题界面接管
    playerName: () => S.name,
    hardMode: () => hardMode,
    noviceMode: () => !hardMode,
    hasCleared: (chapter = 1, name = S.name) => hasCleared(name, chapter),
    markCleared: (chapter = 1, name = S.name) => markCleared(name, chapter),
    legacyLoadout: () => playerLoadout(),
    campaignProgress: () => readCampaign()[playerKey(S.name)] || {},
    applyCloudProgress: progress => {
      if (DEBUG) return;
      const key=playerKey(S.name),all=readCampaign(); if(!key)return;
      const merged=CLOUD_MERGE.merge({campaign:all[key]},{campaign:progress}).campaign;
      all[key]=merged;
      try { localStorage.setItem(CAMPAIGN_KEY,JSON.stringify(all)); } catch (_) {}
    },
    refreshPreparation: () => renderPreparation(),
    preparedWeapon: () => { if (window.ARMORY && ARMORY.played()) return ARMORY.prepared(); const p = playerLoadout(); return hasCleared(S.name, 1) || DEBUG ? (p.equipped.long || p.equipped.short || p.equipped.ranged) : null; },
    equippedWeapon: slot => window.ARMORY ? ARMORY.equipped(slot)?.type || null : playerLoadout().equipped[slot] || null,
    ownsWeapon: id => window.ARMORY ? ARMORY.owns(id) : playerLoadout().owned.includes(id),
    grantWeapon: (id, equip = false) => {
      if (window.ARMORY) return ARMORY.grant(id, equip);
      if (!ITEMS[id] || (!DEBUG && !playerKey(S.name))) return false;
      const p = playerLoadout();
      if (!p.owned.includes(id)) p.owned.push(id);
      if (equip) p.equipped[ITEMS[id].slot] = id;
      p.long = p.equipped.long || null;
      return saveLoadout(S.name, p);
    },
    openPreparation: target => openChapterSelect(target),
    xiaochangProgress: chapter => Number(readCampaign()[playerKey(S.name)]?.xiaochang?.[chapter]) || 0,
    markXiaochang: (chapter,floor) => {
      if(DEBUG || !hasCleared(S.name,chapter)) return false;
      const key=playerKey(S.name),all=readCampaign(); if(!key)return false;
      all[key] ||= {}; all[key].xiaochang ||= {};
      all[key].xiaochang[chapter]=Math.max(Number(all[key].xiaochang[chapter])||0,Math.min(5,floor));
      try{localStorage.setItem(CAMPAIGN_KEY,JSON.stringify(all));}catch(_){return false;}
      if(window.CLOUD_SAVE)CLOUD_SAVE.queue(S.name); return true;
    },
    show: () => show(),
    active: () => S.mode !== 'game',
    // 调试用：直接跳过标题页进游戏
    skip: () => {
      S.mode = 'game'; S.intro = 0;
      document.body.classList.remove('wzb-title', 'wzb-intro');
      setDomVisible(false);
      if (dom.flash) dom.flash.style.opacity = 0;
    },
  };

  // ---------- 初始化 ----------
  function boot() {
    build();
    setNoviceClass();
    document.body.classList.add('wzb-title');
    bgHome = new Image(); bgHome.src = (typeof ASSETS !== 'undefined' && ASSETS.title) || BG.far;
    // 绿幕遮罩：整张图尺寸，绿幕处不透明
    tvMask = new Image();
    tvMask.onload = () => {
      const bx = Math.round(TV.x * tvMask.width), by = Math.round(TV.y * tvMask.height);
      const bw = Math.round(TV.w * tvMask.width), bh = Math.round(TV.h * tvMask.height);
      maskCv = document.createElement('canvas');
      maskCv.width = bw; maskCv.height = bh;
      maskCv.getContext('2d').drawImage(tvMask, bx, by, bw, bh, 0, 0, bw, bh);
    };
    tvMask.src = (typeof ASSETS !== 'undefined' && ASSETS.tvMask) || '';   // 首页背景图
    bgFar = new Image(); bgFar.src = BG.far;   // 电视里的演示仍用村景三层
    bgMid = new Image(); bgMid.src = BG.mid;
    bgGnd = new Image(); bgGnd.src = BG.gnd;
    demoCv = document.createElement('canvas'); demoCv.width = 480; demoCv.height = 270;
    dctx = demoCv.getContext('2d');
    demoReset();
    addEventListener('resize', layout);
    addEventListener('orientationchange', () => setTimeout(layout, 260));
    let last = performance.now();
    const tick = (t) => {
      const dt = Math.min(.05, (t - last) / 1000); last = t;
      S.t += dt;
      if (S.msgT > 0) { S.msgT -= dt; if (S.msgT <= 0 && dom.tip) dom.tip.style.opacity = 0; }
      if (S.mode === 'title' || S.mode === 'intro') {
        demoStep(dt); demoRender();
        if (S.mode === 'intro') { S.intro += dt / 1.2; if (S.intro >= 1) finish(); }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  boot();
})();
