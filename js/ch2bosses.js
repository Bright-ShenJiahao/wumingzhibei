// 第二章首领技能：张梁（重甲大刀，硬拼型）、张宝（术士，远近都能打）。
// 挂在 updateChapter2Boss 里：CH2B.update(z, dt) 返回 true 表示这一帧由技能接管。
// 敌方特效一律暗橙土红，不加白色金色高光。
(() => {
  const hz = [], walls = [];   // 地面危险物：落石、地裂；walls：张宝的土墙
  const near = (z, rx, ry) => Math.abs(hero.x - z.x) < rx && Math.abs(hero.y - z.y) < ry;
  const front = (z, r) => (hero.x - z.x) * z.f > -8 && Math.abs(hero.x - z.x) < r && Math.abs(hero.y - z.y) < 16;
  const face = z => { z.f = Math.sign(hero.x - z.x) || z.f; };
  const set = (z, k, fr, extra = {}) => { z.cb = { k, t: 0, ...extra }; z.cbFrame = fr; z.st = 'move'; };
  const done = (z, cd) => { z.cb = null; z.cbFrame = null; z.cd = cd * .85;   /* 用户定：首领出手更频繁 */ z.st = 'move'; z.t = 0; };
  const tip = (z, txt) => floaters.push({ x: z.x, y: z.y - 62, t: 0, txt });
  const vo = n => { if (window.SFX && SFX.voice) SFX.voice(n); };
  const LINES = { zhang_liang: { intro: ['张梁：「人公将军张梁在此！谁敢上前！」', 'zl_intro'], die: ['张梁：「大哥……我……顶不住了……」', 'zl_die'] },
    zhang_bao: { intro: ['张宝：「地公将军在此……你来送死吗？」', 'zb_intro'], die: ['张宝：「大哥……黄天……救我……」', 'zb_die'] } };
  const armor = z => { z.stun = 0; z.daze = 0; };   // 霸体：挨打不中断

  // ---------------- 张梁 ----------------
  function liang(z, dt) {
    const C = z.cb, fast = z.rage ? .8 : 1;
    if (!z.rage && !z.fled && z.hp < z.T.hp * .5) {   // 半血怒吼：震开主角、召大刀兵、提速
      z.rage = true; z.T = { ...z.T, spd: z.T.spd * 1.25 }; set(z, 'roar', 'roar'); face(z);
      say('张梁：「都给我上！杀！」', 2.4); vo('zl_roar'); shake = .4; sfx('finisher', z.x);
      return true;
    }
    if (C) {
      C.t += dt;
      if (C.k === 'roar') {
        armor(z);
        if (C.t < .35 && near(z, 70, 30)) moveEnt(hero, Math.sign(hero.x - z.x) * 260 * dt, 0);
        if (C.t > .3 && !C.sum) { C.sum = true; z.summonedHalf = false; chapter2BossSummon(z); }
        if (C.t > 1.1) done(z, .4);
        return true;
      }
      if (C.k === 'combo') {   // 两连劈：横劈带剑气 → 重劈
        if (z.stun > 0) { done(z, .6); return false; }
        if (C.step === 0) { z.cbFrame = 'wind'; if (C.t > .55 * fast) { C.step = 1; C.t = 0; z.cbFrame = 'slash'; sfx('enemySwing', z.x);
            if (front(z, 42)) dmgHero(2, z);
            eshots.push({ k: 'enemyWave', x: z.x + z.f * 16, y: z.y, vx: z.f * 170, left: 90, t: 0, life: 1, source: z }); } }
        else if (C.step === 1) { if (C.t > .4 * fast) { C.step = 2; C.t = 0; z.cbFrame = 'wind'; } }
        else if (C.step === 2) { if (C.t > .3 * fast) { C.step = 3; C.t = 0; z.cbFrame = 'smash'; sfx('enemySwing', z.x); shake = Math.max(shake, .25);
            if (front(z, 46)) dmgHero(3, z);
            for (let i = 0; i < 10; i++) propFx.push({ x: z.x + z.f * 30 + rnd(-8, 8), y: z.y - 2, vx: rnd(-60, 60), vy: rnd(-120, -40), w: 2, h: 2, life: .45, max: .45, c: '#7a4a2a' }); } }
        else if (C.t > .8) done(z, 1);
        return true;
      }
      if (C.k === 'spin') {   // 回旋斩：霸体转 1 秒，转完头晕
        if (C.step === 0) { armor(z); z.cbFrame = 'wind'; if (C.t > .45) { C.step = 1; C.t = 0; C.hitT = 0; z.cbFrame = 'spin'; sfx('enemySwing', z.x); } }
        else if (C.step === 1) {
          armor(z); C.hitT -= dt; z.f = Math.floor(C.t * 10) % 2 ? 1 : -1;
          const dx = hero.x - z.x, dy = hero.y - z.y; moveEnt(z, Math.sign(dx) * 22 * dt, Math.sign(dy) * 10 * dt);
          if (C.hitT <= 0 && near(z, 48, 18)) { C.hitT = .45; dmgHero(2, z); }
          if (C.t > 1.1) { C.step = 2; C.t = 0; z.cbFrame = 'dizzy'; tip(z, '晕……'); face(z); }
        } else if (C.t > (z.rage ? 1 : 1.4)) done(z, .8);
        return true;
      }
      if (C.k === 'charge') {   // 冲锋：蓄力后直线冲，撞到拒马就撞碎、自己停下发晕
        if (C.step === 0) { z.cbFrame = 'wind'; armor(z); if (C.t > .6) { C.step = 1; C.t = 0; z.cbFrame = 'charge'; C.dist = 0; sfx('enemySwing', z.x); } }
        else if (C.step === 1) {
          armor(z); const step = 250 * dt, x0 = z.x; moveEnt(z, z.f * step, 0); C.dist += Math.abs(z.x - x0);
          if (!C.hit && near(z, 22, 14)) { C.hit = true; dmgHero(3, z); }
          if (z.bx) {   // 撞到障碍
            const p = props.filter(q => q.solid && !q.broken && /^jumo(_v|_vs)?$/.test(q.g) && Math.abs(propXAt(q, z.y) - z.x) < 40 && propDY(q, z.y) < 24).sort((a, b) => Math.abs(propXAt(a, z.y) - z.x) - Math.abs(propXAt(b, z.y) - z.x))[0];
            if (p) { p.hp = 1; p.hitT = 0; hitProp(p, z.f); tip(z, '咚！'); }
            shake = .35; sfx('land', z.x); C.step = 2; C.t = 0; z.cbFrame = 'dizzy';
          } else if (C.dist > 150 || z.x < arenaL + 14 || z.x > lockR - 14) { C.step = 2; C.t = 0; C.stunT = .5; z.cbFrame = 'wind'; }
        } else if (C.t > (C.stunT || 1.1)) done(z, .6);
        return true;
      }
    }
    // 选招
    z.spinCd = (z.spinCd ?? 3) - dt; z.chargeCd = (z.chargeCd ?? 2) - dt;
    const dx = Math.abs(hero.x - z.x), dy = Math.abs(hero.y - z.y);
    if (z.stun > 0) return false;
    if (z.chargeCd <= 0 && dx > 110 && dy < 14) { z.chargeCd = z.rage ? 4.5 : 6.5; face(z); set(z, 'charge', 'wind', { step: 0 }); tip(z, '冲！'); if (!z.saidCharge || Math.random() < .35) { z.saidCharge = true; say('张梁：「给我——滚开！」', 1.8); vo('zl_charge'); } return true; }
    if (z.spinCd <= 0 && dx < 50 && dy < 16) { z.spinCd = z.rage ? 5 : 7; face(z); set(z, 'spin', 'wind', { step: 0 }); tip(z, '转！'); return true; }
    if (z.cd <= 0 && dx <= z.T.reach && dy <= 15) { face(z); set(z, 'combo', 'wind', { step: 0 }); sfx('bladeAlert', z.x); return true; }
    return false;
  }

  // ---------------- 张宝 ----------------
  function bao(z, dt) {
    const C = z.cb, fast = z.rage ? .8 : 1;
    if (!z.rage && !z.fled && z.hp < z.T.hp * .5) {   // 半血：黄沙迷阵 + 召 4 个方士
      z.rage = true; set(z, 'sand', 'chant'); face(z);
      say('张宝：「黄沙迷阵——众弟子，助我！」', 2.6); vo('zb_sand'); shake = .3;
      return true;
    }
    if (C) {
      C.t += dt;
      if (C.k === 'sand') {
        armor(z);
        if (C.t > .8 && !C.sum) { C.sum = true; z.summonedHalf = false; chapter2BossSummon(z);
          const mid = (M.top + M.bot) / 2; spawn('priest', z.x + z.f * 40, mid - 40); spawn('priest', z.x + z.f * 40, mid + 40); sand.t = 9; }
        if (C.t > 1.4) done(z, .3);   // 放完立刻行动，不喘
        return true;
      }
      if (C.k === 'slash') {   // 小伤害劈砍
        if (z.stun > 0) { done(z, .5); return false; }
        if (!C.hit && C.t > .4 * fast) { C.hit = true; z.cbFrame = 'strike'; sfx('enemySwing', z.x); if (front(z, 38)) dmgHero(1.2, z); }
        if (C.t > .4 * fast + .45) done(z, .7);
        return true;
      }
      if (C.k === 'burrow') {   // 土遁：钻进地里（无敌、看不见），从远处冒出来，紧接一招地裂
        if (C.t < .35) { z.cbFrame = 'stomp2'; if (Math.random() < .6) propFx.push({ x: z.x + rnd(-14, 14), y: z.y - rnd(0, 8), vx: rnd(-50, 50), vy: rnd(-90, -30), w: 3, h: 3, life: .5, max: .5, c: '#8a6238' }); }
        else if (!C.under) { C.under = true; z.hidden = true; sfx('land', z.x); shake = Math.max(shake, .2);
          const L = (arenaL != null ? arenaL : cam.x) + 40, R = Math.min(lockR, cam.x + viewW()) - 40, away = hero.x - L > R - hero.x ? -1 : 1;
          C.tx = Math.max(L, Math.min(R, hero.x + away * 160)); C.ty = Math.max(M.top + 8, Math.min(M.bot - 8, hero.y + rnd(-20, 20))); }
        else if (C.t > 1 && z.hidden) { z.hidden = false; z.x = C.tx; z.y = C.ty; face(z); z.cbFrame = 'raise'; sfx('land', z.x); shake = Math.max(shake, .25);
          for (let i = 0; i < 14; i++) propFx.push({ x: z.x + rnd(-16, 16), y: z.y - rnd(0, 10), vx: rnd(-70, 70), vy: rnd(-140, -50), w: 3, h: 3, life: .55, max: .55, c: '#8a6238' }); }
        else if (C.t > 1.35) { done(z, .2); z.crackCd = 0; }
        return true;
      }
      if (C.k === 'crack') {   // 地裂（用户定：张宝改土系）：法杖戳地，一道裂缝朝主角冲过去
        if (C.step === 0) { if (C.t > .55 * fast) { C.step = 1; C.t = 0; z.cbFrame = 'stomp2'; shake = Math.max(shake, .25); sfx('land', z.x);
          hz.push({ k: 'crack', x0: z.x, y0: z.y, ux: C.ux, uy: C.uy, len: 0, max: 190, t: 0 }); } }
        else if (C.t > .5) done(z, .5);
        return true;
      }
      if (C.k === 'wall') {   // 土墙：在主角身后升起两道土墙堵退路（留一个缺口），5 秒后崩塌
        armor(z);
        if (!C.cast && C.t > .65 * fast) { C.cast = true; shake = Math.max(shake, .3); sfx('land', hero.x);
          const m = ASSETS.props.zb_wall;
          for (const w of C.spots) { const p = { g: 'zb_wall', x: w.x, y: w.y, w: m ? m[1] : 56, h: m ? m[2] : 19, sc: 1, hitT: 0, hp: 3, solid: true, broken: false, chapter2: true, zbWall: true }; props.push(p); walls.push({ p, at: gameT });
            for (let i = 0; i < 8; i++) propFx.push({ x: w.x + rnd(-24, 24), y: w.y - rnd(0, 6), vx: rnd(-40, 40), vy: rnd(-90, -30), w: 3, h: 3, life: .45, max: .45, c: '#8a6238' }); } }
        if (C.t > 1.1) done(z, .4);
        return true;
      }
      if (C.k === 'rain') {   // 召火球：举手 0.8 秒，主角周围砸下一片火球
        armor(z);
        if (!C.cast && C.t > .5) { C.cast = true; z.cbFrame = 'fireball';   // 铜铃发光那一帧
          const n = z.rage ? 7 : 5;
          for (let i = 0; i < n; i++) {
            const x = i === 0 ? hero.x : hero.x + rnd(-70, 70), y = i === 0 ? hero.y : Math.max(M.top + 6, Math.min(M.bot - 4, hero.y + rnd(-26, 26)));
            hz.push({ k: 'ball', x, y, t: -(1.1 + i * .18), r: 17, dir: z.x < x ? 1 : -1 });
          } }
        if (C.t > .9) done(z, .3);
        return true;
      }
    }
    z.burrowCd = (z.burrowCd ?? 0) - dt;
    if (z.burrowCd <= 0 && (z.hitLog || []).filter(t => gameT - t < 2).length >= 4 && Math.abs(hero.x - z.x) < 70) { z.burrowCd = 7; z.hitLog = []; set(z, 'burrow', 'stomp1'); say('张宝：「土遁！」', 1.2); return true; }   // 被贴身连打：土遁脱身
    z.crackCd = (z.crackCd ?? 2) - dt; z.rainCd = (z.rainCd ?? 4) - dt; z.wallCd = (z.wallCd ?? 7) - dt;
    if (z.stun > 0) return false;
    const ahead = (hero.x - z.x) * Math.sign(hero.x - z.x), dy = Math.abs(hero.y - z.y);
    if (z.rainCd <= 0) { z.rainCd = z.rage ? 6 : 8.5; face(z); set(z, 'rain', 'chant'); say('张宝：「山石，落！」', 1.4); return true; }
    if (z.wallCd <= 0 && ahead < 170) { z.wallCd = z.rage ? 8 : 11; face(z);
      const side = Math.sign(hero.x - z.x) || 1, wx = Math.max(arenaL != null ? arenaL + 30 : -1e9, Math.min(lockR - 30, hero.x + side * 48)), gap = Math.floor(Math.random() * 3), lanes = [M.top + 10, (M.top + M.bot) / 2, M.bot - 6];
      set(z, 'wall', 'raise', { spots: lanes.filter((_, i) => i !== gap).map(y => ({ x: wx, y })) }); say('张宝：「土墙，起！」', 1.4); return true; }
    if (z.crackCd <= 0 && ahead > 40 && ahead < 200) { z.crackCd = z.rage ? 4 : 5.5; face(z); const dx = hero.x - z.x, ddy = hero.y - z.y, l = Math.hypot(dx, ddy) || 1;
      set(z, 'crack', 'stomp1', { step: 0, ux: dx / l, uy: ddy / l }); return true; }
    if (z.cd <= 0 && ahead <= z.T.reach && dy <= 15) { face(z); set(z, 'slash', 'wind'); return true; }
    return false;
  }

  // 黄沙迷阵：全场昏黄，9 秒
  const sand = { t: 0 };

  function update(z, dt) {
    const L = LINES[z.type];
    if (z.dead) { if (L && !z.saidDie) { z.saidDie = true; say(L.die[0], 3.5); vo(L.die[1]); hz.length = 0; sand.t = 0; } z.cb = null; z.cbFrame = null; return false; }
    if (L && !z.saidIntro) { z.saidIntro = true; say(L.intro[0], 3); vo(L.intro[1]); }
    if (!z.planted && !z.fled && (z.type === 'zhang_liang' || z.type === 'zhang_bao')) {   // 出场亲手插下自己的将旗：张梁「人」、张宝「地」
      z.planted = true; const g = z.type === 'zhang_liang' ? 'flag_ren' : 'flag_di', m = ASSETS.props[g];
      let fx = z.x + 22; const fy = z.y - 6;   // 别插在粮袋/石堆这些道具上（用户截图：地字旗压在粮袋上）
      for (let k = 0; k < 6 && props.some(p => !p.broken && p !== z && Math.abs(p.x - fx) < (p.w || 20) / 2 + 14 && Math.abs(p.y - fy) < 30); k++) fx += 26;
      if (m) props.push({ g, x: fx, y: fy, solid: false, broken: false, hp: 2, hitT: 0, sc: 1, w: m[1] * .75, h: m[2], chapter2: true, back: true });
      shake = Math.max(shake, .2); sfx('land', z.x);
    }
    tickHz(dt);
    if (z.type === 'zhang_liang') return liang(z, dt);
    if (z.type === 'zhang_bao') return bao(z, dt);
    return false;
  }
  let lastTick = -1;
  function tickHz(dt) {
    if (lastTick === gameT) return; lastTick = gameT;
    sand.t = Math.max(0, sand.t - dt);
    for (const h of hz) {
      h.t += dt;
      if (h.k === 'ball' && h.t >= 0 && !h.done) {
        h.done = true; sfx('land', h.x); shake = Math.max(shake, .15);
        if (Math.abs(hero.x - h.x) < h.r && Math.abs(hero.y - h.y) < h.r * .5) dmgHero(2, { x: h.x, y: h.y }, 'skill');
        for (let i = 0; i < 8; i++) propFx.push({ x: h.x + rnd(-6, 6), y: h.y - 4, vx: rnd(-70, 70), vy: rnd(-120, -40), w: 2, h: 2, life: .4, max: .4, c: Math.random() < .5 ? '#c4532a' : '#7a3a1e' });
      }
    }
    for (const h of hz) if (h.k === 'crack') {
      if (h.len < h.max) h.len = Math.min(h.max, h.len + 330 * dt);
      if (!h.hit) {   // 主角离裂缝已长出的那段足够近就挨打（只打一次）
        const px = hero.x - h.x0, py = (hero.y - h.y0), along = Math.max(0, Math.min(h.len + 14, px * h.ux + py * h.uy)), ex = h.x0 + h.ux * along, ey = h.y0 + h.uy * along;
        if (along > 8 && Math.abs(hero.x - ex) < 12 && Math.abs(hero.y - ey) < 9 && heroOpen()) { h.hit = true; dmgHero(2, { x: h.x0, y: h.y0 }, 'skill'); }
      }
      if (Math.random() < .5) propFx.push({ x: h.x0 + h.ux * (14 + h.len), y: h.y0 + h.uy * (14 + h.len) - 3, vx: rnd(-40, 40), vy: rnd(-110, -40), w: 2, h: 2, life: .4, max: .4, c: Math.random() < .5 ? '#8a6238' : '#5a4028' });
    }
    for (const w of walls) if (!w.p.broken && gameT - w.at > 5 && w.p.g === 'zb_wall') { const m = ASSETS.props.zb_wall_broken; w.p.g = 'zb_wall_broken'; w.p.solid = false; w.p.fadeAt = gameT; if (m) { w.p.w = m[1]; w.p.h = m[2]; } sfx('land', w.p.x); for (let i = 0; i < 10; i++) propFx.push({ x: w.p.x + rnd(-20, 20), y: w.p.y - rnd(2, 14), vx: rnd(-50, 50), vy: rnd(-90, -30), w: 3, h: 3, life: .5, max: .5, c: '#8a6238' }); }   // 土墙 5 秒后崩塌
    for (let i = walls.length - 1; i >= 0; i--) if (walls[i].p.broken) walls.splice(i, 1);
    for (let i = hz.length - 1; i >= 0; i--) if (hz[i].t > (hz[i].k === 'crack' ? 1.3 : .5)) hz.splice(i, 1);
  }

  const sparks = [], scorch = [];
  // 用张宝的火焰图画特效：anchor 'left' 火焰根部在 (x,y)，'right' 火头在 (x,y)；sx 负数朝左
  function fxImg(name, x, y, ang, sx, sy, alpha, anchor) {
    const fr = typeof CH !== 'undefined' && CH.zhang_bao && CH.zhang_bao[name]; if (!fr || !fr.img.complete) return;
    const sp = Math.max(.5, SC * PX), w = fr.w * sp, hh = fr.h * sp;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, Math.round(x * SC + OXs), Math.round(y * SC)); ctx.rotate(ang); ctx.scale(sx, sy); ctx.globalAlpha = alpha;
    ctx.drawImage(fr.img, anchor === 'left' ? 0 : anchor === 'center' ? -w / 2 : -w, anchor === 'bottom' ? -hh : -hh / 2, w, hh); ctx.restore();
  }
  function tickFx(dt) {
    for (const p of sparks) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.g) p.vy += p.g * dt; }
    for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].t >= sparks[i].T) sparks.splice(i, 1);
    for (const c of scorch) c.t += dt;
    for (let i = scorch.length - 1; i >= 0; i--) if (scorch[i].t > 1.2) scorch.splice(i, 1);
    if (sparks.length > 400) sparks.splice(0, sparks.length - 400);
  }
  let lastT = performance.now();
  function draw() {
    if (!chapter2Run) return;
    { const n = performance.now(); tickFx(Math.min(.05, (n - lastT) / 1000)); lastT = n; }
    // 喷火：前摇时地上的土红预警条，喷火时贴火焰图
    for (const z of zs) {
      if (z.dead || !z.cb) continue;
      if (z.cb.k === 'crack' && z.cb.step === 0) {   // 地裂前摇：地上一条闪烁的土黄预警线，指向放招时主角的位置
        const C = z.cb, a = .25 + .3 * Math.sin(C.t * 22) ** 2; ctx.strokeStyle = `rgba(150,105,50,${a})`; ctx.lineWidth = 7; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(z.x + C.ux * 14, z.y + C.uy * 14); ctx.lineTo(z.x + C.ux * 200, z.y + C.uy * 200); ctx.stroke(); ctx.lineCap = 'butt';
      }
      if (z.cb.k === 'wall' && !z.cb.cast) { const a = .3 + .3 * Math.sin(z.cb.t * 20) ** 2; ctx.fillStyle = `rgba(150,105,50,${a})`; for (const w of z.cb.spots || []) ctx.fillRect(w.x - 26, w.y - 3, 52, 6); }
      if (z.cb.k === 'charge' && z.cb.step === 0) { ctx.fillStyle = 'rgba(150,60,30,.28)'; ctx.fillRect(Math.min(z.x, z.x + z.f * 150), z.y - 4, 150, 8); }
      if (z.cb.k === 'spin' && z.cb.step === 0) { ctx.strokeStyle = 'rgba(160,70,35,.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(z.x, z.y, 48, 18, 0, 0, 7); ctx.stroke(); }
    }
    // 精英：脚下暗红光晕 + 举盾范围更大的提示
    for (const e of zs) if (e.T && e.T.ch2Elite && !e.dead) {
      const pu = .5 + .5 * Math.sin(performance.now() / 260 + e.slot);
      ctx.strokeStyle = `rgba(150,40,30,${.45 + .3 * pu})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(e.x, e.y, 15 + pu * 2, 6 + pu, 0, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(120,30,20,.18)'; ctx.beginPath(); ctx.ellipse(e.x, e.y, 15, 6, 0, 0, 7); ctx.fill();
    }
    // 盾兵举盾范围：暗橙半透明圈（敌方特效色）
    for (const sh of zs) if (sh.type === 'yellow-shield' && !sh.dead && sh.shieldUpUntil > gameT) {
      const u = (sh.shieldUpUntil - gameT) / .8; ctx.fillStyle = `rgba(150,70,35,${.22 * u})`; ctx.strokeStyle = `rgba(170,80,40,${.7 * u})`; ctx.lineWidth = 1.5;
      { const r = sh.T.ch2Elite ? 65 : 45; ctx.beginPath(); ctx.ellipse(sh.x, sh.y, r, r * .49, 0, 0, 7); ctx.fill(); ctx.stroke(); }
    }
    // 火球：落点暗橙预警圈 + 从天上掉下来的火球
    for (const h of hz) {   // 地裂：裂缝沿方向一段段冒出来（土块图），之后慢慢淡掉
      if (h.k !== 'crack') continue;
      const step = 30, n = Math.floor(h.len / step), fade = h.t > .9 ? Math.max(0, 1 - (h.t - .9) / .4) : 1;
      for (let i = 0; i <= n; i++) { const dd = 14 + i * step, x = h.x0 + h.ux * dd, y = h.y0 + h.uy * dd, age = h.len - i * step, fr = age < 30 ? 'fx_crack1' : age < 70 ? 'fx_crack2' : 'fx_crack3';
        fxImg(fr, x, y + 3, 0, (h.ux >= 0 ? 1 : -1) * .75, 1.1, fade, 'bottom'); }
    }
    for (const h of hz) {
      if (h.k !== 'ball') continue;
      const d = h.dir || 1;
      if (h.t < 0) {
        const u = Math.max(0, 1 + h.t / 1.1);
        ctx.strokeStyle = `rgba(140,98,48,${.35 + .5 * u})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * .42, 0, 0, 7); ctx.stroke();
        ctx.fillStyle = `rgba(120,80,40,${.12 + .2 * u})`; ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r * u, h.r * .42 * u, 0, 0, 7); ctx.fill();
        if (h.t > -.5) {   // 斜着砸下来：从张宝那一侧的高空飞向落点，拖火星
          const k = -h.t / .5, bx = h.x - d * 110 * k, by = h.y - 8 - 160 * k, ang = Math.atan2(160, d * 110);
          fxImg('fx_rock', bx, by, 0, d > 0 ? 1 : -1, 1, 1, 'center');   // 带尘土拖尾的落石（图的拖尾朝左上，往右砸时翻转）
          if (Math.random() < .6) sparks.push({ x: bx + rnd(-4, 4), y: by + rnd(-4, 4), vx: rnd(-20, 20), vy: rnd(-30, 0), t: 0, T: rnd(.25, .45), c: Math.random() < .5 ? '#b88a5a' : '#7a5a3a', dust: true });
          if (!h.boomed && h.t > -.03) h.boomed = true;
        }
      } else {
        if (!h.burst) { h.burst = true; for (let i = 0; i < 16; i++) { const a2 = Math.random() * Math.PI, sp = rnd(50, 130); sparks.push({ x: h.x, y: h.y - 4, vx: Math.cos(a2) * sp * (Math.random() < .5 ? 1 : -1), vy: -Math.sin(a2) * sp, g: 300, t: 0, T: rnd(.35, .6), c: i % 3 ? '#b88a5a' : '#d8c098', dust: true }); } }
        const u = h.t / .5;
        ctx.save(); const g = ctx.createRadialGradient(h.x, h.y - 6, 0, h.x, h.y - 6, h.r * 1.6); g.addColorStop(0, `rgba(200,170,120,${.7 * (1 - u)})`); g.addColorStop(1, 'rgba(150,110,60,0)');   // 落地扬尘 ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(h.x, h.y - 6, h.r * 1.6 * (1 + u * .5), h.r * (1 + u * .5), 0, 0, 7); ctx.fill(); ctx.restore();
        ctx.fillStyle = `rgba(110,80,45,${.45 * (1 - u)})`; ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r * (1 + u * .4), h.r * .45 * (1 + u * .4), 0, 0, 7); ctx.fill();
        if (h.t > .45 && !h.scorched) { h.scorched = true; scorch.push({ x: h.x, y: h.y, r: h.r, t: 0 }); }
      }
    }
    for (const c of scorch) { const a = Math.min(1, (1.2 - c.t) / .4) * .5; ctx.fillStyle = `rgba(30,18,12,${a})`; ctx.beginPath(); ctx.ellipse(c.x, c.y, c.r * .9, c.r * .38, 0, 0, 7); ctx.fill(); if (Math.random() < .15) sparks.push({ x: c.x + rnd(-c.r * .6, c.r * .6), y: c.y, vx: 0, vy: rnd(-30, -15), t: 0, T: .5, c: '#aa4a22' }); }
    // 张宝身边慢慢上升的火星 + 脚下暗红光
    for (const z of zs) if (z.type === 'zhang_bao' && !z.dead) {
      ctx.save(); const g = ctx.createRadialGradient(z.x, z.y, 0, z.x, z.y, 26); g.addColorStop(0, 'rgba(120,85,45,.35)'); g.addColorStop(1, 'rgba(120,85,45,0)');   // 地公将军：脚下土色 ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(z.x, z.y, 26, 9, 0, 0, 7); ctx.fill(); ctx.restore();
      if (Math.random() < .2) sparks.push({ x: z.x + rnd(-16, 16), y: z.y - rnd(0, 6), vx: rnd(-10, 10), vy: rnd(-14, -6), t: 0, T: rnd(.6, 1.1), c: Math.random() < .5 ? '#a07848' : '#c8a878', dust: true });   // 脚边浮起的尘土
    }
    ctx.save();
    for (const p of sparks) { ctx.globalCompositeOperation = p.dust ? 'source-over' : 'lighter'; const a = 1 - p.t / p.T; ctx.fillStyle = p.c; ctx.globalAlpha = a; ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); }
    ctx.restore();
    if (sand.t > 0) { const a = Math.min(1, sand.t, (9 - sand.t) * 2) * .22; ctx.fillStyle = `rgba(170,130,60,${a})`; ctx.fillRect(cam.x - 4, 0, viewW() + 8, 600); }
    // 黄沙迷阵：横飞的沙粒（主角移速 -25%，在 game.js 里算）
    if (sand.t > 0) { const T = performance.now() / 1000, a = Math.min(1, sand.t, (9 - sand.t) * 2); ctx.fillStyle = `rgba(214,170,90,${.55 * a})`; for (let i = 0; i < 46; i++) { const x = cam.x + ((i * 97 + T * (160 + i % 5 * 30)) % (viewW() + 40)) - 20, y = M.top - 60 + (i * 53 % 200) + Math.sin(T * 3 + i) * 4; ctx.fillRect(x, y, 3 + i % 3, 1); } }
  }
  function reset() { hz.length = 0; sand.t = 0; sparks.length = 0; scorch.length = 0; }

  window.CH2B = { update, draw, reset, sandOn: () => sand.t > 0 };
})();
