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
    Object.assign(m, { type: 'xinmo', sprite: 'hero', st: 'idle', t: 0, f: hero.x < m.x ? -1 : 1, cd: 1.2, rollCd: 0, inv: 0, atk: null, q: 0, think: 0, hitC: 0, sc: 1 });
    // 血量：按主角伤害来定，玩家大约要打中 22～26 下（心魔打中玩家大约 6～8 下），各自承受得住几轮连招
    m.T = { name: '心魔', mirror: true, hp: 0, spd: 70, w: 16, noLaunch: true, xinmoHp: hp };
    m.T.hp = Math.round(estHit(w) * 24); m.hp = m.T.hp; m.weapon = w;
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
  const reachOf = () => { const w = W(); return w.class === 'ranged' ? 150 : (w.reach || 28) + 8; };
  function snapshot() {
    hist.push({ t: gameT, x: hero.x, y: hero.y, st: hero.st, f: hero.f, fi: hero.atk ? hero.atk.fi : -1, c: hero.atk ? hero.atk.c : -1, inv: hero.inv, charging: !!charging, aid: hero.atk || null });
    while (hist.length && gameT - hist[0].t > 1) hist.shift();
  }
  function seen() {   // 反应延迟：0.09 秒，玩家每赢一次快 3 毫秒，最快 0.06 秒
    const delay = .09 - lvl * .003;
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
    const l = Math.hypot(dx, dy) || 1; m.rx = dx / l; m.ry = dy / l; m.st = 'roll'; m.t = 0; m.inv = .4; m.rollCd = .75; m.atk = null; m.q = 0;
    if (Math.abs(m.rx) > .1) m.f = Math.sign(m.rx);
    sfx('roll', m.x);
  }
  function strike() {
    const w = W(), C = w.combo[m.atk.c], fin = m.atk.c === w.combo.length - 1, f = m.f;
    if (w.proj) {
      sfx('swing_stone', m.x);
      const dmg = (C.dmg || 1) * .75;
      if (m.weapon === 'bow') {
        const n = fin ? 3 : 1;
        for (let i = 0; i < n; i++) eshots.push({ source: m, k: 'arrow', x: m.x + f * 16, y: m.y + (i - (n - 1) / 2) * 7, z: 22, vx: f * 300, life: 1, dmg: fin ? .6 : dmg });
      } else eshots.push({ source: m, k: 'stone', x: m.x + f * 16, y: m.y, z: 24, vx: f * 230, life: .85, dmg });
      return;
    }
    sfx('swing', m.x);
    const dx = hero.x - m.x, reach = (w.reach || 28) + 6;
    if ((C.multi || Math.sign(dx) === f) && Math.abs(dx) < reach && Math.abs(hero.y - m.y) < (w.dy || 14) + 1) {
      dmgHero((C.dmg || 1) * (fin ? .85 : .7), m, fin ? 'skill' : 'basic');
      if (fin && C.knock && hero.st !== 'roll') hero.vx = f * 60;
      m.hitC++;
    }
  }
  function moveTo(tx, ty, dt, sp = 1) {
    const dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy);
    if (d < 3) { if (m.st === 'walk') { m.st = 'idle'; m.t = 0; } return; }
    if (m.st !== 'walk') { m.st = 'walk'; m.t = 0; }
    const sx = 70 * sp, sy = 52 * sp;
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
  function update(z, dt) {
    if (z !== m || ended) return;
    snapshot(); record(dt);
    m.inv = Math.max(0, m.inv - dt); m.rollCd = Math.max(0, m.rollCd - dt); m.t += dt; m.flash = Math.max(0, (m.flash || 0) - dt);
    m.y = Math.max(M.top, Math.min(M.bot, m.y));
    if (m.dead) return;
    if (over) { if (m.st !== 'idle') { m.st = 'idle'; m.t = 0; } return; }
    const w = W(), lowHp = m.hp < m.T.hp * .35;
    // 挨打：和玩家一样会硬直；但被连续压着打时（0.15 秒后）会翻滚破招——玩家赢得越多，破招越果断
    if (m.stun > 0 || m.daze > 0) {
      m.stun = Math.max(0, (m.stun || 0) - dt); m.daze = Math.max(0, (m.daze || 0) - dt);
      if (m.st !== 'hurt') { m.st = 'hurt'; m.t = 0; m.atk = null; m.q = 0; m.hurtN = (m.hurtN || 0) + 1; m.lastHurtT = gameT; }
      moveEnt(m, (m.vx || 0) * dt, 0); m.vx = (m.vx || 0) * .85;
      if (m.t > .15 && m.rollCd === 0 && m.hurtN >= 2 && Math.random() < .5 + lvl * .05) { m.stun = 0; m.daze = 0; m.hurtN = 0; roll(Math.sign(m.x - hero.x) || 1, m.y < (M.top + M.bot) / 2 ? 1 : -1); }
      return;
    }
    if (m.st === 'hurt') { m.st = 'idle'; m.t = 0; }
    if (gameT - (m.lastHurtT || 0) > 1.2) m.hurtN = 0;
    if (m.st === 'roll') {
      moveEnt(m, m.rx * 150 * dt, m.ry * 105 * dt);
      if (m.t > .4) { m.st = 'idle'; m.t = 0; m.punish = true; }
      return;
    }
    if (m.st === 'atk') {
      const a = m.atk, C = w.combo[a.c]; a.t += dt; a.lg += dt;
      if (w.lunge && a.lg < w.lungeT && Math.abs(hero.x - m.x) > w.reach * .6) moveEnt(m, m.f * w.lunge * dt, 0);
      if (a.t >= C.d[a.fi] / (w.aspd || 1)) {
        a.t = 0; a.fi++;
        if (a.fi === C.f.length - 1) strike();
        if (a.fi >= C.f.length) {
          const next = a.c + 1 < w.combo.length ? a.c + 1 : -1;
          // 连招：打中了、玩家还在范围里、没在翻滚 → 接下一段；否则收手（高手不会打满空招）
          const inRange = Math.abs(hero.x - m.x) < reachOf() + 16 && Math.abs(hero.y - m.y) < (w.dy || 14) + 4;
          if (next >= 0 && (m.hitC > 0 || w.proj) && inRange && hero.st !== 'roll' && hero.inv < .25) { m.hitC = 0; startAtk(next); return; }
          m.atk = null; m.st = 'idle'; m.t = 0; m.hitC = 0;
          m.backOff = a.c === w.combo.length - 1 ? .35 : .15;   // 打完一轮后撤半步，不给玩家反打
        }
      }
      if (a.fi === 0) {   // 出手前摇：边转向边往前跟一步（像玩家按着方向键出招）
        m.f = Math.sign(hero.x - m.x) || m.f;
        if (!w.proj && Math.abs(hero.x - m.x) > (w.reach || 28)) moveEnt(m, m.f * 70 * Math.max(.3, w.move || 0) * dt, Math.sign(hero.y - m.y) * 30 * dt);
      }
      return;
    }
    // ---------- 思考（基于延迟后的观察）----------
    const s = seen(), dx = s.x - m.x, dy = s.y - m.y, adx = Math.abs(dx), ady = Math.abs(dy);
    const dodgeP = Math.min(.97, .82 + lvl * .015) * (lowHp ? 1.05 : 1);
    // 每一下出招只判断一次躲不躲（高手也有失手的时候）
    const th = threatened(s) && s.aid !== m.lastAid, sh = shotIncoming() && !m.shotSeen;
    if (th) m.lastAid = s.aid; if (sh) m.shotSeen = .3; m.shotSeen = Math.max(0, (m.shotSeen || 0) - dt) || 0;
    if (m.rollCd === 0 && (th || sh) && Math.random() < dodgeP) {
      // 躲：近战往上下滚（躲开后正好在玩家身侧），远程武器往后滚拉开
      const room = m.y < (M.top + M.bot) / 2 ? 1 : -1;
      if (w.class === 'ranged' || shotIncoming()) roll(w.class === 'ranged' ? -Math.sign(dx) || 1 : 0, room);
      else roll(-Math.sign(dx) * .35, ady > 4 ? -Math.sign(dy) || room : room);
      return;
    }
    if (m.backOff > 0) { m.backOff -= dt; moveTo(m.x - Math.sign(dx) * 40, m.y, dt, .9); return; }
    m.think -= dt;
    const heroOpen = s.st === 'hurt' || s.st === 'bounce' || s.st === 'getup' || (s.st === 'atk' && s.fi >= 1) || (s.st === 'roll' && gameT - s.t > 0 && hero.st === 'roll' && hero.t > .3);
    const heroRolling = hero.st === 'roll' && hero.inv > .12;
    if (w.class === 'ranged') {
      // 远程：保持 110～160 距离、对齐上下就射；玩家冲脸就后滚
      if (adx < 55 && m.rollCd === 0 && Math.random() < .4) { roll(-Math.sign(dx) || 1, 0); return; }
      const want = 135, tx = s.x - Math.sign(dx || 1) * want;
      if (ady < 10 && adx < 200 && adx > 40 && !heroRolling && m.think <= 0) { m.f = Math.sign(dx) || m.f; startAtk(0); m.think = .05; return; }
      moveTo(Math.max(20, Math.min(700, tx)), s.y, dt);
      return;
    }
    const reach = (w.reach || 28) + 4, edge = reach + 12, sd = Math.sign(dx || 1);
    const ready = !heroRolling && hero.inv < w.combo[0].d[0] + .03 && ady < (w.dy || 14) + 6;
    // 1) 破绽：玩家收招/挨打/翻滚落地 → 踏进去打（出手前摇里会往前跟一步）
    if (ready && (heroOpen || m.punish) && adx < edge + 6) { m.punish = false; m.think = .35 + Math.random() * .3; startAtk(0); return; }
    m.punish = false;
    // 2) 已经贴在够得着的距离、玩家没在出手 → 抢先出手
    if (ready && adx < reach && s.st !== 'atk' && m.think <= 0) { m.think = .3 + Math.random() * .3; startAtk(0); return; }
    // 3) 中立：站在玩家够不着的边缘（等他打空），时不时突然踏进去抢攻
    if (ready && adx < edge + 4 && s.st !== 'atk' && m.think <= 0 && Math.random() < .5) { m.think = .45 + Math.random() * .4; startAtk(0); return; }
    if (m.think <= 0) m.think = .25 + Math.random() * .3;
    let tx = s.x - sd * edge, ty = s.y;
    if (s.st === 'atk' && !heroOpen) tx = s.x - sd * (edge + 6);
    // 对手建模：玩家被打后爱往某个方向滚 → 提前站到那边
    const fav = favRoll();
    if (fav && (s.st === 'hurt' || gameT - rec.hurtAt < .5)) {
      const dir = Math.sign(s.x - m.x) || 1;
      if (fav === 'back') tx = s.x + dir * 55; else if (fav === 'fwd') tx = s.x - dir * 20; else ty = s.y + (fav === 'up' ? -35 : 35);
    }
    if (lowHp && s.st === 'atk') tx = s.x - sd * (edge + 24);
    moveTo(Math.max(14, Math.min(706, tx)), Math.max(M.top, Math.min(M.bot, ty)), dt);
  }
  function onHurt() { if (m) m.lastHurtT = gameT; }
  function draw(z) {
    shadow(z.x, z.y, 10);
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
  return { spawn, update, draw, end, insight, reward, onHurt, stats: () => { const d = data(); return { wins: d.wins, tries: d.tries }; }, level, mirror: () => m, reset: () => { m = null; ended = false; } };
})();
