// 序章 Boss：黄巾头目 管亥
// 第一阶段（马上）：骑马冲锋 / 马踏飞燕 / 马上横劈，75% 血时叫两个喽啰
// 转阶段（一半血）：摔下马，马逃走，怒吼（无敌）
// 第二阶段（步战）：重劈（地面冲击波）/ 头顶转戟（追人，转完头晕）/ 突刺；打太多下会踉跄；25% 以下狂暴
// 依赖 game.js 里的全局：hero, zs, cam, M, viewW, dmgHero, launch, sfx, say, kills, drawChar, shadow, ctx
const Boss = (() => {
  const HP = 80;
  let fx = [];          // 冲击波、预警等
  let horse = null;     // 摔下马后逃走的马
  const T = { name: '管亥', hp: HP, heavy: true, boss: true, w: 18 };
  const CHARGE = .5;   // 冲锋距离 = 屏幕宽度 × 0.5

  function start(rightEdge) {
    const z = { type: 'guanhai_horse', T, x: rightEdge + 60, y: (M.top + M.bot) / 2, f: -1, hp: HP, st: 'intro', t: 0, phase: 1,
      flash: 0, vx: 0, poise: 0, cd: 1.2, called: false, slot: 0, z: 0 };
    zs.push(z); fx = []; horse = null;
    sfx('land', z.x);
    return z;
  }
  const set = (z, st) => { z.st = st; z.t = 0; };
  const vo = (n, p = 1) => { if (window.SFX && Math.random() < p) SFX.voice('guanhai_' + n); };   // 配音（art/voice/guanhai_*.mp3）
  const view = () => [cam.x, cam.x + viewW()];
  function moveTo(z, tx, ty, sp, dt) {
    const dx = tx - z.x, dy = ty - z.y, l = Math.hypot(dx, dy);
    if (l < 2) return true;
    const k = Math.min(1, sp * dt / l); z.x += dx * k; z.y += dy * .7 * k;
    z.y = Math.max(M.top, Math.min(M.bot, z.y));
    if (Math.abs(dx) > 2) z.f = Math.sign(dx);
    return false;
  }
  function heroIn(x, y, rx, ry) { return Math.abs(hero.x - x) < rx && Math.abs(hero.y - y) < ry; }

  // ---------- 受击 ----------
  function hit(z, dmg, dir) {
    if (z.dead || z.st === 'fall' || z.st === 'roar' || z.st === 'intro') return;
    z.hp -= dmg; z.flash = .1; freeze = .04; shake = .08;
    hero.lastHit = gameT; hero.lastHitC = hero.atk ? hero.atk.c : hero.lastShotC;
    if (z.phase === 2) {
      z.poise += dmg;
      const busy = ['chop_a', 'chop_b', 'spin', 'thrust_a', 'thrust_b'].includes(z.st);
      if (z.poise >= 9 && !busy) { z.poise = 0; set(z, 'stagger'); vo('stagger'); }
      else if (z.st === 'walk' || z.st === 'idle') z.x += dir * 3;
    }
    if (z.phase === 1 && !z.called && z.hp <= HP * .75) {
      z.called = true; say('管亥：「小的们，给我上！」', 2.5); vo('call');
      spawn('grunt', cam.x + 8, M.top + 20); spawn('grunt', cam.x + viewW() - 8, M.bot - 10);
    }
    if (z.phase === 1 && z.hp <= HP / 2) {   // 摔下马
      z.hp = HP / 2; set(z, 'fall'); z.vx = -z.f * 60; fx = fx.filter(e => e.k !== 'lane' && e.k !== 'ring');
      horse = { x: z.x + z.f * 10, y: z.y, f: z.f, t: 0 };
      say('管亥：「啊——！畜生！」', 2); vo('fall'); sfx('enemyDown', z.x); shake = .3;
    }
    if (z.hp <= 0) {
      z.hp = 0; z.dead = 1; kills++; set(z, 'kneel'); fx = [];
      say('管亥：「这……这小子是什么人……」', 3.5); vo('defeat'); sfx('enemyDown', z.x); shake = .3;
    }
  }

  // ---------- 行为 ----------
  function update(z, dt) {
    z.t += dt; z.flash = Math.max(0, z.flash - dt); z.cd -= dt;
    if (horse) { horse.t += dt; horse.x += horse.f * 160 * dt; if (horse.t > 2.5) horse = null; }
    if (z.dead) {
      if (z.st === 'kneel' && z.t > 2.2) set(z, 'down');
      else if (z.st === 'down' && z.t > 1.2) { z.st = 'gone'; z.t = 0; }
      return;
    }
    const [L, Rr] = view();
    const dx = hero.x - z.x, ad = Math.abs(dx), ady = Math.abs(hero.y - z.y);
    if (z.phase === 1) phase1(z, dt, dx, ad, ady, L, Rr); else phase2(z, dt, dx, ad, ady, L, Rr);
  }

  function phase1(z, dt, dx, ad, ady, L, Rr) {
    const S = z.st;
    if (S === 'intro') {   // 骑马冲进画面 → 勒马嘶鸣 → 开打
      if (z.t < .1) say('马蹄声由远而近……', 2);
      if (moveTo(z, Rr - 70, (M.top + M.bot) / 2, 150, dt) || z.t > 3) { set(z, 'introRear'); sfx('bladeAlert', z.x); }
      return;
    }
    if (S === 'introRear') { if (z.t > 1.1) { say('管亥：「哪来的野小子，敢坏老子好事！」', 3); window.SFX && SFX.voice('guanhai_intro'); set(z, 'idle'); z.cd = .8; } return; }
    if (S === 'idle') {
      z.f = Math.sign(dx) || z.f;
      // 慢慢靠近主角但保持一点距离
      if (ad > 90) moveTo(z, hero.x - z.f * 70, hero.y, 55, dt); else if (ad < 45) moveTo(z, hero.x - z.f * 80, z.y, 50, dt);
      if (z.cd <= 0) {
        const r = Math.random();
        if (ad < 50 && ady < 16 && r < .55) set(z, 'sweep_a');
        else if (r < .78) { set(z, 'charge_go'); z.side = z.x < (L + Rr) / 2 ? -1 : 1; }
        else { set(z, 'leap_prep'); z.tx = hero.x; z.ty = hero.y; fx.push({ k: 'ring', x: z.tx, y: z.ty, t: 0, T: 1.3 }); sfx('bladeAlert', z.x); }
      }
      return;
    }
    // 骑马冲锋
    if (S === 'charge_go') {   // 退开一段距离，让主角落在冲锋路线中间
      const dist = viewW() * CHARGE, tx = Math.max(L + 40, Math.min(Rr - 40, hero.x + z.side * dist * .55));
      if (moveTo(z, tx, hero.y, 170, dt) || z.t > 2.2) {
        set(z, 'charge_prep'); z.f = Math.sign(hero.x - z.x) || -z.side; z.cx0 = z.x; z.cdist = dist;
        fx.push({ k: 'lane', y: z.y, x0: z.x, x1: z.x + z.f * dist, t: 0, T: .85 }); sfx('bladeAlert', z.x);
      }
      return;
    }
    if (S === 'charge_prep') { if (z.t > .85) { set(z, 'charge'); sfx('enemySwing', z.x); } return; }
    if (S === 'charge') {
      z.x += z.f * 300 * dt;
      if (z.t % .18 < dt) sfx('land', z.x);
      if (heroIn(z.x + z.f * 14, z.y, 30, 11)) dmgHero(2, { x: z.x - z.f * 30 });   // 马身 + 前伸的戟尖（约 44）
      if (Math.abs(z.x - z.cx0) >= z.cdist || (z.f > 0 && z.x > Rr - 30) || (z.f < 0 && z.x < L + 30)) { set(z, 'tired'); }
      return;
    }
    if (S === 'tired') { if (z.t > 1.5) { set(z, 'idle'); z.cd = 1; } return; }
    // 马踏飞燕
    if (S === 'leap_prep') { z.f = Math.sign(z.tx - z.x) || z.f; if (z.t > .6) { set(z, 'leap'); z.x0 = z.x; z.y0 = z.y; } return; }
    if (S === 'leap') {
      const p = Math.min(1, z.t / .7);
      z.x = z.x0 + (z.tx - z.x0) * p; z.y = z.y0 + (z.ty - z.y0) * p; z.z = Math.sin(p * Math.PI) * 70;
      if (p >= 1) {
        z.z = 0; set(z, 'stomp'); shake = .3; sfx('enemyDown', z.x);
        fx.push({ k: 'quake', x: z.x, y: z.y, t: 0, T: .45 });
        if (heroIn(z.x, z.y, 40, 16)) dmgHero(2, { x: z.x });
      }
      return;
    }
    if (S === 'stomp') { if (z.t > 1) { set(z, 'idle'); z.cd = 1.2; } return; }
    // 马上横劈
    if (S === 'sweep_a') { z.f = Math.sign(dx) || z.f; if (z.t > .6) { set(z, 'sweep_b'); sfx('enemySwing', z.x); if (heroIn(z.x + z.f * 20, z.y, 26, 15)) dmgHero(2, z); } return; }   // 横劈：戟尖约 38 + 身体半宽
    if (S === 'sweep_b') { if (z.t > .5) { set(z, 'idle'); z.cd = 1.3; } return; }
    if (S === 'fall') {
      z.x += z.vx * dt; z.vx *= .92;
      if (z.t > 1.1) { z.phase = 2; z.type = 'guanhai'; set(z, 'roar'); say('管亥：「老子宰了你！」', 2.5); vo('rage'); sfx('finisher', z.x); shake = .25; }
    }
  }

  function phase2(z, dt, dx, ad, ady, L, Rr) {
    const S = z.st, rage = z.hp <= HP * .25, sp = rage ? 1.3 : 1;
    if (S === 'roar') { if (z.t > 1.4) { set(z, 'idle'); z.cd = .8; z.spinCd = 5; } return; }
    if (S === 'stagger') { if (z.t > .9) { set(z, 'idle'); z.cd = .4; } return; }
    if (S === 'dizzy') { if (z.t > 1.6) { set(z, 'idle'); z.cd = .5; } return; }
    z.spinCd = (z.spinCd || 0) - dt;
    if (S === 'idle' || S === 'walk') {
      z.f = Math.sign(dx) || z.f;
      if (z.cd <= 0) {
        if (z.spinCd <= 0 && ad < 140) { set(z, 'spin'); z.spinCd = 9; sfx('bladeAlert', z.x); vo('spin'); return; }
        if (ad < 40 && ady < 14) { set(z, 'chop_a'); return; }
        if (ad > 36 && ad < 62 && ady < 14) { set(z, 'thrust_a'); sfx('bladeAlert', z.x); return; }
      }
      const walking = ad > 36 || ady > 8;
      if (walking) { moveTo(z, hero.x - z.f * 32, hero.y, 34 * sp, dt); if (S !== 'walk') set(z, 'walk'); } else if (S !== 'idle') set(z, 'idle');
      return;
    }
    // 重劈：举过头 → 砸地，冲击波沿面朝方向跑
    if (S === 'chop_a') { if (z.t > .8 / sp) { set(z, 'chop_b'); shake = .25; sfx('finisher', z.x); vo('chop', .7);
      if (heroIn(z.x + z.f * 17, z.y, 23, 14)) dmgHero(3, z);   // 重劈直接砸中的范围（长戟戟尖约 31 + 半宽），更远处靠冲击波
      fx.push({ k: 'wave', x: z.x + z.f * 40, y: z.y, vx: z.f * 230, t: 0, T: 1.2, hit: false }); } return; }
    if (S === 'chop_b') { if (z.t > .55) { if (rage) { set(z, 'thrust_a'); sfx('bladeAlert', z.x); } else { set(z, 'idle'); z.cd = 1.1; } } return; }
    // 头顶转戟：追着主角走，靠近就被打；转完头晕
    if (S === 'spin') {
      moveTo(z, hero.x, hero.y, 30 * sp, dt);
      if (z.t % .25 < dt) sfx('enemySwing', z.x);
      if (heroIn(z.x, z.y, 34, 14)) dmgHero(1, z);
      if (z.t > 2.2) set(z, 'dizzy');
      return;
    }
    // 突刺
    if (S === 'thrust_a') { z.f = Math.sign(dx) || z.f; if (z.t > .4 / sp) { set(z, 'thrust_b'); sfx('enemySwing', z.x); vo('thrust', .7); z.x += z.f * 16;
      const reach = 44, mid = z.x + z.f * reach / 2; if (heroIn(mid, z.y, reach / 2, 12)) dmgHero(2, z); } return; }   // 突刺：戟尖约 37 + 半宽
    if (S === 'thrust_b') { if (z.t > .45) { set(z, 'idle'); z.cd = 1; } return; }
  }

  function updateFx(dt) {
    for (const e of fx) {
      e.t += dt;
      if (e.k === 'wave') { e.x += e.vx * dt; if (!e.hit && heroIn(e.x, e.y, 14, 10)) { e.hit = true; dmgHero(3, { x: e.x - e.vx }); } }
    }
    fx = fx.filter(e => e.t < e.T);
  }

  // ---------- 绘制 ----------
  function frame(z) {
    const S = z.st, run = Math.floor(z.t * 10) % 2 ? 'run1' : 'run2';
    if (z.phase === 1) {
      return { intro: run, introRear: 'rear', idle: 'idle', charge_go: run, charge_prep: 'rear', charge: run, tired: 'idle',
        leap_prep: 'rear', leap: 'leap', stomp: 'stomp', sweep_a: 'sweep_a', sweep_b: 'sweep_b', fall: 'fall_rider' }[S] || 'idle';
    }
    if (S === 'walk') return Math.floor(z.t * 5) % 2 ? 'walk1' : 'walk2';
    if (S === 'spin') return Math.floor(z.t * 12) % 2 ? 'spin1' : 'spin2';
    if (S === 'gone') return 'down';
    return { idle: 'idle', roar: 'roar', stagger: 'stagger', dizzy: 'dizzy', chop_a: 'chop_a', chop_b: 'chop_b', thrust_a: 'thrust_a', thrust_b: 'thrust_b', kneel: 'kneel', down: 'down' }[S] || 'idle';
  }
  function draw(z) {
    shadow(z.x, z.y, z.phase === 1 ? 24 : 16);
    const a = z.st === 'gone' ? Math.max(0, 1 - z.t * 1.2) : 1;
    // 冲锋前马身后的抖动、狂暴时泛红
    const jitter = z.st === 'charge_prep' ? Math.sin(z.t * 60) * .8 : 0;
    drawChar(z.type, frame(z), z.x + jitter, z.y - (z.z || 0), z.f < 0, a, z.flash > 0);
    if (z.phase === 2 && !z.dead && z.hp <= HP * .25 && Math.floor(performance.now() / 150) % 2) drawChar(z.type, frame(z), z.x, z.y, z.f < 0, .25, true);
    if (z.st === 'dizzy') {
      const t = performance.now() / 260, top = z.y - 58;
      for (let k = 0; k < 3; k++) { const an = t + k * 2.094, sx = z.x + Math.cos(an) * 10, sy = top + Math.sin(an) * 3;
        ctx.fillStyle = '#3a2410'; ctx.fillRect(sx - 2.5, sy - 2.5, 5, 5); ctx.fillStyle = '#ffd84a'; ctx.fillRect(sx - 2, sy - .5, 4, 1); ctx.fillRect(sx - .5, sy - 2, 1, 4); }
    }
  }
  function drawHorse() {
    if (!horse) return;
    shadow(horse.x, horse.y, 26);
    drawChar('guanhai_horse', 'fall_horse', horse.x, horse.y, horse.f < 0, Math.max(0, 1 - horse.t / 2.5));
  }
  // 地面上的预警和冲击波（画在人物下面）
  function drawGround() {
    const [L, Rr] = view();
    for (const e of fx) {
      if (e.k === 'lane') { const p = e.t / e.T; ctx.fillStyle = `rgba(230,40,30,${.12 + .25 * Math.abs(Math.sin(e.t * 14))})`; const a = Math.min(e.x0, e.x1), b = Math.max(e.x0, e.x1); ctx.fillRect(a, e.y - 9, b - a, 18);
        ctx.fillStyle = `rgba(255,80,60,${.5 * p})`; ctx.fillRect(a, e.y - 1, b - a, 2); }
      if (e.k === 'ring') { const p = Math.min(1, e.t / e.T); ctx.strokeStyle = `rgba(230,40,30,${.4 + .5 * p})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(e.x, e.y, 40 * (1.3 - .3 * p), 14 * (1.3 - .3 * p), 0, 0, 7); ctx.stroke(); }
      if (e.k === 'quake') { const p = e.t / e.T; ctx.strokeStyle = `rgba(120,80,40,${.6 * (1 - p)})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(e.x, e.y, 20 + 40 * p, 7 + 12 * p, 0, 0, 7); ctx.stroke(); }
      if (e.k === 'wave') {   // 地面裂开往前跑的冲击波：几块翻起的土
        const a = 1 - e.t / e.T;
        for (let k = 0; k < 4; k++) { const x = e.x - Math.sign(e.vx) * k * 7, h = (6 - k) * (1 + Math.sin(e.t * 30 + k) * .3);
          ctx.fillStyle = `rgba(110,72,36,${a})`; ctx.beginPath(); ctx.moveTo(x - 4, e.y); ctx.lineTo(x, e.y - h); ctx.lineTo(x + 4, e.y); ctx.fill();
          ctx.fillStyle = `rgba(230,200,140,${a * .8})`; ctx.fillRect(x - 1, e.y - h * .7, 2, 1.5); }
      }
    }
  }
  // 屏幕上方的大血条
  function hud(HW) {
    const z = zs.find(o => o.T === T); if (!z || z.st === 'gone') return;
    const w = Math.min(420, HW * .6), x = (HW - w) / 2, y = 22;
    ctx.fillStyle = 'rgba(20,14,30,.8)'; ctx.fillRect(x - 3, y - 3, w + 6, 16);
    ctx.fillStyle = z.phase === 1 ? '#c0392b' : z.hp <= HP * .25 ? '#ff3b1f' : '#d35400';
    ctx.fillRect(x, y, w * z.hp / HP, 10);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x + w / 2 - 1, y, 2, 10);
    ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd86e'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.strokeText('黄巾头目 · 管亥', HW / 2, y + 30); ctx.fillText('黄巾头目 · 管亥', HW / 2, y + 30); ctx.textAlign = 'left';
  }
  return { start, update, hit, draw, drawHorse, drawGround, updateFx, hud, T, reset() { fx = []; horse = null; } };
})();
