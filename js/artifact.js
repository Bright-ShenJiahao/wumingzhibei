// 神器（用户定）：整军备战「神器」栏像时装一样点开选择。第一件：太平飞剑——第二章首次打败张角掉落。
// 装上后每局开场踩在飞剑上，移速 +10%；被击倒时从剑上摔下，剑插在旁边地上，要自己走过去捡；
// 一局里被打落 3 次，第 3 次掉下的剑慢慢闪几下就消失，本局不再有。
(() => {
  const LIST = [
    { id: 'feijian', name: '太平飞剑', desc: '踩剑而行，移速 +10%。被击倒会从剑上摔下，走过去捡回；一局被打落 3 次后飞剑消失。', from: '第二章首次击败张角掉落' },
  ];
  const profile = () => window.ARMORY && ARMORY.state ? ARMORY.state() : null;
  function store() {
    const p = profile(); if (!p) return { owned: {}, eq: '', _at: 0 };
    if (!p.artifacts || typeof p.artifacts !== 'object') p.artifacts = { owned: {}, eq: '', _at: 0 };
    p.artifacts.owned ||= {}; return p.artifacts;
  }
  const save = () => { if (window.ARMORY && ARMORY.saveNow) ARMORY.saveNow(); };
  const owned = id => !!store().owned[id];
  const equipped = () => { const s = store(); return s.eq && s.owned[s.eq] ? s.eq : ''; };
  function grant(id) { const s = store(); if (s.owned[id]) return false; s.owned[id] = 1; if (!s.eq) s.eq = id; s._at = Date.now(); save(); return true; }
  function equip(id) { const s = store(); s.eq = id && s.owned[id] ? id : ''; s._at = Date.now(); save(); }
  const label = () => { const e = LIST.find(a => a.id === equipped()); return e ? e.name : '未装备'; };

  // ---- 局内：飞剑 ----
  const R = { on: false, drops: 0, ground: null, trail: [] };
  function startRun() { hitLog = []; R.on = equipped() === 'feijian'; R.drops = 0; R.ground = null; R.trail = []; }
  const mounted = () => R.on && typeof hero !== 'undefined' && !hero.air && !['down', 'bounce', 'getup'].includes(hero.st);
  const moveMult = () => (mounted() ? 1.1 : 1);
  // 踩剑时被连击：2 秒内挨第 2 下就从剑上摔下（人只被打退、不倒地）；重击（会击倒的）一下就掉
  let hitLog = [];
  function onHit(dir) {
    if (!R.on) return;
    const t = performance.now() / 1000; hitLog = hitLog.filter(x => t - x < 2); hitLog.push(t);
    if (hitLog.length >= 2) { hitLog = []; onKnock(dir); }
    else if (typeof floaters !== 'undefined' && typeof hero !== 'undefined') floaters.push({ x: hero.x, y: hero.y - 44, t: 0, txt: '剑身一晃！', color: '#9fe3ff' });
  }
  function onKnock(dir) {   // 主角被击倒（launch）时调用
    if (!R.on || typeof hero === 'undefined') return;
    R.on = false; R.drops++;
    const last = R.drops >= 3;
    R.ground = { x: hero.x - dir * 18, y: hero.y + 2, t: 0, last, life: last ? 2.4 : Infinity };
    if (typeof floaters !== 'undefined') floaters.push({ x: hero.x, y: hero.y - 46, t: 0, txt: last ? '飞剑离去……' : `飞剑被打落（${R.drops}/3）`, color: '#9fe3ff' });
  }
  function tick(dt) {
    if (typeof hero === 'undefined') return;
    const g = R.ground;
    if (g) {
      g.t += dt;
      if (g.last) { if (g.t > g.life) R.ground = null; }
      else if (hero.st !== 'down' && hero.st !== 'getup' && !hero.air && g.t > .5 && Math.abs(hero.x - g.x) < 14 && Math.abs(hero.y - g.y) < 12) {
        R.ground = null; R.on = true; if (typeof sfx === 'function') sfx('food', hero.x);
        if (typeof floaters !== 'undefined') floaters.push({ x: hero.x, y: hero.y - 46, t: 0, txt: '御剑！', color: '#9fe3ff' });
      }
    }
    // 移动时剑尾的淡青光痕
    if (mounted() && (hero.st === 'walk' || hero.st === 'roll')) R.trail.push({ x: hero.x - hero.f * 12, y: hero.y - 3, t: 0 });
    for (const p of R.trail) p.t += dt;
    R.trail = R.trail.filter(p => p.t < .35);
  }
  // 横放的飞剑（代码画，等正式美术）：剑尖朝 f 方向
  const pic = k => { const i = typeof IMG !== 'undefined' && IMG['ui_' + k]; return i && i.complete && i.naturalWidth ? i : null; };
  function sword(x, y, f, alpha = 1) {
    const im = pic('fj_ride');   // 正式美术（GPT 图）：剑尖朝右，横放带青光
    if (im) { const w = 38, h = w * im.height / im.width; ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.scale(f, 1); ctx.imageSmoothingEnabled = true; ctx.drawImage(im, -w / 2, -h * .42, w, h); ctx.restore(); return; }
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.scale(f, 1);
    ctx.fillStyle = 'rgba(120,220,255,.25)'; ctx.beginPath(); ctx.ellipse(0, 0, 17, 3.2, 0, 0, Math.PI * 2); ctx.fill();   // 剑气
    ctx.fillStyle = '#dfe9f2'; ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-7, -1.6); ctx.lineTo(-7, 1.6); ctx.closePath(); ctx.fill();   // 剑身
    ctx.fillStyle = '#9fb2c4'; ctx.fillRect(-7, 0, 21, .6);
    ctx.fillStyle = '#c9a24a'; ctx.fillRect(-8, -2.6, 1.6, 5.2);   // 护手
    ctx.fillStyle = '#6b3a22'; ctx.fillRect(-13, -1, 5, 2);   // 剑柄
    ctx.fillStyle = '#c9a24a'; ctx.fillRect(-14, -1.2, 1.4, 2.4);
    ctx.restore();
  }
  // 斜插在地上的飞剑
  function stuck(x, y, alpha) {
    const im = pic('fj_stuck');   // 斜插在地上（底部是一小撮土）
    if (im) { const h = 28, w = h * im.width / im.height; ctx.save(); ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = true; ctx.drawImage(im, x - w / 2, y - h + 3, w, h); ctx.restore(); return; }
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(-1.15);
    ctx.fillStyle = 'rgba(120,220,255,.3)'; ctx.beginPath(); ctx.ellipse(-4, 0, 12, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#dfe9f2'; ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(-14, -1.5); ctx.lineTo(-14, 1.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#c9a24a'; ctx.fillRect(-15, -2.6, 1.6, 5.2); ctx.fillStyle = '#6b3a22'; ctx.fillRect(-20, -1, 5, 2);
    ctx.restore();
  }
  function drawUnder(h) {   // drawHero 里、画主角之前调用；返回主角要抬高的高度
    if (!mounted()) return 0;
    const bob = Math.sin(performance.now() / 260) * 1;
    for (const p of R.trail) { ctx.save(); ctx.globalAlpha = .35 * (1 - p.t / .35); ctx.fillStyle = '#8fe0ff'; ctx.fillRect(p.x - 2, p.y - 1 + bob, 4, 1.5); ctx.restore(); }
    sword(h.x, h.y - 3 + bob, h.f);
    return 5 + bob;
  }
  function drawWorld() {
    const g = R.ground; if (!g) return;
    let a = 1;
    if (g.last) a = Math.max(0, 1 - g.t / g.life) * (Math.floor(g.t * 3) % 2 ? .35 : 1);   // 慢慢闪几下消失
    const glow = .5 + .5 * Math.sin(g.t * 5);
    ctx.save(); ctx.globalAlpha = a * (.25 + .25 * glow); ctx.fillStyle = '#9fe3ff'; ctx.beginPath(); ctx.ellipse(g.x, g.y, 9, 3, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    stuck(g.x, g.y, a);
  }

  // ---- 整军备战：神器选择面板（和时装一样点开选） ----
  function open() {
    let box = document.getElementById('artifactPanel');
    if (!box) {
      box = document.createElement('div'); box.id = 'artifactPanel';
      const css = document.createElement('style');
      css.textContent = '#artifactPanel{position:fixed;inset:0;z-index:10002;display:flex;align-items:center;justify-content:center;padding:10px;background:#100b08c9;font:14px/1.5 sans-serif}#artifactPanel[hidden]{display:none!important}#artifactPanel section{position:relative;width:min(460px,94vw);max-height:90dvh;overflow:auto;padding:18px 20px;background:linear-gradient(#3b2c20,#271c14);border:2px solid #9d7845;border-radius:10px;color:#ecdcbc;box-sizing:border-box}#artifactPanel h3{margin:0 0 12px;text-align:center;font:700 22px MaShanZheng,"STKaiti",serif;color:#f1d58f}#artifactPanel .ax{position:absolute;right:14px;top:12px;min-height:34px;padding:2px 14px;border:1px solid #8a6538;background:#5a3923;color:#f5dfb2;border-radius:6px;cursor:pointer}#artifactPanel .ar{display:grid;grid-template-columns:52px 1fr auto;gap:10px;align-items:center;padding:10px;margin:6px 0;background:#35271de8;border:1px solid #805d37;border-radius:8px}#artifactPanel .ar.no{opacity:.5}#artifactPanel .aico{width:52px;height:52px;object-fit:contain;background:#1c140e;border-radius:6px;padding:4px;box-sizing:border-box}#artifactPanel .ar canvas{position:static!important;inset:auto!important;display:block!important;width:52px!important;height:52px!important;background:#1c140e;border-radius:6px}#artifactPanel b{color:#f1d58f}#artifactPanel small{display:block;color:#cdb78e;font-size:12px}#artifactPanel button.ae{min-height:34px;padding:2px 12px;border:1px solid #e5c98a;border-radius:6px;background:#6b4a2a;color:#fff3c4;cursor:pointer}#artifactPanel button.ae.on{background:#3a2a1c;color:#cdb78e;border-color:#7a5c38}';
      document.head.append(css); document.body.append(box);
      box.addEventListener('click', e => {
        const b = e.target.closest('[data-eq]');
        if (b) { equip(b.dataset.eq); render(box); if (window.TITLE && TITLE.refreshPreparation) TITLE.refreshPreparation(); return; }
        if (e.target === box || e.target.closest('.ax')) box.hidden = true;
      });
    }
    render(box); box.hidden = false;
  }
  function render(box) {
    const eq = equipped();
    box.innerHTML = '<section><button class="ax" type="button">关闭</button><h3>神器</h3>' + LIST.map(a => {
      const has = owned(a.id), on = eq === a.id;
      return `<div class="ar${has ? '' : ' no'}">${typeof ASSETS !== 'undefined' && ASSETS.ui && ASSETS.ui.fj_icon ? `<img class="aico" src="${ASSETS.ui.fj_icon}" alt="">` : `<canvas data-icon="${a.id}" width="52" height="52"></canvas>`}<div><b>${a.name}</b><small>${has ? a.desc : '未获得：' + a.from}</small></div>${has ? `<button type="button" class="ae${on ? ' on' : ''}" data-eq="${on ? '' : a.id}">${on ? '卸下' : '装备'}</button>` : ''}</div>`;
    }).join('') + '</section>';
    box.querySelectorAll('canvas[data-icon]').forEach(cv => drawIcon(cv.getContext('2d')));
  }
  function drawIcon(c) {   // 面板里的飞剑小图
    c.save(); c.translate(26, 28); c.rotate(-.5); c.scale(1.6, 1.6);
    c.fillStyle = 'rgba(120,220,255,.3)'; c.beginPath(); c.ellipse(0, 0, 15, 3.5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#dfe9f2'; c.beginPath(); c.moveTo(13, 0); c.lineTo(-6, -1.6); c.lineTo(-6, 1.6); c.closePath(); c.fill();
    c.fillStyle = '#c9a24a'; c.fillRect(-7, -2.6, 1.6, 5.2); c.fillStyle = '#6b3a22'; c.fillRect(-12, -1, 5, 2);
    c.restore();
  }
  window.ARTIFACT = { off() { R.on = false; }, LIST, owned, equipped, grant, equip, label, open, startRun, moveMult, onKnock, onHit, tick, drawUnder, drawWorld, mounted, ground: () => R.ground, drops: () => R.drops };
})();
