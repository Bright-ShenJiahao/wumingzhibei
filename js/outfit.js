// 时装换色：区域遮罩只提供 RGB 标记，运行时生成新画布，不改原画。
(() => {
  const PARTS = ['hair', 'shirt', 'pants'];
  const COLOR_ROWS = {
    hair: [
      { name: '黑发', sample: '#1b1718' },
      { name: '栗棕', dark: [48, 26, 16], light: [122, 74, 44] },
      { name: '亚麻', dark: [96, 70, 44], light: [196, 160, 112] },
      { name: '银白', dark: [120, 118, 126], light: [226, 224, 232] },
      { name: '赤红', dark: [70, 16, 16], light: [176, 52, 40] },
      { name: '靛青', dark: [16, 24, 52], light: [52, 78, 140] },
      { name: '紫檀', dark: [40, 18, 44], light: [110, 60, 118] },
      { name: '墨绿', dark: [14, 36, 26], light: [46, 100, 70] },
    ],
    shirt: [
      { name: '白衣', sample: '#f2eee5' },
      { name: '粗布灰', dark: [96, 92, 86], light: [176, 170, 160] },
      { name: '天青', dark: [88, 128, 160], light: [170, 210, 232] },
      { name: '靛蓝', dark: [32, 48, 98], light: [86, 120, 190] },
      { name: '朱红', dark: [120, 28, 24], light: [214, 74, 56] },
      { name: '墨绿', dark: [30, 58, 40], light: [84, 132, 92] },
      { name: '藕荷', dark: [140, 96, 120], light: [224, 184, 204] },
      { name: '玄黑', dark: [22, 22, 28], light: [78, 78, 90] },
    ],
    pants: [
      { name: '黑裤', sample: '#272327' },
      { name: '深棕', dark: [30, 16, 8], light: [96, 62, 38] },
      { name: '藏青', dark: [10, 16, 40], light: [46, 62, 110] },
      { name: '军绿', dark: [28, 36, 20], light: [84, 98, 60] },
      { name: '灰裤', dark: [56, 56, 60], light: [140, 140, 148] },
      { name: '白裤', dark: [150, 150, 160], light: [230, 230, 236] },
      { name: '酒红', dark: [52, 10, 18], light: [130, 34, 50] },
      { name: '卡其', dark: [86, 72, 48], light: [170, 150, 110] },
    ],
  };
  const LIMITS = { hair: [.078, .255], shirt: [.592, .984], pants: [.078, .245] };
  const clampPart = n => { n = Number(n); return Number.isInteger(n) && n >= 0 && n <= 7 ? n : 0; };
  const clean = o => ({ hair: clampPart(o?.hair), shirt: clampPart(o?.shirt), pants: clampPart(o?.pants) });
  const p = () => window.ARMORY && ARMORY.state ? ARMORY.state() : null;
  function saved() { const profile = p(); return clean(profile?.outfit); }
  function labelOf(o) {
    const c = clean(o);
    if (!c.hair && !c.shirt && !c.pants) return '默认';
    return PARTS.map(part => COLOR_ROWS[part][c[part]].name).join('·');
  }
  function save(outfit) {
    const profile = p(); if (!profile) return false;
    profile.outfit = { ...clean(outfit), _at: Date.now() };
    return window.ARMORY && ARMORY.saveNow ? ARMORY.saveNow() : false;
  }

  let ch = null, applySeq = 0;
  const maskCache = new Map();
  const baseOf = fr => { if (!fr.__outfitBase) fr.__outfitBase = fr.img; return fr.__outfitBase; };
  function loadImage(src) {
    return new Promise(resolve => {
      if (!src) return resolve(null);
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = src;
    });
  }
  function maskFor(name) {
    if (maskCache.has(name)) return maskCache.get(name);
    const url = typeof ASSETS !== 'undefined' && ASSETS.heroMask && ASSETS.heroMask[name];
    if (!url) return null;
    const promise = loadImage(url);
    maskCache.set(name, promise);
    return promise;
  }
  function restore() {
    if (!ch || !ch.hero) return;
    for (const fr of Object.values(ch.hero)) if (fr.__outfitBase) fr.img = fr.__outfitBase;
  }
  async function apply(outfit) {
    const colors = clean(outfit || saved());
    const seq = ++applySeq;
    if (!ch || !ch.hero) return false;
    if (!colors.hair && !colors.shirt && !colors.pants) { restore(); return true; }
    const entries = Object.entries(ch.hero);
    const masks = await Promise.all(entries.map(([name]) => maskFor(name)));
    if (seq !== applySeq) return false;
    for (let i = 0; i < entries.length; i++) {
      const [name, fr] = entries[i], mask = masks[i];
      if (!mask) continue;
      const base = baseOf(fr);
      if (!base) continue;
      if (base.complete === false || !base.width) await new Promise(r => { if (base.complete !== false) r(); else { base.addEventListener('load', r, { once: true }); base.addEventListener('error', r, { once: true }); } });
      if (!base.width) continue;
      const canvas = document.createElement('canvas'); canvas.width = fr.w; canvas.height = fr.h;
      const g = canvas.getContext('2d', { willReadFrequently: true });
      g.drawImage(base, 0, 0, fr.w, fr.h);
      const src = g.getImageData(0, 0, fr.w, fr.h);
      const mg = document.createElement('canvas'); mg.width = fr.w; mg.height = fr.h;
      const mctx = mg.getContext('2d', { willReadFrequently: true });
      mctx.drawImage(mask, 0, 0, fr.w, fr.h);
      const md = mctx.getImageData(0, 0, fr.w, fr.h).data;
      const s = src.data;
      for (let j = 0; j < s.length; j += 4) {
        if (!s[j + 3]) continue;
        const mr = md[j], mgc = md[j + 1], mb = md[j + 2];
        const part = mr > 127 ? 'hair' : mgc > 127 ? 'shirt' : mb > 127 ? 'pants' : null;
        if (!part || !colors[part]) continue;
        const c = COLOR_ROWS[part][colors[part]]; if (!c.dark) continue;
        const [lo, hi] = LIMITS[part];
        const v = Math.max(s[j], s[j + 1], s[j + 2]) / 255;
        const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
        s[j] = Math.round(c.dark[0] + (c.light[0] - c.dark[0]) * t);
        s[j + 1] = Math.round(c.dark[1] + (c.light[1] - c.dark[1]) * t);
        s[j + 2] = Math.round(c.dark[2] + (c.light[2] - c.dark[2]) * t);
      }
      if (seq !== applySeq) return false;
      g.putImageData(src, 0, 0);
      canvas.complete = true;
      canvas.naturalWidth = fr.w; canvas.naturalHeight = fr.h;
      fr.img = canvas;
    }
    return true;
  }

  let overlay = null, canvas = null, raf = 0, temp = null, baseSaved = null, previewFrame = 0;
  function injectStyle() {
    if (document.getElementById('outfitStyle')) return;
    const st = document.createElement('style'); st.id = 'outfitStyle';
    st.textContent = `
      .outfitSlot{display:flex;align-items:center;gap:8px;cursor:pointer;text-align:left;font:inherit;color:inherit;width:100%}
      #tPrepSlots .outfitSlot{display:flex!important;grid-template-columns:none!important;grid-template-rows:none!important;flex-direction:row!important;justify-content:flex-start!important}
      .outfitSlot.outfitSlot{position:relative;align-items:center!important;gap:9px;padding:6px 10px!important;border:2px solid #d9a548!important;border-radius:8px!important;background:linear-gradient(135deg,#2d3a6b,#1a1f3d)!important;box-shadow:inset 0 0 0 2px #121530,0 3px 8px #120a08aa!important;color:#ffe2a0;overflow:hidden}.outfitSlot .outfitIco{flex:none;font-size:22px;line-height:1}.outfitSlot .outfitCopy{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;pointer-events:none;text-shadow:0 1px 2px #05061a}.outfitSlot .outfitCopy strong{display:block;font-size:clamp(13px,1.5vw,17px);white-space:nowrap}.outfitSlot .outfitCopy small{display:block;margin-top:3px;color:#c9c3e6;font-size:clamp(8px,.95vw,11px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.outfitSlot .outfitName.outfitName{display:inline;color:#f1d28d;font-size:inherit}@media(max-height:430px){.outfitSlot .outfitIco{font-size:16px}.outfitSlot .outfitCopy small{font-size:8px;margin-top:1px}}.outfitSlot .outfitSwatch{width:50px;height:34px;border:1px solid #8a683f;border-radius:5px;background:linear-gradient(135deg,#3a3029,#1d1814);display:flex;align-items:center;justify-content:center;font-size:9px;color:#d9c18f}
      .outfitSlot .outfitName{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#f0d39a;font-size:14px}
      #outfitOverlay{position:fixed;inset:0;z-index:10030;display:flex;align-items:center;justify-content:center;padding:12px;background:rgba(8,6,5,.76);box-sizing:border-box}
      #outfitPanel{width:min(820px,94vw);max-height:88dvh;display:flex;flex-direction:column;border:2px solid #b58b4c;border-radius:10px;background:linear-gradient(145deg,#3b2a1d,#1d1713);box-shadow:0 18px 60px #000c;color:#ecd6ab;overflow:hidden}
      .outfitHead{display:flex;align-items:center;justify-content:space-between;padding:10px 15px;border-bottom:1px solid #765b38;background:linear-gradient(#5b4028,#2e2218)}.outfitHead h2{margin:0;color:#f3d27c;font:700 21px MaShanZheng,serif}.outfitClose{width:34px;height:34px;border:1px solid #927044;border-radius:50%;background:#34251a;color:#f3d27c;font:700 18px sans-serif;cursor:pointer}
      .outfitBody{display:grid;grid-template-columns:40% minmax(0,1fr);gap:12px;padding:12px;min-height:0;overflow:hidden}
      .outfitLeft{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:0;border:1px solid #6f5537;border-radius:7px;background:#211914;padding:8px}
      .outfitLeft canvas{position:static;inset:auto;left:auto;top:auto;width:100%;height:auto;max-height:300px;image-rendering:pixelated}.outfitPreviewBtn{padding:6px 14px;border:1px solid #9c7843;border-radius:5px;background:#513722;color:#f1d58f;font:700 12px sans-serif;cursor:pointer}
      .outfitRight{min-width:0;min-height:0;overflow:auto}.outfitRow{margin-bottom:9px}.outfitRow h3{margin:0 0 5px;font:700 13px "PingFang SC",sans-serif;color:#e8c783}.outfitSwatches{display:flex;gap:7px;flex-wrap:wrap}.outfitChip{width:38px;height:32px;border:2px solid #564330;border-radius:5px;cursor:pointer;padding:0;position:relative}.outfitChip.selected{border-color:#f1c766;box-shadow:0 0 0 2px #3f2c1c,0 0 8px #d5a64e}
      .outfitChip span{position:absolute;inset:auto 2px 1px;color:#fff;text-shadow:0 1px 2px #000;font:9px sans-serif;text-align:center;overflow:hidden;white-space:nowrap}.outfitFoot{margin-top:8px;padding:8px;border-top:1px solid #6e5437;display:flex;align-items:center;gap:8px;flex-wrap:wrap;font:12px "PingFang SC",sans-serif}.outfitFoot .outfitCost{color:#f2d58a;flex:1;min-width:145px}.outfitFoot button{padding:7px 11px;border:1px solid #a77e47;border-radius:5px;background:#593d27;color:#ffe5b0;font:700 12px sans-serif;cursor:pointer}.outfitFoot button:disabled{opacity:.42;filter:grayscale(1);cursor:not-allowed}
      @media(max-height:430px){#outfitPanel{max-height:94dvh}.outfitBody{grid-template-columns:32% minmax(0,1fr);gap:7px;padding:7px}.outfitLeft{padding:4px}.outfitLeft canvas{max-height:140px}.outfitChip{width:30px;height:28px;min-width:28px}.outfitRow{margin-bottom:5px}.outfitFoot{padding:5px;font-size:10px}.outfitFoot button{padding:5px 7px;font-size:10px}.outfitHead{padding:5px 9px}.outfitHead h2{font-size:17px}}
    `;
    document.head.appendChild(st);
  }
  function frameName() {
    let w = 'staff';
    try { w = (window.TITLE && TITLE.preparedWeapon && TITLE.preparedWeapon()) || 'staff'; } catch (_) {}
    return w === 'halberd' ? 'halberd0' : w + '0';
  }
  function drawFrame(name) {
    if (!canvas || !ch || !ch.hero) return;
    const g = canvas.getContext('2d'); if (!g) return;
    g.clearRect(0, 0, canvas.width, canvas.height);
    const fr = ch.hero[name] || ch.hero[frameName()] || ch.hero.staff0;
    if (!fr || !fr.img || !fr.img.width) return;
    const scale = 2; // 整数倍，不随武器长度改变人物倍率
    const x = Math.round(canvas.width / 2 - fr.ax * scale);
    const y = Math.round(canvas.height - 16 - fr.ay * scale);
    g.imageSmoothingEnabled = false;
    g.drawImage(fr.img, x, y, fr.w * scale, fr.h * scale);
  }
  function drawPreview() {
    if (previewFrame && ch && window.WEAP) {
      const w = (window.TITLE && TITLE.preparedWeapon && TITLE.preparedWeapon()) || 'staff';
      const combo = WEAP[w]?.combo || [];
      const flat = [];
      for (const c of combo) for (const f of c.f) flat.push(f);
      if (flat.length) { drawFrame(flat[Math.min(flat.length - 1, previewFrame - 1)]); return; }
    }
    drawFrame(frameName());
  }
  function previewAttack() {
    if (raf) cancelAnimationFrame(raf);
    const w = (window.TITLE && TITLE.preparedWeapon && TITLE.preparedWeapon()) || 'staff';
    const combo = WEAP[w]?.combo || [];
    const frames = [];
    for (const c of combo) for (let i = 0; i < c.f.length; i++) frames.push({ n: c.f[i], d: Math.max(60, (c.d[i] || .15) * 1000) });
    if (!frames.length) return;
    let i = 0, start = performance.now();
    const tick = now => {
      if (!overlay) return;
      const f = frames[i % frames.length];
      drawFrame(f.n);
      if (now - start > f.d) { start = now; i++; if (i >= frames.length) { i = 0; } }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }
  function costOf(sel, base) {
    let n = 0;
    for (const part of PARTS) if (sel[part] !== base[part] && sel[part] !== 0) n += 2;
    return n;
  }
  function render() {
    if (!overlay) return;
    const base = baseSaved || saved();
    const cost = costOf(temp, base), fruits = WALLET.fruits();
    overlay.querySelector('.outfitCost').innerHTML = `本次需要 <b>${cost}</b> 个彩色果（你有 ${fruits} 个）`;
    const confirm = overlay.querySelector('.outfitConfirm');
    confirm.disabled = cost > 0 && fruits < cost;
    overlay.querySelector('.outfitShop').hidden = !(cost > 0 && fruits < cost);
    overlay.querySelectorAll('.outfitChip').forEach(b => { b.classList.toggle('selected', Number(b.dataset.idx) === temp[b.dataset.part]); });
    for (const part of PARTS) {
      const row = overlay.querySelector(`[data-row="${part}"]`);
      if (!row) continue;
      const swatches = row.querySelector('.outfitSwatches');
      if (!swatches) continue;
      swatches.innerHTML = '';
      COLOR_ROWS[part].forEach((c, i) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'outfitChip' + (temp[part] === i ? ' selected' : '');
        b.dataset.part = part; b.dataset.idx = i; b.title = c.name;
        b.style.background = c.sample || `linear-gradient(135deg,rgb(${c.dark.join(',')}),rgb(${c.light.join(',')}))`;
        b.innerHTML = `<span>${c.name}</span>`;
        b.onclick = async () => { temp[part] = i; await apply(temp); drawPreview(); render(); refreshFoot(); };
        swatches.appendChild(b);
      });
    }
    drawPreview();
  }
  function refreshFoot() {
    if (!overlay) return;
    const base = baseSaved || saved(), cost = costOf(temp, base), fruits = WALLET.fruits();
    overlay.querySelector('.outfitCost').innerHTML = `本次需要 <b>${cost}</b> 个彩色果（你有 ${fruits} 个）`;
    const confirm = overlay.querySelector('.outfitConfirm'); confirm.disabled = cost > 0 && fruits < cost;
    overlay.querySelector('.outfitShop').hidden = !(cost > 0 && fruits < cost);
  }
  function close(cancel = true) {
    if (raf) cancelAnimationFrame(raf); raf = 0;
    if (overlay) { overlay.remove(); overlay = null; }
    if (cancel && baseSaved) apply(baseSaved);
    baseSaved = null; temp = null; previewFrame = 0;
  }
  function open() {
    injectStyle();
    if (overlay) return;
    baseSaved = saved(); temp = { ...baseSaved };
    overlay = document.createElement('div'); overlay.id = 'outfitOverlay';
    overlay.innerHTML = `<section id="outfitPanel" role="dialog" aria-modal="true" aria-label="时装换色"><header class="outfitHead"><h2>🎨 时装</h2><button type="button" class="outfitClose" aria-label="关闭">✕</button></header><div class="outfitBody"><div class="outfitLeft"><canvas width="320" height="320"></canvas><button type="button" class="outfitPreviewBtn">预览攻击</button></div><div class="outfitRight"><div class="outfitRow" data-row="hair"><h3>头发</h3><div class="outfitSwatches"></div></div><div class="outfitRow" data-row="shirt"><h3>上衣</h3><div class="outfitSwatches"></div></div><div class="outfitRow" data-row="pants"><h3>裤子</h3><div class="outfitSwatches"></div></div><div class="outfitFoot"><div class="outfitCost"></div><button type="button" class="outfitConfirm">确定换色</button><button type="button" class="outfitShop" hidden>去商店</button><button type="button" class="outfitCancel">取消</button></div></div></div></section>`;
    overlay.addEventListener('pointerdown', e => { if (e.target === overlay) close(); });
    overlay.querySelector('.outfitClose').onclick = () => close();
    overlay.querySelector('.outfitCancel').onclick = () => close();
    overlay.querySelector('.outfitPreviewBtn').onclick = previewAttack;
    overlay.querySelector('.outfitConfirm').onclick = async () => {
      const cost = costOf(temp, baseSaved || saved());
      if (cost > 0 && !WALLET.useFruits(cost)) { refreshFoot(); return; }
      if (!save(temp)) { if (cost) WALLET.addFruits(cost); return; }
      await apply(temp);
      close(false);
      if (window.TITLE) TITLE.refreshPreparation();
    };
    overlay.querySelector('.outfitShop').onclick = () => { close(); if (window.SHOP) SHOP.open(); };
    document.body.appendChild(overlay);
    canvas = overlay.querySelector('canvas');
    render();
    apply(temp).then(() => { if (overlay) drawPreview(); }); // 已保存颜色可能还没应用
  }
  window.OUTFIT = {
    COLORS: COLOR_ROWS, PARTS, saved, label: () => labelOf(saved()), apply, open, close,
    init(chRef) { ch = chRef; injectStyle(); if (saved().hair || saved().shirt || saved().pants) apply(saved()); },
    refresh() { if (overlay) render(); },
  };
  injectStyle();
})();
