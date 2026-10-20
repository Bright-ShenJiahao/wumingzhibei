// 卖血大招：按当前武器给三种，右下角多一个按钮（桌面按 U）
//   棍 · 横扫千军  —— 360° 群体控场，两段判定，打晕全场（3 血）
//   锤 · 开山      —— 正前方一记重砸，最高单发伤害 + 沿地面前进的冲击波（4 血）
//   石子 · 万石雨  —— 向前连扔 6 颗石子，远程覆盖（3 血）
// 代价是血：血不够按不出来；每招各自有冷却。game.js 只挂 update / draw 两行。
(() => {
  const CFG = {
    staff: { name: '横扫千军', short: '横扫', cost: 2, cd: 6, dur: .86, windup: .16 },
    hammer: { name: '开山', short: '开山', cost: 3, cd: 6, dur: 1.02, windup: .30 },
    stone: { name: '万石雨', short: '万石', cost: 2, cd: 6, dur: .95, windup: .18 },
  };
  let on = false, t = 0, kind = '', cdLeft = 0, uses = 0, fx = [], hitTicks = [], wave = null, btn = null, lbl = null;

  const cfg = () => CFG[weapon] || CFG.hammer;
  const RS = (k, d = 0) => (window.ROGUE && ROGUE.S[k] != null ? ROGUE.S[k] : d);
  const costOf = () => Math.max(1, cfg().cost + RS('ultCost'));
  const dmgMul = () => (window.ROGUE ? ROGUE.S.ultDmg : 1);

  function ready() {
    if (!hero || on) return false;
    if (typeof over !== 'undefined' && (over || won)) return false;
    if (typeof result !== 'undefined' && result) return false;
    if (hero.st === 'down' || hero.st === 'hurt' || hero.air) return false;
    return cdLeft <= 0 && hero.hp > costOf();
  }

  function start() {
    if (!ready()) {
      if (cdLeft > 0) toast('大招冷却中');
      else if (hero && hero.hp <= costOf()) toast('血太少，拼不了');
      return;
    }
    kind = weapon; on = true; t = 0; uses++;
    hero.hp -= costOf();
    hero.inv = .6;   // 只有开头 0.6 秒无敌，之后是霸体：照吃伤害但不被打断
    hero.vx = 0; hero.q = 0;
    hero.st = 'atk'; hero.atk = { c: 2, fi: 0, t: 0, lg: 0 };   // 借用第三段的动作帧
    fx = []; wave = null;
    hitTicks = [];
    if (kind === 'staff') hitTicks = [cfg().windup + .06, cfg().windup + .30];
    else if (kind === 'hammer') hitTicks = [cfg().windup + .10];
    else hitTicks = [];
    sfx('ult', hero.x);
    shake = .22;
    toast(cfg().name + '！');
  }

  function hitEnemies(radius, front, dmg, kb, daze, stun, knock) {
    for (const z of zs) {
      if (z.dead) continue;
      const dx = z.x - hero.x, dy = z.y - hero.y;
      if (Math.abs(dy) > 20) continue;
      let ok = false;
      if (front) { const f = dx * hero.f; ok = f > -22 && f < radius; }
      else ok = Math.abs(dx) < radius;
      if (!ok) continue;
      hit(z, dmg, kb, Math.sign(dx) || hero.f, !!knock, daze, stun);
    }
  }

  function update(dt) {
    if (cdLeft > 0) cdLeft = Math.max(0, cdLeft - dt);
    if (!on) return false;
    t += dt;
    const C = CFG[kind];
    // 霸体：挨打不会被拽出发招（伤害照吃），空中被打除外（air 会暂停大招）
    if (hero.st !== 'atk') { hero.st = 'atk'; hero.vx = 0; if (!hero.atk) hero.atk = { c: 2, fi: 1, t, lg: 0 }; }

    // 动作帧：前摇 → 出手 → 收招
    if (hero.atk) {
      const f = WEAP[kind].combo[2].f;
      hero.atk.fi = t < C.windup ? 0 : (t < C.windup + .26 ? 1 : f.length - 1);
      hero.atk.t = t;
    }

    // 手动推进的判定
    while (hitTicks.length && t >= hitTicks[0]) {
      hitTicks.shift();
      if (kind === 'staff') {
        hitEnemies(102, false, 2.2 * dmgMul(), 165, 1, .8, false);   // 360° 两段，打晕
        fx.push({ k: 'ring', x: hero.x, y: hero.y, t: 0, T: .45, r: 40 });
        shake = .26; freeze = Math.max(freeze, .07);
        sfx('hit_staff', hero.x);
      } else if (kind === 'hammer') {
        hitEnemies(96, true, 6 * dmgMul(), 190, 0, .55, true);        // 正前方重砸
        wave = { x: hero.x + hero.f * 44, y: hero.y, vx: hero.f * 320, t: 0, T: .95, hit: new Set() };
        fx.push({ k: 'crack', x: hero.x + hero.f * 50, y: hero.y, t: 0, T: .8 });
        shake = .34; freeze = Math.max(freeze, .09);
        sfx('finisher', hero.x);
      }
    }

    // 石子：前摇之后连扔 6 颗
    if (kind === 'stone' && t >= C.windup) {
      const n = Math.floor((t - C.windup) / .07);
      if (n >= 0 && n < 8 && hero._shotN !== n) {
        hero._shotN = n;
        shots.push({ x: hero.x + hero.f * 16, y: hero.y, z: 16 + (n % 4) * 7, vx: hero.f * (330 + n * 8),
          life: 1.2, C: { dmg: 1.6 * dmgMul(), kb: 55, pierce: true }, c: 2, hitSet: [] });   // 穿透：一颗能串好几个
        sfx('swing_stone', hero.x);
      }
    }

    // 冲击波往前跑
    if (wave) {
      wave.t += dt; wave.x += wave.vx * dt;
      for (const z of zs) if (!z.dead && !wave.hit.has(z) && Math.abs(z.x - wave.x) < 18 && Math.abs(z.y - wave.y) < 14) {
        wave.hit.add(z); hit(z, 3, 130, Math.sign(wave.vx), true, 0, .5);
      }
      if (wave.t > wave.T) wave = null;
    }
    for (const e of fx) e.t += dt;
    fx = fx.filter(e => e.t < e.T);

    if (t >= C.dur) {
      on = false; hero.st = 'idle'; hero.atk = null; hero._shotN = -1;
      cdLeft = Math.max(2, C.cd + RS('ultCd'));
      return true;
    }
    return true;
  }

  function draw() {
    // 世界坐标下画（调用点在 game.js 的 draw 里，已经处在世界变换下）
    for (const e of fx) {
      const p = Math.min(1, e.t / e.T);
      if (e.k === 'ring') {
        ctx.strokeStyle = `rgba(255,210,110,${.75 * (1 - p)})`; ctx.lineWidth = 4 * (1 - p) + 1;
        ctx.beginPath(); ctx.ellipse(e.x, e.y - 14, 40 + 90 * p, 16 + 34 * p, 0, 0, 7); ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${.4 * (1 - p)})`;
        ctx.beginPath(); ctx.ellipse(e.x, e.y - 14, 20 + 70 * p, 8 + 26 * p, 0, 0, 7); ctx.stroke();
      } else if (e.k === 'crack') {
        ctx.strokeStyle = `rgba(60,30,12,${.8 * (1 - p)})`; ctx.lineWidth = 3;
        for (let i = 0; i < 4; i++) {
          const dx = (i - 1.5) * 16;
          ctx.beginPath(); ctx.moveTo(e.x + dx, e.y);
          ctx.lineTo(e.x + dx * 1.5 + (i % 2 ? 8 : -8), e.y - 26 * (1 - p) - 6); ctx.stroke();
        }
      }
    }
    if (wave) {
      const a = 1 - wave.t / wave.T;
      for (let k = 0; k < 5; k++) {
        const x = wave.x - Math.sign(wave.vx) * k * 9, hh = (8 - k) * (1 + Math.sin(wave.t * 28 + k) * .3);
        ctx.fillStyle = `rgba(120,80,40,${a})`;
        ctx.beginPath(); ctx.moveTo(x - 5, wave.y + 4); ctx.lineTo(x, wave.y + 4 - hh); ctx.lineTo(x + 5, wave.y + 4); ctx.fill();
        ctx.fillStyle = `rgba(255,220,150,${a * .8})`; ctx.fillRect(x - 1, wave.y - hh * .6, 2, 2);
      }
    }
  }

  // ---------- 按钮 ----------
  function buildBtn() {
    const css = document.createElement('style');
    css.textContent = `
      #bU { position: fixed; z-index: 3; right: calc(96px + env(safe-area-inset-right));
        bottom: calc(74px + env(safe-area-inset-bottom)); width: 54px; height: 54px; border-radius: 50%;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        font: 700 11px/1.15 "PingFang SC",sans-serif; color: #fff; text-shadow: 0 1px 3px #000;
        background: rgba(200,60,150,.3); border: 1.5px solid rgba(255,170,220,.75); padding: 0;
        -webkit-tap-highlight-color: transparent; }
      #bU i { font-style: normal; font-size: 9px; opacity: .85; }
      #bU:active { background: rgba(200,60,150,.55); }
      #bU.off { background: rgba(90,90,100,.28); border-color: rgba(200,200,210,.35); color: #bbb; }
      body.wzb-title #bU, body.wzb-room #bU, body.wzb-wake #bU { display: none !important; }
    `;
    document.head.appendChild(css);
    btn = document.createElement('button');
    btn.id = 'bU';
    document.body.appendChild(btn);
    const cap = document.createElement('b'); cap.textContent = '大招';
    lbl = document.createElement('i'); lbl.textContent = '3血';
    btn.appendChild(cap); btn.appendChild(lbl);
    btn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); start(); });
    addEventListener('keydown', e => {
      if (e.target && e.target.tagName === 'INPUT') return;
      if (window.TITLE && TITLE.blocks()) return;
      if (window.ROOM && ROOM.active()) return;
      if (e.code === 'KeyU') { start(); e.preventDefault(); }
    });
    // 按钮状态：跟着武器、血量、冷却变
    setInterval(() => {
      if (!btn) return;
      const C = cfg(), ok = ready();
      btn.classList.toggle('off', !ok);
      lbl.textContent = cdLeft > 0 ? '冷' + Math.ceil(cdLeft) : costOf() + '血';
      btn.firstChild.textContent = C.short;
      btn.title = C.name + '（' + costOf() + ' 血）';
    }, 120);
  }

  function toast(msg) { if (typeof say === 'function') say(msg, 1.2); }

  window.ULT = {
    start, update, draw,
    active: () => on,
    reset: () => { cdLeft = 0; on = false; t = 0; uses = 0; },   // 调试/测试用：清冷却
    info: () => ({ on, kind, t: +t.toFixed(2), cd: +cdLeft.toFixed(1), uses, ready: ready(), cost: cfg().cost }),
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', buildBtn); else buildBtn();
})();
