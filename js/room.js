// 开场演出：在村外醒来，捡起地上的武器，穿过右侧门洞进入村庄。
// game.js 里只挂 2 处（update/draw 各一行判断），其余全在这个文件里。
(() => {
  const LINES = [
    { s: '我怎么会躺在这里……', d: 1.8 },
    { s: '墙那边有打杀声！', d: 1.8 },
    { s: '先拿起地上的武器，往右边过去。', d: 3.4 },
  ];
  // ---------- 村外场景原图 + 统一坐标换算 ----------
  const IMG_W = 2560, IMG_H = 884;          // 原图 3520×1216，压到 2560 宽以控制网页体积         // art/room/wake_outside.webp 的原始尺寸
  const CROP_TOP = 0;
  const CROP_H = IMG_H;
  const BOX_AR = IMG_W / IMG_H;
  const PXW = IMG_H / 300;                  // 与原开场保持接近的角色世界比例
  const BOX = { x: 0, y: 0, w: 0, h: 0 };
  const FIT = { s: 1, k: 1 };
  let roomImg = null;

  // 场景尽量铺满屏幕宽度；手机横屏时限制高度，完整保留两侧地形。
  function fitImg() {
    const W = cv.width / DPR, H = cv.height / DPR;
    const coarse = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints || 0) > 0;
    let bw = Math.min(W * .94, H * (coarse ? .76 : .72) * BOX_AR), bh = bw / BOX_AR;
    BOX.w = bw; BOX.h = bh;
    BOX.x = (W - bw) / 2;
    BOX.y = (H - bh) / 2 - H * .02;
    FIT.s = bw / IMG_W;                       // CSS 像素 / 图像素
    FIT.k = FIT.s * PXW;                      // CSS 像素 / 世界单位
    return FIT.s;
  }
  // 图上像素 → 世界坐标（原点 = 裁切后的左上角），背景/人物/武器/判定全用这一个
  const toW = (px, py) => [px / PXW, (py - CROP_TOP) / PXW];

  // 常用锚点（图上比例 → 世界坐标）
  let ptrDown = false;                 // 当前是否有手指/鼠标按在屏幕上
  addEventListener('pointerdown', () => { ptrDown = true; });
  addEventListener('pointerup', () => { ptrDown = false; try { if (typeof joy !== 'undefined') joy = null; } catch (e) {} });
  addEventListener('pointercancel', () => { ptrDown = false; try { if (typeof joy !== 'undefined') joy = null; } catch (e) {} });
  addEventListener('blur', () => { ptrDown = false; });

  const P = {
    spawn: () => toW(IMG_W * .40, IMG_H * .82),           // 在空地左侧醒来
    doorL: () => toW(IMG_W * .79, IMG_H * .75),           // 右侧墙门洞
    doorR: () => toW(IMG_W * .88, IMG_H * .75),
    threshold: () => toW(IMG_W * .835, IMG_H * .76),      // 门口地面中心
    floorTop: () => toW(IMG_W * .5, IMG_H * .59)[1],      // 地面最里侧
    floorBot: () => toW(IMG_W * .5, IMG_H * .94)[1],      // 地面最外侧
    wallL: () => toW(IMG_W * .37, 0)[0],                  // 左侧山坡与废墟不可通行
    wallR: () => toW(IMG_W * .94, 0)[0],
  };
  // 近大远小：站得越靠下（越近）越大
  const depthScale = (wy) => {
    const top = P.floorTop(), bot = P.floorBot();
    const k = Math.max(0, Math.min(1, (wy - top) / Math.max(1, bot - top)));
    return 0.92 + 0.16 * k;
  };
  const HERO_SCALE = 1.2;   // 保留原角色尺寸；绘制时按场景显示比例补偿

  const KINDS = ['staff', 'hammer', 'stone'];
  const NAME = { staff: '棍', hammer: '锤子', stone: '石子' };

  const S = {
    mode: 'off',        // off | play
    phase: 'wake',      // wake（还没站起来）| free（可自由走动）
    t: 0, li: -1, lineT: 0, fade: 1, out: 0, took: 0, cn: 0, ct: 0,
    hero: null, items: [], motes: [], battleT: 0, battleI: 0,
  };

  function viewW() { try { return cv.width / DPR / ((cv.height / DPR) / 300); } catch (e) { return 640; } }

  function resetRoom() {
    const vw = viewW();
    S.phase = 'wake'; S.t = 0; S.li = -1; S.lineT = 0; S.cn = 0; S.ct = 0; S.fade = 1; S.out = 0; S.took = 0; S.battleT = 1.2; S.battleI = 0;
    fitImg();
    const sp = P.spawn();
    S.hero = { x: sp[0], y: sp[1], f: 1, st: 'down', t: 0, vx: 0 };
    // 三种现有武器散落在醒来点前方的空地上
    S.items = [
      { k: 'staff', x: toW(IMG_W * .47, IMG_H * .83)[0], y: toW(IMG_W * .47, IMG_H * .83)[1], got: 0, bob: 0 },
      { k: 'hammer', x: toW(IMG_W * .52, IMG_H * .86)[0], y: toW(IMG_W * .52, IMG_H * .86)[1], got: 0, bob: 1.1 },
      { k: 'stone', x: toW(IMG_W * .57, IMG_H * .82)[0], y: toW(IMG_W * .57, IMG_H * .82)[1], got: 0, bob: 2.2 },
    ];
    S.motes = Array.from({ length: 18 }, () => ({ x: Math.random() * vw, y: 140 + Math.random() * 140, r: .6 + Math.random() * 1.2, s: .3 + Math.random() * .8, p: Math.random() * 6.28 }));
  }

  // 台词阶段：点一下或按攻击键，立刻跳到下一句
  function skipLine() {
    if (S.mode !== 'play' || S.phase !== 'wake' || S.li < 0) return;
    if (window.SFX) SFX.play('blip', 0);
    S.cn = 999;
    S.lineT = 0;
  }
  addEventListener('pointerdown', () => skipLine(), { capture: true });
  addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.code === 'KeyJ' || e.code === 'Space' || e.code === 'Enter') skipLine();
  }, { capture: true });

  function begin() {
    setTimeout(() => { if (window.SFX && SFX.voice) SFX.voice('intro'); }, 260);   // 报幕语音
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

    // 墙后持续传来断续的打斗声，音量轻且偏右，提示玩家朝右侧前进。
    S.battleT -= dt;
    if (S.battleT <= 0 && window.SFX) {
      const sounds = ['enemySwing', 'hit_knife', 'enemyDown'];
      SFX.play(sounds[S.battleI % sounds.length], .72);
      S.battleI++; S.battleT = 2.2 + Math.random() * 1.5;
    }

    // 可走动：键盘 + 手机摇杆（都读游戏里已有的输入状态）
    let ix = 0, iy = 0;
    if (typeof key !== 'undefined' && key) {
      ix = (key.KeyD || key.ArrowRight ? 1 : 0) - (key.KeyA || key.ArrowLeft ? 1 : 0);
      iy = (key.KeyS || key.ArrowDown ? 1 : 0) - (key.KeyW || key.ArrowUp ? 1 : 0);
    }
    // 摇杆只在"手指真的按在屏幕上"时才算数：之前抬手后 joy 没清零，会导致一直往左走
    if (ptrDown && typeof joy !== 'undefined' && joy) { ix = Math.abs(joy.dx) > .2 ? joy.dx : 0; iy = Math.abs(joy.dy) > .2 ? joy.dy : 0; }
    const vw = viewW();
    if (ix) h.f = Math.sign(ix);
    h.x += ix * 86 * dt; h.y += iy * 58 * dt;
    h.x = Math.max(P.wallL(), Math.min(P.wallR(), h.x));
    h.y = Math.max(P.floorTop() + 4, Math.min(P.floorBot(), h.y));
    h.st = (ix || iy) ? 'walk' : 'idle';

    // 碰到武器就自动捡起
    for (const it of S.items) {
      if (it.got) continue;
      if (Math.abs(it.x - h.x) < 14 && Math.abs(it.y - h.y) < 14) {
        it.got = 1; S.took++;
        if (window.SFX) SFX.play('pickup', 0);
        S.li = -1; S.lineT = 0;
      }
    }

    // 三把都拿了才能出门
    // 出门：门洞 x 范围内 + 走到门槛上（y 比门槛更靠里）
    const dl = P.doorL()[0], dr = P.doorR()[0];
    const doorY0 = toW(IMG_W * .5, IMG_H * .68)[1], doorY1 = toW(IMG_W * .5, IMG_H * .84)[1];
    // 门口触发覆盖门洞和门前一段地面，避免必须踩中一条很窄的“传送阵”。
    if (S.took >= 3 && h.x > dl - 22 && h.x < dr + 22 && h.y > doorY0 && h.y < doorY1 && S.out === 0) {
      S.out = .001;
      if (window.SFX) SFX.play('land', 0);
    }
  }

  // ---------- 绘制 ----------
  const R = () => (typeof SC !== 'undefined' ? SC : 1);

  function drawArt(vw) {
    const c = ctx;
    fitImg();
    c.setTransform(DPR, 0, 0, DPR, 0, 0);
    const W = cv.width / DPR, H = cv.height / DPR;
    const bx = BOX.x, by = BOX.y, bw = BOX.w, bh = BOX.h;
    // 画面外用柔和的黄褐色暗角延续野外氛围，不做室内画框。
    const bg = c.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#302521'); bg.addColorStop(1, '#76512d');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    if (roomImg && roomImg.complete) {
      c.imageSmoothingEnabled = true;
      c.drawImage(roomImg, 0, 0, IMG_W, IMG_H, bx, by, bw, bh);
    } else {
      c.fillStyle = '#76512d'; c.fillRect(bx, by, bw, bh);
    }
    // 微尘
    c.setTransform(DPR * FIT.k, 0, 0, DPR * FIT.k, bx * DPR, by * DPR);
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
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(it.x, it.y + 4, 13 * depthScale(it.y), 4 * depthScale(it.y), 0, 0, 7); c.fill();
    // 微光
    const g = c.createRadialGradient(it.x, yy - 6, 1, it.x, yy - 6, 18);
    g.addColorStop(0, 'rgba(255,216,110,.35)'); g.addColorStop(1, 'rgba(255,216,110,0)');
    c.fillStyle = g; c.beginPath(); c.arc(it.x, yy - 6, 18, 0, 7); c.fill();
    icon(it.k, it.x, yy - 6, 1.35 * depthScale(it.y), true);
  }

  // 武器图标（和装备框共用）
  function icon(kind, x, y, s, ground) {
    const c = ctx;
    const name = { staff: 'w_staff', hammer: 'w_hammer', stone: 'w_stone' }[kind];
    const im = (typeof IMG !== 'undefined') && IMG['ui_' + name];
    if (im && im.complete) {                     // 用新的武器图标
      const H = 13 * s, W = H * im.width / im.height;
      c.save(); c.imageSmoothingEnabled = false;
      c.drawImage(im, Math.round(x - W / 2), Math.round(y - H / 2), W, H);
      c.restore();
      return;
    }
    c.save(); c.translate(x, y); c.scale(s, s);
    if (kind === 'staff') {
      c.strokeStyle = '#3a2410'; c.lineWidth = 5.2; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-10, 6); c.lineTo(10, -8); c.stroke();
      c.strokeStyle = '#8a5c2c'; c.lineWidth = 2.6;
      c.beginPath(); c.moveTo(-9, 5); c.lineTo(9, -7); c.stroke();
      c.strokeStyle = '#c08a4a'; c.lineWidth = .8; c.beginPath(); c.moveTo(-8, 4); c.lineTo(8, -6); c.stroke();
    } else if (kind === 'hammer') {
      c.strokeStyle = '#3a2410'; c.lineWidth = 5.4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-9, 7); c.lineTo(5, -5); c.stroke();
      c.strokeStyle = '#6b4a22'; c.lineWidth = 2.6;
      c.beginPath(); c.moveTo(-8, 6); c.lineTo(4, -4); c.stroke();
      c.fillStyle = '#3a2410'; c.fillRect(1, -11, 12, 10);
      c.fillStyle = '#7d7d86'; c.fillRect(2, -10, 10, 8);
      c.fillStyle = '#a9a9b4'; c.fillRect(2, -10, 10, 2.5);
      c.fillStyle = '#4a4a52'; c.fillRect(2, -4, 10, 2);
    } else {
      c.fillStyle = '#3a2410'; c.beginPath(); c.arc(0, 0, 6.6, 0, 7); c.fill();
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
    fitImg();
    SC = FIT.k * DPR;                 // 设备像素 / 世界单位（按舞台框缩放）
    OXs = BOX.x * DPR;                // 世界原点 X
    const OYw = (BOX.y * DPR) / SC;   // 世界原点 Y（折算成世界单位，drawChar 没有 OY，只能加在坐标上）
    drawArt(vw);
    ctx.setTransform(SC, 0, 0, SC, OXs, BOX.y * DPR);
    // 地上的武器 + 主角（按 y 排序）
    const list = [];
    for (const it of S.items) list.push({ y: it.y, d: () => drawItem(it, S.t) });
    list.push({ y: S.hero.y, d: () => {
      const h = S.hero;
      let f = 'idle';
      if (h.st === 'down' || h.st === 'getup') f = h.st;
      else if (h.st === 'walk') f = 'walk' + ([1, 2, 3, 2][Math.floor(h.t * 8) % 4]);
      const oldStageH = (cv.height / DPR) * ((matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints || 0) > 0) ? .51 : .47);
      const sizeKeep = HERO_SCALE * oldStageH * 572 / (446 * Math.max(1, BOX.h));
      drawChar('hero', f, h.x, h.y + OYw, h.f < 0, 1, false, sizeKeep * depthScale(h.y));
    } });
    list.sort((a, b) => a.y - b.y).forEach(o => o.d());
    // 门的光晕 / 提示
    if (S.took >= 3) {
      // 门槛前的暖光：走进这个光圈就出门
      const th = P.threshold();
      const a = .28 + .18 * Math.abs(Math.sin(S.t * 3));
      const g2 = ctx.createRadialGradient(th[0], th[1] + 10, 2, th[0], th[1] + 10, 60);
      g2.addColorStop(0, 'rgba(255,214,140,' + a + ')');
      g2.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = g2;
      ctx.beginPath(); ctx.ellipse(th[0], th[1] + 10, 60, 26, 0, 0, 7); ctx.fill();
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

  // ---------- 样式：开场只留摇杆和静音 ----------
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
