// 开发者调试面板（只在网址带 ?debug 时出现，普通玩家看不到）
//   ?debug        打开面板
//   ?debug=boss   直接进管亥一阶段（骑马）
//   ?debug=boss2  直接进管亥二阶段（步战）
//   ?debug=chapter2  直接测试第二章战斗流程（玩家章节入口保持锁定）
// 桌面也可以按 F2 开/关面板，F3 跳 Boss 一阶段，F4 跳二阶段。
(() => {
  const m = /[?&]debug(?:=([a-z0-9]+))?/.exec(location.search);
  if (!m) return;
  const auto = m[1] || '';
  let panel = null, god = false, fps = 60, last = performance.now(), frames = 0, acc = 0;

  const css = document.createElement('style');
  css.textContent = `
    #dbg { position: fixed; right: 8px; top: 64px; z-index: 20; width: 152px;
      background: rgba(10,8,16,.86); border: 1px solid rgba(255,216,110,.5); border-radius: 8px;
      padding: 6px; font: 600 11px/1.5 "Consolas","PingFang SC",monospace; color: #ffd86e;
      box-shadow: 0 6px 24px rgba(0,0,0,.5); }
    #dbg b { display: block; color: #8ef07a; font-size: 11px; margin-bottom: 4px; }
    #dbg button { display: block; width: 100%; margin: 3px 0; padding: 7px 6px; font: 700 12px "PingFang SC",sans-serif;
      color: #2b1a06; background: linear-gradient(180deg,#f7dd8a,#d9a93c); border: 1px solid #8a5f12; border-radius: 6px; cursor: pointer; }
    #dbg button:active { transform: translateY(1px); }
    #dbg button.alt { background: linear-gradient(180deg,#b6e9a0,#6fbf55); border-color: #2f6b3a; }
    #dbg button.off { background: #4a4a52; color: #ddd; border-color: #333; }
    #dbg i { display: block; color: #9bb0c9; font-style: normal; font-size: 10px; margin-top: 4px; white-space: pre-line; }
  `;
  document.head.appendChild(css);

  const btn = (label, cls, fn) => {
    const b = document.createElement('button');
    b.textContent = label; if (cls) b.className = cls;
    b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
    panel.appendChild(b);
    return b;
  };

  function build() {
    panel = document.createElement('div'); panel.id = 'dbg';
    document.body.appendChild(panel);
    const head = document.createElement('b'); head.textContent = '开发者模式';
    panel.appendChild(head);
    btn('Boss 一阶段', 'alt', () => jumpBoss(false));
    btn('Boss 二阶段', 'alt', () => jumpBoss(true));
    btn('清空本区域', '', () => { if (typeof zs !== 'undefined') zs.forEach(z => { z.dead = 1; z.hp = 0; }); });
    // 瞬移主角到新区域入口，并把镜头一起拉过去（否则镜头要滑半天）
  function warpTo(x) {
    hero.x = x; hero.y = (M.top + M.bot) / 2; hero.f = 1; hero.st = 'idle';
    cam.x = Math.max(0, Math.min(M.W - viewW(), hero.x - viewW() / 2));
  }
  btn('跳到下一关', '', () => {
    if (typeof gateI === 'undefined') return;
    gateI++; lockR = Infinity; zs.length = 0; clearAt = 0;
    if (gateI < M.gates.length) warpTo(M.gates[gateI] + 10);
  });
    btn('回满血', '', () => { if (typeof hero !== 'undefined') hero.hp = 10; });
    const godBtn = btn(god ? '无敌：开' : '无敌：关', 'off', () => { god = !god; godBtn.textContent = god ? '无敌：开' : '无敌：关'; godBtn.className = god ? 'alt' : 'off'; });
    btn('复活次数 +1', '', () => { if (typeof reviveUsed !== 'undefined') reviveUsed = false; });
    btn('测试第二章', 'alt', () => { if (typeof startChapter2Debug === 'function') startChapter2Debug(); });
    btn('隐藏面板 (F2)', '', () => { panel.style.display = 'none'; });
    const info = document.createElement('i'); panel.appendChild(info);
    setInterval(() => {
      if (!panel || panel.style.display === 'none' || typeof gateI === 'undefined') return;
      const z = typeof zs !== 'undefined' && zs.find(o => o.T && o.T.boss);
      info.textContent = `区域 ${Math.min(gateI + 1, M.gates.length)}/${M.gates.length}\n` +
        (z ? `管亥 ${Math.max(0, Math.round(z.hp))}/80 · ${z.st}\n` : '') +
        `帧率 ${Math.round(fps)} · 血 ${typeof hero !== 'undefined' ? hero.hp : '-'}`;
    }, 300);
  }

  // 跳关：直接站到最后一个区域（Boss 触发点）前，下一帧就会开打
  function jumpBoss(phase2) {
    if (window.TITLE && TITLE.skip) TITLE.skip();
    if (window.ROOM && ROOM.skip) ROOM.skip();
    if (typeof reset === 'function') reset();
    zs.length = 0; eshots.length = 0;
    gateI = M.gates.length - 1;
    lockR = Infinity; clearAt = 0;
    hero.x = M.gates[gateI] + 6; hero.y = (M.top + M.bot) / 2;
  cam.x = Math.max(0, Math.min(M.W - viewW(), hero.x - viewW() / 2));
    hero.hp = 10; hero.inv = 1.5;
    say('调试：直接开打', 1.2);
    setTimeout(() => {
      const z = zs.find(o => o.T && o.T.boss);
      if (!z) return;
      // 把人直接挪到 Boss 面前（不然还要自己往右跑一段）
      hero.x = Math.max(M.gates[gateI] + 20, z.x - 150); hero.y = z.y;
    cam.x = Math.max(0, Math.min(M.W - viewW(), hero.x - viewW() / 2));
      if (phase2) { z.phase = 2; z.type = 'guanhai'; z.st = 'idle'; z.t = 0; z.z = 0; z.cd = .6; z.hp = 80; }
    }, 150);
  }

  addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.code === 'F2') { if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; e.preventDefault(); }
    if (e.code === 'F3') { jumpBoss(false); e.preventDefault(); }
    if (e.code === 'F4') { jumpBoss(true); e.preventDefault(); }
  });

  // 帧率统计 + 无敌
  function tick(t) {
    frames++; acc += t - last; last = t;
    if (acc > 500) { fps = frames * 1000 / acc; frames = 0; acc = 0; }
    if (god && typeof hero !== 'undefined' && hero) hero.hp = 10;
    requestAnimationFrame(tick);
  }

  function boot() {
    build();
    last = performance.now();
    requestAnimationFrame(tick);
    if (auto === 'boss' || auto === 'boss2') setTimeout(() => jumpBoss(auto === 'boss2'), 900);
    if (auto === 'chapter2') setTimeout(() => { if (typeof startChapter2Debug === 'function') startChapter2Debug(); }, 900);
    console.log('%c[开发者模式] 已开启', 'color:#8ef07a;font-weight:bold', 'F2 面板 / F3 Boss一阶段 / F4 Boss二阶段');
  }
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot); else boot();
})();
