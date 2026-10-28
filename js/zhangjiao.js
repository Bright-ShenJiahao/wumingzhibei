// 第二章战六「祭台决战」：张角。开场 → 阶段一（法台躲雷、打灯）→ 阶段二（召唤）→ 阶段三（下台决斗）
// 白色的雷是张角专属（用户批准的敌人特效例外）。
(() => {
  const ROUND_T = 10, BASE = [3, 4, 4, 5];
  let S = null;   // 本场状态
  const img = k => IMG['zj_' + k];
  const stageY = () => ALTAR_STAGE.y - 4 + Math.sin(performance.now() / 1000 * 2.2) * 2.5;
  const lamps = () => props.filter(p => p.lamp);   // 含已熄灭的（顺序固定）
  const lit = () => props.filter(p => p.lamp && p.g === 'fudeng');
  const rnd2 = (a, b) => a + Math.random() * (b - a);
  function pic(k, x, y, s, a = 1, anchorBottom = false) {
    const im = img(k); if (!im || !im.naturalWidth) return;
    const w = im.naturalWidth * s, h = im.naturalHeight * s;
    ctx.globalAlpha = a; ctx.drawImage(im, Math.round(x - w / 2), Math.round(anchorBottom ? y - h : y - h / 2), Math.round(w), Math.round(h)); ctx.globalAlpha = 1;
  }

  function start() {
    S = { phase: 'open', t: 0, round: -1, rt: 0, queue: [], hz: [], perfect: false, shatterT: -1, lid: null, flash: 0, prevLeft: 0, batchDone: [],
      zjX: 141, zjY: 112, face: 1, summonRound: 0, spawned: [], dueT: 0, boss: null, castT: 0, pose: 'situp', cheerDone: false };
    chapter2Run.mode = 'zj';
    props.forEach((p, i) => { if (p.lamp) p.lit = false; });
    say('祭坛之上，一口黑棺……', 3);
  }

  // ---- 危险物 ----
  function thunderAt(x, y, warn = 1) { S.hz.push({ k: 'thunder', x, y, t: -warn, r: 24 }); }
  function addRound() {
    const r = S.round, set = lamps().slice(r * 2, r * 2 + 2);
    set.forEach(p => { if (p.g === 'fudeng') p.lit = true; });
    const left = lit().length - set.filter(p => p.g === 'fudeng').length;   // 以前没打灭的灯
    const prevCleared = r > 0 && S.batchDone[r - 1] ? 1 : 0;
    const n = Math.max(1, BASE[r] - prevCleared + left);
    S.queue = [];
    const span = ROUND_T - 3;
    for (let i = 0; i < n; i++) S.queue.push({ at: 1 + span * i / n, k: 'thunder' });
    if (r >= 1) for (let i = 0; i < r + 1; i++) S.queue.push({ at: 2 + i * (span / (r + 1)), k: 'fu' });
    if (r >= 2) for (let i = 0; i < r - 1; i++) S.queue.push({ at: 3 + i * 3.4, k: 'fire' });
    S.queue.sort((a, b) => a.at - b.at);
    if (left) say(`还有${left}盏灯亮着，雷更密了！`, 2.5);
    else if (r > 0) say('灯灭了，雷势稍缓。', 2);
  }
  function cast(e) {
    S.castT = .5;
    if (e.k === 'thunder') thunderAt(hero.x + rnd2(-6, 6), hero.y + rnd2(-4, 4), 1.05);
    else if (e.k === 'fu') S.hz.push({ k: 'fu', x: ALTAR_STAGE.x, y: ALTAR_STAGE.y + 10, t: 0, vx: 0, vy: 0, fr: Math.floor(Math.random() * 3) });
    else if (e.k === 'fire') {
      const y = Math.max(M.top + 8, Math.min(M.bot - 6, hero.y)), x0 = arenaL + 20, x1 = lockR - 20, dir = Math.random() < .5 ? 1 : -1;
      const n = Math.floor((x1 - x0) / 30);
      for (let i = 0; i < n; i++) S.hz.push({ k: 'fire', x: dir > 0 ? x0 + i * 30 : x1 - i * 30, y, t: -(.8 + i * .09), r: 14, fr: i % 4 });
    }
  }
  function updateHz(dt) {
    for (const h of S.hz) {
      h.t += dt;
      if (h.k === 'thunder') {
        if (h.t >= 0 && !h.done) {
          h.done = true; shake = Math.max(shake, .3); sfx('crack', h.x); S.flash = .18;
          if (Math.abs(hero.x - h.x) < h.r && Math.abs(hero.y - h.y) < h.r * .5) dmgHero(2, { x: h.x, y: h.y });
        }
        if (h.t > .9) h.dead = true;
      } else if (h.k === 'fu') {
        const dx = hero.x - h.x, dy = hero.y - 14 - h.y, d = Math.hypot(dx, dy) || 1;
        const sp = h.t < 2.8 ? 62 : 90, ax = dx / d * sp, ay = dy / d * sp;
        h.vx += (ax - h.vx) * Math.min(1, dt * 2.2); h.vy += (ay - h.vy) * Math.min(1, dt * 2.2);
        h.x += h.vx * dt; h.y += h.vy * dt;
        if (Math.abs(hero.x - h.x) < 9 && Math.abs(hero.y - 14 - h.y) < 14) { dmgHero(1, { x: h.x, y: h.y }); h.dead = true; sfx('crack', h.x); S.hz.push({ k: 'puff', x: h.x, y: h.y, t: 0 }); }
        if (h.t > 5) h.dead = true;
      } else if (h.k === 'fire') {
        if (h.t > 0 && h.t < .6 && Math.abs(hero.x - h.x) < h.r && Math.abs(hero.y - h.y) < 10) dmgHero(1.5, { x: h.x, y: h.y });
        if (h.t > .7) h.dead = true;
      } else if (h.k === 'puff') { if (h.t > .4) h.dead = true; }
    }
    S.hz = S.hz.filter(h => !h.dead);
  }

  // ---- 阶段流程 ----
  function monsters(round) {
    const gx = ALTAR_STAGE.x, gy = M.top + 6;
    const list = round === 0 ? ['blade', 'yellow-shield', 'yellow-spear', 'priest'] : ['yellow-golem', 'yellow-heavy', 'yellow-spear', 'archer'];
    list.forEach((t, i) => { spawn(t, gx + (i - 1.5) * 26, gy + (i % 2) * 8); const z = zs[zs.length - 1]; z.zjAdd = true; z.st = 'move'; });
    sfx('bladeAlert', gx);
  }
  function descend() {
    S.phase = 'p3'; S.t = 0;
    const x = ALTAR_STAGE.x, y = M.top + 14;
    spawn('zhang_jiao', x, y);
    const z = zs[zs.length - 1]; S.boss = z;
    z.summonedHalf = true; z.f = hero.x < z.x ? -1 : 1; z.cd = 1.2; z.zjTele = 5; z.zjThunder = 5;
    z.st = 'land'; z.t = 0;
    sfx('land', x);
    if (S.perfect) { z.hp -= z.T.hp * .1; z.zjDizzy = 3; floaters.push({ x, y: y - 50, t: 0, txt: '破阵！', big: true }); }
    say('张角：“尔等蝼蚁，也敢逆天！”', 3);
    shake = .4;
  }
  function update(dt) {
    if (!S || !chapter2Run || chapter2Run.battle !== 6) return;
    S.t += dt; S.flash = Math.max(0, S.flash - dt); S.castT = Math.max(0, S.castT - dt);
    updateHz(dt);
    if (S.shatterT >= 0) { S.shatterT += dt; if (S.shatterT > 1.1) { const b = props.find(p => p.g === 'bagua'); if (b) b.broken = true, b.alpha = 0; S.shatterT = -2; } }
    if (S.phase !== 'open' && !S.perfect && S.phase !== 'dead' && lamps().length && !lit().length) {   // 八盏全灭：阵破
      S.perfect = true; S.shatterT = 0; S.flash = .3; shake = .35; sfx('finisher', ALTAR_C.x);
      floaters.push({ x: ALTAR_C.x, y: ALTAR_C.y - 20, t: 0, txt: '八卦阵破！', big: true });
      say('八盏灯全灭，八卦阵破！', 3);
    }
    const t = S.t;
    if (S.phase === 'open') {
      hero.inv = Math.max(hero.inv, .3);
      if (t > .9 && !S.struck) { S.struck = true; S.flash = .5; shake = .5; sfx('crack', 141); S.hz.push({ k: 'thunder', x: 141, y: 120, t: 0, r: 0, done: true }); }
      if (t > 1.3 && !S.lid) { S.lid = { x: 141, y: 98, vx: 70, vy: -150, rot: 0, t: 0 }; const c = props.find(p => p.g === 'coffin'); if (c) { c.g = 'coffin_open'; const m = ASSETS.props.coffin_open; if (m) { c.dw = c.dw; } } sfx('land', 141); }
      if (S.lid) { const l = S.lid; l.t += dt; l.vy += 380 * dt; l.x += l.vx * dt; l.y += l.vy * dt; l.rot += dt * 7; if (l.y > 150) { l.y = 150; l.vx = l.vy = 0; } }
      if (t < 2.2) S.pose = 'situp';
      else if (t < 4.2) { const u = (t - 2.2) / 2; S.pose = 'float'; S.zjX = 141 + (ALTAR_STAGE.x - 141) * u; S.zjY = 108 + (ALTAR_STAGE.y - 4 - 108) * u - Math.sin(u * Math.PI) * 30; }
      else if (!S.shout) { S.shout = true; S.zjX = ALTAR_STAGE.x; S.zjY = ALTAR_STAGE.y - 4; S.pose = 'thunder'; say('张角：“苍天已死，黄天当立！”', 3.2); shake = .3; S.flash = .3; }
      if (t > 5.8) { S.phase = 'p1'; S.t = 0; S.round = 0; S.rt = 0; addRound(); }
      return;
    }
    if (S.phase === 'p1') {
      S.rt += dt;
      while (S.queue.length && S.queue[0].at <= S.rt) cast(S.queue.shift());
      if (S.rt >= ROUND_T) {
        const set = lamps().slice(S.round * 2, S.round * 2 + 2);
        S.batchDone[S.round] = set.every(p => p.g !== 'fudeng');
        if (S.round >= 3) { S.phase = 'p2'; S.t = 0; S.summonRound = 0; S.hz = S.hz.filter(h => h.k === 'thunder' && !h.done); say('张角：“黄巾力士，何在！”', 2.5); S.pose = 'summon'; S.sumT = 1.2; }
        else { S.round++; S.rt = 0; addRound(); }
      }
      S.pose = S.castT > 0 ? 'thunder' : 'float';
      return;
    }
    if (S.phase === 'p2') {
      if (S.sumT > 0) { S.sumT -= dt; if (S.sumT <= 0) { monsters(S.summonRound); S.pose = 'float'; S.next = 0; } return; }
      S.pose = 'float';
      const alive = zs.some(z => !z.dead && z.zjAdd);
      S.next = (S.next || 0) + dt;
      if (S.next > 6) { S.next = 0; thunderAt(hero.x, hero.y, 1.1); S.pose = 'thunder'; }
      if (!alive && S.t > 2) {
        if (S.summonRound === 0) { S.summonRound = 1; S.sumT = 1.2; S.pose = 'summon'; S.t = 0; say('张角：“再来！”', 2); }
        else descend();
      }
      return;
    }
    if (S.phase === 'p3') {
      const z = S.boss;
      if (z && z.dead && S.phase !== 'dead') {
        S.phase = 'dead'; S.t = 0; S.hz = []; zs.forEach(e => { if (e.zjAdd) e.hp = 0; });
        say('张角：“……苍天……”', 4); shake = .5;
        if (window.CHAPTER2 && CHAPTER2.completeBattle) CHAPTER2.completeBattle(6);
      }
      return;
    }
    if (S.phase === 'dead' && S.t > 2 && !S.fin) { S.fin = true; chapter2Run.mode = 'complete'; say('张角已死，黄巾大势已去。（结算待接入）', 6); }
  }

  // ---- 决斗中的张角：传送、单雷、半血狂暴 ----
  function duel(z, dt) {
    if (z.zjDizzy > 0) { z.zjDizzy -= dt; z.t += dt; return true; }
    if (z.st === 'tele') {
      z.t += dt;
      if (z.t > .3 && !z.teleDone) { z.teleDone = true; z.x = Math.max(arenaL + 24, Math.min(lockR - 24, hero.x - hero.f * 38)); z.y = Math.max(M.top + 6, Math.min(M.bot - 4, hero.y)); z.f = Math.sign(hero.x - z.x) || z.f; S.hz.push({ k: 'puff', x: z.x, y: z.y - 20, t: 0 }); }
      if (z.t > .6) { z.st = 'move'; z.t = 0; z.cd = .3; z.teleDone = false; }
      return true;
    }
    if (z.st === 'move' || z.st === 'idle') {
      z.zjTele -= dt; z.zjThunder -= dt;
      if (!z.rage && z.hp < z.T.hp * .5) {
        z.rage = true; z.T = { ...z.T, spd: z.T.spd * 1.3, wind: z.T.wind * .8 };
        say('张角：“天雷，降！”', 2.5); for (let i = 0; i < 3; i++) thunderAt(hero.x + (i - 1) * 40, hero.y + rnd2(-8, 8), 1.1 + i * .25);
      }
      if (z.zjThunder <= 0) { z.zjThunder = z.rage ? 4 : 6.5; thunderAt(hero.x, hero.y, 1); z.st = 'rec'; z.t = 0; return true; }
      if (z.zjTele <= 0 && Math.abs(hero.x - z.x) > 50) { z.zjTele = 7; z.st = 'tele'; z.t = 0; z.teleDone = false; return true; }
    }
    return false;
  }

  // ---- 绘制 ----
  function draw() {
    if (!S) return;
    // 八卦阵破碎动画
    if (S.shatterT >= 0 && S.shatterT < 1.1) {
      const k = S.shatterT < .3 ? 'bagua1' : S.shatterT < .6 ? 'bagua2' : 'bagua3';
      const b = props.find(p => p.g === 'bagua'); if (b) b.alpha = 0;
      pic(k, 353, 252, 2.0, 1 - S.shatterT / 1.2);
    }
    // 当前亮灯：金色光圈 + 卦字
    for (const p of lit()) if (p.lit) {
      const pulse = .5 + .5 * Math.sin(performance.now() / 180);
      ctx.strokeStyle = `rgba(255,220,110,${.5 + .4 * pulse})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(p.x, p.y, 11 + pulse * 2, 5 + pulse, 0, 0, 7); ctx.stroke();
      const hp3 = Math.max(0, p.hp);
      ctx.fillStyle = '#ffe9a0'; for (let i = 0; i < hp3; i++) ctx.fillRect(p.x - 5 + i * 4, p.y - 28, 3, 3);
    }
    // 地面预警
    for (const h of S.hz) {
      if (h.k === 'thunder' && h.t < 0) {
        const u = 1 + h.t, r = h.r;
        pic('ring', h.x, h.y, (r * 2 / 179) * (1.3 - u * .3), .45 + .5 * u);
      } else if (h.k === 'fire') {
        if (h.t < 0) { ctx.fillStyle = 'rgba(160,50,25,.35)'; ctx.beginPath(); ctx.ellipse(h.x, h.y, 10, 4, 0, 0, 7); ctx.fill(); }
        else pic('fire' + (1 + (h.fr + Math.floor(h.t * 10)) % 4), h.x, h.y + 4, .32, 1 - h.t / .8, true);
      } else if (h.k === 'thunder' && h.t >= 0) pic('scorch', h.x, h.y, .3, Math.max(0, 1 - h.t / .9));
    }
    // 棺盖
    if (S.lid) {
      const m = ASSETS.props.coffin_lid, im = IMG.p_coffin_lid;
      if (m && im && im.naturalWidth) { ctx.save(); ctx.translate(S.lid.x, S.lid.y); ctx.rotate(S.lid.rot * (S.lid.vx ? 1 : 0)); const w = (m[1] || 40) * .6, h = (m[2] || 20) * .6; ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore(); }
    }
    // 张角（开场 / 法台上）
    if (S.phase === 'open' || S.phase === 'p1' || S.phase === 'p2') {
      const open = S.phase === 'open';
      const x = open ? S.zjX : ALTAR_STAGE.x, y = open ? S.zjY : stageY();
      if (!open || S.t > 2) {
        const sc = open && S.pose === 'situp' ? 1.12 / ZJ_HI : 1.12 / ZJ_HI;
        drawChar('zhang_jiao', S.pose, x, y, hero.x < x, 1, false, sc);
      } else drawChar('zhang_jiao', 'lie', 141, 110, false, 1, false, 1.12 / ZJ_HI);
    }
    // 追踪符
    for (const h of S.hz) {
      if (h.k === 'fu') pic('fu' + (1 + (h.fr + Math.floor(h.t * 8)) % 3), h.x, h.y, .28);
      if (h.k === 'puff') pic('smoke1', h.x, h.y, .3, 1 - h.t / .4);
    }
    // 落雷
    for (const h of S.hz) if (h.k === 'thunder' && h.t >= 0 && h.t < .35) {
      pic('bolt', h.x, h.y + 4, .75, 1 - h.t / .35, true);
      if (h.r) pic('strike', h.x, h.y, .3, 1 - h.t / .35);
    }
    if (S.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(.55, S.flash * 2.2)})`; ctx.fillRect(cam.x, 0, viewW() + 4, 600); }
  }

  window.ZJ = { start, update, draw, duel, state: () => S };
})();
