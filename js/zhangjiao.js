// 第二章战六「祭台决战」：张角。开场 → 阶段一（法台躲雷、打灯）→ 阶段二（召唤）→ 阶段三（下台决斗）
// 白色的雷是张角专属（用户批准的敌人特效例外）。
(() => {
  const ROUND_T = 10, BASE = [3, 4, 4, 5];
  let S = null;   // 本场状态
  const img = k => IMG['zj_' + k];
  const stageY = () => ALTAR_STAGE.y - 4 + Math.sin(performance.now() / 1000 * 2.2) * 2.5;
  const lamps = () => props.filter(p => p.lamp);   // 含已熄灭的（顺序固定）
  const GUA = ['乾', '兑', '离', '震', '坤', '艮', '坎', '巽'];   // 先天八卦顺时针，对面两盏互为一对
  const BATCH = [[0, 4], [2, 6], [1, 5], [3, 7]];   // 乾坤、离坎、兑艮、震巽：每轮亮对面的两盏
  const batch = r => BATCH[r].map(i => lamps()[i]).filter(Boolean);
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
    const r = S.round, set = batch(r);
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
    else if (e.k === 'fu') S.hz.push({ k: 'fu', x: e.x ?? ALTAR_STAGE.x, y: e.y ?? ALTAR_STAGE.y + 10, t: 0, vx: 0, vy: 0, fr: Math.floor(Math.random() * 3) });
    else if (e.k === 'fire') {   // 地火预判：砸在主角正在打的那盏灯周围（没有亮灯就砸主角所在行）
      const ls = lit().filter(p => p.lit).sort((p, q) => Math.hypot(p.x - hero.x, p.y - hero.y) - Math.hypot(q.x - hero.x, q.y - hero.y));
      const tx = ls[0] ? ls[0].x : hero.x, ty = ls[0] ? ls[0].y : hero.y;
      const y = Math.max(M.top + 8, Math.min(M.bot - 6, ty));
      const add = (x, yy, d) => { if (x < arenaL + 10 || x > lockR - 10 || yy < M.top || yy > M.bot) return; S.hz.push({ k: 'fire', x, y: yy, t: -d, r: 16, fr: Math.floor(Math.random() * 4) }); };
      // 一整排横火：从目标灯向两边烧开
      for (let x = arenaL + 14; x <= lockR - 14; x += 26) add(x, y, 1 + Math.abs(x - tx) / 420);
      // 张角到这盏灯的连线：从施法者一路烧过来
      const ox = e.ox ?? ALTAR_STAGE.x, oy = Math.max(M.top + 4, e.oy ?? M.top + 4), L = Math.hypot(tx - ox, y - oy), n = Math.floor(L / 24);
      for (let i = 1; i < n; i++) add(ox + (tx - ox) * i / n, oy + (y - oy) * i / n, .9 + i * .06);
    }
  }
  // 黄巾力士：跺地震波（暗橙预警圈，1.5 秒后炸开）
  function golems(dt) {
    for (const z of zs) {
      if (z.type !== 'yellow-golem' || z.dead || z.air) continue;
      z.slamCd = (z.slamCd ?? 2.5) - dt;
      const d = Math.hypot(hero.x - z.x, (hero.y - z.y) * 2);
      if (z.slamCd <= 0 && d < 90 && (z.st === 'move' || z.st === 'idle') && !(z.stun > 0)) {
        z.slamCd = 6; z.f = Math.sign(hero.x - z.x) || z.f; z.st = 'wind'; z.t = -.5;   // 比普通出手多蓄 0.5 秒
        S.hz.push({ k: 'slam', x: z.x + z.f * 24, y: z.y, t: -1.5, r: 42, src: z });
        floaters.push({ x: z.x, y: z.y - 60, t: 0, txt: '喝！' });
      }
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
        if (h.t > 0 && h.t < .6 && Math.abs(hero.x - h.x) < h.r && Math.abs(hero.y - h.y) < 11) dmgHero(1.5, { x: h.x, y: h.y });
        if (h.t > .7) h.dead = true;
      } else if (h.k === 'slam') {
        if (h.src && (h.src.dead || h.src.stun > 0) && h.t < 0) { h.dead = true; continue; }   // 被打断就不炸
        if (h.t >= 0 && !h.done) { h.done = true; shake = Math.max(shake, .35); sfx('land', h.x);
          if (Math.abs(hero.x - h.x) < h.r && Math.abs(hero.y - h.y) < h.r * .45) dmgHero(3, { x: h.x, y: h.y }); }
        if (h.t > .45) h.dead = true;
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
    z.summonedHalf = true; z.f = hero.x < z.x ? -1 : 1; z.cd = 1.2; z.zjTele = 4; z.zjThunder = 3; z.zjFire = 8; z.zjFu = 4;
    z.st = 'move'; z.t = 0; z.jump = { t: 0, h0: y - ALTAR_STAGE.y };   // 从法台飞身跳下
    say('张角：“尔等蝼蚁，也敢逆天！”', 3);
  }
  function update(dt) {
    if (!S || !chapter2Run || chapter2Run.battle !== 6) return;
    S.t += dt; S.flash = Math.max(0, S.flash - dt); S.castT = Math.max(0, S.castT - dt);
    golems(dt); updateHz(dt);
    // 打灭灯：没轮到的灯被打灭 = 乱了阵序，立刻多降两道雷，破阵也不再掉血
    if (S.phase !== 'open') for (const p of lamps()) if (p.g !== 'fudeng' && !p.zjSeen) {
      p.zjSeen = true;
      if (!p.lit && S.phase === 'p1') { S.outOfOrder = true; thunderAt(hero.x, hero.y, .8); thunderAt(hero.x + rnd2(-30, 30), hero.y + rnd2(-8, 8), 1.1); say('阵序乱了！天雷降！', 1.8); }
    }
    if (S.shatterT >= 0) { S.shatterT += dt; if (S.shatterT > 1.1) { const b = props.find(p => p.g === 'bagua'); if (b) b.broken = true, b.alpha = 0; S.shatterT = -2; }
      if (S.shatterT > .5 && S.perfect) for (let i = props.length - 1; i >= 0; i--) if (props[i].lamp) { S.hz.push({ k: 'puff', x: props[i].x, y: props[i].y - 12, t: 0 }); props.splice(i, 1); } }
    if (S.phase !== 'open' && !S.perfect && S.phase !== 'dead' && lamps().length && !lit().length) {   // 八盏全灭：阵破
      S.perfect = true; S.shatterT = 0; S.flash = .3; shake = .35; sfx('finisher', ALTAR_C.x);
      floaters.push({ x: ALTAR_C.x, y: ALTAR_C.y - 20, t: 0, txt: '八卦阵破！', big: true });
      say('八盏灯全灭，八卦阵破！', 3);
      S.queue = []; S.hz = S.hz.filter(h => h.k === 'puff'); S.pose = 'float';
      if (S.phase === 'p1') { S.phase = 'p2'; S.t = 0; S.summonRound = 0; S.sumT = 2; S.pose = 'summon'; }
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
      if (S.perfect) return;
      while (S.queue.length && S.queue[0].at <= S.rt) cast(S.queue.shift());
      if (S.rt >= ROUND_T) {
        const set = batch(S.round);
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
    if (z.jump) {   // 跳下法台：0.7 秒弧线落地，落地立刻开打
      const j = z.jump; j.t += dt; const u = Math.min(1, j.t / .7);
      z.z = j.h0 * (1 - u) + Math.sin(u * Math.PI) * 26; z.stun = 0;
      if (u >= 1) { z.jump = null; z.z = 0; sfx('land', z.x); shake = .4; S.hz.push({ k: 'puff', x: z.x, y: z.y - 6, t: 0 });
        if (S.perfect && !S.outOfOrder) { z.hp -= z.T.hp * .15; floaters.push({ x: z.x, y: z.y - 50, t: 0, txt: '破阵！-15%', big: true }); }
        else thunderAt(hero.x, hero.y, .9); }
      return true;
    }
    if (z.teleOn && z.st !== 'tele') { z.st = 'tele'; z.stun = 0; }   // 挨打不打断瞬移
    if (z.stun > .15) z.stun = .15;   // 只短暂受击一顿，不会被连招压死
    z.castT = Math.max(0, (z.castT || 0) - dt);
    if (!z.dead) z.z = z.zjDizzy > 0 ? 0 : 5 + Math.sin(performance.now() / 260) * 2;   // 飘浮
    if (z.st === 'rec' && !z.zjRecThunder && Math.random() < .5) { z.zjRecThunder = true; thunderAt(hero.x, hero.y, .8); }
    if (z.st !== 'rec') z.zjRecThunder = false;
    if (z.push) {   // 近身推开：把主角震开一小段，不伤血
      const p = z.push; p.t -= dt; moveEnt(hero, p.dir * 230 * dt, 0);
      if (p.t <= 0) z.push = null;
    }
    z.pushCd = (z.pushCd || 0) - dt;
    if (z.zjDizzy <= 0 && z.pushCd <= 0 && z.st !== 'tele' && Math.abs(hero.x - z.x) < 28 && Math.abs(hero.y - z.y) < 14) {
      z.pushCd = 3; z.push = { t: .22, dir: Math.sign(hero.x - z.x) || 1 }; sfx('crack', z.x); shake = Math.max(shake, .15);
      S.hz.push({ k: 'puff', x: z.x + z.push.dir * 14, y: z.y - 18, t: 0 }); floaters.push({ x: z.x, y: z.y - 50, t: 0, txt: '退！' });
      thunderAt(hero.x + z.push.dir * 50, hero.y, .8); z.castT = .4;
    }
    if (z.zjDizzy > 0) { z.zjDizzy -= dt; z.t += dt; return true; }
    // 挨打瞬移：1.5 秒内挨 3 下就闪到主角另一头，落地立刻放法术
    if (z.zjLastHp == null) z.zjLastHp = z.hp;
    if (z.hp < z.zjLastHp) { z.zjHits = (z.zjHits || []).filter(t => gameT - t < 1.5); z.zjHits.push(gameT); }
    z.zjLastHp = z.hp; z.zjEscCd = (z.zjEscCd || 0) - dt;
    if (z.st !== 'tele' && z.zjEscCd <= 0 && (z.zjHits || []).length >= 3) {
      z.zjHits = []; z.zjEscCd = z.rage ? 2.5 : 4; z.stun = 0; z.daze = 0; z.st = 'tele'; z.teleOn = true; z.t = 0; z.teleDone = false; z.escape = true;
      S.hz.push({ k: 'puff', x: z.x, y: z.y - 20, t: 0 }); return true;
    }
    if (z.st === 'tele') {
      z.t += dt;
      if (z.t > .3 && !z.teleDone) { z.teleDone = true; const mid = (arenaL + lockR) / 2; z.x = Math.max(arenaL + 24, Math.min(lockR - 24, z.escape ? hero.x + (hero.x < mid ? 1 : -1) * 150 : hero.x - hero.f * 38)); z.y = Math.max(M.top + 6, Math.min(M.bot - 4, hero.y)); z.f = Math.sign(hero.x - z.x) || z.f; S.hz.push({ k: 'puff', x: z.x, y: z.y - 20, t: 0 }); }
      if (z.t > .6) { z.st = 'move'; z.teleOn = false; z.t = 0; z.cd = .3; z.teleDone = false;
        if (z.escape) { z.escape = false; if (Math.random() < .5) { thunderAt(hero.x, hero.y, .9); thunderAt(hero.x + rnd2(-40, 40), hero.y + rnd2(-10, 10), 1.2); } else cast({ k: 'fu', x: z.x, y: z.y - 26 }); } }
      return true;
    }
    if (z.st === 'move' || z.st === 'idle') {
      z.zjTele -= dt; z.zjThunder -= dt; z.zjFire -= dt; z.zjFu -= dt;
      if (z.zjFu <= 0 && Math.abs(hero.x - z.x) > 60) { z.zjFu = z.rage ? 3.2 : 5; cast({ k: 'fu', x: z.x + z.f * 10, y: z.y - 26 }); if (z.rage) cast({ k: 'fu', x: z.x, y: z.y - 40 }); z.castT = .4; }
      if (z.zjFire <= 0) { z.zjFire = z.rage ? 6 : 10; cast({ k: 'fire', ox: z.x, oy: z.y }); say('张角：“地火，焚！”', 1.5); }
      if (!z.rage && z.hp < z.T.hp * .5) {
        z.rage = true; z.T = { ...z.T, spd: z.T.spd * 1.3, wind: z.T.wind * .8 };
        say('张角：“天雷，降！”', 2.5); for (let i = 0; i < 3; i++) thunderAt(hero.x + (i - 1) * 40, hero.y + rnd2(-8, 8), 1.1 + i * .25);
      }
      if (z.zjThunder <= 0) { z.zjThunder = z.rage ? 2.6 : 4.2; thunderAt(hero.x, hero.y, .9); if (z.rage) thunderAt(hero.x + (Math.random() < .5 ? -45 : 45), hero.y, 1.2); z.castT = .4; }
      if (z.zjTele <= 0 && Math.abs(hero.x - z.x) > 50) { z.zjTele = 4; z.st = 'tele'; z.teleOn = true; z.t = 0; z.teleDone = false; return true; }
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
      const gi = lamps().indexOf(p); ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 2; ctx.strokeStyle = '#3a2208'; ctx.fillStyle = '#ffe9a0'; ctx.strokeText(GUA[gi], p.x, p.y - 33); ctx.fillText(GUA[gi], p.x, p.y - 33); ctx.textAlign = 'left';
      const hp3 = Math.max(0, p.hp);
      ctx.fillStyle = '#ffe9a0'; for (let i = 0; i < hp3; i++) ctx.fillRect(p.x - 5 + i * 4, p.y - 28, 3, 3);
    }
    // 地面预警
    for (const h of S.hz) {
      if (h.k === 'thunder' && h.t < 0) {
        const u = 1 + h.t, r = h.r;
        pic('ring', h.x, h.y, (r * 2 / 179) * (1.3 - u * .3), .45 + .5 * u);
      } else if (h.k === 'fire') {
        if (h.t < 0) { ctx.fillStyle = 'rgba(160,50,25,.35)'; ctx.beginPath(); ctx.ellipse(h.x, h.y, 13, 5, 0, 0, 7); ctx.fill(); }
        else pic('fire' + (1 + (h.fr + Math.floor(h.t * 10)) % 4), h.x, h.y + 4, .5, 1 - h.t / .8, true);
      } else if (h.k === 'slam') {
        if (h.t < 0) { const u = 1 + h.t / 1.5; ctx.strokeStyle = `rgba(170,76,44,${.4 + .5 * u})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * .42, 0, 0, 7); ctx.stroke();
          ctx.fillStyle = 'rgba(150,60,30,.22)'; ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r * u, h.r * .42 * u, 0, 0, 7); ctx.fill(); }
        else { const u = h.t / .45; ctx.strokeStyle = `rgba(140,90,50,${1 - u})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r * (.6 + u * .6), h.r * .42 * (.6 + u * .6), 0, 0, 7); ctx.stroke(); }
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
