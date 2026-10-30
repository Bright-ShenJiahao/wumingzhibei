// 第二章入场：战一开打前先出史书式旁白大字「中平元年 · 广宗」，再由曹操一声号令开战。
(() => {
  let S = null, portrait = null;
  function start(onDone) {
    S = { t: 0, onDone, called: false, fired: false };
    chapter2Run.mode = 'opening';
  }
  function update(dt) {
    if (!S) return;
    S.t += dt;
    if (S.t > 2.6 && !S.called) {
      S.called = true; bark('众将士——随我破阵！', 1.6); shake = .25;
      if (window.SFX) { if (SFX.voice) SFX.voice('caocao_charge'); }
      if (typeof sfx === 'function') sfx('finisher', hero.x);
    }
    if (S.t > 4.4 && !S.fired) { S.fired = true; const f = S.onDone; S = null; if (chapter2Run) chapter2Run.mode = 'fight'; if (f) f(); }
  }
  function hud(HW, HH) {
    if (!S) return;
    const t = S.t;
    // 旁白大字：淡入淡出
    const a = t < .5 ? t / .5 : t < 2.2 ? 1 : Math.max(0, 1 - (t - 2.2) / .5);
    if (a > 0) {
      ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(10,6,4,.55)'; ctx.fillRect(0, HH * .3, HW, HH * .26);
      const big = Math.round(Math.min(HW * .07, HH * .1));
      ctx.font = `${big}px "MaShanZheng","KaiTi","STKaiti","Kaiti SC",serif`; ctx.fillStyle = '#f1d58f'; ctx.strokeStyle = '#2a160f'; ctx.lineWidth = 4;
      ctx.strokeText('中平元年 · 广宗城外', HW / 2, HH * .43); ctx.fillText('中平元年 · 广宗城外', HW / 2, HH * .43);
      ctx.font = `${Math.round(big * .42)}px sans-serif`; ctx.fillStyle = '#e8d8b8';
      ctx.fillText('张梁、张宝护送张角棺椁北撤，曹军全速追击', HW / 2, HH * .51);
      ctx.restore();
    }
  }
  // 曹操说话：和开场对白同款的头像 + 文字框，但不需要点击，几秒后自动收起，不打断战斗
  const B = { text: '', t: 0, T: 0 };
  function bark(text, dur = 2.6) { B.text = text; B.t = 0; B.T = dur; if (typeof msgT !== 'undefined') msgT = 0; }   // 文字框出来时清掉底部字幕，避免叠在一起
  function rounded(x, y, w, h, r) { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); }
  function drawBark(HW, HH, dt) {
    if (!B.text) return;
    B.t += dt; if (B.t > B.T + .25) { B.text = ''; return; }
    const a = Math.min(1, B.t / .18, (B.T + .25 - B.t) / .25), small = HH < 520 || HW < 760, f = small ? Math.max(.7, Math.min(1, HH / 480)) : 1;   // 手机横屏：曹操喊话框也按屏高缩小
    const pw = Math.min(HW - 18, small ? 420 : 560), ph = Math.round((small ? 74 : 92) * f), px = (HW - pw) / 2, py = 74 + (1 - Math.min(1, B.t / .2)) * -10;
    const av = ph - 16;
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(30,22,18,.91)'; rounded(px, py, pw, ph, 8); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#e5c98a'; rounded(px + 1, py + 1, pw - 2, ph - 2, 7); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,238,194,.38)'; rounded(px + 5, py + 5, pw - 10, ph - 10, 5); ctx.stroke();
    const ax = px + 8, ay = py + 8, im = IMG.dialog_caocao;
    ctx.fillStyle = '#b78b4d'; rounded(ax - 2, ay - 2, av + 4, av + 4, 5); ctx.fill();
    ctx.fillStyle = '#241912'; rounded(ax, ay, av, av, 4); ctx.fill();
    if (im && im.complete && im.naturalWidth) { ctx.save(); rounded(ax, ay, av, av, 4); ctx.clip(); const sc = Math.max(av / im.width, av / im.height); ctx.drawImage(im, ax + (av - im.width * sc) / 2, ay + (av - im.height * sc) / 2, im.width * sc, im.height * sc); ctx.restore(); }
    const left = ax + av + 14;
    ctx.textAlign = 'left'; ctx.font = `700 ${Math.round((small ? 14 : 17) * f)}px "PingFang SC","Microsoft YaHei",sans-serif`; ctx.fillStyle = '#f1cf75';
    ctx.fillText('曹操', left, py + (small ? 24 : 30));
    ctx.font = `700 ${Math.round((small ? 15 : 19) * f)}px "PingFang SC","Microsoft YaHei",sans-serif`; ctx.fillStyle = '#f7f0df';
    const shown = B.text.slice(0, Math.floor(B.t * 28) + 1), maxW = px + pw - 14 - left;
    let line = '', y = py + (small ? 48 : 60);
    for (const ch of shown) { if (line && ctx.measureText(line + ch).width > maxW) { ctx.fillText(line, left, y); line = ch; y += Math.round((small ? 19 : 24) * f); } else line += ch; }
    if (line) ctx.fillText(line, left, y);
    ctx.restore();
  }
  let lastHud = 0;
  function hudAll(HW, HH) {
    const now = performance.now() / 1000, dt = lastHud ? Math.min(.1, now - lastHud) : 0; lastHud = now;
    hud(HW, HH); drawBark(HW, HH, dt);
  }
  window.CH2OPEN = { start, update, hud: hudAll, bark, active: () => !!S };
})();
