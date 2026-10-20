// 开场演出：被吸进东汉末年，在农房里醒来 → 捡起地上三把武器 → 从门口出去进入村庄。
// game.js 里只挂 2 处（update/draw 各一行判断），其余全在这个文件里。
(() => {
  const LINES = [
    { s: '我怎么了', d: 1.8 },
    { s: '这里是哪里', d: 1.8 },
    { s: '外面好像很危险，捡起地上的武器 出去看看。', d: 3.4 },
  ];
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
    S.hero = { x: vw * .16, y: 258, f: 1, st: 'down', t: 0, vx: 0 };
    S.items = [
      { k: 'staff', x: vw * .34, y: 252, got: 0, bob: 0 },
      { k: 'hammer', x: vw * .50, y: 262, got: 0, bob: 1.1 },
      { k: 'stone', x: vw * .66, y: 250, got: 0, bob: 2.2 },
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
    h.x += ix * 82 * dt; h.y += iy * 58 * dt;
    h.x = Math.max(24, Math.min(vw - 24, h.x));
    h.y = Math.max(218, Math.min(282, h.y));
    h.st = (ix || iy) ? 'walk' : 'idle';

    // 碰到武器就自动捡起
    for (const it of S.items) {
      if (it.got) continue;
      if (Math.abs(it.x - h.x) < 18 && Math.abs(it.y - h.y) < 16) {
        it.got = 1; S.took++;
        if (window.SFX) SFX.play('pickup', 0);
        S.li = -1; S.lineT = 0;
      }
    }

    // 三把都拿了才能出门
    if (S.took >= 3 && h.x > vw - 62 && h.y > 210 && S.out === 0) {
      S.out = .001;
      if (window.SFX) SFX.play('land', 0);
    }
  }

  // ---------- 绘制 ----------
  const R = () => (typeof SC !== 'undefined' ? SC : 1);

  function drawArt(vw) {
    const c = ctx, SC = R();
    c.setTransform(SC, 0, 0, SC, 0, 0);
    // 墙
    const wg = c.createLinearGradient(0, 0, 0, 205);
    wg.addColorStop(0, '#1c120e'); wg.addColorStop(.55, '#2a1a12'); wg.addColorStop(1, '#231610');
    c.fillStyle = wg; c.fillRect(0, 0, vw, 205);
    // 木板：竖条
    for (let x = 0; x < vw; x += 26) {
      c.fillStyle = (x / 26) % 2 ? 'rgba(255,190,120,.035)' : 'rgba(0,0,0,.10)';
      c.fillRect(x, 0, 13, 205);
      c.fillStyle = 'rgba(0,0,0,.28)'; c.fillRect(x + 25, 0, 1, 205);
    }
    // 横梁
    c.fillStyle = '#150d0a'; c.fillRect(0, 66, vw, 9);
    c.fillStyle = 'rgba(255,200,140,.06)'; c.fillRect(0, 66, vw, 1.5);
    // 地面
    const fg = c.createLinearGradient(0, 205, 0, 300);
    fg.addColorStop(0, '#4a3520'); fg.addColorStop(1, '#2c1f14');
    c.fillStyle = fg; c.fillRect(0, 205, vw, 95);
    for (let x = -40; x < vw + 40; x += 44) { c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(x + (x % 88 ? 12 : 0), 214, 1, 86); }
    for (let y = 226; y < 298; y += 22) { c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(0, y, vw, 1); }
    // 窗户（左侧），暖光
    const wx = vw * .06, wy = 88, ww = vw * .13, wh = 52;
    c.fillStyle = '#0d0906'; c.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
    const lg = c.createLinearGradient(wx, wy, wx, wy + wh);
    lg.addColorStop(0, '#ffd9a0'); lg.addColorStop(1, '#ff9b4a');
    c.fillStyle = lg; c.fillRect(wx, wy, ww, wh);
    c.fillStyle = 'rgba(80,40,20,.55)'; c.fillRect(wx + ww * .48, wy, 2, wh); c.fillRect(wx, wy + wh * .46, ww, 2);
    // 光柱
    c.save();
    const sg = c.createLinearGradient(wx, wy + wh, wx + vw * .5, 300);
    sg.addColorStop(0, 'rgba(255,200,120,.18)'); sg.addColorStop(1, 'rgba(255,200,120,0)');
    c.fillStyle = sg;
    c.beginPath(); c.moveTo(wx, wy + wh); c.lineTo(wx + ww, wy + wh); c.lineTo(wx + ww + vw * .42, 300); c.lineTo(wx + vw * .16, 300); c.closePath(); c.fill();
    c.restore();
    // 门（右侧）：外面是亮的
    const dx = vw - 92, dy = 118, dw = 66, dh = 168;
    c.fillStyle = '#0b0705'; c.fillRect(dx - 4, dy - 4, dw + 8, dh + 4);
    const dg = c.createLinearGradient(dx, dy, dx, dy + dh);
    dg.addColorStop(0, '#ffcf8a'); dg.addColorStop(.5, '#ffab4e'); dg.addColorStop(1, '#e07a2c');
    c.fillStyle = dg; c.fillRect(dx, dy, dw, dh);
    // 门外的地面/远景剪影
    c.fillStyle = 'rgba(120,70,30,.45)'; c.fillRect(dx, dy + dh * .72, dw, dh * .28);
    c.fillStyle = 'rgba(60,30,12,.5)'; c.fillRect(dx + 6, dy + dh * .72, dw - 12, 3);
    // 门框
    c.strokeStyle = '#120b07'; c.lineWidth = 5; c.strokeRect(dx - 2.5, dy - 2.5, dw + 5, dh + 5);
    // 墙角的杂物：草垫 + 陶罐
    c.fillStyle = '#3b2a17'; c.fillRect(24, 268, 46, 8);
    c.fillStyle = '#55401f'; c.fillRect(24, 266, 46, 3);
    c.fillStyle = '#2f2318'; c.beginPath(); c.ellipse(vw * .86, 268, 13, 16, 0, 0, 7); c.fill();
    c.fillStyle = '#3e2f1f'; c.beginPath(); c.ellipse(vw * .86 - 4, 262, 5, 8, .3, 0, 7); c.fill();
    // 微尘
    for (const m of S.motes) {
      c.globalAlpha = .12 + .28 * Math.abs(Math.sin(m.p));
      c.fillStyle = '#ffe6b0'; c.fillRect(m.x, m.y, m.r, m.r);
    }
    c.globalAlpha = 1;
    // 暗角
    const vg = c.createRadialGradient(vw / 2, 160, 80, vw / 2, 160, vw * .75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)');
    c.fillStyle = vg; c.fillRect(0, 0, vw, 300);
  }

  // 地上的武器（世界坐标画）
  function drawItem(it, t) {
    if (it.got) return;
    const c = ctx, yy = it.y + Math.sin(t * 2 + it.bob) * 1.6;
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(it.x, it.y + 4, 13, 4, 0, 0, 7); c.fill();
    // 微光
    const g = c.createRadialGradient(it.x, yy - 6, 1, it.x, yy - 6, 18);
    g.addColorStop(0, 'rgba(255,216,110,.35)'); g.addColorStop(1, 'rgba(255,216,110,0)');
    c.fillStyle = g; c.beginPath(); c.arc(it.x, yy - 6, 18, 0, 7); c.fill();
    icon(it.k, it.x, yy - 6, 1, true);
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
      drawChar('hero', f, h.x, h.y, h.f < 0);
    } });
    list.sort((a, b) => a.y - b.y).forEach(o => o.d());
    // 门的光晕 / 提示
    if (S.took >= 3) {
      ctx.setTransform(SC, 0, 0, SC, 0, 0);
      const a = .25 + .2 * Math.abs(Math.sin(S.t * 3));
      ctx.fillStyle = `rgba(255,216,110,${a})`;
      ctx.fillRect(vw - 96, 112, 74, 6);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.font = 'bold 16px "PingFang SC","Noto Sans CJK SC",sans-serif';
      ctx.textAlign = 'center'; ctx.fillStyle = '#ffd86e';
      ctx.fillText('出门 →', W - 60, 100); ctx.textAlign = 'left';
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

  window.ROOM = {
    begin,
    blocks: () => S.mode === 'play',
    draw,
    update: (dt) => update(dt),
    active: () => S.mode === 'play',
    skip: () => { S.mode = 'off'; document.body.classList.remove('wzb-room', 'wzb-wake'); },
    info: () => ({ phase: S.phase, took: S.took, x: Math.round(S.hero ? S.hero.x : 0), viewW: Math.round(viewW()) }),
  };
})();
