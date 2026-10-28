// 汉弓蓄力箭：最多 5 支，每 6 秒自然回 1 支；普通箭每射中一次回 1/4 支。没箭时不能放穿云箭。
(() => {
  const MAX = 5, REGEN = 6, PER_HIT = .25;
  let n = MAX;
  const reset = () => { n = MAX; };
  const tick = dt => { if (n < MAX) n = Math.min(MAX, n + dt / REGEN); };
  const onHit = () => { if (n < MAX) n = Math.min(MAX, n + PER_HIT); };
  function use() { if (n >= 1) { n -= 1; return true; } return false; }
  // 主角头上一排 5 个小箭头：有箭亮金色，用掉变暗，正在回的那支按进度填
  function draw() {
    if (typeof weapon === 'undefined' || weapon !== 'bow' || !hero || hero.dead) return;
    const x0 = hero.x - 12, y = hero.y + 4;   // 画在脚下，不和头顶的连击数字打架
    for (let i = 0; i < MAX; i++) {
      const fill = Math.max(0, Math.min(1, n - i)), x = x0 + i * 5;
      ctx.fillStyle = '#2a1c0c'; ctx.fillRect(x - .5, y - .5, 4, 7);
      ctx.fillStyle = '#5a4a32'; ctx.fillRect(x, y, 3, 6);
      if (fill > 0) { ctx.fillStyle = fill >= 1 ? '#f0c95a' : '#b8954a'; ctx.fillRect(x, y + 6 * (1 - fill), 3, 6 * fill); }
    }
  }
  window.BOWAMMO = { reset, tick, onHit, use, draw, count: () => Math.floor(n) };
})();
