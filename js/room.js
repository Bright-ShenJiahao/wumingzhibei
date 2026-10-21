// 开场演出：被吸进东汉末年，在农房里醒来 → 捡起地上三把武器 → 从门口出去进入村庄。
// game.js 里只挂 2 处（update/draw 各一行判断），其余全在这个文件里。
(() => {
  const LINES = [
    { s: '我怎么了', d: 1.8 },
    { s: '这里是哪里', d: 1.8 },
    { s: '外面好像很危险，捡起地上的武器 出去看看。', d: 3.4 },
  ];
  // ---------- 农房原图 + 统一坐标换算 ----------
  const IMG_W = 1024, IMG_H = 572;          // art/room/home_in.png 的原始尺寸
  const FIT = { s: 1, dx: 0, dy: 0 };        // cover 后的缩放/平移（设备像素）
  let roomImg = null;
  // 把"图上的像素坐标"换算成"世界坐标"，背景、人物、武器、出门判定全用这一个函数
  function fitImg() {
    const devW = cv.width, devH = cv.height;
    const s = Math.max(devW / IMG_W, devH / IMG_H);      // cover
    FIT.s = s;
    FIT.dx = (devW - IMG_W * s) / 2;
    FIT.dy = devH - IMG_H * s;                            // 底部对齐：保住地面和门洞下沿
    return s;
  }
  const toW = (px, py) => {
    const S2 = cv.height / 300;                           // 和绘制用同一个 SC
    return [(px * FIT.s + FIT.dx) / S2, (py * FIT.s + FIT.dy) / S2];
  };
  // 常用锚点（图上比例 → 世界坐标）
  const P = {
    spawn: () => toW(IMG_W * .20, IMG_H * .86),           // 窗下醒来
    doorL: () => toW(IMG_W * .69, IMG_H * .76),           // 门洞左下
    doorR: () => toW(IMG_W * .80, IMG_H * .76),           // 门洞右下
    threshold: () => toW(IMG_W * .745, IMG_H * .73),      // 门槛
    floorTop: () => toW(IMG_W * .5, IMG_H * .72)[1],      // 地面最里侧
    floorBot: () => toW(IMG_W * .5, IMG_H * .98)[1],      // 地面最外侧
    wallL: () => toW(IMG_W * .06, 0)[0],
    wallR: () => toW(IMG_W * .94, 0)[0],
  };
  // 近大远小：站得越靠下（越近）越大
  const depthScale = (wy) => {
    const top = P.floorTop(), bot = P.floorBot();
    const k = Math.max(0, Math.min(1, (wy - top) / Math.max(1, bot - top)));
    return 0.92 + 0.16 * k;
  };
  const HERO_SCALE = 3.6;   // 主角放大倍数（站在门口时头顶约到门框 70%~80%）

  const KINDS = ['staff', 'hammer', 'stone'];
  const NAME = { staff: '棍', hammer: '锤子', stone: '石子' };

  const S = {
    mode: 'off',        // off | play
    phase: 'wake',      // wake（还没站起来）| free（可自由走动）
    t: 0, li: -1, lineT: 0, fade: 1, out: 0, took: 0, cn: 0, ct: 0,
    hero: null, items: [], motes: [],
  };

  function viewW() { try { return cv.width / DPR / ((cv.height / DPR) / 300); } catch (e) { return 640; } }

  function resetRoom() {
    const vw = viewW();
    S.phase = 'wake'; S.t = 0; S.li = -1; S.lineT = 0; S.cn = 0; S.ct = 0; S.fade = 1; S.out = 0; S.took = 0;
    fitImg();
    const sp = P.spawn();
    S.hero = { x: sp[0], y: sp[1], f: 1, st: 'down', t: 0, vx: 0 };
    // 三把武器散在屋里的地面上（图上比例 → 世界坐标）
    S.items = [
      { k: 'staff', x: toW(IMG_W * .40, IMG_H * .90)[0], y: toW(IMG_W * .40, IMG_H * .90)[1], got: 0, bob: 0 },
      { k: 'hammer', x: toW(IMG_W * .52, IMG_H * .93)[0], y: toW(IMG_W * .52, IMG_H * .93)[1], got: 0, bob: 1.1 },
      { k: 'stone', x: toW(IMG_W * .62, IMG_H * .88)[0], y: toW(IMG_W * .62, IMG_H * .88)[1], got: 0, bob: 2.2 },
    ];
    S.motes = Array.from({ length: 18 }, () => ({ x: Math.random() * vw, y: 140 + Math.random() * 140, r: .6 + Math.random() * 1.2, s: .3 + Math.random() * .8, p: Math.random() * 6.28 }));
  }

  function begin() {
    S.mode = 'play';
    resetRoom();
    document.body.classList.add('wzb-room', 'wzb-wake');
    if (window.SFX) SFX.play('land', 0);
  }

  function finish() {
    S.mode = 'off';
    document.body.classList.remove('wzb-room', 'wzb-wake');
    if (typeof reset === 'function') reset();
    if (window.TITLE && TITLE.active && TITLE.active()) return;
  }

  // ---------- 逻辑 ----------
  function update(dt) {
    if (S.mode !== 'play') return;
    S.t += dt;
    if (S.fade > 0) S.fade = Math.max(0, S.fade - dt / .9);
    if (S.out > 0) {
      S.out += dt;
      if (S.out > .6) { finish(); return; }
    }
    const h = S.hero; h.t += dt;
    for (const m of S.motes) { m.p += dt * .6; m.y -= m.s * dt * 6; if (m.y < 120) { m.y = 290; m.x = Math.random() * viewW(); } }

    // 醒来：三句台词依次出现，最后站起来
    if (S.phase === 'wake') {
      // 逐字打出，每 3 个字一声电子音（老游戏机的味道）
      if (S.li >= 0 && S.li < LINES.length) {
        const L = LINES[S.li];
        if (S.cn < L.s.length) {
          S.ct += dt;
          while (S.ct > .045 && S.cn < L.s.length) {
            S.ct -= .045; S.cn++;
            if (S.cn % 3 === 1 && window.SFX) SFX.play('blip', 0);
          }
        }
      }
      S.lineT -= dt;
      if (S.lineT <= 0) {
        S.li++;
        if (S.li < LINES.length) { S.lineT = LINES[S.li].d; S.cn = 0; S.ct = 0; }
        else if (S.li === LINES.length) { h.st = 'getup'; h.t = 0; S.lineT = .5; }
        else { S.phase = 'free'; h.st = 'idle'; h.t = 0; S.li = -1; document.body.classList.remove('wzb-wake'); }
      }
      return;
    }

    // 可走动：键盘 + 手机摇杆（都读游戏里已有的输入状态）
    let ix = 0, iy = 0;
    if (typeof key !== 'undefined' && key) {
      ix = (key.KeyD || key.ArrowRight ? 1 : 0) - (key.KeyA || key.ArrowLeft ? 1 : 0);
      iy = (key.KeyS || key.ArrowDown ? 1 : 0) - (key.KeyW || key.ArrowUp ? 1 : 0);
    }
    if (typeof joy !== 'undefined' && joy) { ix = Math.abs(joy.dx) > .2 ? joy.dx : 0; iy = Math.abs(joy.dy) > .2 ? joy.dy : 0; }
    const vw = viewW();
    if (ix) h.f = Math.sign(ix);
    h.x += ix * 165 * dt; h.y += iy * 108 * dt;
    h.x = Math.max(P.wallL(), Math.min(P.wallR(), h.x));
    h.y = Math.max(P.floorTop() + 4, Math.min(P.floorBot(), h.y));
    h.st = (ix || iy) ? 'walk' : 'idle';

    // 碰到武器就自动捡起
    for (const it of S.items) {
      if (it.got) continue;
      if (Math.abs(it.x - h.x) < 34 && Math.abs(it.y - h.y) < 30) {
        it.got = 1; S.took++;
        if (window.SFX) SFX.play('pickup', 0);
        S.li = -1; S.lineT = 0;
      }
    }

    // 三把都拿了才能出门
    // 出门：门洞 x 范围内 + 走到门槛上（y 比门槛更靠里）
    const dl = P.doorL()[0], dr = P.doorR()[0], th = P.threshold()[1];
    if (S.took >= 3 && h.x > dl && h.x < dr && h.y < th + 12 && S.out === 0) {
      S.out = .001;
      if (window.SFX) SFX.play('land', 0);
    }
  }

  // ---------- 绘制 ----------
  const R = () => (typeof SC !== 'undefined' ? SC : 1);

  function drawArt(vw) {
    const c = ctx, SC = R();
    fitImg();
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (roomImg && roomImg.complete) {
      c.imageSmoothingEnabled = true;
      c.drawImage(roomImg, FIT.dx, FIT.dy, IMG_W * FIT.s, IMG_H * FIT.s);
    } else {
      c.fillStyle = '#241812'; c.fillRect(0, 0, cv.width, cv.height);
    }
    // 轻微压暗四角，让台词框和装备框压得住
    const W = cv.width, H = cv.height;
    const vg = c.createRadialGradient(W / 2, H * .55, Math.min(W, H) * .3, W / 2, H * .55, Math.max(W, H) * .78);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(12,6,4,.62)');
    c.fillStyle = vg; c.fillRect(0, 0, W, H);
    // 飘动的微尘（沿窗光柱）
    const SCw = cv.height / 300;
    c.setTransform(SCw, 0, 0, SCw, 0, 0);
    for (const m of S.motes) {
      c.globalAlpha = .10 + .28 * Math.abs(Math.sin(m.p));
      c.fillStyle = '#ffe6b0'; c.fillRect(m.x, m.y, m.r, m.r);
    }
    c.globalAlpha = 1;
  }

  // 地上的武器（世界坐标画）
  function drawItem(it, t) {
    if (it.got) return;
    const c = ctx, yy = it.y + Math.sin(t * 2 + it.bob) * 1.6;
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(it.x, it.y + 4, 22 * depthScale(it.y), 7 * depthScale(it.y), 0, 0, 7); c.fill();
    // 微光
    const g = c.createRadialGradient(it.x, yy - 6, 1, it.x, yy - 6, 30);
    g.addColorStop(0, 'rgba(255,216,110,.35)'); g.addColorStop(1, 'rgba(255,216,110,0)');
    c.fillStyle = g; c.beginPath(); c.arc(it.x, yy - 6, 30, 0, 7); c.fill();
    icon(it.k, it.x, yy - 6, 3.1 * depthScale(it.y), true);
  }

  // 武器图标（和装备框共用）
  function icon(kind, x, y, s, ground) {
    const c = ctx;
    c.save(); c.translate(x, y); c.scale(s, s);
    if (kind === 'staff') {
      c.strokeStyle = '#8a5c2c'; c.lineWidth = 2.2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-9, 5); c.lineTo(9, -7); c.stroke();
      c.strokeStyle = '#c08a4a'; c.lineWidth = .8; c.beginPath(); c.moveTo(-8, 4); c.lineTo(8, -6); c.stroke();
    } else if (kind === 'hammer') {
      c.strokeStyle = '#6b4a22'; c.lineWidth = 2.2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-8, 6); c.lineTo(4, -4); c.stroke();
      c.fillStyle = '#7d7d86'; c.fillRect(2, -10, 10, 8);
      c.fillStyle = '#a9a9b4'; c.fillRect(2, -10, 10, 2.5);
      c.fillStyle = '#4a4a52'; c.fillRect(2, -4, 10, 2);
    } else {
      c.fillStyle = '#8b8d96'; c.beginPath(); c.arc(0, 0, 5.2, 0, 7); c.fill();
      c.fillStyle = '#b9bbc4'; c.beginPath(); c.arc(-1.4, -1.4, 2.4, 0, 7); c.fill();
      c.fillStyle = '#5c5e66'; c.beginPath(); c.arc(2, 2, 1.8, 0, 7); c.fill();
    }
    c.restore();
  }

  // 装备框（屏幕坐标）
  function drawSlots(W, H) {
    const n = 3, sw = 44, gap = 10, total = n * sw + (n - 1) * gap;
    const x0 = 16, y0 = 16;
    ctx.font = 'bold 13px "PingFang SC","Noto Sans CJK SC",sans-serif';
    for (let i = 0; i < n; i++) {
      const k = KINDS[i], it = S.items.find(o => o.k === k), got = !!(it && it.got);
      const x = x0 + i * (sw + gap), y = y0;
      ctx.fillStyle = got ? 'rgba(60,40,12,.85)' : 'rgba(18,12,26,.55)';
      ctx.fillRect(x, y, sw, sw);
      ctx.strokeStyle = got ? '#ffd86e' : 'rgba(255,255,255,.22)';
      ctx.lineWidth = got ? 2 : 1.5;
      if (!got) ctx.setLineDash([4, 4]);
      ctx.strokeRect(x + .5, y + .5, sw - 1, sw - 1);
      ctx.setLineDash([]);
      ctx.save(); ctx.globalAlpha = got ? 1 : .32;
      ctx.translate(0, 0);
      icon(k, x + sw / 2, y + sw / 2 - 2, 1.5, false);
      ctx.restore();
      if (got) { ctx.fillStyle = '#ffd86e'; ctx.font = 'bold 11px sans-serif'; ctx.fillText('✓', x + sw - 12, y + 13); }
    }
    return { x: x0, y: y0, w: total, h: sw };
  }

  function drawDialogue(W, H) {
    if (S.phase !== 'wake' || S.li < 0 || S.li >= LINES.length) return;
    const line = LINES[S.li];
    const pop = Math.min(1, Math.max(0, (line.d - S.lineT) / .12));
    const small = H < 520;                       // 手机横屏：底部空间不够，台词框放到上面，别挡住地上的主角和武器
    const bw = Math.min(620, W * .86), bh = small ? 62 : 74;
    const x = (W - bw) / 2, y = small ? 74 : H - bh - 26;
    ctx.save();
    ctx.globalAlpha = .55 + .45 * pop;
    ctx.fillStyle = 'rgba(16,10,22,.9)'; ctx.fillRect(x, y, bw, bh);
    ctx.strokeStyle = '#c9971f'; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, bw - 2, bh - 2);
    // 说话人
    const nm = (window.TITLE && TITLE.playerName && TITLE.playerName()) || '我';
    ctx.font = 'bold 13px "PingFang SC","Noto Sans CJK SC",sans-serif';
    ctx.fillStyle = '#ffd86e'; ctx.fillText(nm, x + 16, y - 6);
    ctx.fillStyle = 'rgba(201,151,31,.9)'; ctx.fillRect(x + 16, y - 3, 34, 1.5);
    // 正文（逐字出现）
    ctx.font = 'bold ' + (small ? 16 : 18) + 'px "PingFang SC","Noto Sans CJK SC",sans-serif';
    const shown = line.s.slice(0, Math.max(1, S.cn || 1));
    ctx.fillStyle = '#f2e6c9'; ctx.fillText(shown, x + 16, y + (small ? 38 : 42));
    // 继续提示
    if (S.lineT < line.d - .6) {
      ctx.globalAlpha = .4 + .5 * Math.abs(Math.sin(S.t * 4));
      ctx.fillStyle = '#ffd86e'; ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'right'; ctx.fillText('▼', x + bw - 14, y + bh - 12); ctx.textAlign = 'left';
    }
    ctx.restore();
  }

  function draw() {
    if (S.mode !== 'play') return false;
    const W = cv.width / DPR, H = cv.height / DPR;
    const vw = viewW();
    SC = cv.height / 300;   // 用设备像素高（和 game.js 的 SC 一致），高分屏才不会只画左上角
    OXs = 0;
    ctx.setTransform(SC, 0, 0, SC, 0, 0);
    drawArt(vw);
    // 地上的武器 + 主角（按 y 排序）
    const list = [];
    for (const it of S.items) list.push({ y: it.y, d: () => drawItem(it, S.t) });
    list.push({ y: S.hero.y, d: () => {
      const h = S.hero;
      let f = 'idle';
      if (h.st === 'down' || h.st === 'getup') f = h.st;
      else if (h.st === 'walk') f = 'walk' + ([1, 2, 3, 2][Math.floor(h.t * 8) % 4]);
      drawChar('hero', f, h.x, h.y, h.f < 0, 1, false, HERO_SCALE * depthScale(h.y));
    } });
    list.sort((a, b) => a.y - b.y).forEach(o => o.d());
    // 门的光晕 / 提示
    if (S.took >= 3) {
      // 门槛前的暖光：走进这个光圈就出门
      const th = P.threshold();
      const a = .28 + .18 * Math.abs(Math.sin(S.t * 3));
      const g2 = ctx.createRadialGradient(th[0], th[1] + 10, 2, th[0], th[1] + 10, 48);
      g2.addColorStop(0, 'rgba(255,214,140,' + a + ')');
      g2.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.ellipse(th[0], th[1] + 10, 48, 18, 0, 0, 7); ctx.fill();
    }

    // 屏幕层 UI
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawSlots(W, H);
    drawDialogue(W, H);
    if (S.phase === 'free') {
      ctx.font = 'bold 14px "PingFang SC","Noto Sans CJK SC",sans-serif';
      ctx.fillStyle = 'rgba(242,230,201,.7)'; ctx.textAlign = 'center';
      const t = S.took >= 3 ? '走到门口出去' : `捡起地上的武器（${S.took}/3）`;
      ctx.fillText(t, W / 2, H - 18); ctx.textAlign = 'left';
    }
    // 转场
    if (S.fade > 0) { ctx.fillStyle = `rgba(255,255,255,${S.fade})`; ctx.fillRect(0, 0, W, H); }
    if (S.out > 0) { ctx.fillStyle = `rgba(0,0,0,${Math.min(1, S.out / .6)})`; ctx.fillRect(0, 0, W, H); }
    return true;
  }

  // ---------- 样式：农房里只留摇杆和静音 ----------
  const style = document.createElement('style');
  style.textContent = `
    body.wzb-room #top, body.wzb-room #wp button[data-w], body.wzb-room #bA,
    body.wzb-room #bR, body.wzb-room #help { display: none !important; }
    body.wzb-wake #joy { display: none !important; }
    body.wzb-wake #bA, body.wzb-wake #bR { display: none !important; }
  `;
  document.head.appendChild(style);
  roomImg = new Image();
  roomImg.src = (typeof ASSETS !== 'undefined' && ASSETS.room) || '';

  window.ROOM = {
    begin,
    blocks: () => S.mode === 'play',
    draw,
    update: (dt) => update(dt),
    active: () => S.mode === 'play',
    skip: () => { S.mode = 'off'; document.body.classList.remove('wzb-room', 'wzb-wake'); },
    place: (px, py) => { S.hero.x = px; S.hero.y = py; },   // 调试用：摆位置
    geo: () => ({ doorL: P.doorL(), doorR: P.doorR(), thr: P.threshold(), top: P.floorTop(), bot: P.floorBot() }),
    info: () => ({ phase: S.phase, took: S.took, x: Math.round(S.hero ? S.hero.x : 0), viewW: Math.round(viewW()) }),
  };
})();
