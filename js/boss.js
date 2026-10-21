// 序章 Boss：黄巾流寇·管亥
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

  // 天气：只在 Boss 战出现，进场的瞬间 50% 概率下雨/下雪/起风
  let WX = null;
  const WX_ID = { rain: '下雨了……地面很滑', snow: '下雪了……手脚都变慢了', wind: '起风了……石子会被吹偏' };
  function wxMove() { return WX === 'rain' ? .9 : WX === 'snow' ? .88 : 1; }
  function wxAspd() { return WX === 'snow' ? 1.1 : 1; }
  function wxProj() { return WX === 'wind' ? .85 : 1; }

  function start(rightEdge) {
    WX = Math.random() < .5 ? ['rain', 'snow', 'wind'][Math.floor(Math.random() * 3)] : null;
    if (WX && WX_ID[WX]) setTimeout(() => say(WX_ID[WX], 3), 500);
    const z = { type: 'guanhai_horse', T, x: rightEdge + 60, y: (M.top + M.bot) / 2, f: -1, hp: HP, st: 'intro', t: 0, phase: 1,
      flash: 0, vx: 0, poise: 0, cd: 1.2, called: false, slot: 0, z: 0 };
    zs.push(z); fx = []; horse = null;
    sfx('land', z.x);
    return z;
  }
  const set = (z, st) => { z.st = st; z.t = 0; if (st !== 'leap') z.z = 0; };   // 切状态时把离地高度清零，防止卡在半空
  // 配音（art/voice/guanhai_*.mp3）。只保留 5 句台词：登场 / 喊人 / 落马 / 怒吼 / 战败。
  // 攻击时的吼声（chop / thrust / spin / stagger）已按用户要求去掉：Boss 战一打久了就太吵，而且会互相叠音。
  const vo = (n, p = 1) => { if (window.SFX && Math.random() < p) SFX.voice('guanhai_' + n); };
  const view = () => [cam.x, cam.x + viewW()];
  function moveTo(z, tx, ty, sp, dt) {
    sp *= wxMove();
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
    // 去捡戟的路上无敌（飞在空中），只溅火星表示"打不动"，避免玩家以为没打中
    if (z.spear && (z.st === 'leap' || z.st === 'pickup')) {
      for (let i = 0; i < 5; i++) {
        const life = rnd(.08, .2);
        propFx.push({ x: z.x + rnd(-8, 8), y: z.y - rnd(14, 34), vx: rnd(-70, 70) - dir * 30, vy: rnd(-90, -10),
          w: rnd(1, 2), h: rnd(1, 2), life, max: life, c: Math.random() < .5 ? '#fffbe6' : '#ffd88a' });
      }
      return;
    }
    // 掷戟后的空手窗口：只吃一半伤害（完全不能攻击，是玩家该抓的破绽）
    if (z.spear) dmg *= .5;   // 家伙不在手上（掷出去了）就一直只吃一半伤害
    z.hp -= dmg; z.flash = .1; freeze = .04; shake = .08;
    hero.lastHit = gameT; hero.lastHitC = hero.atk ? hero.atk.c : hero.lastShotC;
    if (z.phase === 2) {
      z.poise += dmg;
      // 扑过去捡戟的过程不被打断（否则破绽窗口会无限延长），但伤害照吃
      const busy = ['chop_a', 'chop_b', 'spin', 'thrust_a', 'thrust_b', 'leap', 'pickup'].includes(z.st);
      if (z.poise >= 9 && !busy) { z.poise = 0; set(z, 'stagger'); }
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
    if (z.phase === 2) { z.dashCd = (z.dashCd || 0) - dt; z.throwCd = (z.throwCd || 0) - dt; }
    // 掷出去的长戟：飞 → 落地 → 等他去捡
    if (z.spear && !z.spear.land) {
      const p = z.spear; p.x += p.vx * dt;
      if (heroIn(p.x, z.y, 16, 14)) { dmgHero(2, { x: p.x }); p.land = 1; shake = .2; }
      else if (Math.abs(p.x - z.x) > 260) p.land = 1;
      if (p.land) { p.y = z.y; z.pickX = p.x; }
    }
    if (horse) { horse.t += dt; horse.x += horse.f * 160 * dt; if (horse.t > 2.5) horse = null; }
    if (z.dead) {
      // 跪倒 → 倒地，然后就一直躺着：通关结算时大将要留在场上，不再转 gone 消失
      if (z.st === 'kneel' && z.t > 2.2) set(z, 'down');
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
        if (ad < 70 && ady < 16 && r < .55) set(z, 'sweep_a');
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
      if (heroIn(z.x + z.f * 20, z.y, 32, 11)) dmgHero(2, { x: z.x - z.f * 30 });   // 冲锋：戟尖约 50
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
    if (S === 'sweep_a') { z.f = Math.sign(dx) || z.f; if (z.t > .6) { set(z, 'sweep_b'); sfx('enemySwing', z.x); if (heroIn(z.x + z.f * 36, z.y, 40, 15)) dmgHero(2, z); } return; }   // 马上横扫：戟尖约 75
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
    // 手里没戟（还插在地上）→ 必须回去捡。之前被玩家打断会停在 idle，戟就永远留在地上了
    if (z.spear && !['throw_a', 'bare', 'leap', 'pickup'].includes(S)) { set(z, 'leap'); z.pickX = z.spear.x; return; }
    z.spinCd = (z.spinCd || 0) - dt;
    // TODO(待补美术/待做)：二阶段缺位移技能「突进刺」——
    // 现在他走得太慢（34，狂暴 44），主角 70 只要后退就永远追不上。
    // 计划：距离 > 70 时发动，前摇 0.5s → 冲刺 0.35s（约 90 单位）→ 收招硬直 0.5s，冷却约 5s。
    // 冲刺帧暂时可以用 thrust_a / thrust_b 顶替，正式美术见 AGENTS.md「待补美术」。
    if (S === 'idle' || S === 'walk') {
      z.f = Math.sign(dx) || z.f;
      if (z.cd <= 0) {
        if (z.throwCd <= 0 && ad > 150 && ady < 30) { set(z, 'throw_a'); z.throwCd = 10; sfx('bladeAlert', z.x); return; }
        if (z.dashCd <= 0 && ad > 85) { set(z, 'dash_a'); z.dashCd = 5.5; sfx('bladeAlert', z.x); return; }
        if (z.spinCd <= 0 && ad < 140) { set(z, 'spin'); z.spinCd = 9; sfx('bladeAlert', z.x); return; }
        if (ad < 62 && ady < 14) { set(z, 'chop_a'); return; }
        if (ad > 58 && ad < 96 && ady < 14) { set(z, 'thrust_a'); sfx('bladeAlert', z.x); return; }
      }
      const walking = ad > 52 || ady > 8;
      if (walking) { moveTo(z, hero.x - z.f * 48, hero.y, 34 * sp, dt); if (S !== 'walk') set(z, 'walk'); } else if (S !== 'idle') set(z, 'idle');
      return;
    }
    // 突进刺：举戟后撤（前摇）→ 冲 90 单位 → 收招硬直（可被打）
    if (S === 'dash_a') {
      z.f = Math.sign(dx) || z.f;
      if (z.t > .5 / sp) { set(z, 'dash_b'); sfx('enemySwing', z.x); z.hitDone = false; fx.push({ k: 'dust', x: z.x, y: z.y, t: 0, T: .4 }); }
      return;
    }
    if (S === 'dash_b') {
      z.x = Math.max(L + 16, Math.min(Rr - 16, z.x + z.f * 260 * dt));
      if (!z.hitDone && heroIn(z.x + z.f * 18, z.y, 28, 15)) { z.hitDone = true; dmgHero(2, { x: z.x + z.f * 18 }); shake = .22; freeze = .05; }
      if (z.t > .22) { set(z, 'dash_end'); z.cd = 1.3; }
      return;
    }
    if (S === 'dash_end') { if (z.t > .5) set(z, 'idle'); return; }
    // 掷戟：举戟投出 → 空手（免伤 50%、不能攻击）→ 跳到武器边上捡回来
    if (S === 'throw_a') {
      z.f = Math.sign(dx) || z.f;
      if (z.t > .45) {
        z.spear = { x: z.x + z.f * 22, y: z.y, vx: z.f * 480, land: 0 };
        set(z, 'bare'); z.bareT = 1.05;
        sfx('enemySwing', z.x); shake = .12;
      }
      return;
    }
    if (S === 'bare') {
      if (z.t > (z.bareT || 1.05)) { set(z, 'leap'); z.pickX = z.spear ? z.spear.x : z.x; }
      return;
    }
    if (S === 'leap') {
      const tx = z.pickX == null ? z.x : z.pickX, d = tx - z.x;
      if (Math.abs(d) > 10 && z.t < 1.2) {
        z.x += Math.sign(d) * Math.min(Math.abs(d), 340 * dt); z.f = Math.sign(d) || z.f;
        z.z = Math.sin(Math.min(1, z.t / .55) * Math.PI) * 30;
      } else { z.z = 0; set(z, 'pickup'); }
      return;
    }
    if (S === 'pickup') {
      if (z.t > .35) { z.spear = null; z.z = 0; z.throwCd = 10; set(z, 'idle'); z.cd = .4; sfx('land', z.x); }
      return;
    }
    // 重劈：举过头 → 砸地，冲击波沿面朝方向跑
    if (S === 'chop_a') { if (z.t > .8 / sp) { set(z, 'chop_b'); shake = .25; sfx('finisher', z.x);
      if (heroIn(z.x + z.f * 34, z.y, 34, 14)) dmgHero(3, z);   // 重劈：长戟砸在地上，戟尖约 66，更远处靠冲击波
      fx.push({ k: 'wave', x: z.x + z.f * 66, y: z.y, vx: z.f * 230, t: 0, T: 1.2, hit: false }); } return; }
    if (S === 'chop_b') { if (z.t > .55) { if (rage) { set(z, 'thrust_a'); sfx('bladeAlert', z.x); } else { set(z, 'idle'); z.cd = 1.1; } } return; }
    // 头顶转戟：追着主角走，靠近就被打；转完头晕
    if (S === 'spin') {
      moveTo(z, hero.x, hero.y, 30 * sp, dt);
      if (z.t % .25 < dt) sfx('enemySwing', z.x);
      if (heroIn(z.x, z.y, 42, 14)) dmgHero(1, z);   // 转戟：半径约 42
      if (z.t > 2.2) set(z, 'dizzy');
      return;
    }
    // 突刺
    if (S === 'thrust_a') { z.f = Math.sign(dx) || z.f; if (z.t > .4 / sp) { set(z, 'thrust_b'); sfx('enemySwing', z.x); z.x += z.f * 16;
      const reach = 84, mid = z.x + z.f * reach / 2; if (heroIn(mid, z.y, reach / 2, 12)) dmgHero(2, z); } return; }   // 突刺：戟尖约 84
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
    if (S === 'spin') return 'spin' + (1 + Math.floor(z.t * 18) % 6);   // 6 帧：长戟在头顶水平转一圈
    if (S === 'gone') return 'down';
    if (S === 'bare' || S === 'pickup') return 'bare_idle';     // 空手
    if (S === 'leap') return 'fly';                              // 扑向兵器
    if (S === 'dash_a') return 'dash_a';
    if (S === 'dash_b' || S === 'dash_end') return 'dash_b';
    if (S === 'throw_a') return 'chop_a';
    return { idle: 'idle', roar: 'roar', stagger: 'stagger', dizzy: 'dizzy', chop_a: 'chop_a', chop_b: 'chop_b', thrust_a: 'thrust_a', thrust_b: 'thrust_b', kneel: 'kneel', down: 'down' }[S] || 'idle';
  }
  // 出招前的预警：地面上的红条（先淡淡画出整个危险区，再被亮色填满）+ 头顶「!」
  function telegraph(z) {
    const S = z.st;
    let len = 0, tmax = 1;
    if (S === 'dash_a') { len = 78; tmax = .5; }
    else if (S === 'throw_a') { len = 250; tmax = .45; }
    else if (S === 'chop_a') { len = 72; tmax = .8; }
    else if (S === 'thrust_a') { len = 92; tmax = .4; }
    else return;
    const p = Math.min(1, z.t / tmax), x0 = z.x, x1 = z.x + z.f * len;
    const a = Math.min(x0, x1), b = Math.max(x0, x1);
    ctx.fillStyle = 'rgba(180,35,28,.15)'; ctx.fillRect(a, z.y - 10, b - a, 20);
    const xf = x0 + z.f * len * p;
    ctx.fillStyle = 'rgba(245,80,45,' + (.22 + .28 * Math.abs(Math.sin(z.t * 18))) + ')';
    ctx.fillRect(Math.min(x0, xf), z.y - 10, Math.abs(xf - x0), 20);
    ctx.strokeStyle = 'rgba(255,130,90,.45)'; ctx.lineWidth = 1; ctx.strokeRect(a + .5, z.y - 10.5, b - a - 1, 20);
    const top = z.y - 66 - Math.abs(Math.sin(z.t * 10)) * 2;
    ctx.save(); ctx.font = 'bold 14px "PingFang SC",sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 3.5; ctx.strokeStyle = '#2a0f0a'; ctx.fillStyle = '#ff5a3c';
    ctx.strokeText('!', z.x, top); ctx.fillText('!', z.x, top);
    ctx.restore();
  }
  function draw(z) {
    telegraph(z);
    shadow(z.x, z.y, z.phase === 1 ? 24 : 16);
    const a = z.st === 'gone' ? Math.max(0, 1 - z.t * 1.2) : 1;
    // 冲锋前马身后的抖动、狂暴时泛红
    const jitter = z.st === 'charge_prep' ? Math.sin(z.t * 60) * .8 : 0;
    drawChar(z.type, frame(z), z.x + jitter, z.y - (z.z || 0), z.f < 0, a, z.flash > 0);
    if (z.phase === 2 && !z.dead && z.hp <= HP * .25 && Math.floor(performance.now() / 150) % 2) drawChar(z.type, frame(z), z.x, z.y, z.f < 0, .25, true);
    // 飞出去的长戟 / 掉在地上的长戟
    if (z.spear) {
      const p = z.spear, yy = p.land ? p.y + 3 : p.y - 14;
      if (p.land) { ctx.fillStyle = 'rgba(255,216,110,.16)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 3, 26, 5, 0, 0, 7); ctx.fill(); }
      drawChar('guanhai', p.land ? 'halberd_ground' : 'halberd', p.x, p.land ? p.y + 3 : yy, (p.vx || 1) < 0);
    }
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
      if (e.k === 'dust') { const p = e.t / e.T; ctx.fillStyle = 'rgba(196,164,112,' + (.45 * (1 - p)) + ')';
        ctx.beginPath(); ctx.ellipse(e.x, e.y, 10 + 24 * p, 4 + 9 * p, 0, 0, 7); ctx.fill(); }
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
    const z = zs.find(o => o.T === T); if (!z || z.dead || z.st === 'gone') return;   // 倒下以后不再挂血条
    const w = Math.min(420, HW * .6), x = (HW - w) / 2, y = 22;
    ctx.fillStyle = 'rgba(20,14,30,.8)'; ctx.fillRect(x - 3, y - 3, w + 6, 16);
    ctx.fillStyle = z.phase === 1 ? '#c0392b' : z.hp <= HP * .25 ? '#ff3b1f' : '#d35400';
    ctx.fillRect(x, y, w * z.hp / HP, 10);
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x + w / 2 - 1, y, 2, 10);
    ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd86e'; ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.strokeText('黄巾流寇·管亥', HW / 2, y + 30); ctx.fillText('黄巾流寇·管亥', HW / 2, y + 30); ctx.textAlign = 'left';
  }
  // 天气的视觉：屏幕空间的雨丝/雪粒 + 一层色调
  let wxT = 0;
  function wxDraw(W, H) {
    if (!WX) return;
    wxT += .016;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (WX === 'rain') {
      ctx.fillStyle = 'rgba(40,60,90,.18)'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(180,210,255,.45)'; ctx.lineWidth = 1;
      for (let i = 0; i < 90; i++) {
        const x = (i * 137 + wxT * 900) % (W + 40) - 20, y = (i * 211 + wxT * 1500) % (H + 60) - 30;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 14); ctx.stroke();
      }
    } else if (WX === 'snow') {
      ctx.fillStyle = 'rgba(200,220,255,.10)'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(255,255,255,.75)';
      for (let i = 0; i < 60; i++) {
        const x = (i * 173 + Math.sin(wxT + i) * 18) % W, y = (i * 231 + wxT * 120) % H;
        ctx.fillRect(x, y, 2, 2);
      }
    } else {
      ctx.fillStyle = 'rgba(120,110,80,.08)'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(230,220,190,.35)'; ctx.lineWidth = 1;
      for (let i = 0; i < 24; i++) {
        const y = (i * 97) % H, len = 30 + (i % 4) * 18;
        const x = (wxT * 260 + i * 60) % (W + len) - len;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y + 2); ctx.stroke();
      }
    }
  }
  return { start, update, hit, draw, drawHorse, drawGround, updateFx, hud, T, wx: () => WX, wxMove, wxAspd, wxProj, wxDraw,
    reset() { fx = []; horse = null; WX = null; } };
})();
