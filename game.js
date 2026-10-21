// 无名之辈 · 序章「黄巾劫村」—— 宽地面清版
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const IMG = {};
function load(k, src) { const i = new Image(); i.src = src; IMG[k] = i; return i; }
load('far', BG.far); load('mid', BG.mid); load('gnd', BG.gnd);
Object.entries(ASSETS.props).forEach(([k, v]) => load('p_' + k, v[0]));
Object.entries(ASSETS.food || {}).forEach(([k, v]) => load('food_' + k, v[0]));
Object.entries(ASSETS.ui || {}).forEach(([k, v]) => load('ui_' + k, v));
// 角色像素图：CH[角色][帧] = { img, w, h, ax, ay, white }
const CH = {};
for (const [name, frames] of Object.entries(ASSETS.chars)) {
  CH[name] = {};
  for (const [f, [src, w, h, ax, ay]] of Object.entries(frames)) {
    const fr = { img: load(name + '_' + f, src), w, h, ax, ay, white: null };
    fr.dark = null;   // 深色剪影（精英兵用）
    fr.img.onload = () => {   // 预先做一张白色剪影，用于受击闪白
      const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
      g.drawImage(fr.img, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); fr.white = c;
      const d = document.createElement('canvas'); d.width = w; d.height = h; const dg = d.getContext('2d');
      dg.drawImage(fr.img, 0, 0); dg.globalCompositeOperation = 'source-atop'; dg.fillStyle = 'rgba(18,10,6,.55)'; dg.fillRect(0, 0, w, h); fr.dark = d;
    };
    CH[name][f] = fr;
  }
}
const PX = 0.4;   // 1 个精灵像素 = 0.4 世界单位
const PROP_POOL = ['hay', 'hay', 'well', 'cart'];   // 去掉地上的黄旗道具：和旗手的大旗太像，容易看成一个人拿两面旗   // 道具尺寸直接写在 art/props/meta.json（已按 1.6 倍放大）

// 三段连招：f = 帧序列，d = 每帧时长，最后一帧开始时出手判定。
// 连招规则：上一下打中敌人，才能接下一下；打空就从第一下重来。
// 平衡：锤子距离最短、伤害最高，出手带前冲、命中必打断敌人蓄力；木棍距离长、能打晕、第三下横扫多人；
// 石子射得远但出手慢、伤害最低，只能用来先削血（射程压到比弓箭手近，逼你往前压）。
const WEAP = {
  // move: .5 = 出手期间保留一半移动速度（35 单位/秒），能边走边扫，不会僵在原地；
  // 后摇从 .24/.24/.30 收到 .20/.20/.26，收招更利索（一轮 1.24 → 1.12 秒）
  // 棍子 = 控场：距离最长（40）、伤害中等，但每一下都有机会把敌人打晕，第三下横扫必定打晕全场；
  // 被打晕的敌人（头上转星星）吃 1.5 倍伤害 —— 所以「棍子打晕 → 换锤子收尾」是一套成立的打法。
  // 棍子 = 长距离控场。三段动作按武术的「劈 → 扫 → 回身扫」重排：
  // 每段都缩短了前摇、拉长了命中帧，出手更干脆；击退加大，让敌人有明确的被打到感。
  staff: { name: '棍', reach: 40, dy: 13, move: .5, freeze: .062, combo: [
    { f: ['staff_1a', 'staff_1b'], d: [.13, .19], dmg: 1.1, kb: 52, daze: .3 },                   // 劈：举棍过顶 → 砸下
    { f: ['staff_2a', 'staff_2b'], d: [.11, .19], dmg: 1.1, kb: 46, daze: .45 },                  // 扫：低身搂扫
    { f: ['staff_3a', 'staff_3b'], d: [.16, .25], dmg: 1.8, kb: 150, daze: 1, multi: true, knock: true },   // 回身扫（必晕）
    { f: ['staffp_a', 'staffp_b'], d: [.10, .24], dmg: 1.2, kb: 90, daze: .5, thrust: true },          // 戳：前刺收尾（更长、更快）
  ] },
  // lunge/lungeT：出手时朝面向方向前冲一小段（补足短距离）；interrupt：命中必打断敌人正在蓄力的攻击（含刀手）
  // 攻速：一轮 1.30 秒，比棍子的 1.12 秒慢——伤害是棍子的 1.6 倍，靠"慢"来付账
  // move: 0：出手期间站定不动（只保留开头那一下前冲），砸下去人不能跟着滑，重量感更足
  hammer: { name: '锤子', reach: 25, dy: 10, snd: 'staff', lunge: 110, lungeT: .12, interrupt: true, move: 0, combo: [
    { f: ['hammer_1a', 'hammer_1b'], d: [.14, .24], dmg: 1.5, kb: 30 },                           // 举锤下砸
    { f: ['hammer_2a', 'hammer_2b'], d: [.13, .24], dmg: 1.5, kb: 30 },                           // 反手横抡
    { f: ['hammer_3a', 'hammer_3b', 'hammer_3c'], d: [.16, .09, .30], dmg: 2.6, kb: 70, multi: true, both: true, knock: true },   // 转身回旋锤（前后都打）
  ] },
  // move：出手期间的移动倍率（0 = 定住，1 = 全速）；石子边走边扔所以是 1
  // 射程：普通投约 149（和投石手的 150 打平），弓箭手 190 仍然比你远，还是得往前压
  stone: { name: '石子', proj: true, move: 1, combo: [
    { f: ['stone_1a', 'stone_1b'], d: [.09, .21], dmg: .6, kb: 40, spd: 230, life: .78 },        // 左手扔（射程约 179）
    { f: ['stone_2a', 'stone_2b'], d: [.09, .21], dmg: .6, kb: 40, spd: 230, life: .78 },        // 右手扔（射程约 179）
    { f: ['stone_3a', 'stone_3b', 'stone_3c'], d: [.18, .07, .28], dmg: 1.2, kb: 70, spd: 310, life: .8, pierce: true },   // 全力投（穿透）：射程约 248
  ] },
};
// 黄巾兵
const TYPES = {
  grunt:   { name: '喽啰', hp: 3, spd: 38, wind: .45, reach: 22, dmg: 1, scale: .86 },
  blade:   { name: '刀手', hp: 6, spd: 30, wind: .7, reach: 27, dmg: 2, heavy: true, scale: .92 },
  slinger: { name: '投石手', hp: 2, spd: 40, wind: .6, ranged: 'stone', range: [80, 130], cd: 2.4, scale: .88 },
  archer:  { name: '弓箭手', hp: 2, spd: 34, wind: .85, ranged: 'fire', range: [120, 190], cd: 3.2, scale: .92 },
  elite:   { name: '老卒', hp: 12, spd: 26, wind: 1.05, reach: 30, dmg: 3, heavy: true, elite: true, w: 12, sprite: 'elite', scale: 1.05 },   // 精英：血厚、出手慢、打不断
  banner:  { name: '旗手', hp: 4, spd: 26, wind: .6, reach: 22, dmg: 1, banner: true, sprite: 'banner', scale: 1 },                     // 旗手：给周围小兵加速，优先击杀目标
};
const WAVES = [
  // 区域 1：纯教学，不随机
  { say: '黄巾喽啰来了！J 攻击，连按三连击', units: ['grunt', 'grunt', 'grunt', 'grunt'] },
  // 区域 2：刀手首次登场（固定 2 个），其余随机
  { say: '刀手举刀时头上会冒「!」—— 按 K 翻滚躲开！',
    core: ['grunt', 'grunt', 'blade', 'blade'], budget: 4, pool: ['grunt', 'blade'],
    extra: ['grunt', 'blade'], extraAt: 2, extraSay: '后面又冲上来一队！' },
  // 区域 3：旗手首次登场（固定 1 个），投石手固定 2 个
  { say: '那个扛「黄天当立」大旗的在给贼兵加速 —— 先杀他！',
    core: ['banner', 'slinger', 'slinger'], budget: 5, pool: ['grunt', 'blade', 'slinger'],
    extra: ['blade', 'grunt'], extraAt: 2 },
  // 区域 4：弓箭手固定 2 个
  { say: '弓箭手的火箭会点燃地面，看到红圈快躲开',
    core: ['grunt', 'blade', 'archer', 'archer', 'grunt'], budget: 6, pool: ['grunt', 'blade', 'slinger', 'archer'],
    extra: ['blade', 'blade'], extraAt: 2, extraSay: '还有埋伏！' },
  // 区域 5：老卒首次登场
  { say: '村尾那个披甲的老卒 —— 血厚、打不断，绕到背后打',
    core: ['elite'], budget: 7, pool: ['grunt', 'blade', 'slinger', 'archer'],
    extra: ['slinger', 'grunt'], extraAt: 1 },
  { boss: true },   // 村口：黄巾头目 管亥（js/boss.js）
];
// 威胁值：随机填充时按点数抽兵
const THREAT = { grunt: 1, blade: 2, slinger: 2, archer: 2, banner: 2, elite: 4 };
function rollFill(pool, budget) {
  const out = [];
  let left = budget;
  for (let guard = 0; guard < 40 && left > 0; guard++) {
    const ok = pool.filter(t => THREAT[t] <= left);
    if (!ok.length) break;
    const t = ok[Math.floor(Math.random() * ok.length)];
    out.push(t); left -= THREAT[t];
  }
  return out;
}
const M = { viewH: 300, W: 3600, top: 168, bot: 290, gates: [330, 900, 1450, 2000, 2500, 3000], token: 2 };
let hero, zs, shots, eshots, fires, props, propFx, cam, gateI, lockR, kills, msg, msgT, freeze, shake, weapon = 'hammer', over, won;
// 结算相关：本局用时、被打次数、通关后的结算数据、区域清空延迟、结算板按钮、提示条
let runT = 0, hitsTaken = 0, endT = 0, result = null, clearAt = 0, uiBtns = [], toastMsg = '', toastT = 0;
let drops = [], floaters = [], reviveUsed = false, pwaves = [];   // 掉落物 / 飘字 / 复活是否已用 / 棍子冲击波
let extraDone = false, bannerZ = null;                // 波中波是否补过 / 场上活着的旗手
const rnd = (a, b) => a + Math.random() * (b - a);
// 读锦囊数值（没抽卡时就是默认值）
const R_ = (k, d = 1) => (window.ROGUE && ROGUE.S[k] != null ? ROGUE.S[k] : d);
// 播放音效，按世界坐标 x 计算左右声道
function sfx(name, x) { if (window.SFX) SFX.play(name, x == null ? 0 : ((x - cam.x) / viewW()) * 2 - 1); }

function reset() {
  hero = { x: 60, y: (M.top + M.bot) / 2, f: 1, hp: 10, st: 'idle', t: 0, inv: 0, rollCd: 0, atk: null, q: 0, combo: 0, comboWin: 0, lastHit: -9, lastHitC: -1, lastShotC: 0, vx: 0 };
  zs = []; shots = []; eshots = []; fires = []; props = []; propFx = []; drops = []; floaters = []; pwaves = []; reviveUsed = false; extraDone = false; bannerZ = null; cam = { x: 0, y: 0 }; gateI = 0; lockR = Infinity; kills = 0; freeze = 0; shake = 0; over = false; won = false; if (window.Boss) Boss.reset();
  runT = 0; hitsTaken = 0; endT = 0; result = null; clearAt = 0; uiBtns = []; toastMsg = ''; toastT = 0;
  for (let x = 160; x < M.W - 100; x += rnd(200, 320)) {
    const k = PROP_POOL[Math.floor(Math.random() * PROP_POOL.length)], [, pw, ph] = ASSETS.props[k];
    // 草垛和推车有 3 点耐久可以打坏，水井和旗子打不坏（hp 0）
    props.push({ g: k, x, y: rnd(M.top + 24, M.bot - 8), solid: true, broken: false, hp: (k === 'hay' || k === 'cart') ? 3 : 0, hitT: 0, w: k === 'flag' ? 6 : pw * .75, h: ph });
  }
  say('村子被黄巾贼烧了！往右走 →');
}
function say(s, t = 3) { msg = s; msgT = t; }

// ---------- 输入 ----------
const key = {}; let joy = null, pressAtk = false, pressRoll = false;
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;   // 在标题页输入名字时别触发游戏按键
  if (window.TITLE && TITLE.blocks()) return;             // 标题/转场期间不响应游戏按键
  key[e.code] = 1;
  if (e.code === 'KeyJ') pressAtk = true;
  if (e.code === 'KeyK' || e.code === 'Space') pressRoll = true;
  if (e.code === 'Digit1') setW('staff'); if (e.code === 'Digit2') setW('hammer'); if (e.code === 'Digit3') setW('stone');
  if (e.code === 'KeyR') reset();
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => key[e.code] = 0);
const jz = document.getElementById('joy'), jk = document.getElementById('knob');
jz.addEventListener('pointerdown', e => { joy = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; jz.setPointerCapture(e.pointerId); });
jz.addEventListener('pointermove', e => { if (!joy || e.pointerId !== joy.id) return; let dx = e.clientX - joy.x, dy = e.clientY - joy.y, l = Math.hypot(dx, dy); if (l > 40) { dx *= 40 / l; dy *= 40 / l; } joy.dx = dx / 36; joy.dy = dy / 36; jk.style.transform = `translate(${dx}px,${dy}px)`; });
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
  if (e === hero && lockR < Infinity) e.x = Math.max(cam.x + 12, Math.min(e.x, cam.x + viewW() - 12));
}

// ---------- 刷怪 ----------
function viewW() { return cv.width / (cv.height / M.viewH); }
function spawn(type, x, y) {
  const T = TYPES[type];
  zs.push({ type, T, sprite: T.sprite || type, x, y, f: -1, hp: T.hp, st: 'move', t: rnd(0, 1), stun: 0, flash: 0, vx: 0, tok: false, cd: rnd(.8, 2), slot: zs.length,
    sc: T.scale || 1, dark: !!T.elite });
}
function waves() {
  const vw = viewW();
  // 区域清空：没有活着的敌人就算（尸体还躺在地上也算），等 1.4 秒让倒地/击飞演完再放行
  if (lockR < Infinity && !zs.some(z => !z.dead)) {
    if (!clearAt) clearAt = gameT + 1.4;
    if (gameT >= clearAt) {
      clearAt = 0; lockR = Infinity; gateI++;
      if (gateI < M.gates.length) say(WAVES[gateI].boss ? '前面是村口……小心！' : '区域清空！GO →');
      else won = true;
      if (!won && window.ROGUE) ROGUE.offer();   // 每清一个区域，抽一次锦囊   // 通关文案交给结算板，这里不再刷长句
    }
  }
  // 波中波：本区域还剩少量敌人时，从右侧再补一批（每区一次）
  if (lockR < Infinity && !extraDone) {
    const W = WAVES[gateI];
    if (W && W.extra) {
      const alive = zs.filter(z => !z.dead).length;
      if (alive <= (W.extraAt || 2)) {
        extraDone = true;
        W.extra.forEach((u2, i) => spawn(u2, lockR - rnd(8, 30) - i * 10, rnd(M.top + 6, M.bot - 6)));
        if (W.extraSay) say(W.extraSay, 2.4);
        else say('又冲上来一队！', 2.2);
      }
    }
  }
  if (lockR === Infinity && gateI < M.gates.length && hero.x > M.gates[gateI]) {
    const gx = M.gates[gateI], W = WAVES[gateI]; lockR = gx + vw * 0.6; clearAt = 0; extraDone = false;
    if (W.boss) { Boss.start(lockR); return; }
    const list = W.units || (W.core || []).concat(rollFill(W.pool || [], W.budget || 0));
    list.forEach((u, i) => {
      const left = i === list.length - 1 && list.length > 3 && !TYPES[u].ranged;   // 最后一个近战从左边包过来
      spawn(u, left ? cam.x + 5 : lockR - rnd(5, 40) - i * 8, rnd(M.top + 6, M.bot - 6));
    });
    say(W.say, 4);
  }
}

// ---------- 主角 ----------
function hit(z, dmg, kb, dir, knock, daze = 0, stun = .35, interrupt = false) {
  if (z.T.boss) return Boss.hit(z, dmg, dir);
  if (z.dead || z.air) return;
  hero.lastHit = gameT; hero.lastHitC = hero.atk ? hero.atk.c : hero.lastShotC;
  dmg *= R_('dmg');   // 锦囊：造成伤害倍率
  z.hp -= dmg * (z.daze > 0 ? 1.5 : 1);   // 被打晕的目标吃 1.5 倍伤害
  const ls = R_('lifesteal', 0);
  if (ls && gameT - (hero.leechT || -9) > 2) { hero.leechT = gameT; hero.hp = Math.min(10, hero.hp + ls); }
  z.flash = .1; z.stun = z.T.heavy && z.st === 'wind' && !interrupt ? 0 : stun; z.vx = kb * dir * (z.T.heavy ? .6 : 1);
  if (daze && !z.daze && Math.random() < daze * (z.T.heavy ? .5 : 1)) { z.daze = (z.T.heavy ? 1 : 1.5) * R_('daze'); z.st = 'move'; z.tok = false; }
  if (z.stun) { z.st = 'move'; z.tok = false; }
  // 命中定格：轻击短、重击长。棍子每下 1 点伤害只停 0.038 秒（原来一律 0.05，连打三下会显得一顿一顿的）
  const W0 = WEAP[weapon] || {};
  freeze = Math.min(.11, W0.freeze != null ? W0.freeze : .02 + dmg * .018);   // 棍子有单独的定格时长，打起来更"实"
  shake = Math.max(shake, .12);
  // 命中火花：几粒白/金色小碎块朝被击退方向溅出（复用碎屑系统）
  for (let i = 0; i < 6; i++) {
    const life = rnd(.1, .26);
    propFx.push({ x: z.x - dir * 6, y: z.y - rnd(12, 26), vx: rnd(-70, 70) - dir * 45, vy: rnd(-110, -20),
      w: rnd(1, 2.2), h: rnd(1, 2.2), life, max: life, c: Math.random() < .5 ? '#fffbe6' : '#ffdd7a' });
  }
  if (z.hp <= 0) {
    z.dead = 1; kills++; knock = true;
    if (z.T.elite) { spawnDrop(z.x - 8, z.y, 'leg'); spawnDrop(z.x + 12, z.y); sfx('finisher', z.x); shake = .2; }   // 精英必掉：至少一个中等
  }
  if (knock) launch(z, dir * (z.dead ? 110 : 80) * (z.T.heavy ? .7 : 1), z.dead ? 130 : 105);
}
// 击飞：腾空 → 落地弹一下 → （敌人）爬起 /（死亡）倒地消失
function launch(e, vx, vz) { e.air = true; e.z = 0.1; e.vz = vz; e.ax = vx; e.st = 'air'; e.t = 0; e.tok = false; e.stun = 0; e.daze = 0; }
function airStep(e, dt) {
  e.z += e.vz * dt; e.vz -= 420 * dt; moveEnt(e, e.ax * dt, 0);
  if (e.z <= 0 && e.vz < 0) { e.z = 0; e.air = false; e.st = 'land'; e.t = 0; shake = Math.max(shake, .08); sfx(e.dead ? 'enemyDown' : e === hero && over ? 'heroDown' : 'land', e.x); }
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
    sfx('roll', h.x);
    set(h, 'roll'); h.inv = .4; h.rollCd = .75; h.atk = null; h.q = 0;
    const d = Math.hypot(ix, iy) > 0.1 ? [ix, iy] : [h.f, 0]; const dl = Math.hypot(...d); h.rx = d[0] / dl; h.ry = d[1] / dl;
    if (Math.abs(h.rx) > .1) h.f = Math.sign(h.rx);
  }
  pressRoll = false;
  if (h.st === 'roll') { const rs = (window.Boss && Boss.wx && Boss.wx() === 'rain') ? 1.25 : 1; moveEnt(h, h.rx * 150 * rs * dt, h.ry * 105 * rs * dt); if (h.t > .4) set(h, 'idle'); pressAtk = false; return; }
  h.comboWin = Math.max(0, (h.comboWin || 0) - dt);
  if (pressAtk) { if (h.st === 'atk') h.q = 1; else startAtk(); pressAtk = false; }
  if (h.st === 'atk') {
    const W2 = WEAP[weapon], a = h.atk, C = W2.combo[a.c]; a.t += dt; a.lg += dt;
    if (a.t >= C.d[a.fi] * R_('aspd') * (window.Boss && Boss.wxAspd ? Boss.wxAspd() : 1)) {
      a.t = 0; a.fi++;
      if (a.fi === C.f.length - 1) strike();
      if (a.fi >= C.f.length) { h.combo = a.c; h.atk = null; h.comboWin = .45; if (h.q) { h.q = 0; startAtk(); } else set(h, 'idle'); return; }
    }
    if (ix && a.fi === 0) h.f = Math.sign(ix);
    // 锤子这类重型武器出手时朝面向方向前冲一小段（整段动作只冲一次），补足它短得可怜的攻击距离
    if (W2.lunge && a.lg < W2.lungeT) moveEnt(h, h.f * W2.lunge * dt, 0);
    // 出手时的移动：默认压到 15（有僵直）；像石子这种设了 move 的，按走路速度边走边扔（move = 1 即全速）
    if (W2.move != null) moveEnt(h, ix * 70 * W2.move * dt, iy * 52 * W2.move * dt);
    else moveEnt(h, ix * 15 * dt, 0);
    return;
  }
  if (ix || iy) { if (h.st !== 'walk') set(h, 'walk'); if (ix) h.f = Math.sign(ix); const mv = R_('move') * (window.Boss && Boss.wxMove ? Boss.wxMove() : 1); moveEnt(h, ix * 70 * mv * dt, iy * 52 * mv * dt); }
  else if (h.st !== 'idle') set(h, 'idle');
  if (lockR < Infinity) h.x = Math.max(cam.x + 12, Math.min(h.x, cam.x + viewW() - 12));
}
function set(e, st) { e.st = st; e.t = 0; }
// ---------- 可破坏的道具（草垛、推车） ----------
// 每被打中一次掉 1 点耐久；打坏后取消碰撞（p.solid = false）并从画面消失，水井/旗子 hp 为 0 不受影响
// 回血道具：包子 +1（70%）、鸡腿 +2（20%）、烤乳猪 +3（10%）
const FOOD = [
  { k: 'bun', heal: 1, w: 60 },   // 包子：最常见，回 1
  { k: 'leg', heal: 2, w: 30 },   // 鸡腿：中等，回 2
  { k: 'pig', heal: 4, w: 10 },   // 烤乳猪：稀有，回 4
];
function spawnDrop(x, y, forceK) {
  let pick;
  if (forceK) pick = FOOD.find(f => f.k === forceK) || FOOD[0];
  else {
    const r = Math.random() * 100;
    let acc = 0; pick = FOOD[0];
    for (const f of FOOD) { acc += f.w; if (r < acc) { pick = f; break; } }
  }
  drops.push({ k: pick.k, heal: pick.heal, x, y, y0: y, z: 10, vy: rnd(120, 190), t: 0, life: 8, got: 0 });
}
function updateDrops(dt) {
  const h = hero;
  for (const d of drops) {
    d.t += dt;
    // 弹跳落地
    if (d.z > 0 || d.vy) {
      d.vy -= 1400 * dt; d.z += d.vy * dt;
      if (d.z <= 0) {
        d.z = 0;
        if (d.vy < -70) { d.vy = -d.vy * .38; sfx('land', d.x); }
        else d.vy = 0;
      }
    }
    if (d.got) continue;
    d.life -= dt;
    if (d.life <= 0) { d.got = 1; continue; }   // 放久了消失
    if (Math.abs(d.x - h.x) < 15 && Math.abs(d.y - h.y) < 16 && d.z < 22) {
      d.got = 1;
      h.hp = Math.min(10, h.hp + d.heal);
      floaters.push({ x: d.x, y: d.y - 10, t: 0, txt: '+' + d.heal });
      sfx('food', d.x);
    }
  }
  drops = drops.filter(d => !d.got);
  for (const f of floaters) f.t += dt;
  floaters = floaters.filter(f => f.t < 1.1);
}
function drawDrop(d) {
  const c = ctx, meta = (ASSETS.food || {})[d.k], im = IMG['food_' + d.k];
  const fw = meta ? meta[1] : 12, fh = meta ? meta[2] : 10;
  const zz = d.z || 0, y = d.y - zz;
  // 快消失时闪烁
  if (d.life < 1.2 && Math.floor(d.t * 8) % 2) return;
  // 影子（越高越淡越小）
  const sh = Math.max(.35, 1 - zz / 40);
  c.fillStyle = 'rgba(0,0,0,' + (.28 * sh) + ')';
  c.beginPath(); c.ellipse(d.x, d.y + 2, fw * .38 * sh, 2.4 * sh, 0, 0, 7); c.fill();
  // 光晕
  const gl = c.createRadialGradient(d.x, y - fh * .5, 1, d.x, y - fh * .5, fw * .9);
  gl.addColorStop(0, 'rgba(255,220,120,.22)'); gl.addColorStop(1, 'rgba(255,220,120,0)');
  c.fillStyle = gl; c.beginPath(); c.arc(d.x, y - fh * .5, fw * .9, 0, 7); c.fill();
  if (im && im.complete) {
    c.save(); c.imageSmoothingEnabled = false;
    c.drawImage(im, Math.round(d.x - fw / 2), Math.round(y - fh), fw, fh);
    c.restore();
    return;
  }
  c.save(); c.translate(d.x, y - fh / 2);
  c.shadowColor = 'rgba(26,14,8,.9)'; c.shadowOffsetX = .9; c.shadowOffsetY = .9;   // 落到沙地上也看得清
  if (d.k === 'bun') {
    c.fillStyle = '#f6efdc'; c.beginPath(); c.ellipse(0, 0, 6, 5, 0, 0, 7); c.fill();
    c.fillStyle = '#fffdf4'; c.beginPath(); c.ellipse(-1, -1.5, 4, 3, 0, 0, 7); c.fill();
    c.fillStyle = '#d8c9a8'; c.fillRect(-.5, -4.5, 1, 1.5);
  } else if (d.k === 'leg') {
    c.strokeStyle = '#f1e6cf'; c.lineWidth = 2.2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(3, 4); c.lineTo(-1, 0); c.stroke();
    c.fillStyle = '#a05a2c'; c.beginPath(); c.ellipse(-3, -2, 6, 5, -.5, 0, 7); c.fill();
    c.fillStyle = '#c47a3e'; c.beginPath(); c.ellipse(-4, -3, 3.5, 2.6, -.5, 0, 7); c.fill();
  } else {
    c.fillStyle = '#b4522a'; c.beginPath(); c.ellipse(0, 0, 9, 6, 0, 0, 7); c.fill();
    c.fillStyle = '#d06a35'; c.beginPath(); c.ellipse(-1, -1.5, 6.5, 3.6, 0, 0, 7); c.fill();
    c.fillStyle = '#b4522a'; c.beginPath(); c.arc(7, -2, 3.4, 0, 7); c.fill();   // 头
    c.fillStyle = '#8a3d1e'; c.fillRect(-6, 4, 3, 2); c.fillRect(2, 4, 3, 2);    // 腿
    c.fillStyle = '#f4c07a'; c.beginPath(); c.arc(7.5, -2.5, 1.1, 0, 7); c.fill();
  }
  c.shadowColor = 'transparent'; c.shadowOffsetX = 0; c.shadowOffsetY = 0;
  c.restore();
}
function drawFloaters() {
  for (const f of floaters) {
    ctx.globalAlpha = Math.max(0, 1 - f.t / 1.1);
    ctx.font = 'bold 13px "PingFang SC","Noto Sans CJK SC",sans-serif';
    ctx.fillStyle = '#8ef07a'; ctx.textAlign = 'center';
    ctx.fillText(f.txt, f.x, f.y - f.t * 26);
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'left';
}
function hitProp(p, dir) {
  if (p.broken || !(p.g === 'hay' || p.g === 'cart')) return;
  p.hp--; p.hitT = .15;   // 左右抖 0.15 秒
  const hay = p.g === 'hay', broken = p.hp <= 0;
  sfx(broken ? 'land' : 'hit_staff', p.x);
  const cols = hay ? ['#8a5a18', '#c98a25', '#edc34d'] : ['#4b2c12', '#7a4d22', '#a3703c'];
  const n = broken ? 22 : 7;
  for (let i = 0; i < n; i++) {
    const life = broken ? rnd(.42, .65) : rnd(.32, .55);
    // 草垛掉细条状的稻草，推车掉方块状的木片；带一点朝被打飞的方向
    const w = hay ? rnd(2.8, 4.6) : rnd(1.8, 3.2), hh = hay ? 1.2 : w;
    propFx.push({ x: p.x + rnd(-p.w * .35, p.w * .35), y: p.y - rnd(4, p.h * .7),
      vx: rnd(-70, 70) + (dir || 0) * 35, vy: rnd(-130, -45), w, h: hh, life, max: life,
      c: cols[Math.floor(Math.random() * cols.length)] });
  }
  if (broken) {
    p.broken = true; p.solid = false;
    if (Math.random() < .5) spawnDrop(p.x, p.y);   // 一半概率掉吃的
  }
}
// 棍子第三段的冲击波（锦囊）
function updatePWaves(dt) {
  for (const w of pwaves) {
    w.t += dt; w.x += w.vx * dt;
    for (const z of zs) if (!z.dead && !w.hit.has(z) && Math.abs(z.x - w.x) < 18 && Math.abs(z.y - w.y) < 16) {
      w.hit.add(z); hit(z, 1.2 * R_('dmg'), 60, Math.sign(w.vx), false, 0, .3);
    }
  }
  pwaves = pwaves.filter(w => w.t < w.T);
}
function drawPWaves() {
  for (const w of pwaves) {
    const a = 1 - w.t / w.T;
    for (let k = 0; k < 4; k++) {
      const x = w.x - Math.sign(w.vx) * k * 8, hh = (7 - k) * (1 + Math.sin(w.t * 30 + k) * .3);
      ctx.fillStyle = 'rgba(120,86,44,' + (.75 * a) + ')';
      ctx.beginPath(); ctx.moveTo(x - 4, w.y + 2); ctx.lineTo(x, w.y + 2 - hh); ctx.lineTo(x + 4, w.y + 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,230,170,' + (.7 * a) + ')'; ctx.fillRect(x - 1, w.y - hh * .6, 2, 2);
    }
  }
}
function updatePropFx(dt) {
  for (const p of props) if (p.hitT > 0) p.hitT = Math.max(0, p.hitT - dt);
  for (const f of propFx) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 260 * dt; f.life -= dt; }
  propFx = propFx.filter(f => f.life > 0);
}
function drawPropFx() {
  for (const f of propFx) {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life / f.max * 1.8));
    // 先画一圈深色描边，否则黄稻草落在黄土地上根本看不见（和像素角色的描边风格一致）
    ctx.fillStyle = '#2a1c0c';
    ctx.fillRect(f.x - f.w / 2 - .5, f.y - f.h / 2 - .5, f.w + 1, f.h + 1);
    ctx.fillStyle = f.c;
    ctx.fillRect(f.x - f.w / 2, f.y - f.h / 2, f.w, f.h);
  }
  ctx.globalAlpha = 1;
}
function startAtk() {
  const h = hero;
  // 上一下在连招窗口内打中了敌人 → 接下一下；否则从第一下开始
  const chain = h.comboWin > 0 && gameT - (h.lastHit || -9) < .7 && h.lastHitC === h.combo;
  set(h, 'atk'); h.atk = { c: chain ? (h.combo + 1) % WEAP[weapon].combo.length : 0, fi: 0, t: 0, lg: 0 };
}
function strike() {
  const h = hero, W = WEAP[weapon], c = h.atk.c, C = W.combo[c];
  if (W.proj) {
    sfx('swing_stone', h.x); h.lastShotC = c;
    shots.push({ x: h.x + h.f * 16, y: h.y, z: 22, vx: h.f * C.spd * (window.Boss && Boss.wxProj ? Boss.wxProj() : 1), life: C.life || (C.pierce ? 1.1 : .8), C, c, hitSet: [] });
    if (Math.random() < R_('stoneExtra', 0)) {   // 锦囊：石子·连击（第二颗只有一半伤害）
      const C2 = Object.assign({}, C, { dmg: C.dmg * .5, kb: C.kb * .6 });
      shots.push({ x: h.x + h.f * 16, y: h.y, z: 26, vx: h.f * C.spd * 1.06, life: (C.life || .8) + .1, C: C2, c, hitSet: [] });
    }
    return;
  }
  let landed = false, hitEnemy = false;
  const reach = W.reach * R_('reach');                                   // 锦囊：长手
  const rch = C.thrust ? reach * 1.35 : reach;                          // 「戳」比劈多 35% 距离
  const fin = (c === 2 ? R_('fin') : 1) * 1;                             // 锦囊：连打（第三段）
  const aoe = (weapon === 'hammer' && c === 2) ? R_('hammerAoe', 0) : 0; // 锦囊：锤·震地
  for (const z of zs) {
    if (z.dead || z.air) continue;
    const dx = (z.x - h.x) * h.f;
    const bw = z.T.w || 0;
    const inAoE = aoe > 0 && dx > -aoe - bw && dx < aoe + bw && Math.abs(z.y - h.y) < W.dy + 12;
    const inRange = inAoE || (C.both ? Math.abs(dx) < rch + bw : dx > -4 - bw && dx < rch + bw);
    if (inRange && Math.abs(z.y - h.y) < W.dy + (inAoE ? 12 : 0)) {
      landed = hitEnemy = true;
      hit(z, C.dmg * fin, C.kb, C.both ? Math.sign(z.x - h.x) || h.f : h.f, C.knock, C.daze || 0, .35, W.interrupt);
      if (!C.multi && !aoe) break;
    }
  }
  if (weapon === 'staff' && c === 2 && R_('staffWave', 0)) {   // 锦囊：棍·冲击波
    pwaves.push({ x: h.x + h.f * 28, y: h.y, vx: h.f * 330, t: 0, T: .9, hit: new Set(), f: h.f });
  }
  // 草垛、推车也能打：判定和打敌人一样（左右用 p.w/2，上下用 dy）；打中道具也算"打中"，可以接连招
  for (const p of props) {
    if (p.broken || (p.g !== 'hay' && p.g !== 'cart')) continue;
    const dx = (p.x - h.x) * h.f;
    const inRange = C.both ? Math.abs(dx) < rch + p.w / 2 : dx > -4 - p.w / 2 && dx < rch + p.w / 2;
    if (inRange && Math.abs(p.y - h.y) < W.dy) {
      landed = true; h.lastHit = gameT; h.lastHitC = c;
      hitProp(p, Math.sign(p.x - h.x) || h.f);
    }
  }
  const snd = W.snd || weapon;   // 音效名（锤子借用木棍那一套闷响）
  if (hitEnemy) { sfx('hit_' + snd, h.x + h.f * 20); sfx('crack', h.x + h.f * 26); if (c === 2) sfx('finisher', h.x); }
  else if (!landed) sfx('swing_' + snd, h.x);   // 只打中道具时，音效由 hitProp 自己播
}
function dmgHero(n, from) {
  const h = hero; if (h.inv > 0 || h.air || h.st === 'down' || h.st === 'bounce' || h.st === 'getup' || over) return;
  n = Math.max(1, n * R_('take') - R_('takeFlat', 0));   // 锦囊：受到的伤害
  hitsTaken++;   // 结算评价用：被打了多少下
  sfx('hurt', h.x);
  h.hp -= n; h.inv = .7; shake = .2; h.atk = null;
  const dir = from ? Math.sign(h.x - from.x) || -h.f : -h.f;
  if (n >= 2 || h.hp <= 0) { launch(h, dir * 85, 120); h.f = -dir; h.inv = 9; }   // 重击：被打飞
  else { set(h, 'hurt'); h.vx = dir * 80; }
  if (h.hp <= 0) { over = true; say('倒下了……', 1.4); }   // 具体台词交给结算板
}

// ---------- 黄巾兵 AI ----------
function zUpdate(z, dt) {
  if (z.T.boss) return Boss.update(z, dt);
  const T = z.T;
  z.t += dt; z.flash = Math.max(0, z.flash - dt); z.cd -= dt;
  if (z.air) { airStep(z, dt); return; }
  if (z.st === 'land') { if (z.t > .45) { if (z.dead) { z.st = 'gone'; z.t = 0; } else set(z, 'move'); } return; }
  if (z.dead) return;
  if (z.daze > 0) { z.daze -= dt; z.stun = Math.max(0, z.stun - dt); moveEnt(z, z.vx * dt, 0); z.vx *= .85; return; }   // 晕眩：站着不动
  if (z.stun > 0) { z.stun -= dt; moveEnt(z, z.vx * dt, 0); z.vx *= .85; return; }
  if (Math.abs(z.vx) > 1) { moveEnt(z, z.vx * dt, 0); z.vx *= .85; }
  const dx = hero.x - z.x, dy = hero.y - z.y;
  // 附近有旗手：小兵移速 +20%、出手快 20%（旗手优先杀，这是本作第一个"先打谁"的决策）
  const buff = (bannerZ && bannerZ !== z && !z.T.banner && Math.abs(bannerZ.x - z.x) < 170 && Math.abs(bannerZ.y - z.y) < 70) ? 1 : 0;
  if (z.st === 'wind') {
    if (z.t > T.wind * (buff ? .8 : 1)) {
      set(z, 'strike'); sfx(T.ranged === 'stone' ? 'sling' : T.ranged === 'fire' ? 'bow' : 'enemySwing', z.x);
      if (T.ranged === 'stone') eshots.push({ k: 'stone', x: z.x + z.f * 16, y: z.y, z: 24, vx: z.f * 190, life: .95 });   // 射程约 180，和玩家一致
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
    if (z.tok && Math.abs(dx) < T.reach && Math.abs(dy) < 7) { set(z, 'wind'); if (T.heavy) sfx('bladeAlert', z.x); return; }
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
    // 石子碰到草垛/推车：扣 1 点耐久，石子消失（打中道具也算打中，可以接连招）
    if (s.life > 0) for (const p of props) {
      if (p.broken || (p.g !== 'hay' && p.g !== 'cart')) continue;
      if (Math.abs(p.x - s.x) < p.w / 2 + 3 && Math.abs(p.y - s.y) < 8) {
        hero.lastHit = gameT; hero.lastHitC = s.c;
        hitProp(p, Math.sign(s.vx)); s.life = 0; break;
      }
    }
    for (const z of zs) if (!z.dead && !s.hitSet.includes(z) && Math.abs(z.x - s.x) < 10 + (z.T.w || 0) && Math.abs(z.y - s.y) < 10 && s.life > 0) {
      hit(z, s.C.dmg, s.C.kb, Math.sign(s.vx), false, 0, .15); hero.lastHitC = s.c; sfx('hit_stone', s.x); s.hitSet.push(z);
      if (!s.C.pierce) s.life = 0;
    }
  }
  shots = shots.filter(s => s.life > 0);
  for (const s of eshots) {
    if (s.k === 'stone') {
      s.x += s.vx * dt; s.life -= dt;
      if (s.life > 0 && hero.inv <= 0 && Math.abs(hero.x - s.x) < 8 && Math.abs(hero.y - s.y) < 9) { sfx('hit_stone', s.x); dmgHero(1, { x: s.x - s.vx }); s.life = 0; }
    } else {
      s.t += dt;
      if (s.t >= s.T) { fires.push({ x: s.tx, y: s.ty, t: 3, r: 16 }); sfx('fireLand', s.tx); s.life = 0; } else s.life = 1;
    }
  }
  eshots = eshots.filter(s => s.life > 0);
  for (const f of fires) {
    f.t -= dt;
    if (Math.abs(hero.x - f.x) < f.r && Math.abs(hero.y - f.y) < f.r * .45) dmgHero(1, null);

  }
  fires = fires.filter(f => f.t > 0);
}

let gameT = 0;
function update(dt) {
  if (window.ROOM && ROOM.blocks()) { ROOM.update(dt); return; }   // 开场农房：游戏不推进，由 room.js 自己走
  if (window.TITLE && TITLE.blocks()) return;   // 标题界面/转场：游戏不推进
  if (window.ROGUE && ROGUE.blocks()) { ROGUE.update(dt); return; }   // 选锦囊时冻结战斗
  gameT += dt;
  if (!over && !won) runT += dt;   // 计时：通关/倒下后停表；切后台 rAF 不走，也不会多算
  if (freeze > 0) { freeze -= dt; return; }
  // 结算板出来后冻结战斗（主角和敌人不动），但火、碎屑这些特效继续演
  const done = result && gameT >= result.born;
  if (!done) {
    bannerZ = zs.find(z => !z.dead && z.T.banner) || null;   // 场上活着的旗手（给周围小兵加速）
    heroUpdate(dt); waves();
    zs.forEach(z => zUpdate(z, dt));
    zs = zs.filter(z => !(z.st === 'gone' && z.t > .9));
  }
  updateShots(dt); Boss.updateFx(dt); updatePropFx(dt); updateDrops(dt); updatePWaves(dt);
  const vw = viewW();
  let tx = hero.x - vw * .4;
  if (lockR < Infinity) tx = Math.min(tx, lockR - vw);
  cam.x += (Math.max(0, Math.min(M.W - vw, tx)) - cam.x) * Math.min(1, dt * 6);
  shake = Math.max(0, shake - dt); msgT -= dt;
  if (toastT > 0) toastT -= dt;
  // 通关或倒下：记下成绩，1.2 秒后弹结算板（先让倒地/被打飞的动画演完）
  if (!result && (won || over)) {
    endT = runT;
    stampPlayed = false; pressAct = null;
  result = { win: won, kills, time: endT, hit: hitsTaken, rank: won ? rankOf(endT) : '', born: gameT + 1.2,
      line: won ? '' : deathLine(), s1: 0, s2: 0 };
    uiBtns = [];
  }
  if (result) {   // 面板弹一声闷「咚」；台词跳出时再来一声轻「嗒」
    if (!result.s1 && gameT >= result.born) { result.s1 = 1; sfx('panel'); }
    if (!result.s2 && gameT >= result.born + .12) { result.s2 = 1; if (!result.win) sfx('tick'); }
  }
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
function drawChar(name, f, x, y, flip, alpha = 1, white = false, sc = 1, dark = false) {
  const fr = CH[name] && CH[name][f]; if (!fr || !fr.img.complete) return;
  const sp = Math.max(.5, SC * PX) * sc;
  const sx = Math.round(x * SC + OXs), sy = Math.round(y * SC);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, sx, sy); if (flip) ctx.scale(-1, 1);
  ctx.globalAlpha = alpha;
  const im = white && fr.white ? fr.white : (dark && fr.dark ? fr.dark : fr.img);
  ctx.drawImage(im, -fr.ax * sp, -fr.ay * sp, fr.w * sp, fr.h * sp);
  ctx.restore();
}
function heroFrame(h) {
  if (h.st === 'atk') return WEAP[weapon].combo[h.atk.c].f[h.atk.fi];
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
  if (z.stun > 0 || z.daze > 0) return 'hurt';
  if (z.st === 'wind') return 'wind';
  if (z.st === 'strike') return 'strike';
  if (z.st === 'rec') return z.T.ranged ? 'idle' : 'strike';
  return z.moving ? (Math.floor(z.t * 6) % 2 ? 'walk1' : 'walk2') : 'idle';
}
function draw() {
  if (window.TITLE && TITLE.draw()) return;   // 标题界面自己接管整屏
  if (window.ROOM && ROOM.draw()) return;     // 开场农房
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
  Boss.drawGround();
  // 按 y 排序绘制
  const list = [];
  list.push({ y: hero.y - .2, d: Boss.drawHorse });
  for (const p of props) list.push({ y: p.y, d: () => drawProp(p) });
  for (const d of drops) list.push({ y: d.y, d: () => drawDrop(d) });
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
  drawPWaves();
  drawPropFx();   // 道具碎屑画在人物上面，打击感更清楚
  drawFloaters();
  if (window.Boss && Boss.wxDraw) Boss.wxDraw(cv.width / DPR, cv.height / DPR);   // Boss 战天气
  if (window.ROGUE) ROGUE.draw();   // 锦囊面板
  // HUD
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); Boss.hud(W / DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); const HW = W / DPR, HH = H / DPR;
  const bw = Math.min(260, HW * .4);
  ctx.fillStyle = 'rgba(20,14,30,.7)'; ctx.fillRect(14, 64, bw + 6, 18);
  ctx.fillStyle = '#d23c30'; ctx.fillRect(17, 67, bw * Math.max(0, Math.min(10, hero.hp)) / 10, 12);
  // 血条旁边显示玩家名字（标题页输入的）
  const pnm = (window.TITLE && TITLE.playerName && TITLE.playerName()) || '';
  if (pnm) {
    ctx.font = 'bold 14px "PingFang SC","Noto Sans CJK SC",sans-serif';
    const nw = ctx.measureText(pnm).width;
    ctx.fillStyle = 'rgba(20,14,30,.7)'; ctx.fillRect(14 + bw + 6, 64, nw + 14, 18);
    ctx.fillStyle = '#ffd86e'; ctx.fillText(pnm, 14 + bw + 13, 78);
  }
  ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(14, 84, 330, 22); ctx.fillStyle = '#222'; ctx.font = 'bold 15px sans-serif'; ctx.fillText(`击倒 ${kills}   武器：${WEAP[weapon].name}   用时 ${fmtTime(runT)}`, 20, 100);
  if (lockR < Infinity) { const n = zs.filter(z => !z.dead).length; ctx.fillStyle = 'rgba(200,40,30,.85)'; ctx.fillRect(14, 110, 200, 22); ctx.fillStyle = '#fff'; ctx.fillText(`本区域剩余敌人：${n}`, 20, 126); }
  if (!over && lockR === Infinity && gateI > 0 && gateI < M.gates.length && Math.floor(performance.now() / 500) % 2 === 0) {
    ctx.save(); ctx.font = 'bold 46px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = '#34231b'; ctx.fillStyle = '#ffd23f';
    ctx.strokeText('GO →', HW - 28, HH / 2); ctx.fillText('GO →', HW - 28, HH / 2); ctx.restore();
  }
  if (msgT > 0) { ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(20,14,30,.75)'; const tw = ctx.measureText(msg).width; ctx.fillRect(HW / 2 - tw / 2 - 12, 108, tw + 24, 32); ctx.fillStyle = '#ffd86e'; ctx.fillText(msg, HW / 2, 130); ctx.textAlign = 'left'; }
  drawResult(HW, HH);
}

// ---------- 结算板（通关 / 倒下） ----------
function fmtTime(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + (s < 10 ? '0' : '') + s; }
// 评价：无伤 SSS；被打 1~3 下 S；其余按用时 A~E（分数先这么定，实测后再调）
// 倒下时随机说一句（按打到第几波分档），让每次都死得不太一样
const DEATH_LINES = {
  early: ['这就完了？我连这是哪一年都没问清楚。', '汉朝的路，比我想的难走。'],
  mid: ['黄巾贼……怎么打不完。', '再给我一口气，我还能站起来。'],
  boss: ['差一点……就差这一下！', '管亥，你等着。'],
  any: ['无名之辈，也不能就这么交待在这儿。'],
};
function deathLine() {
  const stage = gateI >= 4 ? 'boss' : gateI >= 2 ? 'mid' : 'early';
  const pool = DEATH_LINES[stage].concat(DEATH_LINES.any);
  return pool[Math.floor(Math.random() * pool.length)];
}
function rankOf(t) {
  if (hitsTaken === 0) return 'SSS';
  if (hitsTaken <= 3) return 'S';
  if (t <= 180) return 'A';
  if (t <= 240) return 'B';
  if (t <= 320) return 'C';
  if (t <= 420) return 'D';
  return 'E';
}
function toast(m) { toastMsg = m; toastT = 2.4; }
// ---------- 结算画面 ----------
const eOut = t => 1 - Math.pow(1 - t, 3);
const eBack = t => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);   // 盖章回弹
let stampPlayed = false, pressAct = null, pressAt = 0;

function drawResult(HW, HH) {
  if (!result || gameT < result.born) return;
  const raw = gameT - result.born;
  uiBtns = [];
  const BRUSH = '"MaShanZheng","KaiTi","STKaiti","Kaiti SC",serif';
  const F = '"PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif';

  // 背景压暗 + 四角暗角
  ctx.fillStyle = 'rgba(8,5,10,.74)'; ctx.fillRect(0, 0, HW, HH);
  const vg = ctx.createRadialGradient(HW / 2, HH / 2, Math.min(HW, HH) * .22, HW / 2, HH / 2, Math.max(HW, HH) * .72);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.66)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, HW, HH);

  // 卷轴：按屏幕适配，从中间向左右展开
  const sw0 = Math.min(HW * .90, HH * 1.62) * .75, sh0 = sw0 / 1.66;   // 缩到 3/4，仍然居中
  const p = eOut(Math.min(1, Math.max(0, (raw - .05) / .40)));
  const sw = Math.max(40, sw0 * p), sx = (HW - sw) / 2, sy = Math.round((HH - sh0) / 2);
  const sh = sh0, sc = sh / 561;
  const roll = 92 * sc;
  const scroll = IMG['ui_scroll'];
  if (scroll && scroll.complete) {
    ctx.drawImage(scroll, 0, 0, 92, 561, sx, sy, roll, sh);
    ctx.drawImage(scroll, 838, 0, 92, 561, sx + sw - roll, sy, roll, sh);
    if (sw > roll * 2) ctx.drawImage(scroll, 92, 0, 746, 561, sx + roll, sy, sw - roll * 2, sh);
  } else {
    ctx.fillStyle = '#e8d9b5'; ctx.fillRect(sx, sy, sw, sh);
  }

  // 内容区（卷轴中间的纸面）
  const px0 = sx + roll * 1.12, px1 = sx + sw - roll * 1.12, pw = px1 - px0;
  const ink = '#2c2117';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const fade = Math.min(1, Math.max(0, (raw - .30) / .25));
  ctx.globalAlpha = fade;

  // 左侧像素人物：通关 = 管亥跪地，倒下 = 主角倒地
  const frName = result.win ? { n: 'guanhai', f: 'kneel' } : { n: 'hero', f: 'down' };
  const fr = CH[frName.n] && CH[frName.n][frName.f];
  if (fr && fr.img.complete) {
    const k = Math.max(1, Math.min(Math.round(sh * .20 / fr.h), Math.max(1, Math.floor(pw * .34 / fr.w))));
    const dx = px0 + pw * .07, dy = sy + sh * .66;
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = fade * .95;
    ctx.drawImage(fr.img, Math.round(dx - fr.ax * k), Math.round(dy - fr.ay * k), fr.w * k, fr.h * k);
    ctx.restore();
  }

  // 标题（毛笔）
  const title = result.win ? '通关' : '倒下';
  ctx.font = Math.round(sh * .142) + 'px ' + BRUSH;
  ctx.fillStyle = ink;
  ctx.fillText(title, px0 + pw * .50, sy + sh * .295);

  // 击倒 / 用时
  ctx.font = Math.round(sh * .058) + 'px ' + F;
  ctx.fillStyle = '#4a3a2a';
  ctx.fillText('击倒 ' + result.kills + ' 名　用时 ' + fmtTime(result.time), px0 + pw * .50, sy + sh * .40);

  // 台词
  const line = result.line || '';
  if (line) {
    const lfs = Math.max(11, Math.round(sh * .052));
    ctx.font = lfs + 'px ' + BRUSH;
    ctx.fillStyle = '#3a2410';
    const maxW = pw * .70, cx = px0 + pw * .50;
    let row = '', rows = [];
    for (const ch of line) {
      if (ctx.measureText(row + ch).width > maxW) { rows.push(row); row = ch; } else row += ch;
    }
    if (row) rows.push(row);
    rows.slice(0, 2).forEach((r2, i) => ctx.fillText(r2, cx, sy + sh * (.47 + i * .070)));
  }
  ctx.globalAlpha = 1;

  // 印章
  const sealDelay = .52;
  if (raw > sealDelay) {
    const q = Math.min(1, (raw - sealDelay) / .22);
    if (!stampPlayed) { stampPlayed = true; sfx('stamp', HW / 2); shake = .12; }
    const sc2 = .6 + .4 * eBack(q);
    const img = IMG[result.win ? 'ui_seal_square' : 'ui_seal_round'];
    const side = sh * (result.win ? .24 : .22) * sc2;
    const cx2 = px0 + pw * .89, cy2 = sy + sh * .245;
    ctx.save();
    ctx.globalAlpha = Math.min(1, q * 1.6);
    if (img && img.complete) ctx.drawImage(img, cx2 - side / 2, cy2 - side / 2, side, side);
    else { ctx.strokeStyle = '#a4321f'; ctx.lineWidth = 3; ctx.strokeRect(cx2 - side / 2, cy2 - side / 2, side, side); }
    ctx.fillStyle = '#9c2b1c';
    const sealTxt = result.win ? result.rank : '败';
    let fs2 = Math.round(side * (result.win ? .44 : .58));
    ctx.font = fs2 + 'px ' + BRUSH;
    const tw = ctx.measureText(sealTxt).width;
    if (tw > side * .62) { fs2 = Math.max(8, Math.floor(fs2 * side * .62 / tw)); ctx.font = fs2 + 'px ' + BRUSH; }
    ctx.textAlign = 'center';
    ctx.fillText(sealTxt, cx2, cy2 + fs2 * .36);
    ctx.restore();
  }

  // 木牌按钮
  const btnFade = Math.min(1, Math.max(0, (raw - .62) / .3));
  ctx.globalAlpha = btnFade;
  const gap = pw * .035;
  const bw = (pw * .84 - gap * 2) / 3, bh = bw / 1.66;
  const byy = sy + sh * .755;
  const bx0 = px0 + (pw - (bw * 3 + gap * 2)) / 2;
  // 先按最长的标签算一个统一字号，三块牌子字一样大
  let ufs = Math.round(bh * .46);
  ctx.font = ufs + 'px ' + BRUSH;
  const longest = Math.max(...['分享', '返回首页', '再来一局'].map(t => ctx.measureText(t).width));
  if (longest > bw * .78) ufs = Math.max(8, Math.floor(ufs * bw * .78 / longest));
  const plank = (i, label, act, red) => {
    const x = bx0 + i * (bw + gap);
    const pressed = pressAct === act && performance.now() - pressAt < 140;
    const yy = byy + (pressed ? bh * .06 : 0);
    const img = IMG[red ? 'ui_btn_red' : 'ui_btn'];
    ctx.save();
    ctx.globalAlpha = btnFade * (pressed ? .82 : 1);
    if (img && img.complete) ctx.drawImage(img, x, yy, bw, bh);
    else { ctx.fillStyle = red ? '#8e2f22' : '#7a5530'; ctx.fillRect(x, yy, bw, bh); }
    ctx.restore();
    ctx.save();
    const lfs = ufs;
    ctx.font = lfs + 'px ' + BRUSH;
    ctx.fillStyle = red ? '#f6e2c0' : '#2b1a0c';
    ctx.fillText(label, x + bw / 2, yy + bh * .62 + lfs * .18);
    ctx.restore();
    uiBtns.push({ x, y: yy, w: bw, h: bh, act });
  };
  plank(0, '分享', 'share', false);
  plank(1, '返回首页', 'home', false);
  plank(2, '再来一局', 'restart', true);

  // 复活按钮
  if (!result.win && !reviveUsed && raw > .8) {
    const rw = pw * .46, rh = sh * .068, rx = px0 + pw * .50, ry = sy + sh * .615;
    const pressed = pressAct === 'revive' && performance.now() - pressAt < 140;
    ctx.save();
    ctx.globalAlpha = Math.min(1, (raw - .8) / .2);
    ctx.fillStyle = pressed ? 'rgba(40,90,48,.95)' : 'rgba(47,107,58,.92)';
    ctx.fillRect(rx, ry + (pressed ? 2 : 0), rw, rh);
    ctx.strokeStyle = '#8ef07a'; ctx.lineWidth = 2; ctx.strokeRect(rx + 1, ry + (pressed ? 2 : 0) + 1, rw - 2, rh - 2);
    ctx.fillStyle = '#e9ffe2'; ctx.font = Math.round(rh * .52) + 'px ' + F;
    ctx.fillText('分享给好友 · 复活一次', rx + rw / 2, ry + rh * .68 + (pressed ? 2 : 0));
    ctx.restore();
    uiBtns.push({ x: rx, y: ry, w: rw, h: rh, act: 'revive' });
  }
  ctx.globalAlpha = 1;

  if (toastT > 0) {   // 分享结果的提示条：放在屏幕下方，不压面板
    ctx.font = 'bold 15px ' + F;
    const tw = ctx.measureText(toastMsg).width, ty = HH - 52;
    ctx.fillStyle = 'rgba(20,14,30,.88)'; ctx.fillRect(HW / 2 - tw / 2 - 14, ty - 22, tw + 28, 30);
    ctx.fillStyle = '#ffd86e'; ctx.fillText(toastMsg, HW / 2, ty);
  }
  ctx.textAlign = 'left'; ctx.globalAlpha = 1;
}
// 分享换复活（每局一次）：不管分享成不成功都给，分享面板取消也不扣次数
async function doRevive() {
  if (!result || result.win || reviveUsed) return;
  reviveUsed = true;
  const r = { win: false, kills, time: result.time, rank: '' };
  result = null; uiBtns = [];
  over = false;
  hero.hp = 5; hero.st = 'idle'; hero.t = 0; hero.atk = null; hero.vx = 0; hero.inv = 2.2; hero.rollCd = 0;
  for (const z of zs) if (!z.dead) { z.stun = Math.max(z.stun, .7); z.st = 'move'; z.tok = false; }
  say('……还活着！趁现在', 2.2);
  sfx('finisher', hero.x);
  try { if (window.SHARE) await SHARE.send(r); } catch (e) {}
}
async function doShare() {
  if (!result) return;
  if (!window.SHARE) { toast('分享功能不可用'); return; }
  const st = await SHARE.send({ win: result.win, kills: result.kills, time: result.time, rank: result.rank });
  if (st === 'copied') toast('链接已复制，去粘贴给朋友吧');
  else if (st === 'wechat') toast('点右上角 ··· → 分享给朋友');
  else if (st === 'fail') toast('分享失败：直接搜 wumingzhibei.netlify.app');
  else if (st === 'shared') toast('分享成功！');
}
// 结算板上的按钮：手机上只能点这里（没有 R 键），电脑上点按钮或按 R 都行
document.addEventListener('pointerdown', e => {
  if (!result || gameT < result.born) return;
  for (const b of uiBtns) {
    if (e.clientX >= b.x && e.clientX <= b.x + b.w && e.clientY >= b.y && e.clientY <= b.y + b.h) {
      e.preventDefault(); e.stopPropagation();
      pressAct = b.act; pressAt = performance.now();
      const act = b.act;
      setTimeout(() => {
        if (act === 'share') doShare();
        else if (act === 'revive') doRevive();
        else if (act === 'home') { if (window.TITLE) TITLE.show(); }
        else reset();
      }, 140);
      return;
    }
  }
}, true);
function stone(x, y) { ctx.fillStyle = '#2a2234'; ctx.fillRect(x - 2, y - 2, 4, 4); ctx.fillStyle = '#9a9ea8'; ctx.fillRect(x - 1, y - 1.5, 2, 2); }
function drawProp(p) {
  if (p.broken) return;   // 打坏的草垛/推车不再画
  const [, w, h] = ASSETS.props[p.g];
  const a = p.solid && hero.y < p.y && hero.y > p.y - h + 6 && Math.abs(hero.x - p.x) < w / 2 + 4 ? .5 : 1;
  const sh = p.hitT > 0 ? Math.sin(p.hitT * 90) * 2.2 : 0;   // 被打中时左右抖一下
  ctx.save(); ctx.globalAlpha = a; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(IMG['p_' + p.g], Math.round(p.x - w / 2 + sh), Math.round(p.y + 2 - h), w, h);
  ctx.restore();
}
function drawHero() {
  const h = hero; shadow(h.x, h.y, 10);
  if (h.inv > 0 && h.inv < 2 && h.st !== 'roll' && h.st !== 'down' && Math.floor(h.inv * 20) % 2) return;
  drawChar('hero', heroFrame(h), h.x, h.y - (h.z || 0), h.f < 0);
}
// ---------- 旗手的大旗：旗杆、横杆、枪头用代码画，旗面贴图切成横条做随风飘动 ----------
// 每帧旗杆的位置：图里人物手上已经画了一截杆子，代码画的长旗杆沿着这截杆子延长，两者重合成一根。
// [杆底 x, 杆底 y（精灵像素，取画出来那截杆子靠"杆底"一端）, 倾角（度，0=竖直向上，正=杆顶朝前，负=朝后）]
// 每帧旗杆底部 = 前手（朝右那只手）的精灵像素坐标，从新旗手图上量出来的
const BANNER_POLE = {
  idle: [30, 37, 0], walk1: [29, 32, 0], walk2: [31, 33, 0], hurt: [40, 33, 0],
  wind: [34, 33, -80],     // 举过头顶：杆顶甩到身后
  strike: [46, 29, -50],   // 挥杆下扫：杆往前下方送
};
const BANNER = { pole: 66, clothW: 15, clothH: 31, bar: 19, w: 1.3 };   // 世界单位：旗杆约 2.3 个人高
let flagDark = null;
function bannerTex() {
  const tex = IMG.ui_flag_cloth; if (!tex || !tex.complete || !tex.width) return null;
  if (!flagDark) {   // 预先做一张压暗的旗面，用来画布料褶皱的背光面
    const c = document.createElement('canvas'); c.width = tex.width; c.height = tex.height; const g = c.getContext('2d');
    g.drawImage(tex, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(60,30,10,.55)'; g.fillRect(0, 0, c.width, c.height); flagDark = c;
  }
  return tex;
}
function drawBanner(z, alpha) {
  if (!bannerTex()) return;
  const fr = zFrame(z), P = BANNER_POLE[fr], ch = CH[z.sprite] && CH[z.sprite][fr];
  const t = performance.now() / 1000 + (z.slot || 0) * .7;
  ctx.save(); ctx.globalAlpha = alpha * (z.st === 'gone' ? .8 : 1);
  if (!P || !ch) {   // 被打飞/倒地：旗掉在地上，躺平
    if (z.flagX == null) { z.flagX = z.x; z.flagY = z.y; }
    ctx.translate(z.flagX - z.f * 30, z.flagY + 1); ctx.rotate(Math.PI / 2 * z.f);
    flagPole(0, 0, BANNER.pole); clothStrips(0, -BANNER.pole + 4, t, 0, 0, true);
    ctx.restore(); return;
  }
  z.flagX = null;
  const k = PX * (z.sc || 1);
  const bx = z.x + (P[0] - ch.ax) * k * z.f, by = z.y - (z.z || 0) - (ch.ay - P[1]) * k;
  const ang = P[2] * Math.PI / 180 * z.f;
  // 旗杆转动的速度：挥动时旗面被甩向反方向
  const prev = z.flagAng == null ? ang : z.flagAng; z.flagSwing = ((z.flagSwing || 0) * .85) + (ang - prev) * 6; z.flagAng = ang;
  ctx.save(); ctx.translate(bx, by); ctx.rotate(ang); flagPole(0, 0, BANNER.pole); ctx.restore();
  // 旗面挂在横杆下，受重力始终朝下垂（字保持正向），风和挥动让它摆
  const tx = bx + Math.sin(ang) * (BANNER.pole - 4), ty = by - Math.cos(ang) * (BANNER.pole - 4);
  const lean = -z.f * (z.moving ? 1 : .4) - z.flagSwing;
  clothStrips(tx, ty, t, z.moving ? 1.4 : 1, lean, false);
  ctx.restore();
}
// 以杆底为原点、杆朝上（-y）画旗杆、枪头、横杆
function flagPole(x, y, L) {
  const top = y - L, w = BANNER.w, P = BANNER;
  ctx.fillStyle = '#2a1a10'; ctx.fillRect(x - w / 2 - .4, top, w + .8, L);
  ctx.fillStyle = '#7a4e2a'; ctx.fillRect(x - w / 2, top, w, L);
  ctx.fillStyle = '#a8743f'; ctx.fillRect(x - w / 2, top, w * .35, L);
  ctx.fillStyle = '#2a2430'; ctx.beginPath(); ctx.moveTo(x, top - 7); ctx.lineTo(x - 2, top - 1); ctx.lineTo(x + 2, top - 1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#b8bcc8'; ctx.beginPath(); ctx.moveTo(x, top - 6); ctx.lineTo(x - 1.1, top - 1.4); ctx.lineTo(x + .4, top - 1.4); ctx.closePath(); ctx.fill();
  const by = top + 4;
  ctx.fillStyle = '#2a1a10'; ctx.fillRect(x - P.bar / 2, by - 1.1, P.bar, 2.2);
  ctx.fillStyle = '#7a4e2a'; ctx.fillRect(x - P.bar / 2 + .4, by - .6, P.bar - .8, 1.2);
}
// 旗面：(cx, top) 是横杆中点，切成横条往下垂，越往下摆幅越大
function clothStrips(cx, top, t, sway, lean, limp) {
  const tex = IMG.ui_flag_cloth, N = 28, w = BANNER.clothW, h = BANNER.clothH, sh = tex.height / N;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  for (let i = 0; i < N; i++) {
    const v = i / N, ph = t * 4.2 - v * 5.5;
    const off = limp ? 0 : (Math.sin(ph) * 2.2 * sway + Math.max(-3, Math.min(3, lean)) * 3.2) * v * v + Math.sin(ph * .5) * .4 * v;
    const squeeze = limp ? 1 : 1 - .08 * Math.abs(Math.cos(ph)) * v;   // 布面翻转时略变窄
    const ww = w * squeeze, sx = cx - ww / 2 + off, sy = top + 1 + v * h;
    ctx.drawImage(tex, 0, i * sh, tex.width, sh + .5, sx, sy, ww, h / N + .35);
    const dk = limp ? .15 : Math.max(0, Math.cos(ph)) * .55 * v + .05;   // 褶皱背光面
    if (dk > .02) { ctx.globalAlpha *= dk; ctx.drawImage(flagDark, 0, i * sh, tex.width, sh + .5, sx, sy, ww, h / N + .35); ctx.globalAlpha /= dk; }
  }
  ctx.imageSmoothingEnabled = false;
}
function drawZ(z) {
  if (z.T.boss) return Boss.draw(z);
  shadow(z.x, z.y, 10);
  const a = z.st === 'gone' ? Math.max(0, 1 - z.t * 1.2) * (Math.floor(z.t * 12) % 2 ? .4 : 1) : 1;
  if (z.T.banner) drawBanner(z, a);   // 旗画在人后面
  drawChar(z.sprite || z.type, zFrame(z), z.x, z.y - (z.z || 0), z.f < 0, a, z.flash > 0, z.sc || 1, !!z.dark);
  if (z.dead || z.air || z.st === 'land') return;
  const top = z.y - 34;
  if (z.daze > 0) {   // 头顶转圈的小黄星
    const t = performance.now() / 260;
    for (let k = 0; k < 3; k++) {
      const a = t + k * 2.094, sx = z.x + Math.cos(a) * 7, sy = top - 6 + Math.sin(a) * 2;
      ctx.fillStyle = '#3a2410'; ctx.fillRect(sx - 2, sy - 2, 4, 4); ctx.fillStyle = '#ffd84a'; ctx.fillRect(sx - 1.5, sy - .5, 3, 1); ctx.fillRect(sx - .5, sy - 1.5, 1, 3);
    }
  }
  if (z.st === 'wind' && !z.T.ranged) { ctx.fillStyle = '#e03a2a'; ctx.fillRect(z.x - 1, top - 10, 3, 6); ctx.fillRect(z.x - 1, top - 2.5, 3, 2); }
  const barW = z.T.elite ? 26 : 18;
  // 旗手的血条放到脚下：头顶那块是旗面，压上去会挡住"苍天已死"的字
  const barY = z.T.banner ? z.y + 4 : top;
  ctx.fillStyle = '#18101e'; ctx.fillRect(z.x - barW / 2, barY, barW, 3); ctx.fillStyle = z.T.elite ? '#e04a2a' : z.T.heavy ? '#e0a030' : '#7ad06a'; ctx.fillRect(z.x - barW / 2 + 1, barY + 1, (barW - 2) * z.hp / z.T.hp, 1);
}

// 画布按实际显示尺寸 × 设备像素比绘制（手机上更清晰），窗口/横竖屏变化时重新适配
let DPR = 1;
function fit() {
  const vv = window.visualViewport, w = vv ? vv.width : innerWidth, h = vv ? vv.height : innerHeight;
  DPR = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(w * DPR); cv.height = Math.round(h * DPR);
  cv.style.width = w + 'px'; cv.style.height = h + 'px';
}
addEventListener('resize', fit); addEventListener('orientationchange', () => setTimeout(fit, 300));
if (window.visualViewport) visualViewport.addEventListener('resize', fit);
fit();
// 手机：禁止双击放大、双指缩放、页面拖动
['gesturestart', 'gesturechange', 'dblclick'].forEach(ev => document.addEventListener(ev, e => e.preventDefault(), { passive: false }));
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', e => { const n = Date.now(); if (n - lastTouchEnd < 350) e.preventDefault(); lastTouchEnd = n; }, { passive: false });
let last = performance.now();
function loop(t) { const dt = Math.min(.033, (t - last) / 1000); last = t; update(dt); draw(); requestAnimationFrame(loop); }
if (window.ROGUE) ROGUE.reset(); reset(); ui(); requestAnimationFrame(loop);
