// 主线 / 校场的首领战录像（用户定 2026-10-31）：只用来训练心魔 AI，训练完自动删除。
// 只录首领战（管亥、张梁、张宝、张角，校场第 6 波），记玩家这一方：状态、按键、身边最近 3 个敌人；每秒 20 行。
// 心魔战由 js/xinmo.js 自己录，这里不重复。
(() => {
  const ST = ['idle', 'walk', 'atk', 'roll', 'hurt', 'bounce', 'getup', 'charge', 'air', 'land', 'down', 'wind', 'strike', 'rec', 'move'];
  const TYPES_ID = ['grunt', 'blade', 'slinger', 'archer', 'priest', 'elite', 'boss', 'yellow-heavy', 'yellow-shield', 'yellow-spear', 'yellow-catapult', 'yellow_golem', 'zhang_liang', 'zhang_bao', 'zhang_jiao'];
  const HS = ['x', 'y', 'vx', 'vy', 'f', 'st', 'c', 'fi', 'inv', 'hp', 'chg', 'rollcd', 'ix', 'iy', 'atk', 'roll'];
  const COLS = ['t', ...HS.map(k => 'h_' + k), ...[0, 1, 2].flatMap(i => ['e' + i + '_dx', 'e' + i + '_dy', 'e' + i + '_type', 'e' + i + '_st', 'e' + i + '_hp', 'e' + i + '_f', 'e' + i + '_boss'])];
  const R2 = v => Math.round(v * 100) / 100;
  let tape = null, keys = null, hits = null, acc = 0, lastHp = 0, lastT = 0;
  const KEYMAP = { KeyJ: 'atk', KeyK: 'roll', KeyL: 'roll', Space: 'roll', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down' };
  addEventListener('keydown', e => { if (tape && KEYMAP[e.code] && !e.repeat) keys.push([R2(gameT - tape.t0), 0, KEYMAP[e.code], 1]); }, true);
  addEventListener('keyup', e => { if (tape && KEYMAP[e.code]) keys.push([R2(gameT - tape.t0), 0, KEYMAP[e.code], 0]); }, true);
  for (const ty of ['pointerdown', 'pointerup']) addEventListener(ty, e => { const b = tape && e.target && e.target.closest && e.target.closest('#bA,#bR'); if (b) keys.push([R2(gameT - tape.t0), 0, b.id === 'bA' ? 'atk' : 'roll', ty === 'pointerdown' ? 1 : 0]); }, true);
  const bossAlive = () => typeof zs !== 'undefined' && zs.some(z => !z.dead && z.T && (z.T.boss || z.T.chapterBoss));
  const xinmo = () => window.XIAOCHANG && XIAOCHANG.lockedWeapon && XIAOCHANG.lockedWeapon();
  function mode() { const x = window.XIAOCHANG && XIAOCHANG.active() && XIAOCHANG.state(); if (x) return 'xc' + x.chapter + '-' + x.floor; return typeof chapter2Run !== 'undefined' && chapter2Run ? 'ch2-' + (chapter2Run.battle || 0) : 'ch1'; }
  function start() { tape = []; tape.t0 = gameT; tape.mode = mode(); tape.weapon = weapon; keys = []; hits = []; acc = 0; lastHp = hero.hp; }
  function finish(win) {
    if (!tape) return; const t = tape; tape = null;
    if (t.length < 40) return;
    const body = JSON.stringify({ kind: 'play', mode: t.mode, name: window.TITLE && TITLE.playerName ? TITLE.playerName() : '', weapon: ['staff', 'hammer', 'stone', 'halberd', 'blade', 'bow'].includes(t.weapon) ? t.weapon : 'staff', win, dt: .05, cols: COLS, rows: t, keys, hits, touch: typeof IS_TOUCH !== 'undefined' && IS_TOUCH ? 1 : 0 });
    if (body.length > 880000) return;
    fetch('/api/xinmo', { method: 'POST', headers: { 'content-type': 'application/json' }, body }).catch(() => {});
  }
  function tick() {
    if (typeof hero === 'undefined' || !hero || typeof gameT === 'undefined') return;
    const dt = gameT - lastT; lastT = gameT; if (dt <= 0 || dt > .5) return;   // 暂停、切页面时 gameT 不动
    if (!tape) { if (bossAlive() && !xinmo() && !over) start(); return; }
    if (over || !bossAlive() || xinmo()) { finish(!over); return; }
    const t = R2(gameT - tape.t0);
    if (hero.hp < lastHp - .001) hits.push([t, 1, R2(lastHp - hero.hp), 0]); lastHp = hero.hp;
    acc += dt; if (acc < .05 || tape.length >= 7500) return; acc = 0;
    const h = hero, enemies = zs.filter(z => !z.dead && !z.ally).sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y)).slice(0, 3), es = [];
    for (let i = 0; i < 3; i++) { const z = enemies[i]; es.push(...(z ? [R2(z.x - h.x), R2(z.y - h.y), TYPES_ID.indexOf(z.type), Math.max(0, ST.indexOf(z.st)), R2(z.hp / (z.T.hp || 1)), z.f || 1, z.T.boss || z.T.chapterBoss ? 1 : 0] : [0, 0, -1, 0, 0, 0, 0])); }
    tape.push([t, R2(h.x), R2(h.y), R2(h.mvx || 0), R2(h.mvy || 0), h.f, Math.max(0, ST.indexOf(h.st)), h.atk ? h.atk.c : -1, h.atk ? h.atk.fi : -1, h.inv > 0 ? 1 : 0, R2(h.hp),
      R2(charging && atkHeldSince ? (performance.now() - atkHeldSince) / 1000 : 0), R2(h.rollCd || 0), R2(h.ix || 0), R2(h.iy || 0), atkHeldSince || pressAtk ? 1 : 0, h.st === 'roll' ? 1 : 0, ...es]);
  }
  setInterval(tick, 25);
  window.PLAYTAPE = { active: () => !!tape };
})();
