// 汉弓蓄力箭：最多 5 支，每 6 秒自然回 1 支；普通箭每射中一次回 1/4 支。没箭时不能放穿云箭。
(() => {
  const MAX = 5, REGEN = 6, PER_HIT = .25;
  let n = MAX;
  const reset = () => { n = MAX; };
  const tick = dt => { if (n < MAX) n = Math.min(MAX, n + dt / REGEN); };
  const onHit = () => { if (n < MAX) n = Math.min(MAX, n + PER_HIT); };
  function use() { if (n >= 1) { n -= 1; return true; } return false; }
  // 脚下一排 5 支竖着的小箭（箭头朝上）：有箭是完整的箭，用掉变成淡淡的虚影，正在回的那支从下往上慢慢"长"出来
  function arrow(x, y, a, fill) {
    const h = 9, top = y - h;
    ctx.globalAlpha = a;
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(x - .5, top + 2, 2, h - 2);                    // 杆描边
    ctx.fillStyle = '#c8a46a'; ctx.fillRect(x, top + 2.5, 1, (h - 2.5));                   // 箭杆
    ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.moveTo(x + .5, top - 1.5); ctx.lineTo(x - 2, top + 3); ctx.lineTo(x + 3, top + 3); ctx.closePath(); ctx.fill();   // 箭头
    ctx.fillStyle = '#d9d4c4'; ctx.beginPath(); ctx.moveTo(x + .5, top); ctx.lineTo(x - 1, top + 2.5); ctx.lineTo(x + 2, top + 2.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b8452a'; ctx.fillRect(x - 1.5, y - 2.5, 1.5, 2.5); ctx.fillRect(x + 1, y - 2.5, 1.5, 2.5);   // 红色尾羽
    ctx.globalAlpha = 1;
  }
  function draw() {
    if (typeof weapon === 'undefined' || weapon !== 'bow' || !hero || hero.dead) return;
    const x0 = hero.x - 12, y = hero.y + 12;
    for (let i = 0; i < MAX; i++) {
      const fill = Math.max(0, Math.min(1, n - i)), x = x0 + i * 6;
      if (fill >= 1) arrow(x, y, 1);
      else {
        arrow(x, y, .22);   // 空槽：淡影
        if (fill > 0) { ctx.save(); ctx.beginPath(); ctx.rect(x - 3, y - 11 * fill, 7, 11 * fill + 1); ctx.clip(); arrow(x, y, .85); ctx.restore(); }   // 回复中：从下往上长出来
      }
    }
  }
  window.BOWAMMO = { reset, tick, onHit, use, draw, count: () => Math.floor(n) };
})();
