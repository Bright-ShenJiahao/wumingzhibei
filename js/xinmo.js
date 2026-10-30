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
    marks = []; mshots = []; hb = { n: 0, t: 0 }; Object.assign(m, { ammo: 5, plan: null, lock: false, ch: 0, dash: null, type: 'xinmo', sprite: 'hero', st: 'idle', t: 0, f: hero.x < m.x ? -1 : 1, cd: 1.2, rollCd: 0, inv: 0, atk: null, q: 0, think: 0, hitC: 0, sc: 1 });
    // 血量：按主角伤害来定，玩家大约要打中 30 下（心魔打中玩家大约 6～8 下），各自承受得住几轮连招
    m.T = { name: '心魔', mirror: true, hp: 0, spd: 70, w: 16, noLaunch: true, xinmoHp: hp };
    m.T.hp = maxHeroHp(); m.hp = m.T.hp; m.weapon = w;   // 血量 = 你的血量
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
  function OUT() { let k = window.GEAR && GEAR.attackScale ? GEAR.attackScale(m) : 1; const tk = window.GEAR && GEAR.attackToken ? GEAR.attackToken() : null; if (tk && tk.crit) k *= 1.5; return k; }
  const MV = () => (typeof R_ === 'function' ? R_('move') : 1);
  const AS = () => (typeof R_ === 'function' ? R_('aspd') : 1) / (W().aspd || 1);
  const MX = (k, d) => window.MERIDIAN && MERIDIAN.x ? MERIDIAN.x(k, d) : d;
  // 玩家打心魔：和心魔打玩家完全对称——同样的减伤、0.7 秒受击无敌、重击击倒、经脉不屈
  function takeHit(z, dmg, dir) {
    if (z !== m || m.dead || m.inv > 0) return;
    let n = dmg * (typeof R_ === 'function' ? R_('take') : 1);
    if (window.GEAR && GEAR.incoming) n = GEAR.incoming(n, null, 'skill');
    if (typeof IS_TOUCH !== 'undefined' && IS_TOUCH) n *= .8;
    const raw = n; if (n <= 0) return;
    m.hp -= n; m.inv = .7; m.flash = .1; sfx('hurt', m.x); shake = Math.max(shake, .12);
    floaters.push({ x: m.x, y: m.y - 34, t: 0, txt: (Math.round(n * 10) / 10).toString() });
    if (m.hp <= 0 && !m.unyield && MX('unyield', 0)) { m.unyield = true; m.hp = 1; floaters.push({ x: m.x, y: m.y - 46, t: 0, txt: '不屈！', big: true }); }
    m.atk = null; m.ch = 0; m.plan = null; m.lock = false; m.dash = null; m.hurtN = (m.hurtN || 0) + 1; m.lastHurtT = gameT;
    if (m.hp <= 0) { m.dead = 1; kills++; m.st = 'bounce'; m.t = 0; return; }
    if (raw >= 2 * MX('knock', 1)) { m.st = 'bounce'; m.t = 0; m.vx = dir * 85; }   // 重击：和玩家一样倒地 → 起身
    else { m.st = 'hurt'; m.t = 0; m.vx = dir * 40; }
  }
  const reachOf = () => { const w = W(); return w.class === 'ranged' ? 150 : (w.reach || 28) + 8; };
  function snapshot() {
    hist.push({ t: gameT, x: hero.x, y: hero.y, st: hero.st, f: hero.f, fi: hero.atk ? hero.atk.fi : -1, c: hero.atk ? hero.atk.c : -1, inv: hero.inv, charging: !!charging, aid: hero.atk || null, at: hero.atk ? hero.atk.t : 0, ht: hero.t, hw: weapon });
    while (hist.length && gameT - hist[0].t > 1) hist.shift();
  }
  function seen() {   // 反应延迟：0.08 秒，玩家每赢一次快 2 毫秒，最快 0.06 秒
    const delay = .08 - lvl * .002;
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
    m.st = 'atk'; m.t = 0; m.atk = { c, fi: 0, t: 0, lg: 0 }; m.q = 0; m.f = Math.sign(hero.x - m.x) || m.f;
  }
  function roll(dx, dy) {
    const l = Math.hypot(dx, dy) || 1; m.rx = dx / l; m.ry = dy / l; m.st = 'roll'; m.t = 0; m.inv = (typeof IS_TOUCH !== 'undefined' && IS_TOUCH) ? .45 : .4; m.rollCd = .75; m.atk = null; m.q = 0;
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
      mshots.push({ ...base, vx: f * C.spd, kind: m.weapon === 'bow' ? 'arrow' : 'stone', final: fin, dmg: (C.dmg || 1) * K });
      if (m.weapon === 'stone' && fin) for (const a of [-.20944, .20944]) mshots.push({ ...base, vx: f * C.spd * Math.cos(a), vy: C.spd * Math.sin(a) * .5, kind: 'stone', dmg: C.dmg * .3 * K });
      return;
    }
    sfx('swing', m.x);
    if (fin && m.weapon === 'hammer') hammerFx.push({ kind: 'spin', x: m.x, y: m.y, t: 0, T: .3, size: 70 });   // 终段特效和玩家一样
    if (fin && m.weapon === 'blade') bladeFx.push({ kind: 'slash', x: m.x + f * 30, y: m.y - 16, t: 0, T: .24, dir: f });
    const dx = hero.x - m.x, reach = (w.reach || 28) + 6;
    if ((C.multi || Math.sign(dx) === f) && Math.abs(dx) < reach && Math.abs(hero.y - m.y) < (w.dy || 14) + 1) {
      if (fin && m.weapon === 'blade' && hero.hp < maxHeroHp() * .15 && hero.inv <= 0 && hero.st !== 'roll') { dmgHero(hero.hp + 99, m, 'skill'); floaters.push({ x: hero.x, y: hero.y - 40, t: 0, txt: '斩！', big: true, gold: true }); }   // 和玩家一致：低于 15% 被举刀重劈斩杀
      else if (m.weapon === 'halberd') {   // 长戟裂伤：和玩家一样每下 +1 层（最多 5），终段撕开 = 层数 × 0.3
        hb.n = Math.min(5, hb.n + 1); hb.t = 3;
        const K = OUT(); let d = (C.dmg || 1) * K;
        if (fin) { d += hb.n * .3 * K; hb.n = 0; bleedFx.push({ kind: 'rip', x: hero.x, y: hero.y - 12, t: 0, T: .2 }); }
        bleedFx.push({ kind: 'splash', x: hero.x, y: hero.y - 12, t: 0, T: .15 });
        dmgHero(d, m, fin ? 'skill' : 'basic');
      }
      else dmgHero((C.dmg || 1) * OUT() * (fin && m.weapon === 'blade' ? 1.5 : 1), m, fin ? 'skill' : 'basic');   // 大刀终段必暴击，和玩家一样
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
  const fullT = () => typeof chargeMaxMs === 'function' ? chargeMaxMs() / 1000 : (W().class === 'ranged' ? 1.2 : 1.6);   // 和玩家同一个蓄满时间（含装备/经脉）
  const tierOf = t => { const g = typeof chargeGateMs === 'function' ? chargeGateMs() / 1000 : .4; return t >= fullT() ? 3 : t >= fullT() / 2 ? 2 : t >= g ? 1 : 0; };
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
      const d = tier === 3 ? { n: 5, dmg: 1.6 } : tier === 2 ? { n: 4, dmg: 1.2 } : { n: 3, dmg: .8 };
      for (let i = 0; i < d.n; i++) { const a = (i - (d.n - 1) / 2) * .12; mshots.push({ x: m.x + f * 16, y: m.y, z: 24, vx: f * 310 * Math.cos(a), vy: 310 * Math.sin(a) * .5, life: .8, kind: 'stone', charged: true, dmg: d.dmg * K }); }
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
      if (dxh >= -12 && dxh <= 45 && Math.abs(dyh) <= 45) dmgHero(d.dmg * K * (Math.random() < d.c ? 1.5 : 1), m, 'skill');
      return;
    }
    // 棍：蓄力横扫
    const force = .35 + .65 * power;
    if (Math.abs(dyh) <= 26 && !(dxh < 0 && Math.abs(dyh) < -dxh * 1.732) && Math.hypot(dxh, dyh) < 64) dmgHero(1.6 * force * K, m, 'skill');
  }
  let marks = [], mshots = [], hb = { n: 0, t: 0 };
  // ---------- 连招链（SmashBot 的 Chain）：一串动作；lock = 不可打断，做完才重新思考 ----------
  function plan(steps, lock = false) { m.plan = steps; m.lock = lock; }
  function runPlan(dt) {
    const p = m.plan && m.plan[0]; if (!p) { m.plan = null; m.lock = false; return false; }
    p.t = (p.t || 0) + dt;
    if (p.k === 'charge') { m.plan.shift(); startCharge(p.time); return true; }
    if (p.k === 'atk') { m.plan.shift(); m.forceN = p.n || 0; startAtk(0); return true; }
    if (p.k === 'roll') { m.plan.shift(); if (m.rollCd === 0) roll(p.dir === 'back' ? -(Math.sign(hero.x - m.x) || 1) : 0, p.dir === 'back' ? (Math.random() - .5) * .6 : (m.y < (M.top + M.bot) / 2 ? 1 : -1)); return true; }
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
        sfx(p.kind === 'arrow' ? 'hurt' : 'hit_stone', p.x); dmgHero(p.dmg * mult, { x: p.x - p.vx, source: m }); p.life = 0;
      }
    }
    mshots = mshots.filter(p => p.life > 0);
    if (hb.n > 0) { hb.t -= dt; if (hb.t <= 0) hb.n = 0; else if (!over && hero.st !== 'down') hero.hp -= hb.n * .08 * OUT() * dt; }   // 裂伤流血（不打断）
    if (m.weapon === 'bow') { m.ammoT = (m.ammoT || 0) + dt; if (m.ammoT >= 6) { m.ammoT = 0; m.ammo = Math.min(5, (m.ammo ?? 5) + 1); } }
    snapshot(); record(dt);
    m.inv = Math.max(0, m.inv - dt); m.rollCd = Math.max(0, m.rollCd - dt); m.t += dt; m.flash = Math.max(0, (m.flash || 0) - dt);
    m.y = Math.max(M.top, Math.min(M.bot, m.y));
    if (m.dead) return;
    if (over) { if (m.st !== 'idle') { m.st = 'idle'; m.t = 0; } return; }
    const w = W(), lowHp = m.hp < m.T.hp * .35;
    // 挨打：和玩家完全一样——硬直 0.3 秒；重击倒地 0.3 秒 + 起身（经脉可加快），起身后 0.5 秒无敌
    if (m.air) { airStep(m, dt); return; }
    if (m.st === 'land' || m.st === 'air') { m.st = 'bounce'; m.t = 0; }
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
          if (next >= 0 && !a.visual && ((m.hitC > 0 || w.proj) && inRange && hero.st !== 'roll' && hero.inv < .25 || m.forceN > 0)) { m.hitC = 0; m.forceN = Math.max(0, (m.forceN || 0) - 1); startAtk(next); return; }
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
    const dodgeP = Math.min(.99, .93 + lvl * .006);
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
      if (Math.abs(ex - m.x) > reach - 4 || Math.abs(ey - m.y) > 6) { moveTo(Math.max(14, Math.min(706, ex - sd * (reach - 8))), Math.max(M.top, Math.min(M.bot, ey)), dt, 1); return; }
    }
    const walk = w.class === 'ranged' ? 0 : Math.max(0, adx - reach) / 70 + Math.max(0, ady - (w.dy || 14) + 4) / 52;
    const canHit = w.class === 'ranged' ? ady < 9 && adx < 220 : true;
    if (lag > 0 && canHit && walk + my0 < lag + .04 && !heroRolling) {
      if (walk > 0) { moveTo(s.x - sd * (reach - 6), s.y, dt, 1); return; }
      // SmashBot：破绽剩多少就蓄多久，正好在你能动之前放出（够蓄一档才蓄）
      const spare = lag - my0 - .05;
      if (spare >= .42 && m.weapon !== 'halberd') { startCharge(spare); return; }
      m.think = .25 + Math.random() * .2; startAtk(0); return;
    }
    // 3) 防：玩家这一下站着不动会不会打中我（SmashBot Defend.in_range）——会打中才处理
    const hitIn = willHit(s, hw);
    if (hitIn != null && s.aid !== m.lastAid) {
      m.lastAid = s.aid;
      // 来得及走出范围就后撤（省下翻滚），否则翻滚；远程武器直接往后滚拉开
      const needOut = (edge - adx) / 70;
      if (w.class !== 'ranged' && needOut < hitIn - .02) { m.backOff = Math.max(m.backOff || 0, hitIn + .1); }
      else if (m.rollCd === 0 && Math.random() < dodgeP) {
        const room = m.y < (M.top + M.bot) / 2 ? 1 : -1;
        if (w.class === 'ranged') roll(-sd, room * .4); else roll(-sd * .3, ady > 4 ? -Math.sign(dy) || room : room);
        return;
      }
    }
    if (m.plan && runPlan(dt)) return;
    if (m.backOff > 0) { m.backOff -= dt; moveTo(m.x - sd * 40, m.y, dt, 1); return; }
    m.think -= dt;
    // 远程：保持距离、对齐就射；被贴脸先滚开
    if (w.class === 'ranged') {
      if (adx < 50 && m.rollCd === 0) { roll(-sd, 0); return; }
      // 远处、你没在出招：蓄满放（汉弓穿云箭从天落下 / 石子散射）
      if (m.think <= 0 && s.st !== 'atk' && adx > (m.weapon === 'bow' ? 140 : 90) && Math.random() < dt * (m.weapon === 'bow' && (m.ammo ?? 5) > 0 ? .9 : m.weapon === 'stone' ? .6 : 0)) { m.f = sd; startCharge(m.weapon === 'bow' ? 1.2 : .6 + Math.random() * .6); m.think = .6; return; }
      if (ady < 9 && adx < 210 && adx > 45 && !heroRolling && m.think <= 0) { m.f = sd; startAtk(0); m.think = .08; return; }
      moveTo(Math.max(20, Math.min(700, s.x - sd * 140)), s.y, dt);
      return;
    }
    const ready = !heroRolling && hero.inv < my0 + .03 && ady < (w.dy || 14) + 4;
    // 4) 迎击（SmashBot Challenge）：玩家空手走进我的范围 → 我反应比人快，先出手
    if (ready && adx < reach && s.st !== 'atk') { m.think = .2 + Math.random() * .2; startAtk(0); return; }
    // 长戟：中距离蓄力回马突冲过去，冲完一半概率翻滚撤走（不可打断的连招链）
    if (m.weapon === 'halberd' && !heroRolling && ady < (w.dy || 14) + 4 && s.st !== 'atk' && adx > 50 && adx < 125 && Math.random() < dt * 3) {
      const need = adx - 30, t = need <= 40 ? .45 : need <= 60 ? .85 : 1.6;
      plan(Math.random() < .5 ? [{ k: 'charge', time: t }, { k: 'roll', dir: 'back' }] : [{ k: 'charge', time: t }, { k: 'atk', n: 1 }], true); m.think = .8; runPlan(dt); return;
    }
    // 骗招：往前踏一小步马上退，引你出手打空，再由「反打」接上
    if (ready && s.st !== 'atk' && adx > reach && adx < edge + 20 && m.think <= 0 && Math.random() < dt * .5) { plan([{ k: 'step', dx: 30, dur: .14 }, { k: 'step', dx: -40, dur: .22 }]); m.think = .5; runPlan(dt); return; }
    // 5) 随机突进（SmashBot Bait.approach）：平均每 2 秒一次、持续 1 秒；玩家在出招或无敌时不冲
    if (!m.approachT && Math.random() < dt / 2) m.approachT = 1;
    if (m.approachT) { m.approachT = Math.max(0, m.approachT - dt); if (s.st === 'atk' || hero.inv > 0) m.approachT = 0; }
    if (m.approachT > 0 && ready) { if (adx < reach) { m.approachT = 0; startAtk(0); return; } moveTo(s.x - sd * (reach - 8), s.y, dt, 1); return; }
    // 6) 拉距离（SmashBot KeepDistance）：站在玩家够不着的外缘来回小步晃，玩家出招/无敌时再退 20；偶尔站住不动
    let buf = edge + (s.st === 'atk' ? 20 : 0) + (hero.inv > 0 ? 20 : 0);
    if (gameT - (m.radT || 0) > 1) { m.radT = gameT; m.radius = Math.random() * 14; if (Math.random() < .12) m.menace = .6 + Math.random() * .6; }
    if (m.menace > 0 && s.st !== 'atk' && adx > edge - 4) { m.menace -= dt; if (m.st !== 'idle') { m.st = 'idle'; m.t = 0; } m.f = sd; return; }
    const sway = Math.sin(gameT * 9) * (m.radius || 0);
    let tx = s.x - sd * (buf + sway), ty = s.y;
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
    save(d);
    say(pick(win ? LINES.win : LINES.lose), 4);
    return d;
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
  function reward(z) {   // 战胜必掉：极品武器（同类型）+ 金币
    if (!z) return;
    const type = z.weapon, item = AFFIX_DATA.generate(type, 'boss', '', 3);
    drops.push({ k: 'weapon', weapon: type, item, x: z.x, y: z.y, z: 10, vy: 130, t: 0, life: Infinity, got: 0 });
    if (window.WALLET && WALLET.bonus) WALLET.bonus(500);
  }
  return { takeHit, spawn, update, draw, end, insight, reward, onHurt, stats: () => { const d = data(); return { wins: d.wins, tries: d.tries }; }, level, mirror: () => m, reset: () => { m = null; ended = false; } };
})();
