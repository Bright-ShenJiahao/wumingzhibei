// 主角攻击：蓄力、各武器出招、命中判定、主角受伤（2026-10-31 从 game.js 原样拆出，逻辑不变）
// 依赖 game.js 的全局变量，只在运行时调用；本文件加载时不访问 game.js 的变量。
function atkPress() {
  if (over) return;   // 结算界面由 resultKey 处理（J 确定当前选中的按钮）
  if (atkHeldSince) return;
  atkHeldSince = performance.now(); charging = false; chargeTier = 0; chargeTierFlash = 0;
}
function atkRelease() {
  if (!atkHeldSince) return;
  const held = performance.now() - atkHeldSince;
  atkHeldSince = 0;
  const canAct = hero.st !== 'down' && hero.st !== 'hurt' && !hero.air && !over;
  const tier = chargeTierFor(held);
  if (held >= chargeGateMs()) {
    charging = false;
    if (canAct) { const p0 = Math.min(1, held / chargeMaxMs()); if (window.ROGUE && ROGUE.onChargeRelease) ROGUE.onChargeRelease(); chargedAttack(p0, tier); }
    chargeTier = 0; chargeTierFlash = 0;
    return;
  }
  charging = false; chargeTier = 0; chargeTierFlash = 0;
  if (canAct) {
    if (hero.st === 'atk') hero.q = 1;
    else pressAtk = true;
  }
}
function cancelCharge() { charging = false; atkHeldSince = 0; chargeTier = 0; chargeTierFlash = 0; }

// 长戟「裂伤」：与血刃词条完全分开的一套层数/流血状态。
function halberdStacks(z) { return z && z.halberdBleed > 0 && gameT < z.halberdBleedUntil ? z.halberdBleed : 0; }
function bowRangeMult(d) { return d < 100 ? 1 : d < 200 ? 1.15 : 1.3; }   // 用户定：取消近距离减伤
function resolveBowSky(f) {
  const d = f.data;
  if (f.mirror) { if (Math.hypot(hero.x - f.x, (hero.y - f.y) * 2) <= d.radius + 6) { const hp0 = hero.hp; dmgHero(d.dmg * (hero.dazeT > 0 ? 1.5 : 1), { x: f.x, y: f.y }, 'skill'); if (hero.hp < hp0 && !(hero.dazeT > 0)) hero.dazeT = d.stun; } sfx('finisher', f.x); return; }   // 心魔的穿云箭打你
  for (const z of zs) {
    if (z.dead || Math.hypot(z.x - f.x, (z.y - f.y) * 2) > d.radius + (z.T.w || 0)) continue;   // 地面是扁的：上下范围只有左右的一半，和冲击环形状一致
    const boss = z.T.boss || z.T.chapterBoss;
    const stun = boss ? d.stun / 2 : d.stun;
    hit(z, d.dmg, 0, 0, false, 0, stun, false, false, { skyArrow: true });
    if (boss && !z.dead) z.stun = Math.max(z.stun || 0, stun);
  }
  sfx('finisher', f.x);
}
function addHalberdBleed(z, base, stacks = 1) {
  if (!z || z.dead) return 0;
  const alive = halberdStacks(z);
  z.halberdBleed = Math.min(window.ROGUE && ROGUE.has('血债') ? 8 : 5, (alive || 0) + stacks);   // 血债：上限 8
  if (alive === 4 && z.halberdBleed === 5) bleedFx.push({ kind: 'splash', x: z.x, y: z.y - 12, t: 0, T: .18, big: true });
  z.halberdBleedUntil = gameT + 3;
  z.halberdBleedBase = base;
  if (!alive || !z.halberdBleedNext || z.halberdBleedNext <= gameT) z.halberdBleedNext = gameT + 1;
  if (!z.halberdBleedDripAt || z.halberdBleedDripAt <= gameT) z.halberdBleedDripAt = gameT + rnd(.25, .55);
  return z.halberdBleed;
}
function clearHalberdBleed(z) {
  if (!z) return;
  z.halberdBleed = 0; z.halberdBleedUntil = 0; z.halberdBleedBase = 0;
  z.halberdBleedNext = 0; z.halberdBleedDripAt = 0;
}
function updateHalberdBleed(dt) {
  for (const z of zs) {
    if (z.dead || !(z.halberdBleed > 0)) continue;
    if (gameT >= z.halberdBleedUntil) { clearHalberdBleed(z); continue; }
    if (z.halberdBleedNext && gameT >= z.halberdBleedNext) {
      z.halberdBleedNext += 1;
      const dot = z.halberdBleed * .08 * (z.halberdBleedBase || 0);
      if (dot > 0) hit(z, dot, 0, 0, false, 0, 0, false, false, { dot: true, secondary: true, halberdBleed: true });
    }
    if (z.halberdBleedDripAt && gameT >= z.halberdBleedDripAt) {
      z.halberdBleedDripAt = gameT + rnd(.3, .65) * (1.2 - z.halberdBleed * .15);   // 层数越多滴得越快
      bleedFx.push({ kind: 'drip', x: z.x + rnd(-7, 7), y: z.y - rnd(8, 26), t: 0, T: .16 });
    }
  }
  for (const f of bleedFx) f.t += dt;
  bleedFx = bleedFx.filter(f => f.t < f.T);
}

// 蓄力重击：三种武器各不相同；命中只在释放时结算一次，动画仅作表现。
function addChargeHitFx(kind, x, y, f = 1) {
  const T = kind === 'hammer' ? .27 : .22;
  chargeHitFx.push({ kind, x, y, f, t: 0, T });
  if (chargeHitFx.length > 32) chargeHitFx.shift();
}
function drawChargeHitFx() {
  if (window.GEAR) GEAR.draw();
  for (const q of chargeHitFx) {
    const im = IMG['ui_charge_hit_' + q.kind];
    if (!im || !im.complete || !im.naturalWidth) continue;
    const n = q.kind === 'staff' ? 4 : 3;
    const frame = Math.min(n - 1, Math.floor(q.t / q.T * n));
    const w = q.kind === 'staff' ? 58 : q.kind === 'hammer' ? 58 : 23;
    const h = q.kind === 'staff' ? 45 : q.kind === 'hammer' ? 36 : 22;
    ctx.save();
    ctx.globalAlpha = Math.min(1, (1 - q.t / q.T) * 1.3);
    ctx.translate(q.x, q.y);
    if (q.kind === 'staff') ctx.scale(q.f, 1);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(im, frame * 160, 0, 160, 120, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}

// 长戟蓄力「回马突」的冲刺：每帧前进，经过的敌人各打一次并叠裂伤，身后留残影
function updateHalberdDash(h, dt) {
  const d = h.halberdDash; if (!d) return;
  const step = Math.min(d.left, d.sp * dt);
  moveEnt(h, h.f * step, 0); d.left -= step;
  d.ghostT -= dt;
  if (d.ghostT <= 0) { d.ghostT = .035; ghosts.push({ x: h.x, y: h.y, f: h.f, a: .4, t: 0 }); }
  for (const z of zs) {
    if (z.dead || z.air || d.hitSet.has(z)) continue;
    const dx = (z.x - h.x) * h.f, bw = z.T.w || 0;
    if (dx < -14 - bw || dx > 18 + bw || Math.abs(z.y - h.y) > d.dy) continue;
    d.hitSet.add(z);
    if(chapter2Run&&z.type==='yellow-shield')d.left=0;
    hit(z, d.dmg, d.kb, h.f, false, 0, .35, WEAP.halberd.interrupt, false, { finisher: true, halberdCharge: true });
    if (!z.dead) {
      addHalberdBleed(z, window.GEAR && GEAR.attackScale ? GEAR.attackScale(z) : 1, d.stacks);
      bleedFx.push({ kind: 'splash', x: z.x, y: z.y - 12, t: 0, T: .15 });
    }
    if (d.hitSet.size === 1) { sfx('hit_staff', z.x); sfx('finisher', h.x); }
    if(chapter2Run&&z.type==='yellow-shield')break;
  }
  if (d.left <= 0 || h.st === 'hurt' || h.st === 'down') h.halberdDash = null;
}
function chargedAttack(power, tier = 1) {
  const h = hero, W = WEAP[weapon];
  h.q = 0; h.comboWin = 0;
  h.atk = { c: W.combo.length - 1, fi: 0, t: 0, lg: 0, visualOnly: true, gearToken: window.GEAR ? GEAR.attackToken(true) : null }; set(h, 'atk');
  chargeFx.push({ x: h.x, y: h.y, t: 0, T: .45, w: weapon, f: h.f, power, tier });
  sfx('finisher', h.x); shake = Math.max(shake, .12 + .18 * power);
  const force = .35 + .65 * power;
  const R = 64 * (window.GEAR ? GEAR.range() : 1);
  if (weapon === 'bow') {                         // 穿云箭：先标记落点，再从右上方落下
    if (window.BOWAMMO && !BOWAMMO.use()) { floaters.push({ x: h.x, y: h.y - 50, t: 0, txt: '蓄力箭不足' }); sfx('roll', h.x); return; }   // 蓄力箭用完
    const data = tier === 3 ? { radius: 45, dmg: 2.4, stun: 1 }   // 用户反馈太强、范围太大：伤害和半径都下调
      : tier === 2 ? { radius: 36, dmg: 1.9, stun: .8 }
      : { radius: 28, dmg: 1.4, stun: .6 };
    let target = null, best = Infinity;
    for (const z of zs) {
      if (z.dead) continue;
      const dx = (z.x - h.x) * h.f;
      if (dx > 0 && dx <= 250 && dx < best) { best = dx; target = z; }
    }
    const landX = target ? target.x : h.x + h.f * 150;
    const landY = target ? target.y : h.y;
    bowFx.push({ kind: 'sky', x: landX, y: landY, t: 0, T: .6, dir: h.f, data, resolved: false });
    return;
  }
  if (weapon === 'stone') {                        // 石子蓄力：按档位 3/4/5 颗，0.12 夹角
    const stoneVolley = { hit: new Set() };   // 用户定：同一次蓄力打中同一个敌人，第 2 颗起只吃 30%、不续晕
    const data = tier === 3 ? { n: 5, dmg: 1.6, chance: .6, time: .7 }   /* 用户定 10/31：石子控制降低 */
      : tier === 2 ? { n: 4, dmg: 1.2, chance: .4, time: .6 }
      : { n: 3, dmg: .8, chance: .25, time: .5 };
    const run2 = Math.hypot(h.ix || 0, h.iy || 0) > .2;
    for (let i = 0; i < data.n; i++) {
      const ang = (i - (data.n - 1) / 2) * .12;
      const C = Object.assign({}, W.combo[0], { dmg: data.dmg, spd: 310, life: .8, dazeChance: data.chance, dazeTime: data.time, daze: 1 });
      shots.push({ x: h.x + h.f * 16, y: h.y + (run2 ? rnd(-6, 6) : 0), z: 24, vx: h.f * C.spd * Math.cos(ang), vy: C.spd * Math.sin(ang) * .5, life: C.life, C, c: 0, hitSet: [], gearToken:h.atk.gearToken, charged: true, chargeTier: tier, stoneVolley });
    }
    return;
  }
  if (weapon === 'halberd') {                      // 长戟蓄力「回马突」：按档位向前冲并沿途叠裂伤
    const data = tier === 3 ? { dist: 80, dmg: 2.8, stacks: 4 }
      : tier === 2 ? { dist: 60, dmg: 2.2, stacks: 3 }
      : { dist: 40, dmg: 1.6, stacks: 2 };
    const dmg = data.dmg;   // 档位已决定伤害，不再乘蓄力系数
    // 不再瞬移：交给 updateHalberdDash 每帧往前冲，能看到身形和残影
    h.halberdDash = { left: data.dist, sp: 260, dmg, stacks: data.stacks, hitSet: new Set(), ghostT: 0, kb: W.combo[0].kb, dy: W.dy + 8 };
    h.inv = Math.max(h.inv || 0, data.dist / 260 + .05);   // 冲刺途中无敌，方便突围
    return;
  }
  if (weapon === 'hammer') {                       // 锤子蓄力「千斤坠」：按档位前方扇形，全部击倒（首领只打断）
    const data = tier === 3 ? { range: 80, dmg: 3.6, size: 90 }
      : tier === 2 ? { range: 65, dmg: 2.8, size: 75 }
      : { range: 50, dmg: 2.0, size: 60 };
    const range = data.range * (window.GEAR ? GEAR.range() : 1);
    const dmg = data.dmg;   // 档位已决定伤害，不再乘蓄力系数
    hammerFx.push({ kind: 'slam', x: h.x + h.f * 30, y: h.y, t: 0, T: .28, size: data.size });   // 锤头落点在正前方
    for (const z of zs) {
      if (z.dead || z.air) continue;
      const dx = (z.x - h.x) * h.f, dy = z.y - h.y, bw = z.T.w || 0;
      if (dx < -12 || dx > range + bw || Math.abs(dy) > Math.max(24, dx * .7 + 14)) continue;
      hit(z, dmg, W.combo[W.combo.length - 1].kb, h.f, true, 0, .35, W.interrupt, false, { charged: true, noBossKnock: true, knockSiege: true, hammerSlam: true });
    }
    return;
  }
  if (weapon === 'blade') {                        // 大刀蓄力「半月斩」：前方上下各45，高概率暴击
    const data = tier === 3 ? { dmg: 2.6, chance: .8, knock: true }
      : tier === 2 ? { dmg: 2.0, chance: .6, knock: false }
      : { dmg: 1.4, chance: .4, knock: false };
    const dmg = data.dmg;   // 档位已决定伤害，不再乘蓄力系数
    bladeFx.push({ kind: 'crescent', x: h.x + h.f * 30, y: h.y - 16, t: 0, T: .3, dir: h.f });
    for (const z of zs) {
      if (z.dead || z.air) continue;
      const dx = (z.x - h.x) * h.f, dy = z.y - h.y, bw = z.T.w || 0;
      if (dx < -12 || dx > 45 + bw || Math.abs(dy) > 45) continue;
      hit(z, dmg, data.knock ? 80 : 55, h.f, data.knock, 0, .15, W.interrupt, false, { charged: true, critChance: data.chance, critCap: 2, guaranteedCrit: critT > 0, noBossKnock: data.knock });
    }
    return;
  }
  for (const z of zs) {
    if (z.dead) continue;
    if (z.hidden && Math.hypot(hero.x - z.x, hero.y - z.y) > 88) continue;   // 还藏着的伏兵不画
    const dx = (z.x - h.x) * h.f, dy = z.y - h.y;
    if (Math.abs(dy) > 26) continue;
    const rear = dx < 0 && Math.abs(dy) < -dx * 1.732;
    if (!rear && Math.hypot(dx, dy) < R + (z.T.w || 0)) {
      const dmg = 1.6 * force;
      hit(z, dmg, 140 * force, h.f, true, 0, .35, false, false, { charged: true, dazeChance: 0 });   /* 用户定 10/31：棍蓄力只击倒，不再附带晕 */
      addChargeHitFx('staff', z.x, z.y - 15, h.f);
    }
  }
  for (const v of villagers) {
    if (v.state === 'gone') continue;
    const dx = (v.x - h.x) * h.f, dy = v.y - h.y;
    if (Math.hypot(dx, dy) < R + 10 && Math.abs(dy) < 26) v.flash = .12;
  }
}
function startAtk() {
  const h = hero;
  if (IS_TOUCH && !(joy && Math.abs(joy.dx) > .3)) {   // 手机：没在推摇杆左右时，自动面向身边最近的敌人
    let best = null, bd = 1e9;
    for (const z of zs) { if (z.dead || z.ally || z.decoy) continue; const dx = z.x - h.x, dy = Math.abs(z.y - h.y); if (Math.abs(dx) > 90 || dy > 30) continue; const d = Math.abs(dx) + dy * 2; if (d < bd) { bd = d; best = z; } }
    if (best && Math.abs(best.x - h.x) > 4) h.f = Math.sign(best.x - h.x);
  }
  // 上一下在连招窗口内打中了敌人 → 接下一下；否则从第一下开始
  const chain = h.comboWin > 0 && gameT - (h.lastHit || -9) < .7 && h.lastHitC === h.combo;
  const fin = window.ROGUE && ROGUE.takeFinisher && ROGUE.takeFinisher();   // 回锋 / 倒持：下一下直接是终段
  set(h, 'atk'); h.atk = { weak: fin === 'swap', huifeng: fin === 'huifeng', c: fin ? WEAP[weapon].combo.length - 1 : chain ? (h.combo + 1) % WEAP[weapon].combo.length : 0, fi: 0, t: 0, lg: 0, gearToken: window.GEAR ? GEAR.attackToken() : null };
}
function strike() {
  const h = hero, W = WEAP[weapon], c = h.atk.c, C = W.combo[c];
  if (W.proj) {
    sfx('swing_stone', h.x); h.lastShotC = c;
    const finisher = c === W.combo.length - 1;
    if (weapon === 'bow' && finisher) {                        // 连珠箭：3~5 支 ±8° 小扇形
      const n = 3 + Math.floor(rnd(0, 3)), spread = 8 * Math.PI / 180;
      bowFx.push({ kind: 'volley', x: h.x + h.f * 20, y: h.y - 22, t: 0, T: .2, dir: h.f });
      for (let i = 0; i < n; i++) {
        const ang = n === 1 ? 0 : (i - (n - 1) / 2) * (spread * 2 / (n - 1));
        const C2 = { ...C, pierce: false, noPierce: true };   /* 连珠箭每支 = 第三段 dmg（用户定 10/31：0.75） */
        shots.push({ x: h.x + h.f * 16, y: h.y, z: 22, vx: h.f * C.spd * Math.cos(ang), vy: C.spd * Math.sin(ang) * .5, life: C.life, C: C2, c, hitSet: [], gearToken: h.atk.gearToken, kind: 'arrow', volley: true, final: true });
      }
      return;
    }
    const mainC = C;
    const running = Math.hypot(h.ix || 0, h.iy || 0) > .2;   // 有方向输入 = 跑动中投掷
    const sOff = running ? (weapon === 'bow' ? rnd(-3, 3) : rnd(-6, 6)) : 0;   // 跑动中弹道偏：石子 ±6、汉弓 ±3，站定不偏
    shots.push({ x: h.x + h.f * 16, y: h.y + sOff, z: 22, vx: h.f * C.spd * (window.Boss && Boss.wxProj ? Boss.wxProj() : 1), life: C.life || (C.pierce ? 1.1 : .8), C: mainC, c, hitSet: [], gearToken:h.atk.gearToken, kind: weapon === 'bow' ? 'arrow' : undefined, final: finisher, bowPierce: weapon === 'bow' && !finisher && Math.random() < .3 });   /* 用户定 10/31：汉弓普攻 30% 穿透 1 人 */
    if (window.ROGUE && ROGUE.onShoot) ROGUE.onShoot(C, c, finisher, sOff);   // 飞蝗散弹、矢如连珠副弹
    if (weapon === 'stone' && finisher) {                     // 全力投自带左右两颗30%副弹
      const sideToken = h.atk.gearToken ? { ...h.atk.gearToken, crit: false, projectileExtrasChecked: true } : null;
      for (const ang of [-.20944, .20944]) {
        const C2 = { ...C, dmg: C.dmg * .3, noPierce: true, daze: 0, dazeChance: 0, dazeTime: 0 };
        shots.push({ x: h.x + h.f * 16, y: h.y + sOff, z: 22, vx: h.f * C.spd * Math.cos(ang), vy: C.spd * Math.sin(ang) * .5, life: C.life || .8, C: C2, c, hitSet: [], gearToken: sideToken, secondary: true });
      }
    }
    return;
  }
  let landed = false, hitEnemy = false;
  const reach = W.reach * (window.GEAR ? GEAR.range() : 1);
  const rch = C.thrust ? reach * 1.35 : reach;                          // 「戳」比劈多 35% 距离
  const finisher = c === W.combo.length - 1;
  const isFinisher = finisher;
  const fin = 1;
  const hammerFinisher = weapon === 'hammer' && isFinisher;
  const bladeFinisher = weapon === 'blade' && isFinisher;
  let spinHits = 0;
  if (hammerFinisher) hammerFx.push({ kind: 'spin', x: h.x, y: h.y, t: 0, T: .3, size: 70 });
  if (bladeFinisher) bladeFx.push({ kind: 'slash', x: h.x + h.f * 30, y: h.y - 16, t: 0, T: .24, dir: h.f });
  for (const z of zs) {
    if (z.dead || z.air) continue;
    const dx = (z.x - h.x) * h.f;
    const bw = z.T.w || 0;
    const backTol = Math.max(16, rch * .6);   // 贴身/刚冲过头也算命中
    const inRange = hammerFinisher ? Math.hypot(z.x - h.x, z.y - h.y) <= 40 + bw : (C.both ? Math.abs(dx) < rch + bw : dx > -backTol - bw && dx < rch + bw);
    if (inRange && (hammerFinisher || Math.abs(z.y - h.y) < W.dy)) {
      landed = hitEnemy = true;
      // 背刺：从敌人背后打 ×1.5；补刀：敌人倒地中 ×2；完美闪避暴击 ×2
      const behind = Math.sign(h.x - z.x) !== z.f;   // 主角在敌人背后（敌人朝另一侧）
      const downed = z.st === 'land' || z.air;
      let mult = 1;
      if (behind) mult *= 1.5;
      if (downed) mult *= 2;

      if (behind || downed) floaters.push({ x: z.x, y: z.y - 26, t: 0, txt: downed ? '补刀！' : '背击！', big: true });
      if (hammerFinisher && spinHits++ > 0) mult *= .6;   // 用户定（伤害测试场）：回旋锤第 2 个起每人 60%，群体伤害不再碾压
      let attackDmg = C.dmg * fin * mult;

      const hitDir = hammerFinisher ? (Math.sign(z.x - h.x) || h.f) : (C.both ? Math.sign(z.x - h.x) || h.f : h.f);
      hit(z, attackDmg, C.kb, hitDir, C.knock, C.daze || 0, .35, W.interrupt, false, { finisher: isFinisher, guaranteedCrit: critT > 0 || bladeFinisher, ...(bladeFinisher ? { critCap: 2 } : {}), ...(weapon === 'staff' && isFinisher ? { dazeChance: 1 } : {}), ...(hammerFinisher ? { noBossKnock: true, knockSiege: true } : {}) });
      const execLine = window.ROGUE && ROGUE.has('斩首') ? .25 : .15;   // 用户定：斩杀线 25%→15%（斩首 35%→25%）
      if (bladeFinisher && !z.dead && !z.T.boss && !z.T.chapterBoss && (z.T.elite || z.T.ch2Elite) && z.hp > 0 && z.hp < z.T.hp * execLine) hit(z, .66, 0, h.f, false, 0, 0, false, false, { secondary: true });   // 精英不被斩杀，改为补 30% 伤害
      else if (bladeFinisher && !h.atk?.execDone && !z.dead && !z.T.boss && !z.T.chapterBoss && z.hp > 0 && z.hp < z.T.hp * execLine) {
        if (h.atk) h.atk.execDone = true;   // 一刀最多斩 1 个
        if (window.ROGUE && ROGUE.onExecute) ROGUE.onExecute();
        z.hp = 0; z.dead = 1; kills++; set(z, 'land');
        if (z.villagerChaser) thankVillagers();
        if (z.T.elite) { spawnDrop(z.x - 8, z.y, 'leg'); if (!chapter2Run) spawnDrop(z.x + 12, z.y); sfx('finisher', z.x); }
        floaters.push({ x: z.x, y: z.y - 40, t: 0, txt: '斩！', big: true, gold: true });
        sfx('finisher', z.x);
      }
      if (weapon === 'halberd') {
        if (!z.dead) {
          const unit = mult * (window.GEAR && GEAR.attackScale ? GEAR.attackScale(z) : 1);   // 主攻击（不含段数倍率）
          const stacks = addHalberdBleed(z, unit, 1);
          if (isFinisher) {
            const rupture = stacks * .3 * unit;
            clearHalberdBleed(z);
            hit(z, rupture, 0, 0, false, 0, 0, false, false, { secondary: true, halberdRupture: true });
            if (window.ROGUE && ROGUE.has('血债')) for (const o of zs) if (o !== z && !o.dead && !o.air && Math.hypot(o.x - z.x, (o.y - z.y) * 2) < 50) { hit(o, rupture * .5, 0, 0, false, 0, 0, false, false, { secondary: true }); bleedFx.push({ kind: 'splash', x: o.x, y: o.y - 12, t: 0, T: .15 }); }   // 血债：溅给周围
            bleedFx.push({ kind: 'rip', x: z.x, y: z.y - 12, t: 0, T: .2 });
            bleedFx.push({ kind: 'splash', x: z.x, y: z.y - 12, t: 0, T: .15 });
            floaters.push({ x: z.x, y: z.y - 38, t: 0, txt: (Math.round(rupture * 10) / 10).toFixed(1), big: true, red: true });
            freeze = Math.max(freeze, .12);
          } else {
            bleedFx.push({ kind: 'splash', x: z.x, y: z.y - 12, t: 0, T: .15 });
          }
        }
      } else if (weapon === 'staff' && isFinisher) {
        bluntHits.push({ x: z.x, y: z.y - 14, t: 0, T: .2, big: true });
        freeze = Math.max(freeze, .12);   // 棍子终段「戳」专属爆发
      } else if (weapon === 'staff' || (weapon === 'hammer' && !isFinisher)) {
        bluntHits.push({ x: z.x, y: z.y - 12, t: 0, T: .15 });
      }
      if (!C.multi) break;
    }
  }
  // 误伤村民只闪一下，不扣血、不计击倒，也不改变连招判定。
  for (const v of villagers) {
    if (v.state === 'gone' || v.hitAtk === h.atk) continue;
    const dx = (v.x - h.x) * h.f;
    const inRange = C.both ? Math.abs(dx) < rch + 10 : dx > -14 && dx < rch + 10;
    if (inRange && Math.abs(v.y - h.y) < W.dy) { v.flash = .12; v.hitAtk = h.atk; }
  }
  // 草垛、推车、石碾也能打：判定和打敌人一样（左右用 p.w/2，上下用 dy）；打中道具也算"打中"，可以接连招
  for (const p of props) {
    if (!canHitProp(p)) continue;
    const dx = (propXAt(p, h.y) - h.x) * h.f;
    const inRange = C.both ? Math.abs(dx) < rch + p.w / 2 : dx > -4 - p.w / 2 && dx < rch + p.w / 2;
    if (inRange && propDY(p, h.y) < W.dy) {
      landed = true; h.lastHit = gameT; h.lastHitC = c;
      hitProp(p, Math.sign(p.x - h.x) || h.f);
    }
  }
  const snd = W.snd || weapon;   // 音效名（锤子借用木棍那一套闷响）
  if (hitEnemy) { sfx('hit_' + snd, h.x + h.f * 20); sfx('crack', h.x + h.f * 26); if (c === W.combo.length - 1) sfx('finisher', h.x); }
  else if (!landed) sfx('swing_' + snd, h.x);   // 只打中道具时，音效由 hitProp 自己播
}
// 主角能不能被打中；翻滚无敌中被「本来会打中」的攻击擦过 → 算躲过（回锋、避实用）
function heroOpen() { if (hero.inv <= 0) return true; if (hero.st === 'roll' && window.ROGUE && ROGUE.onDodge) ROGUE.onDodge(); return false; }
function dmgHero(n, from, kind = 'basic') {
  if (hero.decoy) { hero.hp -= n; hero.hitT = .2; return; }   // 打中的是稻草人
  const h = hero; if (h.inv > 0 && h.st === 'roll' && window.ROGUE && ROGUE.onDodge) ROGUE.onDodge(from, n, kind);
  if (h.inv > 0 || h.air || h.st === 'down' || h.st === 'bounce' || h.st === 'getup' || over) return;
  if (window.ROGUE && ROGUE.absorbHit && ROGUE.absorbHit()) { h.shieldFlash = .22; return; }
  if (window.ROGUE && ROGUE.hardClash && ROGUE.hardClash(from)) return;
  if (window.ROGUE && ROGUE.sidestep && ROGUE.sidestep(n, kind)) return;   // 闪身
  if (window.XIAOCHANG && XIAOCHANG.active()) n = XIAOCHANG.heroDamage(n, from);
  n = n * R_('take');
  if (window.GEAR) n = GEAR.incoming(n, from, kind);
  const raw = n;   // 保存减半前伤害，保持原有击倒判定。
  if (noviceMode()) n *= .5;
  if (IS_TOUCH) n *= .8;
  if (n <= 0) return;
  n = Math.max(.01, n);
  const steadyHold = h.hp > n && charging && R_('steady', 0) > 0 && Math.random() < R_('steady', 0);
  hitsTaken++;   // 结算评价用：被打了多少下
  comboCount = 0; comboExpireAt = 0;   // 主角实际受击，连击立即结束
  sfx('hurt', h.x);
  h.hp -= n; h.inv = .7; shake = .2;
  if (h.hp <= 0 && window.MERIDIAN && MERIDIAN.tryUnyield()) return;   // 经脉·不屈：一局挡一次致命伤
  if (window.MERIDIAN) MERIDIAN.onHurt();   // 经脉·镇关
  if (window.ROGUE && ROGUE.onHurt) ROGUE.onHurt();   // 解围
  if (window.XIAOCHANG) XIAOCHANG.onHitHero(from);
  if (!steadyHold) { h.atk = null; cancelCharge(); }
  const dir = from ? Math.sign(h.x - from.x) || -h.f : -h.f;
  if (steadyHold) { /* 蓄力韧性：照常受伤，但这次受击不中断蓄力 */ }
  else if ((raw >= 2 * (window.MERIDIAN ? MERIDIAN.x('knock', 1) : 1) && !(h.hp > 0 && window.GOODS && GOODS.useAmulet())) || h.hp <= 0) {   // 护身符：第一次重击不倒地
    launch(h, h.hp <= 0 ? dir * 48 : dir * 85, h.hp <= 0 ? 145 : 120); h.f = -dir; h.inv = 9;
    if (window.ARTIFACT) ARTIFACT.onKnock(dir);   // 被击倒：从飞剑上摔下
    if (h.hp <= 0) h.deathArc = true;
  } else { set(h, 'hurt'); h.vx = dir * 80; if (window.ARTIFACT && ARTIFACT.onHit && from && from.T) ARTIFACT.onHit(dir); }   // 踩剑被近战连击会摔下（箭石不算）
  if (h.hp <= 0) {
    if (window.GEAR && GEAR.tryRevive()) return;
    over = true; deathLandedAt = null; enemiesCelebrating = false; say(chapter2Run && chapter2Run.battle === 6 ? '张角：“蝼蚁，也敢逆天。”' : '倒下了……', chapter2Run && chapter2Run.battle === 6 ? 3 : 1.4);
    zs.forEach(z => { if (!z.dead && !z.T.boss) { set(z, 'idle'); z.vx = 0; z.qi = null; } });
  }
}

// ---------- 黄巾兵 AI ----------
// 第二章小兵：技能状态独立于普攻，蓄力/冲刺不借用首领逻辑。
