// 无名之辈 · 序章「黄巾劫村」—— 宽地面清版
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const IMG = {};
function load(k, src) { const i = new Image(); i.src = src; IMG[k] = i; return i; }
load('far', BG.far); load('mid', BG.mid); load('gnd', BG.gnd);
Object.entries(ASSETS.props).forEach(([k, v]) => load('p_' + k, v[0]));
// 角色像素图：CH[角色][帧] = { img, w, h, ax, ay, white }
const CH = {};
for (const [name, frames] of Object.entries(ASSETS.chars)) {
  CH[name] = {};
  for (const [f, [src, w, h, ax, ay]] of Object.entries(frames)) {
    const fr = { img: load(name + '_' + f, src), w, h, ax, ay, white: null };
    fr.img.onload = () => {   // 预先做一张白色剪影，用于受击闪白
      const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
      g.drawImage(fr.img, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); fr.white = c;
    };
    CH[name][f] = fr;
  }
}
const PX = 0.5;   // 1 个精灵像素 = 0.5 世界单位（72 像素高 ≈ 36 世界单位）
const PROP_POOL = ['hay', 'hay', 'well', 'mill', 'cart', 'flag'];

const WEAP = {
  staff: { name: '棍', dur: [.14, .1, .16], reach: 40, dy: 12, multi: true, kb: 70 },
  knife: { name: '柴刀', dur: [.06, .08, .1], reach: 30, dy: 10, multi: false, kb: 40 },
  stone: { name: '石子', dur: [.08, .07, .12], proj: true, kb: 30 },
};
// 黄巾兵
const TYPES = {
  grunt:   { name: '喽啰', hp: 3, spd: 38, wind: .45, reach: 26, dmg: 1 },
  blade:   { name: '刀手', hp: 6, spd: 30, wind: .7, reach: 32, dmg: 2, heavy: true },
  slinger: { name: '投石手', hp: 2, spd: 40, wind: .6, ranged: 'stone', range: [90, 150], cd: 2.4 },
  archer:  { name: '弓箭手', hp: 2, spd: 34, wind: .85, ranged: 'fire', range: [120, 190], cd: 3.2 },
};
const WAVES = [
  { say: '黄巾喽啰来了！J 攻击，连按三连击', units: ['grunt', 'grunt', 'grunt'] },
  { say: '刀手举刀时头上会冒「!」—— 按 K 翻滚躲开！', units: ['grunt', 'grunt', 'blade', 'blade'] },
  { say: '后排的投石手会扔石头，冲过去收拾他！', units: ['grunt', 'slinger', 'slinger', 'blade', 'grunt'] },
  { say: '弓箭手射火箭！看到地上的红圈快躲开', units: ['grunt', 'blade', 'archer', 'archer', 'slinger', 'grunt'] },
];
const M = { viewH: 300, W: 2400, top: 168, bot: 290, gates: [330, 900, 1470, 2040], token: 2 };
let hero, zs, shots, eshots, fires, props, cam, gateI, lockR, kills, msg, msgT, freeze, shake, weapon = 'knife', over, won;
const rnd = (a, b) => a + Math.random() * (b - a);

function reset() {
  hero = { x: 60, y: (M.top + M.bot) / 2, f: 1, hp: 10, st: 'idle', t: 0, inv: 0, rollCd: 0, atk: null, q: 0, combo: 0, vx: 0 };
  zs = []; shots = []; eshots = []; fires = []; props = []; cam = { x: 0, y: 0 }; gateI = 0; lockR = Infinity; kills = 0; freeze = 0; shake = 0; over = false; won = false;
  for (let x = 160; x < M.W - 100; x += rnd(130, 220)) {
    const k = PROP_POOL[Math.floor(Math.random() * PROP_POOL.length)], [, pw, ph] = ASSETS.props[k];
    props.push({ g: k, x, y: rnd(M.top + 24, M.bot - 8), solid: true, w: k === 'flag' ? 4 : pw * .75, h: ph });
  }
  props.push({ g: 'gate', x: M.W - 110, y: M.top + 70 });   // 村口门楼（可穿过）
  say('村子被黄巾贼烧了！往右走 →');
}
function say(s, t = 3) { msg = s; msgT = t; }

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
document.getElementById('bA').addEventListener('pointerdown', e => { e.preventDefault(); if (over) reset(); else pressAtk = true; });
document.getElementById('bR').addEventListener('pointerdown', e => { e.preventDefault(); pressRoll = true; });
document.querySelectorAll('[data-w]').forEach(b => b.onclick = () => setW(b.dataset.w));
function setW(w) { weapon = w; ui(); }
function ui() { document.querySelectorAll('[data-w]').forEach(b => b.classList.toggle('on', b.dataset.w === weapon)); }

// ---------- 碰撞 ----------
function blocked(x, y) {
  for (const p of props) if (p.solid && Math.abs(x - p.x) < p.w / 2 && y > p.y - 6 && y < p.y + 2) return true;
  return false;
}
function moveEnt(e, dx, dy) {
  e.bx = false;
  if (!blocked(e.x + dx, e.y)) e.x += dx; else e.bx = true;
  if (!blocked(e.x, e.y + dy)) e.y += dy;
  e.y = Math.max(M.top, Math.min(M.bot, e.y)); e.x = Math.max(10, Math.min(M.W - 10, e.x));
}

// ---------- 刷怪 ----------
function viewW() { return cv.width / (cv.height / M.viewH); }
function spawn(type, x, y) {
  const T = TYPES[type];
  zs.push({ type, T, x, y, f: -1, hp: T.hp, st: 'move', t: rnd(0, 1), stun: 0, flash: 0, vx: 0, tok: false, cd: rnd(.8, 2), slot: zs.length });
}
function waves() {
  const vw = viewW();
  if (lockR < Infinity && zs.length === 0) {
    lockR = Infinity; gateI++;
    if (gateI < M.gates.length) say('区域清空！GO →'); else { won = true; say('村子里的黄巾贼被打退了！（序章待续 · 按 R 再来）', 99); }
  }
  if (lockR === Infinity && gateI < M.gates.length && hero.x > M.gates[gateI]) {
    const gx = M.gates[gateI], W = WAVES[gateI]; lockR = gx + vw * 0.6;
    W.units.forEach((u, i) => {
      const left = i === W.units.length - 1 && W.units.length > 3 && !TYPES[u].ranged;
      spawn(u, left ? cam.x + 5 : lockR - rnd(5, 40) - i * 8, rnd(M.top + 6, M.bot - 6));
    });
    say(W.say, 4);
  }
}

// ---------- 主角 ----------
function hit(z, dmg, kb, dir, knock) {
  if (z.dead || z.air) return;
  z.hp -= dmg; z.flash = .1; z.stun = z.T.heavy && z.st === 'wind' ? 0 : .35; z.vx = kb * dir * (z.T.heavy ? .6 : 1);
  if (z.stun) { z.st = 'move'; z.tok = false; }
  freeze = .05; shake = .1;
  if (z.hp <= 0) { z.dead = 1; kills++; knock = true; }
  if (knock) launch(z, dir * (z.dead ? 110 : 80) * (z.T.heavy ? .7 : 1), z.dead ? 130 : 105);
}
// 击飞：腾空 → 落地弹一下 → （敌人）爬起 /（死亡）倒地消失
function launch(e, vx, vz) { e.air = true; e.z = 0.1; e.vz = vz; e.ax = vx; e.st = 'air'; e.t = 0; e.tok = false; e.stun = 0; }
function airStep(e, dt) {
  e.z += e.vz * dt; e.vz -= 420 * dt; moveEnt(e, e.ax * dt, 0);
  if (e.z <= 0 && e.vz < 0) { e.z = 0; e.air = false; e.st = 'land'; e.t = 0; shake = Math.max(shake, .08); }
}
function heroUpdate(dt) {
  const h = hero;
  h.inv = Math.max(0, h.inv - dt); h.rollCd = Math.max(0, h.rollCd - dt); h.t += dt;
  if (h.st === 'down') return;
  if (h.air) { airStep(h, dt); pressAtk = pressRoll = false; return; }
  if (h.st === 'land') { set(h, over ? 'down' : 'bounce'); }
  if (h.st === 'bounce') { if (h.t > .3) set(h, 'getup'); pressAtk = pressRoll = false; return; }
  if (h.st === 'getup') { if (h.t > .35) { set(h, 'idle'); h.inv = .5; } pressAtk = pressRoll = false; return; }
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
  if (h.st === 'roll') { moveEnt(h, h.rx * 150 * dt, h.ry * 105 * dt); if (h.t > .4) set(h, 'idle'); pressAtk = false; return; }
  if (pressAtk) { if (h.st === 'atk') h.q = 1; else startAtk(); pressAtk = false; }
  if (h.st === 'atk') {
    const W = WEAP[weapon], a = h.atk; a.t += dt;
    if (a.fi === 0 && a.t >= W.dur[0]) { a.fi = 1; a.t = 0; strike(); }
    else if (a.fi === 1 && a.t >= W.dur[1]) { a.fi = 2; a.t = 0; }
    else if (a.fi === 2 && a.t >= W.dur[2]) { if (h.q) { h.q = 0; h.combo = (h.combo + 1) % 3; startAtk(true); } else { h.combo = 0; set(h, 'idle'); } }
    if (ix && a.fi === 0) h.f = Math.sign(ix);
    moveEnt(h, ix * 15 * dt, 0);
    return;
  }
  if (ix || iy) { if (h.st !== 'walk') set(h, 'walk'); if (ix) h.f = Math.sign(ix); moveEnt(h, ix * 70 * dt, iy * 52 * dt); }
  else if (h.st !== 'idle') set(h, 'idle');
  if (lockR < Infinity) { const wall = lockR - viewW() * .2; if (h.x >= wall - .5 && ix > 0 && msgT < 0) say(`清空本区域的敌人才能继续前进（还剩 ${zs.filter(z => !z.dead).length} 个）`); h.x = Math.min(h.x, wall); }
}
function set(e, st) { e.st = st; e.t = 0; }
function startAtk(keep) { set(hero, 'atk'); hero.atk = { fi: 0, t: 0 }; if (!keep) hero.combo = 0; }
function strike() {
  const h = hero, W = WEAP[weapon], fin = h.combo === 2;
  if (W.proj) { shots.push({ x: h.x + h.f * 18, y: h.y, z: 24, vx: h.f * 240, life: .8 }); return; }
  for (const z of zs) {
    if (z.dead) continue;
    const dx = (z.x - h.x) * h.f;
    if (dx > -4 && dx < W.reach && Math.abs(z.y - h.y) < W.dy) { hit(z, fin ? 2 : 1, fin ? W.kb * 2 : W.kb, h.f, fin); if (!W.multi) break; }
  }
}
function dmgHero(n, from) {
  const h = hero; if (h.inv > 0 || h.air || h.st === 'down' || h.st === 'bounce' || h.st === 'getup' || over) return;
  h.hp -= n; h.inv = .7; shake = .2; h.atk = null;
  const dir = from ? Math.sign(h.x - from.x) || -h.f : -h.f;
  if (n >= 2 || h.hp <= 0) { launch(h, dir * 85, 120); h.f = -dir; h.inv = 9; }   // 重击：被打飞
  else { set(h, 'hurt'); h.vx = dir * 80; }
  if (h.hp <= 0) { over = true; say('倒下了…… 按 R 或「攻击」重来', 99); }
}

// ---------- 黄巾兵 AI ----------
function zUpdate(z, dt) {
  const T = z.T;
  z.t += dt; z.flash = Math.max(0, z.flash - dt); z.cd -= dt;
  if (z.air) { airStep(z, dt); return; }
  if (z.st === 'land') { if (z.t > .45) { if (z.dead) { z.st = 'gone'; z.t = 0; } else set(z, 'move'); } return; }
  if (z.dead) return;
  if (z.stun > 0) { z.stun -= dt; moveEnt(z, z.vx * dt, 0); z.vx *= .85; return; }
  if (Math.abs(z.vx) > 1) { moveEnt(z, z.vx * dt, 0); z.vx *= .85; }
  const dx = hero.x - z.x, dy = hero.y - z.y;
  if (z.st === 'wind') {
    if (z.t > T.wind) {
      set(z, 'strike');
      if (T.ranged === 'stone') eshots.push({ k: 'stone', x: z.x + z.f * 16, y: z.y, z: 24, vx: z.f * 190, life: 1.4 });
      else if (T.ranged === 'fire') { const tx = hero.x, ty = hero.y; eshots.push({ k: 'fire', x0: z.x + z.f * 16, y0: z.y, tx, ty, t: 0, T: .9 }); }
      else if (Math.abs(dx) < T.reach && Math.abs(dy) < 9 && Math.sign(dx) === z.f) dmgHero(T.dmg, z);
    }
    return;
  }
  if (z.st === 'strike') { if (!T.ranged) moveEnt(z, z.f * 40 * dt, 0); if (z.t > .25) set(z, 'rec'); return; }
  if (z.st === 'rec') { if (z.t > (T.ranged ? .4 : .7)) { z.tok = false; set(z, 'move'); } return; }
  z.f = Math.sign(dx) || z.f;
  let tx, ty;
  if (T.ranged) {   // 远程：和主角保持距离，站到差不多同一条线上
    const side = Math.sign(z.x - hero.x) || 1, want = (T.range[0] + T.range[1]) / 2;
    tx = hero.x + side * want; ty = hero.y + (z.slot % 2 ? 10 : -10);
    tx = Math.max(cam.x + 30, Math.min(tx, (lockR < Infinity ? lockR : cam.x + viewW()) - 30));
    const ad = Math.abs(dx);
    if (z.cd <= 0 && ad > T.range[0] * .7 && ad < T.range[1] * 1.2 && Math.abs(dy) < (T.ranged === 'stone' ? 14 : 60)) { set(z, 'wind'); z.cd = T.cd; return; }
  } else {          // 近战：最多 M.token 个同时贴身，其余在旁边游走
    const tokens = zs.filter(o => o.tok && !o.dead).length;
    if (!z.tok && tokens < M.token && Math.abs(dx) < 130) z.tok = true;
    tx = hero.x - z.f * (z.tok ? T.reach - 6 : 52 + (z.slot % 3) * 14); ty = hero.y + (z.tok ? 0 : (z.slot % 2 ? 16 : -16));
    if (z.tok && Math.abs(dx) < T.reach && Math.abs(dy) < 7) { set(z, 'wind'); return; }
  }
  const mx = tx - z.x, my = ty - z.y, l = Math.hypot(mx, my);
  z.moving = l > 4;
  if (z.moving) {
    const sp = T.spd * (Math.abs(dx) > 150 ? 1.8 : 1);   // 离得远时快步冲过来
    moveEnt(z, mx / l * sp * dt, my / l * sp * .7 * dt);
    if (z.bx) moveEnt(z, 0, (z.slot % 2 ? 1 : -1) * T.spd * dt);   // 被草垛等挡住时上下绕开
  }
}

// ---------- 投射物、火 ----------
function updateShots(dt) {
  for (const s of shots) {
    s.x += s.vx * dt; s.life -= dt;
    for (const z of zs) if (!z.dead && Math.abs(z.x - s.x) < 10 && Math.abs(z.y - s.y) < 10 && s.life > 0) { hit(z, 1, WEAP.stone.kb, Math.sign(s.vx)); s.life = 0; }
  }
  shots = shots.filter(s => s.life > 0);
  for (const s of eshots) {
    if (s.k === 'stone') {
      s.x += s.vx * dt; s.life -= dt;
      if (s.life > 0 && hero.inv <= 0 && Math.abs(hero.x - s.x) < 8 && Math.abs(hero.y - s.y) < 9) { dmgHero(1, { x: s.x - s.vx }); s.life = 0; }
    } else {
      s.t += dt;
      if (s.t >= s.T) { fires.push({ x: s.tx, y: s.ty, t: 3, r: 16 }); s.life = 0; } else s.life = 1;
    }
  }
  eshots = eshots.filter(s => s.life > 0);
  for (const f of fires) {
    f.t -= dt;
    if (Math.abs(hero.x - f.x) < f.r && Math.abs(hero.y - f.y) < f.r * .45) dmgHero(1, null);
  }
  fires = fires.filter(f => f.t > 0);
}

function update(dt) {
  if (freeze > 0) { freeze -= dt; return; }
  heroUpdate(dt); waves();
  zs.forEach(z => zUpdate(z, dt));
  zs = zs.filter(z => !(z.st === 'gone' && z.t > .9));
  updateShots(dt);
  const vw = viewW();
  let tx = hero.x - vw * .4;
  if (lockR < Infinity) tx = Math.min(tx, lockR - vw);
  cam.x += (Math.max(0, Math.min(M.W - vw, tx)) - cam.x) * Math.min(1, dt * 6);
  shake = Math.max(0, shake - dt); msgT -= dt;
}

// ---------- 绘制 ----------
let SC = 3, OXs = 0;
function tileLayer(img, s, par, y) {
  if (!img.complete || !img.width) return;
  const tw = img.width * s, th = img.height * s, vw = viewW(), ox = cam.x * (1 - par);
  for (let i = Math.floor((cam.x - ox) / tw) - 1; i * tw + ox < cam.x + vw; i++) {
    const x = i * tw + ox;
    ctx.save(); ctx.translate(x + (i & 1 ? tw : 0), y); ctx.scale(i & 1 ? -1 : 1, 1);
    ctx.drawImage(img, 0, 0, tw + .5, th); ctx.restore();
  }
}
function shadow(x, y, r) { ctx.fillStyle = 'rgba(40,30,30,.3)'; ctx.beginPath(); ctx.ellipse(x, y, r, r * .3, 0, 0, 7); ctx.fill(); }
// 像素角色在屏幕坐标里按整数倍放大绘制，保证像素清晰
function drawChar(name, f, x, y, flip, alpha = 1, white = false) {
  const fr = CH[name] && CH[name][f]; if (!fr || !fr.img.complete) return;
  const sp = Math.max(1, Math.round(SC * PX));
  const sx = Math.round(x * SC + OXs), sy = Math.round(y * SC);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, sx, sy); if (flip) ctx.scale(-1, 1);
  ctx.globalAlpha = alpha;
  ctx.drawImage(white && fr.white ? fr.white : fr.img, -fr.ax * sp, -fr.ay * sp, fr.w * sp, fr.h * sp);
  ctx.restore();
}
function heroFrame(h) {
  if (h.st === 'atk') return weapon + (h.atk.fi === 0 ? 1 : 2);
  if (h.st === 'roll') return Math.floor(h.t * 15) % 2 ? 'roll2' : 'roll1';
  if (h.air) return h.vz > 0 ? 'fly1' : 'fly2';
  if (h.st === 'bounce' || h.st === 'getup') return h.st;
  if (h.st === 'walk') return weapon + 'w' + [1, 2, 3, 2][Math.floor(h.t * 8) % 4];
  if (h.st === 'hurt') return 'hurt'; if (h.st === 'down') return 'down';
  return weapon + '0';
}
function zFrame(z) {
  if (z.air) return z.vz > 0 ? 'fly1' : 'fly2';
  if (z.st === 'land') return 'land';
  if (z.dead) return 'down';
  if (z.stun > 0) return 'hurt';
  if (z.st === 'wind') return 'wind';
  if (z.st === 'strike') return 'strike';
  if (z.st === 'rec') return z.T.ranged ? 'idle' : 'strike';
  return z.moving ? (Math.floor(z.t * 6) % 2 ? 'walk1' : 'walk2') : 'idle';
}
function draw() {
  const W = cv.width, H = cv.height; SC = H / M.viewH;
  const sk = shake > 0 ? rnd(-2, 2) : 0;
  OXs = Math.round(-cam.x * SC + sk);
  ctx.setTransform(SC, 0, 0, SC, OXs, 0); ctx.imageSmoothingEnabled = true;
  const vw = viewW(), ms = .24 / .61, my = 165 - 619 * .24;
  tileLayer(IMG.far, .577, .3, 0);
  tileLayer(IMG.gnd, .62, 1, my + 560 * ms);
  tileLayer(IMG.mid, ms, 1, my);
  ctx.imageSmoothingEnabled = false;
  // 火
  const now = performance.now() / 100;
  for (const f of fires) {
    const a = Math.min(1, f.t);
    ctx.fillStyle = `rgba(255,120,20,${.25 * a})`; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * .4, 0, 0, 7); ctx.fill();
    for (let k = 0; k < 7; k++) {
      const fx = f.x + Math.sin(k * 2.3) * f.r * .75, fy = f.y + Math.cos(k * 1.7) * f.r * .25, hgt = 6 + Math.sin(now + k) * 2.5;
      ctx.fillStyle = `rgba(255,${150 + k * 12},40,${.9 * a})`; ctx.beginPath(); ctx.moveTo(fx - 2.5, fy); ctx.lineTo(fx, fy - hgt); ctx.lineTo(fx + 2.5, fy); ctx.fill();
    }
  }
  // 火箭落点预警
  for (const s of eshots) if (s.k === 'fire') {
    const p = s.t / s.T;
    ctx.strokeStyle = `rgba(230,40,30,${.4 + .5 * p})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(s.tx, s.ty, 16 * (1.3 - p * .3), 6 * (1.3 - p * .3), 0, 0, 7); ctx.stroke();
  }
  // 区域锁红旗
  if (lockR < Infinity) {
    const wx = lockR - vw * .2 + 12, t = performance.now() / 300;
    ctx.fillStyle = 'rgba(200,40,30,.18)'; ctx.fillRect(wx - 3, M.top, 6, M.bot - M.top + 8);
    for (let y = M.top + 4; y <= M.bot + 4; y += 18) {
      ctx.fillStyle = '#3a2418'; ctx.fillRect(wx - 1, y - 16, 2, 16);
      ctx.fillStyle = '#c8281e'; ctx.beginPath(); ctx.moveTo(wx + 1, y - 16); ctx.lineTo(wx + 10 + Math.sin(t + y) * 1.5, y - 13); ctx.lineTo(wx + 1, y - 10); ctx.fill();
    }
  }
  // 按 y 排序绘制
  const list = [];
  for (const p of props) list.push({ y: p.y, d: () => drawProp(p) });
  for (const z of zs) list.push({ y: z.y, d: () => drawZ(z) });
  list.push({ y: hero.y, d: drawHero });
  for (const s of shots) list.push({ y: s.y + .1, d: () => stone(s.x, s.y - s.z) });
  for (const s of eshots) {
    if (s.k === 'stone') list.push({ y: s.y + .1, d: () => { shadow(s.x, s.y, 3); stone(s.x, s.y - s.z); } });
    else {
      const p = Math.min(1, s.t / s.T), x = s.x0 + (s.tx - s.x0) * p, gy = s.y0 + (s.ty - s.y0) * p, z = 24 + Math.sin(p * Math.PI) * 60;
      list.push({ y: gy, d: () => { shadow(x, gy, 3); const ang = Math.atan2((s.ty - s.y0) / s.T - Math.cos(p * Math.PI) * 60 * Math.PI / s.T, (s.tx - s.x0) / s.T); ctx.save(); ctx.translate(x, gy - z); ctx.rotate(ang); ctx.fillStyle = '#4a2c16'; ctx.fillRect(-7, -.5, 10, 1); ctx.fillStyle = '#ffb02e'; ctx.fillRect(3, -1.5, 3, 3); ctx.fillStyle = '#ff5a1e'; ctx.fillRect(5, -1, 2, 2); ctx.restore(); } });
    }
  }
  list.sort((a, b) => a.y - b.y).forEach(o => o.d());
  // HUD
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const bw = Math.min(260, W * .4);
  ctx.fillStyle = 'rgba(20,14,30,.7)'; ctx.fillRect(14, 64, bw + 6, 18);
  ctx.fillStyle = '#d23c30'; ctx.fillRect(17, 67, bw * Math.max(0, Math.min(10, hero.hp)) / 10, 12);
  ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(14, 84, 200, 22); ctx.fillStyle = '#222'; ctx.font = 'bold 15px sans-serif'; ctx.fillText(`击倒 ${kills}   武器：${WEAP[weapon].name}`, 20, 100);
  if (lockR < Infinity) { const n = zs.filter(z => !z.dead).length; ctx.fillStyle = 'rgba(200,40,30,.85)'; ctx.fillRect(14, 110, 200, 22); ctx.fillStyle = '#fff'; ctx.fillText(`本区域剩余敌人：${n}`, 20, 126); }
  if (msgT > 0) { ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(20,14,30,.75)'; const tw = ctx.measureText(msg).width; ctx.fillRect(W / 2 - tw / 2 - 12, 108, tw + 24, 32); ctx.fillStyle = '#ffd86e'; ctx.fillText(msg, W / 2, 130); ctx.textAlign = 'left'; }
}
function stone(x, y) { ctx.fillStyle = '#2a2234'; ctx.fillRect(x - 2, y - 2, 4, 4); ctx.fillStyle = '#9a9ea8'; ctx.fillRect(x - 1, y - 1.5, 2, 2); }
function drawProp(p) {
  const [, w, h] = ASSETS.props[p.g];
  const a = p.solid && hero.y < p.y && hero.y > p.y - h + 6 && Math.abs(hero.x - p.x) < w / 2 + 4 ? .5 : 1;
  ctx.save(); ctx.globalAlpha = a; ctx.imageSmoothingEnabled = true;
  ctx.drawImage(IMG['p_' + p.g], Math.round(p.x - w / 2), Math.round(p.y + 2 - h), w, h);
  ctx.restore();
}
function drawHero() {
  const h = hero; shadow(h.x, h.y, 10);
  if (h.inv > 0 && h.inv < 2 && h.st !== 'roll' && h.st !== 'down' && Math.floor(h.inv * 20) % 2) return;
  drawChar('hero', heroFrame(h), h.x, h.y - (h.z || 0), h.f < 0);
}
function drawZ(z) {
  shadow(z.x, z.y, 10);
  const a = z.st === 'gone' ? Math.max(0, 1 - z.t * 1.2) * (Math.floor(z.t * 12) % 2 ? .4 : 1) : 1;
  drawChar(z.type, zFrame(z), z.x, z.y - (z.z || 0), z.f < 0, a, z.flash > 0);
  if (z.dead || z.air || z.st === 'land') return;
  const top = z.y - 42;
  if (z.st === 'wind' && !z.T.ranged) { ctx.fillStyle = '#e03a2a'; ctx.fillRect(z.x - 1, top - 10, 3, 6); ctx.fillRect(z.x - 1, top - 2.5, 3, 2); }
  ctx.fillStyle = '#18101e'; ctx.fillRect(z.x - 9, top, 18, 3); ctx.fillStyle = z.T.heavy ? '#e0a030' : '#7ad06a'; ctx.fillRect(z.x - 8, top + 1, 16 * z.hp / z.T.hp, 1);
}

function fit() { cv.width = innerWidth; cv.height = innerHeight; }
addEventListener('resize', fit); fit();
let last = performance.now();
function loop(t) { const dt = Math.min(.033, (t - last) / 1000); last = t; update(dt); draw(); requestAnimationFrame(loop); }
reset(); ui(); requestAnimationFrame(loop);
