// 无名之辈·序章 幻想三国录 —— 宽地面清版
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const IMG = {};
// 图片排队下载（用户定：别一打开就同时开几十个下载把网速占满）：同时最多 4 张，下完一张再开下一张
const LOADQ = []; let loadingN = 0;
function pumpLoad() { while (loadingN < 4 && LOADQ.length) { const [i, src] = LOADQ.shift(); if (i.src) continue; loadingN++; const done = () => { loadingN--; pumpLoad(); }; i.addEventListener('load', done, { once: true }); i.addEventListener('error', done, { once: true }); i.src = src; } }
function promoteLoad(img) { if (img.src) return; const i = LOADQ.findIndex(q => q[0] === img); if (i > 0) LOADQ.unshift(LOADQ.splice(i, 1)[0]); }   // 画面上要用到但还在排队的图：插到队首
function flushLoads() { while (LOADQ.length) { const [i, src] = LOADQ.shift(); if (!i.src) i.src = src; } }   // 开打了：剩下的图全部开始下（不再限速）
function load(k, src) { const i = new Image(); IMG[k] = i; if (!src || String(src).startsWith('data:')) { i.src = src; return i; } LOADQ.push([i, src]); pumpLoad(); return i; }
// 按需加载：第二章、校场的图片先不下载，进入（或整备页预取）时才开始，首次打开少下载约2MB。
const LAZY = { chapter2: [], xiaochang: [] }, LAZY_DONE = {};
const LAZY_CHARS = { yellow_heavy: 'chapter2', yellow_shield: 'chapter2', yellow_spear: 'chapter2', yellow_catapult: 'chapter2', zhang_liang: 'chapter2', zhang_bao: 'chapter2', yellow_golem: 'chapter2', zhang_jiao: 'chapter2' };
function lazyLoad(group, k, src) { const i = new Image(); IMG[k] = i; LAZY[group].push([i, src]); return i; }
function ensureAssets(group, { silent = false, label = '' } = {}) {
  const list = LAZY[group] || [];
  if(!LAZY_DONE[group]) LAZY_DONE[group]=Promise.all(list.map(([img,src])=>new Promise(ok=>{
    if(img.complete&&img.naturalWidth){ok();return;}
    img.addEventListener('load',ok,{once:true});img.addEventListener('error',ok,{once:true});
    if(!img.src)img.src=src;
  })));
  if(silent)return LAZY_DONE[group];
  let overlay=null,progress;
  const show=setTimeout(()=>{
    overlay=document.createElement('div');overlay.id='wzbLoading';
    overlay.style.cssText='position:fixed;inset:0;z-index:60;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:#120c08e8;color:#f1d58f;font:16px sans-serif;letter-spacing:2px';
    const title=document.createElement('span');title.textContent=label||'加载中';const percent=document.createElement('b');overlay.append(title,percent);document.body.append(overlay);
    const tick=()=>{percent.textContent=Math.round(list.filter(([im])=>im.complete&&im.src).length/Math.max(1,list.length)*100)+'%';};tick();progress=setInterval(tick,200);
  },120);
  const refresh=setTimeout(()=>{if(overlay){const button=document.createElement('button');button.textContent='网络较慢，点此刷新';button.onclick=()=>location.reload();overlay.append(button);}},10000);
  return LAZY_DONE[group].finally(()=>{clearTimeout(show);clearTimeout(refresh);clearInterval(progress);if(overlay)overlay.remove();});
}
window.ensureAssets = ensureAssets;
load('far', BG.far); load('mid', BG.mid); load('gnd', BG.gnd);
Object.entries(ASSETS.props).forEach(([k, v]) => load('p_' + k, v[0]));
Object.entries(ASSETS.food || {}).forEach(([k, v]) => load('food_' + k, v[0]));

if (ASSETS.chapter2) {
  if (ASSETS.chapter2.far) lazyLoad('chapter2', 'chapter2_far', ASSETS.chapter2.far);
  if (ASSETS.chapter2.battlefield) lazyLoad('chapter2', 'chapter2_battlefield', ASSETS.chapter2.battlefield);
  if (ASSETS.chapter2.altar) lazyLoad('chapter2', 'chapter2_altar', ASSETS.chapter2.altar);   // 祭台前景（已抠好透明天空）
  if (ASSETS.chapter2.zj) Object.entries(ASSETS.chapter2.zj).forEach(([k, v]) => lazyLoad('chapter2', 'zj_' + k, v));   // 张角法术特效
  if (ASSETS.chapter2.altarFar) lazyLoad('chapter2', 'chapter2_altar_far', ASSETS.chapter2.altarFar);   // 祭台远景：雷云
}
if (ASSETS.xiaochang) lazyLoad('xiaochang', 'xiaochang', ASSETS.xiaochang);
if (ASSETS.chapter2Intro) lazyLoad('chapter2', 'chapter2_intro', ASSETS.chapter2Intro);
Object.entries(ASSETS.ui || {}).forEach(([k, v]) => load('ui_' + k, v));
Object.entries(ASSETS.dialogPortraits || {}).forEach(([k, v]) => lazyLoad('chapter2', 'dialog_' + k, v));   // 立绘目前只在第二章开场用
document.querySelectorAll('[data-weapon-icon]').forEach(img => {
  const src = ASSETS.ui && ASSETS.ui[img.dataset.weaponIcon];
  if (src) img.src = src;
});
// 角色像素图：CH[角色][帧] = { img, w, h, ax, ay, white }
const CH = {};
for (const [name, frames] of Object.entries(ASSETS.chars)) {
  CH[name] = {};
  for (const [f, [src, w, h, ax, ay]] of Object.entries(frames)) {
    const fr = { img: LAZY_CHARS[name] ? lazyLoad(LAZY_CHARS[name], name + '_' + f, src) : load(name + '_' + f, src), w, h, ax, ay, white: null };
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
if (window.OUTFIT) OUTFIT.init(CH);
const PX = 0.4;   // 1 个精灵像素 = 0.4 世界单位
const PROP_POOL = ['hay', 'hay', 'cart'];   // 水井已移除（只保留草垛、推车）   // 道具尺寸直接写在 art/props/meta.json（已按 1.6 倍放大）

// 连招：f = 帧序列，d = 每帧时长，最后一帧开始时出手判定。棍四段，锤和石子三段。
// 连招规则：上一下打中敌人，才能接下一下；打空就从第一下重来。
// 平衡：锤子距离最短、伤害最高，出手带前冲、命中必打断敌人蓄力；木棍距离长、能打晕、第三下横扫多人；
// 石子射得远但出手慢、伤害最低，只能用来先削血（射程压到比弓箭手近，逼你往前压）。
const WEAP = {
  // move: .5 = 出手期间保留一半移动速度（35 单位/秒），能边走边扫，不会僵在原地；
  // 后摇从 .24/.24/.30 收到 .20/.20/.26，收招更利索（一轮 1.24 → 1.12 秒）
  // 棍子 = 控场：距离最长（40）、伤害中等，但每一下都有机会把敌人打晕，第三下横扫必定打晕全场；
  // 被打晕的敌人（头上转星星）吃 1.5 倍伤害 —— 所以「棍子打晕 → 换锤子收尾」是一套成立的打法。
  // 棍子 = 长距离控场。前四段按「劈 → 扫 → 回身扫 → 戳」组合：
  // 每段都缩短了前摇、拉长了命中帧，出手更干脆；击退加大，让敌人有明确的被打到感。
  staff: { name: '棍', class: 'long', reach: 40, dy: 12,   /* 用户定：长武器上下判定 16→12，不能斜站卡首领 */ move: .5, freeze: .062, aspd: 1.08, combo: [
    { f: ['staff_1a', 'staff_1b'], d: [.13, .19], dmg: 1.0, kb: 52, daze: .4 },                   // 劈：举棍过顶 → 砸下
    { f: ['staff_2a', 'staff_2b'], d: [.11, .19], dmg: 1.0, kb: 46, daze: .55 },                  // 扫：低身搂扫
    { f: ['staff_3a', 'staff_3b'], d: [.16, .25], dmg: 1.2, kb: 150, daze: 1, multi: true, knock: true },   // 回身扫（必晕）
    { f: ['staffp_a', 'staffp_b'], d: [.10, .24], dmg: 2.0, kb: 90, daze: 1, thrust: true },          // 戳：必晕
  ] },
  // lunge/lungeT：出手时朝面向方向前冲一小段（补足短距离）；interrupt：命中必打断敌人正在蓄力的攻击（含刀手）
  // 攻速：一轮 1.30 秒，比棍子的 1.12 秒慢——伤害是棍子的 1.6 倍，靠"慢"来付账
  // move: 0：出手期间站定不动（只保留开头那一下前冲），砸下去人不能跟着滑，重量感更足
  hammer: { name: '锤子', class: 'short', reach: 25, dy: 15, snd: 'staff', lunge: 80, lungeT: .12, interrupt: true, move: 0, combo: [
    { f: ['hammer_1a', 'hammer_1b'], d: [.14, .24], dmg: 1.5, kb: 30 },                           // 举锤下砸
    { f: ['hammer_2a', 'hammer_2b'], d: [.13, .24], dmg: 1.5, kb: 30 },                           // 反手横抡
    { f: ['hammer_3a', 'hammer_3b', 'hammer_3c'], d: [.16, .09, .30], dmg: 3.0, kb: 70, multi: true, knock: true },   // 回旋锤：以自身为中心一圈
  ] },
  blade: { name: '大刀', class: 'short', reach: 30, dy: 17, move: .35, freeze: .065, snd: 'staff', chargeReach: 38, combo: [
    { f: ['blade_1a', 'blade_1b'], d: [.14, .20], dmg: 1.1, kb: 42 },                              // 斜劈
    { f: ['blade_2a', 'blade_2b'], d: [.15, .22], dmg: 1.2, kb: 48, multi: true },                 // 横砍
    { f: ['blade_4a', 'blade_4b'], d: [.16, .34], dmg: 2.2, kb: 100, multi: true, knock: true },   // 举刀重劈收尾：劈下就停，去掉插地那一帧（用户定）
  ] },
  // move：出手期间的移动倍率（0 = 定住，1 = 全速）；石子边走边扔所以是 1
  // 射程：普通投约 149（和投石手的 150 打平），弓箭手 190 仍然比你远，还是得往前压
  stone: { name: '石子', class: 'ranged', proj: true, move: 1, combo: [
    { f: ['stone_1a', 'stone_1b'], d: [.0945, .2205], dmg: .62, kb: 40, spd: 230, life: .78 },      // 左手扔（射程约 179）
    { f: ['stone_2a', 'stone_2b'], d: [.0945, .2205], dmg: .62, kb: 40, spd: 230, life: .78 },      // 右手扔（射程约 179）
    { f: ['stone_3a', 'stone_3b', 'stone_3c'], d: [.189, .0735, .294], dmg: 1.24, kb: 70, spd: 310, life: .8, noPierce: true, dazeChance: 1, dazeTime: .6, daze: 1 },   // 全力投：命中即停、必晕0.6秒
  ] },
  bow: { name: '汉弓', class: 'ranged', proj: true, move: 1, snd: 'staff', combo: [
    { f: ['bow_1a', 'bow_1b'], d: [.20, .26], dmg: 1.0, kb: 38, spd: 330, life: 1.05 },
    { f: ['bow_2a', 'bow_2b'], d: [.18, .26], dmg: 1.0, kb: 38, spd: 340, life: 1.08 },
    { f: ['bow_3a', 'bow_3b'], d: [.22, .30], dmg: .6, kb: 75, spd: 390, life: 1.15 },
  ] },
};
// 长戟使用白衣专用帧。
WEAP.halberd = Object.assign({}, WEAP.staff, {
  name: '长戟',
  aspd: 1,   // 长戟不继承棍子的 +8% 攻速
  reach: 46,
  combo: [
    { f: ['halberd_1a', 'halberd_1b'], d: [.13, .19], dmg: 1.0, kb: 56, daze: 0 },
    { f: ['halberd_2a', 'halberd_2b'], d: [.11, .19], dmg: 1.0, kb: 50, daze: 0 },
    { f: ['halberd_3a', 'halberd_3b'], d: [.16, .25], dmg: 1.1, kb: 150, daze: 0, multi: true, knock: true },
    { f: ['halberd_4a', 'halberd_4b'], d: [.10, .24], dmg: 1.9, kb: 90, daze: 0, thrust: true },
  ],
});
// 黄巾兵
const TYPES = {
  grunt:   { name: '喽啰', hp: 3, spd: 38, wind: .45, reach: 22, dmg: 1, scale: .86 },
  blade:   { name: '刀手', hp: 5, spd: 30, wind: .7, reach: 27, dmg: 1.5, heavy: true, scale: .92 },
  slinger: { name: '投石手', hp: 2, spd: 40, wind: .6, ranged: 'stone', range: [64, 104], cd: 2.4, scale: .88 },
  archer:  { name: '弓箭手', hp: 2, spd: 34, wind: .85, ranged: 'fire', range: [120, 190], cd: 3.2, scale: .92 },
  elite:   { name: '老卒', hp: 10, spd: 26, wind: 1.05, reach: 30, dmg: 3, heavy: true, elite: true, w: 12, sprite: 'elite', scale: 1.05 },   // 精英：血厚、出手慢、打不断
  priest:  { name: '黄巾方士', hp: 4, spd: 40, priest: true, w: 10, sprite: 'priest', scale: .9 },   // 不打人，念咒奶人+加速，跑位躲后排
  'yellow-heavy': { name: '黄巾大刀兵', hp: 7, spd: 25, wind: .9, reach: 31, dmg: 2, heavy: true, sprite: 'yellow_heavy', scale: 1.02 },
  'yellow-shield': { name: '黄巾盾兵', hp: 8, spd: 24, wind: .8, reach: 25, dmg: 1.5, heavy: true, shield: true, rangedResist: .7, blocksPierce: true, sprite: 'yellow_shield', scale: 1 },
  'yellow-spear': { name: '黄巾枪兵', hp: 5, spd: 31, wind: .7, reach: 37, dmg: 1.5, sprite: 'yellow_spear', scale: .98 },
  'yellow-catapult': { name: '投石车', hp: 9, spd: 0, siege: true, w: 28, sprite: 'yellow_catapult', scale: 1.05 },
  zhang_liang: { name: '人公将军·张梁', hp: 54, spd: 24, wind: .78, reach: 34, dmg: 2.5, heavy: true, chapterBoss: true, sprite: 'zhang_liang', scale: .95 },
  'yellow-golem': { name: '黄巾力士', hp: 16, spd: 22, wind: 1, reach: 34, dmg: 3, heavy: true, noLaunch: true, w: 14, sprite: 'yellow_golem', scale: 1 },
  zhang_jiao: { name: '天公将军·张角', hp: 135, spd: 42, wind: .5, reach: 34, dmg: 3, chapterBoss: true, sprite: 'zhang_jiao', scale: 0.7105 },
  zhang_bao: { name: '地公将军·张宝', hp: 48, spd: 28, wind: .68, reach: 31, dmg: 2, chapterBoss: true, sprite: 'zhang_bao', scale: 1.15 },
};
const WAVES = [
  // 区域 1：纯教学，不随机
  { say: '黄巾贼来了！ | 棍子四连击，按住攻击键能蓄力', units: ['grunt', 'grunt', 'grunt', 'slinger'] },   // 一个投石手：逼玩家第一次走位、换目标
  // 区域 2：刀手首次登场（固定 2 个），其余随机
  { say: '几个提刀的贼人堵住了去路…… | 刀手举刀时头上冒「!」——翻滚躲开！',
    core: ['grunt', 'grunt', 'blade', 'blade'], budget: 4, pool: ['grunt', 'blade'],
    extra: ['grunt', 'blade'], extraAt: 2, extraSay: '后面又冲上来一队！' },
  // 区域 3：投石手首次登场
  { say: '远处有人朝这边扔石头！ | 别和投石手站在同一条线上',
    core: ['grunt', 'slinger', 'slinger'], budget: 5, pool: ['grunt', 'blade', 'slinger'],
    extra: ['blade', 'grunt'], extraAt: 2 },
  // 区域 4：弓箭手固定 2 个
  { say: '村民：「东头的弓手在放火箭！」 | 看到地上红圈快躲开，先打后面念咒的方士',
    core: ['grunt', 'blade', 'archer', 'archer', 'grunt', 'priest'], budget: 6, pool: ['grunt', 'blade', 'slinger', 'archer'],
    extra: ['blade', 'blade'], extraAt: 2, extraSay: '还有埋伏！', sleepers: [0, 5], sleepy: 2 },
  // 区域 5：老卒首次登场
  { say: '一个披甲的老兵挡在村口…… | 他血厚、打不断，绕到背后打',
    core: ['elite', 'priest'], budget: 7, sleepy: 3, sleepers: [0, 1], pool: ['grunt', 'blade', 'slinger', 'archer'],
    extra: ['slinger', 'grunt'], extraAt: 1, sleepers: [0] },
  { boss: true },   // 村口：黄巾流寇·管亥（js/boss.js）
];
// 威胁值：随机填充时按点数抽兵
const THREAT = { priest: 3, grunt: 1, blade: 2, slinger: 2, archer: 2, elite: 4 };
// 第二章沿用换新图前的数值；第一章的削弱不能影响第二章（含第二章校场）。
const CH2_LEGACY_STATS = { blade: { dmg: 2 }, priest: { hp: 5, spd: 44 } };
function inChapter2Context() {
  if (chapter2Run) return true;
  return !!(window.XIAOCHANG && XIAOCHANG.active() && XIAOCHANG.state()?.chapter === 2);
}
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
const RETREAT_SCREENS = 1.2;   // 非 Boss 战最多后退 1.2 个屏幕，防止无限风筝
let hero, zs, shots, eshots, fires, props, propFx, cam, gateI, lockR, kills, msg, msgT, freeze, shake, weapon = 'hammer', over, won;
let stoneHits = [];
let bluntHits = [];
let bleedFx = [];
let hammerFx = [];
let bladeFx = [];
let bowFx = [];
let chapter2Run = null;
// 结算相关：本局用时、被打次数、通关后的结算数据、区域清空延迟、结算板按钮、提示条
let runT = 0, hitsTaken = 0, endT = 0, result = null, clearAt = 0, uiBtns = [], toastMsg = '', toastT = 0;
let drops = [], floaters = [], reviveUsed = false, revives = 0;
let villagers = [], villagersStarted = false, villagersRewarded = false, villagersThanksT = -1;
let extraDone = false;
let archerAddsDone = false;   // Boss 二阶段是否已经召过弓箭手（一局只召一次）
let tutorialQueue = [];
const rnd = (a, b) => a + Math.random() * (b - a);
// 读锦囊数值（没抽卡时就是默认值）
const R_ = (k, d = 1) => { let value = window.ROGUE && ROGUE.S[k] != null ? ROGUE.S[k] : d; if (k === 'move' && window.ARTIFACT) value *= ARTIFACT.moveMult(); if (k === 'aspd' && window.SUPPLY) value *= SUPPLY.aspdMul();   // 太平飞剑：踩剑时移速 +10%
  return window.GEAR && (k === 'move' || k === 'aspd') ? GEAR.speed(k, value) : value; };
const maxHeroHp = () => window.GEAR ? GEAR.maxHp() : 10;
// 播放音效，按世界坐标 x 计算左右声道
function sfx(name, x) { if (window.SFX) SFX.play(name, x == null ? 0 : ((x - cam.x) / viewW()) * 2 - 1); }

function reset() {
  chapter2Run = null;
  M.top = 168;
  if (window.XIAOCHANG) XIAOCHANG.leave();
  if (window.WALLET) WALLET.startRun();
  M.W = 3600;
  const topTitle = document.querySelector('#top b');
  if (topTitle) topTitle.textContent = '无名之辈 · 序章：黄巾流寇';
  pendingWeapon = null;
  weapon = (window.TITLE && TITLE.preparedWeapon && TITLE.preparedWeapon()) || 'hammer';
  ui();
  if (window.ROGUE) ROGUE.reset();
  if (window.ARTIFACT) ARTIFACT.startRun();
  if (window.SUPPLY) SUPPLY.reset();
  if (window.MERIDIAN) MERIDIAN.startRun();   // 经脉：不屈每局一次
  if (!(window.TITLE && TITLE.blocks && TITLE.blocks())) flushLoads();   // 进了战斗就不再限速下图
  if (window.SFX && SFX.preloadVoices) setTimeout(() => { if (!(window.TITLE && TITLE.blocks && TITLE.blocks())) { flushLoads(); SFX.preloadVoices(['intro', 'guanhai_']); } }, 300);   // 第一章语音开局后慢慢下   // 神器：每局重新踩上飞剑、打落次数清零
  atkHeldSince = 0; charging = false; chargeTier = 0; chargeTierFlash = 0; chargeFx = []; chargeHitFx = []; deathLandedAt = null; enemiesCelebrating = false;
  comboCount = 0; comboExpireAt = 0; comboNotices = [];
  arenaL = null; boardSent = false; runBonus = 0;
  hero = { x: 60, y: (M.top + M.bot) / 2, f: 1, hp: 10, st: 'idle', t: 0, inv: 0, rollCd: 0, atk: null, q: 0, combo: 0, comboWin: 0, lastHit: -9, lastHitC: -1, lastShotC: 0, vx: 0, ix: 0, iy: 0 };
  if (window.GEAR) { GEAR.reset(); hero.hp = maxHeroHp(); }
  if (window.BOWAMMO) BOWAMMO.reset();
  enemySkillFx = []; zs = []; shots = []; eshots = []; fires = []; props = []; propFx = []; drops = []; floaters = []; villagers = []; villagersStarted = false; villagersRewarded = false; villagersThanksT = -1; reviveUsed = false; revives = 0; extraDone = false; catapults = []; gearSpins = []; allyShots = []; allyFires = []; stoneHits = []; bluntHits = []; bleedFx = []; hammerFx = []; bladeFx = []; bowFx = []; cam = { x: 0, y: 0 }; gateI = 0; lockR = Infinity; kills = 0; freeze = 0; shake = 0; over = false; won = false; if (window.Boss) Boss.reset();
  archerAddsDone = false;
  gameT = 0; runT = 0; hitsTaken = 0; endT = 0; result = null; clearAt = 0; uiBtns = []; toastMsg = ''; toastT = 0;
  for (let x = 160; x < M.W - 100; x += rnd(200, 320)) {
    const k = PROP_POOL[Math.floor(Math.random() * PROP_POOL.length)], [, pw, ph] = ASSETS.props[k];
    // 草垛和推车有 3 点耐久可以打坏，水井和旗子打不坏（hp 0）
    const psc = k === 'cart' ? .5 : 1;   // 推车整体缩到一半
    props.push({ g: k, x, y: rnd(M.top + 24, M.bot - 8), solid: true, broken: false, hp: (k === 'hay' || k === 'cart') ? 3 : 0, hitT: 0, sc: psc, w: k === 'flag' ? 6 : pw * .75 * psc, h: ph * psc });
  }
  tutorialQueue = [
    { text: matchMedia('(pointer:coarse)').matches ? '操作：左摇杆移动 | 攻击键出招，按住蓄力；翻滚键闪避' : '操作：WASD/方向键移动 | J 出招（按住蓄力），K 翻滚闪避', time: 4 },
    { text: '武器：棍范围大、四连击 | 锤可打断，石子可远程攻击', time: 4 },
    { text: '蓄力：按住攻击 0.4 秒开始，最多 2 秒 | 受击会打断，松开释放', time: 4 },
  ];   // 提示对所有人显示（简单模式只降低玩家受伤，不影响提示）
  say('这……是我刚才玩的那个游戏？村子被黄巾贼烧了！ | 往右走 →', 4);
}
function say(s, t = 3) { msg = s; msgT = t; }
function noviceMode() { if (window.XIAOCHANG && XIAOCHANG.active()) return false; return !(window.TITLE && TITLE.noviceMode) || TITLE.noviceMode(); }   // 默认（简单）= 玩家受伤减半，击倒判定仍按减半前伤害
function hardMode() { return !!(window.TITLE && TITLE.hardMode && TITLE.hardMode()); }

// ---------- 输入 ----------
const IS_TOUCH = matchMedia('(pointer:coarse)').matches;   // 手机：受伤 -20%、翻滚无敌 +0.05 秒、出招自动转向
const key = {}; let joy = null, pressAtk = false, pressRoll = false;
// 完美闪避 / 蓄力重击
let slowT = 0, critT = 0, pdCd = 0;          // 慢动作剩余 / 暴击窗 / 完美闪避冷却
let ghosts = [];                              // 残影
const CHARGE_MS = 400;
let chargeTier = 0, chargeTierFlash = 0;
function chargeMaxMs() {
  const base = WEAP[weapon] && WEAP[weapon].class === 'ranged' ? 1200 : 1600;
  return base * (window.GEAR ? GEAR.chargeScale() : 1) * (window.ROGUE && ROGUE.chargeScale ? ROGUE.chargeScale() : 1) * (window.MERIDIAN ? MERIDIAN.x('chargeMul', 1) : 1);
}
function chargeGateMs() { return CHARGE_MS * (window.GEAR ? GEAR.chargeScale() : 1) * (window.ROGUE && ROGUE.chargeScale ? ROGUE.chargeScale() : 1) * (window.MERIDIAN ? MERIDIAN.x('chargeMul', 1) : 1); }
function chargeTierFor(held) {
  const max = chargeMaxMs();
  if (held >= max) return 3;
  if (held >= max / 2) return 2;
  if (held >= chargeGateMs()) return 1;
  return 0;
}
function updateChargeTier() {
  if (!charging || !atkHeldSince) { chargeTier = 0; return; }
  const next = chargeTierFor(performance.now() - atkHeldSince);
  if (next > chargeTier) {
    chargeTier = next; chargeTierFlash = .18;
    if (window.SFX) SFX.play('blip', 0, 1 + chargeTier * .16);
  } else if (next < chargeTier) chargeTier = next;
}
let atkHeldSince = 0, charging = false, chargeFx = [], chargeHitFx = [];   // 攻击按住待判定 / 蓄力状态
let deathLandedAt = null, enemiesCelebrating = false;
function chargeRatio(now = performance.now()) { return atkHeldSince ? Math.min(1, Math.max(0, (now - atkHeldSince) / chargeMaxMs())) : 0; }
addEventListener('keydown', e => {
  if (window.XIAOCHANG && XIAOCHANG.blocks()) return;
  if (result && !e.repeat && !(e.target && e.target.tagName === 'INPUT') && resultKey(e)) { e.preventDefault(); return; }   // 结算界面：键盘选按钮
  if (e.target && ['INPUT','SELECT','BUTTON'].includes(e.target.tagName) && window.XIAOCHANG && XIAOCHANG.active()) return;
  if (e.target && e.target.tagName === 'INPUT') return;   // 在标题页输入名字时别触发游戏按键
  if (window.TITLE && TITLE.blocks()) return;             // 标题/转场期间不响应游戏按键
  if (e.code === 'KeyJ' && !key.KeyJ) atkPress();
  key[e.code] = 1;
  if (e.code === 'KeyK' || e.code === 'Space') pressRoll = true;
  if (e.code === 'KeyU' && !e.repeat && !over && !won && !result && window.ROGUE) {
    useRogueSkill();
  }
  // KeyI 预留给后续法器技能，暂不绑定
  if (e.code === 'Digit1') setW(longWeapon()); if (e.code === 'Digit2') setW(shortWeapon()); if (e.code === 'Digit3') setW(rangedWeapon());
  if (e.code === 'KeyR') { if(window.XIAOCHANG && XIAOCHANG.active())XIAOCHANG.start();else reset(); }
  if (chapter2Run && chapter2Run.mode === 'choice' && e.code === 'Digit1') chooseChapter2Route('zhang-liang');
  if (chapter2Run && chapter2Run.mode === 'choice' && e.code === 'Digit2') chooseChapter2Route('zhang-bao');
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', e => { key[e.code] = 0; if (e.code === 'KeyJ') atkRelease(); });
addEventListener('contextmenu', e => e.preventDefault());   // 手机长按不弹菜单
const jz = document.getElementById('joy'), jk = document.getElementById('knob');
jz.addEventListener('pointerdown', e => { if (joy) return; e.preventDefault(); joy = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; jz.setPointerCapture(e.pointerId); });
jz.addEventListener('pointermove', e => { if (!joy || e.pointerId !== joy.id) return; let dx = e.clientX - joy.x, dy = e.clientY - joy.y, l = Math.hypot(dx, dy); if (l > 40) { dx *= 40 / l; dy *= 40 / l; } joy.dx = dx / 36; joy.dy = dy / 36; jk.style.transform = `translate(${dx}px,${dy}px)`; });
const endJ = e => { if (joy && e && e.pointerId !== joy.id) return; joy = null; jk.style.transform = ''; };
jz.addEventListener('pointerup', endJ); jz.addEventListener('pointercancel', endJ);
// 多点触控：只有攻击键自己的手指可以结束蓄力。
let attackPointer = null;
const attackButton = document.getElementById('bA');
attackButton.addEventListener('pointerdown', e => {
  if (attackPointer !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
  e.preventDefault(); e.stopPropagation(); attackPointer = e.pointerId;
  try { attackButton.setPointerCapture(e.pointerId); } catch (_) {}
  atkPress();
});
const endAttackPointer = e => {
  if (e.pointerId !== attackPointer) return;
  attackPointer = null;
  if (e.type === 'pointercancel' || e.type === 'lostpointercapture') cancelCharge();
  else atkRelease();
};
attackButton.addEventListener('pointerup', endAttackPointer);
attackButton.addEventListener('pointercancel', endAttackPointer);
attackButton.addEventListener('lostpointercapture', endAttackPointer);
window.addEventListener('pointerup', endAttackPointer);
window.addEventListener('blur', () => { attackPointer=null; cancelCharge(); endJ(); for (const k in key) key[k]=0; });
document.addEventListener('visibilitychange', () => { if (document.hidden) { attackPointer=null; cancelCharge(); endJ(); for (const k in key) key[k]=0; } });
document.getElementById('bR').addEventListener('pointerdown', e => { e.preventDefault(); pressRoll = true; });
// 将令（主动技能锦囊）：万箭齐发 / 霹雳飞石 / 雷霆万钧，共用一个按钮和 U 键
function useRogueSkill() { const k = ROGUE.useSkill ? ROGUE.useSkill() : ''; if (k === 'wanjian') summonArchersVolley(); else if (k === 'toushi') catapultVolley(); }
document.getElementById('bSkill').addEventListener('pointerdown', e => { e.preventDefault(); if (!over && !won && !result && window.ROGUE) useRogueSkill(); });
document.getElementById('bCatapult').addEventListener('pointerdown', e => { e.preventDefault(); if (!over && !won && !result && window.ROGUE && ROGUE.useCatapult()) catapultVolley(); });
function toolbarWeapon(slot) { return slot === 'staff' ? longWeapon() : slot === 'hammer' ? shortWeapon() : slot === 'stone' ? rangedWeapon() : slot; }
document.querySelectorAll('[data-w]').forEach(b => {
  b.addEventListener('pointerdown', e => { if(e.pointerType==='mouse'&&e.button!==0)return; e.preventDefault(); e.stopPropagation(); setW(toolbarWeapon(b.dataset.w)); });
  b.addEventListener('click', e => { if(e.detail===0)setW(toolbarWeapon(b.dataset.w)); });
});
function longWeapon() { return (window.TITLE && TITLE.equippedWeapon && TITLE.equippedWeapon('long')) || 'staff'; }
function shortWeapon() { return (window.TITLE && TITLE.equippedWeapon && TITLE.equippedWeapon('short')) || 'hammer'; }
function rangedWeapon() { return (window.TITLE && TITLE.equippedWeapon && TITLE.equippedWeapon('ranged')) || 'stone'; }
document.getElementById('bWeapon').addEventListener('pointerdown', e => {   // 手机：循环切换武器
  e.preventDefault();
  const order = [longWeapon(), shortWeapon(), rangedWeapon()].filter(w=>!window.ARMORY||ARMORY.active(w));
  const i = order.indexOf(pendingWeapon || weapon);
  setW(order[(i + 1) % order.length]);
});
let pendingWeapon = null;
function setW(w) {
  if ((window.ARMORY && !ARMORY.active(w)) || !WEAP[w] || ((w === 'bow' || w === 'halberd' || w === 'blade') && window.TITLE && TITLE.ownsWeapon && !TITLE.ownsWeapon(w))) return;
  if (over || won || (window.TITLE && TITLE.blocks())) return;
  if (hero && (hero.air || ['hurt','down','bounce','getup'].includes(hero.st))) { pendingWeapon=w; ui(); return; }
  pendingWeapon=null;
  const changed = weapon !== w;
  if (weapon !== w && hero && hero.st === 'atk') { hero.st = 'idle'; hero.t = 0; hero.atk = null; hero.q = 0; hero.combo = 0; hero.comboWin = 0; }
  if (weapon !== w && window.GEAR) { weapon = w; GEAR.switch(); cancelCharge(); }
  else weapon = w;
  ui();
  if (changed) toast('切换：' + WEAP[w].name);
  if (changed && hero && window.ROGUE && ROGUE.onSwap && ROGUE.onSwap()) startAtk();   // 倒持：发光时切武器直接挥出新武器终段
}
function ui() {
  document.querySelectorAll('[data-w]').forEach(b => {
    const id = toolbarWeapon(b.dataset.w), W = WEAP[id];
    b.classList.toggle('on', id === weapon);
    b.classList.toggle('weapon-pending', id === pendingWeapon);
    b.setAttribute('aria-pressed', String(id === weapon));
    b.disabled = !!(window.ARMORY && !ARMORY.active(id));
    b.title = W.name; b.setAttribute('aria-label', W.name);
    const img = b.querySelector('img'), icon = id === 'halberd' ? 'w_halberd' : 'w_' + id;
    if (img && ASSETS.ui[icon]) { if (img.dataset.weaponIcon !== icon) img.src = ASSETS.ui[icon]; img.dataset.weaponIcon = icon; img.alt = W.name; }
  });
}

// ---------- 碰撞 ----------
// 竖放拒马（p.vert）：从 p.y（前端）往场地深处延伸 p.d，越往里越偏右 VERT_K
const VERT_K = 0;
const propTop = p => p.y - (p.vert ? p.d : 0);
const propDY = (p, y) => p.vert ? Math.max(0, p.y - p.d - y, y - p.y) : Math.abs(p.y - y);
const propXAt = (p, y) => p.vert ? p.x + ((p.y - Math.max(propTop(p), Math.min(p.y, y))) - p.d / 2) * VERT_K : p.x;
function blocked(x, y) {
  for (const p of props) if (p.solid && Math.abs(x - propXAt(p, y)) < p.w / 2 && y > propTop(p) - 6 && y < p.y + 2) return true;
  return false;
}
function moveEnt(e, dx, dy) {
  if (window.GEAR && e !== hero) { const mult=GEAR.enemyMove(e); dx*=mult; dy*=mult; }
  if (window.ROGUE && e !== hero && ROGUE.enemyMove) { const m = ROGUE.enemyMove(e); dx *= m; dy *= m; }   // 水淹七军减速
  if (e !== hero && e.halberdBleed > 0 && gameT < e.halberdBleedUntil) { dx *= .9; dy *= .9; }   // 裂伤减速
  e.bx = false;
  if (!blocked(e.x + dx, e.y)) e.x += dx; else e.bx = true;
  if (!blocked(e.x, e.y + dy)) e.y += dy;
  // 被道具挡住时"先往旁边走、绕过道具边缘，再继续前进"（只对敌人；玩家仍会被挡住）
  if (e !== hero) {
    const dir = Math.sign(dx) || e.f || 1;
    const p = props.find(q => q.solid && !q.broken &&
      Math.abs(propXAt(q, e.y) - (e.x + dir * 16)) < q.w / 2 + 14 && propDY(q, e.y) < 20);
    if (p) {
      // 选定绕行方向后至少坚持 0.8 秒，避免每帧上下换方向（看起来在抖）；靠边那侧走不通就直接选另一侧
      if (e.avoidDir == null || gameT > (e.avoidUntil || 0) + 2) {
        e.avoidDir = (e.y <= (propTop(p) + p.y) / 2 ? -1 : 1);
        const gy = e.avoidDir < 0 ? propTop(p) - 22 : p.y + 22;
        if (gy < M.top + 3 || gy > M.bot - 2) e.avoidDir *= -1;
        e.avoidUntil = gameT + .8;
      }
      const goalY = e.avoidDir < 0 ? propTop(p) - 22 : p.y + 22;                              // 让开 22，能看出是绕过去
      const vs = Math.min(3, ((e.T && e.T.spd) || 40) / 60 * 1.7);      // 侧向走速（比它正常速度快一点）
      const ny = e.y + Math.sign(goalY - e.y) * Math.min(vs, Math.abs(goalY - e.y));
      if (ny > M.top + 3 && ny < M.bot - 2 && !blocked(e.x, ny)) e.y = ny;
      else if (gameT > e.avoidUntil) { e.avoidDir *= -1; e.avoidUntil = gameT + .8; }
      if (Math.abs(e.y - goalY) < 1.5) { e.passProp = p; e.passY = goalY; e.avoidDir = null; }   // 已经让开了：记住这条绕行线，直到走过道具
    }
    // 绕行中：在走过道具之前不许再往道具那边靠（否则会在边缘上下来回抖）
    const pp = e.passProp;
    if (pp) {
      if (pp.broken || !pp.solid || Math.abs(e.x - propXAt(pp, e.passY)) > pp.w / 2 + 18) e.passProp = null;
      else if (e.passY < propTop(pp)) e.y = Math.min(e.y, e.passY); else e.y = Math.max(e.y, e.passY);
    }
  } else e.avoidDir = null;
  e.y = Math.max(M.top, Math.min(M.bot, e.y)); e.x = Math.max(10, Math.min(M.W - 10, e.x));
  if (lockR < Infinity && !e.siegeArcher) {   // 投石车弓手守在屏幕外的岗位上，不拉进屏幕
    const lo = cam.x + (e === hero ? 12 : 10), hi = Math.min(lockR, cam.x + viewW()) - (e === hero ? 12 : 10);
    e.x = Math.max(lo, Math.min(e.x, Math.max(lo, hi)));   // 敌人也不许被打出场外（否则打不到、卡关）
  }
  if (e === hero && arenaL != null) e.x = Math.max(arenaL + 12, e.x);   // Boss 战场地左边界
}

// ---------- 刷怪 ----------
function viewW() { return cv.width / (cv.height / M.viewH); }
// 非 Boss 战：从开战线/开战点往左最多退 RETREAT_SCREENS 屏，避免无限后退风筝
function setRetreatLimit(anchorX) { arenaL = Math.max(0, anchorX - viewW() * RETREAT_SCREENS); }
// 召唤援军弓箭手：左右各 3 个，射 2 轮就撤
function priestCast(z) {
  sfx('stamp', z.x); shake = Math.max(shake, .08);
  blessFx.push({ x: z.x, y: z.y, t: 0, T: .45 });
  const priority=chapter2Run&&zs.filter(o=>!o.dead&&o.type==='yellow-heavy'&&o.hp<o.T.hp&&Math.abs(o.x-z.x)<=170&&Math.abs(o.y-z.y)<=80).sort((a,b)=>a.hp/a.T.hp-b.hp/b.T.hp)[0];
  for (const o of priority?[priority]:zs) {
    if (o === z || o.dead || o.T.boss) continue;
    if (Math.abs(o.x - z.x) > 170 || Math.abs(o.y - z.y) > 80) continue;   // 回血范围加大（原 120×60）
    if (o.hp < o.T.hp) {
      o.hp = Math.min(o.T.hp, o.hp + 2);
      floaters.push({ x: o.x, y: o.y - 26, t: 0, txt: '+2', heal: true });
    }
    o.blessT = 4;                        // 只刷新时间，不叠层
  }
}

function firePriestCast(z) {
  const tx = hero.x, ty = hero.y;
  eshots.push({ k: 'fire', ball: true, x0: z.x + z.f * 12, y0: z.y - 12, tx, ty, t: 0, T: 1, short: 2 });
  sfx('sling', z.x);
}
function summonArchers(bz) {
  if (window.XIAOCHANG && XIAOCHANG.active()) { XIAOCHANG.summonArchers(bz); return; }
  say('管亥：「弓箭手，放箭！」', 2.4);
  sfx('bladeAlert', bz.x);
  const vw = viewW(), leftX = cam.x - 40, rightX = cam.x + vw + 40;
  const ys = [[], []];
  for (const side of ys) for (let i = 0; i < 3; i++) {
    let y, tries = 0;
    do { y = rnd(M.top + 20, M.bot - 14); tries++; }
    while (side.some(other => Math.abs(other - y) < 12) && tries < 40);
    side.push(y);
  }
  for (let i = 0; i < 3; i++) {
    for (const [side, x, dir, y] of [[-1, leftX, 1, ys[0][i]], [1, rightX, -1, ys[1][i]]]) {
      spawn('archer', x, y);
      const z = zs[zs.length - 1];
      const standX = side < 0 ? cam.x + 70 + i * 26 : cam.x + vw - 70 - i * 26;
      z.adds = 2; z.standX = standX;
      z.addExitX = x; z.addExitDir = side; z.addOrder = i;
      z.addDelay = z.addOrder * .35; z.volleyGap = 0;
      z.st = 'addwalk'; z.t = 0; z.f = dir; z.cd = 99; z.tok = false; z.moving = true;
    }
  }
}

function spawn(type, x, y, sleeping = false) {
  const base = TYPES[type];
  const legacy = inChapter2Context() && CH2_LEGACY_STATS[type];
  const T = legacy ? { ...base, ...legacy } : base;
  // 出生点避开道具：卡在水井/推车里的怪既打不到也打不了你
  for (let tries = 0; sleeping ? false : tries < 14; tries++) {
    const bad = props.some(p => !p.broken && Math.abs(p.x - x) < (p.w || 10) / 2 + 11 && Math.abs(p.y - y) < (p.h || 10) / 2 + 13);
    if (!bad) break;
    y = rnd(M.top + 8, M.bot - 6);
    x += rnd(-16, 16);
  }
  zs.push({ type, T, sprite: T.sprite || type, x, y, f: -1, hp: T.hp, st: sleeping ? 'sleep' : 'move', t: sleeping ? 0 : rnd(0, 1), stun: 0, flash: 0, vx: 0, tok: false, cd: rnd(.8, 2), slot: zs.length,
    sc: T.scale || 1, dark: false });
  const z0 = zs[zs.length - 1];
  if (window.XIAOCHANG && XIAOCHANG.active()) XIAOCHANG.decorate(z0);
  if (sleeping) {
    const h = props.find(p => p.g === 'hay' && !p.broken && Math.abs(p.x - x) < 70 && Math.abs(p.y - y) < 40);
    if (h) { z0.hidden = true; z0.hx = h.x; }
  }
}
function startVillagers(edgeX) {
  if (villagersStarted) return;
  villagersStarted = true;
  const vw0 = viewW();
  const startX = cam.x + vw0 / 3;                     // 左起 1/3 处开始逃
  const y = M.bot - 8;                                 // 贴着画面最下面那条路走（用户要求）
  // 老人先跑，年轻女子跟在身后；角色不参与阻挡和清区计数。
  villagers = [
    { ch: 'villager_old', x: startX, y: y, state: 'run', t: 0, flash: 0, f: -1, speed: 30, sc: 1 },
    { ch: 'villager_woman_cream', x: startX + 26, y: y - 4, state: 'run', t: .18, flash: 0, f: -1, speed: 30, sc: 1 },
    { ch: 'villager_woman_green', x: startX + 50, y: y - 1, state: 'run', t: .36, flash: 0, f: -1, speed: 30, sc: 1 },
    { ch: 'villager_woman_red', x: startX + 74, y: y - 5, state: 'run', t: .54, flash: 0, f: -1, speed: 30, sc: 1 },
  ];
  spawn('grunt', startX + 150, y);
  const chaser = zs[zs.length - 1];
  chaser.villagerChaser = true;
  chaser.f = -1;
  say('村民：「黄巾贼来了！快跑啊！」', 2.8);
}
function thankVillagers() {
  if (villagersRewarded) return;
  const present = villagers.filter(v => v.state === 'run');
  if (!present.length) return;   // 村民已经逃出画面，本次遭遇就算错过了
  present.forEach(v => { v.state = 'bow'; v.t = 0; v.f = hero.x < v.x ? -1 : 1; });
  villagersThanksT = 1.5;
}
function updateVillagers(dt) {
  for (const v of villagers) {
    v.flash = Math.max(0, v.flash - dt);
    v.t += dt;
    if (v.state === 'run') v.x -= v.speed * dt;
    else if (v.state === 'leave') v.x -= 26 * dt;
    if ((v.state === 'run' || v.state === 'leave') && v.x < cam.x - 40) v.state = 'gone';
  }
  if (villagersThanksT >= 0) {
    villagersThanksT -= dt;
    if (villagersThanksT <= 0) {
      const bowing = villagers.filter(v => v.state === 'bow');
      if (bowing.length && !villagersRewarded) {
        villagersRewarded = true;
        say('村民感激地送上一枚锦囊', 2.4);
        if (window.ROGUE) ROGUE.offer();     // 直接开三选一（不再掉地上的包裹）
      }
      bowing.forEach(v => { v.state = 'leave'; v.t = 0; v.f = -1; });
      villagersThanksT = -1;
    }
  }
  villagers = villagers.filter(v => v.state !== 'gone');
}
function drawVillager(v) {
  shadow(v.x, v.y, 8);
  const frame = v.state === 'bow' ? 'bow' : (v.state === 'run' || v.state === 'leave') ? (Math.floor(v.t * 8) % 2 ? 'run1' : 'run2') : 'idle';
  drawChar(v.ch, frame, v.x, v.y, v.f < 0, 1, v.flash > 0, v.sc);
}
function waves(dt = 0) {
  if (window.XIAOCHANG && XIAOCHANG.active()) { XIAOCHANG.update(dt); return; }
  if (chapter2Run) { chapter2Waves(); return; }
  const vw = viewW();
  // 区域清空：没有活着的敌人就算（尸体还躺在地上也算），等 1.4 秒让倒地/击飞演完再放行
  if (lockR < Infinity && zs.some(z => !z.dead) && !zs.some(z => !z.dead && z.st !== 'sleep')) {
    zs.forEach(z => { if (z.st === 'sleep') { set(z, 'wake'); z.t = 0; sfx('wake', z.x); } });
  }
  if (lockR < Infinity && !zs.some(z => !z.dead)) {
    const bossDone = WAVES[gateI] && WAVES[gateI].boss;
    if (!clearAt) clearAt = gameT + (bossDone ? 8 : villagersThanksT >= 0 ? 2 : 1.4);   // 打败管亥后留时间演结尾台词   // 救下村民时先让鞠躬和锦囊掉落演完
    if (gameT >= clearAt) {
      clearAt = 0; lockR = Infinity; gateI++; arenaL = null;
      if (gateI < M.gates.length) say(WAVES[gateI].boss ? '前面是村口……小心！' : '区域清空！GO →');
      else won = true;
      if (!won && window.ROGUE) ROGUE.offer();   // 每清一个区域，抽一次锦囊   // 通关文案交给结算板，这里不再刷长句
    }
  }
  // 波中波：本区域还剩少量敌人时，从右侧再补一批（每区一次）
  if (lockR < Infinity && !extraDone) {
    const W = WAVES[gateI];
    if (W && W.extra) {
      const alive = zs.filter(z => !z.dead && z.st !== 'sleep').length;   // 装死的不算，避免和波中波叠成 4 个
      if (alive <= (W.extraAt || 2)) {
        extraDone = true;
        W.extra.forEach((u2, i) => spawn(u2, lockR - rnd(8, 30) - i * 10, rnd(M.top + 6, M.bot - 6)));
        zs.forEach(z => { if (z.st === 'sleep') { set(z, 'wake'); z.t = 0; sfx('wake', z.x); } });   // 尸体一起站起来
        if (W.extraSay) say(W.extraSay, 2.4);
        else say('又冲上来一队！', 2.2);
      }
    }
  }
  if (lockR === Infinity && gateI < M.gates.length && hero.x > M.gates[gateI]) {
    const gx = M.gates[gateI], W = WAVES[gateI]; lockR = gx + vw * 0.6; clearAt = 0; extraDone = false;
    setRetreatLimit(gx);
    if (W.boss) { Boss.start(lockR); return; }
    const list = W.units || (W.core || []).concat(rollFill(W.pool || [], W.budget || 0));
    list.forEach((u, i) => {
      const left = i === list.length - 1 && list.length > 3 && !TYPES[u].ranged;   // 最后一个近战从左边包过来
      const sleeping = (W.sleepers && W.sleepers.includes(i)) || (W.sleepy && i >= list.length - W.sleepy);
      let y = sleeping ? (gateI % 2 ? M.bot - 14 : M.top + 14) : rnd(M.top + 6, M.bot - 6);
      let sx = left ? cam.x + 5 : lockR - rnd(5, 40) - i * 8;
      if (sleeping) {
        const hay = props.find(p => p.g === 'hay' && !p.broken && Math.abs(p.x - sx) < 240);
        if (hay) { sx = hay.x + (Math.random() < .5 ? -24 : 24); y = hay.y; }   // 躲在草垛边上
      }
      spawn(u, sx, y, sleeping);
    });
    if (W.say) say(W.say, 4);
    if (gateI === 0) startVillagers(lockR);
  }
}

function addChapter2Props(battle = 1) {
  // 每战重新摆放；jumo 挡路可打碎，其余新道具与旗帜只作装饰。
  if (battle === 1 || battle === 6) props = props.filter(p => !p.chapter2);
  // 旗子插在场地最后排（贴着上边缘，像背景的一部分）；其他道具分散在前 120～420 的范围，留出中间的通道
  const T = M.top, B = M.bot, C = (M.top + M.bot) / 2;
  const layouts = {
    1: [['jumo_v', 110, C + 30], ['sacks', 260, T + 20], ['crate', 380, B - 12], ['flag_y', 200, T + 4]],
    2: [['debris', 150, B - 15], ['rack', 300, T + 18], ['jumo_vs', 120, C - 30], ['flag_y', 240, T + 4]],
    3: [['stones', 140, T + 22], ['brazier', 300, B - 12], ['crate', 420, C + 30]],
    4: [['jumo_v', 130, C + 20], ['rack', 330, B - 14], ['flag_y', 230, T + 4]],   // 黄旗打落给锦囊； 「人」字旗改由张梁出场时亲手插下（CH2B）
    5: [['sacks', 300, T + 22], ['stones', 140, B - 14]],   // 「地」字旗改由张宝出场时亲手插下（CH2B）
  };
  if (battle === 6) { addAltarProps(); return; }
  const place = layouts[battle] || [];
  for (const [g, dx, y] of place) {
    const meta = ASSETS.props[g];
    if (!meta) continue;
    const [, pw, ph] = meta;
    const solid = g.startsWith('jumo') || g === 'sacks' || g === 'crate' || g === 'rack';
    const oldProp = g === 'sacks' || g === 'crate' || g === 'rack';
    const vert = g.startsWith('jumo_v');   // 拒马竖着摆：顺着场地深度方向拦路（jumo_v 长 / jumo_vs 短）
    const vd = g === 'jumo_v' ? 40 : 28;
    props.push({ g, x: battle === 6 ? dx : hero.x + dx, y: vert ? y + vd / 2 : y, solid, broken: false,
      hp: g.startsWith('flag_') ? 2 : 3, hitT: 0, sc: 1, vert, d: vert ? vd : 0,
      w: vert ? 18 : pw * (oldProp ? .75 : 1), h: ph, chapter2: true, back: g.startsWith('flag') });
  }
}

// 祭台战（第六战）：背景图 2000×849 画成 300 高 → 宽 ALTAR_W；坐标都按这张图量
const ALTAR_W = Math.round(300 * 2000 / 849), ALTAR_C = { x: 353, y: 212 };
const ALTAR_COFFIN = { x: 117, y: 100 };   // 背景图里画好的开口棺材（棺口约在 y-28）   // 棺材放在祭台台面左半边、靠里一点（用户：别压在台阶口和台面前沿上）   // 圆形石坪中心
// 之后张角开场要用的：'coffin_open' 炸开的棺材、'coffin_lid' 飞出去的棺盖
function addAltarProps() {
  const P = (g, x, y, o) => { const [, w, h] = ASSETS.props[g] || [0, 10, 10]; props.push(Object.assign({ g, x, y, w, h, sc: 1, hitT: 0, hp: 0, solid: false, broken: false, chapter2: true }, o)); };
  P('bagua', ALTAR_C.x, ALTAR_C.y + 40, { back: true, ground: true, dw: 300, dh: 82, alpha: .82 });   // 八卦阵：贴地，画在人物下面
   // 正面棺材（用户补图），按 meta 尺寸画   // 底边落在祭台台面上（之前飘在台面后沿）
  P('flag_huang', 276, 127, { back: true, flip: true });                // 「黄天当立」，和右边的苍天旗一左一右
  P('flag_cang', 478, 124, { back: true });                 // 「苍天已死」血字旗，插在法台右侧                                  // 棺材摆在左侧祭台台面上
  // 八盏符灯立在八个卦位上（椭圆），打灭一盏少一盏；全灭后张角的法术阶段直接结束（张角接入后用 altarLampsLeft()）
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4 - Math.PI / 2;
    P('fudeng', Math.round(ALTAR_C.x + Math.cos(a) * 138), Math.round(ALTAR_C.y + Math.sin(a) * 36), { hp: 3, solid: true, w: 10, lamp: true });
  }
}
// 张角预览（战斗逻辑未接入前）：法台上浮空施法 / 降雷交替；地上站一个待机的，方便和主角比大小
const ZJ_HI = 1.9;   // 张角像素图比普通角色细 1.9 倍（用户嫌像素太糙），所以绘制缩放要除掉
const ZJ_SCALE = 1.35 / ZJ_HI;   // 下台决斗的张角：和法台上看起来一样大（法台那几帧原图本来就画得大）
const ALTAR_STAGE = { x: 353, y: 91 };   // 法台顶上平台（背景图上量的）
function drawZhangJiaoPreview() {
  const t = performance.now() / 1000, cyc = t % 3.2, fr = cyc < 2 ? 'float' : 'thunder';
  drawChar('zhang_jiao', fr, ALTAR_STAGE.x, ALTAR_STAGE.y - 4 + Math.sin(t * 2.2) * 2.5, hero.x < ALTAR_STAGE.x, 1, false, 1.12 / ZJ_HI);
  const gx = ALTAR_C.x + 175, gy = ALTAR_C.y + 30, walk = ['idle', 'wind', 'strike', 'idle'][Math.floor(t / .8) % 4];
  drawChar('zhang_jiao', walk, gx, gy, hero.x < gx, 1, false, ZJ_SCALE);
}
const altarLampsLeft = () => props.filter(p => p.lamp && p.g === 'fudeng').length;
// 第二章每战波次：每项是一个 spawn 函数，保持现有 spawn / 单位名。
const CHAPTER2_WAVES = {
  1: [
    () => { spawn('yellow-heavy', hero.x + 190, M.top + 28); spawn('yellow-heavy', hero.x + 215, M.bot - 23); spawn('archer', hero.x + 330, (M.top + M.bot) / 2); },
    () => { spawn('yellow-heavy', hero.x + 230, M.top + 20); spawn('yellow-heavy', hero.x + 230, M.bot - 20); spawn('slinger', hero.x + 300, M.top + 20); spawn('slinger', hero.x + 320, M.bot - 20); },
    () => { spawn('yellow-heavy', hero.x + 190, (M.top + M.bot) / 2 - 20); spawn('yellow-heavy', hero.x + 190, (M.top + M.bot) / 2 + 20); spawn('priest', hero.x + 340, (M.top + M.bot) / 2 - 16); spawn('priest', hero.x + 340, (M.top + M.bot) / 2 + 16); },
  ],
  2: [
    () => { spawn('yellow-shield', hero.x + 190, (M.top + M.bot) / 2 - 20); spawn('yellow-shield', hero.x + 190, (M.top + M.bot) / 2 + 20); spawn('archer', hero.x + 310, (M.top + M.bot) / 2 - 20); spawn('archer', hero.x + 310, (M.top + M.bot) / 2 + 20); },
    () => { spawn('yellow-shield', hero.x + 190, M.top + 28); spawn('yellow-shield', hero.x + 190, M.bot - 28); spawn('yellow-spear', hero.x + 250, (M.top + M.bot) / 2 - 18); spawn('yellow-spear', hero.x + 250, (M.top + M.bot) / 2 + 18); },
    () => { spawn('yellow-shield', hero.x + 190, (M.top + M.bot) / 2); spawn('yellow-heavy', hero.x + 210, M.top + 24); spawn('archer', hero.x + 310, (M.top + M.bot) / 2 - 20); spawn('archer', hero.x + 310, (M.top + M.bot) / 2 + 20); },
  ],
  3: [
    () => { spawn('yellow-shield', hero.x + 180, (M.top + M.bot) / 2 - 20); spawn('yellow-shield', hero.x + 180, (M.top + M.bot) / 2 + 20); spawn('archer', hero.x + 290, (M.top + M.bot) / 2 - 20); spawn('archer', hero.x + 290, (M.top + M.bot) / 2 + 20); },
    () => {
      // 投石车阵刷在主角往右一屏：先把锁屏右边界往右推一屏，玩家要往前推进才碰到拒马墙
      const vw = viewW(), R = Math.min(M.W, hero.x + vw * 1.6);
      lockR = R; say('投石车阵就在前方！往右推进 →', 2.5);
      for (let i = 0; i < 5; i++) {
        spawn('yellow-catapult', R - 40 + i * 6, M.top + 10 + (M.bot - M.top - 20) * i / 4);
        const z = zs[zs.length - 1]; z.f = -1; z.static = true; z.cd = [2.4, 3.5, 4.6, 5.8, 7.0][i] + 1.5; z.catapultIndex = i;
      }
      spawn('yellow-shield', R - 260, (M.top + M.bot) / 2 - 20);
      spawn('yellow-shield', R - 260, (M.top + M.bot) / 2 + 20);
      spawn('yellow-heavy', R - 230, M.top + 18); spawn('yellow-heavy', R - 230, M.bot - 18);   // 守车大刀兵
    },
  ],
  4: [
    () => { spawn('yellow-heavy', hero.x + 190, (M.top + M.bot) / 2 - 24); spawn('yellow-heavy', hero.x + 205, (M.top + M.bot) / 2); spawn('yellow-heavy', hero.x + 190, (M.top + M.bot) / 2 + 24); spawn('yellow-spear', hero.x + 270, (M.top + M.bot) / 2); },
    () => { for (let i = 0; i < 3; i++) spawn('yellow-spear', hero.x + 200 + i * 28, (M.top + M.bot) / 2); spawn('yellow-heavy', hero.x + 235, M.top + 22); spawn('yellow-heavy', hero.x + 235, M.bot - 22); },
    () => { spawn('zhang_liang', hero.x + 280, (M.top + M.bot) / 2); const boss = zs[zs.length - 1]; boss.f = -1; boss.cd = 1.4; boss.bossLabel = TYPES.zhang_liang.name; spawn('yellow-heavy', hero.x + 210, M.top + 24); spawn('yellow-spear', hero.x + 220, M.bot - 20); },
  ],
  5: [
    () => { for (const y of [M.top + 18, (M.top + M.bot) / 2, M.bot - 18]) spawn('yellow-shield', hero.x + 190, y); spawn('archer', hero.x + 310, (M.top + M.bot) / 2 - 20); spawn('archer', hero.x + 310, (M.top + M.bot) / 2 + 20); },
    () => { spawn('yellow-shield', hero.x + 190, M.top + 24); spawn('yellow-shield', hero.x + 190, M.bot - 24); spawn('priest', hero.x + 330, M.top + 22); spawn('priest', hero.x + 330, (M.top + M.bot) / 2); spawn('priest', hero.x + 330, M.bot - 22); },
    () => { spawn('zhang_bao', hero.x + 280, (M.top + M.bot) / 2); const boss = zs[zs.length - 1]; boss.f = -1; boss.cd = 1.4; boss.bossLabel = TYPES.zhang_bao.name; spawn('yellow-shield', hero.x + 200, (M.top + M.bot) / 2 - 22); spawn('priest', hero.x + 320, (M.top + M.bot) / 2 + 22); },
  ],
  6: [],
};
const CHAPTER2_TITLES = ['', '曹军入阵', '盾阵', '投石车阵', '追击张梁', '追击张宝', '祭台决战'];

function prepareChapter2Run(showOpening, battle = 1) {
  if (window.TITLE && TITLE.skip) TITLE.skip();
  if (window.ROOM && ROOM.skip) ROOM.skip();
  reset();
  M.top = 190;   // 第二章前景栅栏更低：人物脚底不能走进栅栏和营帐
  M.W = 3600;
  props = [];
  chapter2Run = { battle: 1, wave: 0, mode: showOpening ? 'intro' : 'fight', nextAt: 0, route: null };
  const topTitle = document.querySelector('#top b');
  if (topTitle) topTitle.textContent = '无名之辈 · 第二章：黄巾决战';
  tutorialQueue = [];   // 操作 / 武器 / 蓄力提示只在第一章出现
  hero.x = 60; hero.y = (M.top + M.bot) / 2; hero.f = 1; hero.hp = maxHeroHp();
  if (showOpening && window.CHAPTER2_INTRO) CHAPTER2_INTRO.start(() => startChapter2Battle(1));
  else startChapter2Battle(battle);
}
// 加载第二章素材期间 window.CHAPTER_LOADING=2，BGM 据此直接进第二章鼓乐，不会先响第一章的曲子。
function loadChapter2(showOpening, battle) {
  window.CHAPTER_LOADING = 2;
  ensureAssets('chapter2', { label: '正在加载第二章' }).then(() => { prepareChapter2Run(showOpening, battle); window.CHAPTER_LOADING = 0; });
}
function startChapter2Debug(battle) { loadChapter2(false, battle); }   // 开发者直跳：素材加载完再进指定的那一战
// 正式入口：播放第二章开场对白后开始第一战；开发者直跳仍可跳过开场。
function startChapter2() { loadChapter2(true); }
function startChapter2Battle(number, walkIn = false) {
  flushLoads();
  if (window.SFX && SFX.preloadVoices) SFX.preloadVoices(['caocao_', 'zl_', 'zb_', 'zj_']);   // 第二章语音进来才下
  if (window.GEAR) GEAR.collectDrops();
  M.W = number === 6 ? Math.max(ALTAR_W, Math.ceil(viewW())) : 8000;   // 战一到战五在同一片营地里一路往右走；祭台战就一屏
  M.top = number === 6 ? 150 : 190;   // 祭台石坪更宽，能走的地面往上放宽，留出八卦阵的位置
  chapter2Run.battle = number; chapter2Run.wave = 0; chapter2Run.mode = 'fight';
  if (number === 6) { spawnDrop(hero.x + 50, hero.y, 'leg'); drops.slice(-1).forEach(d => d.life = 60); }   // 用户定（难度评估后）：张角战开场只给一个鸡腿   // 张角战开打前不回满，地上摆食物（烤乳猪+鸡腿+包子，共 7 血）
  chapter2Run.nextAt = 0; chapter2Run.spawned = true; chapter2Run.nextBattle = null;
  enemySkillFx = []; zs.length = 0; shots.length = 0; eshots.length = 0; fires.length = 0; if (window.CH2B) CH2B.reset();
  if (!walkIn) { hero.st = 'idle'; hero.t = 0; hero.atk = null; hero.vx = 0; }
  hero.inv = Math.max(hero.inv || 0, .8);
  if (number === 6) { hero.x = Math.max(40, (M.W - viewW()) / 2 + 40); hero.y = (M.top + M.bot) / 2 + 20; }
  // 每战锁定一个屏幕：以开战时镜头的位置为准，左右都不能离开这一屏（祭台战镜头居中）
  const camX = number === 6 ? Math.max(0, (M.W - viewW()) / 2) : Math.max(0, Math.min(M.W - viewW(), hero.x - viewW() * (walkIn ? .4 : .28)));
  arenaL = camX; lockR = Math.min(M.W, camX + viewW()); clearAt = 0;
  addChapter2Props(number);
  if (number === 6) {
    if (window.ZJ) ZJ.start();
  } else {
    const waves = CHAPTER2_WAVES[number] || [];
    const begin = () => { if (waves[0]) { waves[0](); fitChapter2Wave(); applyCh2Elites(number, 0); }
      say(`第${['', '一', '二', '三', '四', '五', '六'][number]}战：${CHAPTER2_TITLES[number]}`, 3.5); };
    if (number === 1 && !walkIn && window.CH2OPEN) CH2OPEN.start(begin);   // 入场：旁白大字 + 曹操号令，再开打
    else begin();
  }
  if (!walkIn) cam.x = number === 6 ? camX : Math.max(0, Math.min(M.W - viewW(), hero.x - viewW() * .28));   // 走进下一战时镜头不跳
}
// 出怪位置收进当前这一屏（屏幕窄时，后排的弓手、方士、投石车会被挤到屏外）
function fitChapter2Wave() {
  if (!(lockR < Infinity)) return;
  for (const z of zs) if (!z.dead && z.x > lockR - 16) z.x = lockR - 16 - (z.static ? (z.catapultIndex || 0) * 6 : rnd(0, 18));
  if(chapter2Run.battle===3&&chapter2Run.wave===1&&!props.some(p=>p.siegeWall)){
    const carts=zs.filter(z=>!z.dead&&z.type==='yellow-catapult');
    if(carts.length){const right=Math.min(...carts.map(z=>z.x))-40,meta=ASSETS.props.jumo_v;
      // 三道竖排拒马墙，每道留一个约 24 宽的缺口，缺口位置错开（下 / 上 / 中）
      const span=M.bot-M.top,gap=24,seg=(span-gap)/2;
      [[0,2],[1,0],[2,1]].forEach(([col,gi])=>{const x=right-col*45;
        // gi=0 缺口在上，1 在中，2 在下；剩下的两段各成一个道具
        const segs=gi===0?[[M.top+gap+seg*2,seg],[M.top+gap+seg,seg]]:gi===2?[[M.top+seg*2,seg],[M.top+seg,seg]]:[[M.bot,seg],[M.top+seg,seg]];
        for(const [y,d] of segs)props.push({g:'jumo_v',x,y,d,vert:true,w:18,h:meta[2],sc:1,hp:3,hitT:0,solid:true,broken:false,chapter2:true,siegeWall:true});});
      zs.filter(z=>!z.dead&&z.type==='yellow-shield').forEach((z,i)=>{z.x=right-90-30;z.y=M.top+(M.bot-M.top)*(i+1)/3;z.guard={x:z.x,y:z.y};});
      zs.filter(z=>!z.dead&&z.type==='yellow-heavy').forEach((z,i)=>{z.x=right-90-55;z.y=M.top+(M.bot-M.top)*(i?.85:.15);z.guard={x:z.x,y:z.y};});   // 2 盾 2 刀固定守在拒马墙前
      if(!zs.some(z=>z.siegeArcher))for(let i=0;i<3;i++){spawn('archer',right+18,M.top+(M.bot-M.top)*(i+1)/4);const a=zs[zs.length-1];a.siegeArcher=true;a.f=-1;a.guard={x:a.x,y:a.y};}   // 用户定：拒马墙后 3 个弓箭手守着投石车
    }
  }
}
function chapter2Waves() {
  if (!chapter2Run) return;
  // 清完一战：和第一章一样往右走，走过关口才开始下一战
  if (chapter2Run.mode === 'walk') { if (hero.x >= chapter2Run.walkGate) { if (chapter2Run.nextBattle === 6) { chapter2Run.mode = 'transition'; chapter2Run.nextAt = gameT; } else startChapter2Battle(chapter2Run.nextBattle, true); } return; }
  if (chapter2Run.mode === 'transition' && gameT >= chapter2Run.nextAt) {
    // 战四/战五掉的大刀、汉弓：转场去祭台会换地图，没捡的自动收下，避免掉在够不着的地方
    for (const d of drops) if (d.k === 'weapon' && d.weapon && !d.item && !d.got && window.TITLE && TITLE.grantWeapon && TITLE.grantWeapon(d.weapon, false)) { d.got = 1; say(`已获得${d.weapon === 'blade' ? '大刀' : '汉弓'}，存入武器仓库。`, 3); }
    startChapter2Battle(chapter2Run.nextBattle || chapter2Run.battle + 1); return;
  }
  if (chapter2Run.mode === 'bowgift') { if (gameT >= chapter2Run.nextAt) { chapter2Run.mode = 'choice'; msgT = 0; } return; }   // 曹操赏完弓再弹选路
  if (chapter2Run.mode === 'clearing' && gameT >= chapter2Run.nextAt) {
    const battle = chapter2Run.battle, waves = CHAPTER2_WAVES[battle] || [];
    if (chapter2Run.wave < waves.length - 1) {
      chapter2Run.wave++; chapter2Run.mode = 'fight';
      waves[chapter2Run.wave](); fitChapter2Wave(); applyCh2Elites(battle, chapter2Run.wave);
      return;
    }
    if (window.CHAPTER2 && CHAPTER2.completeBattle) CHAPTER2.completeBattle(battle);
    // 战一到战五：清场后先抽一次锦囊；锦囊关闭后下一帧继续转场/选路。
    if (battle >= 1 && battle <= 5 && window.ROGUE && !chapter2Run['card' + battle]) {
      chapter2Run['card' + battle] = true; ROGUE.offer(); return;
    }
    if (battle === 3) {
      // 曹操赏汉弓（还没有的话），后半程就能用上
      if (!window.TITLE || !TITLE.ownsWeapon || !TITLE.ownsWeapon('bow')) { spawnWeaponDrop('bow', hero.x + 24, hero.y); if (window.CH2OPEN) CH2OPEN.bark('投石车阵已破，好身手！这张汉弓赏你——后面用得上！', 2.6); chapter2Run.mode = 'bowgift'; chapter2Run.nextAt = gameT + 2.9; return; }
      chapter2Run.mode = 'choice';
      msgT = 0; return;
    }
    if (battle === 4) {
      if (!window.TITLE || !TITLE.ownsWeapon || !TITLE.ownsWeapon('blade')) spawnWeaponDrop('blade', hero.x + 24, hero.y);
      chapter2Run.nextBattle = 6;
    } else if (battle === 5) {
      if (!window.TITLE || !TITLE.ownsWeapon || !TITLE.ownsWeapon('blade')) spawnWeaponDrop('blade', hero.x + 24, hero.y);   // 两条路都掉大刀；汉弓改由战三后曹操赏
      chapter2Run.nextBattle = 6;
    } else {
      walkToChapter2Battle(battle + 1); return;
    }
    walkToChapter2Battle(6); return;   // 用户定：战四/战五打完先捡东西，往右走才去祭台
  }
  if (chapter2Run.mode !== 'fight') return;
  if (!zs.some(z => !z.dead)) { chapter2Run.mode = 'clearing'; chapter2Run.nextAt = gameT + .72; }
}
function chooseChapter2Route(route) {
  if (!chapter2Run || chapter2Run.mode !== 'choice') return;
  chapter2Run.route = route;
  for (const d of drops) if (d.k === 'weapon' && d.weapon && !d.item && !d.got && window.TITLE && TITLE.grantWeapon && TITLE.grantWeapon(d.weapon, false)) { d.got = 1; floaters.push({ x: hero.x, y: hero.y - 50, t: 0, txt: `获得${d.weapon === 'blade' ? '大刀' : '汉弓'}！`, big: true, gold: true }); }   // 首次赏的武器没捡也自动收下
  if (window.CHAPTER2 && CHAPTER2.chooseRoute) CHAPTER2.chooseRoute(route);
  const caoLine = route === 'zhang-liang' ? '我去截张宝——你追张梁！' : '张梁交给我——你去截张宝！';
  if (window.CH2OPEN) CH2OPEN.bark(caoLine, 2.8); else say('曹操：' + caoLine, 2.8);
  if (window.SFX && SFX.voice) SFX.voice(route === 'zhang-liang' ? 'caocao_liang' : 'caocao_bao');
  walkToChapter2Battle(route === 'zhang-liang' ? 4 : 5);
}
function walkToChapter2Battle(next) {
  chapter2Run.nextBattle = next; chapter2Run.mode = 'walk';
  chapter2Run.walkGate = hero.x + 280;
  lockR = Infinity;
  say('往右走 →', 3);
}

// ---------- 主角 ----------
function hit(z, dmg, kb, dir, knock, daze = 0, stun = .35, interrupt = false, ranged = false, traits = {}) {
  // 盾兵举盾（第二章）：穿云箭、投石车这类从天上砸下的攻击，盾兵周围 45 内的黄巾兵：50% 完全挡住，否则只吃 40% 且不硬直（用户定）
  if (chapter2Run && z && !z.dead && (traits.skyArrow || traits.siegeShot)) {
    const sh = zs.find(s => s.type === 'yellow-shield' && !s.dead && Math.hypot(s.x - z.x, (s.y - z.y) * 2) < (s.T.ch2Elite ? 65 : 45));
    if (sh) {
      if (!(sh.shieldUpUntil > gameT)) { sh.shieldUpUntil = gameT + .8; floaters.push({ x: sh.x, y: sh.y - 40, t: 0, txt: '举盾！' }); }
      if (Math.random() < (sh.T.ch2Elite ? .2 : .1)) { floaters.push({ x: z.x, y: z.y - 30, t: 0, txt: '挡住' }); return 'blocked'; }   // 用户定：举盾 10% 整下挡掉（精英 20%），否则只吃 40%
      dmg *= .4; stun = 0; daze = 0; kb = 0; knock = false;
    }
  }
  if (ranged && !traits.skyArrow && !traits.secondary && window.BOWAMMO && z && !z.dead && (traits.gearToken?.s.type || weapon) === 'bow') BOWAMMO.onHit();   // 普通箭射中回蓄力箭
  const armor=z&&ch2Armored(z),old=armor?{st:z.st,t:z.t}:null;
  const outcome=window.GEAR ? GEAR.hit(z,dmg,kb,dir,knock,daze,stun,interrupt,ranged,traits) : rawHit(z,dmg,kb,dir,knock,daze,stun,interrupt,ranged,traits);
  if(armor&&!z.dead){z.st=old.st;z.t=old.t;z.air=false;z.z=0;z.vz=0;z.vx=0;z.stun=0;z.daze=0;}
  return outcome;
}
function rawHit(z, dmg, kb, dir, knock, daze = 0, stun = .35, interrupt = false, ranged = false, traits = {}) {
  if (!z || z.dead || (z.air && !traits.dot) || z.hidden) return;
  if(chapter2Run&&z.type==='yellow-shield'&&!traits.dot&&!traits.secondary){
    const type=traits.gearToken?.s.type||weapon,charged=traits.charged||traits.halberdCharge||traits.skyArrow||traits.gearToken?.charged;
    const sb=window.MERIDIAN&&MERIDIAN.x('shield')?.5:1;   // 经脉·破盾：盾的挡/卸概率减半、减伤也打折
    const front=dir*z.f<0&&type!=='hammer',cls=(type==='bow'||type==='stone')?'ranged':(type==='staff'||type==='halberd')?'long':'short';
    // 用户定：正面打盾兵按武器分——远程 ×0.5、长杆 ×0.75、短兵（大刀）×1.15 且格挡概率减半；锤子照旧无视盾；从背后打不受影响。
    // 蓄力 / 终段（含弓的第三段）不再无视盾：不会被整下挡掉，但倍率照算。
    if(front&&!traits.skyArrow&&!traits.siegeShot){const m=cls==='ranged'?.5:cls==='long'?.75:1.05;dmg*=m<1?1-(1-m)*(sb<1?(cls==='ranged'?.75:.5):1):m;}
    const roll=Math.random(),fullP=(z.T.ch2Elite?.2:.1)*sb*(cls==='short'?.5:1);   // 正面普攻 10% 整下挡掉、50% 只吃一半、其余吃满（精英 20% / 50%）
    if(!charged&&!traits.finisher&&front&&roll>=fullP&&roll<fullP+.5*sb*(cls==='short'?.5:1)){
      dmg*=.5;stun=0;kb*=.3;daze=0;interrupt=false;   // 盾卸了一半力：照样掉血，但不硬直
      for(let i=0;i<4;i++)propFx.push({x:z.x+z.f*8,y:z.y-18+rnd(-6,6),vx:rnd(-40,40)+z.f*30,vy:rnd(-80,-20),w:1.5,h:1.5,life:.2,max:.2,c:'#d88a4a'});
    }
    else if(!charged&&!traits.finisher&&front&&roll<fullP){

      const start=propFx.length, firstFloater=floaters.length;if(window.BOSS_BLOCK)BOSS_BLOCK.effect(z);
      for(let i=firstFloater;i<floaters.length;i++)floaters[i].color='#aa4c2c';
      for(let i=start;i<propFx.length;i++){propFx[i].c='#aa4c2c';propFx[i].w*=.7;propFx[i].h*=.7;}
      return 'blocked';
    }
  }
  if (ranged && z.T.chapterBoss && window.BOSS_BLOCK && BOSS_BLOCK.isBlocking(z, dir)) { BOSS_BLOCK.effect(z); return 'blocked'; }
  if (window.XIAOCHANG && XIAOCHANG.active()) dmg = XIAOCHANG.enemyDamage(z, dmg);
  if (ranged && z.T.rangedResist && !(chapter2Run && z.type === 'yellow-shield')) dmg *= window.MERIDIAN && MERIDIAN.x('shield') ? 1 - (1 - z.T.rangedResist) * .75 : z.T.rangedResist;   // 破盾：远程减伤降四分之一
  if (z.T.boss) {
    const hp0 = z.hp;
    if (window.ROGUE && ROGUE.onHit) dmg = ROGUE.onHit(z, dmg, traits, ranged);
    const res = Boss.hit(z, dmg, dir, ranged, traits);
    if (z.hp < hp0) {
      if (window.ROGUE && ROGUE.afterHit) ROGUE.afterHit(z, false, traits, dmg, ranged);
      if (traits.dot) return res;

      countComboHit();
    }
    return res;
  }
  if (traits.dot) {
    z.hp -= dmg; z.flash = .08;
    if (z.hp <= 0) {
      z.dead = 1; kills++; set(z, 'land');
      if (z.villagerChaser) thankVillagers();
      if (z.T.elite) { spawnDrop(z.x - 8, z.y, 'leg'); if (!chapter2Run) spawnDrop(z.x + 12, z.y); }
    }
    return;
  }
  countComboHit();
  if (z.adds != null) z.adds = null;   // 受击后立即退出援军状态机，后续按普通弓手受击/击飞处理
  hero.lastHit = gameT; hero.lastHitC = hero.atk ? hero.atk.c : hero.lastShotC;
    if (!traits.secondary && z.T.priest && z.st === 'chant') {   // 打断念咒：这一轮白念，冷却照走
      set(z, 'hurt'); z.t = 0; z.chantCd = z.castKind === 'fire' ? 3.5 : 8; z.chant = 0;
      sfx('crack', z.x);
      for (let i = 0; i < 6; i++) propFx.push({ x: z.x + rnd(-6, 6), y: z.y - 18 + rnd(-6, 4), w: 2, h: 2, life: .35, max: .35, c: '#3a2410' });
    }
  if (window.ROGUE && ROGUE.onHit) dmg = ROGUE.onHit(z, dmg, traits, ranged);   // 震慑破绽加伤、避实眩晕回血
  z.hp -= dmg * (z.daze > 0 ? 1.5 : 1);   // 被打晕的目标吃 1.5 倍伤害
  z.flash = .1; z.stun = z.T.siege ? 0 : (z.T.heavy && z.st === 'wind' && !interrupt ? 0 : stun); z.vx = z.T.siege ? 0 : kb * dir * (z.T.heavy ? .6 : 1);
  if (z.T.chapterBoss) {   // 用户定：第二章首领沿用管亥的「韧性」——挨打累积，满了才踉跄；出招中不被打断；平时只被推一点
    const POISE = { zhang_liang: 8, zhang_bao: 6, zhang_jiao: 10 }[z.type] || 8;
    z.poise = (z.poise || 0) + dmg; (z.hitLog ||= []).push(gameT); z.hitLog = z.hitLog.filter(t => gameT - t < 2);
    const busy = z.cb || (z.combo && !z.combo.rest) || z.array || z.st === 'tele';   // 出招/施法中（张角的法术在 z.combo 里）：霸体不踉跄
    if (z.poise >= POISE && !busy) { z.poise = 0; z.stun = .5; z.vx = dir * 70; floaters.push({ x: z.x, y: z.y - 50, t: 0, txt: '踉跄！', color: '#ffd86e' }); }
    else { z.stun = 0; z.vx = dir * 18; }
  }
  const heavyDazeScale = z.T.heavy ? (weapon === 'staff' ? .7 : .5) : 1;
  const dazeChance = traits.dazeChance != null ? traits.dazeChance : daze * heavyDazeScale;
  const dazeTime = traits.dazeTime != null ? traits.dazeTime : (z.T.heavy ? 1 : 1.5) * R_('daze');
  // 只有 traits 明确给出 dazeChance 的伤害（目前是石子）才能晕首领
  if ((!z.T.boss && !z.T.chapterBoss || traits.dazeChance != null) && dazeChance && !z.daze && Math.random() < dazeChance) {
    z.daze = dazeTime;
    if (z.T.chapterBoss) z.stun = Math.max(z.stun || 0, dazeTime);
    z.st = 'move'; z.tok = false;
  }
  if (ranged && z.T.chapterBoss && window.BOSS_BLOCK) BOSS_BLOCK.recordRanged(z, dir);
  if (z.stun) { z.st = 'move'; z.tok = false; }
  // 命中定格：轻击短、重击长。棍子每下 1 点伤害只停 0.038 秒（原来一律 0.05，连击会显得一顿一顿的）
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
    if (z.villagerChaser) thankVillagers();
    if (z.T.elite) { spawnDrop(z.x - 8, z.y, 'leg'); if (!chapter2Run) spawnDrop(z.x + 12, z.y); sfx('finisher', z.x); shake = .2; }   // 精英必掉：至少一个中等
    if (z.T.ch2Elite) { spawnDrop(z.x, z.y, Math.random() < .65 ? 'leg' : 'pig'); sfx('finisher', z.x); shake = .2; }   // 第二章精英：必掉鸡腿或烤乳猪
  }
  if (knock && !(z.T.boss || z.T.chapterBoss || z.T.noLaunch) && (traits.knockSiege || !z.T.siege)) launch(z, dir * (z.dead ? 110 : 80) * (z.T.heavy ? .7 : 1), z.dead ? 130 : 105);
  if (window.ROGUE && ROGUE.afterHit) ROGUE.afterHit(z, knock, traits, dmg, ranged);   // 震慑：眩晕/击倒挂破绽

}
let volleyAgainAt = 0;
function summonArchersVolley(again) {
  // 万箭齐发（加强）：两轮、每轮 10 支、40° 扇形，每支 1 伤害并穿透；同一敌人一次技能最多吃 3 支
  if (!again) { volleyAgainAt = gameT + .5; zs.forEach(z => z.wjHits = 0); }
  const angles = Array.from({ length: 10 }, (_, i) => (-20 + i * 40 / 9) * Math.PI / 180);
  for (const a of angles) {
    const C = { dmg: 1.5, kb: 12, pierce: true, pierceOff: .6 };
    const ang = a * hero.f;
    shots.push({ x: hero.x + hero.f * 14, y: hero.y + rnd(-8, 8), z: 24, vx: Math.cos(ang) * 260 * hero.f, vy: Math.sin(a) * 190, life: 1.05, C, c: 0, hitSet: [], kind: 'arrow', secondary: true, summon: true });
  }
  sfx('sling', hero.x); if (!again) say('万箭齐发！', 1.2);
}
// 击飞：腾空 → 落地弹一下 → （敌人）爬起 /（死亡）倒地消失
function launch(e, vx, vz) { e.air = true; e.z = 0.1; e.vz = vz; e.ax = vx; e.st = 'air'; e.t = 0; e.tok = false; e.stun = 0; e.daze = 0; }
function airStep(e, dt) {
  e.z += e.vz * dt; e.vz -= e.deathArc ? 220 * dt : 420 * dt; moveEnt(e, e.ax * dt, 0);
  if (e.z <= 0 && e.vz < 0) {
    e.z = 0; e.air = false; e.st = 'land'; e.t = 0; shake = Math.max(shake, .08);
    sfx(e.dead ? 'enemyDown' : e === hero && over ? 'heroDown' : 'land', e.x);
    if (e === hero && over) { e.deathArc = false; deathLandedAt = gameT; startEnemyCelebration(); }
  }
}
function startEnemyCelebration() {
  if (enemiesCelebrating) return;
  enemiesCelebrating = true;
  zs.forEach(z => {
    if (z.dead) return;
    z.celebrating = true; z.celebrateT = 0; z.vx = 0; z.qi = null;
    if (!z.T.boss) set(z, 'idle');
  });
}
function heroUpdate(dt) {
  if (dt > 0) { const vx = (hero.x - (hero.px ?? hero.x)) / dt, vy = (hero.y - (hero.py ?? hero.y)) / dt; hero.mvx = (hero.mvx || 0) * .85 + vx * .15; hero.mvy = (hero.mvy || 0) * .85 + vy * .15; hero.px = hero.x; hero.py = hero.y; }   // 平滑速度：投石车算提前量用
  const h = hero;
  if (pendingWeapon && !h.air && !['hurt','down','bounce','getup'].includes(h.st)) { const requested=pendingWeapon; pendingWeapon=null; setW(requested); }
  h.inv = Math.max(0, h.inv - dt); h.rollCd = Math.max(0, h.rollCd - dt); h.t += dt;
  if (h.st === 'down') return;
  if (h.air) { airStep(h, dt); pressAtk = pressRoll = false; return; }
  if (h.st === 'land') { set(h, over ? 'down' : 'bounce'); if (over) return; }   // 死了就躺下，不许再接管输入
  if (h.st === 'bounce') { if (h.t > .3) set(h, 'getup'); pressAtk = pressRoll = false; return; }
  if (h.st === 'getup') { if (h.t > .35 * (window.MERIDIAN ? MERIDIAN.x('getup', 1) : 1)) { set(h, 'idle'); h.inv = .5; } pressAtk = pressRoll = false; return; }
  let ix = (key.KeyD || key.ArrowRight ? 1 : 0) - (key.KeyA || key.ArrowLeft ? 1 : 0), iy = (key.KeyS || key.ArrowDown ? 1 : 0) - (key.KeyW || key.ArrowUp ? 1 : 0);
  if (joy) { ix = Math.abs(joy.dx) > .2 ? joy.dx : 0; iy = Math.abs(joy.dy) > .2 ? joy.dy : 0; }
  const l = Math.hypot(ix, iy); if (l > 1) { ix /= l; iy /= l; }
  h.ix = ix; h.iy = iy;   // 记下方向输入：跑动中扔石子会偏
  if (h.st === 'hurt') { if (h.t > .3) set(h, 'idle'); moveEnt(h, h.vx * dt, 0); h.vx *= .85; pressAtk = pressRoll = false; return; }
  // 按住攻击键 0.4 秒 → 进入蓄力（连招暂停接续）
  if (atkHeldSince && !charging && performance.now() - atkHeldSince >= chargeGateMs() && !h.air && h.st !== 'down' && h.st !== 'hurt') {
    charging = true; chargeTier = 0; chargeTierFlash = 0; sfx('charge', h.x); h.comboWin = 0; h.q = 0;
  }
  if (charging) { h.comboWin = 0; if (h.st === 'hurt' || h.st === 'down' || h.air) charging = false; }
  if (pressRoll && h.rollCd === 0 && h.st !== 'roll') {
    sfx('roll', h.x);
    set(h, 'roll'); h.inv = IS_TOUCH ? .45 : .4; h.rollCd = .75; h.atk = null; h.q = 0; h.rollId = (h.rollId || 0) + 1;
    if (!(charging && window.ROGUE && ROGUE.has('藏势'))) cancelCharge();   // 藏势：蓄力中翻滚，进度保留
    if (window.ROGUE && ROGUE.onRoll) ROGUE.onRoll(h.x, h.y);
    const d = Math.hypot(ix, iy) > 0.1 ? [ix, iy] : [h.f, 0]; const dl = Math.hypot(...d); h.rx = d[0] / dl; h.ry = d[1] / dl;
    if (Math.abs(h.rx) > .1) h.f = Math.sign(h.rx);
  }
  updateHalberdDash(h, dt);
  pressRoll = false;
  if (h.st === 'roll' && charging && atkHeldSince) atkHeldSince += dt * 1000;   // 藏势：翻滚时蓄力暂停
  if (h.st === 'roll') { const rs = (window.Boss && Boss.wx && Boss.wx() === 'rain') ? 1.25 : 1; { const mr = window.MERIDIAN ? MERIDIAN.x('roll', 1) : 1; moveEnt(h, h.rx * 150 * rs * mr * dt, h.ry * 105 * rs * mr * dt); } if (h.t > .4) { set(h, 'idle'); if (window.ROGUE && ROGUE.onRollEnd) ROGUE.onRollEnd(); } pressAtk = false; return; }   // 回马：滚完自动向身后打一下
  h.comboWin = Math.max(0, (h.comboWin || 0) - dt);
  if (pressAtk && window.SUPPLY && SUPPLY.throwJar()) pressAtk = false;   // 拿着火油罐：攻击键先扔罐子
  if (pressAtk) { if (h.st === 'atk') h.q = 1; else startAtk(); pressAtk = false; }
  if (h.st === 'atk' && (!h.atk || !WEAP[weapon].combo[h.atk.c])) { h.atk = null; set(h, 'idle'); }   // 防卡死：出招状态和当前武器对不上就复位
  if (h.st === 'atk') {
    const W2 = WEAP[weapon], a = h.atk, C = W2.combo[a.c]; a.t += dt; a.lg += dt;
    if (a.t >= C.d[a.fi] * R_('aspd') / (W2.aspd || 1) * (window.Boss && Boss.wxAspd ? Boss.wxAspd() : 1)) {
      a.t = 0; a.fi++;
      if (a.fi === C.f.length - 1 && !a.visualOnly) strike();
      if (a.fi >= C.f.length) { h.combo = a.c; h.atk = null; h.comboWin = .45; if (h.q) { h.q = 0; startAtk(); } else set(h, 'idle'); return; }
    }
    if (ix && a.fi === 0) h.f = Math.sign(ix);
    // 锤子这类重型武器出手时朝面向方向前冲一小段（整段动作只冲一次），补足它短得可怜的攻击距离
    if (W2.lunge && a.lg < W2.lungeT) {
      // 前方已经有敌人贴得够近就别再冲，避免从敌人身上穿过去导致打空
      const tooClose = zs.some(z => !z.dead && Math.sign(z.x - h.x) === h.f
        && Math.abs(z.y - h.y) < W2.dy + 8
        && Math.abs(z.x - h.x) - (z.T.w || 0) / 2 < W2.reach * .6);
      if (!tooClose) moveEnt(h, h.f * W2.lunge * dt, 0);
    }
    // 出手时的移动：默认压到 15（有僵直）；像石子这种设了 move 的，按走路速度边走边扔（move = 1 即全速）
    const mvq = charging ? .2 : 1;   // 蓄力时只能极慢挪动
  if (W2.move != null) moveEnt(h, ix * 70 * W2.move * mvq * dt, iy * 52 * W2.move * mvq * dt);
    else moveEnt(h, ix * 15 * mvq * dt, 0);
    return;
  }
  if (over) return;   // 死亡后彻底停止玩家操作
  if (ix || iy) { if (h.st !== 'walk') set(h, 'walk'); if (ix) h.f = Math.sign(ix); const mv = R_('move') * (window.Boss && Boss.wxMove ? Boss.wxMove() : 1) * (window.CH2B && CH2B.sandOn && CH2B.sandOn() ? .75 : 1) * (charging ? (weapon === 'bow' ? .55 : .65) : 1); moveEnt(h, ix * 70 * mv * dt, iy * 52 * mv * dt); }   // 蓄力时走路慢 35%
  else if (h.st !== 'idle') set(h, 'idle');
  if (lockR < Infinity) h.x = Math.max(cam.x + 12, Math.min(h.x, cam.x + viewW() - 12));
}
function set(e, st) { e.st = st; e.t = 0; }
// ---------- 可破坏的道具（草垛、推车） ----------
// 每被打中一次掉 1 点耐久；打坏后取消碰撞（p.solid = false）并从画面消失，水井/旗子 hp 为 0 不受影响
// 回血道具：包子 +1（70%）、鸡腿 +2（20%）、烤乳猪 +3（10%）
const FOOD = [
  { k: 'bun', heal: 1, w: 72 },   // 包子：最常见，回 1（权重 60→72）
  { k: 'leg', heal: 2, w: 22 },   // 鸡腿：中等，回 2（30→22）
  { k: 'pig', heal: 4, w: 6 },    // 烤乳猪：稀有，回 4（10→6）
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
function spawnWeaponDrop(id, x, y) {
  if (!['bow', 'blade'].includes(id) || drops.some(d => d.weapon === id && !d.got)) return;
  drops.push({ k: 'weapon', weapon: id, x, y, z: 10, vy: 130, t: 0, life: Infinity, got: 0 });
  say(`发现${id === 'blade' ? '大刀' : '汉弓'}！靠近拾取，永久存入武器仓库。`, 4);
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
      if (d.item) {
        if (window.ARMORY && ARMORY.add(d.item)) { d.got=1; sfx('food',d.x); floaters.push({x:d.x,y:d.y-10,t:0,txt:AFFIX_DATA.names[d.item.type],color:AFFIX_DATA.qualities[d.item.q].color}); }
        continue;
      }
      if (d.weapon) {
        if (window.TITLE && TITLE.grantWeapon && TITLE.grantWeapon(d.weapon, true)) {
          d.got = 1;
          const blade = d.weapon === 'blade';
          if (weapon === (blade ? 'hammer' : 'stone')) setW(d.weapon); else ui();
          sfx('food', d.x);
          floaters.push({ x: d.x, y: d.y - 10, t: 0, txt: blade ? '获得大刀' : '获得汉弓' });
          say(blade ? '大刀已装备短武器槽，按 2 或点武器栏的刀切换。' : '汉弓已装备远程槽，按 3 或点武器栏的弓切换。', 4);
        }
        continue;
      }
      d.got = 1;
      if (d.k === 'roll') {
        const granted = window.ROGUE && ROGUE.grantReroll();
        floaters.push({ x: d.x, y: d.y - 10, t: 0, txt: granted ? 'ROLL +1' : '锦囊已满' });
        if (granted) { say('锦囊可重抽一次：下次选卡时按 ROLL', 3); sfx('food', d.x); }
        continue;
      }
      if (h.hp >= maxHeroHp()) {
        if (window.XIAOCHANG && XIAOCHANG.active()) {
          floaters.push({ x: d.x, y: d.y - 10, t: 0, txt: '已满血' });
        } else { // 主线满血时仍按 1 血 = 5 分折算积分。
          const bp = d.heal * 5;
          runBonus += bp;
          floaters.push({ x: d.x, y: d.y - 10, t: 0, txt: '+' + bp + '分' });
        }
      } else {
        h.hp = Math.min(maxHeroHp(), h.hp + d.heal);
        floaters.push({ x: d.x, y: d.y - 10, t: 0, txt: '+' + d.heal, heal: true });
      }
      sfx('food', d.x);
    }
  }
  drops = drops.filter(d => !d.got);
  for (const f of floaters) f.t += dt;
  floaters = floaters.filter(f => f.t < 1.1);
}
// 地面武器按可见内容的长边缩放；透明留白不参与尺寸计算。
const DROP_WEAPON_SIZE = { stone: 10, hammer: 18, blade: 20, bow: 20, staff: 28, halberd: 32 };
const dropIconBounds = new WeakMap();
function weaponDropBounds(im) {
  if (!im || !im.complete || !im.naturalWidth) return null;
  if (dropIconBounds.has(im)) return dropIconBounds.get(im);
  const w = im.naturalWidth, h = im.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const c = canvas.getContext('2d', { willReadFrequently: true });
  c.drawImage(im, 0, 0);
  let pixels;
  try { pixels = c.getImageData(0, 0, w, h).data; }
  catch (e) { const full = { x: 0, y: 0, w, h }; dropIconBounds.set(im, full); return full; }   // 跨域图片读不了像素（试玩网址上会这样）：退回整张图，不再报错卡死
  let left = w, top = h, right = -1, bottom = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!pixels[(y * w + x) * 4 + 3]) continue;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  const bounds = right < 0 ? null : { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
  dropIconBounds.set(im, bounds);
  return bounds;
}
function drawDrop(d) {
  if (d.weapon) {
    const im = IMG['ui_w_' + d.weapon], y = d.y - (d.z || 0) - 12;
    const size = DROP_WEAPON_SIZE[d.weapon] || 20;
    shadow(d.x, d.y, size * .2); // 影子宽度为长边的 0.4 倍。
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = 'rgba(239,196,96,.18)';
    ctx.beginPath(); ctx.ellipse(d.x, y, size * .3, size * .3, 0, 0, Math.PI * 2); ctx.fill();
    const bounds = weaponDropBounds(im);
    if (bounds) {
      const scale = size / Math.max(bounds.w, bounds.h);
      const w = bounds.w * scale, h = bounds.h * scale;
      ctx.drawImage(im, bounds.x, bounds.y, bounds.w, bounds.h, d.x - w / 2, y - h / 2, w, h);
    }
    ctx.restore(); return;
  }
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
  if (d.k === 'roll') {
    c.save(); c.translate(d.x, y - fh / 2); c.shadowColor = 'rgba(26,14,8,.9)'; c.shadowOffsetX = .9; c.shadowOffsetY = .9;
    c.fillStyle = '#442518'; c.beginPath(); c.ellipse(0, 0, 6.5, 5, 0, 0, 7); c.fill();
    c.fillStyle = '#c78b3d'; c.beginPath(); c.ellipse(0, -.5, 4.8, 3.5, 0, 0, 7); c.fill();
    c.strokeStyle = '#8e3a24'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-3, -3); c.lineTo(3, 3); c.moveTo(3, -3); c.lineTo(-3, 3); c.stroke();
    c.fillStyle = '#f3d27c'; c.fillRect(-1, -1, 2, 2); c.restore(); return;
  }
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
    const emph = f.big || f.dodge || f.gold;
    ctx.globalAlpha = Math.max(0, 1 - f.t / 1.1);
    ctx.font = 'bold ' + (emph ? 17 : 13) + 'px "PingFang SC","Noto Sans CJK SC",sans-serif';
    ctx.textAlign = 'center';
    if(f.color){ctx.fillStyle=f.color;} else if (f.red) {
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(45,8,8,.9)'; ctx.lineJoin = 'round';
      ctx.strokeText(f.txt, f.x, f.y - f.t * 26);
      ctx.fillStyle = '#ff5a4d';
    } else if (f.dodge || f.gold) {
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(40,24,10,.85)'; ctx.lineJoin = 'round';
      ctx.strokeText(f.txt, f.x, f.y - f.t * 26);
      ctx.fillStyle = '#ffe27a';
    } else {
      // 颜色按用途分：回血绿色；暴击/背击/补刀/格挡橙色；掉落按品级色；其他提示米白
      const c = f.color || (f.heal ? '#8ef07a' : f.big ? '#ffa94d' : '#f3e6c4');
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(30,18,10,.85)'; ctx.lineJoin = 'round';
      ctx.strokeText(f.txt, f.x, f.y - f.t * 26);
      ctx.fillStyle = c;
    }
    ctx.fillText(f.txt, f.x, f.y - f.t * 26);
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'left';
}
// 能打碎的道具：第一章草垛/推车/石碾，第二章全部道具和旗子
const BREAKABLE_PROPS = new Set(['hay', 'cart', 'mill', 'sacks', 'crate', 'rack', 'jumo', 'jumo_v', 'jumo_vs', 'debris', 'stones', 'brazier', 'flag_y', 'flag_ren', 'flag_di', 'flag_tian', 'flag_cang', 'flag_huang', 'fudeng', 'cao_crate', 'zb_wall']);   // cao_crate：第二章曹军补给箱（打碎变 'cao_crate_broken' 并掉补给，见 js/supply.js）
const canHitProp = p => !p.broken && BREAKABLE_PROPS.has(p.g);
function hitProp(p, dir) {
  if (!canHitProp(p)) return;
  p.hp--; p.hitT = .15;   // 左右抖 0.15 秒
  const hay = p.g === 'hay', mill = p.g === 'mill', jumo = p.g === 'jumo' || p.g === 'jumo_v' || p.g === 'jumo_vs', broken = p.hp <= 0;
  sfx(broken ? 'land' : 'hit_staff', p.x);
  const sack = p.g === 'sacks';
  const flag = p.g.startsWith('flag_');
  const cols = flag ? ['#e8c24a', '#c99a2a', '#6b4a24'] : p.g === 'brazier' ? ['#ff8a2a', '#ffd04a', '#3a3030'] : p.g === 'stones' ? ['#6e6a66', '#9a958e', '#4a4440'] : hay ? ['#8a5a18', '#c98a25', '#edc34d'] : mill ? ['#5b5146', '#8a7a66', '#b3a286'] : sack ? ['#4a3a34', '#6b564a', '#a98c5a'] : p.g === 'crate' || p.g === 'rack' ? ['#2e221d', '#4a3a30', '#6a5444'] : ['#4b2c12', '#7a4d22', '#a3703c'];
  const n = broken ? 22 : 7;
  for (let i = 0; i < n; i++) {
    const life = broken ? rnd(.42, .65) : rnd(.32, .55);
    // 草垛掉细条状的稻草，推车掉方块状的木片，石碾掉碎石
    const w = hay ? rnd(2.8, 4.6) : rnd(1.8, 3.2), hh = hay ? 1.2 : w;
    propFx.push({ x: p.x + rnd(-p.w * .35, p.w * .35), y: p.y - rnd(4, p.h * .7),
      vx: rnd(-70, 70) + (dir || 0) * 35, vy: rnd(-130, -45), w, h: hh, life, max: life,
      c: cols[Math.floor(Math.random() * cols.length)] });
  }
  if (broken) {
    if (p.g === 'fudeng') {   // 符灯打灭：换成倒地熄灭的灯，不再挡路
      const meta = ASSETS.props.fudeng_off;
      p.g = 'fudeng_off'; p.solid = false; p.hp = 0;
      if (meta) { p.w = meta[1]; p.h = meta[2]; }
    } else if (p.zbWall) {   // 张宝的土墙被打碎：换成碎墙，淡出
      const meta = ASSETS.props.zb_wall_broken; p.g = 'zb_wall_broken'; p.solid = false; p.hp = 0; p.fadeAt = gameT; if (meta) { p.w = meta[1]; p.h = meta[2]; }
    } else if (p.supply && window.SUPPLY) {   // 曹军补给箱：换成碎箱子，掉一个补给
      SUPPLY.onCrateBreak(p);
    } else if (jumo) {
      const meta = ASSETS.props[p.g + '_broken'];   // 'jumo_broken' / 'jumo_v_broken' / 'jumo_vs_broken'
      p.g = p.g + '_broken'; p.solid = false; p.hp = 0; p.broken = true;   // 打碎就消失（碎屑已经飞出去了）
      if (meta && !p.vert) { p.w = meta[1]; p.h = meta[2]; }
    } else {
      p.broken = true; p.solid = false;
      if (flag) {
        // 打倒旗子：每一战第一次打倒旗子给一次锦囊
        if (chapter2Run && [1, 2, 4].includes(chapter2Run.battle) && window.ROGUE && !chapter2Run['flagCard' + chapter2Run.battle]) {   // 战一、二、四的黄旗打落给锦囊
          chapter2Run['flagCard' + chapter2Run.battle] = true;
          floaters.push({ x: p.x, y: p.y - 40, t: 0, txt: '斩旗！', big: true, gold: true });
          sfx('finisher', p.x); ROGUE.offer();
        }
      } else if (p.chapter2) { if (Math.random() < .4) spawnDrop(p.x, p.y); }   // 用户定：第二章道具掉回血 70%→40%   // 第二章道具 70% 掉回血食物（用户定）
      else if (Math.random() < .7) spawnDrop(p.x, p.y);                        // 第一章草垛/推车/石碾 70%（用户定）
    }
  }
}
// 命中/蓄力等临时特效
function updateFx(dt) {
  for (const q of qiFx) q.t += dt;
  qiFx = qiFx.filter(q => q.t < q.T);
  for (const q of chargeFx) q.t += dt;
  chargeFx = chargeFx.filter(q => q.t < q.T);
  for (const h of bluntHits) h.t += dt;
  bluntHits = bluntHits.filter(h => h.t < h.T);
  for (const f of hammerFx) f.t += dt;
  hammerFx = hammerFx.filter(f => f.t < f.T);
  for (const f of bladeFx) f.t += dt;
  bladeFx = bladeFx.filter(f => f.t < f.T);
  const bowImpacts = [];
  for (const f of bowFx) {
    f.t += dt;
    if (f.kind === 'sky' && !f.resolved && f.t >= .5) {
      f.resolved = true; resolveBowSky(f);
      bowImpacts.push({ kind: 'impact', x: f.x, y: f.y, t: 0, T: .2, r: f.data.radius });
    }
  }
  bowFx = bowFx.filter(f => f.kind === 'sky' ? f.t < .6 : f.t < f.T);
  bowFx.push(...bowImpacts);
  for (const q of chargeHitFx) q.t += dt;
  chargeHitFx = chargeHitFx.filter(q => q.t < q.T);
  for (const q of blessFx) q.t += dt;
  blessFx = blessFx.filter(q => q.t < q.T);
  for (const gh of ghosts) gh.t += dt;
  ghosts = ghosts.filter(gh => gh.t < .45);
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
let qiFx = [];   // 老卒的扇形剑气特效
let blessFx = []; // 方士施法成功的黄圈
// 攻击按下先等待：短按松开才出普通攻击，长按到 0.4 秒后转为蓄力。
function atkPress() {
  if (over) return;   // 结算界面由 resultKey 处理（J 确定当前选中的按钮）
  if (atkHeldSince) return;
  atkHeldSince = performance.now(); charging = false; chargeTier = 0; chargeTierFlash = 0;
}
function atkRelease() {
  if (!atkHeldSince) return;
  const held = performance.now() - atkHeldSince;
  atkHeldSince = 0;
  const canAct = hero.st !== 'down' && hero.st !== 'hurt' && !hero.air && !over;
  const tier = chargeTierFor(held);
  if (held >= chargeGateMs()) {
    charging = false;
    if (canAct) { const p0 = Math.min(1, held / chargeMaxMs()); if (window.ROGUE && ROGUE.onChargeRelease) ROGUE.onChargeRelease(); chargedAttack(p0, tier); }
    chargeTier = 0; chargeTierFlash = 0;
    return;
  }
  charging = false; chargeTier = 0; chargeTierFlash = 0;
  if (canAct) {
    if (hero.st === 'atk') hero.q = 1;
    else pressAtk = true;
  }
}
function cancelCharge() { charging = false; atkHeldSince = 0; chargeTier = 0; chargeTierFlash = 0; }

// 长戟「裂伤」：与血刃词条完全分开的一套层数/流血状态。
function halberdStacks(z) { return z && z.halberdBleed > 0 && gameT < z.halberdBleedUntil ? z.halberdBleed : 0; }
function bowRangeMult(d) { return d < 50 ? .7 : d < 100 ? 1 : d < 200 ? 1.15 : 1.3; }
function resolveBowSky(f) {
  const d = f.data;
  for (const z of zs) {
    if (z.dead || Math.hypot(z.x - f.x, (z.y - f.y) * 2) > d.radius + (z.T.w || 0)) continue;   // 地面是扁的：上下范围只有左右的一半，和冲击环形状一致
    const boss = z.T.boss || z.T.chapterBoss;
    const stun = boss ? d.stun / 2 : d.stun;
    hit(z, d.dmg, 0, 0, false, 0, stun, false, false, { skyArrow: true });
    if (boss && !z.dead) z.stun = Math.max(z.stun || 0, stun);
  }
  sfx('finisher', f.x);
}
function addHalberdBleed(z, base, stacks = 1) {
  if (!z || z.dead) return 0;
  const alive = halberdStacks(z);
  z.halberdBleed = Math.min(window.ROGUE && ROGUE.has('血债') ? 8 : 5, (alive || 0) + stacks);   // 血债：上限 8
  if (alive === 4 && z.halberdBleed === 5) bleedFx.push({ kind: 'splash', x: z.x, y: z.y - 12, t: 0, T: .18, big: true });
  z.halberdBleedUntil = gameT + 3;
  z.halberdBleedBase = base;
  if (!alive || !z.halberdBleedNext || z.halberdBleedNext <= gameT) z.halberdBleedNext = gameT + 1;
  if (!z.halberdBleedDripAt || z.halberdBleedDripAt <= gameT) z.halberdBleedDripAt = gameT + rnd(.25, .55);
  return z.halberdBleed;
}
function clearHalberdBleed(z) {
  if (!z) return;
  z.halberdBleed = 0; z.halberdBleedUntil = 0; z.halberdBleedBase = 0;
  z.halberdBleedNext = 0; z.halberdBleedDripAt = 0;
}
function updateHalberdBleed(dt) {
  for (const z of zs) {
    if (z.dead || !(z.halberdBleed > 0)) continue;
    if (gameT >= z.halberdBleedUntil) { clearHalberdBleed(z); continue; }
    if (z.halberdBleedNext && gameT >= z.halberdBleedNext) {
      z.halberdBleedNext += 1;
      const dot = z.halberdBleed * .08 * (z.halberdBleedBase || 0);
      if (dot > 0) hit(z, dot, 0, 0, false, 0, 0, false, false, { dot: true, secondary: true, halberdBleed: true });
    }
    if (z.halberdBleedDripAt && gameT >= z.halberdBleedDripAt) {
      z.halberdBleedDripAt = gameT + rnd(.3, .65) * (1.2 - z.halberdBleed * .15);   // 层数越多滴得越快
      bleedFx.push({ kind: 'drip', x: z.x + rnd(-7, 7), y: z.y - rnd(8, 26), t: 0, T: .16 });
    }
  }
  for (const f of bleedFx) f.t += dt;
  bleedFx = bleedFx.filter(f => f.t < f.T);
}

// 蓄力重击：三种武器各不相同；命中只在释放时结算一次，动画仅作表现。
function addChargeHitFx(kind, x, y, f = 1) {
  const T = kind === 'hammer' ? .27 : .22;
  chargeHitFx.push({ kind, x, y, f, t: 0, T });
  if (chargeHitFx.length > 32) chargeHitFx.shift();
}
function drawChargeHitFx() {
  if (window.GEAR) GEAR.draw();
  for (const q of chargeHitFx) {
    const im = IMG['ui_charge_hit_' + q.kind];
    if (!im || !im.complete || !im.naturalWidth) continue;
    const n = q.kind === 'staff' ? 4 : 3;
    const frame = Math.min(n - 1, Math.floor(q.t / q.T * n));
    const w = q.kind === 'staff' ? 58 : q.kind === 'hammer' ? 58 : 23;
    const h = q.kind === 'staff' ? 45 : q.kind === 'hammer' ? 36 : 22;
    ctx.save();
    ctx.globalAlpha = Math.min(1, (1 - q.t / q.T) * 1.3);
    ctx.translate(q.x, q.y);
    if (q.kind === 'staff') ctx.scale(q.f, 1);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(im, frame * 160, 0, 160, 120, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
}

// 长戟蓄力「回马突」的冲刺：每帧前进，经过的敌人各打一次并叠裂伤，身后留残影
function updateHalberdDash(h, dt) {
  const d = h.halberdDash; if (!d) return;
  const step = Math.min(d.left, d.sp * dt);
  moveEnt(h, h.f * step, 0); d.left -= step;
  d.ghostT -= dt;
  if (d.ghostT <= 0) { d.ghostT = .035; ghosts.push({ x: h.x, y: h.y, f: h.f, a: .4, t: 0 }); }
  for (const z of zs) {
    if (z.dead || z.air || d.hitSet.has(z)) continue;
    const dx = (z.x - h.x) * h.f, bw = z.T.w || 0;
    if (dx < -14 - bw || dx > 18 + bw || Math.abs(z.y - h.y) > d.dy) continue;
    d.hitSet.add(z);
    if(chapter2Run&&z.type==='yellow-shield')d.left=0;
    hit(z, d.dmg, d.kb, h.f, false, 0, .35, WEAP.halberd.interrupt, false, { finisher: true, halberdCharge: true });
    if (!z.dead) {
      addHalberdBleed(z, window.GEAR && GEAR.attackScale ? GEAR.attackScale(z) : 1, d.stacks);
      bleedFx.push({ kind: 'splash', x: z.x, y: z.y - 12, t: 0, T: .15 });
    }
    if (d.hitSet.size === 1) { sfx('hit_staff', z.x); sfx('finisher', h.x); }
    if(chapter2Run&&z.type==='yellow-shield')break;
  }
  if (d.left <= 0 || h.st === 'hurt' || h.st === 'down') h.halberdDash = null;
}
function chargedAttack(power, tier = 1) {
  const h = hero, W = WEAP[weapon];
  h.q = 0; h.comboWin = 0;
  h.atk = { c: W.combo.length - 1, fi: 0, t: 0, lg: 0, visualOnly: true, gearToken: window.GEAR ? GEAR.attackToken(true) : null }; set(h, 'atk');
  chargeFx.push({ x: h.x, y: h.y, t: 0, T: .45, w: weapon, f: h.f, power, tier });
  sfx('finisher', h.x); shake = Math.max(shake, .12 + .18 * power);
  const force = .35 + .65 * power;
  const R = 64 * (window.GEAR ? GEAR.range() : 1);
  if (weapon === 'bow') {                         // 穿云箭：先标记落点，再从右上方落下
    if (window.BOWAMMO && !BOWAMMO.use()) { floaters.push({ x: h.x, y: h.y - 50, t: 0, txt: '蓄力箭不足' }); sfx('roll', h.x); return; }   // 蓄力箭用完
    const data = tier === 3 ? { radius: 45, dmg: 2.4, stun: 1 }   // 用户反馈太强、范围太大：伤害和半径都下调
      : tier === 2 ? { radius: 36, dmg: 1.9, stun: .8 }
      : { radius: 28, dmg: 1.4, stun: .6 };
    let target = null, best = Infinity;
    for (const z of zs) {
      if (z.dead) continue;
      const dx = (z.x - h.x) * h.f;
      if (dx > 0 && dx <= 250 && dx < best) { best = dx; target = z; }
    }
    const landX = target ? target.x : h.x + h.f * 150;
    const landY = target ? target.y : h.y;
    bowFx.push({ kind: 'sky', x: landX, y: landY, t: 0, T: .6, dir: h.f, data, resolved: false });
    return;
  }
  if (weapon === 'stone') {                        // 石子蓄力：按档位 3/4/5 颗，0.12 夹角
    const data = tier === 3 ? { n: 5, dmg: 1.6, chance: 1, time: 1 }
      : tier === 2 ? { n: 4, dmg: 1.2, chance: .7, time: .8 }
      : { n: 3, dmg: .8, chance: .4, time: .6 };
    const run2 = Math.hypot(h.ix || 0, h.iy || 0) > .2;
    for (let i = 0; i < data.n; i++) {
      const ang = (i - (data.n - 1) / 2) * .12;
      const C = Object.assign({}, W.combo[0], { dmg: data.dmg, spd: 310, life: .8, dazeChance: data.chance, dazeTime: data.time, daze: 1 });
      shots.push({ x: h.x + h.f * 16, y: h.y + (run2 ? rnd(-6, 6) : 0), z: 24, vx: h.f * C.spd * Math.cos(ang), vy: C.spd * Math.sin(ang) * .5, life: C.life, C, c: 0, hitSet: [], gearToken:h.atk.gearToken, charged: true, chargeTier: tier });
    }
    return;
  }
  if (weapon === 'halberd') {                      // 长戟蓄力「回马突」：按档位向前冲并沿途叠裂伤
    const data = tier === 3 ? { dist: 80, dmg: 2.8, stacks: 4 }
      : tier === 2 ? { dist: 60, dmg: 2.2, stacks: 3 }
      : { dist: 40, dmg: 1.6, stacks: 2 };
    const dmg = data.dmg;   // 档位已决定伤害，不再乘蓄力系数
    // 不再瞬移：交给 updateHalberdDash 每帧往前冲，能看到身形和残影
    h.halberdDash = { left: data.dist, sp: 260, dmg, stacks: data.stacks, hitSet: new Set(), ghostT: 0, kb: W.combo[0].kb, dy: W.dy + 8 };
    h.inv = Math.max(h.inv || 0, data.dist / 260 + .05);   // 冲刺途中无敌，方便突围
    return;
  }
  if (weapon === 'hammer') {                       // 锤子蓄力「千斤坠」：按档位前方扇形，全部击倒（首领只打断）
    const data = tier === 3 ? { range: 80, dmg: 3.6, size: 90 }
      : tier === 2 ? { range: 65, dmg: 2.8, size: 75 }
      : { range: 50, dmg: 2.0, size: 60 };
    const range = data.range * (window.GEAR ? GEAR.range() : 1);
    const dmg = data.dmg;   // 档位已决定伤害，不再乘蓄力系数
    hammerFx.push({ kind: 'slam', x: h.x + h.f * 30, y: h.y, t: 0, T: .28, size: data.size });   // 锤头落点在正前方
    for (const z of zs) {
      if (z.dead || z.air) continue;
      const dx = (z.x - h.x) * h.f, dy = z.y - h.y, bw = z.T.w || 0;
      if (dx < -12 || dx > range + bw || Math.abs(dy) > Math.max(24, dx * .7 + 14)) continue;
      hit(z, dmg, W.combo[W.combo.length - 1].kb, h.f, true, 0, .35, W.interrupt, false, { charged: true, noBossKnock: true, knockSiege: true, hammerSlam: true });
    }
    return;
  }
  if (weapon === 'blade') {                        // 大刀蓄力「半月斩」：前方上下各45，高概率暴击
    const data = tier === 3 ? { dmg: 2.6, chance: .8, knock: true }
      : tier === 2 ? { dmg: 2.0, chance: .6, knock: false }
      : { dmg: 1.4, chance: .4, knock: false };
    const dmg = data.dmg;   // 档位已决定伤害，不再乘蓄力系数
    bladeFx.push({ kind: 'crescent', x: h.x + h.f * 30, y: h.y - 16, t: 0, T: .3, dir: h.f });
    for (const z of zs) {
      if (z.dead || z.air) continue;
      const dx = (z.x - h.x) * h.f, dy = z.y - h.y, bw = z.T.w || 0;
      if (dx < -12 || dx > 45 + bw || Math.abs(dy) > 45) continue;
      hit(z, dmg, data.knock ? 80 : 55, h.f, data.knock, 0, .15, W.interrupt, false, { charged: true, critChance: data.chance, critCap: 2, guaranteedCrit: critT > 0, noBossKnock: data.knock });
    }
    return;
  }
  for (const z of zs) {
    if (z.dead) continue;
    if (z.hidden && Math.hypot(hero.x - z.x, hero.y - z.y) > 88) continue;   // 还藏着的伏兵不画
    const dx = (z.x - h.x) * h.f, dy = z.y - h.y;
    if (Math.abs(dy) > 26) continue;
    const rear = dx < 0 && Math.abs(dy) < -dx * 1.732;
    if (!rear && Math.hypot(dx, dy) < R + (z.T.w || 0)) {
      const dmg = 1.6 * force;
      hit(z, dmg, 140 * force, h.f, true, .5, .35, false, false, { charged: true, dazeChance: .5 });
      addChargeHitFx('staff', z.x, z.y - 15, h.f);
    }
  }
  for (const v of villagers) {
    if (v.state === 'gone') continue;
    const dx = (v.x - h.x) * h.f, dy = v.y - h.y;
    if (Math.hypot(dx, dy) < R + 10 && Math.abs(dy) < 26) v.flash = .12;
  }
}
function startAtk() {
  const h = hero;
  if (IS_TOUCH && !(joy && Math.abs(joy.dx) > .3)) {   // 手机：没在推摇杆左右时，自动面向身边最近的敌人
    let best = null, bd = 1e9;
    for (const z of zs) { if (z.dead || z.ally || z.decoy) continue; const dx = z.x - h.x, dy = Math.abs(z.y - h.y); if (Math.abs(dx) > 90 || dy > 30) continue; const d = Math.abs(dx) + dy * 2; if (d < bd) { bd = d; best = z; } }
    if (best && Math.abs(best.x - h.x) > 4) h.f = Math.sign(best.x - h.x);
  }
  // 上一下在连招窗口内打中了敌人 → 接下一下；否则从第一下开始
  const chain = h.comboWin > 0 && gameT - (h.lastHit || -9) < .7 && h.lastHitC === h.combo;
  const fin = window.ROGUE && ROGUE.takeFinisher && ROGUE.takeFinisher();   // 回锋 / 倒持：下一下直接是终段
  set(h, 'atk'); h.atk = { weak: fin === 'swap', huifeng: fin === 'huifeng', c: fin ? WEAP[weapon].combo.length - 1 : chain ? (h.combo + 1) % WEAP[weapon].combo.length : 0, fi: 0, t: 0, lg: 0, gearToken: window.GEAR ? GEAR.attackToken() : null };
}
function strike() {
  const h = hero, W = WEAP[weapon], c = h.atk.c, C = W.combo[c];
  if (W.proj) {
    sfx('swing_stone', h.x); h.lastShotC = c;
    const finisher = c === W.combo.length - 1;
    if (weapon === 'bow' && finisher) {                        // 连珠箭：3~5 支 ±8° 小扇形
      const n = 3 + Math.floor(rnd(0, 3)), spread = 8 * Math.PI / 180;
      bowFx.push({ kind: 'volley', x: h.x + h.f * 20, y: h.y - 22, t: 0, T: .2, dir: h.f });
      for (let i = 0; i < n; i++) {
        const ang = n === 1 ? 0 : (i - (n - 1) / 2) * (spread * 2 / (n - 1));
        const C2 = { ...C, dmg: .5, pierce: false, noPierce: true };
        shots.push({ x: h.x + h.f * 16, y: h.y, z: 22, vx: h.f * C.spd * Math.cos(ang), vy: C.spd * Math.sin(ang) * .5, life: C.life, C: C2, c, hitSet: [], gearToken: h.atk.gearToken, kind: 'arrow', volley: true, final: true });
      }
      return;
    }
    const mainC = C;
    const running = Math.hypot(h.ix || 0, h.iy || 0) > .2;   // 有方向输入 = 跑动中投掷
    const sOff = running ? (weapon === 'bow' ? rnd(-3, 3) : rnd(-6, 6)) : 0;   // 跑动中弹道偏：石子 ±6、汉弓 ±3，站定不偏
    shots.push({ x: h.x + h.f * 16, y: h.y + sOff, z: 22, vx: h.f * C.spd * (window.Boss && Boss.wxProj ? Boss.wxProj() : 1), life: C.life || (C.pierce ? 1.1 : .8), C: mainC, c, hitSet: [], gearToken:h.atk.gearToken, kind: weapon === 'bow' ? 'arrow' : undefined, final: finisher });
    if (window.ROGUE && ROGUE.onShoot) ROGUE.onShoot(C, c, finisher, sOff);   // 飞蝗散弹、矢如连珠副弹
    if (weapon === 'stone' && finisher) {                     // 全力投自带左右两颗30%副弹
      const sideToken = h.atk.gearToken ? { ...h.atk.gearToken, crit: false, projectileExtrasChecked: true } : null;
      for (const ang of [-.20944, .20944]) {
        const C2 = { ...C, dmg: C.dmg * .3, noPierce: true, daze: 0, dazeChance: 0, dazeTime: 0 };
        shots.push({ x: h.x + h.f * 16, y: h.y + sOff, z: 22, vx: h.f * C.spd * Math.cos(ang), vy: C.spd * Math.sin(ang) * .5, life: C.life || .8, C: C2, c, hitSet: [], gearToken: sideToken, secondary: true });
      }
    }
    return;
  }
  let landed = false, hitEnemy = false;
  const reach = W.reach * (window.GEAR ? GEAR.range() : 1);
  const rch = C.thrust ? reach * 1.35 : reach;                          // 「戳」比劈多 35% 距离
  const finisher = c === W.combo.length - 1;
  const isFinisher = finisher;
  const fin = 1;
  const hammerFinisher = weapon === 'hammer' && isFinisher;
  const bladeFinisher = weapon === 'blade' && isFinisher;
  if (hammerFinisher) hammerFx.push({ kind: 'spin', x: h.x, y: h.y, t: 0, T: .3, size: 70 });
  if (bladeFinisher) bladeFx.push({ kind: 'slash', x: h.x + h.f * 30, y: h.y - 16, t: 0, T: .24, dir: h.f });
  for (const z of zs) {
    if (z.dead || z.air) continue;
    const dx = (z.x - h.x) * h.f;
    const bw = z.T.w || 0;
    const backTol = Math.max(16, rch * .6);   // 贴身/刚冲过头也算命中
    const inRange = hammerFinisher ? Math.hypot(z.x - h.x, z.y - h.y) <= 40 + bw : (C.both ? Math.abs(dx) < rch + bw : dx > -backTol - bw && dx < rch + bw);
    if (inRange && (hammerFinisher || Math.abs(z.y - h.y) < W.dy)) {
      landed = hitEnemy = true;
      // 背刺：从敌人背后打 ×1.5；补刀：敌人倒地中 ×2；完美闪避暴击 ×2
      const behind = Math.sign(h.x - z.x) !== z.f;   // 主角在敌人背后（敌人朝另一侧）
      const downed = z.st === 'land' || z.air;
      let mult = 1;
      if (behind) mult *= 1.5;
      if (downed) mult *= 2;

      if (behind || downed) floaters.push({ x: z.x, y: z.y - 26, t: 0, txt: downed ? '补刀！' : '背击！', big: true });
      let attackDmg = C.dmg * fin * mult;

      const hitDir = hammerFinisher ? (Math.sign(z.x - h.x) || h.f) : (C.both ? Math.sign(z.x - h.x) || h.f : h.f);
      hit(z, attackDmg, C.kb, hitDir, C.knock, C.daze || 0, .35, W.interrupt, false, { finisher: isFinisher, guaranteedCrit: critT > 0 || bladeFinisher, ...(bladeFinisher ? { critCap: 2 } : {}), ...(weapon === 'staff' && isFinisher ? { dazeChance: 1 } : {}), ...(hammerFinisher ? { noBossKnock: true, knockSiege: true } : {}) });
      const execLine = window.ROGUE && ROGUE.has('斩首') ? .25 : .15;   // 用户定：斩杀线 25%→15%（斩首 35%→25%）
      if (bladeFinisher && !z.dead && !z.T.boss && !z.T.chapterBoss && (z.T.elite || z.T.ch2Elite) && z.hp > 0 && z.hp < z.T.hp * execLine) hit(z, .66, 0, h.f, false, 0, 0, false, false, { secondary: true });   // 精英不被斩杀，改为补 30% 伤害
      else if (bladeFinisher && !h.atk?.execDone && !z.dead && !z.T.boss && !z.T.chapterBoss && z.hp > 0 && z.hp < z.T.hp * execLine) {
        if (h.atk) h.atk.execDone = true;   // 一刀最多斩 1 个
        if (window.ROGUE && ROGUE.onExecute) ROGUE.onExecute();
        z.hp = 0; z.dead = 1; kills++; set(z, 'land');
        if (z.villagerChaser) thankVillagers();
        if (z.T.elite) { spawnDrop(z.x - 8, z.y, 'leg'); if (!chapter2Run) spawnDrop(z.x + 12, z.y); sfx('finisher', z.x); }
        floaters.push({ x: z.x, y: z.y - 40, t: 0, txt: '斩！', big: true, gold: true });
        sfx('finisher', z.x);
      }
      if (weapon === 'halberd') {
        if (!z.dead) {
          const unit = mult * (window.GEAR && GEAR.attackScale ? GEAR.attackScale(z) : 1);   // 主攻击（不含段数倍率）
          const stacks = addHalberdBleed(z, unit, 1);
          if (isFinisher) {
            const rupture = stacks * .3 * unit;
            clearHalberdBleed(z);
            hit(z, rupture, 0, 0, false, 0, 0, false, false, { secondary: true, halberdRupture: true });
            if (window.ROGUE && ROGUE.has('血债')) for (const o of zs) if (o !== z && !o.dead && !o.air && Math.hypot(o.x - z.x, (o.y - z.y) * 2) < 50) { hit(o, rupture * .5, 0, 0, false, 0, 0, false, false, { secondary: true }); bleedFx.push({ kind: 'splash', x: o.x, y: o.y - 12, t: 0, T: .15 }); }   // 血债：溅给周围
            bleedFx.push({ kind: 'rip', x: z.x, y: z.y - 12, t: 0, T: .2 });
            bleedFx.push({ kind: 'splash', x: z.x, y: z.y - 12, t: 0, T: .15 });
            floaters.push({ x: z.x, y: z.y - 38, t: 0, txt: (Math.round(rupture * 10) / 10).toFixed(1), big: true, red: true });
            freeze = Math.max(freeze, .12);
          } else {
            bleedFx.push({ kind: 'splash', x: z.x, y: z.y - 12, t: 0, T: .15 });
          }
        }
      } else if (weapon === 'staff' && isFinisher) {
        bluntHits.push({ x: z.x, y: z.y - 14, t: 0, T: .2, big: true });
        freeze = Math.max(freeze, .12);   // 棍子终段「戳」专属爆发
      } else if (weapon === 'staff' || (weapon === 'hammer' && !isFinisher)) {
        bluntHits.push({ x: z.x, y: z.y - 12, t: 0, T: .15 });
      }
      if (!C.multi) break;
    }
  }
  // 误伤村民只闪一下，不扣血、不计击倒，也不改变连招判定。
  for (const v of villagers) {
    if (v.state === 'gone' || v.hitAtk === h.atk) continue;
    const dx = (v.x - h.x) * h.f;
    const inRange = C.both ? Math.abs(dx) < rch + 10 : dx > -14 && dx < rch + 10;
    if (inRange && Math.abs(v.y - h.y) < W.dy) { v.flash = .12; v.hitAtk = h.atk; }
  }
  // 草垛、推车、石碾也能打：判定和打敌人一样（左右用 p.w/2，上下用 dy）；打中道具也算"打中"，可以接连招
  for (const p of props) {
    if (!canHitProp(p)) continue;
    const dx = (propXAt(p, h.y) - h.x) * h.f;
    const inRange = C.both ? Math.abs(dx) < rch + p.w / 2 : dx > -4 - p.w / 2 && dx < rch + p.w / 2;
    if (inRange && propDY(p, h.y) < W.dy) {
      landed = true; h.lastHit = gameT; h.lastHitC = c;
      hitProp(p, Math.sign(p.x - h.x) || h.f);
    }
  }
  const snd = W.snd || weapon;   // 音效名（锤子借用木棍那一套闷响）
  if (hitEnemy) { sfx('hit_' + snd, h.x + h.f * 20); sfx('crack', h.x + h.f * 26); if (c === W.combo.length - 1) sfx('finisher', h.x); }
  else if (!landed) sfx('swing_' + snd, h.x);   // 只打中道具时，音效由 hitProp 自己播
}
// 主角能不能被打中；翻滚无敌中被「本来会打中」的攻击擦过 → 算躲过（回锋、避实用）
function heroOpen() { if (hero.inv <= 0) return true; if (hero.st === 'roll' && window.ROGUE && ROGUE.onDodge) ROGUE.onDodge(); return false; }
function dmgHero(n, from, kind = 'basic') {
  if (hero.decoy) { hero.hp -= n; hero.hitT = .2; return; }   // 打中的是稻草人
  const h = hero; if (h.inv > 0 && h.st === 'roll' && window.ROGUE && ROGUE.onDodge) ROGUE.onDodge(from, n, kind);
  if (h.inv > 0 || h.air || h.st === 'down' || h.st === 'bounce' || h.st === 'getup' || over) return;
  if (window.ROGUE && ROGUE.absorbHit && ROGUE.absorbHit()) { h.shieldFlash = .22; return; }
  if (window.ROGUE && ROGUE.hardClash && ROGUE.hardClash(from)) return;
  if (window.ROGUE && ROGUE.sidestep && ROGUE.sidestep(n, kind)) return;   // 闪身
  if (window.XIAOCHANG && XIAOCHANG.active()) n = XIAOCHANG.heroDamage(n, from);
  n = n * R_('take');
  if (window.GEAR) n = GEAR.incoming(n, from, kind);
  const raw = n;   // 保存减半前伤害，保持原有击倒判定。
  if (noviceMode()) n *= .5;
  if (IS_TOUCH) n *= .8;
  if (n <= 0) return;
  n = Math.max(.01, n);
  const steadyHold = h.hp > n && charging && R_('steady', 0) > 0 && Math.random() < R_('steady', 0);
  hitsTaken++;   // 结算评价用：被打了多少下
  comboCount = 0; comboExpireAt = 0;   // 主角实际受击，连击立即结束
  sfx('hurt', h.x);
  h.hp -= n; h.inv = .7; shake = .2;
  if (h.hp <= 0 && window.MERIDIAN && MERIDIAN.tryUnyield()) return;   // 经脉·不屈：一局挡一次致命伤
  if (window.MERIDIAN) MERIDIAN.onHurt();   // 经脉·镇关
  if (window.ROGUE && ROGUE.onHurt) ROGUE.onHurt();   // 解围
  if (window.XIAOCHANG) XIAOCHANG.onHitHero(from);
  if (!steadyHold) { h.atk = null; cancelCharge(); }
  const dir = from ? Math.sign(h.x - from.x) || -h.f : -h.f;
  if (steadyHold) { /* 蓄力韧性：照常受伤，但这次受击不中断蓄力 */ }
  else if (raw >= 2 * (window.MERIDIAN ? MERIDIAN.x('knock', 1) : 1) || h.hp <= 0) {
    launch(h, h.hp <= 0 ? dir * 48 : dir * 85, h.hp <= 0 ? 145 : 120); h.f = -dir; h.inv = 9;
    if (window.ARTIFACT) ARTIFACT.onKnock(dir);   // 被击倒：从飞剑上摔下
    if (h.hp <= 0) h.deathArc = true;
  } else { set(h, 'hurt'); h.vx = dir * 80; if (window.ARTIFACT && ARTIFACT.onHit && from && from.T) ARTIFACT.onHit(dir); }   // 踩剑被近战连击会摔下（箭石不算）
  if (h.hp <= 0) {
    if (window.GEAR && GEAR.tryRevive()) return;
    over = true; deathLandedAt = null; enemiesCelebrating = false; say(chapter2Run && chapter2Run.battle === 6 ? '张角：“蝼蚁，也敢逆天。”' : '倒下了……', chapter2Run && chapter2Run.battle === 6 ? 3 : 1.4);
    zs.forEach(z => { if (!z.dead && !z.T.boss) { set(z, 'idle'); z.vx = 0; z.qi = null; } });
  }
}

// ---------- 黄巾兵 AI ----------
// 第二章小兵：技能状态独立于普攻，蓄力/冲刺不借用首领逻辑。
let enemySkillFx = [];
function ch2Armored(z) {
  return !!(chapter2Run && z.enemySkill && (z.type === 'yellow-heavy' || (z.type === 'yellow-spear' && z.enemySkill.phase === 'dash')));
}
function ch2NearestShield(z) {
  return zs.filter(o=>o!==z&&!o.dead&&o.st!=='gone'&&o.type==='yellow-shield').sort((a,b)=>Math.hypot(a.x-z.x,a.y-z.y)-Math.hypot(b.x-z.x,b.y-z.y))[0];
}
// 第二章精英：现有小兵放大 15%、暗红光晕、名字加「精英·」，血/伤害提高并各有专属强化（用户定）
const CH2_ELITE_STATS = { 'yellow-shield': { hp: 20, dmg: 2 }, 'yellow-heavy': { hp: 18, dmg: 3 }, 'yellow-spear': { hp: 14, dmg: 2.5 } };
const CH2_ELITES = { 1: { 2: ['yellow-heavy'] }, 2: { 1: ['yellow-shield'] }, 3: { 1: ['yellow-shield'] }, 4: { 1: ['yellow-heavy', 'yellow-spear'] }, 5: { 1: ['yellow-shield', 'yellow-spear'] } };
function makeCh2Elite(z) {
  const s = CH2_ELITE_STATS[z.type]; if (!s || z.T.ch2Elite) return;
  z.T = { ...z.T, ...s, ch2Elite: true, name: '精英·' + z.T.name }; z.hp = z.T.hp; z.sc = (z.sc || 1) * 1.15;
}
function applyCh2Elites(battle, wave) {
  for (const type of (CH2_ELITES[battle] || {})[wave] || []) {
    let z = zs.find(e => !e.dead && e.type === type && !e.T.ch2Elite);
    if (!z) { spawn(type, hero.x + 220, (M.top + M.bot) / 2); z = zs[zs.length - 1]; }
    makeCh2Elite(z);
  }
}
function ch2Formation(z) {
  if(!chapter2Run)return null;
  const shield=ch2NearestShield(z);
  // 盾墙：盾兵自己照常往主角压上去（慢慢逼近），身后的枪兵、远程、方士跟着盾兵走。
  // （原来盾兵会退到后排兵前面守着，后排又跟着盾兵，两边互相等，结果整队停在远处不动）
  if(shield&&(z.T.ranged||z.T.priest||z.type==='yellow-spear')){
    const sd=Math.hypot(shield.x-hero.x,shield.y-hero.y);
    if(z.T.ranged&&sd<z.T.range[0])return null;            // 盾兵已经贴近主角：远程改回自己找射击距离
    const dx=shield.x-hero.x,dy=shield.y-hero.y,len=Math.hypot(dx,dy)||1,d=z.type==='yellow-spear'?20:25;
    return {x:shield.x+dx/len*d,y:Math.max(M.top,Math.min(M.bot,shield.y+dy/len*d))};
  }
  if(z.type==='yellow-heavy'){
    const peers=zs.filter(o=>!o.dead&&o.type==='yellow-heavy');
    if(peers.length>=2)return {x:hero.x+(peers.indexOf(z)%2?40:-40),y:hero.y};
  }
  return null;
}
function ch2BeginSkill(z) {
  z.enemySkill={phase:'wind',t:0,f:Math.sign(hero.x-z.x)||z.f,hit:false};
  z.f=z.enemySkill.f;z.moving=false;z.vx=0;set(z,'wind');
  z.skillCd=z.type==='yellow-heavy'?6:z.type==='yellow-shield'?7:5;sfx('bladeAlert',z.x);
}
function ch2Skill(z,dt) {
  if(!chapter2Run)return false;
  z.skillCd=Math.max(0,(z.skillCd||0)-dt);
  let skill=z.enemySkill;
  if(skill&&(z.dead||z.air||(!ch2Armored(z)&&(z.stun>0||z.daze>0)))){z.enemySkill=null;return false;}
  if(!skill){
    if(!['yellow-heavy','yellow-shield','yellow-spear'].includes(z.type)||z.skillCd>0||!['idle','move'].includes(z.st)||z.stun>0||z.daze>0)return false;
    const dx=hero.x-z.x,dy=hero.y-z.y,front=dx*z.f;
    const formation=ch2Formation(z);
    if(z.type==='yellow-heavy'&&formation&&Math.abs(z.x-formation.x)>18)return false;
    const can=z.type==='yellow-heavy'?front>=0&&front<=70&&Math.abs(dy)<35:z.type==='yellow-shield'?front>=0&&front<=40&&Math.abs(dy)<20:front>=60&&front<=110&&Math.abs(dy)<=20;
    if(!can)return false;
    ch2BeginSkill(z);skill=z.enemySkill;
  }
  skill.t+=dt;z.f=skill.f;z.moving=false;
  if(ch2Armored(z)){z.stun=0;z.daze=0;z.vx=0;}
  const wind=z.type==='yellow-heavy'?1:z.type==='yellow-shield'?.4:.6;
  if(skill.phase==='wind'){
    if(skill.t<wind)return true;
    set(z,'strike');skill.phase='dash';skill.t=0;
    if(z.type==='yellow-heavy'){
      enemySkillFx.push({x:z.x+z.f*20,y:z.y-15,f:z.f,t:0,T:.3});
      const dx=(hero.x-z.x)*z.f,dy=hero.y-z.y;
      if(dx>=0&&Math.hypot(dx,dy)<=45&&Math.abs(dy)<=dx+8)dmgHero(z.T.ch2Elite?3.2:2.5,z,'skill');
      for(const oy of z.T.ch2Elite?[-14,0,14]:[0])eshots.push({k:'enemyWave',x:z.x+z.f*12,y:z.y+oy,vx:z.f*150,left:z.T.ch2Elite?70:50,t:0,life:1,source:z});sfx('enemySwing',z.x);   // 精英：一次放 3 道剑气
      skill.phase='recover';return true;
    }
    skill.left=z.type==='yellow-shield'?30:z.T.ch2Elite?70:50;   // 精英枪兵冲得更远
    if(z.type==='yellow-spear')for(const other of zs){
      if(other!==z&&!other.dead&&!other.air&&other.type==='yellow-spear'&&!other.enemySkill&&(other.skillCd||0)<=0&&!(other.stun>0)&&!(other.daze>0)&&Math.hypot(other.x-z.x,other.y-z.y)<=100)ch2BeginSkill(other);
    }
  }
  if(skill.phase==='dash'){
    const step=Math.min(skill.left,180*dt);moveEnt(z,z.f*step,0);skill.left-=step;
    if(!skill.hit&&Math.abs(hero.x-z.x)<(z.type==='yellow-spear'?37:18)&&Math.abs(hero.y-z.y)<16&&(hero.x-z.x)*z.f>=-10){
      const before=hero.hp;dmgHero(z.type==='yellow-shield'?(z.T.ch2Elite?2:1):2,z,'skill');skill.hit=true;   // 精英盾撞 2 伤会撞倒
      if(z.type==='yellow-shield'&&hero.hp<before)moveEnt(hero,z.f*40,0);
    }
    if(skill.left<=0){
      if(z.T.ch2Elite&&z.type==='yellow-spear'&&!skill.second){skill.second=true;skill.f=Math.sign(hero.x-z.x)||skill.f;z.f=skill.f;skill.left=70;skill.hit=false;}   // 精英枪兵：立刻接第二次冲刺
      else{skill.phase='recover';skill.t=0;}
    }
  }
  if(skill.phase==='recover'&&skill.t>=.35){z.enemySkill=null;z.tok=false;set(z,'move');}
  return true;
}
const enemyTintCache=new Map();
// 敌方火箭 / 投石：箭杆 + 三角箭头 + 尾羽 + 箭头小火苗；投石是带火的黑石块（敌方特效：暗橙土红，不加白金高光）
function drawEnemyMissile(s, x, y, p) {
  const vx = (s.tx - s.x0) / s.T, vy = (s.ty - s.y0) / s.T - Math.cos(p * Math.PI) * 60 * Math.PI / s.T, ang = Math.atan2(vy, vx);
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(1.35, 1.35);   // 放大一点，在栅栏背景前也看得清
  if (s.k === 'catapult') {
    for (let i = 1; i <= 3; i++) { ctx.fillStyle = `rgba(120,50,25,${.35 - i * .09})`; ctx.beginPath(); ctx.arc(-i * 4, 0, 5 - i, 0, 7); ctx.fill(); }   // 拖尾烟火
    ctx.fillStyle = '#2a1c14'; ctx.beginPath(); ctx.arc(0, 0, 5.2, 0, 7); ctx.fill();
    ctx.fillStyle = '#4e3a2a'; ctx.beginPath(); ctx.arc(-1, -1, 3.6, 0, 7); ctx.fill();
    const fl = 1 + Math.sin(performance.now() / 60) * .3;
    ctx.fillStyle = '#a0461e'; ctx.beginPath(); ctx.arc(2.5, -2, 2.4 * fl, 0, 7); ctx.fill();
    ctx.fillStyle = '#c4682a'; ctx.beginPath(); ctx.arc(3, -2.5, 1.2 * fl, 0, 7); ctx.fill();
  } else {
    const head = s.enemyVolley ? '#7d3023' : '#8a3a1c', flame = s.enemyVolley ? '#a54a28' : '#b8521f';
    ctx.strokeStyle = 'rgba(120,60,30,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-7, 0); ctx.stroke();   // 速度线
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(-7.5, -1, 13, 2);          // 箭杆描边
    ctx.fillStyle = '#7a5530'; ctx.fillRect(-7, -.5, 12, 1);           // 箭杆
    ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(4, -2.5); ctx.lineTo(4, 2.5); ctx.closePath(); ctx.fill();   // 箭头
    ctx.fillStyle = '#6b6a66'; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(4.5, -1.5); ctx.lineTo(4.5, 1.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = head; ctx.fillRect(-8, -2.5, 3, 1.5); ctx.fillRect(-8, 1, 3, 1.5);   // 尾羽
    const fl = Math.sin(performance.now() / 50 + s.x0) * .8;
    ctx.fillStyle = flame; ctx.beginPath(); ctx.arc(5.5 + fl * .3, -1.5, 1.8, 0, 7); ctx.fill();   // 箭头上的小火苗
  }
  ctx.restore();
}
function drawEnemySheet(key,x,y,f,width,time,duration){
  const img=IMG['ui_'+key];if(!img||!img.complete||!img.naturalWidth)return;
  let canvas=enemyTintCache.get(key);
  if(!canvas){canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const g=canvas.getContext('2d');g.drawImage(img,0,0);g.globalCompositeOperation='source-in';g.fillStyle='#a34426';g.fillRect(0,0,canvas.width,canvas.height);enemyTintCache.set(key,canvas);}
  const fw=canvas.width/3,fh=canvas.height,frame=Math.min(2,Math.floor(time/duration*3)),height=width*fh/fw;
  ctx.save();ctx.translate(x,y);ctx.scale(f,1);ctx.imageSmoothingEnabled=false;ctx.drawImage(canvas,frame*fw,0,fw,fh,-width/2,-height/2,width,height);ctx.restore();
}
function ch2Telegraph(z){
  if(!chapter2Run||!z.enemySkill||z.enemySkill.phase!=='wind'||z.dead)return;
  ctx.save();ctx.fillStyle='#b64c2b';ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.fillText('!',z.x,z.y-42);
  if(z.type==='yellow-spear'){ctx.fillStyle='rgba(130,42,29,.3)';ctx.fillRect(z.f>0?z.x:z.x-90,z.y-5,90,10);}
  ctx.restore();
}

// 敌人互相让位：两人几乎站在同一点时，沿上下方向（为主）慢慢错开，站成并排，不叠在一起
function separateEnemies(dt) {
  const L = zs.filter(z => !z.dead && !z.air && !z.static && z.st !== 'sleep' && z.st !== 'down' && !z.T.boss);
  const RX = 18, RY = 12, push = 60 * dt;
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const a = L[i], b = L[j], dx = b.x - a.x, dy = b.y - a.y;
    if (Math.abs(dx) >= RX || Math.abs(dy) >= RY) continue;
    // 主要上下分开；完全重合时按序号决定谁上谁下，避免两人一起抖
    let sy = Math.sign(dy) || (i % 2 ? 1 : -1);
    if (a.y - sy * push < M.top + 1 || b.y + sy * push > M.bot - 1) sy = -sy;
    const k = (1 - Math.abs(dy) / RY) * push, kx = (1 - Math.abs(dx) / RX) * push * .3 * (Math.sign(dx) || 1);
    for (const [e, m] of [[a, -1], [b, 1]]) {
      const ny = Math.max(M.top, Math.min(M.bot, e.y + m * sy * k)), nx = e.x + m * kx;
      if (!blocked(e.x, ny)) e.y = ny;
      if (!blocked(nx, e.y)) e.x = nx;
    }
  }
}
function zUpdate(z, dt) {
  if (window.GEAR && !z.dead) { dt = GEAR.enemyTime(z, dt); if (!dt) return; }
  if (z.T.boss) return Boss.update(z, dt);
  const T = z.T;
  if (T.siege) { updateChapter2Catapult(z, dt); return; }
  if (T.chapterBoss) { updateChapter2Boss(z, dt); return; }
  // 守车兵：主角离岗位远时回岗位站定，不追出去（投石车阵的盾兵、大刀兵）
  if (z.guard && !z.dead && !z.air && !(z.stun > 0) && (z.st === 'move' || z.st === 'idle') && (z.siegeArcher ? Math.hypot(z.x - z.guard.x, z.y - z.guard.y) > 10 : Math.hypot(hero.x - z.guard.x, (hero.y - z.guard.y) * 1.5) > 115)) {   // 投石车弓手：一步不离岗，只站着射
    const dx = z.guard.x - z.x, dy = z.guard.y - z.y, d = Math.hypot(dx, dy);
    if (z.siegeArcher && d > 40) { z.x = z.guard.x; z.y = z.guard.y; return; }   // 投石车弓手：出场就站在拒马墙后的岗位上（以前被锁屏边界推到墙前，卡在墙边走不过去）
    z.t += dt; z.flash = Math.max(0, z.flash - dt); z.cd = Math.max(z.cd, .4);
    if (d > 4) { z.moving = true; z.f = Math.sign(dx) || z.f; moveEnt(z, dx / d * T.spd * dt, dy / d * T.spd * .7 * dt); }
    else { z.moving = false; z.f = Math.sign(hero.x - z.x) || z.f; }
    return;
  }
  z.t += dt * (window.GEAR ? GEAR.enemyAttack(z) : (z.attackSlowT > 0 ? .9 : 1)); z.flash = Math.max(0, z.flash - dt); z.cd -= dt * (window.GEAR ? GEAR.enemyAttack(z) : (z.attackSlowT > 0 ? .9 : 1));
  z.moveSlowT = Math.max(0, (z.moveSlowT || 0) - dt); z.attackSlowT = Math.max(0, (z.attackSlowT || 0) - dt);
  if (z.qiCd > 0) z.qiCd -= dt;
  if (z.qi != null) {                     // 老卒蓄力中：0.62 秒后劈出扇形剑气
    z.qi += dt * (window.XIAOCHANG ? XIAOCHANG.actionScale(z) : 1);
    if (z.qi >= .62) {
      z.qi = null;
      qiFx.push({ x: z.x, y: z.y, f: z.f, t: 0, T: .28 });
      sfx('enemySwing', z.x); shake = Math.max(shake, .18);
      const hx = hero.x - z.x;
      if (Math.abs(hx) < 60 && Math.abs(hero.y - z.y) < 20 && hx * z.f > -10) dmgHero(2, z, 'skill');
    }
  }
  if (z.adds != null) {                 // 援军弓箭手：两轮箭，然后撤离
    if (z.dead || z.air || z.stun > 0 || z.daze > 0) { z.adds = null; return; }
    if (z.st === 'addwalk') {
      const dx = z.standX - z.x;
      z.f = Math.sign(dx) || z.f; z.moving = Math.abs(dx) >= 3;
      if (Math.abs(dx) < 3) {
        z.x = z.standX; z.moving = false; set(z, 'addaim');
        if (!zs.some(o => o !== z && o.adds != null && o.st === 'addwalk'))
          zs.forEach(o => { if (o.adds != null && o.st === 'addaim') { o.t = 0; o.addWait = .5 + o.addDelay; } });
      }
      else z.x += Math.sign(dx) * Math.min(Math.abs(dx), 55 * dt);
      return;
    }
    if (z.st === 'addaim') {
      if (zs.some(o => o.adds != null && o.st === 'addwalk')) return;
      if (z.t >= z.addWait) {
        eshots.push({ k: 'fire', x0: z.x + z.f * 14, y0: z.y, tx: hero.x + rnd(-26, 26), ty: hero.y + rnd(-8, 10), t: 0, T: .9, short: 1.8 });
        sfx('bow', z.x); z.adds = 1; set(z, 'addvolley'); z.volleyGap = 3 + 2 * .35;
      }
      return;
    }
    if (z.st === 'addvolley') {
      z.volleyGap -= dt;
      if (z.volleyGap <= 0) {
        if (z.adds > 0) {
          eshots.push({ k: 'fire', x0: z.x + z.f * 14, y0: z.y, tx: hero.x + rnd(-26, 26), ty: hero.y + rnd(-8, 10), t: 0, T: .9, short: 1.8 });
          sfx('bow', z.x); z.adds = 0; z.volleyGap = .18 + (2 - z.addOrder) * .35; set(z, 'addvolley');
        } else { z.f = z.addExitDir; z.moving = true; set(z, 'addleave'); }
      }
      return;
    }
    if (z.st === 'addleave') {
      z.moving = true; z.x += z.addExitDir * 70 * dt;
      if ((z.addExitDir < 0 && z.x <= z.addExitX) || (z.addExitDir > 0 && z.x >= z.addExitX)) {
        z.x = z.addExitX; z.st = 'gone'; z.t = 1;   // 走出画面直接消失（不播倒地、不计击倒）
      }
      return;
    }
    return;
  }
  if (z.air) { airStep(z, dt); return; }
  if (z.st === 'land') { if (z.t > .45) { if (z.dead) { z.st = 'gone'; z.t = 0; } else set(z, 'move'); } return; }
  if (z.dead) return;
  if(ch2Skill(z,dt))return;
  if (z.st === 'sleep') {
    if (Math.hypot(hero.x - z.x, hero.y - z.y) < 72) { set(z, 'wake'); z.hidden = false; sfx('wake', z.x); }
    return;
  }
  if (z.st === 'wake') { if (z.t > (z.T.elite ? 1.0 : .55)) set(z, 'move'); else return; }
  if (T.priest) {                        // 方士：远离玩家 → 念咒 → 回血/火球，念咒可被打断
    if (z.daze > 0) { z.daze -= dt; z.stun = Math.max(0, z.stun - dt); moveEnt(z, z.vx * dt, 0); z.vx *= .85; return; }
    if (z.stun > 0) { z.stun -= dt; moveEnt(z, z.vx * dt, 0); z.vx *= .85; if (z.stun <= 0) set(z, 'idle'); return; }
    if (z.st === 'hurt') set(z, 'idle');
    if (z.chantCd == null) z.chantCd = 1.5;
    z.chantCd -= dt;
    if (z.st === 'chant') {
      const fire = z.castKind === 'fire';
      if (z.t >= (fire ? 1 : 2)) { fire ? firePriestCast(z) : priestCast(z); set(z, 'idle'); z.chantCd = fire ? 3.5 : 8; }
      return;
    }
    if (z.chantCd <= 0) {
      // 所有方士：有友军受伤先回血（念咒2秒），否则丢火球（念咒1秒）
      const hurtAlly = zs.some(o => o !== z && !o.dead && !o.T.boss && o.hp < o.T.hp * .7);
      const canFire = inChapter2Context();   // 第一章方士只回血，第二章起才丢火球
      // 用户反馈：首领一掉血方士就一直回血、从不放火球 → 回血和火球轮流（刚回过血下一次必丢火球）
      const heal = hurtAlly && (!canFire || z.lastCast !== 'heal');
      if (heal || canFire) { z.castKind = heal ? 'heal' : 'fire'; z.lastCast = z.castKind; set(z, 'chant'); return; }
    }
    const pdx = hero.x - z.x, pad = Math.abs(pdx);
    if (pdx) z.f = Math.sign(pdx);
    let tx = z.x, ty = z.y, moving = false;
    if (pad < 110) { tx = z.x - Math.sign(pdx) * 40; moving = true; }          // 太近：快速后退
    else if (pad > 170) { tx = z.x + Math.sign(pdx) * 40; moving = true; }     // 太远：靠回战场（防被弹飞后卡住）
    else {                                                                     // 合适距离：躲到最近的友军身后
      let ally = null, bd = 1e9;
      for (const o of zs) {
        if (o === z || o.dead || o.T.priest || o.T.boss) continue;
        const d = Math.hypot(o.x - z.x, o.y - z.y);
        if (d < bd) { bd = d; ally = o; }
      }
      if (ally && bd > 46) { tx = ally.x - Math.sign(pdx) * 20; ty = ally.y; moving = true; }
    }
    const cover=ch2Formation(z);if(cover){tx=cover.x;ty=cover.y;moving=Math.hypot(tx-z.x,ty-z.y)>4;}
    z.moving = moving;
    if (moving) {
      const mx = tx - z.x, my = ty - z.y, l = Math.hypot(mx, my) || 1;
      moveEnt(z, mx / l * T.spd * dt, my / l * T.spd * dt);
      if (Math.abs(mx) > 2) z.f = Math.sign(mx) || z.f;
    }
    return;
  }
  if (z.daze > 0) { z.daze -= dt; z.stun = Math.max(0, z.stun - dt); moveEnt(z, z.vx * dt, 0); z.vx *= .85; return; }   // 晕眩：站着不动
  if (z.stun > 0) { z.stun -= dt; moveEnt(z, z.vx * dt, 0); z.vx *= .85; return; }
  if (Math.abs(z.vx) > 1) { moveEnt(z, z.vx * dt, 0); z.vx *= .85; }
  if (z.villagerChaser) {
    const target = [...villagers].reverse().find(v => v.state === 'run');
    if (target) {
      const dx = target.x - z.x, dy = target.y - z.y, d = Math.hypot(dx, dy);
      z.f = Math.sign(dx) || z.f; z.moving = d > 16;
      if (z.moving) {
        const cs = Math.min(T.spd, 26);                                // 比村民（30）慢，永远追不上
        moveEnt(z, dx / d * cs * dt, dy / d * cs * .7 * dt);
        if (z.bx && z.avoidDir == null) moveEnt(z, 0, (z.slot % 2 ? 1 : -1) * cs * dt);
      }
      return;
    }
  }
  const dx = hero.x - z.x, dy = hero.y - z.y;
  // 方士的加持：移速/出手 +20%，持续 4 秒（只刷新不叠加）
  const buff = (z.blessT > 0) ? 1 : 0;
  if (z.blessT > 0) z.blessT -= dt;
  if (z.st === 'wind') {
    // 防卡Y值：近战前摇时慢慢对齐主角的上下位置（每秒最多 22 像素，大步跑开仍能躲）
    if (!T.ranged && Math.abs(dy) < 30) moveEnt(z, 0, Math.sign(dy) * Math.min(Math.abs(dy), 22 * dt));
    // 完美闪避：敌人刀落下前 0.18 秒内翻滚 → 慢动作 + 1 秒暴击窗
    if (!z.pd && z.st === 'wind') {
      const rem = T.wind - z.t;
      if (rem > 0 && rem < .18 && hero.st === 'roll' && hero.t < .22 && pdCd <= 0 &&
          Math.abs(z.x - hero.x) < 130 && Math.abs(z.y - hero.y) < 40) {
        z.pd = true; pdCd = 1.5; slowT = .3; critT = 1.0;
        floaters.push({ x: hero.x, y: hero.y - 30, t: 0, txt: '闪避！', dodge: true });
        sfx('perfect', hero.x); shake = Math.max(shake, .12);
        for (let i = 1; i <= 3; i++) ghosts.push({ x: hero.x - hero.rx * i * 9, y: hero.y - (hero.ry || 0) * i * 9, f: hero.f, a: .45 - i * .1, t: 0 });
      }
    }
    if (z.t > T.wind) {
      set(z, 'strike'); sfx(T.ranged === 'stone' ? 'sling' : T.ranged === 'fire' ? 'bow' : 'enemySwing', z.x);
      if (T.ranged === 'stone') eshots.push({ source:z, k: 'stone', x: z.x + z.f * 16, y: z.y, z: 24, vx: z.f * 190, life: .95 });   // 射程约 180，和玩家一致
      else if (T.ranged === 'fire') {
        const dx=hero.x-z.x,dy=hero.y-z.y;
        for(const angle of chapter2Run&&z.type==='archer'?[-Math.PI/15,0,Math.PI/15]:[0]){
          eshots.push({k:'fire',enemyVolley:!!chapter2Run,x0:z.x+z.f*16,y0:z.y,tx:z.x+dx*Math.cos(angle)-dy*Math.sin(angle),ty:z.y+dx*Math.sin(angle)+dy*Math.cos(angle),t:0,T:.9});
        }
      }
      else if (Math.abs(dx) < T.reach && Math.abs(hero.y - z.y) < 14 && Math.sign(dx) === z.f) dmgHero(T.dmg, z);   // 上下判定 9→14，和主角攻击范围对齐
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
    if (z.siegeArcher && z.guard) { tx = z.guard.x; ty = z.guard.y; }   // 投石车弓手：站岗不动，远处也射（抛射）
    const ad = Math.abs(dx);
    if (z.cd <= 0 && ad > T.range[0] * .7 && ad < (z.siegeArcher ? 340 : T.range[1] * 1.2) && Math.abs(dy) < (z.siegeArcher ? 120 : T.ranged === 'stone' ? 14 : 60)) { set(z, 'wind'); z.cd = chapter2Run&&z.type==='archer'?4.5:T.cd; return; }
  } else {          // 近战：最多 M.token 个同时贴身，其余在旁边游走
    const tokens = zs.filter(o => o.tok && !o.dead).length;
    if (!z.tok && tokens < (window.XIAOCHANG && XIAOCHANG.tokenCap ? XIAOCHANG.tokenCap() : M.token) && Math.abs(dx) < 130) z.tok = true;
    tx = hero.x - z.f * (z.tok ? T.reach - 6 : 52 + (z.slot % 3) * 14); ty = hero.y + (z.tok ? 0 : (z.slot % 2 ? 16 : -16));
    // 老卒专属：站到中距离就蓄力放剑气（6.5 秒一次）
    if (T.elite && !z.qi && (z.qiCd || 0) <= 0 && Math.abs(dx) < 130 && Math.abs(dy) < 26) {
      set(z, 'wind'); z.qi = 0; z.qiCd = 6.5; sfx('bladeAlert', z.x); return;
    }
    if (z.tok && !(chapter2Run && z.type==='yellow-heavy' && ch2Formation(z) && Math.abs(z.x-ch2Formation(z).x)>18) && Math.abs(dx) < T.reach && Math.abs(dy) < 10) { set(z, 'wind'); if (T.heavy) sfx('bladeAlert', z.x); return; }
  }
  const formation=ch2Formation(z);if(formation){tx=formation.x;ty=formation.y;}
  const mx = tx - z.x, my = ty - z.y, l = Math.hypot(mx, my);
  z.moving = l > 4;
  if (z.moving) {
    const sp = T.spd * (!window.GEAR && z.moveSlowT > 0 ? .85 : 1) * (Math.abs(dx) > 150 ? 1.8 : 1);   // 离得远时快步冲过来
    moveEnt(z, mx / l * sp * dt, my / l * sp * .7 * dt);
    if (z.bx && z.avoidDir == null) moveEnt(z, 0, (z.slot % 2 ? 1 : -1) * T.spd * dt);   // 被草垛等挡住时上下绕开（已在绕行时不再额外推）
  }
}
function updateChapter2Catapult(z, dt) {
  z.flash = Math.max(0, z.flash - dt); const attackDt=dt*(window.GEAR?GEAR.enemyAttack(z):1); z.t += attackDt; z.cd -= attackDt;
  if (z.dead) { z.st = 'wreck'; return; }
  if (z.st === 'wind' && z.t >= .72) {
    // 用户定：投石车集中砸主角一带，但不是同一点——按主角移动方向提前量，各车错开一点
    const lead = 1.15 * rnd(.6, 1.1), off = [[-22, -14], [0, 0], [22, 14], [-12, 16], [14, -16]][(z.catapultIndex || 0) % 5];
    const tx = Math.min(z.x - 70, hero.x + (hero.mvx || 0) * lead + off[0] + rnd(-8, 8));
    const ty = Math.max(M.top + 5, Math.min(M.bot - 5, hero.y + (hero.mvy || 0) * lead + off[1] + rnd(-5, 5)));
    eshots.push({ k: 'catapult', x0: z.x - 18, y0: z.y - 12, tx, ty, t: 0, T: 1.15, short: 3 });
    z.st = 'recoil'; z.t = 0; z.cd = 7; sfx('sling', z.x); return;   // 用户嫌弱：冷却 10→7
  }
  if (z.st === 'recoil' && z.t > .45) { z.st = 'idle'; z.t = 0; return; }
  if (z.st === 'wind') return;
  if (z.cd <= 0) { z.st = 'wind'; z.t = 0; }
}
function chapter2BossSummon(z) {
  if (!z || z.dead || z.summonedHalf) return;
  z.summonedHalf = true;
  const bx = z.x - z.f * 58, mid = (M.top + M.bot) / 2;
  if (z.type === 'zhang_liang') {
    spawn('yellow-heavy', bx, mid - 28);
    spawn('yellow-heavy', bx, mid + 28);
    // 台词由 CH2B 的怒吼统一说
    floaters.push({ x: z.x, y: z.y - 52, t: 0, txt: '给我上！', big: true, gold: true });
  } else if (z.type === 'zhang_bao') {
    spawn('priest', bx, mid - 28);
    spawn('priest', bx, mid + 28);
    // 台词由 CH2B 的黄沙迷阵统一说
    floaters.push({ x: z.x, y: z.y - 52, t: 0, txt: '众弟子，助我！', big: true, gold: true });
  }
}
function updateChapter2Boss(z, dt) {
  z.flash = Math.max(0, z.flash - dt); const attackDt=dt*(window.GEAR?GEAR.enemyAttack(z):1); z.t += attackDt; z.cd -= attackDt;
  z.daze = Math.max(0, (z.daze || 0) - dt);
  if (z.air) { airStep(z, dt); return; }
  if (z.st === 'land') {
    if (z.t > .45) {
      if (z.dead) { z.st = 'gone'; z.t = 0; }
      else { z.st = 'move'; z.t = 0; z.cd = .45; }
    }
    return;
  }
  if (z.dead) return;
  if (z.type === 'zhang_jiao' && window.ZJ && ZJ.duel(z, dt)) return;
  if (window.CH2B && CH2B.update(z, dt)) return;   // 张梁 / 张宝技能
  if (!z.summonedHalf && z.hp < z.T.hp * .5) chapter2BossSummon(z);
  if (window.BOSS_BLOCK && BOSS_BLOCK.update(z, dt, (o, tx, ty, sp, d2) => {
    const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy) || 1;
    moveEnt(o, dx / d * sp * d2, dy / d * sp * .5 * d2);
  }, z.T.spd || 30)) return;
  if (z.stun > 0) { z.stun -= dt; return; }
  if (z.st === 'wind') {
    if (z.t >= z.T.wind) {
      z.st = 'strike'; z.t = 0; sfx('enemySwing', z.x); shake = Math.max(shake, .12);
      if (Math.abs(hero.x - z.x) < z.T.reach + 10 && Math.abs(hero.y - z.y) < 20 && (hero.x - z.x) * z.f > -8) dmgHero(z.T.dmg, z);
    }
    return;
  }
  if (z.st === 'strike') { if (z.t > .25) { z.st = 'rec'; z.t = 0; } return; }
  if (z.st === 'rec') { if (z.t > .65) { z.st = 'move'; z.t = 0; z.cd = .6; } return; }
  const dx = hero.x - z.x, dy = hero.y - z.y;
  z.f = Math.sign(dx) || z.f; z.moving = Math.abs(dx) > z.T.reach - 5 || Math.abs(dy) > 10;
  if (z.moving) {
    const d = Math.hypot(dx, dy) || 1;
    moveEnt(z, dx / d * z.T.spd * dt, dy / d * z.T.spd * .5 * dt);
  } else if (z.cd <= 0) { z.st = 'wind'; z.t = 0; sfx('bladeAlert', z.x); }
}

// ---------- 投射物、火 ----------
function updateShots(dt) {
  for(const fx of enemySkillFx)fx.t+=dt;enemySkillFx=enemySkillFx.filter(fx=>fx.t<fx.T);
  for (const s of shots) {
    if (window.GEAR && !s.gearInitialized) { s.gearInitialized=true; GEAR.projectile(s); }
    s.x += s.vx * dt; s.y += (s.vy || 0) * dt; s.life -= dt;
    if (s.kind === 'arrow' && !s.sky) s.traveled = (s.traveled || 0) + Math.hypot(s.vx, s.vy || 0) * dt;
    // 石子碰到草垛/推车/石碾：扣 1 点耐久，石子消失（打中道具也算打中，可以接连招）
    if (s.life > 0) for (const p of props) {
      if (!canHitProp(p)) continue;
      if (Math.abs(propXAt(p, s.y) - s.x) < p.w / 2 + 3 && propDY(p, s.y) < 8) {
        hero.lastHit = gameT; hero.lastHitC = s.c;
        hitProp(p, Math.sign(s.vx)); s.life = 0; break;
      }
    }
    if (s.life > 0) for (const v of villagers) {
      if (v.state === 'gone' || Math.abs(v.x - s.x) >= 10 || Math.abs(v.y - s.y) >= 10) continue;
      s.villagerHits ||= new Set();
      if (!s.villagerHits.has(v)) { v.flash = .12; s.villagerHits.add(v); }
    }
    const projectileTargets = chapter2Run ? zs.slice().sort((a, b) => s.vx >= 0 ? a.x - b.x : b.x - a.x) : zs;
    for (const z of projectileTargets) if (!z.dead && !s.hitSet.includes(z) && !(s.summon && (z.wjHits || 0) >= 4) && Math.abs(z.x - s.x) < 10 + (z.T.w || 0) && Math.abs(z.y - s.y) < 10 && s.life > 0) {
      const baseDmg = window.GEAR ? GEAR.projectileDamage(s,z) : s.C.dmg;
      let pdmg = s.hitSet.length > 0 ? baseDmg * (s.C.pierce ? (s.C.pierceOff || .4) : .5) : baseDmg;   // 穿透：后续目标按武器系数衰减（石子 40%、箭 30%）
      if (s.kind === 'arrow') pdmg *= bowRangeMult(s.traveled || 0);   // 汉弓远射：按已飞行距离结算
      const traits = window.GEAR ? GEAR.projectileTraits(s) : { secondary: !!s.secondary, scatter: !!s.scatter };
      if (s.C.dazeChance != null) traits.dazeChance = s.C.dazeChance;
      if (s.C.dazeTime != null) traits.dazeTime = s.C.dazeTime;
      if ((z.T.boss || z.T.chapterBoss) && s.C.dazeChance) { traits.dazeChance = s.C.dazeChance * .5; traits.dazeTime = s.C.dazeTime; }
      if (s.summon) { z.wjHits = (z.wjHits || 0) + 1; if (window.ROGUE && ROGUE.stat) ROGUE.stat('万箭齐发', pdmg, 0); }
      const result = hit(z, pdmg, s.C.kb, Math.sign(s.vx), false, s.C.daze || 0, .15, false, true, traits);   // 最后 true = 远程，管亥可能拨开
      if (result === 'blocked') { s.life = 0; s.gearReturn = false; continue; }
      if (s.charged && s.kind !== 'arrow') addChargeHitFx('stone', s.x, s.y - 5);
      else if (s.kind !== 'arrow') stoneHits.push({ x: s.x, y: s.y - 6, t: 0, T: .2 });
      if (!s.secondary) hero.lastHitC = s.c; sfx('hit_stone', s.x); s.hitSet.push(z);
      if (s.gearReturn && !s.spun) { s.spun = true; s.gearReturn = false; gearSpins.push({ x: z.x, y: z.y - 12, t: 0, T: .42, dmg: pdmg * .45, kind: s.kind, dir: Math.sign(s.vx) || 1, done: false }); }   // 回旋（用户定）：打中后绕着中箭处转一小圈，再扫到最多 2 人，每人 45%   // 标记已命中，避免同一颗石子反复打同一个敌人
      if (s.C.noPierce || z.T.blocksPierce || (!s.C.pierce && (!s.gearPierce || s.hitSet.length >= 2))) { s.life = 0; s.gearReturn=false; }
    }
  }
  shots = shots.filter(s => s.life > 0);
  for (const g of gearSpins) {
    g.t += dt;
    if (!g.done && g.t >= g.T * .55) { g.done = true;
      const near = zs.filter(z => !z.dead && !z.air && Math.hypot(z.x - g.x, (z.y - g.y - 12) * 1.6) < 32).sort((a, b) => Math.hypot(a.x - g.x, a.y - g.y) - Math.hypot(b.x - g.x, b.y - g.y)).slice(0, 2);
      for (const z of near) hit(z, g.dmg, 20, Math.sign(z.x - g.x) || g.dir, false, 0, .1, false, true, { secondary: true });
    }
  }
  gearSpins = gearSpins.filter(g => g.t < g.T);
  for (const h of stoneHits) h.t += dt;
  stoneHits = stoneHits.filter(h => h.t < h.T);
  for (const s of eshots) {
    if(s.k==='enemyWave'){const step=Math.min(s.left,Math.abs(s.vx)*dt);s.x+=Math.sign(s.vx)*step;s.left-=step;s.t+=dt;if(Math.abs(hero.x-s.x)<12&&Math.abs(hero.y-s.y)<12&&heroOpen()){dmgHero(1.5,s.source,'skill');s.left=0;}s.life=s.left>0?1:0;continue;}
    if (s.k === 'stone' || s.k === 'arrow') {
      s.x += s.vx * dt; s.life -= dt;
      if (s.life > 0 && Math.abs(hero.x - s.x) < 9 && Math.abs(hero.y - s.y) < 9 && heroOpen()) { sfx(s.k === 'arrow' ? 'hurt' : 'hit_stone', s.x); dmgHero(1, { x: s.x - s.vx, source:s.source }); s.life = 0; }
    } else {
      s.t += dt;
      if (s.t >= s.T) {
        fires.push({ x: s.tx, y: s.ty, t: s.short || 3, r: s.k === 'catapult' ? 32 : 16, seed: rnd(0, 4) }); sfx('fireLand', s.tx); s.life = 0;
        if (s.k === 'catapult') {   // 石块砸地：落点范围内直接伤 2（会击倒），再留火场
          shake = Math.max(shake, .25);
          if (Math.abs(hero.x - s.tx) < 30 && Math.abs(hero.y - s.ty) < 14) dmgHero(2, { x: s.tx, y: s.ty });
          for (let i = 0; i < 10; i++) propFx.push({ x: s.tx + rnd(-8, 8), y: s.ty - 3, vx: rnd(-90, 90), vy: rnd(-140, -50), w: 2.5, h: 2.5, life: .5, max: .5, c: Math.random() < .5 ? '#5a4a3a' : '#a0461e' });
        }
      } else s.life = 1;
    }
  }
  eshots = eshots.filter(s => s.life > 0);
  for (const f of fires) {
    f.t -= dt;
    if (Math.abs(hero.x - f.x) < f.r && Math.abs(hero.y - f.y) < f.r * .45) dmgHero(1, null);

  }
  fires = fires.filter(f => f.t > 0);
  updateCatapults(dt);
}

// ---------- 投石车 ----------
let volleyHits = new Map(), gearSpins = [];   // 霹雳飞石：同一个敌人这一招最多挨 3 块石头（用户定：主动技能清场，不打单体爆发）
function catapultVolley() {
  volleyHits = new Map();
  for (const k in CH.yellow_catapult || {}) { const fr = CH.yellow_catapult[k], e = (LAZY.chapter2 || []).find(x => x[0] === fr.img); if (e && !e[0].src) e[0].src = e[1]; }   // 第一章也用正式投石车图：只单独下载这几帧
  // 霹雳飞石（加强）：投石车直接出现在主角身后，不再慢慢走进来；每台投两轮（共 6 块），砸向敌群
  for (let i = 0; i < 3; i++) {
    // 用户定：投石车在画面最左边一字排开，往右投，投完往左撤出
    const x = cam.x + 24 + (i % 2) * 26, y = M.top + 40 + i * ((M.bot - M.top - 60) / 2);
    catapults.push({ x: x - 50, y, tx: x, t: -i * .15, fired: false, phase: 'in', ft: 0, shots: 2 });
  }
  sfx('land', cam.x + 40); say('投石车来了！', 1.6);
}
function updateCatapults(dt) {
  for (const c of catapults) {
    c.t += dt;
    if (c.t < 0) continue;
    if (c.phase === 'in') {
      c.x += 160 * dt;   // 快速推进场
      if (c.x >= c.tx) { c.x = c.tx; c.phase = 'aim'; c.ft = 0; }
    } else if (c.phase === 'aim') {
      c.ft += dt;
      if (c.ft > .35) {
        c.phase = 'fire'; c.fired = true; c.ft = 0;
        // 优先砸向画面里的敌人（略带随机偏移），没有敌人才砸玩家附近
        const foes = zs.filter(z => !z.dead && !z.air && z.x > cam.x - 20 && z.x < cam.x + viewW() + 20);
        let tx, ty;
        if (foes.length) {   // 砸人多的地方（每台挑一个不同的敌群）
          const ranked = foes.map(z => [z, foes.filter(o => Math.hypot(o.x - z.x, (o.y - z.y) * 2) < 45).length + Math.random() * .5]).sort((a, b) => b[1] - a[1]);
          const tgt = ranked[(catapults.indexOf(c) + (c.shots === 1 ? 1 : 0)) % ranked.length][0];
          tx = tgt.x + rnd(-6, 6); ty = tgt.y + rnd(-4, 4);
        } else {
          tx = hero.x + rnd(-90, 90); ty = rnd(M.top + 10, M.bot - 6);
        }
        tx = Math.max(cam.x + 40, Math.min(cam.x + viewW() - 30, tx));
        ty = Math.max(M.top + 8, Math.min(M.bot - 4, ty));
        allyShots.push({ sx: c.x, sy: c.y - 26, x: c.x, y: c.y - 26, tx, ty, t: 0, T: .75, rogue: true });
        sfx('sling', c.x);
      }
    } else if (c.phase === 'fire') {
      c.ft += dt;
      if (c.ft > .3) { c.shots = (c.shots || 1) - 1; if (c.shots > 0) { c.phase = 'aim'; c.ft = -.5; } else c.phase = 'out'; }
    } else if (c.phase === 'out') {
      c.x -= 70 * dt;
    }
  }
  catapults = catapults.filter(c => !(c.phase === 'out' && c.x < cam.x - 90));
  for (const s of allyShots) {
    s.t += dt;
    const k = Math.min(1, s.t / s.T);
    s.x = s.sx + (s.tx - s.sx) * k;
    s.y = s.sy + (s.ty - s.sy) * k - Math.sin(k * Math.PI) * 120;
    if (k >= 1) {
      s.done = true;
      shake = Math.max(shake, .18);
      sfx('land', s.tx);
      for (const z of zs) {
        if (z.dead || z.air) continue;
        if (Math.abs(z.x - s.tx) < 40 && Math.abs(z.y - s.ty) < 24 && (!s.rogue || (volleyHits.get(z) || 0) < 3) && (!s.rogue || volleyHits.set(z, (volleyHits.get(z) || 0) + 1))) (window.ROGUE && ROGUE.stat && ROGUE.stat('霹雳飞石', 1.5, 0)), hit(z, 1.5, 40, Math.sign(z.x - s.tx) || 1, false, .3, .4, true, true, { scaled: true, siegeShot: true });
      }
      if (!allyFires.some(f => f.cat && Math.hypot(f.x - s.tx, (f.y - s.ty) * 2) < 18)) allyFires.push({ x: s.tx, y: s.ty, t: R_('catapultFire', 4), r: 26, tick: 0, dmg: .2, cat: true });   // 火场不叠在同一处   // 霹雳飞石火场：3 秒、每 0.5 秒 0.2
      for (let i = 0; i < 10; i++) propFx.push({ x: s.tx + rnd(-16, 16), y: s.ty + rnd(-8, 4), vx: rnd(-60, 60), vy: rnd(-110, -30), w: rnd(2, 4), h: rnd(2, 4), life: rnd(.3, .6), max: .6, c: '#ff9a2e' });
    }
  }
  allyShots = allyShots.filter(s => !s.done);
  for (const f of allyFires) {
    f.t -= dt; f.tick -= dt;
    if (f.tick <= 0) {
      f.tick = .5;
      for (const z of zs) {
        if (z.dead || z.air) continue;
        if (Math.abs(z.x - f.x) < f.r && Math.abs(z.y - f.y) < f.r * .45) {
          if (f.once) { if (f.once.has(z)) continue; f.once.add(z); }   // 燎步：每个敌人只烫一次
          hit(z, f.dmg || .3, 0, 0, false, 0, 0, false, true, { dot: true });
        }
      }
    }
  }
  allyFires = allyFires.filter(f => f.t > 0);
}
function drawCatapults() {
  for (const c of catapults) {
    if (c.t < 0) continue;
    const fr = c.phase === 'fire' ? 'fire' : c.phase === 'aim' ? 'load' : 'idle';
    const f = CH.yellow_catapult && (CH.yellow_catapult[fr] || CH.yellow_catapult.idle);
    if (f && f.img && f.img.complete && f.img.naturalWidth) {
      const sc = .62, w = f.w * sc, h = f.h * sc;
      ctx.save(); ctx.translate(Math.round(c.x), 0); ctx.scale(-1, 1); ctx.drawImage(f.img, Math.round(-w / 2), Math.round(c.y + 4 - h), w, h); ctx.restore();   // 原图朝左（敌方用），我方投石车往右投，镜像
    } else {   // 第一章没加载投石车图（只在第二章按需下载）：用代码画一台简易投石车
      ctx.save(); ctx.translate(c.x, c.y); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 1, 18, 4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#6b4424'; ctx.fillRect(-16, -8, 32, 6); ctx.fillStyle = '#3a2412'; ctx.beginPath(); ctx.arc(-11, -1, 4, 0, 7); ctx.arc(11, -1, 4, 0, 7); ctx.fill();
      ctx.fillStyle = '#7a5030'; ctx.fillRect(-3, -22, 6, 15);
      const ang = c.phase === 'fire' ? -1.1 : -.25; ctx.save(); ctx.translate(0, -20); ctx.rotate(ang); ctx.fillStyle = '#8a5a32'; ctx.fillRect(-20, -2, 26, 4); ctx.fillStyle = '#4a3020'; ctx.fillRect(-22, -4, 5, 8); ctx.restore(); ctx.restore();
    }
  }
  for (const s of allyShots) {
    ctx.fillStyle = '#6b6b6b';
    ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,150,40,.9)';
    ctx.beginPath(); ctx.arc(s.x, s.y, 2.4, 0, 7); ctx.fill();
  }
}

// 投石车火场：复用弓箭手地面火苗的 4 帧，整体调成偏朱红，和黄橙色的火箭火区分开。
const allyFireTint = [];
function allyFireFrame(k) {
  if (allyFireTint[k]) return allyFireTint[k];
  const im = IMG['ui_fire' + k];   // 打包时 UI 图统一加 ui_ 前缀
  if (!im || !im.complete || !im.naturalWidth) return null;
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  let px; try { px = g.getImageData(0, 0, c.width, c.height); } catch (e) { allyFireTint[k] = im; return im; }   // 跨域读不了像素：直接用原图
  const d = px.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const lum = d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114;
    d[i] = Math.min(255, d[i] * .92 + 16);                 // 红
    d[i + 1] = Math.min(255, d[i + 1] * .42 + lum * .08);  // 压掉黄绿
    d[i + 2] = Math.min(255, d[i + 2] * .58 + lum * .12);  // 蓝略抬，偏朱红
  }
  g.putImageData(px, 0, 0);
  allyFireTint[k] = c;
  return c;
}
function drawAllyFire() {
  const now = performance.now() / 90;
  for (const f of allyFires) {
    f.t0 ??= f.t;   // 用户反馈「火烧连营有延迟」：原来按 4 秒火场写死，5 秒的火前 1 秒是透明的 → 改按各自时长淡入淡出
    const fade = Math.min(1, f.t / .6);
    const a = Math.min(1, (f.t0 - f.t) / .15) * fade;
    if (a <= 0) continue;
    // 地面被烤红的一圈（和伤害范围一致）
    const gd = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, f.r);
    gd.addColorStop(0, 'rgba(255,120,70,' + (.26 * a) + ')');
    gd.addColorStop(1, 'rgba(210,40,20,0)');
    ctx.fillStyle = gd;
    ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * .45, 0, 0, 7); ctx.fill();
    // 三簇火苗，错开相位和高度
    const seeds = (f.scale || 1) < .6 ? [[0, 1, .4]] : [[-.52, .92, 0], [0, 1.22, .4], [.52, .98, .75]];   // 小火（燎步）只画一簇
    for (let i = 0; i < seeds.length; i++) {
      const [ox, sc, ph] = seeds[i];
      const im = allyFireFrame(Math.floor(now + ph * 4) % 4);
      if (!im) continue;
      const FH = 32 * sc * (f.scale || 1), FW = FH * im.width / im.height;
      ctx.globalAlpha = a * (.86 + .14 * Math.sin(now * .6 + i));
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(im, Math.round(f.x + ox * f.r - FW / 2), Math.round(f.y - FH + 6 * (f.scale || 1)), FW, FH);
      ctx.globalAlpha = 1;
    }
  }
}

let gameT = 0;
let arenaL = null;
let boardSent = false;   // 本局成绩是否已提交到英雄榜
let runBonus = 0;        // 满血吃补血道具等额外积分
// 投石车（锦囊·主动）：从左边进场、各投一块燃烧石，然后退出
let catapults = [];      // { x, y, tx, t, fired, phase }
let allyShots = [];      // 投出的石头
let allyFires = [];      // 燃烧地面（只伤敌人）   // Boss 战左边界（场地宽 1.2 屏），其它时候为 null
// HIT 连击：1.2 秒内连续命中就累加，只做视觉反馈、不影响伤害
let comboCount = 0, comboExpireAt = 0, comboNotices = [];
function countComboHit() {
  comboCount = gameT < comboExpireAt ? comboCount + 1 : 1;
  comboExpireAt = gameT + 1.2;
  comboNotices.push({ count: comboCount, born: gameT });
  if (comboNotices.length > 2) comboNotices.shift();   // 最多同时两条
}
function update(dt) {
  if (window.PAUSE && PAUSE.paused()) { PAUSE.update(dt); return; }
  if (window.CHAPTER2_INTRO && CHAPTER2_INTRO.active()) { CHAPTER2_INTRO.update(dt); return; }
  if (chargeTierFlash > 0) chargeTierFlash = Math.max(0, chargeTierFlash - dt);
  if (slowT > 0) { slowT -= dt; dt *= .35; }      // 完美闪避的慢动作
  if (critT > 0) critT -= dt;
  if (pdCd > 0) pdCd -= dt;
  if (window.ROOM && ROOM.blocks()) { ROOM.update(dt); return; }   // 开场农房：游戏不推进，由 room.js 自己走
  if (window.XIAOCHANG && XIAOCHANG.blocks()) return;
  if (window.TITLE && TITLE.blocks()) return;   // 标题界面/转场：游戏不推进
  if (window.ROGUE && ROGUE.blocks()) { ROGUE.update(dt); return; }   // 选锦囊时冻结战斗
  if (window.ROGUE && ROGUE.tick && !over && !won) ROGUE.tick(dt);
  if (window.ARTIFACT && !over && !won) ARTIFACT.tick(dt);
  if (window.SUPPLY && !over && !won) SUPPLY.tick(dt);
  if (window.MERIDIAN && !over && !won) MERIDIAN.tick();   // 经脉·回气
  if (volleyAgainAt && gameT >= volleyAgainAt) { volleyAgainAt = 0; summonArchersVolley(true); }
  gameT += dt;
  if (window.GEAR && !over && !won) GEAR.tick(dt);
  if (!over && !won) runT += dt;   // 计时：通关/倒下后停表；切后台 rAF 不走，也不会多算
  if (freeze > 0) { freeze -= dt; return; }
  // 结算板出来后冻结战斗（主角和敌人不动），但火、碎屑这些特效继续演
  const done = result && gameT >= result.born;
  if (!done) {
    if (!chapter2Run || chapter2Run.mode !== 'choice') heroUpdate(dt);
    // 第二章没有右侧闸门：后退边界跟着战斗推进往前走，永远只留 1.2 屏回头路
    if (chapter2Run && arenaL != null && chapter2Run.mode === 'fight') arenaL = Math.max(arenaL, hero.x - viewW() * RETREAT_SCREENS);
    if (!over) { waves(dt); if (window.ZJ) ZJ.update(dt); if (window.CH2OPEN) CH2OPEN.update(dt); if (window.BOWAMMO) BOWAMMO.tick(dt); zs.forEach(z => { const d = window.ROGUE && ROGUE.decoyFor ? ROGUE.decoyFor(z) : null; if (!d) { zUpdate(z, dt); return; } const real = hero; hero = d; try { zUpdate(z, dt); } finally { hero = real; } }); separateEnemies(dt); }   // 草木皆兵：被吸引的敌人把稻草人当成主角
    else zs.forEach(z => { if (z.dead) zUpdate(z, dt); else if (z.celebrating) z.celebrateT += dt; });
    if (window.GEAR && !over && !won) GEAR.tick(0);
    for (const z of zs) if (z.dead && !z.air && !z.T.boss && z.st !== 'land' && z.st !== 'gone') { z.st = 'land'; z.t = 0; }   // 不会被击飞的（首领、力士）死了也要倒地后消失
    zs = zs.filter(z => !(z.st === 'gone' && z.t > .9));
  }
  const bz = zs.find(z => z.T && z.T.boss);
  if (bz && !bz.dead && bz.phase === 2 && !archerAddsDone && bz.st !== 'roar' && bz.st !== 'fall') {
    archerAddsDone = true; summonArchers(bz);
  }
  updateShots(dt); if (window.GEAR && !over) GEAR.tick(0); Boss.updateFx(dt); updatePropFx(dt); updateDrops(dt); updateFx(dt); updateHalberdBleed(dt); updateVillagers(dt);
  if (window.XIAOCHANG && XIAOCHANG.active()) XIAOCHANG.clampActors();
  const vw = viewW();
  let tx = hero.x - vw * .4;
  if (lockR < Infinity) tx = Math.min(tx, lockR - vw);
  if (arenaL != null) tx = Math.max(tx, arenaL);   // 用户定：左边走不过去的地方，镜头也不往那边移，免得以为还能走
  if (chapter2Run && chapter2Run.battle === 6 && !(window.XIAOCHANG && XIAOCHANG.active())) tx = (M.W - vw) / 2;   // 祭台战：镜头固定在正中
  cam.x += (Math.max(0, Math.min(M.W - vw, tx)) - cam.x) * Math.min(1, dt * 6);
  shake = Math.max(0, shake - dt); msgT -= dt;
  if (msgT <= 0 && tutorialQueue.length) { const tip = tutorialQueue.shift(); say(tip.text, tip.time); }
  if (toastT > 0) toastT -= dt;
  // 失败时等主角落地、敌人庆祝一会儿后再显示结算。
  const deathResultReady = over && deathLandedAt != null && gameT >= deathLandedAt + 1.5;
  if (!(window.XIAOCHANG && XIAOCHANG.active()) && !result && (won || deathResultReady)) {
    if (won && window.GEAR) GEAR.collectDrops();
    endT = runT;
    stampPlayed = false; pressAct = null;
    const zoneNow = won ? 6 : Math.max(1, Math.min(6, gateI + 1));
    result = { win: won, kills, time: endT, hit: hitsTaken, zone: zoneNow,
      coins: window.WALLET ? WALLET.runCoins() : 0,
      // 困难 ×1，简单 ×0.8（= 困难 ÷1.25）；时间取整后再算，和服务端一分不差
      score: Math.round((scoreOfRun(kills, Math.round(endT), won ? 6 : Math.max(0, zoneNow - 1), won, hitsTaken) + runBonus) * (hardMode() ? 1 : .8) * (revives >= 2 ? .5 : 1)),   // 第 3 条命起评分减半
      rank: won ? rankOf(endT) : '', sel: won ? 'restart' : 'revive', born: gameT + (won ? 1.2 : .45),
      needRevive: !won,   // 死了就能分享复活（无限次；第 2 次复活起评分减半）
      line: won ? (chapter2Run ? '黄巾决战告捷，战利品已收入整备仓库。' : '获得管亥的长戟，可在整备界面选择装备。') : deathLine(), s1: 0, s2: 0 };
    if (window.WALLET) WALLET.flush();
    const debugRun = /[?&]debug(?:=|&|$)/.test(location.search);   // 开发者模式：不记录成绩
    if (window.ARMORY) ARMORY.markPlayed();
    if (won && !debugRun && window.TITLE && TITLE.markCleared) TITLE.markCleared(chapter2Run ? 2 : 1);
    if (won && chapter2Run && window.ARTIFACT && ARTIFACT.grant('feijian')) result.line = '张角遗下「太平飞剑」！已收入神器栏。';   // 第二章通关奖励（首次）   // 第二章通关记第二章，不再误记成第一章
    if (won && !debugRun && !noviceMode() && window.MERIDIAN && MERIDIAN.award(chapter2Run ? 'ch2' : 'ch1')) result.line += ' 困难首通，获得通脉丹 ×1（经脉）。';
    if (!boardSent && !debugRun && !chapter2Run) {   // 英雄榜目前只统计第一章；第二章成绩另行设计   // 通关或者阵亡都上报（失败不影响游戏）
      boardSent = true;
      if (window.BOARD) {
        const nm = (window.TITLE && TITLE.playerName && TITLE.playerName()) || '';
        BOARD.submit({ name: nm, kills, t: Math.round(endT), zone: zoneNow, win: !!won, hits: hitsTaken, bonus: runBonus, diff: hardMode() ? 'hard' : 'easy', revives });
      }
    }
    uiBtns = [];
    if (!won) { toastMsg = revives >= 1 ? '分享给好友可以继续（第 3 条命起评分减半）' : '倒下了：分享给好友可免费复活'; toastT = 6; }
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
let _saEl = null, _saT = 0, _sa = { l: 0, r: 0 };
function safeArea() {   // 读 CSS 的 env(safe-area-inset-*)，每秒更新一次（转屏后会变）
  const now = performance.now(); if (now - _saT < 1000) return _sa; _saT = now;
  try {
    if (!_saEl) { _saEl = document.createElement('div'); _saEl.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)'; document.body.append(_saEl); }
    const cs = getComputedStyle(_saEl); _sa = { l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0 };
  } catch (e) {}
  return _sa;
}
function drawChar(name, f, x, y, flip, alpha = 1, white = false, sc = 1, dark = false) {
  const fr = CH[name] && CH[name][f]; if (!fr) return; if (!fr.img.src) { promoteLoad(fr.img); return; } if (!fr.img.complete) return;
  const sp = Math.max(.5, SC * PX) * sc;
  const sx = Math.round(x * SC + OXs), sy = Math.round(y * SC);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, sx, sy); if (flip) ctx.scale(-1, 1);
  ctx.globalAlpha = alpha;
  const im = white && fr.white ? fr.white : (dark && fr.dark ? fr.dark : fr.img);
  if (dark && !fr.dark) {
    try { if ('filter' in ctx) ctx.filter = 'brightness(.78) saturate(.82)'; } catch (e) {}
  }
  ctx.drawImage(im, -fr.ax * sp, -fr.ay * sp, fr.w * sp, fr.h * sp);
  ctx.restore();
}
function heroFrame(h) {
  const frameWeapon = weapon === 'halberd' ? 'halberd' : weapon;
  if (h.st === 'atk') { const C = h.atk && WEAP[weapon].combo[h.atk.c]; if (C && C.f[h.atk.fi]) return C.f[h.atk.fi]; }   // 出招数据对不上（如中途换武器）时不再报错
  if (h.st === 'roll') return Math.floor(h.t * 15) % 2 ? 'roll2' : 'roll1';
  if (h.air) return h.vz > 0 ? 'fly1' : 'fly2';
  if (h.st === 'bounce' || h.st === 'getup') return h.st;
  if (h.st === 'walk') {
    const walk = frameWeapon === 'halberd' ? [1, 2, 3, 4, 5, 2] : [1, 2, 3, 2];
    return frameWeapon + 'w' + walk[Math.floor(h.t * 8) % walk.length];
  }
  if (h.st === 'hurt') return 'hurt';
  if (h.st === 'down') return 'down';
  return frameWeapon + '0';
}
function zFrame(z) {
  if (z.T.siege) {
    if (z.dead) return 'wreck';
    if (z.st === 'wind') return 'load';
    if (z.st === 'recoil') return z.t < .18 ? 'fire' : 'recoil';
    return 'idle';
  }
  if (z.air) return z.vz > 0 ? 'fly1' : 'fly2';
  if (z.cbFrame && !z.dead) return z.cbFrame;   // 第二章首领技能帧
  if (z.zjDizzy > 0) return 'dizzy';
  if (z.type === 'zhang_jiao' && z.stun > 0) return 'hurt';
  if (z.type === 'zhang_jiao' && z.throwT > 0) return 'throw';
  if (z.type === 'zhang_jiao' && z.push && !z.push.go) return 'push';
  if (z.type === 'zhang_jiao' && z.castT > 0) return 'thunder';
  if (z.type === 'yellow-golem' && z.grab) return 'grab';
  if (z.type === 'yellow-golem' && z.hurlT > 0) return 'hurl';
  if (z.type === 'yellow-golem' && z.pantT > 0 && !z.dead) return 'pant';
  if (z.st === 'tele') return 'teleport';
  if (result && (z.st === 'land' || z.st === 'getup')) return 'down';   // 结算卷轴出现后不再画起身帧
  if (z.st === 'land') return !z.dead && z.t > .25 && CH[z.sprite || z.type]?.getup ? 'getup' : 'land';
  if (z.dead) return 'down';
  if (z.st === 'sleep') return 'down';
  if (z.st === 'wake') return 'idle';
  if (z.stun > 0 || z.daze > 0) return 'hurt';
  if (z.st === 'wind') return 'wind';
  if (z.st === 'chant') return 'chant';
  if (z.st === 'addwalk' || z.st === 'addleave') return Math.floor(z.t * 6) % 2 ? 'walk1' : 'walk2';
  if (z.st === 'addaim') return 'wind';
  if (z.st === 'addvolley') return z.t < .34 ? 'strike' : 'idle';
  if (z.st === 'strike') return 'strike';
  if (z.st === 'rec') return z.T.ranged ? 'idle' : 'strike';
  if (z.type === 'zhang_jiao') return z.st === 'rest' ? 'rest' : 'float';   // 张角飘着走，不走路
  return z.moving ? (Math.floor(z.t * 6) % 2 ? 'walk1' : 'walk2') : 'idle';
}
function draw() {
  if (window.PAUSE) PAUSE.syncButton();
  if (window.TITLE && TITLE.draw()) return;   // 标题界面自己接管整屏
  if (window.ROOM && ROOM.draw()) return;     // 开场农房
  const W = cv.width, H = cv.height; SC = H / M.viewH;
  const sk = shake > 0 ? rnd(-2, 2) : 0;
  OXs = Math.round(-cam.x * SC + sk);
  ctx.setTransform(SC, 0, 0, SC, OXs, 0); ctx.imageSmoothingEnabled = true;
  const vw = viewW(), ms = .24 / .61, my = 165 - 619 * .24;
  if (window.XIAOCHANG && XIAOCHANG.active()) {
    XIAOCHANG.drawBackground();
  } else if (chapter2Run) {
    const bossMap = chapter2Run.battle === 6;
    if (bossMap) {
      const sky = IMG.chapter2_altar_far, near = IMG.chapter2_altar;
      ctx.imageSmoothingEnabled = true;
      if (sky && sky.width) { const s = ALTAR_W / sky.width; tileLayer(sky, s, 1, 110 - sky.height * s * .88); }   // 雷云的地平线对齐前景的天际线
      if (near && near.width) tileLayer(near, 300 / near.height, 1, 0);
      ctx.imageSmoothingEnabled = false;
    } else {
      ctx.imageSmoothingEnabled = true;
      const sky = IMG.chapter2_far, field = IMG.chapter2_battlefield;
      if (sky) tileLayer(sky, M.viewH / sky.height, .18, 0);
      if (field) tileLayer(field, M.viewH / field.height, 1, 0);
      ctx.imageSmoothingEnabled = false;
    }
  } else {
    tileLayer(IMG.far, .577, .3, 0);
    tileLayer(IMG.gnd, .62, 1, my + 560 * ms);
    tileLayer(IMG.mid, ms, 1, my);
  }
  ctx.imageSmoothingEnabled = false;
  // Boss 关：右上角插一面「苍天已死」血字旗（装饰，人物从旗前走过）
  if (!(window.XIAOCHANG && XIAOCHANG.active()) && zs.some(z => z.T && z.T.boss)) {
    const im = IMG['p_flag_cang'];
    if (im && im.complete) {
      const fh2 = 100, fw2 = fh2 * im.width / im.height;   // 高度和原旗子一样，宽度按新旗图比例，避免压扁
      const fx2 = 3211, fy2 = 189;   // 候选③：右侧上方背景（世界坐标，固定不随镜头）
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(im, Math.round(fx2 - fw2 / 2), Math.round(fy2 - fh2), fw2, fh2);
      ctx.imageSmoothingEnabled = false;
    }
  }
  // 完美闪避的残影
  for (const gh of ghosts) {
    const ch2 = CH['hero'] && CH['hero'].idle;
    if (!ch2) break;
    ctx.globalAlpha = Math.max(0, gh.a * (1 - gh.t / .45));
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(ch2.img, Math.round(gh.x - ch2.ax * PX), Math.round(gh.y - ch2.ay * PX), ch2.w * PX, ch2.h * PX);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  // 蓄力：主角身上渐亮的光
  const chargeBtn = document.getElementById('bA'), chargeP = chargeRatio();
  updateChargeTier();
  const chargeColor = chargeTier === 3 ? '#ff9a3d' : chargeTier === 2 ? '#ffd84a' : '#ffffff';
  chargeBtn.style.setProperty('--charge-color', chargeColor);
  chargeBtn.classList.toggle('charging', !!atkHeldSince && charging);
  chargeBtn.classList.toggle('charged', !!atkHeldSince && charging && chargeP >= 1);
  chargeBtn.style.setProperty('--charge-angle', (360 * chargeP) + 'deg');
  // 蓄力的角色光效统一由 drawChargeAura 负责（白色气焰），不再叠一层圆形光晕
  drawChargeHitFx();
  // 蓄力重击的冲击环
  for (const q of chargeFx) {
    if (q.w === 'staff') {
      if (q.t >= .3) continue;
      const img = IMG.ui_staff_sweep;
      if (!img || !img.complete) continue;
      const frame = Math.min(3, Math.floor(q.t / .075));
      ctx.save();
      ctx.globalAlpha = 1 - q.t / .3;
      ctx.translate(q.x + q.f * 30, q.y - 14);
      if (q.f < 0) ctx.scale(-1, 1);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, frame * 96, 0, 96, 72, -35, -27.5, 70, 55);
      ctx.restore();
      continue;
    }
    const k = Math.min(1, q.t / q.T), R2 = 20 + 90 * k, a2 = 1 - k;
    ctx.save(); ctx.translate(q.x, q.y - 12); ctx.scale(q.f, 1);
    ctx.strokeStyle = q.w === 'hammer' ? 'rgba(255,190,90,' + (.9 * a2) + ')' : 'rgba(240,250,255,' + (.9 * a2) + ')';
    ctx.lineWidth = 4 * (1 - k) + 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, R2, R2 * .42, 0, 0, 7);
    ctx.stroke();
    ctx.restore();
  }
  // 方士：念咒光圈 + 头顶符文；施法成功时扫一圈黄光
  for (const o of zs) {
    if (o.dead || o.st !== 'chant') continue;
    const pulse = .5 + .5 * Math.sin(performance.now() / 160);
    if (o.castKind === 'fire') {   // 火球咒：手前聚一团暗红火光，脚下小红圈，和回血的大黄圈分开（敌方特效保持低调）
      ctx.save();
      const p = Math.min(1, o.t / 1), fx = o.x + (o.f || 1) * 10, fy = o.y - 22;
      ctx.strokeStyle = 'rgba(200,70,40,' + (.3 + .2 * pulse) + ')'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(o.x, o.y, 18, 7, 0, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(220,90,40,' + (.35 + .25 * p) + ')';
      ctx.beginPath(); ctx.arc(fx, fy, 2 + 4 * p + pulse, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,180,90,' + (.4 * p) + ')';
      ctx.beginPath(); ctx.arc(fx, fy, 1 + 2 * p, 0, 7); ctx.fill();
      for (let k = 0; k < 3; k++) { const a = performance.now() / 200 + k * 2.1; ctx.fillStyle = 'rgba(200,80,40,.6)'; ctx.fillRect(Math.round(fx + Math.cos(a) * (9 - 5 * p)), Math.round(fy + Math.sin(a) * (6 - 3 * p)), 2, 2); }
      ctx.restore(); continue;
    }
    ctx.save();
    ctx.strokeStyle = 'rgba(255,216,74,' + (.35 + .2 * pulse) + ')'; ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(255,216,74,' + (.06 + .05 * pulse) + ')';
    ctx.beginPath(); ctx.ellipse(o.x, o.y, 120, 48, 0, 0, 7); ctx.fill(); ctx.stroke();
    const t = performance.now() / 420;
    for (let k = 0; k < 4; k++) {
      const a = t + k * 1.57, rx = Math.cos(a) * 10, ry = Math.sin(a) * 4;
      ctx.fillStyle = '#ffd84a';
      ctx.fillRect(Math.round(o.x + rx - 2), Math.round(o.y - 46 + ry - 2), 4, 6);
      ctx.fillStyle = '#b3372a';
      ctx.fillRect(Math.round(o.x + rx - 1), Math.round(o.y - 45 + ry - 1), 1, 4);
    }
    ctx.restore();
  }
  for (const q of blessFx) {
    const k = Math.min(1, q.t / q.T);
    ctx.save(); ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = 'rgba(255,216,74,.9)'; ctx.lineWidth = 3 * (1 - k) + 1;
    ctx.beginPath(); ctx.ellipse(q.x, q.y, 40 + 80 * k, 16 + 32 * k, 0, 0, 7); ctx.stroke();
    ctx.restore();
  }
  // 被加持的敌人脚下有一圈淡黄光
  for (const o of zs) {
    if (o.dead || !(o.blessT > 0)) continue;
    ctx.save(); ctx.globalAlpha = Math.min(1, o.blessT / 1.2) * .35;
    ctx.fillStyle = '#ffd84a';
    ctx.beginPath(); ctx.ellipse(o.x, o.y - 1, 14, 5, 0, 0, 7); ctx.fill();
    ctx.restore();
  }
  // 老卒的白色扇形剑气
  for (const q of qiFx) {
    const k = Math.min(1, q.t / q.T), R = 16 + 32 * k, a = 1 - k;
    const lw = 9 * (1 - k) + 1;
    ctx.save(); ctx.translate(q.x, q.y - 14); ctx.scale(q.f, 1);
    for (const offset of [-.25, .25]) {
      ctx.beginPath(); ctx.arc(0, 0, R, -.75 + offset, .75 + offset);
      ctx.strokeStyle = 'rgba(240,248,255,' + (.28 * a) + ')';
      ctx.lineWidth = Math.max(1, lw * .45); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(0, 0, R, -.75, .75);
    ctx.strokeStyle = 'rgba(210,235,255,' + (.75 * a) + ')';
    ctx.lineWidth = lw + 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, R, -.75, .75);
    ctx.strokeStyle = 'rgba(255,255,255,' + a + ')';
    ctx.lineWidth = lw; ctx.stroke();
    if (q.t < .12) {
      const impact = 10 * (q.t / .12);
      ctx.beginPath(); ctx.arc(q.f * 8, 0, impact, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,' + (1 - q.t / .12) + ')';
      ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.restore();
  }
  // 火
  for (const f of fires) {
    const a = Math.min(1, f.t);
    // 地面被烤红的一圈（让伤害范围看得见）
    ctx.fillStyle = 'rgba(255,110,30,' + (.20 * a) + ')';
    ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * 1.05, f.r * .42, 0, 0, 7); ctx.fill();
    // 4 帧火焰精灵，每帧 90ms
    const k = Math.floor(performance.now() / 90 + (f.seed || 0)) % 4;
    const im = IMG['ui_fire' + k];   // 打包时 UI 图统一加 ui_ 前缀
    if (im && im.complete) {
      const FH = 30, FW = FH * im.width / im.height;
      ctx.globalAlpha = a;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(im, Math.round(f.x - FW / 2), Math.round(f.y - FH + 5), FW, FH);
      ctx.globalAlpha = 1;
    }
  }
  drawAllyFire();   // 投石车留下的火场（和弓箭手的火共用帧，颜色偏朱红）
  // 火箭落点预警
  for (const s of eshots) if (s.k === 'arrow') {
    const d = Math.sign(s.vx) || 1;
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(s.x - d * 12, s.y - 4); ctx.lineTo(s.x, s.y - 4); ctx.stroke();
    ctx.strokeStyle = '#d8d0c0'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(s.x - d * 12, s.y - 4); ctx.lineTo(s.x, s.y - 4); ctx.stroke();
    ctx.fillStyle = '#e8e0d0';
    ctx.beginPath(); ctx.moveTo(s.x + d * 3, s.y - 4); ctx.lineTo(s.x - d * 2, s.y - 7); ctx.lineTo(s.x - d * 2, s.y - 1); ctx.closePath(); ctx.fill();
  }
  for (const s of eshots) if (s.k === 'fire' || s.k === 'catapult') {
    const p = s.t / s.T, radius = s.k === 'catapult' ? 32 : 16;
    ctx.strokeStyle = `rgba(230,40,30,${.4 + .5 * p})`; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(s.tx, s.ty, radius * (1.3 - p * .3), radius * .38 * (1.3 - p * .3), 0, 0, 7); ctx.stroke();
  }
  Boss.drawGround();
  for (const p of props) if (p.back) drawProp(p);   // 旗帜画在人物后面
  if (window.ZJ && chapter2Run && chapter2Run.battle === 6) ZJ.draw();
  if (window.CH2B && chapter2Run) CH2B.draw();
  if (window.ROGUE && ROGUE.drawWorld) ROGUE.drawWorld();
  if (window.ARTIFACT) ARTIFACT.drawWorld();
  if (window.SUPPLY) SUPPLY.drawWorld();
  if (window.BOWAMMO) BOWAMMO.draw();
  // 按 y 排序绘制
  const list = [];
  list.push({ y: hero.y - .2, d: Boss.drawHorse });
  for (const p of props) if (!p.back) {
    list.push({ y: p.y, d: () => drawProp(p) });
  }
  if (catapults.length || allyShots.length || allyFires.length) list.push({ y: M.bot - 1, d: () => drawCatapults() });
  for (const d of drops) list.push({ y: d.y, d: () => drawDrop(d) });
  for (const v of villagers) list.push({ y: v.y, d: () => drawVillager(v) });
  for (const z of zs) list.push({ y: z.y, d: () => { if (window.XIAOCHANG) XIAOCHANG.drawAffix(z); drawZ(z); } });
  list.push({ y: hero.y, d: drawHero });
  for (const s of shots) list.push({ y: s.y + .1, d: () => drawShot(s) });
  for (const g of gearSpins) list.push({ y: g.y + 12.2, d: () => {   // 回旋：绕一圈的淡青光箭/石子 + 拖尾
    const u = g.t / g.T, a0 = -Math.PI / 2, R = 14;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 7; k++) { const uu = Math.max(0, u - k * .045), a = a0 + uu * Math.PI * 2 * g.dir; ctx.fillStyle = `rgba(140,230,255,${.5 * (1 - k / 7) * (1 - u * .5)})`; ctx.beginPath(); ctx.arc(g.x + Math.cos(a) * R, g.y + Math.sin(a) * R * .55, 2.4 - k * .25, 0, 7); ctx.fill(); }
    ctx.restore();
    const a = a0 + u * Math.PI * 2 * g.dir, x = g.x + Math.cos(a) * R, y = g.y + Math.sin(a) * R * .55;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2 * g.dir);
    if (g.kind === 'arrow') { ctx.strokeStyle = '#e8f8ff'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(5, 0); ctx.stroke(); ctx.fillStyle = '#bff0ff'; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(4, -2); ctx.lineTo(4, 2); ctx.fill(); }
    else { ctx.fillStyle = '#cfe6f0'; ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, 7); ctx.fill(); }
    ctx.restore();
  } });
  for (const h of stoneHits) list.push({ y: h.y, d: () => drawStoneHit(h) });
  for (const h of bluntHits) list.push({ y: h.y, d: () => drawBluntHit(h) });
  for (const f of bleedFx) list.push({ y: f.y, d: () => drawBleedFx(f) });
  for (const f of hammerFx) list.push({ y: f.y, d: () => drawHammerFx(f) });
  for (const f of bladeFx) list.push({ y: f.y, d: () => drawBladeFx(f) });
  for (const f of bowFx) list.push({ y: f.y, d: () => drawBowFx(f) });
  for(const fx of enemySkillFx)list.push({y:fx.y+15,d:()=>drawEnemySheet('enemy_slash',fx.x,fx.y,fx.f,40,fx.t,fx.T)});
  for (const s of eshots) {
    if(s.k==='enemyWave'){list.push({y:s.y,d:()=>drawEnemySheet('enemy_wave',s.x,s.y-15,Math.sign(s.vx),20,s.t%.3,.3)});continue;}
    if (s.k === 'stone') list.push({ y: s.y + .1, d: () => { shadow(s.x, s.y, 3); stone(s.x, s.y - s.z); } });
    else {
      const p = Math.min(1, s.t / s.T), x = s.x0 + (s.tx - s.x0) * p, gy = s.y0 + (s.ty - s.y0) * p, z = 24 + Math.sin(p * Math.PI) * 60;
      list.push({ y: gy, d: () => { if (s.ball) { shadow(x, gy, 4); ctx.save(); ctx.translate(x, gy - z); ctx.fillStyle = 'rgba(255,120,30,.35)'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#ff8a24'; ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, 7); ctx.fill(); ctx.fillStyle = '#ffe08a'; ctx.beginPath(); ctx.arc(-1, -1, 1.4, 0, 7); ctx.fill(); ctx.restore(); return; } shadow(x, gy, s.k === 'catapult' ? 6 : 3); drawEnemyMissile(s, x, gy - z, p); } });
    }
  }
  list.sort((a, b) => a.y - b.y).forEach(o => o.d());
  if (window.XIAOCHANG) XIAOCHANG.drawMagicFx();
  drawPropFx();   // 道具碎屑画在人物上面，打击感更清楚
  drawFloaters();
  if (window.Boss && Boss.wxDraw) Boss.wxDraw(cv.width / DPR, cv.height / DPR);   // Boss 战天气
  if (window.ROGUE && ROGUE.draw()) return;   // 锦囊面板打开时作为模态层，不绘制 HUD
  // HUD
  // iPhone 横屏时刘海/灵动岛在左或右：画布上的 HUD 整体让开安全区
  const SA = safeArea();
  ctx.setTransform(DPR, 0, 0, DPR, SA.l * DPR, 0); Boss.hud(W / DPR - SA.l - SA.r); if (window.ZJ) ZJ.hud(W / DPR - SA.l - SA.r); if (window.CH2OPEN) CH2OPEN.hud(W / DPR - SA.l - SA.r, H / DPR);
  ctx.setTransform(DPR, 0, 0, DPR, SA.l * DPR, 0); const HW = W / DPR - SA.l - SA.r, HH = H / DPR;
  const bw = Math.min(260, HW * .4);
  ctx.fillStyle = 'rgba(20,14,30,.7)'; ctx.fillRect(14, 64, bw + 6, 18);
  ctx.fillStyle = '#d23c30'; ctx.fillRect(17, 67, bw * Math.max(0, Math.min(maxHeroHp(), hero.hp)) / maxHeroHp(), 12);
  // 血条旁边显示玩家名字（标题页输入的）
  const pnm = (window.TITLE && TITLE.playerName && TITLE.playerName()) || '';
  if (pnm) {
    ctx.font = 'bold 14px "PingFang SC","Noto Sans CJK SC",sans-serif';
    const nw = ctx.measureText(pnm).width;
    ctx.fillStyle = 'rgba(20,14,30,.7)'; ctx.fillRect(14 + bw + 6, 64, nw + 14, 18);
    ctx.fillStyle = '#ffd86e'; ctx.fillText(pnm, 14 + bw + 13, 78);
  }
  // 用时：顶部正中的小牌子（原来那一行"击倒/武器/用时"已去掉）
  if (!(window.XIAOCHANG && XIAOCHANG.active())) {
    const tstr = fmtTime(runT);
    ctx.save();
    ctx.font = 'bold 18px "PingFang SC","Noto Sans CJK SC",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(tstr).width, bw2 = tw + 30, bx2 = HW / 2 - bw2 / 2, by2 = 8;
    ctx.fillStyle = 'rgba(20,14,30,.62)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx2, by2, bw2, 26, 13); else ctx.rect(bx2, by2, bw2, 26);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(tstr, HW / 2, by2 + 14);
    ctx.restore();
  }
  if (lockR < Infinity) { const n = zs.filter(z => !z.dead).length; ctx.fillStyle = 'rgba(200,40,30,.85)'; ctx.fillRect(14, 110, 200, 22); ctx.fillStyle = '#fff'; ctx.fillText(`本区域剩余敌人：${n}`, 20, 126); }
  if (!over && lockR === Infinity && gateI > 0 && gateI < M.gates.length && Math.floor(performance.now() / 500) % 2 === 0) {
    ctx.save(); ctx.font = 'bold 46px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = '#34231b'; ctx.fillStyle = '#ffd23f';
    ctx.strokeText('GO →', HW - 28, HH / 2); ctx.fillText('GO →', HW - 28, HH / 2); ctx.restore();
  }
  // 左侧后退边界：镜头贴到边界时，屏幕左缘压暗并画一道红色虚线，一看就知道到头了
  if (arenaL != null && !result && cam.x <= arenaL + 2) {
    const gw = Math.min(70, HW * .08), gr = ctx.createLinearGradient(0, 0, gw, 0);
    gr.addColorStop(0, 'rgba(10,6,4,.6)'); gr.addColorStop(1, 'rgba(10,6,4,0)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, gw, HH);
    ctx.save(); ctx.strokeStyle = 'rgba(200,60,40,.55)'; ctx.lineWidth = 2; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.moveTo(3, HH * .45); ctx.lineTo(3, HH); ctx.stroke(); ctx.restore();
  }
  if (window.SUPPLY && !result) SUPPLY.hud(14, 140);   // 补给效果倒计时
  drawCombo(HW);
  if (msgT > 0) {
    const lines = String(msg).split('|'); ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
    const tw = Math.max(...lines.map(line => ctx.measureText(line).width)), bh = lines.length * 23 + 10, by = 108 - (bh - 32) / 2;
    ctx.fillStyle = 'rgba(20,14,30,.78)'; ctx.fillRect(HW / 2 - tw / 2 - 12, by, tw + 24, bh);
    ctx.fillStyle = '#ffd86e'; lines.forEach((line, i) => ctx.fillText(line, HW / 2, by + 22 + i * 23)); ctx.textAlign = 'left';
  }
  drawResult(HW, HH);
  if (chapter2Run && chapter2Run.mode === 'choice') drawChapter2Choice(HW, HH);
  if (window.CHAPTER2_INTRO && CHAPTER2_INTRO.active()) CHAPTER2_INTRO.draw();
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
// 评分 = 击杀×10 + 通关数×100 + 通关时间分（(900-秒)×0.4，不封顶）+ 无伤分（最多 +200）
// 死掉没有时间分；每被打 1 下扣 20 分
function scoreOfRun(kills, t, cleared, win, hits) {
  const progress = Math.max(0, Math.min(6, cleared)) * 100;
  const speed = win ? Math.max(0, Math.round((900 - t) * .4)) : 0;
  const safe = Math.max(0, 200 - Math.max(0, Math.min(99, hits || 0)) * 20);
  return kills * 10 + progress + speed + safe;
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
function drawCombo(HW) {   // 屏幕坐标绘制（在 HUD 里调用）
  const scale = SC / DPR;
  const x = (hero.x - cam.x) * scale;
  const headY = (hero.y - 37) * scale;
  const visible = comboNotices.filter(n => gameT - n.born < .72);
  comboNotices = visible;
  if (!visible.length) return;
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  visible.forEach((n, i) => {
    const age = gameT - n.born, fade = Math.min(1, (.72 - age) / .18);
    const rise = Math.min(1, age / .12) * 5;
    const y = headY - (visible.length - 1 - i) * 16 - rise;
    ctx.globalAlpha = .72 * fade;
    ctx.font = 'bold 14px sans-serif'; ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(45,32,23,.62)'; ctx.fillStyle = 'rgba(245,231,198,.82)';
    const label = String(n.count) + ' HIT';
    ctx.strokeText(label, x, y); ctx.fillText(label, x, y);
  });
  ctx.restore();
}
// ---------- 结算画面 ----------
const eOut = t => 1 - Math.pow(1 - t, 3);
const eBack = t => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);   // 盖章回弹
let stampPlayed = false, pressAct = null, pressAt = 0;

// 结算动画：数字滚动 + 街机式金币雨（用户定）
function countUp(v, raw, t0, dur) {
  v = Math.round(v || 0); if (result.countSkip) return v;
  const p = Math.max(0, Math.min(1, (raw - t0) / dur));
  const n = Math.round(v * (1 - Math.pow(1 - p, 2)));
  if (p > 0 && p < 1 && n !== (result['_c' + t0] || 0)) { const now = performance.now(); if (now - (result.tickAt || 0) > 55) { result.tickAt = now; sfx('tick'); } }
  if (p >= 1 && v > 0 && !result['_d' + t0]) { result['_d' + t0] = 1; sfx('food'); }
  result['_c' + t0] = n; return n;
}
function drawCoinRain(HW, HH, raw) {
  const R = result; R.rain ||= []; const dt = Math.min(.05, Math.max(0, raw - (R.rainT || raw))); R.rainT = raw;
  const rate = Math.min(26, 4 + (R.coins || 0) / 6) * (raw < 3.2 ? 1 : .25);   // 赚得越多掉得越密；滚完后变稀疏
  R.rainAcc = (R.rainAcc || 0) + rate * dt;
  while (R.rainAcc >= 1 && R.coins > 0) { R.rainAcc--; R.rain.push({ x: Math.random() * HW, y: -12, vy: 60 + Math.random() * 80, vx: (Math.random() - .5) * 20, r: 5 + Math.random() * 4, ph: Math.random() * 6, sp: 5 + Math.random() * 6 }); }
  ctx.save();
  for (const c of R.rain) {
    c.vy += 260 * dt; c.y += c.vy * dt; c.x += c.vx * dt; c.ph += c.sp * dt;
    const w = Math.abs(Math.cos(c.ph)) * c.r + .8;   // 翻转：宽度随角度变化
    ctx.fillStyle = '#c98a1c'; ctx.beginPath(); ctx.ellipse(c.x, c.y + 1, w, c.r, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd65a'; ctx.beginPath(); ctx.ellipse(c.x, c.y, w * .86, c.r * .86, 0, 0, Math.PI * 2); ctx.fill();
    if (w > c.r * .5) { ctx.fillStyle = '#9a6612'; ctx.fillRect(c.x - w * .25, c.y - c.r * .25, w * .5, c.r * .5); }   // 方孔
    if (Math.sin(c.ph * 2) > .9) { ctx.fillStyle = '#fff8d0'; ctx.fillRect(c.x - 1, c.y - c.r, 2, 2); }   // 闪光
  }
  ctx.restore();
  R.rain = R.rain.filter(c => c.y < HH + 20);
}
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
  drawCoinRain(HW, HH, raw);

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
  const frName = result.win ? (chapter2Run ? { n: 'zhang_jiao', f: 'defeat' } : { n: 'guanhai', f: 'kneel' }) : { n: 'hero', f: 'down' };   // 第二章通关画倒地的张角
  const fr = CH[frName.n] && CH[frName.n][frName.f];
  if (fr && fr.img.complete) {
    const k = frName.n === 'zhang_jiao' ? Math.min(1, sh * .2 / fr.h) : Math.max(1, Math.min(Math.round(sh * .14 / fr.h), Math.max(1, Math.floor(pw * .15 / fr.w))));   // 张角原图细，按比例缩小
    const dx = px0 + pw * .13, dy = sy + sh * .27;   // 用户截图：人挡住了复活按钮 → 缩小并挪到左上空白处
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
  // 数字从 0 往上跳：击倒 → 评分 → 金币，依次滚动；点一下屏幕直接跳到最终值
  const cK = countUp(result.kills, raw, .55, .55), cS = countUp(result.score, raw, 1.0, .8), cC = countUp(result.coins || 0, raw, 1.7, .8);
  ctx.fillText('击倒 ' + cK + ' 名　用时 ' + fmtTime(result.time) + '　评分 ' + cS, px0 + pw * .50, sy + sh * .385);
  ctx.fillStyle = '#a97618';
  const pop = result.coins && !result.countSkip && raw > 2.5 && raw < 2.8 ? 1 + .25 * Math.sin((raw - 2.5) / .3 * Math.PI) : 1;   // 金币滚完：放大弹一下
  ctx.font = Math.round(sh * .050 * pop) + 'px ' + F;
  ctx.fillText('💰 本局获得金币 ' + cC, px0 + pw * .50, sy + sh * .455);

  // 台词：按卷轴内宽换行，标点不能单独落到下一行
  const line = result.line || '';
  if (line) {
    // 用户反馈：通关文字被截断 → 最多 3 行，放不下就自动缩小字号
    let lfs = Math.max(11, Math.round(sh * .046)), rows = [];
    const maxW = pw * .78, cx = px0 + pw * .50, noStart = '，。！？、；：”’）》」』…';
    for (let tries = 0; tries < 6; tries++) {
      ctx.font = lfs + 'px ' + BRUSH; rows = []; let row = '';
      for (const ch of line) {
        if (row && ctx.measureText(row + ch).width > maxW) {
          if (noStart.includes(ch)) { row += ch; rows.push(row); row = ''; }
          else { rows.push(row); row = ch; }
        } else row += ch;
      }
      if (row) rows.push(row);
      if (rows.length <= 3 || lfs <= 10) break; lfs = Math.max(10, Math.round(lfs * .88));
    }
    ctx.fillStyle = '#3a2410';
    const lh = lfs * 1.3, top = sy + sh * .525 - (rows.length > 2 ? lh * .35 : 0);
    rows.slice(0, 3).forEach((r2, i) => ctx.fillText(r2, cx, top + i * lh));
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
  const actionCount = result.win ? 4 : 3;
  const bw = (pw * .84 - gap * (actionCount - 1)) / actionCount, bh = bw / 1.66;
  const byy = sy + sh * .755;
  const bx0 = px0 + (pw - (bw * actionCount + gap * (actionCount - 1))) / 2;
  // 按当前结算按钮中的最长标签计算统一字号
  let ufs = Math.round(bh * .46);
  ctx.font = ufs + 'px ' + BRUSH;
  const actionLabels = result.win
    ? (chapter2Run ? ['分享', '返回首页', '再来一局', '返回整备'] : ['分享', '返回首页', '再来一局', '第二章'])
    : ['分享', '返回首页', '再来一局'];
  const longest = Math.max(...actionLabels.map(t => ctx.measureText(t).width));
  if (longest > bw * .78) ufs = Math.max(8, Math.floor(ufs * bw * .78 / longest));
  const plank = (i, label, act, red, off) => {
    const x = bx0 + i * (bw + gap);
    const pressed = pressAct === act && performance.now() - pressAt < 140;
    const yy = byy + (pressed ? bh * .06 : 0);
    const img = IMG[red ? 'ui_btn_red' : 'ui_btn'];
    ctx.save();
    ctx.globalAlpha = btnFade * (pressed ? .82 : 1) * (off ? .72 : 1);
    if (img && img.complete) ctx.drawImage(img, x, yy, bw, bh);
    else { ctx.fillStyle = red ? '#8e2f22' : '#7a5530'; ctx.fillRect(x, yy, bw, bh); }
    ctx.restore();
    ctx.save();
    const lfs = ufs;
    ctx.font = lfs + 'px ' + BRUSH;
    ctx.fillStyle = off ? 'rgba(52,40,26,.92)' : (red ? '#f6e2c0' : '#2b1a0c');
    ctx.fillText(label, x + bw / 2, yy + bh * .62 + lfs * .18);
    ctx.restore();
    if (result.sel === act) { ctx.save(); ctx.globalAlpha = btnFade; ctx.strokeStyle = '#fff1b8'; ctx.lineWidth = 3; ctx.shadowColor = '#ffd76a'; ctx.shadowBlur = 10; ctx.strokeRect(x - 3, yy - 3, bw + 6, bh + 6); ctx.restore(); }   // 键盘选中
    uiBtns.push({ x, y: yy, w: bw, h: bh, act });
  };
  plank(0, '分享', 'share', false);
  plank(1, '返回首页', 'home', false);
  plank(2, '再来一局', 'restart', true);
  if (result.win) {
    const chapter2Locked = !chapter2Run && (!window.CHAPTER2 || !CHAPTER2.canEnter());
    plank(3, chapter2Run ? '返回整备' : '第二章', chapter2Run ? 'prep' : 'next', false, chapter2Locked);
  }

  // 复活按钮
  if (!result.win && raw > .8) {
    const rw = pw * .66, rh = sh * .078, rx = px0 + (pw - rw) / 2, ry = sy + sh * .60;
    const pressed = pressAct === 'revive' && performance.now() - pressAt < 140;
    const pulse = .5 + .5 * Math.sin(performance.now() / 220);   // 呼吸，吸引注意
    ctx.save();
    ctx.globalAlpha = Math.min(1, (raw - .8) / .2);
    // 外发光
    ctx.shadowColor = 'rgba(140,240,122,' + (.35 + .35 * pulse) + ')';
    ctx.shadowBlur = 14 + 8 * pulse;
    ctx.fillStyle = pressed ? 'rgba(40,90,48,.97)' : 'rgba(47,107,58,.95)';
    ctx.fillRect(rx, ry + (pressed ? 2 : 0), rw, rh);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#8ef07a'; ctx.lineWidth = 2.5;
    ctx.strokeRect(rx + 1, ry + (pressed ? 2 : 0) + 1, rw - 2, rh - 2);
    ctx.fillStyle = '#e9ffe2'; ctx.font = 'bold ' + Math.round(rh * .5) + 'px ' + F;
    ctx.textAlign = 'center';
    const label = revives >= 1 ? '分享复活（第 3 条命起评分减半）' : '分享给好友 · 免费复活';
    ctx.fillText(label, rx + rw / 2, ry + rh * .68 + (pressed ? 2 : 0));
    ctx.restore();
    if (result.sel === 'revive') { ctx.save(); ctx.strokeStyle = '#fff1b8'; ctx.lineWidth = 3; ctx.strokeRect(rx - 4, ry - 4, rw + 8, rh + 8); ctx.restore(); }
    uiBtns.push({ x: rx, y: ry, w: rw, h: rh, act: 'revive' });
  }
  ctx.globalAlpha = 1;
  // 开发者模式：结算时在左上角列出本局锦囊统计（触发次数 / 伤害 / 回血），方便测强弱
  if (/[?&]debug/.test(location.search) && window.ROGUE && ROGUE.stats) {
    const st = Object.entries(ROGUE.stats()).sort((a, b) => b[1].dmg - a[1].dmg);
    if (st.length) {
      ctx.save(); ctx.font = '12px sans-serif'; ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(15,10,6,.82)'; ctx.fillRect(8, 40, 220, 22 + st.length * 16);
      ctx.fillStyle = '#f1d58f'; ctx.fillText('锦囊统计（调试）', 16, 56);
      st.forEach(([n, o], i) => { ctx.fillStyle = '#ecdcbc'; ctx.fillText(`${n}  触发 ${o.trig}  伤害 ${o.dmg.toFixed(1)}${o.heal ? '  回血 ' + o.heal.toFixed(1) : ''}`, 16, 74 + i * 16); });
      ctx.restore();
    }
  }

  if (toastT > 0) {   // 分享结果的提示条：放在屏幕下方，不压面板
    ctx.font = 'bold 15px ' + F;
    const tw = ctx.measureText(toastMsg).width, ty = HH - 52;
    ctx.fillStyle = 'rgba(20,14,30,.88)'; ctx.fillRect(HW / 2 - tw / 2 - 14, ty - 22, tw + 28, 30);
    ctx.fillStyle = '#ffd86e'; ctx.fillText(toastMsg, HW / 2, ty);
  }
  ctx.textAlign = 'left'; ctx.globalAlpha = 1;
}
function drawChapter2Choice(HW, HH) {
  // 选路面板：和开场对白同一套样式（深色底、金色双边框、金框头像、PingFang 粗体）
  uiBtns = [];
  const F = '"PingFang SC","Microsoft YaHei",sans-serif', small = HH < 520 || HW < 760;
  const rr = (x, y, w, h, r) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h); };
  ctx.save(); ctx.globalAlpha = 1; ctx.fillStyle = 'rgba(15,10,10,.55)'; ctx.fillRect(0, 0, HW, HH);
  const pw = Math.min(640, HW - 24), ph = small ? 200 : 236, x = (HW - pw) / 2, y = (HH - ph) / 2;
  ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
  ctx.fillStyle = 'rgba(30,22,18,.93)'; rr(x, y, pw, ph, 8); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.lineWidth = 2; ctx.strokeStyle = '#e5c98a'; rr(x + 1, y + 1, pw - 2, ph - 2, 7); ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,238,194,.38)'; rr(x + 6, y + 6, pw - 12, ph - 12, 5); ctx.stroke();
  // 头像
  const av = small ? 72 : 96, ax = x + 14, ay = y + 14, im = IMG.dialog_caocao;
  ctx.fillStyle = '#b78b4d'; rr(ax - 3, ay - 3, av + 6, av + 6, 6); ctx.fill();
  ctx.fillStyle = '#241912'; rr(ax, ay, av, av, 4); ctx.fill();
  if (im && im.complete && im.naturalWidth) { const sc = Math.max(av / im.width, av / im.height); ctx.save(); rr(ax, ay, av, av, 4); ctx.clip(); ctx.drawImage(im, ax + (av - im.width * sc) / 2, ay + (av - im.height * sc) / 2, im.width * sc, im.height * sc); ctx.restore(); }
  // 名字 + 台词
  const tl = ax + av + (small ? 16 : 22), tw = x + pw - 20 - tl;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${small ? 16 : 20}px ${F}`; ctx.fillStyle = '#f1cf75'; const ny = ay + (small ? 18 : 22); ctx.fillText('曹操', tl, ny);
  ctx.fillStyle = 'rgba(211,165,83,.8)'; ctx.fillRect(tl, ny + 6, ctx.measureText('曹操').width + 14, 1.5);
  ctx.font = `700 ${small ? 15 : 18}px ${F}`; ctx.fillStyle = '#f7f0df';
  { let line = '', ly = ny + (small ? 30 : 38); for (const ch of '张梁、张宝分兵突围，棺椁去向不明！我们兵分两路——你追哪一个？') { if (line && ctx.measureText(line + ch).width > tw) { ctx.fillText(line, tl, ly); line = ch; ly += small ? 20 : 25; } else line += ch; } if (line) ctx.fillText(line, tl, ly); }
  // 两个选项：同款深底金边小牌
  const gap = 14, bw = (pw - 28 - gap) / 2, bh = small ? 50 : 58, by = y + ph - bh - 14;
  const options = [
    { x: x + 14, key: '1', label: '正面突击 · 追击张梁', act: 'zhang-liang' },
    { x: x + 14 + bw + gap, key: '2', label: '迂回包抄 · 截住张宝', act: 'zhang-bao' },
  ];
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const o of options) {
    ctx.fillStyle = 'rgba(58,40,28,.96)'; rr(o.x, by, bw, bh, 6); ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = '#e5c98a'; rr(o.x + .75, by + .75, bw - 1.5, bh - 1.5, 6); ctx.stroke();
    ctx.fillStyle = '#b78b4d'; ctx.beginPath(); ctx.arc(o.x + 22, by + bh / 2, 11, 0, 7); ctx.fill();
    ctx.fillStyle = '#241912'; ctx.font = `700 13px ${F}`; ctx.fillText(o.key, o.x + 22, by + bh / 2 + 1);
    ctx.fillStyle = '#f7f0df'; ctx.font = `700 ${small ? 14 : 16}px ${F}`; ctx.fillText(o.label, o.x + bw / 2 + 10, by + bh / 2 + 1);
    uiBtns.push({ x: o.x, y: by, w: bw, h: bh, act: o.act });
  }
  ctx.restore();
}
// 分享换复活（每局一次）：不管分享成不成功都给，分享面板取消也不扣次数
async function doRevive() {
  if (!result || result.win) return;
  reviveUsed = true; revives++;   // 可以无限复活，但从第 2 次复活起评分减半
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
  if (result && gameT >= result.born && !result.countSkip && gameT - result.born < 2.6) result.countSkip = true;   // 结算数字还在滚：点一下直接跳到最终值
  if (chapter2Run && chapter2Run.mode === 'choice') {
    for (const b of uiBtns) if (e.clientX >= b.x && e.clientX <= b.x + b.w && e.clientY >= b.y && e.clientY <= b.y + b.h) {
      e.preventDefault(); e.stopPropagation(); chooseChapter2Route(b.act); return;
    }
    return;
  }
  if (!result || gameT < result.born) return;
  for (const b of uiBtns) {
    if (e.clientX >= b.x && e.clientX <= b.x + b.w && e.clientY >= b.y && e.clientY <= b.y + b.h) {
      e.preventDefault(); e.stopPropagation();
      resultAct(b.act);
      return;
    }
  }
}, true);
// 结算按钮：鼠标点、键盘选（← → / A D 移动，J / 回车 / 空格确定）都走这里
function resultAct(act) {
  pressAct = act; pressAt = performance.now();
  setTimeout(() => {
        if (act === 'share') doShare();
        else if (act === 'revive') doRevive();
        else if (act === 'home') { if (window.TITLE) TITLE.show(); }
        else if (act === 'next') {
          if (window.CHAPTER2 && !CHAPTER2.canEnter()) toast('第二章「黄巾决战」尚未开放');
          else toast('下一关还在做，敬请期待');
        }
        else if (act === 'prep') { if (window.TITLE) TITLE.openPreparation({ chapter: 2, view: 'campaign' }); }
        else reset();
  }, 140);
}
function resultKey(e) {
  if (!result || gameT < result.born) return false;
  const acts = uiBtns.map(b => b.act); if (!acts.length) return false;
  if (!acts.includes(result.sel)) result.sel = acts.includes('revive') ? 'revive' : 'restart';
  const order = ['revive', 'share', 'home', 'restart', 'next', 'prep'].filter(a => acts.includes(a));
  const k = order.indexOf(result.sel);
  if (['ArrowLeft', 'KeyA', 'ArrowUp', 'KeyW'].includes(e.code)) { result.sel = order[(k + order.length - 1) % order.length]; sfx('tick'); return true; }
  if (['ArrowRight', 'KeyD', 'ArrowDown', 'KeyS'].includes(e.code)) { result.sel = order[(k + 1) % order.length]; sfx('tick'); return true; }
  if (['Enter', 'KeyJ', 'Space', 'NumpadEnter'].includes(e.code)) { if (result.countSkip === false || gameT - result.born < 2.6) result.countSkip = true; resultAct(result.sel); return true; }
  return false;
}
function drawShot(s) {
  if (s.kind === 'arrow') {
    const ar = IMG.ui_arrow;
    ctx.save(); ctx.translate(s.x, s.y - s.z); ctx.rotate(Math.atan2(s.vy || 0, s.vx || 1));
    if (s.volley) {
      ctx.strokeStyle = 'rgba(255,228,150,.65)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-19, 0); ctx.stroke();
    }
    if (ar && ar.complete) { ctx.imageSmoothingEnabled = false; ctx.drawImage(ar, -ar.width * PX / 2, -ar.height * PX / 2, ar.width * PX, ar.height * PX); }
    ctx.restore();
    return;
  }
  const img = s.charged ? IMG.ui_stone_shot_charge : s.final ? IMG.ui_stone_shot_final : IMG.ui_stone_shot;
  if (!img || !img.complete) { stone(s.x, s.y - s.z); return; }
  const w = s.charged ? 14 : s.final ? 16 : 6;
  const h = w * img.height / img.width;
  ctx.save(); ctx.translate(s.x, s.y - s.z);
  if (s.vx < 0) ctx.scale(-1, 1);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}
function drawStoneHit(h) {
  const img = IMG.ui_stone_hit;
  if (!img || !img.complete) return;
  const frame = Math.min(3, Math.max(0, Math.floor(h.t / .05)));
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, frame * 48, 0, 48, 48, h.x - 6, h.y - 6, 12, 12);
  ctx.restore();
}
function drawBluntHit(h) {
  if (h.big) {   // 终段爆发：80×80 三帧，画成 30 像素
    const im = IMG.ui_hit_finisher;
    if (!im || !im.complete) return;
    const fr = Math.min(2, Math.floor(h.t / .067));
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(im, fr * 80, 0, 80, 80, h.x - 15, h.y - 15, 30, 30);
    ctx.restore(); return;
  }
  const img = IMG.ui_hit_blunt;
  if (!img || !img.complete) return;
  const frame = Math.min(2, Math.max(0, Math.floor(h.t / .05)));
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, frame * 48, 0, 48, 48, h.x - 7, h.y - 7, 14, 14);
  ctx.restore();
}
function drawBleedFx(f) {
  const kind = f.kind;
  const img = kind === 'rip' ? IMG.ui_halberd_rip : kind === 'splash' ? IMG.ui_bleed_splash : IMG.ui_bleed_drip;
  if (!img || !img.complete) return;
  const fw = kind === 'rip' ? 64 : kind === 'splash' ? 48 : 32;
  const frame = Math.min(2, Math.max(0, Math.floor(f.t / (kind === 'rip' ? .067 : .05))));
  const size = kind === 'rip' ? 30 : kind === 'splash' ? (f.big ? 24 : 14) : 12;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, frame * fw, 0, fw, fw, f.x - size / 2, f.y - size / 2, size, size);
  ctx.restore();
}
function drawHammerFx(f) {
  const img = f.kind === 'spin' ? IMG.ui_hammer_spin : IMG.ui_hammer_slam;
  if (!img || !img.complete) return;
  const w = f.size, h = w * 60 / 96;
  const frame = Math.min(2, Math.max(0, Math.floor(f.t / .1)));
  ctx.save(); ctx.imageSmoothingEnabled = false;
  const cy = f.kind === 'spin' ? f.y - h * .35 : f.y - h * .6;   // 图的下沿贴着地面，不再以脚底为中心（之前偏下）
  ctx.drawImage(img, frame * 96, 0, 96, 60, f.x - w / 2, cy - h / 2, w, h);
  ctx.restore();
}
function drawBladeFx(f) {
  const slash = f.kind === 'slash';
  const img = slash ? IMG.ui_blade_slash : IMG.ui_blade_crescent;
  if (!img || !img.complete) return;
  const fw = slash ? 96 : 56, w = 50, h = slash ? 25 : 90;
  const frame = Math.min(2, Math.max(0, Math.floor(f.t / (f.T / 3))));
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.translate(f.x, f.y);
  if (f.dir < 0) ctx.scale(-1, 1);
  ctx.drawImage(img, frame * fw, 0, fw, fw === 96 ? 48 : 96, -w / 2, -h / 2, w, h);
  ctx.restore();
}
function drawBowFx(f) {
  if (f.kind === 'volley') {
    const img = IMG.ui_bow_volley; if (!img || !img.complete) return;
    const frame = Math.min(2, Math.floor(f.t / (f.T / 3)));
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(f.x, f.y); if (f.dir < 0) ctx.scale(-1, 1);
    ctx.drawImage(img, frame * 72, 0, 72, 40, 0, -8.5, 30, 17);
    ctx.restore(); return;
  }
  if (f.kind === 'impact') {
    const img = IMG.ui_bow_impact; if (!img || !img.complete) return;
    const frame = Math.min(2, Math.floor(f.t / (f.T / 3)));
    ctx.save(); ctx.imageSmoothingEnabled = false;
    const iw = (f.r || 30) * 2.2, ih = iw * 56 / 96;   // 冲击环大小跟判定范围一致
    ctx.drawImage(img, frame * 96, 0, 96, 56, f.x - iw / 2, f.y - ih * .77, iw, ih);   // 图里的环在下方 77% 处，对准落点
    ctx.restore(); return;
  }
  if (f.kind !== 'sky') return;
  if (f.t < .3) {
    const p = f.t / .3, a = .35 + .35 * Math.sin(p * Math.PI);
    ctx.save(); ctx.strokeStyle = `rgba(255,221,112,${a})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(f.x, f.y, f.data.radius, f.data.radius / 2, 0, 0, Math.PI * 2);   // 标记大小 = 实际判定范围 ctx.stroke();
    ctx.fillStyle = `rgba(255,205,80,${a * .22})`; ctx.fill();
    ctx.restore(); return;
  }
  if (f.t >= .5) return;
  const img = IMG.ui_bow_sky; if (!img || !img.complete) return;
  const p = (f.t - .3) / .2, sx = f.x - f.dir * 60, sy = f.y - 60;   // 图里箭尾在左上，箭从主角这一侧的斜上方落下
  const tipX = sx + (f.x - sx) * p, tipY = sy + (f.y - sy) * p;
  const frame = Math.min(2, Math.floor(p * 3));
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(tipX, tipY); if (f.dir < 0) ctx.scale(-1, 1);
  ctx.drawImage(img, frame * 48, 0, 48, 96, -10, -40, 20, 40);
  ctx.restore();
}
function drawHalberdBleedDots(z, top) {
  return;   // 用户定：头顶层数红点不好看，取消；层数改由滴血频率表现
  const n = halberdStacks(z);
  if (!n) return;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const x = z.x + (i - (n - 1) / 2) * 5;
    ctx.fillStyle = '#5b1715'; ctx.beginPath(); ctx.arc(x, top, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ef4b42'; ctx.beginPath(); ctx.arc(x, top - .4, 1.7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
function stone(x, y) { ctx.fillStyle = '#2a2234'; ctx.fillRect(x - 2, y - 2, 4, 4); ctx.fillStyle = '#9a9ea8'; ctx.fillRect(x - 1, y - 1.5, 2, 2); }
function drawProp(p) {
  if (p.broken) return;   // 打坏的草垛/推车不再画
  if (p.fadeAt != null) { const k = gameT - p.fadeAt; if (k > 2) { p.broken = true; return; } if (k > 1.4) { ctx.save(); ctx.globalAlpha = 1 - (k - 1.4) / .6; drawProp({ ...p, fadeAt: null }); ctx.restore(); return; } }   // 碎箱子等：留 1.4 秒后淡出消失
  const [, w0, h0] = ASSETS.props[p.g];
  if (p.vert) {
    // 竖放拒马（jumo_v / jumo_vs 及打坏版）：图本身就是上下排列，前端（图底）贴在 p.y
    const sh = p.hitT > 0 ? Math.sin(p.hitT * 90) * 2.2 : 0;
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(IMG['p_' + p.g], Math.round(p.x - w0 / 2 + sh), Math.round(p.y + 3 - h0), w0, h0);
    ctx.restore(); return;
  }
  const w = (p.dw || w0) * (p.sc || 1), h = (p.dh || h0) * (p.sc || 1);
  const a = p.alpha || (p.solid && hero.y < p.y && hero.y > p.y - h + 6 && Math.abs(hero.x - p.x) < w / 2 + 4 ? .5 : 1);
  const sh = p.hitT > 0 ? Math.sin(p.hitT * 90) * 2.2 : 0;   // 被打中时左右抖一下
  ctx.save(); ctx.globalAlpha = a; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  if (p.chapter2 && ['hay', 'cart', 'mill'].includes(p.g)) ctx.filter = 'brightness(.66) saturate(.6)';   // 第二章暮色战场：道具压暗，不抢人物
  if (p.flip) { ctx.translate(Math.round(p.x), 0); ctx.scale(-1, 1); ctx.translate(-Math.round(p.x), 0); }   // 左右翻转（旗面朝左）
  ctx.drawImage(IMG['p_' + p.g], Math.round(p.x - w / 2 + sh), Math.round(p.y + 2 - h), w, h);
  ctx.restore();
}
function drawChargeAura(h) {
  const p = chargeRatio(), t = performance.now() / 1000, pulse = .5 + .5 * Math.sin(t * (7 + p * 5));
  const col = chargeTier === 3 ? '#ff9a3d' : chargeTier === 2 ? '#ffd84a' : '#ffffff';
  const height = 34 + 34 * p, width = 18 + 10 * p;
  const K = .55;                      // 只比主角大一点点
  ctx.save(); ctx.translate(h.x, h.y - (h.z || 0)); ctx.scale(K, K);
  // 低蓄力时火焰贴身，接近满蓄逐渐向上拔高并向两侧扩张。
  ctx.globalAlpha = .10 + .16 * p + .05 * pulse;
  ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 5 + 8 * p;
  ctx.beginPath(); ctx.ellipse(0, -22, width * (.72 + pulse * .08), 26 + 8 * p, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 2 + 4 * p;
  // 先铺宽阔的火焰主体，再叠尖舌；避免效果看成几根细长光柱。
  const body = [
    [-15, 0], [-27, -7], [-21, -14], [-33, -23], [-24, -28], [-31, -38],
    [-19, -35], [-21, -49], [-11, -43], [-7, -59], [-1, -48], [3, -75],
    [10, -51], [19, -63], [17, -44], [30, -50], [23, -34], [34, -26],
    [25, -16], [29, -7], [16, 0],
  ];
  const sx = width / 28, sy = height / 68;
  for (const [scale, alpha] of [[1, .18 + .20 * p], [.76, .16 + .22 * p]]) {
    ctx.globalAlpha = alpha * (.88 + pulse * .12); ctx.fillStyle = col;
    ctx.beginPath();
    body.forEach(([x, y], i) => {
      const xx = x * sx * scale + Math.sin(t * 8 + i * .7) * (1 + p * 1.3);
      const yy = y * sy * scale;
      if (!i) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    });
    ctx.closePath(); ctx.fill();
  }
  // 成组的折线火舌：每侧有高低错落的尖峰，底部围住人物而不是几根孤立光柱。
  const tongues = [
    [-1, .58, .23, 0], [-1, .82, .17, 1.4], [-1, .69, .13, 2.8], [-1, .94, .10, 4.1],
    [ 1, .63, .23, 1.1], [ 1, .88, .17, 2.5], [ 1, .72, .13, 3.7], [ 1, .98, .10, 5.2],
  ];
  for (let layer = 0; layer < 2; layer++) {
    for (const [side, peakN, spreadN, phase] of tongues) {
      const sway = Math.sin(t * (8 + layer) + phase) * (1.2 + p * 2.2);
      const peak = height * peakN * (.94 + pulse * .08);
      const spread = width * spreadN * (layer ? .72 : 1);
      const base = side * (4 + layer * 1.5);
      const tip = side * (width * (.42 + spreadN * 1.25) + sway);
      ctx.globalAlpha = (layer ? .46 : .60) * (.45 + .55 * p) + .06 * pulse;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(base - side * spread, -1);
      ctx.lineTo(base - side * (spread * .74), -height * .20);
      ctx.lineTo(tip - side * spread * .32, -height * .31);
      ctx.lineTo(tip, -peak);
      ctx.lineTo(tip + side * spread * .12, -height * (.46 + peakN * .08));
      ctx.lineTo(base + side * spread, -height * .28);
      ctx.lineTo(base + side * spread * .72, -height * .10);
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.shadowBlur = 0;
  // 火舌之间穿插短促碎光，地面有扩散的白色气浪环。
  const moteCount = 5 + Math.round(p * 10);
  for (let i = 0; i < moteCount; i++) {
    const phase = (t * (.24 + (i % 4) * .035) + i / moteCount) % 1;
    const side = i % 2 ? 1 : -1, x = side * (8 + phase * (width + 7)) + Math.sin(t * 9 + i * 2) * 2;
    const y = -4 - phase * (height * (.72 + (i % 3) * .08));
    const size = 1 + (i % 3) * .45;
    ctx.globalAlpha = (.22 + p * .48) * (1 - phase * .55); ctx.fillStyle = col;
    ctx.fillRect(Math.round(x), Math.round(y), size, size * (1.3 + pulse * .6));
  }
  ctx.globalAlpha = .20 + .35 * p + .18 * pulse; ctx.strokeStyle = col; ctx.lineWidth = 1 + p * 1.4;
  ctx.beginPath(); ctx.ellipse(0, -1, 13 + p * 9 + pulse * 2, 3 + p * 2, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = .12 + .22 * p; ctx.fillStyle = col;
  for (let i = 0; i < 7; i++) {
    const side = i % 2 ? 1 : -1, x = side * (12 + (i % 4) * 4 + Math.sin(t * 8 + i) * 2);
    const y = -3 - (i % 3) * 2, r = 1.5 + (i % 3) * .6;
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.6, r * .7, side * .12, 0, Math.PI * 2); ctx.fill();
  }
  if (chargeTierFlash > 0) {
    ctx.globalAlpha = (chargeTierFlash / .18) * .85;
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, -24, 30 + 5 * (1 - chargeTierFlash / .18), 38, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

// 献祭：主角身上一层淡红色光晕；敌人贴身每秒叠 1 层（最多 3 层），层数越高红光越亮、光环越多。
function drawFireAura(h) {
  if (!window.ROGUE || !ROGUE.fireAura) return;
  const A = ROGUE.fireAura(); if (!A.active) return;
  const lv = Math.max(1, Math.min(3, A.stacks || 1));
  const t = performance.now() / 1000, pulse = .5 + .5 * Math.sin(t * 2.6);
  const R = 26 + lv * 6;
  // 外层柔光：正常混合压暗一点背景，浅色地面上也能看见
  ctx.save();
  const g = ctx.createRadialGradient(h.x, h.y - 18, 3, h.x, h.y - 18, R);
  g.addColorStop(0, `rgba(255,86,66,${.20 + lv * .035 + pulse * .02})`);
  g.addColorStop(.55, `rgba(214,42,44,${.13 + lv * .025})`);
  g.addColorStop(1, 'rgba(140,16,26,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(h.x, h.y - 18, R * .9, R * 1.05, 0, 0, 7); ctx.fill();
  ctx.restore();
  // 贴身光晕：每层一圈淡红光环（1~3 层），最内圈最亮
  for (let i = 0; i < lv; i++) {
    const rx = 15 + i * 3.2, ry = 20 + i * 3.2;
    ctx.save();
    ctx.strokeStyle = `rgba(255,104,82,${.26 - i * .05 + pulse * .03})`;
    ctx.lineWidth = 1.4;
    ctx.shadowColor = 'rgba(255,70,50,.55)';
    ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.ellipse(h.x, h.y - 17, rx, ry, 0, 0, 7); ctx.stroke();
    ctx.restore();
  }
  // 贴地范围圈：淡红，尽量不抢画面
  ctx.save();
  ctx.strokeStyle = `rgba(255,96,78,${.12 + lv * .04})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(h.x, h.y, 24, 10, 0, 0, 7); ctx.stroke();
  ctx.restore();
  // 缓缓上升的火星
  ctx.save();
  for (let i = 0; i < lv * 4; i++) {
    const ph = (t * (.32 + i * .045) + i * .37) % 1;
    const x = h.x + Math.sin(t * 1.6 + i * 2.3) * (9 + lv * 2.4);
    const y = h.y - 7 - ph * (26 + lv * 6);
    ctx.globalAlpha = (1 - ph) * (.30 + lv * .09);
    ctx.fillStyle = i % 2 ? '#ff9a64' : '#ff4a3a';
    ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
  }
  ctx.restore();
}

function drawHero() {
  const h = hero; shadow(h.x, h.y, 10);
  if (!over && h.st !== 'down') drawFireAura(h);
  h.shieldFlash = Math.max(0, (h.shieldFlash || 0) - 1 / 60);
  if (window.ROGUE && ROGUE.shieldReady && ROGUE.shieldReady()) {
    const pulse = .72 + .18 * Math.sin(performance.now() / 230);
    ctx.save(); ctx.globalAlpha = pulse; ctx.strokeStyle = '#d9b968'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(h.x, h.y - 13, 15, 20, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,236,171,.68)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(h.x, h.y - 13, 12, 17, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  if (h.shieldFlash > 0) { ctx.save(); ctx.globalAlpha = h.shieldFlash / .22; ctx.fillStyle = '#ffe79b'; ctx.beginPath(); ctx.arc(h.x, h.y - 15, 17, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  if (charging) drawChargeAura(h);   // 蓄力聚气（白色气焰）
  if (h.inv > 0 && h.inv < 2 && h.st !== 'roll' && h.st !== 'down' && Math.floor(h.inv * 20) % 2) return;
  const lift = window.ARTIFACT ? ARTIFACT.drawUnder(h) : 0;   // 踩在飞剑上：剑画在脚下，人抬高一点
  const drunk = window.SUPPLY && SUPPLY.drunk(), sway = drunk && h.st === 'idle' ? Math.sin(performance.now() / 300) * 1.5 : 0;   // 烈酒坛：泛红、站着时轻轻摇晃
  if (drunk) { ctx.save(); ctx.filter = 'sepia(.35) saturate(1.8) hue-rotate(-20deg)'; }
  drawChar('hero', heroFrame(h), h.x + sway, h.y - (h.z || 0) - lift, h.f < 0);
  if (drunk) ctx.restore();
}
function drawZ(z) {
  ch2Telegraph(z);
  if (z.T.boss) { Boss.draw(z); drawHalberdBleedDots(z, z.y - 68); if (z.poisonT > 0) { ctx.fillStyle = '#8fd16a'; ctx.fillRect(z.x - 1, z.y - 64, 3, 3); }
    if (z.celebrating) drawCheer(z); return; }
  if (z.T.chapterBoss) {
    if (z.hidden) { shadow(z.x, z.y, 6); return; }   // 张宝土遁：钻在地下
    shadow(z.x, z.y, 16);
    const recoil = 0;
    drawChar(z.sprite, zFrame(z), z.x + recoil, z.y - (z.z || 0), z.f < 0, 1, z.flash > 0, z.sc || 1, !!z.dark);
    if (window.BOSS_BLOCK) BOSS_BLOCK.draw(z);
    return;   // 第二章首领的血条和名字统一画在屏幕上方（ZJ.hud）
    drawHalberdBleedDots(z, z.y - 58);
    const w = 34, y = z.y - 49;
    ctx.fillStyle = '#211510'; ctx.fillRect(z.x - w / 2, y, w, 4);
    ctx.fillStyle = '#c93420'; ctx.fillRect(z.x - w / 2 + 1, y + 1, (w - 2) * Math.max(0, z.hp / z.T.hp), 2);
    ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 2; ctx.strokeStyle = '#2a160f'; ctx.fillStyle = '#ffe4ad';
    ctx.strokeText(z.T.name, z.x, y - 3); ctx.fillText(z.T.name, z.x, y - 3); ctx.textAlign = 'left';
    return;
  }
  shadow(z.x, z.y, 10);
  const a = z.st === 'gone' ? Math.max(0, 1 - z.t * 1.2) * (Math.floor(z.t * 12) % 2 ? .4 : 1) : 1;
  const hop = z.celebrating ? Math.abs(Math.sin(z.celebrateT * 7)) * 2.5 : 0;
  drawChar(z.sprite || z.type, zFrame(z), z.x, z.y - (z.z || 0) - hop, z.f < 0, a, z.flash > 0, z.sc || 1, !!z.dark);
  if (z.celebrating) drawCheer(z);
  if (z.dead || z.air || z.st === 'land') return;
  drawHalberdBleedDots(z, z.y - 40);
  const top = z.y - 34;
  if (z.st === 'sleep') {
    const bob = Math.sin(performance.now() / 300) * 2;
    ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = 2;
    ctx.strokeStyle = '#34231b'; ctx.fillStyle = '#fff0a8';
    ctx.strokeText('Z', z.x + 9, z.y - 20 + bob); ctx.fillText('Z', z.x + 9, z.y - 20 + bob);
    ctx.textAlign = 'left'; return;
  }
  if (z.st === 'wake') {
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = 3;
    ctx.strokeStyle = '#34231b'; ctx.fillStyle = '#ff4a32';
    ctx.strokeText('!', z.x, top - 4); ctx.fillText('!', z.x, top - 4); ctx.textAlign = 'left';
  }
  if (z.daze > 0) {   // 头顶转圈的小黄星
    const t = performance.now() / 260;
    for (let k = 0; k < 3; k++) {
      const a = t + k * 2.094, sx = z.x + Math.cos(a) * 7, sy = top - 6 + Math.sin(a) * 2;
      ctx.fillStyle = '#3a2410'; ctx.fillRect(sx - 2, sy - 2, 4, 4); ctx.fillStyle = '#ffd84a'; ctx.fillRect(sx - 1.5, sy - .5, 3, 1); ctx.fillRect(sx - .5, sy - 1.5, 1, 3);
    }
  }
  if (z.poisonT > 0) { ctx.fillStyle = '#8fd16a'; ctx.fillRect(z.x - 1, top - 5, 3, 3); ctx.fillStyle = '#4c8a43'; ctx.fillRect(z.x + 3, top - 7, 2, 2); }
  if (z.st === 'wind' && !z.T.ranged) { ctx.fillStyle = '#e03a2a'; ctx.fillRect(z.x - 1, top - 10, 3, 6); ctx.fillRect(z.x - 1, top - 2.5, 3, 2); }
  const barW = (z.T.elite || z.T.ch2Elite) ? 26 : 18;
  const barY = top;
  ctx.fillStyle = '#18101e'; ctx.fillRect(z.x - barW / 2, barY, barW, 3); ctx.fillStyle = (z.T.elite || z.T.ch2Elite) ? '#e04a2a' : z.T.heavy ? '#e0a030' : '#7ad06a'; ctx.fillRect(z.x - barW / 2 + 1, barY + 1, (barW - 2) * z.hp / z.T.hp, 1);
}
function drawCheer(z) {
  const t = z.celebrateT || 0, bob = Math.abs(Math.sin(t * 7)) * 2.5, y = z.y - 20 - bob;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < 3; i++) {
    const phase = (t * 2.8 + i / 3) % 1, x = z.x + (i - 1) * 9 + Math.sin(t * 5 + i) * 2;
    const sy = y - 12 - phase * 14;
    ctx.globalAlpha = 1 - phase;
    ctx.fillStyle = i % 2 ? '#f5c75e' : '#e76a3b';
    ctx.fillRect(x, sy, 2, 3);
  }
  ctx.restore();
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
function canPauseGame() {
  if (over || won || result || !hero || hero.hp <= 0) return false;
  if (window.TITLE && TITLE.blocks && TITLE.blocks()) return false;
  if (window.ROOM && ROOM.active && ROOM.active()) return false;
  if (window.CHAPTER2_INTRO && CHAPTER2_INTRO.active && CHAPTER2_INTRO.active()) return false;
  if (window.ROGUE && ROGUE.blocks && ROGUE.blocks()) return false;
  if (window.XIAOCHANG && XIAOCHANG.blocks && XIAOCHANG.blocks()) return false;
  if (chapter2Run && chapter2Run.mode !== 'fight' && chapter2Run.mode !== 'zj') return false;   // zj = 张角祭台战
  return true;
}
function clearPauseInputs() {
  for (const k in key) delete key[k];
  joy = null; jk.style.transform = '';
  pressAtk = false; pressRoll = false; attackPointer = null;
  if (hero) hero.q = 0;
  cancelCharge();
}
function restartPausedGame() {
  if (window.XIAOCHANG && XIAOCHANG.active()) {
    const r = XIAOCHANG.state(); if (r) XIAOCHANG.start({ chapter: r.chapter, floor: r.floor, wish: r.wish });
  } else if (chapter2Run) prepareChapter2Run(false);
  else reset();
}
function returnFromPausedGame(toHome = false) {
  const training = !!(window.XIAOCHANG && XIAOCHANG.active());
  const run = training && XIAOCHANG.state();
  const chapter = run ? run.chapter : chapter2Run ? 2 : 1;
  const view = training ? 'xiaochang' : 'campaign';
  if (toHome) { if (window.TITLE && TITLE.show) TITLE.show(); else reset(); return; }
  reset();
  if (window.ROGUE) ROGUE.reset();
  if (window.TITLE && TITLE.openPreparation) TITLE.openPreparation({ chapter, view });
}
window.GAME_PAUSE = {
  canPause: canPauseGame,
  clearInput: clearPauseInputs,
  restart: restartPausedGame,
  returnPreparation: () => returnFromPausedGame(false),
  returnHome: () => returnFromPausedGame(true),
};
// 主循环：某一帧出错也不让整个游戏卡死（以前一处报错就会冻住画面、人物消失）；错误记下来给调试面板看
function reportErr(e) { const s = String(e && e.stack || e).split('\n'); window.WZB_ERR = (s[0] + ' ' + (s[1] || '').trim()).slice(0, 160); if (!reportErr.n) { reportErr.n = 1; console.error(e); } }
function loop(t) { if (t - last < 1000 / 62) { requestAnimationFrame(loop); return; }   // 60 帧上限：高刷屏不多算，省电
  const dt = Math.min(.033, (t - last) / 1000); last = t; try { update(dt); } catch (e) { reportErr(e); } try { draw(); } catch (e) { reportErr(e); try { ctx.restore(); } catch (_) {} } requestAnimationFrame(loop); }
if (window.ROGUE) ROGUE.reset(); reset(); ui(); requestAnimationFrame(loop);
