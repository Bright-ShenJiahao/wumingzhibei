// 无名之辈·序章 幻想三国录 —— 宽地面清版
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const IMG = {};
// 图片排队下载（用户定：别一打开就同时开几十个下载把网速占满）：同时最多 4 张，下完一张再开下一张
const LOADQ = []; let loadingN = 0;
function pumpLoad() { while (loadingN < 4 && LOADQ.length) { const [i, src] = LOADQ.shift(); if (i.src) continue; loadingN++; const done = () => { loadingN--; pumpLoad(); }; i.addEventListener('load', done, { once: true }); i.addEventListener('error', done, { once: true }); i.src = src; } }
function promoteLoad(img) { if (img.src) return; const i = LOADQ.findIndex(q => q[0] === img); if (i > 0) LOADQ.unshift(LOADQ.splice(i, 1)[0]); }   // 画面上要用到但还在排队的图：插到队首
function flushLoads() { while (LOADQ.length) { const [i, src] = LOADQ.shift(); if (!i.src) i.src = src; } }   // 开打了：剩下的图全部开始下（不再限速）
function load(k, src) { const i = new Image(); IMG[k] = i; if (!src || String(src).startsWith('data:')) { i.src = src; return i; } const pri = k.startsWith('hero_') ? 2 : k.startsWith('grunt_') || k.startsWith('blade_') || k.startsWith('slinger_') || k.startsWith('archer_') || k.startsWith('elite_') || k.startsWith('priest_') ? 1 : 0; i._pri = pri; i._must = pri === 2;   // 排队优先级：主角 > 第一章敌人 > 其他
  i.src = src; LAZY.core.push([i, src]); return i; }   // 用户定 2026-10-31：取消分批下载，打开就全部开始下（失败会自动重试）
// 按需加载：第二章、校场的图片先不下载，进入（或整备页预取）时才开始，首次打开少下载约2MB。
const LAZY = { chapter2: [], xiaochang: [], core: [] }, LAZY_DONE = {};   // core：打开就要的图（第一章等），进战斗前必须全部下完
const LAZY_CHARS = { yellow_heavy: 'chapter2', yellow_shield: 'chapter2', yellow_spear: 'chapter2', yellow_catapult: 'chapter2', zhang_liang: 'chapter2', zhang_bao: 'chapter2', yellow_golem: 'chapter2', zhang_jiao: 'chapter2' };
function lazyLoad(group, k, src) { const i = new Image(); IMG[k] = i; LAZY[group].push([i, src]); return i; }
function ensureAssets(group, { silent = false, label = '' } = {}) {
  const list = LAZY[group] || [];
  if(!LAZY_DONE[group]) LAZY_DONE[group]=Promise.all(list.map(([img,src])=>new Promise(ok=>{
    if(img.complete&&img.naturalWidth){ok();return;}
    // 下载失败自动重试 3 次（手机网络抖动），还不行再放行，画面上用到时 drawImage 会继续重试
    let n=0;const fail=()=>{if(n++<3||(img._must&&n<10))setTimeout(()=>{img.addEventListener('error',fail,{once:true});img.src=src+(src.includes('?')?'&':'?')+'retry='+n;},n>3?1500:600);else ok();};   // 主角的图（_must）多试几次（约 15 秒）；真下不来也放行，画面上缺的帧用已下好的顶上，不会卡在载入页
    img.addEventListener('load',ok,{once:true});img.addEventListener('error',fail,{once:true});
    if(!img.src)img.src=src;else if(img.complete&&!img.naturalWidth)fail();
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
    { f: ['staff_1a', 'staff_1b'], d: [.13, .19], dmg: 1.0, kb: 52, daze: .15 },   /* 用户定 10/31：棍控制降低，晕 0.8 秒 */                   // 劈：举棍过顶 → 砸下
    { f: ['staff_2a', 'staff_2b'], d: [.11, .19], dmg: 1.0, kb: 46, daze: .25 },                  // 扫：低身搂扫
    { f: ['staff_3a', 'staff_3b'], d: [.16, .25], dmg: 1.2, kb: 150, daze: 0, multi: true, knock: true },   // 回身扫：只击倒，不再必晕（用户定 10/31）
    { f: ['staffp_a', 'staffp_b'], d: [.10, .24], dmg: 2.0, kb: 90, daze: .5, thrust: true },          // 戳：50% 晕（用户定 10/31）
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
    { f: ['stone_1a', 'stone_1b'], d: [.0945, .2205], dmg: .9, kb: 40, spd: 230, life: .78 },      // 左手扔（射程约 179）
    { f: ['stone_2a', 'stone_2b'], d: [.0945, .2205], dmg: .9, kb: 40, spd: 230, life: .78 },      // 右手扔（射程约 179）
    { f: ['stone_3a', 'stone_3b', 'stone_3c'], d: [.189, .0735, .294], dmg: 1.6, kb: 70, spd: 310, life: .8, noPierce: true, dazeChance: .5, dazeTime: .5, daze: 1 },   // 全力投：命中即停、50% 晕 0.5 秒（用户定 10/31）
  ] },
  bow: { name: '汉弓', class: 'ranged', proj: true, move: 1, snd: 'staff', combo: [
    { f: ['bow_1a', 'bow_1b'], d: [.20, .26], dmg: 1.15, kb: 38, spd: 330, life: 1.05 },
    { f: ['bow_2a', 'bow_2b'], d: [.18, .26], dmg: 1.15, kb: 38, spd: 340, life: 1.08 },
    { f: ['bow_3a', 'bow_3b'], d: [.22, .30], dmg: .75, kb: 75, spd: 390, life: 1.15 },
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
// 第二章兵种的专属行为（盾阵、技能、首领特效）：第二章战役或第二章校场都开
function ch2Troops() { return !!chapter2Run || !!(window.XIAOCHANG && XIAOCHANG.active() && XIAOCHANG.state() && XIAOCHANG.state().chapter === 2); }
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
  if (window.GOODS) GOODS.reset();   // 商店带进来的消耗品：开打第一帧才扣
  if (!(window.TITLE && TITLE.blocks && TITLE.blocks())) flushLoads();   // 进了战斗就不再限速下图
  if (window.SFX && SFX.preloadVoices) setTimeout(() => { if (!(window.TITLE && TITLE.blocks && TITLE.blocks())) { flushLoads(); SFX.preloadVoices(['intro', 'guanhai_']); } }, 300);   // 第一章语音开局后慢慢下   // 神器：每局重新踩上飞剑、打落次数清零
  if (window.BRAWL) BRAWL.reset(); atkHeldSince = 0; charging = false; chargeTier = 0; chargeTierFlash = 0; chargeFx = []; chargeHitFx = []; deathLandedAt = null; enemiesCelebrating = false;
  comboCount = 0; comboExpireAt = 0; comboNotices = [];
  arenaL = null; boardSent = false; runBonus = 0;
  hero = { x: 60, y: (M.top + M.bot) / 2, f: 1, hp: 10, st: 'idle', t: 0, inv: 0, rollCd: 0, atk: null, q: 0, combo: 0, comboWin: 0, lastHit: -9, lastHitC: -1, lastShotC: 0, vx: 0, ix: 0, iy: 0 };
  if (window.GEAR) { GEAR.reset(); hero.hp = maxHeroHp(); }
  if (window.BOWAMMO) BOWAMMO.reset();
  enemySkillFx = []; zs = []; shots = []; eshots = []; fires = []; props = []; propFx = []; drops = []; floaters = []; villagers = []; villagersStarted = false; villagersRewarded = false; villagersThanksT = -1; reviveUsed = false; revives = 0; extraDone = false; catapults = []; gearSpins = []; window.__siegeFreed = false; allyShots = []; allyFires = []; stoneHits = []; bluntHits = []; bleedFx = []; hammerFx = []; bladeFx = []; bowFx = []; cam = { x: 0, y: 0 }; gateI = 0; lockR = Infinity; kills = 0; freeze = 0; shake = 0; over = false; won = false; if (window.Boss) Boss.reset();
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
  return base * (window.GEAR ? GEAR.chargeScale() : 1) * (window.ROGUE && ROGUE.chargeScale ? ROGUE.chargeScale() : 1) * (window.MERIDIAN ? MERIDIAN.x('chargeMul', 1) : 1) * (window.GOODS ? GOODS.chargeMul() : 1);
}
function chargeGateMs() { return CHARGE_MS * (window.GEAR ? GEAR.chargeScale() : 1) * (window.ROGUE && ROGUE.chargeScale ? ROGUE.chargeScale() : 1) * (window.MERIDIAN ? MERIDIAN.x('chargeMul', 1) : 1) * (window.GOODS ? GOODS.chargeMul() : 1); }
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
  if (e.code === 'KeyL' && !e.repeat && window.BRAWL) BRAWL.press();   // 保险技（用户定 10/31）
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
{ const bD = document.getElementById('bDesp'); if (bD) bD.addEventListener('pointerdown', e => { e.preventDefault(); if (window.BRAWL) BRAWL.press(); }); }
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
  if (window.XIAOCHANG && XIAOCHANG.lockedWeapon && XIAOCHANG.lockedWeapon() && w !== XIAOCHANG.lockedWeapon()) { toast('心魔试炼只能用一把武器'); return; }
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
  const priority=ch2Troops()&&zs.filter(o=>!o.dead&&o.type==='yellow-heavy'&&o.hp<o.T.hp&&Math.abs(o.x-z.x)<=170&&Math.abs(o.y-z.y)<=80).sort((a,b)=>a.hp/a.T.hp-b.hp/b.T.hp)[0];
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
  // 用户定 2026-10-31：取消「草垛后的伏兵」（藏着不能被打，出过打不死的 bug），装死的兵就躺在路边睡觉，看得见、打得到
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
    zs.forEach(z => { if (z.st === 'sleep') { set(z, 'wake'); z.t = 0; z.hidden = false; sfx('wake', z.x); } });
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
        zs.forEach(z => { if (z.st === 'sleep') { set(z, 'wake'); z.t = 0; z.hidden = false; sfx('wake', z.x); } });   // 尸体一起站起来
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

// → 已拆到 js/g_chapter2_flow.js
// → 已拆到 js/g_combat_hit.js
// → 已拆到 js/g_hero_update.js
// → 已拆到 js/g_world_items.js
// → 已拆到 js/g_hero_attack.js
// → 已拆到 js/g_enemy_ai.js
// → 已拆到 js/g_projectiles.js
let gameT = 0;
let arenaL = null;
let boardSent = false;   // 本局成绩是否已提交到英雄榜
const debugRun0 = () => /[?&]debug(?:=|&|$)/.test(location.search);
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
let coreHold = false, coreAsked = false;
function update(dt) {
  // 用户定：别边玩边下图（会出现隐身敌人、卡顿）——离开标题后先把本章图片全部下完，显示加载进度，再开打
  if (!coreAsked && !(window.TITLE && TITLE.blocks && TITLE.blocks())) { coreAsked = true; if (LAZY.core.some(([i]) => !(i.complete && i.naturalWidth))) { coreHold = true; flushLoads(); ensureAssets('core', { label: '正在载入战场' }).then(() => { coreHold = false; }); } }
  if (coreHold) return;
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
  if (window.GOODS && !over && !won) GOODS.tick();
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
    for (const z of zs) if (z.dead && !z.air && !z.T.boss && !z.T.siege && z.st !== 'land' && z.st !== 'gone') { z.st = 'land'; z.t = 0; }   // 不会被击飞的（首领、力士）死了也要倒地后消失
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
    if (won && !debugRun0() && window.WALLET && WALLET.bonus) { const first = !(window.TITLE && TITLE.hasCleared && TITLE.hasCleared(chapter2Run ? 2 : 1)); WALLET.bonus((chapter2Run ? 120 : 60) + (first ? 300 : 0)); }   // 通关奖励（用户定金币经济）：每次通关 +60/+120，首通再 +300
    if (window.WALLET) WALLET.flush();
    const debugRun = /[?&]debug(?:=|&|$)/.test(location.search);   // 开发者模式：不记录成绩
    if (window.ARMORY) ARMORY.markPlayed();
    if (won && !debugRun && window.TITLE && TITLE.markCleared) TITLE.markCleared(chapter2Run ? 2 : 1);
    if (won && chapter2Run && window.ARTIFACT && ARTIFACT.grant('feijian')) result.line = '张角遗下「太平飞剑」！已收入神器栏。';   // 第二章通关奖励（首次）   // 第二章通关记第二章，不再误记成第一章
    if (won && !debugRun && !noviceMode() && window.MERIDIAN && MERIDIAN.award(chapter2Run ? 'ch2' : 'ch1')) result.line += ' 困难首通，获得通脉丹 ×1（经脉）。';
    if (!boardSent && !debugRun) {   // 用户定：两章都上报，榜上按总积分排   // 英雄榜目前只统计第一章；第二章成绩另行设计   // 通关或者阵亡都上报（失败不影响游戏）
      boardSent = true;
      if (window.BOARD) {
        const nm = (window.TITLE && TITLE.playerName && TITLE.playerName()) || '';
        BOARD.submit({ name: nm, kills, t: Math.round(endT), zone: chapter2Run ? [1, 1, 2, 3, 4, 4, 5][chapter2Run.battle || 1] : zoneNow, win: !!won, hits: hitsTaken, bonus: runBonus, diff: hardMode() ? 'hard' : 'easy', revives, ch: chapter2Run ? 2 : 1 });   // 第二章：战一~三 = 区域 1~3，张梁或张宝 = 4，张角 = 5，通关按 6 算
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
// 下载失败的图片（broken）一画就报错，会让这一帧后面的东西（包括主角）全部画不出来 → 统一拦下：不画，并自动重试下载
{ const _di = CanvasRenderingContext2D.prototype.drawImage; CanvasRenderingContext2D.prototype.drawImage = function (img, ...a) { if (img instanceof HTMLImageElement && (!img.complete || !img.naturalWidth)) { if (img.src && img.complete && typeof retryImg === 'function') retryImg(img); return; } return _di.call(this, img, ...a); }; }
function retryImg(img) { const now = performance.now(); if ((img._tries || 0) >= 8 || now - (img._at || 0) < 1500) return; img._at = now; img._tries = (img._tries || 0) + 1; const base = img.src.replace(/([?&])retry=\d+/, ''); img.src = base + (base.includes('?') ? '&' : '?') + 'retry=' + img._tries; }
function drawChar(name, f, x, y, flip, alpha = 1, white = false, sc = 1, dark = false) {
  let fr = CH[name] && CH[name][f]; if (!fr) return;
  // 时装换色后主角的帧是 canvas（没有 src）：以前这里当成「还没开始下载」直接跳过，买了时装颜色的玩家人物整个隐形（用户报 果汁、柴业政）
  if (fr.img instanceof HTMLImageElement && !fr.img.src) { promoteLoad(fr.img); return; }
  // 图片下载失败（手机/微信网络抖一下）以前就永远不显示，人物直接隐形：现在自动重试，主角这期间先用别的已下好的帧顶上
  if (fr.img.complete && !fr.img.naturalWidth) { retryImg(fr.img); if (name !== 'hero') return; const alt = Object.values(CH.hero).find(o => o.img.complete && o.img.naturalWidth); if (!alt) return; fr = alt; }
  if (!fr.img.complete) return;
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
  if (window.CH2B && ch2Troops()) CH2B.draw();
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
// 结算画面已拆到 js/result_screen.js
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
// → 已拆到 js/g_world_draw.js
let DPR = 1;
function fit() {
  const vv = window.visualViewport, w = vv ? vv.width : innerWidth, h = vv ? vv.height : innerHeight;
  DPR = Math.min(window.LOWFX ? 1 : 2, window.devicePixelRatio || 1);   // 低配模式：不再按 2 倍清晰度画
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
    const r = XIAOCHANG.state(); if (r) XIAOCHANG.start({ chapter: r.chapter, floor: r.floor, wish: r.wish, xinmo: r.xinmo || '' });
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
// 用户定：手机跑不动就自动转低配——战斗中统计 150 帧，平均低于约 40 帧就降到 30 帧、1 倍清晰度、减少粒子
let perfN = 0, perfSum = 0;
try { if (localStorage.getItem('wzb-lowfx') === '1') window.LOWFX = true; } catch (e) {}
function perfCheck(gap) {
  if (window.LOWFX || perfN >= 150 || !hero || (window.TITLE && TITLE.blocks && TITLE.blocks()) || result || gap > 250) return;
  perfN++; perfSum += gap;
  if (perfN === 150 && perfSum / 150 > 25) { window.LOWFX = true; try { localStorage.setItem('wzb-lowfx', '1'); } catch (e) {} fit(); toastMsg = '已自动切换到流畅模式'; toastT = 3; }
}
function loop(t) { if (t - last < 1000 / (window.LOWFX ? 31 : 62)) { requestAnimationFrame(loop); return; }   // 60 帧上限（低配 30）：高刷屏不多算，省电
  perfCheck(t - last);
  if (window.LOWFX && propFx.length > 120) propFx.splice(0, propFx.length - 120);
  const dt = Math.min(.033, (t - last) / 1000); last = t; try { update(dt); } catch (e) { reportErr(e); } try { draw(); } catch (e) { reportErr(e); try { ctx.restore(); } catch (_) {} } requestAnimationFrame(loop); }
if (window.ROGUE) ROGUE.reset(); reset(); ui(); requestAnimationFrame(loop);
