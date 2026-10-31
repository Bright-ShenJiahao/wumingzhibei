// 心魔试炼（用户定 2026-10-31）：校场里只带一把武器，对面是和玩家一模一样的「心魔」——同武器、同血量、同出招。
// AI = 规则 + 帧数据（读主角的出招前摇/距离）+ 对手建模（记玩家习惯来预判）。没有难度档，越难越好：
//   玩家每赢一次，心魔的反应更快、闪避更准；每次被玩家战胜，都把这局玩家的行为习惯存下来，下次照着针对。
// 公平底线：心魔只能看到玩家「已经开始」的动作（有反应延迟），一样受翻滚冷却、出招前摇和硬直限制。
window.XINMO = (() => {
  const KEY = 'wzb-xinmo';
  const LINES = {
    intro: ['心魔：「你的每一招，我都会。」', '心魔：「来吧，看看谁才是真的你。」', '心魔：「你怕的，从来不是敌人。」', '心魔：「你的破绽，我比你清楚。」'],
    introAgain: ['心魔：「又来了？上次那招，我记住了。」', '心魔：「你赢过我 {n} 次……这次不会了。」', '心魔：「你变了吗？我看看。」'],
    win: ['心魔：「……原来你，比我想的更强。」', '心魔：「这次算你赢……我会记住你今天的样子。」', '心魔：「好……你终于跨过了自己。」'],
    lose: ['心魔：「你输给的，只是你自己。」', '心魔：「同样的招，你还要用几次？」', '心魔：「回去吧，等你变了再来。」'],
  };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  // ---------- 存档：按玩家名记 胜场 / 挑战次数 / 习惯 ----------
  const name = () => (window.TITLE && TITLE.playerName ? String(TITLE.playerName() || '') : '').trim().slice(0, 8) || '_';
  function readAll() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
  function data() {
    const all = readAll(), d = all[name()] || {};
    d.wins ||= 0; d.tries ||= 0; d.habit ||= {}; d.defeats ||= []; return d;
  }
  function save(d) { try { const all = readAll(); all[name()] = d; localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {} }
  // 习惯计数器：每项 [次数, 总数]；翻滚方向（相对心魔）back/fwd/up/down
  const H0 = () => ({ hurtRoll: [0, 0], roll: { back: 0, fwd: 0, up: 0, down: 0 }, combo: [0, 0], charge: [0, 0], dist: [0, 0], lowRetreat: [0, 0], attackOnWake: [0, 0] });
  function merge(into, h, w) {
    for (const k in h) {
      if (Array.isArray(h[k])) { into[k] ||= [0, 0]; into[k][0] += h[k][0] * w; into[k][1] += h[k][1] * w; }
      else { into[k] ||= {}; for (const j in h[k]) into[k][j] = (into[k][j] || 0) + h[k][j] * w; }
    }
    // 衰减：老习惯慢慢淡掉，玩家改了打法心魔要重新学
    for (const k in into) { if (Array.isArray(into[k])) { if (into[k][1] > 400) { into[k][0] *= .7; into[k][1] *= .7; } } else { const s = Object.values(into[k]).reduce((a, b) => a + b, 0); if (s > 200) for (const j in into[k]) into[k][j] *= .7; } }
  }
  const rate = p => p && p[1] >= 3 ? p[0] / p[1] : null;
  // ---------- 本局 ----------
  let m = null, hist = [], rec = null, lvl = 0, model = null, prev = null, ended = false;
  function level() { return lvl; }
  function spawn(w) {
    const d = data(); lvl = Math.min(10, d.wins); model = d.habit;
    rec = { h: H0(), hurtAt: -9, wasHurt: false, lastSt: '', combo: 0, wake: -9 };
    hist = []; ended = false;
    const hp = Math.max(8, maxHeroHp());
    window.spawn('grunt', hero.x < 360 ? 600 : 120, (M.top + M.bot) / 2);
    m = zs[zs.length - 1];
    m && 0; marks = []; mshots = []; hb = { n: 0, t: 0 }; Object.assign(m, { zg: 0, ammo: 5, plan: null, lock: false, ch: 0, dash: null, type: 'xinmo', sprite: 'hero', st: 'idle', t: 0, f: hero.x < m.x ? -1 : 1, cd: 1.2, rollCd: 0, inv: 0, atk: null, q: 0, think: 0, hitC: 0, sc: 1 });
    // 血量：按主角伤害来定，玩家大约要打中 30 下（心魔打中玩家大约 6～8 下），各自承受得住几轮连招
    m.T = { name: '心魔', mirror: true, hp: 0, spd: 70, w: 16, noLaunch: true, xinmoHp: hp };
    tape = []; tape.t0 = gameT; tapeT = 0; keys = []; hits = []; pv = null; joyPrev = null;
    m.weapon = w; P = snap(); { const d0 = data(); d0.lessons ||= {}; L = JSON.parse(JSON.stringify(d0.lessons[w] || newL())); lastHits = []; } m.T.hp = P.hp; m.hp = m.T.hp; m.wait = 3; showCard();   // 血量 = 你的血量
    m.bossLabel = '心魔'; m.xiaochang = true;
    say(d.tries && Math.random() < .6 ? pick(LINES.introAgain).replace('{n}', d.wins) : pick(LINES.intro), 3);
    return m;
  }
  function estHit(w) {   // 主角这把武器一下平均伤害（含装备词条倍率的粗估）
    const C = WEAP[w].combo, avg = C.reduce((s, c) => s + (c.dmg || 1), 0) / C.length;
    const g = window.GEAR && GEAR.previewDamage ? GEAR.previewDamage(w) : 1;
    return Math.max(.8, avg * (g || 1));
  }
  const W = () => WEAP[m.weapon];
  // 1:1 复刻（用户定）：心魔的血量、出手倍率、暴击、受伤减免、移速、攻速、翻滚、起身、蓄力时间，全部读玩家自己的数值
  // ---------- 复盘学习（用户定）：记下心魔在什么情况下挨打、被你哪一招打，下次少做那种事、专门防那一招 ----------
  // 存在 d.lessons[武器]：time[情形] = 处在这种情形的总秒数，dmg[情形] = 这种情形下挨的伤害，byC[你的招] = 那一招打了它多少
  let L = null, lastHits = [];
  // ---------- 对局录像（为以后训练神经网络攒数据）：每 0.1 秒一行，打完上传 /api/xinmo ----------
  const ST = ['idle', 'walk', 'atk', 'roll', 'hurt', 'bounce', 'getup', 'charge', 'air', 'land', 'down'], MODE_IDS = ['neutral', 'punish', 'charge', 'attack', 'challenge', 'halberd', 'feint', 'approach', 'backoff', 'chase', 'shoot', 'keep', 'roll', 'recover'];
  // 字段照 FightingICE（CharacterData/AttackData）和 slippi-ai（Player/Controller）补齐：每秒 20 行状态 + 按键事件 + 命中事件
  const SIDE = ['x', 'y', 'vx', 'vy', 'f', 'st', 'c', 'fi', 'left', 'act', 'inv', 'hp', 'chg', 'daze', 'rollcd', 'ix', 'iy', 'atk', 'roll'];
  const COLS = ['t', 'dx', 'dy', ...SIDE.map(k => 'h_' + k), ...SIDE.map(k => 'm_' + k), 'm_mode', 'm_ammo', 'h_ammo',
    ...[0, 1, 2].flatMap(i => ['hs' + i + '_dx', 'hs' + i + '_dy', 'hs' + i + '_vx', 'hs' + i + '_vy']), ...[0, 1, 2].flatMap(i => ['ms' + i + '_dx', 'ms' + i + '_dy', 'ms' + i + '_vx', 'ms' + i + '_vy'])];
  let tape = null, tapeT = 0, keys = null, hits = null, pv = null, kin = null;
  const R2 = v => Math.round(v * 100) / 100;
  // 当前动作还剩多久（FightingICE remaining_frame）、现在能不能操作（control）
  function leftOf(e, w) {
    if (e.st === 'atk' && e.atk && WEAP[w]) { const C = WEAP[w].combo[e.atk.c]; if (!C) return 0; let t = -e.atk.t; for (let i = e.atk.fi; i < C.f.length; i++) t += C.d[i]; return Math.max(0, t); }
    if (e.st === 'roll') return Math.max(0, .4 - e.t); if (e.st === 'hurt') return Math.max(0, .3 - e.t); if (e.st === 'bounce') return Math.max(0, .3 - e.t); if (e.st === 'getup') return Math.max(0, .35 - e.t);
    return 0;
  }
  function side(e, w, isHero, vx, vy) {
    const sti = Math.max(0, ST.indexOf(e === m && e.st === 'charge' ? 'charge' : e.st)), act = ['idle', 'walk'].includes(e.st) ? 1 : 0;
    const chg = isHero ? (charging && atkHeldSince ? (performance.now() - atkHeldSince) / 1000 : 0) : (e.ch || 0);
    const ix = isHero ? (e.ix || 0) : (kin ? kin.mix : 0), iy = isHero ? (e.iy || 0) : (kin ? kin.miy : 0);
    const atk = isHero ? (atkHeldSince || pressAtk ? 1 : 0) : (e.st === 'atk' || e.st === 'charge' ? 1 : 0), rl = e.st === 'roll' ? 1 : 0;
    return [R2(e.x), R2(e.y), R2(vx), R2(vy), e.f, sti, e.atk ? e.atk.c : -1, e.atk ? e.atk.fi : -1, R2(leftOf(e, w)), act, e.inv > 0 ? 1 : 0, R2(e.hp), R2(chg), e.dazeT > 0 ? 1 : 0, R2(e.rollCd || 0), R2(ix), R2(iy), atk, rl];
  }
  function near3(list, to) {   // 最近 3 个飞行物，相对接收者的位置和速度
    const a = list.filter(p => p.life > 0).sort((p, q) => Math.abs(p.x - to.x) - Math.abs(q.x - to.x)).slice(0, 3), out = [];
    for (let i = 0; i < 3; i++) { const p = a[i]; out.push(...(p ? [R2(p.x - to.x), R2(p.y - to.y), R2(p.vx || 0), R2(p.vy || 0)] : [0, 0, 0, 0])); }
    return out;
  }
  function recordRow(dt) {
    if (!tape) return;
    const t = R2(gameT - tape.t0);
    // 心魔的「手柄」：按它实际的移动方向和动作记，和玩家的按键对得上
    const mvx = pv ? (m.x - pv.mx) / Math.max(dt, 1e-3) : 0, mvy = pv ? (m.y - pv.my) / Math.max(dt, 1e-3) : 0;
    kin = { mix: Math.abs(mvx) > 5 ? Math.sign(mvx) : 0, miy: Math.abs(mvy) > 5 ? Math.sign(mvy) : 0 };
    // 命中事件：谁打中谁、多少伤害、有没有晕（slippi 的 percent 变化 / FightingICE 的 hit_confirm）
    if (pv) {
      if (hero.hp < pv.hhp - .001) hits.push([t, 1, R2(pv.hhp - hero.hp), hero.dazeT > 0 && !pv.hdz ? 1 : 0]);
      if (m.hp < pv.mhp - .001) hits.push([t, 0, R2(pv.mhp - m.hp), m.dazeT > 0 && !pv.mdz ? 1 : 0]);
      // 心魔的「按键」事件：出招、翻滚、蓄力开始/放出、走动方向变化
      const ev = (k, v) => keys.push([t, 1, k, v]);
      if (m.st !== pv.mst) { if (m.st === 'atk') ev('atk', m.atk ? m.atk.c : 0); if (m.st === 'roll') ev('roll', 1); if (m.st === 'charge') ev('charge', 1); if (pv.mst === 'charge') ev('charge', 0); }
      if (kin.mix !== pv.mix) ev('x', kin.mix); if (kin.miy !== pv.miy) ev('y', kin.miy);
    }
    pv = { hhp: hero.hp, mhp: m.hp, hdz: hero.dazeT > 0, mdz: m.dazeT > 0, mst: m.st, mx: m.x, my: m.y, mix: kin.mix, miy: kin.miy };
    if (tape.length >= 4000) return; tapeT += dt; if (tapeT < .05) return; tapeT = 0;   // 每秒 20 行
    tape.push([t, R2(hero.x - m.x), R2(hero.y - m.y), ...side(hero, weapon, true, hero.mvx || 0, hero.mvy || 0), ...side(m, m.weapon, false, mvx, mvy),
      Math.max(0, MODE_IDS.indexOf(curMode())), R2(m.ammo ?? 5), window.BOWAMMO && BOWAMMO.count ? R2(BOWAMMO.count()) : 5, ...near3(shots, m), ...near3(mshots, hero)]);
  }
  // 玩家真实按键（slippi 的 Controller / FightingICE 的 Key）：键盘、手机按钮、摇杆，精确到毫秒
  const KEYMAP = { KeyJ: 'atk', KeyK: 'roll', KeyL: 'roll', Space: 'roll', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down' };
  function onKey(e) { if (!tape || !KEYMAP[e.code] || e.repeat) return; keys.push([R2(gameT - tape.t0), 0, KEYMAP[e.code], e.type === 'keydown' ? 1 : 0]); }
  function onBtn(e) { if (!tape) return; const id = e.target && e.target.closest && e.target.closest('#bA,#bR'); if (!id) return; keys.push([R2(gameT - tape.t0), 0, id.id === 'bA' ? 'atk' : 'roll', e.type === 'pointerdown' || e.type === 'touchstart' ? 1 : 0]); }
  let joyPrev = null;
  function joyTick() { if (!tape) return; const j = typeof joy !== 'undefined' && joy ? [Math.round(joy.dx * 4) / 4, Math.round(joy.dy * 4) / 4] : [0, 0]; if (!joyPrev || j[0] !== joyPrev[0] || j[1] !== joyPrev[1]) { if (joyPrev || j[0] || j[1]) keys.push([R2(gameT - tape.t0), 0, 'stick', j[0], j[1]]); joyPrev = j; } }
  for (const ty of ['keydown', 'keyup']) addEventListener(ty, onKey, true);
  for (const ty of ['pointerdown', 'pointerup', 'touchstart', 'touchend']) addEventListener(ty, onBtn, true);
  function upload(win) {
    if (!tape || tape.length < 20) return;
    const body = JSON.stringify({ kind: 'xinmo', name: name(), weapon: m.weapon, win, lvl, dt: .05, cols: COLS, rows: tape, keys, hits, touch: typeof IS_TOUCH !== 'undefined' && IS_TOUCH ? 1 : 0, snap: P }); tape = null;
    const KQ = 'wzb-xinmo-upq', q = (() => { try { return JSON.parse(localStorage.getItem(KQ) || '[]'); } catch (e) { return []; } })(); q.push(body);
    const send = () => { const left = []; let chain = Promise.resolve();
      for (const b of q.slice(-5)) chain = chain.then(() => fetch('/api/xinmo', { method: 'POST', headers: { 'content-type': 'application/json' }, body: b }).then(r => { if (!r.ok) left.push(b); }).catch(() => left.push(b)));
      chain.then(() => { try { localStorage.setItem(KQ, JSON.stringify(left.slice(-5))); } catch (e) {} }); };
    try { localStorage.setItem(KQ, JSON.stringify(q.slice(-5))); } catch (e) {}
    send();   // 上传失败（比如测试网址没有后端）先存本机，下次打完一起补传，最多留 5 局
  }
  const MODES = { punish: '反打', charge: '蓄力', attack: '主动出手', challenge: '迎击', halberd: '回马突', feint: '骗招', approach: '突进', neutral: '拉距离', backoff: '后撤', chase: '追翻滚', shoot: '远程射击', keep: '远程拉距离', roll: '翻滚', recover: '收招' };
  function newL() { return { time: {}, dmg: {}, byC: {}, fights: 0 }; }
  function curMode() { return m.st === 'charge' ? 'charge' : m.st === 'roll' ? 'roll' : m.st === 'atk' ? (m.atkMode || 'attack') : (m.mode || 'neutral'); }
  function risk(k) {   // 这种情形的挨打率 ÷ 平均挨打率（>1 = 比平时更容易挨打）
    if (!L) return 1; let td = 0, tt = 0; for (const x in L.time) { tt += L.time[x]; td += L.dmg[x] || 0; }
    const base = (td + 1) / (tt + 8), mine = ((L.dmg[k] || 0) + .2) / ((L.time[k] || 0) + 1.5);
    return Math.max(.5, Math.min(4, mine / base));
  }
  function heroMoveKey() { return charging ? 'charge' : hero.atk ? 'c' + hero.atk.c : hero.halberdDash ? 'charge' : 'other'; }
  function topC() { if (!L) return null; let best = null, v = 0, tot = 0; for (const k in L.byC) { tot += L.byC[k]; if (L.byC[k] > v) { v = L.byC[k]; best = k; } } return tot >= 3 && v / tot > .3 ? best : null; }
  function learnHit(n) { if (!L) return; const k = curMode(); L.dmg[k] = (L.dmg[k] || 0) + n; const c = heroMoveKey(); L.byC[c] = (L.byC[c] || 0) + n; lastHits.push({ k, c, n }); if (lastHits.length > 4) lastHits.shift(); }
  // ---------- 战斗前 1:1 快照（用户定）：开打那一刻把你的属性复制给心魔，之后各用各的 ----------
  let P = null;
  function snap() {
    const g = window.GEAR && GEAR.statCard ? GEAR.statCard() : { crit: .01, critDmg: 1.5, dodge: 0, reduce: 0 };
    const mx = (k, d) => window.MERIDIAN && MERIDIAN.x ? MERIDIAN.x(k, d) : d, r = (k, d = 1) => typeof R_ === 'function' ? R_(k, d) : d;
    return {
      hp: maxHeroHp(), atk: window.GEAR && GEAR.attackScale ? GEAR.attackScale(m) : 1, crit: g.crit, critDmg: g.critDmg, dodge: g.dodge, reduce: g.reduce,
      take: r('take'), move: r('move'), aspd: r('aspd'), daze: r('daze'),
      roll: mx('roll', 1), getup: mx('getup', 1), knock: mx('knock', 1), unyield: mx('unyield', 0), zhenguan: mx('zhenguan', 0),
      gate: typeof chargeGateMs === 'function' ? chargeGateMs() / 1000 : .4, full: typeof chargeMaxMs === 'function' ? chargeMaxMs() / 1000 : 1.6,
      rollInv: (typeof IS_TOUCH !== 'undefined' && IS_TOUCH) ? .45 : .4, touch: (typeof IS_TOUCH !== 'undefined' && IS_TOUCH) ? .8 : 1,
    };
  }
  function OUT(o) { o = o || {};   // 出手倍率 × 暴击（快照里的暴击率/暴伤；大刀终段必暴、半月斩按档位概率，上限 200%）
    const crit = o.guaranteed || Math.random() < (o.chance != null ? o.chance : P.crit);
    const c = crit ? Math.min(o.cap || 2.5, P.critDmg) : 1;
    if (c > 1) floaters.push({ x: hero.x, y: hero.y - 34, t: 0, txt: '暴击！', big: true });
    return P.atk * c * (hero.dazeT > 0 ? 1.5 : 1);   // 被晕的目标吃 1.5 倍（和敌人被晕一样）
  }
  // 眩晕（用户定：只在心魔战）：和玩家打敌人同样的概率与时长；已经晕着的不续
  function dazeHero(chance, time) { if (hero.hp > 0 && !(hero.dazeT > 0) && Math.random() < chance) { hero.dazeT = time; floaters.push({ x: hero.x, y: hero.y - 44, t: 0, txt: '晕！' }); } }
  function hitH(n, kind, dz) { const hp0 = hero.hp; dmgHero(n, m, kind); if (dz && hero.hp < hp0) dazeHero(dz[0], dz[1]); }
  const DZ = () => 1.5 * P.daze;
  const MV = () => P.move;
  const AS = () => P.aspd / (W().aspd || 1);
  const MX = (k, d) => P && P[k] != null ? P[k] : d;
  // 玩家打心魔：和心魔打玩家完全对称——同样的减伤、0.7 秒受击无敌、重击击倒、经脉不屈
  function takeHit(z, dmg, dir, dz, basic) {
    if (z !== m || m.dead) return;
    // 流血等持续伤害、撕开/溅射等附加伤害：只扣血，不硬直、不给无敌、不晕（和你身上的裂伤一样）
    if (dz === 'extra') { m.hp -= dmg; if (m.hp <= 0) { if (!m.unyield && MX('unyield', 0)) { m.unyield = true; m.hp = 1; } else { m.dead = 1; kills++; m.st = 'bounce'; m.t = 0; } } return; }
    if (m.inv > 0) return;
    if (basic && Math.random() < P.dodge) { floaters.push({ x: m.x, y: m.y - 28, t: 0, txt: '闪避' }); return; }   // 装备闪避：和你一样只对普通攻击
    let n = (m.dazeT > 0 ? 1.5 : 1) * dmg * P.take * (1 - P.reduce);
    const raw = n;   // 和玩家一样：击倒按手机减伤前的伤害判定
    n *= P.touch;
    if (n <= 0) return;
    learnHit(n); m.hp -= n; m.inv = .7; m.flash = .1; sfx('hurt', m.x); shake = Math.max(shake, .12);
    floaters.push({ x: m.x, y: m.y - 34, t: 0, txt: (Math.round(n * 10) / 10).toString() });
    if (m.hp <= 0 && !m.unyield && MX('unyield', 0)) { m.unyield = true; m.hp = 1; floaters.push({ x: m.x, y: m.y - 46, t: 0, txt: '不屈！', big: true }); }
    m.atk = null; m.ch = 0; m.plan = null; m.lock = false; m.dash = null; m.hurtN = (m.hurtN || 0) + 1; m.lastHurtT = gameT;
    if (m.hp <= 0) { m.dead = 1; kills++; m.st = 'bounce'; m.t = 0; return; }
    if (MX('zhenguan', 0) && ++m.zg >= 5) { m.zg = 0; shake = Math.max(shake, .35); if (Math.hypot(hero.x - m.x, (hero.y - m.y) * 2) < 70) { dmgHero(.5, m, 'skill'); hero.vx = (Math.sign(hero.x - m.x) || 1) * 140; } m.hp = Math.min(m.T.hp, m.hp + 1); floaters.push({ x: m.x, y: m.y - 50, t: 0, txt: '镇关！+1', big: true, color: '#e2b23c' }); }   // 经脉·镇关
    if (raw >= 2 * MX('knock', 1)) { launch(m, dir * 85, 120); m.inv = 9; }   // 重击：和玩家一样被打飞 → 落地 → 起身（全程无敌）
    else { m.st = 'hurt'; m.t = 0; m.vx = dir * 40; }
    if (dz && dz[0] > 0 && !(m.dazeT > 0) && Math.random() < dz[0]) { m.dazeT = dz[1]; floaters.push({ x: m.x, y: m.y - 44, t: 0, txt: '晕！' }); }   // 你打晕心魔，和心魔打晕你一样
  }
  const reachOf = () => { const w = W(); return w.class === 'ranged' ? 150 : (w.reach || 28) + 8; };
  function snapshot() {
    hist.push({ t: gameT, x: hero.x, y: hero.y, st: hero.st, f: hero.f, fi: hero.atk ? hero.atk.fi : -1, c: hero.atk ? hero.atk.c : -1, inv: hero.inv, charging: !!charging, aid: hero.atk || null, at: hero.atk ? hero.atk.t : 0, ht: hero.t, hw: weapon });
    while (hist.length && gameT - hist[0].t > 1) hist.shift();
  }
  function seen() {   // 反应延迟：0.08 秒，玩家每赢一次快 2 毫秒，最快 0.06 秒
    const delay = .06 - lvl * .0015;   // 用户：都太弱了 → 反应 0.08→0.06 秒
    for (let i = hist.length - 1; i >= 0; i--) if (gameT - hist[i].t >= delay) return hist[i];
    return hist[0];
  }
  // ---------- 记录玩家习惯 ----------
  function record(dt) {
    const h = rec.h, st = hero.st;
    if (st !== rec.lastSt) {
      if (st === 'roll') {
        const rel = Math.abs(hero.rx || 0) > Math.abs(hero.ry || 0) ? (Math.sign(hero.rx) === Math.sign(m.x - hero.x) ? 'fwd' : 'back') : ((hero.ry || 0) < 0 ? 'up' : 'down');
        h.roll[rel]++;
        if (gameT - rec.hurtAt < .9) h.hurtRoll[0]++;
      }
      if ((st === 'hurt' || st === 'bounce') && rec.lastSt !== 'hurt' && rec.lastSt !== 'bounce') { rec.hurtAt = gameT; h.hurtRoll[1]++; }
      if (st === 'idle' && (rec.lastSt === 'getup' || rec.lastSt === 'hurt')) { rec.wake = gameT; h.attackOnWake[1]++; }
      if (st === 'atk' && gameT - rec.wake < .6) h.attackOnWake[0]++;
      if (rec.lastSt === 'atk' && st !== 'atk') { h.combo[0] += (rec.combo || 0) + 1; h.combo[1]++; rec.combo = 0; }
      rec.lastSt = st;
    }
    if (st === 'atk' && hero.atk) rec.combo = Math.max(rec.combo || 0, hero.atk.c);
    if (charging && !rec.ch) { rec.ch = true; h.charge[0]++; } if (!charging) rec.ch = false;
    if (st === 'atk' && hero.atk && hero.atk.c === 0 && hero.atk.fi === 0 && hero.atk.t < dt * 1.5) h.charge[1]++;
    if (st !== 'atk') { h.dist[0] += Math.abs(hero.x - m.x) * dt; h.dist[1] += dt; }
    if (hero.hp < maxHeroHp() * .4) { h.lowRetreat[1] += dt; if (Math.sign(hero.x - (prev ? prev.x : hero.x)) === Math.sign(hero.x - m.x) && Math.abs(hero.x - (prev ? prev.x : hero.x)) > .3) h.lowRetreat[0] += dt; }
    prev = { x: hero.x };
  }
  // 预测：玩家被打后最常往哪滚
  function favRoll() {
    const r = model && model.roll; if (!r) return null;
    let best = null, n = 0, tot = 0; for (const k in r) { tot += r[k]; if (r[k] > n) { n = r[k]; best = k; } }
    return tot >= 4 && n / tot > .4 ? best : null;
  }
  // ---------- 心魔动作 ----------
  function startAtk(c) {
    if (c === 0) m.atkMode = m.mode || 'attack';
    m.st = 'atk'; m.t = 0; m.atk = { c, fi: 0, t: 0, lg: 0 }; m.q = 0; m.f = Math.sign(hero.x - m.x) || m.f;
  }
  function roll(dx, dy) {
    const l = Math.hypot(dx, dy) || 1; m.rx = dx / l; m.ry = dy / l; m.st = 'roll'; m.t = 0; m.inv = P.rollInv; m.rollCd = .75; m.atk = null; m.q = 0;
    if (Math.abs(m.rx) > .1) m.f = Math.sign(m.rx);
    sfx('roll', m.x);
  }
  function strike() {
    const w = W(), C = w.combo[m.atk.c], fin = m.atk.c === w.combo.length - 1, f = m.f;
    if (w.proj) {   // 远程：和玩家 strike() 一样的弹道、数量、速度、射程和特效
      sfx('swing_stone', m.x);
      const K = OUT(), base = { x: m.x + f * 16, y: m.y, z: 22, life: C.life || .8, traveled: 0 };
      if (m.weapon === 'bow' && fin) {   // 连珠箭：3~5 支 ±8° 小扇形，每支 0.5
        const n = 3 + Math.floor(Math.random() * 3), spread = 8 * Math.PI / 180;
        bowFx.push({ kind: 'volley', x: m.x + f * 20, y: m.y - 22, t: 0, T: .2, dir: f });
        for (let i = 0; i < n; i++) { const a = (i - (n - 1) / 2) * (spread * 2 / (n - 1)); mshots.push({ ...base, vx: f * C.spd * Math.cos(a), vy: C.spd * Math.sin(a) * .5, kind: 'arrow', volley: true, final: true, dmg: .5 * K }); }
        return;
      }
      mshots.push({ ...base, vx: f * C.spd, kind: m.weapon === 'bow' ? 'arrow' : 'stone', final: fin, dmg: (C.dmg || 1) * K, dz: C.dazeChance ? [C.dazeChance, C.dazeTime] : null });
      if (m.weapon === 'stone' && fin) for (const a of [-.20944, .20944]) mshots.push({ ...base, vx: f * C.spd * Math.cos(a), vy: C.spd * Math.sin(a) * .5, kind: 'stone', dmg: C.dmg * .3 * K });
      return;
    }
    sfx('swing', m.x);
    if (fin && m.weapon === 'hammer') hammerFx.push({ kind: 'spin', x: m.x, y: m.y, t: 0, T: .3, size: 70 });   // 终段特效和玩家一样
    if (fin && m.weapon === 'blade') bladeFx.push({ kind: 'slash', x: m.x + f * 30, y: m.y - 16, t: 0, T: .24, dir: f });
    const dx = hero.x - m.x, reach = (w.reach || 28) + 6;
    if ((C.multi || Math.sign(dx) === f) && Math.abs(dx) < reach && Math.abs(hero.y - m.y) < (w.dy || 14) + 1) {
      if (m.weapon === 'halberd') {   // 长戟裂伤：和玩家一样每下 +1 层（最多 5），终段撕开 = 层数 × 0.3
        hb.n = Math.min(5, hb.n + 1); hb.t = 3;
        const K = OUT(); let d = (C.dmg || 1) * K;
        if (fin) { d += hb.n * .3 * K; hb.n = 0; bleedFx.push({ kind: 'rip', x: hero.x, y: hero.y - 12, t: 0, T: .2 }); }
        bleedFx.push({ kind: 'splash', x: hero.x, y: hero.y - 12, t: 0, T: .15 });
        hitH(d, fin ? 'skill' : 'basic', C.daze ? [C.daze, DZ()] : null);
      }
      else hitH((C.dmg || 1) * OUT(fin && m.weapon === 'blade' ? { guaranteed: true, cap: 2 } : null), fin ? 'skill' : 'basic', C.daze ? [C.daze, DZ()] : null);   // 大刀终段必暴击（上限 200%）、棍的晕，和玩家一样
      if (fin && m.weapon === 'blade' && hero.hp > 0 && hero.hp < maxHeroHp() * .15) { hero.hp = 0; floaters.push({ x: hero.x, y: hero.y - 40, t: 0, txt: '斩！', big: true, gold: true }); if (!hero.air) launch(hero, f * 48, 145); }   // 和玩家一致：先砍，剩血低于 15% 直接斩
      sfx('hit_' + (w.snd || 'staff'), hero.x);
      if (fin && C.knock && hero.st !== 'roll') hero.vx = f * 60;
      m.hitC++;
    }
  }
  function moveTo(tx, ty, dt, sp = 1) {
    const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy);
    if (d < 3) { if (m.st === 'walk') { m.st = 'idle'; m.t = 0; } return; }
    if (m.st !== 'walk') { m.st = 'walk'; m.t = 0; }
    const sx = 70 * sp * MV(), sy = 52 * sp * MV();
    moveEnt(m, dx / d * Math.min(sx * dt, Math.abs(dx)), dy / d * Math.min(sy * dt, Math.abs(dy)));
    m.f = Math.abs(hero.x - m.x) > 4 ? Math.sign(hero.x - m.x) : m.f;
  }
  function threatened(s) {   // 玩家「已经开始」出招：前摇、在够得着的距离、朝着心魔
    const w = WEAP[weapon]; if (!w) return false;
    const adx = Math.abs(s.x - m.x), ady = Math.abs(s.y - m.y);
    if (s.st === 'atk' && s.fi === 0 && Math.sign(m.x - s.x) === s.f) {
      if (w.proj) return ady < 14;
      return adx < (w.reach || 28) + (w.lunge ? 26 : 14) && ady < (w.dy || 14) + 6;
    }
    return false;
  }
  function shotIncoming() {
    return shots.some(s => Math.sign(s.vx) === Math.sign(m.x - s.x) && Math.abs(s.x - m.x) < 90 && Math.abs(s.y - m.y) < 14);
  }
  // ---------- 蓄力（和玩家同一套规则：0.4 秒起蓄，近战 1.6 秒 / 远程 1.2 秒蓄满，三档）----------
  const fullT = () => P.full;   // 快照：你的蓄满时间（含装备/经脉）
  const tierOf = t => { const g = P.gate; return t >= fullT() ? 3 : t >= fullT() / 2 ? 2 : t >= g ? 1 : 0; };
  function startCharge(target) { m.st = 'charge'; m.t = 0; m.ch = 0; m.chTarget = Math.max(.42, Math.min(fullT(), target)); m.atk = null; sfx('charge', m.x); }
  function release() {
    const w = W(), tier = tierOf(m.ch), power = Math.min(1, m.ch / fullT()), f = m.f = Math.sign(hero.x - m.x) || m.f;
    m.st = 'atk'; m.t = 0; m.atk = { c: w.combo.length - 1, fi: 0, t: 0, lg: 0, visual: true }; m.ch = 0;
    sfx('finisher', m.x); shake = Math.max(shake, .12 + .18 * power);
    chargeFx.push({ x: m.x, y: m.y, t: 0, T: .45, w: m.weapon, f, power, tier });   // 蓄力重击的冲击特效和玩家共用
    const dxh = (hero.x - m.x) * f, dyh = hero.y - m.y, K = OUT();   // 心魔伤害 = 玩家同一招 × 玩家的出手倍率
    if (m.weapon === 'bow') {
      if ((m.ammo ?? 5) < 1) return; m.ammo = (m.ammo ?? 5) - 1;
      const d = tier === 3 ? { r: 45, dmg: 2.4 } : tier === 2 ? { r: 36, dmg: 1.9 } : { r: 28, dmg: 1.4 };
      const data = tier === 3 ? { radius: 45, dmg: 2.4 * K, stun: 1 } : tier === 2 ? { radius: 36, dmg: 1.9 * K, stun: .8 } : { radius: 28, dmg: 1.4 * K, stun: .6 };
      const near = Math.abs(hero.x - m.x) <= 250 && Math.sign(hero.x - m.x) === f;   // 和玩家一样：前方 250 内瞄人，否则落在前方 150
      bowFx.push({ kind: 'sky', x: near ? hero.x : m.x + f * 150, y: near ? hero.y : m.y, t: 0, T: .6, dir: f, data, resolved: false, mirror: true }); return;
    }
    if (m.weapon === 'stone') {
      const d = tier === 3 ? { n: 5, dmg: 1.6, ch: 1, tm: 1 } : tier === 2 ? { n: 4, dmg: 1.2, ch: .7, tm: .8 } : { n: 3, dmg: .8, ch: .4, tm: .6 };
      for (let i = 0; i < d.n; i++) { const a = (i - (d.n - 1) / 2) * .12; mshots.push({ x: m.x + f * 16, y: m.y, z: 24, vx: f * 310 * Math.cos(a), vy: 310 * Math.sin(a) * .5, life: .8, kind: 'stone', charged: true, dmg: d.dmg * K, dz: [d.ch, d.tm], volleyId: m.volleyN = (m.volleyN || 0) + (i === 0 ? 1 : 0) }); }
      return;
    }
    if (m.weapon === 'halberd') {   // 回马突：往前冲，途中无敌
      const d = tier === 3 ? { dist: 80, dmg: 2.8 } : tier === 2 ? { dist: 60, dmg: 2.2 } : { dist: 40, dmg: 1.6 };
      m.dash = { left: d.dist, dmg: d.dmg * K, hit: false }; m.inv = Math.max(m.inv, d.dist / 260 + .05); return;
    }
    if (m.weapon === 'hammer') {   // 千斤坠
      const d = tier === 3 ? { range: 80, dmg: 3.6, size: 90 } : tier === 2 ? { range: 65, dmg: 2.8, size: 75 } : { range: 50, dmg: 2.0, size: 60 };
      hammerFx.push({ kind: 'slam', x: m.x + f * 30, y: m.y, t: 0, T: .28, size: d.size });
      if (dxh >= -12 && dxh <= d.range && Math.abs(dyh) <= Math.max(24, dxh * .7 + 14)) dmgHero(d.dmg * K, m, 'skill');
      return;
    }
    if (m.weapon === 'blade') {   // 半月斩：前方上下各 45
      const d = tier === 3 ? { dmg: 2.6, c: .8 } : tier === 2 ? { dmg: 2.0, c: .6 } : { dmg: 1.4, c: .4 };
      bladeFx.push({ kind: 'crescent', x: m.x + f * 30, y: m.y - 16, t: 0, T: .3, dir: f });
      if (dxh >= -12 && dxh <= 45 && Math.abs(dyh) <= 45) dmgHero(d.dmg * OUT({ chance: d.c, cap: 2, charged: true }), m, 'skill');
      return;
    }
    // 棍：蓄力横扫
    const force = .35 + .65 * power;
    if (Math.abs(dyh) <= 26 && !(dxh < 0 && Math.abs(dyh) < -dxh * 1.732) && Math.hypot(dxh, dyh) < 64) hitH(1.6 * force * K, 'skill', [.5, DZ()]);
  }
  let marks = [], mshots = [], hb = { n: 0, t: 0 };
  // ---------- 连招链（SmashBot 的 Chain）：一串动作；lock = 不可打断，做完才重新思考 ----------
  function plan(steps, lock = false) { m.plan = steps; m.lock = lock; }
  function runPlan(dt) {
    const p = m.plan && m.plan[0]; if (!p) { m.plan = null; m.lock = false; return false; }
    p.t = (p.t || 0) + dt;
    if (p.k === 'charge') { m.plan.shift(); startCharge(p.time); return true; }
    if (p.k === 'atk') { m.plan.shift(); m.forceN = p.n || 0; startAtk(0); return true; }
    if (p.k === 'roll') { if (m.rollCd > 0) return true; m.plan.shift(); roll(p.dir === 'back' ? -(Math.sign(hero.x - m.x) || 1) : 0, p.dir === 'back' ? (Math.random() - .5) * .6 : (m.y < (M.top + M.bot) / 2 ? 1 : -1)); return true; }
    if (p.k === 'step') { const sd = Math.sign(hero.x - m.x) || 1; moveTo(m.x + sd * p.dx, hero.y, dt, 1); if (p.t >= p.dur) m.plan.shift(); return true; }
    m.plan.shift(); return false;
  }
  function update(z, dt) {
    if (z !== m || ended) return;
    for (const k of marks) { k.t += dt; if (!k.done && k.t >= k.T) { k.done = true; sfx('fireLand', k.x); if (Math.abs(hero.x - k.x) < k.r && Math.abs(hero.y - k.y) < k.r * .6) dmgHero(k.dmg, { x: k.x, y: k.y, source: m }, 'skill'); } }
    marks = marks.filter(k => k.t < k.T + .25);
    for (const p of mshots) {   // 心魔的箭/石子：和玩家同样飞，汉弓按飞行距离 ×1 / 1.15 / 1.3（远射）
      p.x += p.vx * dt; p.y += (p.vy || 0) * dt; p.life -= dt; p.traveled += Math.hypot(p.vx, p.vy || 0) * dt;
      if (p.life > 0 && Math.abs(hero.x - p.x) < 9 && Math.abs(hero.y - p.y) < 9 && heroOpen()) {
        const mult = p.kind === 'arrow' && !p.volley ? bowRangeMult(p.traveled) : 1;
        sfx(p.kind === 'arrow' ? 'hurt' : 'hit_stone', p.x); const hp0 = hero.hp; const vh = p.volleyId && m.vHit === p.volleyId;   // 同一次蓄力打中你：第 2 颗起只吃 30%、不续晕（和玩家一样）
        dmgHero(p.dmg * mult * (vh ? .3 : 1) * (hero.dazeT > 0 ? 1.5 : 1), { x: p.x - p.vx, source: m }); if (hero.hp < hp0 && p.kind === 'arrow' && !p.volley) m.ammo = Math.min(5, (m.ammo ?? 5) + .25);   // 回矢：和玩家一样普通箭射中回 1/4 支
        if (hero.hp < hp0) { if (p.volleyId) m.vHit = p.volleyId; if (p.dz && !vh) dazeHero(p.dz[0], p.dz[1]); } p.life = 0;
      }
    }
    mshots = mshots.filter(p => p.life > 0);
    if (hb.n > 0) { hb.t -= dt; if (hb.t <= 0) hb.n = 0; else if (!over && hero.st !== 'down') hero.hp -= hb.n * .08 * P.atk * dt; }   // 裂伤流血（不打断）
    if (m.weapon === 'bow') { m.ammoT = (m.ammoT || 0) + dt; if (m.ammoT >= 6) { m.ammoT = 0; m.ammo = Math.min(5, (m.ammo ?? 5) + 1); } }
    snapshot(); record(dt);
    m.inv = Math.max(0, m.inv - dt); m.rollCd = Math.max(0, m.rollCd - dt); m.t += dt; m.flash = Math.max(0, (m.flash || 0) - dt);
    m.y = Math.max(M.top, Math.min(M.bot, m.y));
    if (m.dead) return;
    if (over) { if (m.st !== 'idle') { m.st = 'idle'; m.t = 0; } return; }
    if (m.wait > 0) { m.wait -= dt; m.inv = Math.max(m.inv, m.wait); hero.inv = Math.max(hero.inv, m.wait); m.f = Math.sign(hero.x - m.x) || m.f; return; }   // 对照表显示时双方都不能被打
    if (L) { const k = curMode(); L.time[k] = (L.time[k] || 0) + dt; }
    recordRow(dt); joyTick();
    const w = W(), lowHp = m.hp < m.T.hp * .35;
    // 挨打：和玩家完全一样——硬直 0.3 秒；重击倒地 0.3 秒 + 起身（经脉可加快），起身后 0.5 秒无敌
    if (m.air) { airStep(m, dt); return; }
    if (m.st === 'land' || m.st === 'air') { m.st = 'bounce'; m.t = 0; }
    if (m.dazeT > 0) { m.dazeT -= dt; if (m.st !== 'bounce' && m.st !== 'getup') { if (m.st !== 'hurt') { m.st = 'hurt'; m.atk = null; m.ch = 0; m.plan = null; m.lock = false; } m.t = 0; return; } }
    if (m.st === 'hurt') { moveEnt(m, (m.vx || 0) * dt, 0); m.vx = (m.vx || 0) * .85; if (m.t > .3) { m.st = 'idle'; m.t = 0; } return; }
    if (m.st === 'bounce') { moveEnt(m, (m.vx || 0) * dt, 0); m.vx = (m.vx || 0) * .85; if (m.t > .3 && !m.dead) { m.st = 'getup'; m.t = 0; } return; }
    if (m.st === 'getup') { if (m.t > .35 * MX('getup', 1)) { m.st = 'idle'; m.t = 0; m.inv = .5; } return; }
    m.stun = 0; m.daze = 0;
    if (gameT - (m.lastHurtT || 0) > 1.2) m.hurtN = 0;
    if (m.st === 'roll') {
      moveEnt(m, m.rx * 150 * MX('roll', 1) * dt, m.ry * 105 * MX('roll', 1) * dt);
      if (m.t > .4) { m.st = 'idle'; m.t = 0; m.punish = true; }
      return;
    }
    if (m.dash) {   // 回马突冲刺
      const step = Math.min(m.dash.left, 260 * dt); moveEnt(m, m.f * step, 0); m.dash.left -= step;
      if (!m.dash.hit && Math.abs(hero.x - m.x) < 16 && Math.abs(hero.y - m.y) < (w.dy || 14) + 8) { m.dash.hit = true; dmgHero(m.dash.dmg, m, 'skill'); }
      if (m.dash.left <= 0) { m.dash = null; m.st = 'idle'; m.t = 0; }
      return;
    }
    if (m.st === 'charge') {
      m.ch += dt; m.f = Math.sign(hero.x - m.x) || m.f;
      const s0 = seen(), hit0 = willHit(s0, WEAP[s0.hw] || WEAP[weapon]);
      // 蓄力中被威胁：和玩家一样可以翻滚取消
      if (hit0 != null && hit0 < .2 && m.rollCd === 0 && s0.aid !== m.lastAid) { m.lastAid = s0.aid; m.ch = 0; m.plan = null; m.lock = false; roll(-(Math.sign(hero.x - m.x) || 1) * .3, m.y < (M.top + M.bot) / 2 ? 1 : -1); return; }
      const ty = hero.y; if (Math.abs(ty - m.y) > 3) moveEnt(m, 0, Math.sign(ty - m.y) * 52 * .2 * dt);
      if (m.ch >= m.chTarget) release();
      return;
    }
    if (m.st === 'atk') {
      const a = m.atk, C = w.combo[a.c]; a.t += dt; a.lg += dt;
      if (w.lunge && a.lg < w.lungeT && Math.abs(hero.x - m.x) > w.reach * .6) moveEnt(m, m.f * w.lunge * dt, 0);
      if (a.t >= C.d[a.fi] * AS()) {
        a.t = 0; a.fi++;
        if (a.fi === C.f.length - 1) strike();
        if (a.fi >= C.f.length) {
          const next = a.c + 1 < w.combo.length ? a.c + 1 : -1;
          // 连招：打中了、玩家还在范围里、没在翻滚 → 接下一段；否则收手（高手不会打满空招）
          const inRange = Math.abs(hero.x - m.x) < reachOf() + 16 && Math.abs(hero.y - m.y) < (w.dy || 14) + 4;
          if (next >= 0 && !a.visual && ((m.hitC > 0 || w.proj) && inRange && !(risk('attack') > 1.6 && a.c >= 1) && hero.st !== 'roll' && hero.inv < .25 || m.forceN > 0)) { m.hitC = 0; m.forceN = Math.max(0, (m.forceN || 0) - 1); startAtk(next); return; }
          m.atk = null; m.st = 'idle'; m.t = 0; m.hitC = 0;
          m.forceN = 0;
          // 打一套就跑（SmashBot 的 hit-and-run）：终段打完一半概率翻滚撤走，否则后撤半步
          if (a.c === w.combo.length - 1 && !m.plan && m.rollCd === 0 && Math.random() < .5) roll(-(Math.sign(hero.x - m.x) || 1), (Math.random() - .5) * .8);
          else m.backOff = a.c === w.combo.length - 1 ? .35 : .15;
        }
      }
      if (a.fi === 0 && !a.visual) {   // 出手前摇：边转向边往前跟一步（像玩家按着方向键出招）
        m.f = Math.sign(hero.x - m.x) || m.f;
        if (!w.proj && Math.abs(hero.x - m.x) > (w.reach || 28)) moveEnt(m, m.f * 70 * Math.max(.3, w.move || 0) * dt, Math.sign(hero.y - m.y) * 30 * dt);
      }
      return;
    }
    if (m.lock && m.plan && m.plan.length && runPlan(dt)) return;
    // ---------- 思考（参考 SmashBot 的决策顺序：保命 → 防飞行物 → 反打 → 防真会打中的招 → 随机突进 → 拉距离）----------
    const s = seen(), dx = s.x - m.x, dy = s.y - m.y, adx = Math.abs(dx), ady = Math.abs(dy), sd = Math.sign(dx || 1);
    const dodgeP = Math.min(.995, .97 + lvl * .003);
    const heroRolling = hero.st === 'roll' && hero.inv > .05;
    m.shotSeen = Math.max(0, (m.shotSeen || 0) - dt);
    // 1) 飞行物：推算下一小段会不会打中自己，会才躲（SmashBot needsprojectiledefense）
    if (m.rollCd === 0 && !m.shotSeen) {
      for (const p of shots) {
        if (Math.sign(p.vx) !== Math.sign(m.x - p.x)) continue;
        const tt = Math.abs(m.x - p.x) / Math.max(60, Math.abs(p.vx)), py = p.y + (p.vy || 0) * tt;
        if (tt < .22 && Math.abs(py - m.y) < 10) { m.shotSeen = .25; if (Math.random() < dodgeP) { roll(w.class === 'ranged' ? -sd : 0, m.y < (M.top + M.bot) / 2 ? 1 : -1); return; } }
      }
    }
    // 2) 反打（SmashBot Punish.framesleft）：算玩家还要多久才能动，我走过去 + 出手前摇来得及才打
    const hw = WEAP[s.hw] || WEAP[weapon], my0 = w.combo[0].d[0] / (w.aspd || 1);
    const reach = (w.reach || 28) + 4, edge = (hw && !hw.proj ? (hw.reach || 28) + (hw.lunge ? 24 : 8) : reach) + 10;
    const lag = heroLag(s, hw);
    if (s.st === 'roll' && hero.st === 'roll' && w.class !== 'ranged') {   // 追翻滚：跑到你翻滚的落点等你（SmashBot roll_end_position）
      const left = Math.max(0, .4 - hero.t), ex = hero.x + (hero.rx || 0) * 150 * left, ey = hero.y + (hero.ry || 0) * 105 * left;
      if (Math.abs(ex - m.x) > reach - 4 || Math.abs(ey - m.y) > 6) { m.mode = 'chase'; moveTo(Math.max(14, Math.min(706, ex - sd * (reach - 8))), Math.max(M.top, Math.min(M.bot, ey)), dt, 1); return; }
    }
    const walk = w.class === 'ranged' ? 0 : Math.max(0, adx - reach) / 70 + Math.max(0, ady - (w.dy || 14) + 4) / 52;
    const canHit = w.class === 'ranged' ? ady < 9 && adx < 220 && lag > my0 + adx / 300 : true;   // 远程只在箭/石子飞到之前你都动不了时才对齐反打（不和你对射）
    if (lag > 0 && canHit && walk + my0 < lag + .04 - (risk('punish') > 1.5 ? .08 * risk('punish') : 0) && !heroRolling) {
      if (walk > 0) { moveTo(s.x - sd * (reach - 6), s.y, dt, 1); return; }
      // SmashBot：破绽剩多少就蓄多久，正好在你能动之前放出（够蓄一档才蓄）
      const spare = lag - my0 - .05;
      // 学到「反打时蓄力常挨打」→ 要更长的破绽才敢蓄
      if (spare >= .42 * risk('charge') && m.weapon !== 'halberd') { m.mode = 'punish'; startCharge(spare); return; }
      m.mode = 'punish'; m.think = .12 + Math.random() * .1; startAtk(0); return;
    }
    // 3) 防：玩家这一下站着不动会不会打中我（SmashBot Defend.in_range）——会打中才处理
    const hitIn = willHit(s, hw);
    // 学到你哪一段最伤它：你出到它的前一段时就提前退出范围
    { const tc = topC(); if (tc && tc[0] === 'c' && s.st === 'atk' && s.c === +tc.slice(1) - 1 && adx < edge + 6 && !m.backOff) m.backOff = .35; }
    if (hitIn != null && s.aid !== m.lastAid) {
      m.lastAid = s.aid;
      // 来得及走出范围就后撤（省下翻滚），否则翻滚；远程武器直接往后滚拉开
      const needOut = (edge - adx) / 70;
      const cornered = (m.x < 40 && sd > 0) || (m.x > 680 && sd < 0);
      if (w.class !== 'ranged' && !cornered && needOut < hitIn - .02) { m.backOff = Math.max(m.backOff || 0, hitIn + .1); }
      else if (m.rollCd === 0 && (Math.random() < dodgeP || topC() === 'c' + s.c)) {   // 学到「你这一招最伤它」→ 这招必躲
        const room = m.y < (M.top + M.bot) / 2 ? 1 : -1;
        if (w.class === 'ranged') roll(-sd, room * .4); else if (adx < 45 && Math.random() < .5) { roll(sd, (Math.random() - .5) * .4); m.punish = true; }   // 高手招：贴身时从你身边滚过去绕到背后，落地就打
        else roll(-sd * .3, ady > 4 ? -Math.sign(dy) || room : room);
        return;
      }
    }
    if (m.plan && runPlan(dt)) return;
    if (m.backOff > 0) { m.mode = 'backoff'; m.backOff -= dt; moveTo(m.x - sd * 40, m.y, dt, 1); return; }
    m.think -= dt;
    // 远程（用户定）：站远，多用蓄力；你一靠近就翻滚风筝拉开
    if (w.class === 'ranged') {
      const far = m.weapon === 'bow' ? 180 : 130, close = m.weapon === 'bow' ? 120 : 80;
      if (adx < close && m.rollCd === 0 && s.st !== 'roll') {   // 风筝：往远离你、空间大的一边滚
        const back = (m.x < 80 && sd < 0) || (m.x > 640 && sd > 0) ? 0 : -sd;
        m.mode = 'keep'; roll(back, back ? (m.y < (M.top + M.bot) / 2 ? .5 : -.5) : (m.y < (M.top + M.bot) / 2 ? 1 : -1)); return;
      }
      const ammo = m.weapon !== 'bow' || (m.ammo ?? 5) >= 1;
      // 蓄力只在「你冲过来之前蓄得完」时（不然会被你打断）
      const safe = Math.max(0, (adx - 40) / (70 * P.move) - .1), ct = Math.min(fullT(), safe);
      if (m.think <= 0 && ammo && s.st !== 'atk' && ct >= P.gate + .05 && Math.random() < dt * (m.weapon === 'bow' ? 4 : 1.5)) { m.mode = 'shoot'; m.f = sd; startCharge(ct); m.think = .5; return; }
      if (ady < 9 && adx < 230 && adx > close - 20 && !heroRolling && m.think <= 0 && Math.random() < 1 / risk('shoot')) { m.mode = 'shoot'; m.f = sd; startAtk(0); m.think = .15; return; }
      m.mode = 'keep';
      // 远程对远程：平时站在你的弹道外（上下错开 22），出手前那一下才对齐（你的石子/箭上下只有约 9 的判定）
      const lane = m.lane || (m.lane = Math.random() < .5 ? -1 : 1), wantShoot = m.think <= .08;
      let ly = wantShoot ? s.y : s.y + lane * 22; if (ly < M.top + 4 || ly > M.bot - 4) { m.lane = -lane; ly = s.y - lane * 22; }
      moveTo(Math.max(20, Math.min(700, s.x - sd * far)), Math.max(M.top, Math.min(M.bot, ly)), dt);
      return;
    }
    const ready = !heroRolling && hero.inv < my0 + .03 && ady < (w.dy || 14) + 4;
    // 4) 迎击（SmashBot Challenge）：玩家空手走进我的范围 → 我反应比人快，先出手
    if (ready && adx < reach && s.st !== 'atk' && (m.think <= 0 || risk('challenge') < 1.3) && Math.random() < 1 / risk('challenge')) { m.mode = 'challenge'; m.think = .2 + Math.random() * .2; startAtk(0); return; }
    // 长戟：中距离蓄力回马突冲过去，冲完一半概率翻滚撤走（不可打断的连招链）
    if (m.weapon === 'halberd' && !heroRolling && hitIn == null && ady < (w.dy || 14) + 6 && m.rollCd === 0 && Math.random() < dt * 2.5 / Math.sqrt(risk('halberd'))) {
      // 长戟招牌连招（用户定）：拉开 → 蓄力回马突冲过去 → 冲完立刻翻滚撤走（不可打断）
      m.mode = 'halberd';
      // 只在「你走过来之前蓄得完」时蓄：先翻滚拉开，算你追到我要多久，再蓄能蓄的档位（冲刺 40/60/80 + 戟长 40 要够得到你）
      const hr = hw && !hw.proj ? (hw.reach || 28) + (hw.lunge ? 24 : 6) : 40, after = adx + (adx < 70 ? 60 : 0);
      const safe = Math.max(0, (after - hr) / (70 * P.move) - .1), t = Math.min(fullT(), safe), dist = t >= fullT() ? 80 : t >= fullT() / 2 ? 60 : 40;
      if (t < P.gate + .03 || after - 35 * t * P.move > dist + 45) { m.mode = 'neutral'; }   // 你蓄力时也会往前走，算上一半
      else plan(adx < 70 ? [{ k: 'roll', dir: 'back' }, { k: 'charge', time: t }, { k: 'roll', dir: 'back' }] : [{ k: 'charge', time: t }, { k: 'roll', dir: 'back' }], true);
      if (m.plan) { m.think = .6; runPlan(dt); return; }
      m.think = .6; runPlan(dt); return;
    }
    // 骗招：往前踏一小步马上退，引你出手打空，再由「反打」接上
    if (ready && s.st !== 'atk' && adx > reach && adx < edge + 20 && m.think <= 0 && Math.random() < dt * .5 / risk('feint')) { m.mode = 'feint'; plan([{ k: 'step', dx: 30, dur: .14 }, { k: 'step', dx: -40, dur: .22 }]); m.think = .5; runPlan(dt); return; }
    // 5) 随机突进（SmashBot Bait.approach）：平均每 2 秒一次、持续 1 秒；玩家在出招或无敌时不冲
    if (!m.approachT && Math.random() < dt / 2 / risk('approach')) m.approachT = 1;
    if (m.approachT) { m.approachT = Math.max(0, m.approachT - dt); if (s.st === 'atk' || hero.inv > 0) m.approachT = 0; }
    if (m.approachT > 0 && ready) { m.mode = 'approach'; if (adx < reach) { m.approachT = 0; startAtk(0); return; } moveTo(s.x - sd * (reach - 8), s.y, dt, 1); return; }
    // 6) 拉距离（SmashBot KeepDistance）：站在玩家够不着的外缘来回小步晃，玩家出招/无敌时再退 20；偶尔站住不动
    m.mode = 'neutral';
    let buf = edge + (s.st === 'atk' ? 20 : 0) + (hero.inv > 0 ? 20 : 0) + Math.max(0, Math.min(30, (risk('neutral') - 1) * 12));   // 学到「拉距离时常挨打」→ 站远一点
    if (gameT - (m.radT || 0) > 1) { m.radT = gameT; m.radius = Math.random() * 14; if (Math.random() < .12) m.menace = .6 + Math.random() * .6; }
    if (m.menace > 0 && s.st !== 'atk' && adx > edge - 4) { m.menace -= dt; if (m.st !== 'idle') { m.st = 'idle'; m.t = 0; } m.f = sd; return; }
    const sway = Math.abs(Math.sin(gameT * 9)) * (m.radius || 0);   // 只往外晃，不晃进你的攻击范围
    let tx = s.x - sd * (buf + sway), ty = s.y;
    // 被逼到场边退不动：从你身边翻滚过去换边（或上下错开），不在角落挨打
    if ((tx < 30 || tx > 690) && adx < edge + 4) { if (m.rollCd === 0 && s.st !== 'atk') { m.mode = 'neutral'; roll(sd, m.y < (M.top + M.bot) / 2 ? .6 : -.6); m.punish = true; return; } ty = s.y + (m.y < s.y ? -40 : 40); }
    // 对手建模：玩家被打后爱往某个方向滚 → 提前站到那边
    const fav = favRoll();
    if (fav && (s.st === 'hurt' || gameT - rec.hurtAt < .5)) {
      if (fav === 'back') tx = s.x + sd * 55; else if (fav === 'fwd') tx = s.x - sd * 20; else ty = s.y + (fav === 'up' ? -35 : 35);
    }
    moveTo(Math.max(14, Math.min(706, tx)), Math.max(M.top, Math.min(M.bot, ty)), dt);
  }
  // 玩家还要多久才能再动（只看「看得见」的状态：挨打、倒地、终段收招、翻滚尾巴）
  function heroLag(s, hw) {
    if (s.st === 'hurt') return Math.max(0, .3 - s.ht);
    if (s.st === 'bounce') return Math.max(0, .65 - s.ht);
    if (s.st === 'getup') return 0;   // 起身有无敌，不抢
    if (s.st === 'roll') return s.ht > .25 ? Math.max(0, .4 - s.ht) + .05 : 0;
    if (s.st === 'atk' && hw && s.c >= 0) {
      const C = hw.combo[s.c]; if (!C) return 0;
      const last = C.f.length - 1, sc = (typeof R_ === 'function' ? R_('aspd') : 1) / (hw.aspd || 1);
      if (s.fi === last) {
        const left = C.d[last] * sc - s.at;
        // 不是终段：玩家可以马上接下一段，下一段前摇也算进来（但只给一半，接不接看人）
        const nxt = hw.combo[s.c + 1];
        return Math.max(0, left + (nxt ? nxt.d[0] * sc * .5 : .2));
      }
    }
    return 0;
  }
  // 玩家这一下多久后会打中我（不会打中返回 null）
  function willHit(s, hw) {
    if (s.st !== 'atk' || !hw || s.c < 0) return null;
    const C = hw.combo[s.c]; if (!C) return null;
    const last = C.f.length - 1; if (s.fi >= last) return null;
    const sc = (typeof R_ === 'function' ? R_('aspd') : 1) / (hw.aspd || 1);
    let tt = C.d[s.fi] * sc - s.at; for (let i = s.fi + 1; i < last; i++) tt += C.d[i] * sc;
    if (hw.proj) return Math.abs(s.y - m.y) < 12 && Math.sign(m.x - s.x) === s.f ? tt + Math.abs(m.x - s.x) / 300 : null;
    const adx = Math.abs(m.x - s.x), ady = Math.abs(m.y - s.y);
    const extra = (hw.lunge ? hw.lunge * (hw.lungeT || .1) : 0) + 70 * (hw.move || 0) * tt;
    const facing = C.multi || Math.sign(m.x - s.x) === s.f;
    return facing && adx < (hw.reach || 28) + 8 + extra && ady < (hw.dy || 14) + 2 ? Math.max(0, tt) : null;
  }
  function onHurt() { if (m) m.lastHurtT = gameT; }
  // 开打前对照表：左你、右心魔，同一份快照
  function showCard() {
    const old = document.getElementById('xmCard'); if (old) old.remove();
    const rows = [['血量', P.hp.toFixed(1)], ['攻击倍率', '×' + P.atk.toFixed(2)], ['暴击率', Math.round(P.crit * 100) + '%'], ['暴击伤害', Math.round(P.critDmg * 100) + '%'],
      ['闪避', Math.round(P.dodge * 100) + '%'], ['减伤', Math.round(P.reduce * 100) + '%'], ['移速', '×' + P.move.toFixed(2)], ['攻速', '×' + (1 / P.aspd).toFixed(2)],
      ['翻滚', '×' + P.roll.toFixed(2) + ' · 无敌 ' + P.rollInv + 's'], ['起身', '×' + (1 / P.getup).toFixed(2)], ['蓄满', P.full.toFixed(2) + 's'], ['不屈', P.unyield ? '有' : '无'], ['镇关', P.zhenguan ? '有' : '无']];
    const el = document.createElement('div'); el.id = 'xmCard';
    el.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:30;background:#1d1410ee;border:1px solid #8a5ab0;border-radius:8px;padding:10px 14px;color:#ecdcbc;font:13px/1.6 sans-serif;pointer-events:auto;min-width:min(330px,88vw)';
    el.innerHTML = `<div style="text-align:center;color:#e2c4ff;font-weight:700;margin-bottom:4px">心魔 · 1:1 复刻（${WEAP[m.weapon].name} · 白板）</div><table style="width:100%;border-collapse:collapse"><tr style="color:#cdb68b"><th></th><th>你</th><th>心魔</th></tr>${rows.map(([k, v]) => `<tr><td style="color:#a89070">${k}</td><td style="text-align:center">${v}</td><td style="text-align:center;color:#e2c4ff">${v}</td></tr>`).join('')}</table><div style="text-align:center;color:#9b8a6c;font-size:11px;margin-top:4px">点一下关闭 · 3 秒后开打</div>`;
    el.onclick = () => { el.remove(); if (m) m.wait = Math.min(m.wait, .3); };
    document.body.append(el); setTimeout(() => el.remove(), 3000);
  }
  function draw(z) {
    for (const p of mshots) { shadow(p.x, p.y, 3); drawShot(p); }
    if (hb.n > 0) for (let i = 0; i < hb.n; i++) { ctx.fillStyle = '#c0281e'; ctx.fillRect(hero.x - hb.n * 2 + i * 4, hero.y - 44, 3, 3); }
    for (const k of marks) {   // 穿云箭落点预警（和玩家的金圈一样，心魔的是紫色）
      ctx.save(); ctx.globalAlpha = k.done ? Math.max(0, 1 - (k.t - k.T) * 4) : .35 + .3 * Math.sin(k.t * 30) ** 2; ctx.strokeStyle = '#b06aff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(k.x, k.y, k.r, k.r * .45, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    shadow(z.x, z.y, 10);
    if (z.st === 'charge') {   // 蓄力光：和玩家一样按档位 白→黄→橙
      const tr = tierOf(z.ch), p = Math.min(1, z.ch / fullT()), col = tr === 3 ? '#ff9a3d' : tr === 2 ? '#ffd84a' : '#ffffff';
      ctx.save(); ctx.globalAlpha = .18 + .25 * p; ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 6 + 8 * p;
      ctx.beginPath(); ctx.ellipse(z.x, z.y - 16 - 8 * p, 10 + 6 * p, 18 + 18 * p, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    if (z.inv > 0 && z.st !== 'roll' && Math.floor(z.inv * 20) % 2) return;
    // 心魔：和主角同一套动作帧，压暗 + 紫黑描影
    ctx.save(); ctx.filter = 'brightness(.45) saturate(.6) hue-rotate(220deg) drop-shadow(0 0 3px #6a2a9a)';
    const keep = weapon; weapon = z.weapon;
    try { drawChar('hero', heroFrame(z), z.x, z.y - (z.z || 0), z.f < 0, z.dead ? Math.max(0, 1 - (z.deadT || 0)) : 1, z.flash > 0); } finally { weapon = keep; }
    ctx.restore();
    if (z.dead) { z.deadT = (z.deadT || 0) + 1 / 60; return; }
    if (z.dazeT > 0) { const t = performance.now() / 160; ctx.fillStyle = '#ffe36a'; for (let i = 0; i < 3; i++) { const a = t + i * 2.09; ctx.fillRect(z.x + Math.cos(a) * 8 - 1.5, z.y - 50 + Math.sin(a) * 2.5, 3, 3); } }
    const w = 40, y = z.y - 44;
    ctx.fillStyle = '#211510'; ctx.fillRect(z.x - w / 2, y, w, 4);
    ctx.fillStyle = '#8a3ac9'; ctx.fillRect(z.x - w / 2 + 1, y + 1, (w - 2) * Math.max(0, z.hp / z.T.hp), 2);
    ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 2; ctx.strokeStyle = '#1a0d22'; ctx.fillStyle = '#e2c4ff';
    ctx.strokeText('心魔', z.x, y - 3); ctx.fillText('心魔', z.x, y - 3); ctx.textAlign = 'left';
  }
  // ---------- 结算 ----------
  function end(win) {
    if (ended) return null; ended = true;
    const d = data(); d.tries++;
    if (win) {
      d.wins++;
      d.defeats.unshift({ at: Date.now(), w: m && m.weapon, h: rec.h }); d.defeats = d.defeats.slice(0, 20);   // 被战胜的这局：玩家的习惯单独存下，用于强化
      merge(d.habit, rec.h, 2);
    } else merge(d.habit, rec.h, 1);
    if (L) {   // 复盘：本局所有挨打都已计入；被打死的话，最后几下再加重 2 倍记住
      if (win) for (const h of lastHits) { L.dmg[h.k] = (L.dmg[h.k] || 0) + h.n * 2; L.byC[h.c] = (L.byC[h.c] || 0) + h.n * 2; }
      L.fights++; for (const g of ['time', 'dmg', 'byC']) { let t = 0; for (const k in L[g]) t += L[g][k]; if (t > 300) for (const k in L[g]) L[g][k] *= .7; }   // 老经验慢慢淡掉
      d.lessons ||= {}; d.lessons[m.weapon] = L; m.lessonText = lessonText();
    }
    save(d); upload(win);
    say(pick(win ? LINES.win : LINES.lose), 4);
    return d;
  }
  function lessonText() {
    if (!L) return [];
    const out = [], ks = Object.keys(MODES).filter(k => (L.time[k] || 0) > .5 && (L.dmg[k] || 0) > 0).sort((a, b) => risk(b) - risk(a));
    for (const k of ks.slice(0, 2)) if (risk(k) > 1.2) out.push(`它在「${MODES[k]}」时最容易挨打（是平时的 ${risk(k).toFixed(1)} 倍）→ 以后少做`);
    const tc = topC(); if (tc) out.push(`你的${tc === 'charge' ? '蓄力' : tc === 'other' ? '其他招' : '第 ' + (+tc.slice(1) + 1) + ' 段'}打它最疼 → 以后见到就躲、提前退`);
    return out;
  }
  function insight() {   // 「心魔看穿了你」小结：用本局 + 历史习惯
    const all = JSON.parse(JSON.stringify(data().habit || {})); merge(all, rec ? rec.h : H0(), 1);
    const out = [], pct = v => Math.round(v * 100) + '%';
    const hr = rate(all.hurtRoll); if (hr != null) out.push(hr > .6 ? `你被打中后 ${pct(hr)} 会立刻翻滚` : `你被打中后很少马上翻滚（${pct(hr)}）`);
    const r = all.roll; if (r) { const tot = Object.values(r).reduce((a, b) => a + b, 0); if (tot >= 4) { const k = Object.keys(r).sort((a, b) => r[b] - r[a])[0]; out.push(`你翻滚最爱往${{ back: '后', fwd: '前（贴脸）', up: '上', down: '下' }[k]}（${pct(r[k] / tot)}）`); } }
    if (all.combo && all.combo[1] >= 3) { const c = all.combo[0] / all.combo[1]; out.push(c > 2.5 ? `你出手常常打满一整套（平均 ${c.toFixed(1)} 段），收招时最好打` : `你出手一般只打 ${c.toFixed(1)} 段就停`); }
    const ch = rate(all.charge); if (ch != null) out.push(ch > .3 ? `你很爱蓄力（${pct(ch)}）——蓄力时你几乎不动` : '你很少蓄力');
    if (all.dist && all.dist[1] > 3) out.push(`你习惯和对手保持 ${Math.round(all.dist[0] / all.dist[1])} 的距离`);
    const lr = all.lowRetreat && all.lowRetreat[1] > 2 ? all.lowRetreat[0] / all.lowRetreat[1] : null; if (lr != null) out.push(lr > .4 ? '血少时你会一直后退' : '血少时你还敢往前冲');
    const aw = rate(all.attackOnWake); if (aw != null && aw > .5) out.push(`你爬起来第一件事就是出手（${pct(aw)}）`);
    return out.slice(0, 5);
  }
  // 战胜奖励（用户定）：相当校场第3层首领——品质按第3层首领表（普通15/优良40/精致30/极品15），
  // 数量 1～5 把（35/30/20/10/5%），六种武器都可能掉；另给 150 金币
  function reward(z) {
    if (!z) return;
    const r = Math.random(), n = r < .35 ? 1 : r < .65 ? 2 : r < .85 ? 3 : r < .95 ? 4 : 5, all = ['staff', 'hammer', 'stone', 'halberd', 'blade', 'bow'];
    const w3 = window.XIAOCHANG && XIAOCHANG.CONFIG ? XIAOCHANG.CONFIG[1].drops.boss[2] : [15, 40, 30, 15, 0];
    for (let i = 0; i < n; i++) {
      const type = all[Math.floor(Math.random() * all.length)], item = AFFIX_DATA.generate(type, 'boss', '', undefined, w3);
      drops.push({ k: 'weapon', weapon: type, item, x: Math.max(16, Math.min(704, z.x + (i - (n - 1) / 2) * 18)), y: z.y, z: 10, vy: 130, t: 0, life: Infinity, got: 0 });
    }
    if (window.WALLET && WALLET.bonus) WALLET.bonus(150);
  }
  // 开发者面板「心魔记忆」：列出每把武器它学到的东西
  function memory() {
    const d = data(), el = document.getElementById('xmMem') || document.createElement('div'); el.id = 'xmMem';
    el.style.cssText = 'position:fixed;left:8px;top:8px;bottom:8px;width:min(520px,92vw);overflow:auto;z-index:10040;background:#1d140ef4;border:1px solid #8a5ab0;border-radius:8px;padding:10px;font:12px/1.6 sans-serif;color:#ecdcbc';
    const pct = v => Math.round(v * 100) + '%', NAMES = { staff: '棍', hammer: '锤', stone: '石子', halberd: '长戟', blade: '大刀', bow: '汉弓' };
    let h = `<div style="display:flex;justify-content:space-between"><b style="color:#e2c4ff;font-size:15px">心魔记忆（${name()}）</b><span><button data-clr>清空记忆</button> <button data-x>关闭</button></span></div>`;
    h += `<p>挑战 ${d.tries} 次 · 你赢 ${d.wins} 次 · 反应 ${(80 - Math.min(10, d.wins) * 2)} 毫秒</p>`;
    const keep = L; for (const w in (d.lessons || {})) {
      L = d.lessons[w]; const tt = Object.values(L.time).reduce((a, b) => a + b, 0), td = Object.values(L.dmg).reduce((a, b) => a + b, 0);
      h += `<h4 style="color:#f1d58f;margin:8px 0 2px">${NAMES[w] || w} · ${L.fights} 局 · 共待 ${tt.toFixed(0)} 秒、挨 ${td.toFixed(1)} 伤害</h4><table style="width:100%;border-collapse:collapse"><tr style="color:#a89070"><td>情形</td><td>时间</td><td>挨打</td><td>挨打率</td></tr>`;
      for (const k of Object.keys(MODES).filter(k => L.time[k]).sort((a, b) => risk(b) - risk(a))) { const r = risk(k); h += `<tr><td>${MODES[k]}</td><td>${L.time[k].toFixed(1)}s</td><td>${(L.dmg[k] || 0).toFixed(1)}</td><td style="color:${r > 1.2 ? '#e0533a' : r < .8 ? '#8fd16a' : '#ecdcbc'}">${r.toFixed(2)} 倍</td></tr>`; }
      h += '</table>';
      const bc = Object.entries(L.byC).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k === 'charge' ? '蓄力' : k === 'other' ? '其他' : '第' + (+k.slice(1) + 1) + '段'} ${v.toFixed(1)}`).join('、');
      if (bc) h += `<div>你的招打它：${bc}${topC() ? ' → 重点防「' + (topC() === 'charge' ? '蓄力' : topC() === 'other' ? '其他' : '第' + (+topC().slice(1) + 1) + '段') + '」' : ''}</div>`;
      const lt = lessonText(); if (lt.length) h += '<div style="color:#e2c4ff">' + lt.map(t => '· ' + t).join('<br>') + '</div>';
    }
    L = keep;
    const hb2 = d.habit || {}, r2 = p => p && p[1] >= 1 ? pct(p[0] / p[1]) + `（${Math.round(p[1])} 次）` : '数据不够';
    h += `<h4 style="color:#f1d58f;margin:8px 0 2px">你的习惯</h4>被打后马上翻滚 ${r2(hb2.hurtRoll)}<br>翻滚方向 ${hb2.roll ? Object.entries(hb2.roll).map(([k, v]) => ({ back: '后', fwd: '前', up: '上', down: '下' }[k]) + Math.round(v)).join(' / ') : '数据不够'}<br>平均出招段数 ${hb2.combo && hb2.combo[1] ? (hb2.combo[0] / hb2.combo[1]).toFixed(1) : '数据不够'} · 蓄力 ${r2(hb2.charge)} · 起身就出手 ${r2(hb2.attackOnWake)}<br>习惯距离 ${hb2.dist && hb2.dist[1] ? Math.round(hb2.dist[0] / hb2.dist[1]) : '数据不够'}`;
    if (!Object.keys(d.lessons || {}).length) h += '<p style="color:#9b8a6c">还没有复盘记录：打完一局心魔再来看。</p>';
    el.innerHTML = h; document.body.append(el);
    el.querySelector('[data-x]').onclick = () => el.remove();
    el.querySelector('[data-clr]').onclick = () => { const all = readAll(); delete all[name()]; try { localStorage.setItem(KEY, JSON.stringify(all)); } catch (e) {} memory(); };
  }
  return { memory, lessons: () => (m && m.lessonText) || [], takeHit, spawn, update, draw, end, insight, reward, onHurt, stats: () => { const d = data(); return { wins: d.wins, tries: d.tries }; }, level, mirror: () => m, reset: () => { const c = document.getElementById('xmCard'); if (c) c.remove(); m = null; ended = false; } };
})();
