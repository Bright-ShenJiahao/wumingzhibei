// 视角 DEMO：A 清版斜俯视 / B 正上方俯视 / C 3/4 俯视
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const IMG = {};
function load(k, src) { const i = new Image(); i.src = src; IMG[k] = i; }
load('hero', ASSETS.hero); load('far', BG.far); load('mid', BG.mid); load('gnd', BG.gnd); load('z1', ASSETS.z1); load('z2', ASSETS.z2); load('tree', ASSETS.tree);
ASSETS.houses.forEach((h, i) => load('h' + i, h[0]));
Object.entries(ASSETS.props).forEach(([k, v]) => load('p_' + k, v[0]));
const PROP_POOL = ['hay', 'hay', 'well', 'mill', 'cart', 'flag'];   // 篱笆抠图偏绿，暂不使用

const FW = 56, FH = 44, AX = 28, AY = 40;
const F = { idle: [0, 1], walk: [2, 3, 4, 5], roll: [6, 7, 8, 9, 10], hurt: [11], down: [12], staff: [13, 14, 15], knife: [16, 17, 18], stone: [19, 20, 21] };
const WEAP = {
  staff: { name: '棍', dur: [.14, .1, .16], reach: 36, dy: 12, multi: true, kb: 70 },
  knife: { name: '柴刀', dur: [.06, .08, .1], reach: 26, dy: 10, multi: false, kb: 40 },
  stone: { name: '石子', dur: [.08, .07, .12], proj: true, kb: 30 },
};
const MODES = {
  A: { name: '宽地面清版', viewH: 300, W: 2400, top: 168, bot: 290, gates: [330, 900, 1470, 2040], hp: 4, token: 2 },
  B: { name: 'B 正上方俯视', viewH: 230, W: 1200, H: 1000, hp: 1, token: 99 },
  C: { name: 'C 3/4 俯视', viewH: 200, W: 1700, top: 70, bot: 360, gates: [300, 760, 1220], hp: 4, token: 2 },
};
let mode = 'A', M, hero, zs, shots, props, cam, gateI, lockR, kills, msg, msgT, freeze, shake, weapon = 'knife', spawnT, over;
const rnd = (a, b) => a + Math.random() * (b - a);

function reset(m) {
  mode = m || mode; M = MODES[mode];
  hero = { x: 60, y: mode === 'B' ? 500 : (M.top + M.bot) / 2, f: 1, hp: 10, st: 'idle', t: 0, inv: 0, rollCd: 0, atk: null, q: 0, combo: 0, vx: 0, vy: 0 };
  if (mode === 'B') hero.x = 600;
  zs = []; shots = []; props = []; cam = { x: 0, y: 0 }; gateI = 0; lockR = Infinity; kills = 0; freeze = 0; shake = 0; spawnT = 0; over = false;
  if (mode === 'A') {
    for (let x = 160; x < M.W - 100; x += rnd(130, 220)) {
      const k = PROP_POOL[Math.floor(Math.random() * PROP_POOL.length)], [, pw, ph] = ASSETS.props[k];
      props.push({ g: k, x, y: rnd(M.top + 24, M.bot - 8), solid: true, w: k === 'flag' ? 4 : pw * .75, h: ph });
    }
    props.push({ g: 'gate', x: M.W - 110, y: M.top + 70 });   // 村口门楼（可穿过）
    say('往右走 → 进入区域会有僵尸出现');
  } else if (mode === 'B') {
    for (let i = 0; i < 16; i++) props.push({ roof: true, x: rnd(40, 1100), y: rnd(40, 940), w: rnd(60, 100), h: rnd(40, 60) });
    for (let i = 0; i < 26; i++) props.push({ crown: true, x: rnd(20, 1180), y: rnd(20, 980) });
    say('四面八方都会刷僵尸 —— 割草的感觉');
  } else {
    const spots = [[120, 150, 0], [330, 110, 1], [460, 290, 2], [640, 160, 0], [820, 330, 1], [930, 120, 2], [1120, 250, 0], [1300, 140, 1], [1450, 320, 2], [1580, 200, 0]];
    spots.forEach(([x, y, k]) => props.push({ k: 'h' + k, x, y, solid: true, w: ASSETS.houses[k][3] }));
    for (let i = 0; i < 22; i++) props.push({ k: 'tree', x: rnd(30, M.W - 30), y: rnd(M.top + 20, M.bot), solid: true, w: 8, tree: true });
    say('房子是立着的，可以绕到房子后面；往右推进');
  }
}
function say(s) { msg = s; msgT = 3; }

// ---------- 输入 ----------
const key = {}; let joy = null, pressAtk = false, pressRoll = false;
addEventListener('keydown', e => {
  key[e.code] = 1;
  if (e.code === 'KeyJ') pressAtk = true;
  if (e.code === 'KeyK' || e.code === 'Space') pressRoll = true;
  if (e.code === 'Digit1') setW('staff'); if (e.code === 'Digit2') setW('knife'); if (e.code === 'Digit3') setW('stone');
  if (e.code === 'KeyR') reset();
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => key[e.code] = 0);
const jz = document.getElementById('joy'), jk = document.getElementById('knob');
jz.addEventListener('pointerdown', e => { joy = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; jz.setPointerCapture(e.pointerId); });
jz.addEventListener('pointermove', e => { if (!joy || e.pointerId !== joy.id) return; let dx = e.clientX - joy.x, dy = e.clientY - joy.y, l = Math.hypot(dx, dy); if (l > 50) { dx *= 50 / l; dy *= 50 / l; } joy.dx = dx / 50; joy.dy = dy / 50; jk.style.transform = `translate(${dx}px,${dy}px)`; });
const endJ = () => { joy = null; jk.style.transform = ''; };
jz.addEventListener('pointerup', endJ); jz.addEventListener('pointercancel', endJ);
document.getElementById('bA').addEventListener('pointerdown', e => { e.preventDefault(); pressAtk = true; });
document.getElementById('bR').addEventListener('pointerdown', e => { e.preventDefault(); pressRoll = true; });
document.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { reset(b.dataset.m); ui(); });
document.querySelectorAll('[data-w]').forEach(b => b.onclick = () => setW(b.dataset.w));
function setW(w) { weapon = w; ui(); }
function ui() {
  document.querySelectorAll('[data-m]').forEach(b => b.classList.toggle('on', b.dataset.m === mode));
  document.querySelectorAll('[data-w]').forEach(b => b.classList.toggle('on', b.dataset.w === weapon));
}

// ---------- 碰撞 ----------
function blocked(x, y) {
  if (mode === 'B') return false;
  for (const p of props) if (p.solid) {
    if (p.tree) { if (Math.abs(x - p.x) < 5 && y > p.y - 4 && y < p.y + 2) return true; }
    else if (p.g) { if (Math.abs(x - p.x) < p.w / 2 && y > p.y - 6 && y < p.y + 2) return true; }
    else if (x > p.x - 2 && x < p.x + p.w + 2 && y > p.y - 12 && y < p.y + 2) return true;
  }
  return false;
}
function moveEnt(e, dx, dy) {
  if (!blocked(e.x + dx, e.y)) e.x += dx;
  if (!blocked(e.x, e.y + dy)) e.y += dy;
  if (mode === 'B') { e.x = Math.max(10, Math.min(M.W - 10, e.x)); e.y = Math.max(20, Math.min(M.H - 4, e.y)); }
  else { e.y = Math.max(M.top, Math.min(M.bot, e.y)); e.x = Math.max(10, Math.min(M.W - 10, e.x)); }
}

// ---------- 刷怪 ----------
function spawnZ(x, y, hp) { zs.push({ x, y, f: -1, hp, st: 'move', t: rnd(0, 1), stun: 0, flash: 0, vx: 0, tok: false, hop: rnd(0, 6) }); }
function viewW() { return cv.width / (cv.height / M.viewH); }
function waves(dt) {
  if (mode === 'B') {
    spawnT -= dt;
    if (spawnT <= 0 && zs.length < 70) {
      spawnT = .35; const a = rnd(0, 6.28), r = M.viewH * 0.9;
      spawnZ(hero.x + Math.cos(a) * r * 1.2, hero.y + Math.sin(a) * r * .8, 1);
    }
    return;
  }
  const vw = viewW();
  if (lockR < Infinity && zs.length === 0) { lockR = Infinity; gateI++; say(gateI < M.gates.length ? '区域清空！GO →' : '全部清空！按 R 或换视角再来'); }
  if (lockR === Infinity && gateI < M.gates.length && hero.x > M.gates[gateI]) {
    const gx = M.gates[gateI]; lockR = gx + vw * 0.6;
    const n = mode === 'A' ? 5 : 5;
    for (let i = 0; i < n; i++) {
      const fromRight = i < n - 1 || mode === 'C';
      const x = fromRight ? lockR + rnd(10, 40) : cam.x - rnd(10, 30);
      const y = mode === 'A' ? rnd(M.top + 4, M.bot - 4) : Math.max(M.top, Math.min(M.bot, hero.y + rnd(-90, 90)));
      spawnZ(x, y, M.hp);
    }
    say(mode === 'A' ? '前后夹击！最多 2 只同时出手' : '敌人从前方和两侧来，最多 2 只同时出手');
  }
}

// ---------- 更新 ----------
function hit(z, dmg, kb, dir) {
  if (z.dead) return;
  z.hp -= dmg; z.flash = .1; z.stun = .35; z.vx = kb * dir; z.st = 'move'; if (z.tok) z.tok = false;
  freeze = .05; shake = .1;
  if (z.hp <= 0) { z.dead = 1; z.t = 0; z.vx = kb * 2 * dir; kills++; }
}
function heroUpdate(dt) {
  const h = hero;
  h.inv = Math.max(0, h.inv - dt); h.rollCd = Math.max(0, h.rollCd - dt); h.t += dt;
  if (h.st === 'down') return;
  let ix = (key.KeyD || key.ArrowRight ? 1 : 0) - (key.KeyA || key.ArrowLeft ? 1 : 0), iy = (key.KeyS || key.ArrowDown ? 1 : 0) - (key.KeyW || key.ArrowUp ? 1 : 0);
  if (joy) { ix = Math.abs(joy.dx) > .2 ? joy.dx : 0; iy = Math.abs(joy.dy) > .2 ? joy.dy : 0; }
  const l = Math.hypot(ix, iy); if (l > 1) { ix /= l; iy /= l; }
  if (h.st === 'hurt') { if (h.t > .3) set(h, 'idle'); moveEnt(h, h.vx * dt, 0); h.vx *= .85; pressAtk = pressRoll = false; return; }
  if (pressRoll && h.rollCd === 0 && h.st !== 'roll') {
    set(h, 'roll'); h.inv = .4; h.rollCd = .75; h.atk = null;
    const d = Math.hypot(ix, iy) > 0.1 ? [ix, iy] : [h.f, 0]; const dl = Math.hypot(...d); h.rx = d[0] / dl; h.ry = d[1] / dl;
    if (Math.abs(h.rx) > .1) h.f = Math.sign(h.rx);
  }
  pressRoll = false;
  if (h.st === 'roll') {
    moveEnt(h, h.rx * 150 * dt, h.ry * 150 * dt * (mode === 'A' ? .7 : 1));
    if (h.t > .4) set(h, 'idle'); pressAtk = false; return;
  }
  if (pressAtk) { if (h.st === 'atk') h.q = 1; else startAtk(); pressAtk = false; }
  if (h.st === 'atk') {
    const W = WEAP[weapon], a = h.atk; a.t += dt;
    if (a.fi === 0 && a.t >= W.dur[0]) { a.fi = 1; a.t = 0; strike(); }
    else if (a.fi === 1 && a.t >= W.dur[1]) { a.fi = 2; a.t = 0; }
    else if (a.fi === 2 && a.t >= W.dur[2]) { if (h.q) { h.q = 0; h.combo = (h.combo + 1) % 3; startAtk(true); } else { h.combo = 0; set(h, 'idle'); } }
    if (ix) h.f = Math.sign(ix) && a.fi === 0 ? Math.sign(ix) : h.f;
    moveEnt(h, ix * 15 * dt, 0);
    return;
  }
  if (ix || iy) {
    if (h.st !== 'walk') set(h, 'walk');
    if (ix) h.f = Math.sign(ix);
    moveEnt(h, ix * 70 * dt, iy * (mode === 'A' ? 52 : 60) * dt);
  } else if (h.st !== 'idle') set(h, 'idle');
  if (lockR < Infinity) { const wall = lockR - viewW() * .2; if (h.x >= wall - .5 && ix > 0 && msgT < 0) say(`清空本区域的敌人才能继续前进（还剩 ${zs.filter(z => !z.dead).length} 只）`); h.x = Math.min(h.x, wall); }
}
function set(e, st) { e.st = st; e.t = 0; }
function startAtk(keep) { set(hero, 'atk'); hero.atk = { fi: 0, t: 0 }; if (!keep) hero.combo = 0; }
function strike() {
  const h = hero, W = WEAP[weapon], fin = h.combo === 2;
  if (W.proj) { shots.push({ x: h.x + h.f * 14, y: h.y, z: 20, vx: h.f * 230, life: .8 }); return; }
  for (const z of zs) {
    if (z.dead) continue;
    const dx = (z.x - h.x) * h.f;
    if (dx > -4 && dx < W.reach && Math.abs(z.y - h.y) < W.dy) { hit(z, fin ? 2 : 1, fin ? W.kb * 2 : W.kb, h.f); if (!W.multi) break; }
  }
}
function zUpdate(z, dt) {
  z.t += dt; z.flash = Math.max(0, z.flash - dt);
  if (z.dead) { z.x += z.vx * dt; z.vx *= .9; return; }
  if (z.stun > 0) { z.stun -= dt; moveEnt(z, z.vx * dt, 0); z.vx *= .85; return; }
  const dx = hero.x - z.x, dy = hero.y - z.y; z.f = Math.sign(dx) || 1;
  if (mode === 'B') { const l = Math.hypot(dx, dy) || 1; moveEnt(z, dx / l * 32 * dt, dy / l * 32 * dt); if (l < 12) dmgHero(1, z); return; }
  if (z.st === 'wind') { if (z.t > .55) { set(z, 'strike'); if (Math.abs(dx) < 24 && Math.abs(dy) < 9) dmgHero(2, z); } return; }
  if (z.st === 'strike') { moveEnt(z, z.f * 40 * dt, 0); if (z.t > .15) set(z, 'rec'); return; }
  if (z.st === 'rec') { if (z.t > .7) { z.tok = false; set(z, 'move'); } return; }
  const tokens = zs.filter(o => o.tok && !o.dead).length;
  if (!z.tok && tokens < M.token && Math.abs(dx) < 70) z.tok = true;
  let tx = hero.x - z.f * (z.tok ? 18 : 48 + (zs.indexOf(z) % 3) * 12), ty = hero.y + (z.tok ? 0 : ((zs.indexOf(z) % 2) ? 14 : -14));
  const mx = tx - z.x, my = ty - z.y, l = Math.hypot(mx, my);
  const hopping = Math.sin(z.t * 7 + z.hop) > 0;
  if (l > 3 && hopping) moveEnt(z, mx / l * 38 * dt, my / l * 26 * dt);
  if (z.tok && Math.abs(dx) < 22 && Math.abs(dy) < 7) set(z, 'wind');
}
function dmgHero(n, z) {
  const h = hero; if (h.inv > 0 || h.st === 'down' || over) return;
  h.hp -= n; h.inv = .7; shake = .2; set(h, 'hurt'); h.atk = null; h.vx = (z ? Math.sign(h.x - z.x) : -h.f) * 80;
  if (h.hp <= 0) { set(h, 'down'); over = true; say('倒下了…按 R 或点视角按钮重来'); }
}
function update(dt) {
  if (freeze > 0) { freeze -= dt; return; }
  heroUpdate(dt); waves(dt);
  zs.forEach(z => zUpdate(z, dt));
  zs = zs.filter(z => !(z.dead && z.t > .5) && !(mode === 'B' && Math.hypot(z.x - hero.x, z.y - hero.y) > 600));
  for (const s of shots) {
    s.x += s.vx * dt; s.life -= dt;
    for (const z of zs) if (!z.dead && Math.abs(z.x - s.x) < 9 && Math.abs(z.y - s.y) < 10 && s.life > 0) { hit(z, 1, WEAP.stone.kb, Math.sign(s.vx)); s.life = 0; }
  }
  shots = shots.filter(s => s.life > 0);
  const vw = viewW();
  let tx = hero.x - vw * .4, ty = mode === 'A' ? 0 : hero.y - M.viewH * .58;
  if (lockR < Infinity) tx = Math.min(tx, lockR - vw);
  cam.x += (Math.max(0, Math.min(M.W - vw, tx)) - cam.x) * Math.min(1, dt * 6);
  if (mode !== 'A') cam.y += (Math.max(mode === 'B' ? 0 : -10, Math.min((mode === 'B' ? M.H : M.bot + 20) - M.viewH, ty)) - cam.y) * Math.min(1, dt * 6);
  shake = Math.max(0, shake - dt); msgT -= dt;
}

// ---------- 绘制 ----------
let SC = 3;
function frameOf(e) {
  if (e.st === 'atk') return F[weapon][e.atk.fi];
  if (e.st === 'roll') return F.roll[Math.min(4, Math.floor(e.t / .4 * 5))];
  if (e.st === 'walk') return F.walk[Math.floor(e.t * 8) % 4];
  if (e.st === 'hurt') return F.hurt[0]; if (e.st === 'down') return F.down[0];
  return F.idle[Math.floor(e.t * 2) % 2];
}
function tileLayer(img, s, par, y, vflip) {
  if (!img.complete || !img.width) return;
  const tw = img.width * s, th = img.height * s, vw = viewW(), ox = cam.x * (1 - par);
  for (let i = Math.floor((cam.x - ox) / tw) - 1; i * tw + ox < cam.x + vw; i++) {
    const x = i * tw + ox;
    ctx.save(); ctx.translate(x + (i & 1 ? tw : 0), y + (vflip ? th : 0)); ctx.scale(i & 1 ? -1 : 1, vflip ? -1 : 1);
    ctx.drawImage(img, 0, 0, tw + .5, th); ctx.restore();
  }
}
function shadow(x, y, r) { ctx.fillStyle = 'rgba(40,30,30,.28)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * .3, 0, 0, 7); ctx.fill(); }
function drawSpr(img, sx, sy, sw, sh, x, y, ax, ay, flip, alpha = 1, white = false) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(Math.round(x), Math.round(y)); if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, sx, sy, sw, sh, -ax, -ay, sw, sh);
  if (white) { ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(-ax, -ay, sw, sh); }
  ctx.restore();
}
function draw() {
  const W = cv.width, H = cv.height; SC = H / M.viewH;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
  const sk = shake > 0 ? rnd(-2, 2) : 0;
  ctx.setTransform(SC, 0, 0, SC, Math.round(-cam.x * SC + sk), Math.round(-cam.y * SC));
  const vw = viewW();
  // 地面
  if (mode === 'A') {
    ctx.imageSmoothingEnabled = true;
    const ms = .24 / .61, my = 165 - 619 * .24;
    tileLayer(IMG.far, .577, .3, 0);
    tileLayer(IMG.gnd, .62, 1, my + 560 * ms);   // 地面纹理垫在中景下面，中景底部渐隐过渡
    tileLayer(IMG.mid, ms, 1, my);
    ctx.imageSmoothingEnabled = false;
  } else if (mode === 'B') {
    ctx.fillStyle = '#d5e3c6'; ctx.fillRect(cam.x - 5, cam.y - 5, vw + 10, M.viewH + 10);
    ctx.fillStyle = '#c6d6b6';
    for (let x = Math.floor(cam.x / 32) * 32; x < cam.x + vw; x += 32) ctx.fillRect(x, cam.y, 1, M.viewH);
    for (let y = Math.floor(cam.y / 32) * 32; y < cam.y + M.viewH; y += 32) ctx.fillRect(cam.x, y, vw, 1);
  } else {
    ctx.fillStyle = '#9fb48f'; ctx.fillRect(cam.x - 5, cam.y - 5, vw + 10, M.viewH + 10);
    ctx.fillStyle = '#d9e4c6'; ctx.fillRect(cam.x - 5, M.top - 16, vw + 10, M.bot - M.top + 30);
    ctx.fillStyle = '#e9dcc0'; ctx.fillRect(cam.x - 5, 200, vw + 10, 34);
    ctx.fillStyle = '#5f7a58'; ctx.fillRect(cam.x - 5, M.top - 30, vw + 10, 14);
    ctx.fillStyle = '#7d9670'; ctx.fillRect(cam.x - 5, M.bot + 14, vw + 10, 14);
  }
  // 区域闸门提示
  if (lockR < Infinity && mode !== 'B') {   // 区域锁：在主角能到达的边界画一排红旗
    const wx = lockR - vw * .2 + 12, t = performance.now() / 300;
    ctx.fillStyle = 'rgba(200,40,30,.18)'; ctx.fillRect(wx - 3, M.top, 6, M.bot - M.top + 8);
    for (let y = M.top + 4; y <= M.bot + 4; y += 18) {
      ctx.fillStyle = '#3a2418'; ctx.fillRect(wx - 1, y - 16, 2, 16);
      ctx.fillStyle = '#c8281e'; ctx.beginPath(); ctx.moveTo(wx + 1, y - 16); ctx.lineTo(wx + 10 + Math.sin(t + y) * 1.5, y - 13); ctx.lineTo(wx + 1, y - 10); ctx.fill();
    }
  }
  // B：屋顶
  if (mode === 'B') for (const p of props) {
    if (p.roof) { ctx.fillStyle = '#18101e'; ctx.fillRect(p.x - 1, p.y - 1, p.w + 2, p.h + 2); ctx.fillStyle = '#3a3852'; ctx.fillRect(p.x, p.y, p.w, p.h); ctx.fillStyle = '#4c4a68'; ctx.fillRect(p.x, p.y, p.w, p.h / 2); ctx.fillStyle = '#18101e'; ctx.fillRect(p.x, p.y + p.h / 2, p.w, 1); }
    if (p.crown) { ctx.fillStyle = '#18101e'; ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, 7); ctx.fill(); ctx.fillStyle = '#3c6a5c'; ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, 7); ctx.fill(); ctx.fillStyle = '#4e8270'; ctx.beginPath(); ctx.arc(p.x - 3, p.y - 3, 6, 0, 7); ctx.fill(); }
  }
  // A：背景房子（贴在地面后沿）
  if (mode === 'A') for (const p of props) if (p.back) drawProp(p, 1);
  // 排序绘制
  const list = [];
  for (const p of props) if (!p.back && !p.roof && !p.crown) list.push({ y: p.y, d: () => drawProp(p, propAlpha(p)) });
  for (const z of zs) list.push({ y: z.y, d: () => drawZ(z) });
  list.push({ y: hero.y, d: drawHero });
  for (const s of shots) list.push({ y: hero.y + .1, d: () => { ctx.fillStyle = '#18101e'; ctx.fillRect(s.x - 2, s.y - s.z - 2, 4, 4); ctx.fillStyle = '#969aa4'; ctx.fillRect(s.x - 1, s.y - s.z - 1, 2, 2); } });
  list.sort((a, b) => a.y - b.y).forEach(o => o.d());
  // HUD
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const bw = Math.min(260, W * .4);
  ctx.fillStyle = 'rgba(20,14,30,.7)'; ctx.fillRect(14, 64, bw + 6, 18);
  ctx.fillStyle = '#d23c30'; ctx.fillRect(17, 67, bw * Math.max(0, hero.hp) / 10, 12);
  ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(14, 84, 200, 22); ctx.fillStyle = '#222'; ctx.font = 'bold 15px sans-serif'; ctx.fillText(`击倒 ${kills}   武器：${WEAP[weapon].name}`, 14, 100);
  if (lockR < Infinity) { const n = zs.filter(z => !z.dead).length; ctx.fillStyle = 'rgba(200,40,30,.85)'; ctx.fillRect(14, 110, 200, 22); ctx.fillStyle = '#fff'; ctx.fillText(`本区域剩余敌人：${n}`, 20, 126); }
  if (msgT > 0) { ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(20,14,30,.75)'; const tw = ctx.measureText(msg).width; ctx.fillRect(W / 2 - tw / 2 - 12, 108, tw + 24, 32); ctx.fillStyle = '#ffd86e'; ctx.fillText(msg, W / 2, 130); ctx.textAlign = 'left'; }
}
function drawGround(p) {
  const im = IMG['p_' + p.g], [, w, h] = ASSETS.props[p.g];
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(im, Math.round(p.x - w / 2), Math.round(p.y + 2 - h), w, h);
  ctx.imageSmoothingEnabled = false;
}
function propAlpha(p) {
  if (p.g) { const [, w, h] = ASSETS.props[p.g]; return (hero.y < p.y && hero.y > p.y - h + 6 && Math.abs(hero.x - p.x) < w / 2 + 4) ? .5 : 1; }
  if (p.tree) return (hero.y < p.y && hero.y > p.y - 40 && Math.abs(hero.x - p.x) < 14) ? .45 : 1;
  return (hero.y < p.y - 2 && hero.y > p.y - 70 && hero.x > p.x - 10 && hero.x < p.x + p.w + 10) ? .45 : 1;
}
function drawProp(p, a) {
  if (p.g) { ctx.save(); ctx.globalAlpha = a; drawGround(p); ctx.restore(); return; }
  if (p.k === 'tree') { const t = IMG.tree; drawSpr(t, 0, 0, t.width, t.height, p.x, p.y + 2, 15, 46, false, a); return; }
  const [, ax, ay] = ASSETS.houses[+p.k[1]], im = IMG[p.k];
  drawSpr(im, 0, 0, im.width, im.height, p.x, p.y, ax, ay, false, a);
}
function drawHero() {
  const h = hero; shadow(h.x, h.y, 10);
  if (h.inv > 0 && h.st !== 'roll' && Math.floor(h.inv * 20) % 2) return;
  const fi = frameOf(h);
  drawSpr(IMG.hero, fi * FW, 0, FW, FH, h.x, h.y, AX, AY, h.f < 0);
}
function drawZ(z) {
  const hop = (z.st === 'move' && !z.stun && mode !== 'B') || mode === 'B' ? Math.max(0, Math.sin(z.t * 7 + z.hop)) * 4 : 0;
  shadow(z.x, z.y, 9);
  const wind = z.st === 'wind', img = wind || z.st === 'strike' ? IMG.z2 : IMG.z1;
  const a = z.dead ? Math.max(0, 1 - z.t * 2) : 1;
  drawSpr(img, 0, 0, img.width, img.height, z.x, z.y - hop + (img === IMG.z2 ? 5 : 0), 14, img.height, z.f < 0, a, z.flash > 0);
  if (wind) { ctx.fillStyle = '#e03a2a'; ctx.fillRect(z.x - 1, z.y - 44, 3, 6); ctx.fillRect(z.x - 1, z.y - 36, 3, 2); }
  if (!z.dead && M.hp > 1) { ctx.fillStyle = '#18101e'; ctx.fillRect(z.x - 8, z.y - 40 - (wind ? 10 : 0), 16, 3); ctx.fillStyle = '#7ad06a'; ctx.fillRect(z.x - 7, z.y - 39 - (wind ? 10 : 0), 14 * z.hp / M.hp, 1); }
}

function fit() { cv.width = innerWidth; cv.height = innerHeight; }
addEventListener('resize', fit); fit();
let last = performance.now();
function loop(t) { const dt = Math.min(.033, (t - last) / 1000); last = t; update(dt); draw(); requestAnimationFrame(loop); }
reset('A'); ui(); requestAnimationFrame(loop);
