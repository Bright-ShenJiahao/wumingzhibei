// 第二章首领技能：张梁（重甲大刀，硬拼型）、张宝（术士，远近都能打）。
// 挂在 updateChapter2Boss 里：CH2B.update(z, dt) 返回 true 表示这一帧由技能接管。
// 敌方特效一律暗橙土红，不加白色金色高光。
(() => {
  const hz = [];   // 地面危险物：火球落点等
  const near = (z, rx, ry) => Math.abs(hero.x - z.x) < rx && Math.abs(hero.y - z.y) < ry;
  const front = (z, r) => (hero.x - z.x) * z.f > -8 && Math.abs(hero.x - z.x) < r && Math.abs(hero.y - z.y) < 16;
  const face = z => { z.f = Math.sign(hero.x - z.x) || z.f; };
  const set = (z, k, fr, extra = {}) => { z.cb = { k, t: 0, ...extra }; z.cbFrame = fr; z.st = 'move'; };
  const done = (z, cd) => { z.cb = null; z.cbFrame = null; z.cd = cd; z.st = 'move'; z.t = 0; };
  const tip = (z, txt) => floaters.push({ x: z.x, y: z.y - 62, t: 0, txt });
  const vo = n => { if (window.SFX && SFX.voice) SFX.voice(n); };
  const LINES = { zhang_liang: { intro: ['张梁：「人公将军张梁在此！谁敢上前！」', 'zl_intro'], die: ['张梁：「大哥……我……顶不住了……」', 'zl_die'] },
    zhang_bao: { intro: ['张宝：「地公将军在此……你来送死吗？」', 'zb_intro'], die: ['张宝：「大哥……黄天……救我……」', 'zb_die'] } };
  const armor = z => { z.stun = 0; z.daze = 0; };   // 霸体：挨打不中断

  // ---------------- 张梁 ----------------
  function liang(z, dt) {
    const C = z.cb, fast = z.rage ? .8 : 1;
    if (!z.rage && z.hp < z.T.hp * .5) {   // 半血怒吼：震开主角、召大刀兵、提速
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
    if (z.cd <= 0 && dx <= z.T.reach && dy <= 10) { face(z); set(z, 'combo', 'wind', { step: 0 }); sfx('bladeAlert', z.x); return true; }
    return false;
  }

  // ---------------- 张宝 ----------------
  function bao(z, dt) {
    const C = z.cb, fast = z.rage ? .8 : 1;
    if (!z.rage && z.hp < z.T.hp * .5) {   // 半血：黄沙迷阵 + 召 4 个方士
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
      if (C.k === 'breath') {   // 往前喷火：0.5 秒前摇（地上土红预警条），喷 0.9 秒
        if (C.step === 0) { if (C.t > .5) { C.step = 1; C.t = 0; sfx('sling', z.x); } }
        else if (C.step === 1) {
          armor(z); C.tick = (C.tick || 0) - dt;
          const ahead = (hero.x - z.x) * z.f;
          if (C.tick <= 0 && ahead > 6 && ahead < 115 && Math.abs(hero.y - z.y) < 13) { C.tick = .35; dmgHero(1.5, z, 'skill'); }
          if (C.t > .9) { done(z, .3); return true; }
        } else if (C.t > .8) done(z, .8);
        return true;
      }
      if (C.k === 'rain') {   // 召火球：举手 0.8 秒，主角周围砸下一片火球
        armor(z);
        if (!C.cast && C.t > .5) { C.cast = true;
          const n = z.rage ? 7 : 5;
          for (let i = 0; i < n; i++) {
            const x = i === 0 ? hero.x : hero.x + rnd(-70, 70), y = i === 0 ? hero.y : Math.max(M.top + 6, Math.min(M.bot - 4, hero.y + rnd(-26, 26)));
            hz.push({ k: 'ball', x, y, t: -(1.1 + i * .18), r: 17 });
          } }
        if (C.t > .9) done(z, .3);
        return true;
      }
    }
    z.breathCd = (z.breathCd ?? 2) - dt; z.rainCd = (z.rainCd ?? 4) - dt;
    if (z.stun > 0) return false;
    const ahead = (hero.x - z.x) * Math.sign(hero.x - z.x), dy = Math.abs(hero.y - z.y);
    if (z.rainCd <= 0) { z.rainCd = z.rage ? 6 : 8.5; face(z); set(z, 'rain', 'fireball'); say('张宝：「天火，降！」', 1.4); if (!z.saidFire || Math.random() < .35) { z.saidFire = true; vo('zb_fire'); } return true; }
    if (z.breathCd <= 0 && ahead > 36 && ahead < 105 && dy < 18) { z.breathCd = z.rage ? 4 : 5.5; face(z); set(z, 'breath', 'breath', { step: 0 }); return true; }
    if (z.cd <= 0 && ahead <= z.T.reach && dy <= 10) { face(z); set(z, 'slash', 'wind'); return true; }
    return false;
  }

  // 黄沙迷阵：全场昏黄，9 秒
  const sand = { t: 0 };

  function update(z, dt) {
    const L = LINES[z.type];
    if (z.dead) { if (L && !z.saidDie) { z.saidDie = true; say(L.die[0], 3.5); vo(L.die[1]); hz.length = 0; sand.t = 0; } z.cb = null; z.cbFrame = null; return false; }
    if (L && !z.saidIntro) { z.saidIntro = true; say(L.intro[0], 3); vo(L.intro[1]); }
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
    for (let i = hz.length - 1; i >= 0; i--) if (hz[i].t > .5) hz.splice(i, 1);
  }

  function draw() {
    if (!chapter2Run) return;
    // 喷火：前摇时地上的土红预警条，喷火时贴火焰图
    for (const z of zs) {
      if (z.dead || !z.cb) continue;
      if (z.cb.k === 'breath') {
        if (z.cb.step === 0) { ctx.fillStyle = `rgba(150,60,30,${.2 + .25 * Math.sin(z.cb.t * 20) ** 2})`; ctx.fillRect(Math.min(z.x, z.x + z.f * 112), z.y - 6, 112, 12); }
        else if (z.cb.step === 1) { const fl = Math.sin(z.cb.t * 30) * 2; drawChar('zhang_bao', 'flame', z.x + z.f * (58 + fl), z.y - 14, z.f < 0, .9, false, z.sc || 1); }
      }
      if (z.cb.k === 'charge' && z.cb.step === 0) { ctx.fillStyle = 'rgba(150,60,30,.28)'; ctx.fillRect(Math.min(z.x, z.x + z.f * 150), z.y - 4, 150, 8); }
      if (z.cb.k === 'spin' && z.cb.step === 0) { ctx.strokeStyle = 'rgba(160,70,35,.6)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(z.x, z.y, 48, 18, 0, 0, 7); ctx.stroke(); }
    }
    // 火球：落点暗橙预警圈 + 从天上掉下来的火球
    for (const h of hz) {
      if (h.k !== 'ball') continue;
      if (h.t < 0) {
        const u = Math.max(0, 1 + h.t / 1.1);
        ctx.strokeStyle = `rgba(170,76,44,${.35 + .5 * u})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * .42, 0, 0, 7); ctx.stroke();
        if (h.t > -.45) { const fy = h.y - 140 * (-h.t / .45); ctx.fillStyle = '#b8481f'; ctx.beginPath(); ctx.arc(h.x, fy - 6, 5, 0, 7); ctx.fill(); ctx.fillStyle = '#e07a3a'; ctx.beginPath(); ctx.arc(h.x, fy - 7, 2.5, 0, 7); ctx.fill(); }
      } else { const u = h.t / .5; ctx.fillStyle = `rgba(160,60,25,${.5 * (1 - u)})`; ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r * (1 + u * .4), h.r * .45 * (1 + u * .4), 0, 0, 7); ctx.fill(); }
    }
    if (sand.t > 0) { const a = Math.min(1, sand.t, (9 - sand.t) * 2) * .22; ctx.fillStyle = `rgba(170,130,60,${a})`; ctx.fillRect(cam.x - 4, 0, viewW() + 8, 600); }
  }
  function reset() { hz.length = 0; sand.t = 0; }

  window.CH2B = { update, draw, reset, sandOn: () => sand.t > 0 };
})();
