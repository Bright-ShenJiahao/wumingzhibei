// 开始界面（登录页）：标题 / 电视演示 / 名字输入 / 开始按钮 / 操作说明 / 穿越转场。
// 只在 game.js 里挂 3 处：update 开头挡推进、draw 开头接管整屏、HUD 取名字。
// 换正式背景图时只改下面 TV 和 drawBg() 里的图片即可。
(() => {
  const TV = { x: .40, y: .22, w: .30, h: .30 };   // 电视屏幕区域（按屏幕宽高的比例）
  const NAME_KEY = 'wzb-name';
  const S = { mode: 'title', intro: 0, flash: 1, name: '', msg: '', msgT: 0, shake: 0, t: 0 };
  const L = {};                 // 布局（CSS 像素）
  let bgFar = null, bgMid = null, bgGnd = null, demoCv = null, dctx = null, dom = {}, built = false, helpOpen = false;

  // ---------- 名字（localStorage，读写都兜住异常） ----------
  function readName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch (e) { return ''; } }
  function writeName(n) { try { localStorage.setItem(NAME_KEY, n); } catch (e) {} }
  S.name = readName();

  // ---------- 演示用的迷你世界（离屏 canvas） ----------
  const D = { camX: 0, t: 0, hero: null, foes: [], props: [], loop: 0, over: 0 };
  const VIEWH = 300, PX = .4;
  const ATK = [[.16, .2], [.12, .2], [.18, .26]];   // 三段前摇/后摇（和棍子一致）
  const AF = [['staff_1a', 'staff_1b'], ['staff_2a', 'staff_2b'], ['staff_3a', 'staff_3b']];
  const DUR = ATK.reduce((a, c) => a + c[0] + c[1], 0);
  function gap(i) { return ATK[i][0] + ATK[i][1]; }

  function demoReset() {
    D.t = 0; D.camX = 40; D.loop++;
    D.hero = { x: 60, y: 232, f: 1, st: 'walk', t: 0, c: 0, fi: 0, atk: false, killed: 0 };
    D.foes = [
      { x: 190, y: 226, hp: 2, f: -1, dead: 0, vx: 0, st: 'idle', t: 0, flash: 0, kind: 'grunt' },
      { x: 330, y: 244, hp: 2, f: -1, dead: 0, vx: 0, st: 'idle', t: 0, flash: 0, kind: 'blade' },
      { x: 470, y: 220, hp: 2, f: -1, dead: 0, vx: 0, st: 'idle', t: 0, flash: 0, kind: 'grunt' },
    ];
    D.props = [{ x: 270, y: 250, g: 'hay' }, { x: 560, y: 236, g: 'flag' }];
  }

  function demoStep(dt) {
    D.t += dt;
    const h = D.hero, SC = demoCv.height / VIEWH;
    // 主角：走向最近的活着的敌人 → 贴身打一套
    const foe = D.foes.find(f => !f.dead);
    if (!foe) {
      if (h.st !== 'walk') { h.st = 'walk'; h.t = 0; }
      h.f = 1; h.x += 70 * dt;
      if (h.x > 700) { if (!D.over) D.over = D.t; if (D.t - D.over > 1.2) { D.over = 0; demoReset(); } }
    } else if (h.atk) {
      h.t += dt;
      const [a, b] = ATK[h.c];
      if (h.fi === 0 && h.t >= a) {
        h.fi = 1;   // 出手
        const dx = (foe.x - h.x) * h.f;
        if (dx > -6 && dx < 40 && Math.abs(foe.y - h.y) < 14) {
          foe.hp--; foe.flash = .12; foe.vx = h.f * 90;
          if (foe.hp <= 0) { foe.dead = 1; foe.vy = 120; foe.z = 1; foe.t = 0; h.killed++; }
        }
        if (h.c === 2) {   // 第三段扫到旁边的人
          for (const o of D.foes) if (!o.dead && o !== foe && Math.abs(o.x - h.x) < 45) { o.hp--; o.flash = .12; o.vx = h.f * 80; if (o.hp <= 0) { o.dead = 1; o.vy = 120; o.z = 1; o.t = 0; h.killed++; } }
        }
      }
      if (h.t >= a + b) {
        h.t = 0; h.fi = 0; h.c++;
        if (h.c > 2) { h.c = 0; h.atk = false; h.st = 'idle'; }
      }
    } else {
      const dx = foe.x - h.x;
      h.f = Math.sign(dx) || h.f;
      if (Math.abs(dx) > 34) { h.st = 'walk'; h.x += Math.sign(dx) * 76 * dt; }
      else { h.st = 'atk'; h.atk = true; h.c = 0; h.fi = 0; h.t = 0; }
    }
    // 敌人：被击退 → 落地
    for (const f of D.foes) {
      f.flash = Math.max(0, f.flash - dt);
      if (f.vx) { f.x += f.vx * dt; f.vx *= .82; if (Math.abs(f.vx) < 3) f.vx = 0; }
      if (f.dead) { f.t += dt; if (f.z) { f.vy -= 420 * dt; f.z += f.vy * dt; if (f.z <= 0) { f.z = 0; f.vy = 0; } } }
    }
    // 镜头：跟着主角，但限制在演示世界里
    const vw = demoCv.width / SC;
    const want = h.x - vw * .42;
    D.camX += (Math.max(0, Math.min(640 - vw, want)) - D.camX) * Math.min(1, dt * 4);
  }

  function dChar(c, name, f, x, y, flip, alpha, white) {
    const fr = CH[name] && CH[name][f]; if (!fr || !fr.img.complete) return;
    const SC = demoCv.height / VIEWH, sp = Math.max(.5, SC * PX);
    const sx = Math.round(x * SC), sy = Math.round(y * SC);
    c.save(); c.setTransform(1, 0, 0, 1, sx, sy); if (flip) c.scale(-1, 1);
    c.globalAlpha = alpha == null ? 1 : alpha;
    c.imageSmoothingEnabled = false;
    c.drawImage(white && fr.white ? fr.white : fr.img, -fr.ax * sp, -fr.ay * sp, fr.w * sp, fr.h * sp);
    c.restore();
  }

  function demoRender() {
    const c = dctx, W = demoCv.width, H = demoCv.height, SC = H / VIEWH;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#160f1a'; c.fillRect(0, 0, W, H);
    // 背景（视差）—— 和游戏里同样的贴图方式
    const layer = (img, s, par, y) => {
      if (!img || !img.complete || !img.width) return;
      const tw = img.width * s, vw = W / SC, ox = D.camX * (1 - par);
      for (let i = Math.floor((D.camX - ox) / tw) - 1; i * tw + ox < D.camX + vw; i++) {
        const x = i * tw + ox;
        c.save(); c.translate((x - D.camX) * SC, y * SC); c.scale(SC, SC);
        c.drawImage(img, 0, 0, tw + .5, img.height * s);
        c.restore();
      }
    };
    const ms = .24 / .61, my = 165 - 619 * .24;
    layer(bgFar, .577, .3, 0);
    layer(bgGnd, .62, 1, my + 560 * ms);
    layer(bgMid, ms, 1, my);
    // 地面上的东西按 y 排序
    const list = [];
    for (const p of D.props) list.push({ y: p.y, d: () => {
      const pr = ASSETS.props[p.g]; if (!pr) return;
      const [, w, h] = pr; const im = IMG['p_' + p.g];
      if (!im || !im.complete) return;
      c.save(); c.translate((p.x - D.camX) * SC, p.y * SC); c.scale(SC, SC); c.drawImage(im, -w / 2, -h + 2, w, h); c.restore();
    } });
    for (const f of D.foes) list.push({ y: f.y, d: () => {
      const fr = f.dead ? 'down' : (f.flash > 0 ? 'hurt' : (f.vx ? 'hurt' : 'walk1'));
      const x = f.x - D.camX, a = f.dead ? Math.max(0, 1 - Math.max(0, f.t - .5)) : 1;
      dChar(c, f.kind, fr, x, f.y - (f.z || 0), f.f > 0, a, f.flash > 0);
    } });
    const h = D.hero;
    list.push({ y: h.y, d: () => {
      const fr = h.atk ? AF[h.c][h.fi] : (h.st === 'walk' ? 'staffw' + (Math.floor(h.t * 8) % 4 + 1) : 'staff0');
      const nm = h.st === 'walk' ? 'staffw' + ([1, 2, 3, 2][Math.floor(h.t * 8) % 4]) : fr;
      dChar(c, 'hero', h.st === 'walk' ? nm : fr, h.x - D.camX, h.y, h.f < 0, 1, false);
    } });
    c.setTransform(1, 0, 0, 1, 0, 0);
    list.sort((a, b) => a.y - b.y).forEach(o => o.d());
  }

  // ---------- 界面骨架 ----------
  function build() {
    if (built) return;
    built = true;
    const st = document.createElement('style');
    st.textContent = `
      body.wzb-title #top, body.wzb-title #help, body.wzb-title #joy,
      body.wzb-title #bA, body.wzb-title #bR { display: none !important; }
      body.wzb-title #wp button[data-w] { display: none !important; }
      body.wzb-intro #wp, body.wzb-intro #bMute { display: none !important; }
      #tStyle0 { display: none; }
      #tName, #tStart, #tHelp {
        position: fixed; z-index: 7; font-family: "PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif;
        box-sizing: border-box; -webkit-tap-highlight-color: transparent;
      }
      #tName {
        background: rgba(18,12,26,.62); border: 1.5px solid #c9971f; border-radius: 9px;
        color: #f7e7c2; font-size: 16px; font-weight: 700; text-align: center; outline: none;
        letter-spacing: .06em; transition: box-shadow .15s, border-color .15s;
        box-shadow: 0 0 0 1px rgba(0,0,0,.4), inset 0 0 12px rgba(0,0,0,.5);
      }
      #tName::placeholder { color: rgba(247,231,194,.42); font-weight: 600; }
      #tName:focus { border-color: #ffd86e; box-shadow: 0 0 12px rgba(255,216,110,.35); }
      #tName.shake { animation: tshake .32s; }
      @keyframes tshake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-7px)} 40%{transform:translateX(7px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(4px)} }
      #tStart {
        background: linear-gradient(180deg,#f7dd8a 0%,#e8bc46 42%,#c9931a 100%);
        border: 2px solid #8a5f12; border-radius: 12px; color: #2b1a06; font-weight: 900;
        letter-spacing: .22em; text-shadow: 0 1px 0 rgba(255,255,255,.45);
        box-shadow: 0 4px 0 #8a5f12, 0 8px 18px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.7);
        cursor: pointer; transition: transform .06s, box-shadow .06s;
      }
      #tStart:active { transform: translateY(4px); box-shadow: 0 0 0 #8a5f12, 0 3px 8px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.5); }
      #tHelp {
        background: rgba(20,14,30,.55); border: 1.5px solid rgba(255,255,255,.5); border-radius: 8px;
        color: #fff; font-size: 15px; font-weight: 700; text-shadow: 0 1px 2px #000; cursor: pointer;
      }
      #tHelp:active { background: rgba(255,255,255,.25); }
      #tTip {
        position: fixed; z-index: 8; color: #ff8f7a; font: 700 14px/1.4 "PingFang SC",sans-serif;
        text-shadow: 0 1px 3px #000; transform: translate(-50%,0); pointer-events: none; opacity: 0;
        transition: opacity .2s;
      }
      #tHelpPanel {
        position: fixed; z-index: 9; left: 50%; top: 50%; transform: translate(-50%,-50%);
        background: rgba(18,12,26,.94); border: 2px solid #c9971f; border-radius: 14px; padding: 18px 22px;
        color: #f2e6c9; font: 600 14px/1.9 "PingFang SC","Noto Sans CJK SC",sans-serif;
        box-shadow: 0 12px 40px rgba(0,0,0,.6); display: none; max-width: 86vw; text-align: left;
      }
      #tHelpPanel b { color: #ffd86e; }
      #tHelpPanel h3 { margin: 0 0 8px; font-size: 16px; color: #ffd86e; text-align: center; }
      #tFlash {
        position: fixed; inset: 0; z-index: 10; background: #fff; opacity: 1; pointer-events: none;
        transition: opacity .3s ease-out;
      }
    `;
    document.head.appendChild(st);
    const mk = (tag, id, text) => { const e = document.createElement(tag); e.id = id; if (text) e.textContent = text; document.body.appendChild(e); return e; };
    dom.name = mk('input', 'tName'); dom.name.type = 'text'; dom.name.maxLength = 8;
    dom.name.placeholder = '输入你的名字'; dom.name.value = S.name;
    dom.name.setAttribute('autocomplete', 'off'); dom.name.setAttribute('spellcheck', 'false');
    dom.start = mk('button', 'tStart', '开始游戏');
    dom.help = mk('button', 'tHelp', '?');
    dom.help.title = '操作说明'; dom.help.setAttribute('aria-label', '操作说明');
    dom.tip = mk('div', 'tTip', '请输入名字');
    dom.panel = document.createElement('div'); dom.panel.id = 'tHelpPanel';
    dom.panel.innerHTML = `<h3>操作说明</h3>
      <div><b>电脑</b>：WASD / 方向键 移动 · J 攻击（连按三连击）· K 或空格 翻滚 · 1 / 2 / 3 换武器 · R 重来</div>
      <div><b>手机</b>：左下摇杆移动 · 右下「攻击」连按三连击 · 「翻滚」闪避 · 右上换武器</div>
      <div style="margin-top:6px;color:#c9b68a">打中敌人才能接着连招；被打中会打断连招。草垛和推车可以打坏。</div>`;
    document.body.appendChild(dom.panel);
    dom.flash = mk('div', 'tFlash', '');
    dom.name.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') start();
      if (e.key === 'Escape') dom.name.blur();
    });
    dom.name.addEventListener('input', () => { if (dom.name.value.length > 8) dom.name.value = dom.name.value.slice(0, 8); });
    dom.start.addEventListener('click', start);
    dom.help.addEventListener('click', () => { helpOpen = !helpOpen; dom.panel.style.display = helpOpen ? 'block' : 'none'; });
    dom.panel.addEventListener('click', () => { helpOpen = false; dom.panel.style.display = 'none'; });
    // 首次进入：把白闪淡出
    requestAnimationFrame(() => { dom.flash.style.opacity = 0; });
    layout();
  }

  function layout() {
    const w = innerWidth, h = innerHeight;
    L.w = w; L.h = h;
    L.title = Math.max(24, Math.min(58, h * .115));
    L.sub = Math.max(12, Math.min(18, h * .033));
    L.inW = Math.max(180, Math.min(320, w * .42));
    L.inH = Math.max(34, Math.min(46, h * .095));
    L.inY = h * .60;
    L.btnW = Math.max(190, Math.min(300, w * .38));
    L.btnH = Math.max(44, Math.min(58, h * .12));
    L.btnY = L.inY + L.inH + Math.max(12, h * .035);
    L.tvX = w * TV.x; L.tvY = h * TV.y; L.tvW = w * TV.w; L.tvH = h * TV.h;
    if (dom.name) {
      const s = dom.name.style;
      s.left = (w - L.inW) / 2 + 'px'; s.top = L.inY + 'px';
      s.width = L.inW + 'px'; s.height = L.inH + 'px';
    }
    if (dom.start) {
      const s = dom.start.style;
      s.left = (w - L.btnW) / 2 + 'px'; s.top = L.btnY + 'px';
      s.width = L.btnW + 'px'; s.height = L.btnH + 'px';
      s.fontSize = Math.round(Math.max(16, Math.min(24, h * .045))) + 'px';
    }
    if (dom.help) {
      const s = dom.help.style;
      const sz = Math.max(26, Math.min(34, h * .07));
      s.width = sz + 'px'; s.height = sz + 'px';
      s.right = (10 + sz + 8) + 'px'; s.top = '8px';
      s.fontSize = Math.round(sz * .5) + 'px';
    }
    if (dom.tip) dom.tip.style.left = (w / 2) + 'px', dom.tip.style.top = (L.inY - 26) + 'px';
  }

  // ---------- 整屏绘制 ----------
  function drawBg(c, W, H) {
    if (bgFar && bgFar.complete && bgFar.width) {
      const s = Math.max(W / bgFar.width, H / bgFar.height);
      c.save(); c.globalAlpha = .95;
      c.drawImage(bgFar, (W - bgFar.width * s) / 2, (H - bgFar.height * s) / 2, bgFar.width * s, bgFar.height * s);
      c.restore();
    }
    if (bgMid && bgMid.complete && bgMid.width) {
      const s = Math.max(W / bgMid.width, (H * .9) / bgMid.height);
      c.save(); c.globalAlpha = .8;
      c.drawImage(bgMid, (W - bgMid.width * s) / 2, H - bgMid.height * s, bgMid.width * s, bgMid.height * s);
      c.restore();
    }
    // 压暗 + 顶部/底部渐深，保证文字可读
    c.fillStyle = 'rgba(10,7,16,.58)'; c.fillRect(0, 0, W, H);
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(8,5,14,.75)'); g.addColorStop(.45, 'rgba(8,5,14,0)'); g.addColorStop(1, 'rgba(8,5,14,.8)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  }

  function drawTV(c) {
    const { tvX: x, tvY: y, tvW: w, tvH: h } = L;
    // 电视外框（等有正式背景图后，这一段可以整个交给背景图）
    c.save();
    c.fillStyle = '#0b0910'; c.fillRect(x - 8, y - 8, w + 16, h + 16);
    c.strokeStyle = '#2b2434'; c.lineWidth = 3; c.strokeRect(x - 6, y - 6, w + 12, h + 12);
    c.fillStyle = '#050308'; c.fillRect(x, y, w, h);
    if (demoCv) {
      c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
      c.imageSmoothingEnabled = false;
      c.drawImage(demoCv, x, y, w, h);
      // 扫描线
      c.fillStyle = 'rgba(0,0,0,.22)';
      for (let yy = y; yy < y + h; yy += 3) c.fillRect(x, yy, w, 1);
      // 暗角
      const rg = c.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * .25, x + w / 2, y + h / 2, Math.max(w, h) * .62);
      rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(0,0,0,.55)');
      c.fillStyle = rg; c.fillRect(x, y, w, h);
      // 一点点冷色反光
      c.fillStyle = 'rgba(120,180,255,.05)'; c.fillRect(x, y, w, h * .5);
      c.restore();
      // 玻璃高光
      const gl = c.createLinearGradient(x, y, x + w * .6, y + h);
      gl.addColorStop(0, 'rgba(255,255,255,.10)'); gl.addColorStop(.4, 'rgba(255,255,255,0)');
      c.fillStyle = gl; c.fillRect(x, y, w, h);
    }
    c.restore();
  }

  function drawTitleText(c) {
    const pad = Math.max(16, L.w * .035);
    c.save();
    c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    const fs = L.title;
    c.font = `900 ${fs}px "KaiTi","STKaiti","Kaiti SC","楷体","Noto Serif CJK SC",serif`;
    c.lineJoin = 'round'; c.lineWidth = Math.max(4, fs * .12); c.strokeStyle = 'rgba(10,6,16,.9)';
    c.fillStyle = '#ffd86e';
    const y = pad + fs * 1.02;
    c.strokeText('无名之辈', pad, y); c.fillText('无名之辈', pad, y);
    // 副标题
    c.font = `700 ${L.sub}px "PingFang SC","Noto Sans CJK SC",sans-serif`;
    c.lineWidth = Math.max(3, L.sub * .35); c.strokeStyle = 'rgba(10,6,16,.9)'; c.fillStyle = '#f2e6c9';
    c.strokeText('序章 · 黄巾劫村', pad + 4, y + L.sub * 1.9);
    c.fillText('序章 · 黄巾劫村', pad + 4, y + L.sub * 1.9);
    // 角落的小字：操作提示（电脑/手机自适应）
    const coarse = matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints || 0) > 0;
    c.font = '600 12px "PingFang SC",sans-serif'; c.fillStyle = 'rgba(242,230,201,.5)';
    c.fillText(coarse ? '手机：左下摇杆移动 · 右下攻击/翻滚' : 'WASD 移动 · J 攻击 · K 翻滚 · 1/2/3 换武器', pad, L.h - 10);
    c.restore();
  }

  function draw() {
    if (S.mode === 'game') return false;
    const W = cv.width / DPR, H = cv.height / DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // 转场：向电视推近
    let zoom = 1;
    if (S.mode === 'intro') {
      const p = Math.min(1, S.intro);
      const e = p * p * (3 - 2 * p);
      const need = Math.max(W / L.tvW, H / L.tvH);
      zoom = 1 + e * (need - 1);
    }
    ctx.save();
    if (zoom > 1) {
      const cx = L.tvX + L.tvW / 2, cy = L.tvY + L.tvH / 2;
      ctx.translate(cx, cy); ctx.scale(zoom, zoom); ctx.translate(-cx, -cy);
    }
    drawBg(ctx, W, H);
    drawTV(ctx);
    drawTitleText(ctx);
    ctx.restore();
    // 白闪（转场尾段）
    if (S.mode === 'intro' && S.intro > .78) {
      const a = Math.min(1, (S.intro - .78) / .22);
      ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fillRect(0, 0, W, H);
    }
    return true;
  }

  // ---------- 状态切换 ----------
  function setDomVisible(v) {
    const d = v ? '' : 'none';
    for (const k of ['name', 'start', 'help']) if (dom[k]) dom[k].style.display = d;
    if (!v && dom.panel) { dom.panel.style.display = 'none'; helpOpen = false; }
  }

  function start() {
    if (S.mode !== 'title') return;
    const n = (dom.name.value || '').trim().slice(0, 8);
    if (!n) {
      S.msg = '请输入名字'; S.msgT = 1.6;
      dom.tip.style.opacity = 1;
      dom.name.classList.remove('shake'); void dom.name.offsetWidth; dom.name.classList.add('shake');
      dom.name.focus();
      return;
    }
    S.name = n; writeName(n);
    S.mode = 'intro'; S.intro = 0;
    document.body.classList.add('wzb-intro');
    S.msgT = 0; if (dom.tip) dom.tip.style.opacity = 0;   // 清掉“请输入名字”
    setDomVisible(false);   // 输入框/按钮先藏起来；游戏 UI 等真正进场再放出来
  }

  function finish() {
    S.mode = 'game';
    document.body.classList.remove('wzb-title');   // 这时候才把游戏 UI（摇杆/攻击/血条）露出来
    document.body.classList.remove('wzb-intro');
    if (window.ROOM) ROOM.begin(); else if (typeof reset === 'function') reset();
    if (dom.flash) {
      dom.flash.style.transition = 'none'; dom.flash.style.opacity = 1;
      requestAnimationFrame(() => { dom.flash.style.transition = 'opacity .32s ease-out'; dom.flash.style.opacity = 0; });
    }
  }

  function show() {
    S.mode = 'title'; S.intro = 0;
    if (typeof reset === 'function') reset();   // 回首页时把这一局清掉（背景音乐也会回到村庄曲）
    document.body.classList.remove('wzb-intro');
    document.body.classList.add('wzb-title');
    setDomVisible(true);
    if (dom.name) { dom.name.value = S.name; dom.name.blur(); }
    if (dom.flash) { dom.flash.style.transition = 'none'; dom.flash.style.opacity = 1; requestAnimationFrame(() => { dom.flash.style.transition = 'opacity .32s ease-out'; dom.flash.style.opacity = 0; }); }
    layout();
  }

  // ---------- 对外接口（game.js 只调这几个） ----------
  window.TITLE = {
    blocks: () => S.mode !== 'game',            // true = 游戏逻辑不推进
    draw: () => draw(),                          // 返回 true = 这一帧由标题界面接管
    playerName: () => S.name,
    show: () => show(),
    active: () => S.mode !== 'game',
  };

  // ---------- 初始化 ----------
  function boot() {
    build();
    document.body.classList.add('wzb-title');
    bgFar = new Image(); bgFar.src = BG.far;
    bgMid = new Image(); bgMid.src = BG.mid;
    bgGnd = new Image(); bgGnd.src = BG.gnd;
    demoCv = document.createElement('canvas'); demoCv.width = 480; demoCv.height = 270;
    dctx = demoCv.getContext('2d');
    demoReset();
    addEventListener('resize', layout);
    addEventListener('orientationchange', () => setTimeout(layout, 260));
    let last = performance.now();
    const tick = (t) => {
      const dt = Math.min(.05, (t - last) / 1000); last = t;
      S.t += dt;
      if (S.msgT > 0) { S.msgT -= dt; if (S.msgT <= 0 && dom.tip) dom.tip.style.opacity = 0; }
      if (S.mode === 'title' || S.mode === 'intro') {
        demoStep(dt); demoRender();
        if (S.mode === 'intro') { S.intro += dt / 1.2; if (S.intro >= 1) finish(); }
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  boot();
})();
