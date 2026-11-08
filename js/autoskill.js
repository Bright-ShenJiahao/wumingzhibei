// 自动招式 DEMO（只在网址带 &auto 时启用，普通玩家完全看不到）
// 用户 11/09：试一下「群侠传」那种自动释放——手打照旧，身上 5 个招式按 1→5 顺序自动轮着放（周天）。
// 招式效果全部用代码画，数值随便定，只为看手感。
(() => {
  if (!/[?&]auto(?:=|&|$)/.test(location.search)) return;
  const R = (a, b) => a + Math.random() * (b - a);
  const dist = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * 2);
  const alive = () => (typeof zs !== 'undefined' ? zs : []).filter(z => !z.dead && !z.hidden && !z.air && z.hp > 0);
  const nearest = (r) => { let best = null, bd = r; for (const z of alive()) { const d = dist(z, hero); if (d < bd) { bd = d; best = z; } } return best; };
  const fx = [], shots = [];
  function dmg(z, v, kb, dir, opt = {}) {
    if (!z || z.dead) return;
    const f0 = typeof freeze !== 'undefined' ? freeze : 0;
    hit(z, v, kb, dir || 1, !!opt.knock, opt.daze || 0, opt.stun != null ? opt.stun : .2, false, false, { secondary: true, autoSkill: true });
    try { freeze = Math.min(freeze, Math.max(f0, opt.freeze || .02)); } catch (e) {}   // 招式命中不要每下都定格，打起来会一顿一顿
    floaters.push({ x: z.x + R(-6, 6), y: z.y - 34, t: 0, txt: String(Math.round(v * 10)), color: opt.color || '#ffe9a0' });
  }
  const SK = [
    { id: 'sweep', name: '横扫千军', icon: '扫', color: '#ffcf5a', cd: 4, range: 62,
      cast() {   // 身前 270° 大横扫
        const f = hero.f; fx.push({ k: 'sweep', x: hero.x, y: hero.y, f, t: 0, T: .28 });
        for (const z of alive()) { const dx = z.x - hero.x; if (dist(z, hero) < 62 && !(dx * f < -14 && Math.abs(z.y - hero.y) < 10)) dmg(z, 1.2, 70, Math.sign(dx) || f, { stun: .35, freeze: .05 }); }
        sfx('swing_knife', hero.x);
      } },
    { id: 'knife', name: '飞刀', icon: '刀', color: '#bfe3ff', cd: 3, range: 210,
      cast(t) {   // 朝最近的敌人扇形甩出 3 把飞刀
        const a0 = Math.atan2((t.y - hero.y) * 2, t.x - hero.x);
        for (const da of [-.22, 0, .22]) { const a = a0 + da; shots.push({ x: hero.x, y: hero.y, vx: Math.cos(a) * 330, vy: Math.sin(a) * 165, life: .75, hitSet: [], k: 'knife' }); }
        sfx('sling', hero.x);
      } },
    { id: 'quake', name: '地裂斩', icon: '裂', color: '#e0904a', cd: 6, range: 150,
      cast(t) {   // 向敌人方向连爆 5 道地裂，挑飞
        const a = Math.atan2((t.y - hero.y) * 2, t.x - hero.x), sx = Math.cos(a) * 26, sy = Math.sin(a) * 13;
        for (let i = 0; i < 5; i++) fx.push({ k: 'quake', x: hero.x + sx * (i + 1), y: hero.y + sy * (i + 1), t: -i * .09, T: .45, hitDone: false, dir: Math.sign(sx) || hero.f });
        shake = Math.max(shake, .25); sfx('crack', hero.x);
      } },
    { id: 'thunder', name: '五雷符', icon: '雷', color: '#a8a0ff', cd: 7, range: 230,
      cast() {   // 随机劈 3 个敌人：先出预警圈，0.45 秒后落雷，晕
        const list = alive().filter(z => dist(z, hero) < 230).sort(() => Math.random() - .5).slice(0, 3);
        for (const z of list) fx.push({ k: 'thunder', x: z.x, y: z.y, t: 0, T: .75, struck: false });
      } },
    { id: 'wind', name: '旋风护体', icon: '旋', color: '#8ef0c0', cd: 9, range: 70,
      cast() { fx.push({ k: 'wind', t: 0, T: 2.4, tick: 0 }); } },   // 身边 2.4 秒旋风，持续刮伤
  ];
  const S = { on: true, idx: 0, gap: 0, wait: 0, cds: SK.map(() => 0), lastCast: -1, flash: SK.map(() => 0), cycles: 0 };
  function startRun() { S.idx = 0; S.gap = 1; S.wait = 0; S.cds = SK.map(() => 0); fx.length = 0; shots.length = 0; S.cycles = 0; }
  function busy() { return typeof hero === 'undefined' || hero.dead || ['down', 'bounce', 'getup', 'hurt'].includes(hero.st) || hero.air || (typeof over !== 'undefined' && over) || (typeof won !== 'undefined' && won); }
  function tick(dt) {
    if (!S.on) return;
    for (let i = 0; i < SK.length; i++) { S.cds[i] = Math.max(0, S.cds[i] - dt); S.flash[i] = Math.max(0, S.flash[i] - dt); }
    S.gap = Math.max(0, S.gap - dt);
    if (!busy() && S.gap <= 0) {
      const sk = SK[S.idx];
      if (S.cds[S.idx] <= 0) {
        const t = nearest(sk.range);
        if (t) {   // 附近有敌人才出手；按 1→5 顺序
          sk.cast(t); S.cds[S.idx] = sk.cd; S.flash[S.idx] = .35; S.gap = .55; S.wait = 0;
          floaters.push({ x: hero.x, y: hero.y - 52, t: 0, txt: sk.name, color: sk.color });
          S.idx = (S.idx + 1) % SK.length; if (S.idx === 0) S.cycles++;
        } else if ((S.wait += dt) > 1.2) { S.wait = 0; S.idx = (S.idx + 1) % SK.length; }   // 这一路够不着人，跳到下一路
      }
    }
    // 招式效果
    for (const e of fx) {
      e.t += dt;
      if (e.k === 'quake' && !e.hitDone && e.t >= 0) { e.hitDone = true; for (const z of alive()) if (dist(z, e) < 24) dmg(z, 1.4, 30, e.dir, { knock: true, freeze: .04, color: '#ffb070' }); }
      if (e.k === 'thunder' && !e.struck && e.t >= .45) { e.struck = true; sfx('finisher', e.x); shake = Math.max(shake, .2); for (const z of alive()) if (dist(z, e) < 22) dmg(z, 1.8, 10, 1, { daze: 1, stun: .5, freeze: .05, color: '#d6d0ff' }); }
      if (e.k === 'wind') { e.x = hero.x; e.y = hero.y; if ((e.tick -= dt) <= 0) { e.tick = .3; for (const z of alive()) if (dist(z, hero) < 48) dmg(z, .35, 12, Math.sign(z.x - hero.x) || 1, { stun: .1, color: '#c8ffe6' }); } }
    }
    for (let i = fx.length - 1; i >= 0; i--) if (fx[i].t > fx[i].T) fx.splice(i, 1);
    for (const s of shots) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      for (const z of alive()) if (!s.hitSet.includes(z) && Math.abs(z.x - s.x) < 10 && Math.abs(z.y - s.y) < 9) { s.hitSet.push(z); dmg(z, .9, 25, Math.sign(s.vx) || 1, { stun: .15 }); if (s.hitSet.length >= 2) s.life = 0; }
    }
    for (let i = shots.length - 1; i >= 0; i--) if (shots[i].life <= 0) shots.splice(i, 1);
  }
  function drawWorld() {
    for (const e of fx) {
      const p = Math.max(0, e.t) / e.T;
      ctx.save();
      if (e.k === 'sweep') {   // 270° 刀光弧
        const r = 30 + 32 * Math.min(1, p * 1.6), a0 = e.f > 0 ? -Math.PI * .75 : Math.PI * .25, sweep = Math.PI * 1.5 * Math.min(1, p * 1.8);
        ctx.translate(e.x, e.y - 14); ctx.scale(1, .5);
        ctx.strokeStyle = `rgba(255,230,140,${.9 * (1 - p)})`; ctx.lineWidth = 9 * (1 - p) + 2; ctx.lineCap = 'round';
        ctx.beginPath(); if (e.f > 0) ctx.arc(0, 0, r, a0, a0 + sweep); else ctx.arc(0, 0, r, a0 + Math.PI * 1.5, a0 + Math.PI * 1.5 - sweep, true); ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${.8 * (1 - p)})`; ctx.lineWidth = 2; ctx.stroke();
      } else if (e.k === 'quake' && e.t >= 0) {   // 地裂：土刺 + 裂缝
        const a = 1 - p;
        ctx.fillStyle = `rgba(60,35,20,${.6 * a})`; ctx.beginPath(); ctx.ellipse(e.x, e.y, 18, 6, 0, 0, 7); ctx.fill();
        const h = 26 * Math.sin(Math.min(1, p * 2.2) * Math.PI);
        ctx.fillStyle = `rgba(176,120,70,${a})`;
        for (const [dx, s] of [[-8, .7], [0, 1], [8, .8]]) { ctx.beginPath(); ctx.moveTo(e.x + dx - 5, e.y); ctx.lineTo(e.x + dx, e.y - h * s); ctx.lineTo(e.x + dx + 5, e.y); ctx.closePath(); ctx.fill(); }
        ctx.fillStyle = `rgba(255,190,120,${a * .8})`; ctx.fillRect(e.x - 1, e.y - h, 2, h * .6);
      } else if (e.k === 'thunder') {
        if (!e.struck) { ctx.strokeStyle = `rgba(170,160,255,${.4 + .5 * p / .6})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(e.x, e.y, 22 * (1.3 - p * .4), 8 * (1.3 - p * .4), 0, 0, 7); ctx.stroke(); }
        else {
          const a = 1 - (e.t - .45) / (e.T - .45);
          ctx.strokeStyle = `rgba(230,225,255,${a})`; ctx.lineWidth = 3; ctx.shadowColor = '#8a7cff'; ctx.shadowBlur = 12;
          ctx.beginPath(); let x = e.x, y = e.y - 160; ctx.moveTo(x, y); while (y < e.y - 8) { y += 18; x = e.x + R(-9, 9); ctx.lineTo(x, y); } ctx.lineTo(e.x, e.y - 4); ctx.stroke();
          ctx.fillStyle = `rgba(200,190,255,${.5 * a})`; ctx.beginPath(); ctx.ellipse(e.x, e.y, 24, 8, 0, 0, 7); ctx.fill();
        }
      } else if (e.k === 'wind') {
        const a = Math.min(1, (e.T - e.t) * 3);
        ctx.translate(hero.x, hero.y - 12); ctx.scale(1, .45);
        for (let i = 0; i < 3; i++) { const r = 26 + i * 11, rot = e.t * (9 - i * 2) + i;
          ctx.strokeStyle = `rgba(160,255,210,${.55 * a})`; ctx.lineWidth = 3 - i * .6; ctx.beginPath(); ctx.arc(0, 0, r, rot, rot + 2.2); ctx.stroke();
          ctx.beginPath(); ctx.arc(0, 0, r, rot + Math.PI, rot + Math.PI + 2.2); ctx.stroke(); }
      }
      ctx.restore();
    }
    for (const s of shots) {   // 飞刀
      ctx.save(); ctx.translate(s.x, s.y - 18); ctx.rotate(Math.atan2(s.vy, s.vx) + performance.now() / 60);
      ctx.fillStyle = '#e8f2ff'; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-3, -2); ctx.lineTo(-3, 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#6b3a22'; ctx.fillRect(-6, -1, 3, 2); ctx.restore();
    }
  }
  // 屏幕上方正中：5 格招式栏（当前轮到的那格亮框，冷却用暗色遮罩从上往下退）
  function hud(HW) {
    if (!S.on) return;
    const n = SK.length, sz = 38, gap = 6, w = n * sz + (n - 1) * gap, x0 = (HW - w) / 2, y0 = 44;
    ctx.save();
    ctx.fillStyle = 'rgba(20,12,8,.55)'; ctx.fillRect(x0 - 8, y0 - 6, w + 16, sz + 24);
    for (let i = 0; i < n; i++) {
      const sk = SK[i], x = x0 + i * (sz + gap), cur = i === S.idx;
      ctx.fillStyle = '#2b1d14'; ctx.fillRect(x, y0, sz, sz);
      ctx.fillStyle = sk.color; ctx.globalAlpha = .25 + (S.flash[i] > 0 ? .5 : 0); ctx.fillRect(x, y0, sz, sz); ctx.globalAlpha = 1;
      ctx.font = 'bold 20px "PingFang SC",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = sk.color; ctx.fillText(sk.icon, x + sz / 2, y0 + sz / 2 + 1);
      const c = S.cds[i] / sk.cd; if (c > 0) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(x, y0, sz, sz * c); }
      ctx.strokeStyle = cur ? '#ffe27a' : 'rgba(200,170,110,.6)'; ctx.lineWidth = cur ? 2.5 : 1; ctx.strokeRect(x + .5, y0 + .5, sz - 1, sz - 1);
      ctx.font = '10px "PingFang SC",sans-serif'; ctx.fillStyle = '#e8d6b0'; ctx.fillText(sk.name, x + sz / 2, y0 + sz + 9);
    }
    ctx.font = '10px sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#cdb98e'; ctx.fillText(`周天 ${S.cycles}`, x0 + w + 12, y0 + sz / 2);
    ctx.restore();
  }
  window.AUTOSKILL = { tick, drawWorld, hud, startRun, toggle() { S.on = !S.on; return S.on; }, get on() { return S.on; } };
})();
