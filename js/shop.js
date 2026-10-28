// 金币、彩色果与商店。数据存进武器存档，按累计值合并，避免多设备刷钱。
(() => {
  const MAX = 1e9;
  const clamp = n => Math.max(0, Math.min(MAX, Math.floor(Number(n) || 0)));
  const profile = () => window.ARMORY && ARMORY.state ? ARMORY.state() : null;
  let pending = 0, runEarned = 0;

  function walletOf(p) {
    p.wallet = p.wallet && typeof p.wallet === 'object' ? p.wallet : {};
    p.wallet.earned = clamp(p.wallet.earned);
    p.wallet.spent = clamp(p.wallet.spent);
    return p.wallet;
  }
  function fruitOf(p) {
    p.fruit = p.fruit && typeof p.fruit === 'object' ? p.fruit : { got: 6, used: 0 };
    p.fruit.got = clamp(p.fruit.got);
    p.fruit.used = clamp(p.fruit.used);
    return p.fruit;
  }
  function save() { if (window.ARMORY && ARMORY.saveNow) return ARMORY.saveNow(); return false; }
  function balance() { const p = profile(); if (!p) return 0; const w = walletOf(p); return Math.max(0, w.earned - w.spent); }
  function fruitCount() { const p = profile(); if (!p) return 0; const f = fruitOf(p); return Math.max(0, f.got - f.used); }
  function flush() {
    if (!pending) return true;
    const p = profile(); if (!p) return false;
    const w = walletOf(p); w.earned = clamp(w.earned + pending); pending = 0;
    const ok = save(); if (window.SHOP) SHOP.refresh(); return ok;
  }
  function awardKill(z) {
    if (!z || !z.T) return 0;
    const base = (z.T.boss || z.T.chapterBoss) ? 20 : z.T.elite ? 5 : 1;
    let mult = 1;
    if (window.XIAOCHANG && XIAOCHANG.active()) {
      const floor = Number(XIAOCHANG.state()?.floor) || 1;
      mult = floor >= 6 ? 2 : 1 + .1 * (floor - 1);
    } else if (typeof chapter2Run !== 'undefined' && chapter2Run) mult = 1.5;
    const n = Math.max(1, Math.round(base * mult));
    pending += n; runEarned += n;
    return n;
  }
  function startRun() {
    flush();
    runEarned = 0;
  }
  function spendCoins(n) {
    n = Math.floor(Number(n) || 0);
    if (n <= 0) return false;
    flush();
    const p = profile(); if (!p) return false;
    const w = walletOf(p);
    if (w.earned - w.spent < n) return false;
    w.spent = clamp(w.spent + n);
    if (!save()) { w.spent = clamp(w.spent - n); return false; }
    if (window.SHOP) SHOP.refresh();
    return true;
  }
  function addFruits(n) {
    n = Math.floor(Number(n) || 0); if (n <= 0) return false;
    const p = profile(); if (!p) return false;
    const f = fruitOf(p); f.got = clamp(f.got + n);
    if (!save()) { f.got = clamp(f.got - n); return false; }
    if (window.SHOP) SHOP.refresh();
    return true;
  }
  function useFruits(n) {
    n = Math.floor(Number(n) || 0); if (n <= 0) return false;
    const p = profile(); if (!p) return false;
    const f = fruitOf(p);
    if (f.got - f.used < n) return false;
    f.used = clamp(f.used + n);
    if (!save()) { f.used = clamp(f.used - n); return false; }
    if (window.SHOP) SHOP.refresh();
    return true;
  }

  window.WALLET = {
    coins: () => balance() + pending,
    fruits: fruitCount,
    runCoins: () => runEarned,
    pendingCoins: () => pending,
    awardKill, startRun, flush,
    spendCoins, addFruits, useFruits,
  };

  const OPEN_LINES = ['客官，看看？', '彩色果可是西域来的稀罕物！', '钱不够？去校场多练练。'];
  const EXPENSIVE_LINES = ['客官好眼力！这可是镇店之宝，配您正合适！', '哎哟贵客！小店今天沾了您的光！', '客官出手阔绰，将来必成大将军！'];
  const CHEAP_LINES = ['就买这点？行吧，蚊子腿也是肉。', '客官真会过日子，佩服佩服。', '小本买卖，谢客官赏口饭吃。'];
  const NONE_LINES = ['看了半天一文不花，客官是来避雨的？', '光看不买，我这店是给您开的茶馆？', '下回带够钱再来，我等着。'];
  const SHOP_ITEMS = [
    { id: 'fruit', name: '彩色果', desc: '换一个部位的颜色需要 2 个', price: 50, kind: 'stack', amounts: [1, 5, 10], buy: n => WALLET.addFruits(n) },
  ];
  let root = null, overlay = null, line = '', owned = {};
  let sessionSpent = 0, sessionBought = false, closing = false, closeTimer = null;
  const fmt = n => Number(n || 0).toLocaleString('zh-CN');
  const pick = a => a[Math.floor(Math.random() * a.length)];

  function injectStyle() {
    if (document.getElementById('shopStyle')) return;
    const style = document.createElement('style');
    style.id = 'shopStyle';
    style.textContent = `
      .tWallet{display:inline-block;margin-right:8px;color:#e8c97c;font:700 13px "PingFang SC",sans-serif;vertical-align:middle;white-space:nowrap}
      #tShop{padding:4px 12px;border:1px solid #9c7843;border-radius:6px;background:linear-gradient(#62482d,#34261b);color:#f1d58f;font:700 14px sans-serif;cursor:pointer;text-shadow:none;margin-right:8px}
      #tShop:active{transform:translateY(1px);filter:brightness(1.15)}
      #shopOverlay{position:fixed;inset:0;z-index:10020;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;background:rgba(10,7,6,.72);transition:opacity .22s ease}
      #shopOverlay.shopClosing{opacity:0}
      #shopPanel{width:min(780px,94vw);max-height:88dvh;display:flex;flex-direction:column;box-sizing:border-box;border:2px solid #b58b4c;border-radius:10px;background:linear-gradient(145deg,#3b2a1d,#1d1713);box-shadow:inset 0 0 0 2px #2b2017,0 18px 60px #000c;color:#ecd6ab;overflow:hidden}
      .shopHead{display:flex;align-items:center;justify-content:space-between;padding:11px 16px;border-bottom:1px solid #765b38;background:linear-gradient(#5b4028,#2e2218)}
      .shopHead h2{margin:0;color:#f3d27c;font:700 20px MaShanZheng,"STKaiti",serif;letter-spacing:1px}.shopClose{width:34px;height:34px;border:1px solid #927044;border-radius:50%;background:#34251a;color:#f3d27c;font:700 18px sans-serif;cursor:pointer}
      .shopBody{display:grid;grid-template-columns:32% minmax(0,1fr);gap:12px;min-height:0;overflow:hidden;padding:12px}
      .shopLeft{min-width:0;display:flex;flex-direction:column;gap:9px;padding:10px;border:1px solid #6f5537;border-radius:7px;background:linear-gradient(160deg,#493324,#251d17);overflow:auto}
      .shopPortrait{height:170px;display:flex;align-items:flex-end;justify-content:center;border:1px solid #745a3c;border-radius:6px;background:radial-gradient(ellipse at 50% 65%,#71502c66,transparent 70%),#211914;overflow:hidden}
      .shopPortrait img{max-width:100%;max-height:100%;object-fit:contain;image-rendering:auto}.shopPortrait.empty::after{content:"老板";color:#9c7d50;font:16px MaShanZheng,serif}
      .shopLine{margin:0;padding:9px;border:1px solid #82663f;border-radius:6px;background:#201812cc;color:#f1ddb9;font:13px/1.5 "PingFang SC",sans-serif;min-height:42px}
      .shopWallet{margin-top:auto;padding:9px;border-top:1px solid #655037;color:#e7c783;font:700 13px/1.8 "PingFang SC",sans-serif}
      .shopWallet b{color:#ffd96d;font-size:16px}.shopWallet.bump b{animation:shopBump .35s ease-out}@keyframes shopBump{0%{transform:scale(1)}45%{transform:scale(1.35);color:#fff1a8}100%{transform:scale(1)}}.shopRight{min-width:0;min-height:0;overflow:auto;padding:2px 4px 8px 2px}
      .shopGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}
      .shopCard{box-sizing:border-box;min-width:0;padding:10px;border:1px solid #7c603d;border-radius:7px;background:linear-gradient(145deg,#443122,#251d17);display:grid;grid-template-columns:48px minmax(0,1fr);gap:7px 9px;align-items:center}
      .shopCardIcon{width:48px;height:48px;display:flex;align-items:center;justify-content:center;border:1px solid #6d5336;border-radius:5px;background:#1c1511}
      .fruitIcon{width:30px;height:30px;border-radius:50%;background:radial-gradient(circle at 32% 28%,#fff2bd 0 9%,#f3bb38 24%,#df6d32 58%,#8e2e32 100%);box-shadow:0 0 0 2px #4c2524,0 0 12px #d77b32aa;position:relative}
      .fruitIcon::after{content:"";position:absolute;left:15px;top:-4px;width:2px;height:9px;background:#6c8d3a;transform:rotate(18deg)}
      .shopName{color:#f4d98f;font:700 15px "PingFang SC",sans-serif}.shopDesc{color:#cbb58e;font:12px/1.45 "PingFang SC",sans-serif}
      .shopPrice{color:#ffcf62;font:700 13px "PingFang SC",sans-serif}.shopBuyRow{grid-column:1/-1;display:flex;gap:5px;flex-wrap:wrap}
      .shopBuy{border:1px solid #a77e47;border-radius:4px;background:#593d27;color:#ffe5b0;padding:5px 7px;font:700 12px "PingFang SC",sans-serif;cursor:pointer}.shopBuy:disabled{opacity:.4;cursor:not-allowed;filter:grayscale(1)}.shopBuy:active:not(:disabled){filter:brightness(1.2)}
      .shopEmpty{color:#c3aa83;font:13px "PingFang SC",sans-serif;padding:12px}
      @media(max-height:430px){#shopPanel{max-height:94dvh}.shopBody{grid-template-columns:26% minmax(0,1fr);gap:7px;padding:7px}.shopLeft{padding:6px;gap:5px}.shopPortrait{height:82px}.shopLine{font-size:10px;padding:5px;min-height:30px}.shopWallet{font-size:10px;padding:4px}.shopWallet b{font-size:13px}.shopGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.shopCard{grid-template-columns:34px minmax(0,1fr);padding:6px;gap:4px}.shopCardIcon{width:34px;height:34px}.shopName{font-size:12px}.shopDesc{font-size:10px}.shopPrice{font-size:11px}.shopBuy{font-size:10px;padding:4px 5px}.shopHead h2{font-size:17px}.shopHead{padding:6px 10px}}
    `;
    document.head.appendChild(style);
  }

  function entryMarkup() {
    injectStyle();
    return `<span class="tWallet" data-shop-wallet>💰 ${fmt(WALLET.coins())}</span><button type="button" id="tShop">🏮 商店</button>`;
  }
  function bind(target) {
    const button = target && target.querySelector('#tShop');
    if (button) button.onclick = open;
    refreshEntry();
  }
  function refreshEntry() {
    document.querySelectorAll('[data-shop-wallet]').forEach(n => { n.textContent = '💰 ' + fmt(WALLET.coins()); });
  }
  // 老板表情：normal 平时 / happy 买了贵的 / annoyed 嫌弃（没钱、没买）
  let mood = 'normal';
  const moodSrc = m => typeof ASSETS !== 'undefined' && ASSETS.ui && (ASSETS.ui[m === 'normal' ? 'shopkeeper' : 'shopkeeper_' + m] || ASSETS.ui.shopkeeper);
  function portraitHTML() {
    const src = moodSrc(mood);
    return src ? `<img src="${src}" alt="老板">` : '';
  }
  function render() {
    if (!overlay) return;
    const balance = WALLET.coins(), fruits = WALLET.fruits();
    const left = overlay.querySelector('.shopWallet');
    if (left) left.innerHTML = `💰 余额 <b>${fmt(balance)}</b>`;
    const lineNode = overlay.querySelector('.shopLine'); if (lineNode) lineNode.textContent = line;
    const face = overlay.querySelector('.shopPortrait img'), src = moodSrc(mood); if (face && src && face.getAttribute('src') !== src) face.src = src;    const grid = overlay.querySelector('.shopGrid'); if (!grid) return;
    grid.innerHTML = '';
    if (!SHOP_ITEMS.length) { grid.innerHTML = '<p class="shopEmpty">老板今天没进货。</p>'; return; }
    for (const item of SHOP_ITEMS) {
      const card = document.createElement('div'); card.className = 'shopCard';
      const icon = item.id === 'fruit' ? '<span class="fruitIcon" aria-hidden="true"></span>' : '<span aria-hidden="true">🎁</span>';
      card.innerHTML = `<div class="shopCardIcon">${icon}</div><div><div class="shopName">${item.name}</div><div class="shopDesc">${item.desc}</div></div><div class="shopPrice">${fmt(item.price)} 金币</div><div class="shopBuyRow"></div>`;
      const row = card.querySelector('.shopBuyRow');
      if (item.kind === 'stack') {
        for (const amount of item.amounts || [1]) {
          const total = item.price * amount;
          const b = document.createElement('button'); b.type = 'button'; b.className = 'shopBuy'; b.textContent = `买${amount} · ${fmt(total)}`; b.disabled = balance < total;
          b.onclick = () => buy(item, amount);
          row.append(b);
        }
      } else {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'shopBuy'; b.textContent = owned[item.id] ? '已拥有' : '购买'; b.disabled = !!owned[item.id] || balance < item.price;
        b.onclick = () => buy(item, 1);
        row.append(b);
      }
      grid.append(card);
    }
  }
  function buy(item, amount) {
    const n = item.kind === 'stack' ? amount : 1;
    const total = item.price * n;
    if (!WALLET.spendCoins(total)) { line = '钱不够？去校场多练练。'; mood = 'annoyed'; render(); return false; }
    if (item.kind !== 'stack') { owned[item.id] = true; if (item.buy) item.buy(1); }
    else if (item.buy) item.buy(n);
    sessionSpent += total; sessionBought = true;
    line = pick(total >= 250 ? EXPENSIVE_LINES : CHEAP_LINES); mood = total >= 250 ? 'happy' : 'normal'; render(); refreshEntry();
    const walletNode = overlay && overlay.querySelector('.shopWallet');
    if (walletNode) { walletNode.classList.remove('bump'); void walletNode.offsetWidth; walletNode.classList.add('bump'); }
    return true;
  }
  function open() {
    if (overlay) return;
    injectStyle();
    clearTimeout(closeTimer); closeTimer = null; closing = false;
    sessionSpent = 0; sessionBought = false;
    line = pick(OPEN_LINES); mood = 'normal';
    overlay = document.createElement('div'); overlay.id = 'shopOverlay';
    overlay.innerHTML = `<section id="shopPanel" role="dialog" aria-modal="true" aria-label="商店">
      <header class="shopHead"><h2>🏮 商店</h2><button type="button" class="shopClose" aria-label="关闭">✕</button></header>
      <div class="shopBody"><aside class="shopLeft"><div class="shopPortrait${portraitHTML()?'':' empty'}">${portraitHTML()}</div><p class="shopLine"></p><div class="shopWallet"></div></aside><div class="shopRight"><div class="shopGrid"></div></div></div>
    </section>`;
    overlay.addEventListener('pointerdown', e => { if (e.target === overlay) close(); });
    overlay.querySelector('.shopClose').onclick = () => close();
    document.body.appendChild(overlay);
    render(); refreshEntry();
  }
  function removeShop() {
    clearTimeout(closeTimer); closeTimer = null;
    if (overlay) { overlay.remove(); overlay = null; }
    closing = false; refreshEntry();
  }
  function close() {
    if (!overlay) return;
    if (closing) { removeShop(); return; }
    if (!sessionBought) { line = pick(NONE_LINES); mood = 'annoyed'; render(); }
    closing = true;
    closeTimer = setTimeout(() => {
      if (!overlay) return;
      overlay.classList.add('shopClosing');
      closeTimer = setTimeout(removeShop, 230);
    }, 1500);
  }
  function refresh() { if (overlay) render(); refreshEntry(); }

  window.SHOP = { SHOP_ITEMS, entryMarkup, bind, refresh, open, close, refreshEntry };
  document.addEventListener('visibilitychange', () => { if (document.hidden) WALLET.flush(); });
  window.addEventListener('pagehide', () => WALLET.flush());
})();
