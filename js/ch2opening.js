// 第二章入场：战一开打前先出史书式旁白大字「中平元年 · 广宗」，再由曹操一声号令开战。
(() => {
  let S = null, portrait = null;
  function start(onDone) {
    S = { t: 0, onDone, called: false, fired: false };
    chapter2Run.mode = 'opening';
    if (!portrait && typeof ASSETS !== 'undefined' && ASSETS.dialogPortraits && ASSETS.dialogPortraits.caocao) { portrait = new Image(); portrait.src = ASSETS.dialogPortraits.caocao; }
  }
  function update(dt) {
    if (!S) return;
    S.t += dt;
    if (S.t > 2.6 && !S.called) {
      S.called = true; say('曹操：「众将士——随我破阵！」', 2.4); shake = .25;
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
      ctx.strokeText('中平元年 · 广宗', HW / 2, HH * .43); ctx.fillText('中平元年 · 广宗', HW / 2, HH * .43);
      ctx.font = `${Math.round(big * .42)}px sans-serif`; ctx.fillStyle = '#e8d8b8';
      ctx.fillText('黄巾主力屯聚于此，曹军前锋直扑敌营', HW / 2, HH * .51);
      ctx.restore();
    }
    // 曹操号令：左下角立绘
    if (t > 2.6) {
      const b = Math.min(1, (t - 2.6) / .25, Math.max(0, (4.4 - t) / .3));
      if (portrait && portrait.complete && portrait.naturalWidth) {
        const h = Math.min(HH * .32, 150), w = h * portrait.naturalWidth / portrait.naturalHeight;
        ctx.save(); ctx.globalAlpha = b; ctx.drawImage(portrait, 12 - (1 - b) * 40, HH - h - 8, w, h); ctx.restore();
      }
    }
  }
  window.CH2OPEN = { start, update, hud, active: () => !!S };
})();
