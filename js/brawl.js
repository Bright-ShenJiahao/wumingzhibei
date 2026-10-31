// 清版玩法（用户定 10/31，参考三国志 II / 恐龙快打 / 三国战纪）：
//  · 保险技：L 键 / 手机「保险」键。扣 10% 最大血（不会把自己扣死），0.5 秒无敌，把周围 70 内的敌人全部打倒，并打掉身边的飞行物。
//  · 抓摔：空手朝敌人贴身走 0.15 秒自动抓住（首领、盾兵、攻城器不能抓）；抓住后按攻击往面向方向（或推的方向）摔出去，
//    被摔的人砸到别人也会把别人砸倒；按翻滚放手；抓太久（1 秒）对方会挣脱。
//  · 连击保护：同一个敌人被连续打（每下间隔不到 0.7 秒）超过 3 秒，挣脱 1.2 秒（不硬直、不被击倒、不被晕），防止无限连。
// 心魔：和玩家用同一套保险技 / 抓摔（在 js/xinmo.js 里调用这里的函数），保持 1:1。
(() => {
  let pressDesp = false;
  const thrown = [];
  const costOf = max => Math.max(.5, max * .1);
  const canGrab = z => z && !z.dead && !z.air && !z.hidden && !z.ally && !z.decoy && !z.T.boss && !z.T.chapterBoss && !z.T.heavy && !z.T.siege && !z.T.shield
    && !['down', 'land', 'bounce', 'getup', 'air'].includes(z.st) && !(z.T.mirror && (z.inv > 0 || z.st === 'roll'));
  function burst(x, y, c) {
    if (typeof chargeFx !== 'undefined') chargeFx.push({ x, y, t: 0, T: .45, w: 'hammer', f: 1, power: 1, tier: 3 });
    for (let i = 0; i < 18; i++) { const a = i / 18 * Math.PI * 2; propFx.push({ x: x + Math.cos(a) * 10, y: y - 14 + Math.sin(a) * 5, vx: Math.cos(a) * 160, vy: Math.sin(a) * 80 - 40, w: 3, h: 3, life: .35, max: .35, c }); }
    shake = Math.max(shake, .3);
  }
  // 保险技（玩家）
  function heroDesp(h) {
    const max = maxHeroHp(), cost = costOf(max);
    if (h.hp <= cost + .01) { floaters.push({ x: h.x, y: h.y - 50, t: 0, txt: '血量不足' }); return false; }
    if (h.grabbedBy) { const g = h.grabbedBy; h.grabbedBy = null; if (g.grab) g.grab = null; }
    h.hp -= cost; h.inv = .5; h.despT = .35; h.atk = null; h.q = 0; cancelCharge(); release(h, false); set(h, 'idle');
    sfx('finisher', h.x); burst(h.x, h.y, '#ffe08a');
    floaters.push({ x: h.x, y: h.y - 56, t: 0, txt: '保险！-' + (Math.round(cost * 10) / 10), big: true, color: '#ffd86e' });
    for (const z of zs) if (!z.dead && !z.air && !z.ally && !z.hidden && Math.hypot(z.x - h.x, (z.y - h.y) * 2) < 70) {
      const d = Math.sign(z.x - h.x) || h.f;
      if (z.T.mirror) { hit(z, .8, 160, d, true, 0, .35, true, false, { charged: true }); if (window.XINMO && XINMO.knock) XINMO.knock(d); }
      else hit(z, .8, 160, d, true, 0, .35, true, false, { charged: true, noBossKnock: true, desp: true });
    }
    if (typeof eshots !== 'undefined') for (const s of eshots) if (Math.hypot(s.x - h.x, (s.y - h.y) * 2) < 70) s.life = 0;
    if (window.XINMO && XINMO.clearShots) XINMO.clearShots(h.x, h.y, 70);
    return true;
  }
  function release(h, escape) {
    const g = h.grab; if (!g) return; h.grab = null;
    const z = g.z; if (!z || z.dead) return;
    z.grabbed = false;
    if (escape) { z.stun = 0; z.vx = h.f * 60; h.vx = -h.f * 60; set(h, 'hurt'); h.t = .15; floaters.push({ x: z.x, y: z.y - 40, t: 0, txt: '挣脱！' }); }
  }
  function throwIt(h, dir) {
    const z = h.grab.z; h.grab = null; z.grabbed = false;
    sfx('finisher', h.x); shake = Math.max(shake, .2);
    z.x = h.x + dir * 6;
    if (z.T.mirror) { hit(z, 1.4, 180, dir, true, 0, .35, true, false, { charged: true }); if (window.XINMO && XINMO.knock) XINMO.knock(dir, 1.4); }
    else { hit(z, 1.4, 180, dir, true, 0, .35, true, false, { charged: true }); if (!z.dead && !z.air) launch(z, dir * 200, 140); }
    thrown.push({ z, dir, until: gameT + .9, hitSet: new Set([z]) });
    set(h, 'idle'); h.despT = .25;
  }
  // 每帧：玩家（heroUpdate 里在输入读完之后调用；返回 true = 这一帧由这里接管）
  function heroStep(h, dt, ix, iy) {
    // 被摔出去的人砸人
    for (let i = thrown.length - 1; i >= 0; i--) {
      const t = thrown[i];
      if (gameT > t.until || t.z.dead && !t.z.air) { thrown.splice(i, 1); continue; }
      if (!t.z.air) continue;
      for (const o of zs) if (!t.hitSet.has(o) && !o.dead && !o.air && !o.ally && !o.hidden && Math.abs(o.x - t.z.x) < 14 + (o.T.w || 0) / 2 && Math.abs(o.y - t.z.y) < 12) {
        t.hitSet.add(o); hit(o, 1.0, 140, t.dir, true, 0, .35, true, false, { thrown: true, noBossKnock: true }); floaters.push({ x: o.x, y: o.y - 40, t: 0, txt: '砸！' });
      }
    }
    if (pressDesp) { pressDesp = false; if (!h.air && !['down', 'bounce', 'getup', 'land'].includes(h.st) && !over && heroDesp(h)) return true; }
    if (h.despT > 0) { h.despT -= dt; pressAtk = pressRoll = false; return true; }
    if (h.grabbedBy) { const g = h.grabbedBy; if (g.dead || !g.grab) h.grabbedBy = null; else { h.x = g.x + g.f * 14; h.y = g.y; if (h.st !== 'hurt') set(h, 'hurt'); h.t = 0; pressAtk = pressRoll = false; return true; } }   // 被心魔抓住：只能按保险技
    if (h.grab) {
      const g = h.grab, z = g.z; g.t += dt;
      if (!z || z.dead || z.air || h.st === 'hurt' || h.air) { release(h, false); return false; }
      z.x = h.x + h.f * 14; z.y = h.y; z.vx = 0; z.stun = Math.max(z.stun || 0, .2); if (!z.T.mirror) { z.st = 'hurt'; z.t = 0; }
      if (pressRoll) { pressRoll = false; release(h, false); return false; }
      if (pressAtk) { pressAtk = false; throwIt(h, Math.abs(ix) > .3 ? Math.sign(ix) : h.f); return true; }
      if (g.t > 1) { release(h, true); return true; }
      pressAtk = false; return true;
    }
    // 抓：空手朝敌人贴身推 0.15 秒
    if ((h.st === 'idle' || h.st === 'walk') && !charging && !atkHeldSince && Math.abs(ix) > .5) {
      const dir = Math.sign(ix), z = zs.find(e => canGrab(e) && Math.sign(e.x - h.x) === dir && Math.abs(e.x - h.x) < 22 + (e.T.w || 0) / 2 && Math.abs(e.y - h.y) < 7);
      if (z) { h.grabPush = (h.grabPush || 0) + dt; if (h.grabPush >= .15) { h.grabPush = 0; h.f = dir; h.grab = { z, t: 0 }; z.grabbed = true; z.atk = null; z.ch = 0; sfx('hit_stone', z.x); floaters.push({ x: z.x, y: z.y - 40, t: 0, txt: '抓！' }); return true; } }
      else h.grabPush = 0;
    } else h.grabPush = 0;
    return false;
  }
  // 连击保护（g_combat_hit.js 的 rawHit 调用）：返回 true = 这一下挣脱中，不硬直/不击倒/不晕
  function armored(z) {
    if (z.T.boss || z.T.chapterBoss || z.T.mirror) return false;
    if (gameT < (z.armorUntil || 0)) return true;
    if (gameT - (z.lastChainHit ?? -9) > .7) z.chainStart = gameT;
    z.lastChainHit = gameT;
    if (gameT - z.chainStart > 3) { z.armorUntil = gameT + 1.2; z.chainStart = gameT + 1.2; floaters.push({ x: z.x, y: z.y - 46, t: 0, txt: '挣脱！', color: '#9fd3ff' }); return true; }
    return false;
  }
  function press() { pressDesp = true; }
  function reset() { pressDesp = false; thrown.length = 0; if (typeof hero !== 'undefined' && hero) { hero.grab = null; hero.despT = 0; } }
  window.BRAWL = { heroStep, press, reset, armored, costOf, canGrab, burst, thrown };
})();
