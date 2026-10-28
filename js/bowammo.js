// 汉弓蓄力箭：最多 5 支，每 6 秒自然回 1 支；普通箭每射中一次回 1/4 支。没箭时不能放穿云箭。
(() => {
  const MAX = 5, REGEN = 6, PER_HIT = .25;
  let n = MAX;
  const reset = () => { n = MAX; };
  const tick = dt => { if (n < MAX) n = Math.min(MAX, n + dt / REGEN); };
  const onHit = () => { if (n < MAX) n = Math.min(MAX, n + PER_HIT); };
  function use() { if (n >= 1) { n -= 1; return true; } return false; }
  // 显示：屏幕右下角「翻滚」键左边的小箭袋（深色底金边），5 支竖箭；用掉变暗影，回复中的从下往上亮起来
  const ARROW = '<svg viewBox="0 0 10 30" width="9" height="27"><path d="M5 1 L8.5 8 L6 8 L6 23 L5 23 L4 23 L4 8 L1.5 8 Z" fill="#2a1a10"/><path d="M5 2.5 L7.3 7.2 L2.7 7.2 Z" fill="#e8e2cf"/><rect x="4.4" y="7.2" width="1.2" height="16" fill="#c8a46a"/><path d="M4.2 21 L1.6 28 L4.2 26.5 Z M5.8 21 L8.4 28 L5.8 26.5 Z" fill="#b8452a" stroke="#2a1a10" stroke-width=".5"/></svg>';
  let box = null, cells = [], last = '';
  function ensureBox() {
    if (box) return box;
    const css = document.createElement('style');
    css.textContent = '#bAmmo{position:fixed;z-index:3;right:calc(160px + env(safe-area-inset-right));bottom:calc(16px + env(safe-area-inset-bottom));display:none;gap:3px;padding:5px 7px 4px;border-radius:8px;background:rgba(30,22,18,.82);border:1.5px solid #e5c98a;box-shadow:0 2px 6px rgba(0,0,0,.45);pointer-events:none}'
      + '#bAmmo .c{position:relative;width:9px;height:27px}#bAmmo .c .off{position:absolute;inset:0;opacity:.22;filter:grayscale(1)}#bAmmo .c .on{position:absolute;left:0;right:0;bottom:0;overflow:hidden;height:0}#bAmmo .c .on svg{position:absolute;bottom:0;left:0}';
    document.head.appendChild(css);
    box = document.createElement('div'); box.id = 'bAmmo';
    for (let i = 0; i < MAX; i++) { const c = document.createElement('div'); c.className = 'c'; c.innerHTML = '<div class="off">' + ARROW + '</div><div class="on">' + ARROW + '</div>'; box.appendChild(c); cells.push(c.querySelector('.on')); }
    document.body.appendChild(box); return box;
  }
  function draw() {
    const show = typeof weapon !== 'undefined' && weapon === 'bow' && !(window.TITLE && TITLE.active && TITLE.active());
    const b = ensureBox();
    if (!show) { if (b.style.display !== 'none') b.style.display = 'none'; return; }
    if (b.style.display !== 'flex') b.style.display = 'flex';
    const key = n.toFixed(2); if (key === last) return; last = key;
    cells.forEach((c, i) => { const f = Math.max(0, Math.min(1, n - i)); c.style.height = (f * 27) + 'px'; c.style.opacity = f >= 1 ? 1 : .75; });
  }
  // 标题/整备页时游戏画面不绘制，单独定时检查一下把箭袋藏起来
  setInterval(() => { if (box && window.TITLE && TITLE.active && TITLE.active()) box.style.display = 'none'; }, 300);
  window.BOWAMMO = { reset, tick, onHit, use, draw, count: () => Math.floor(n) };
})();
