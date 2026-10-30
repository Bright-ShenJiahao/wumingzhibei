// 锦囊（新系统，用户定）：卡表在 js/tipbag.js 的 TIPBAG.CARDS；这里只放「已经做出效果」的卡（IMPL）。
// 每局第一次抽卡时建本局卡池：已锁定的卡（出征扣金币）+ 随机补到 20 张；三选一来自不同类别；
// 锁定的卡不按稀有度加权、保底出现；未锁的按 普通6 / 稀有3 / 传说1 加权。
// 将令（兵，主动技能）不进卡池：三选一时概率多出第 4 张（30%，没出现每次 +15%），拿了之后本局不再出现。
(() => {
  const S = {
    meleeDmg: 1, rangedDmg: 1, finMelee: 1, finRanged: 1,
    move: 1, aspd: 1, chargedDmg: 1, steady: 0,
    lifesteal: 0, shield: 0, scatter: 0,
    crit: 0, poison: 0, summon: 0, catapult: 0, fireAura: 0, split: 0, catapultFire: 4,
  };
  const DEFAULT = { ...S };
  const has = {};          // 本局已拿到的卡（按名字）
  let bing = '';            // 本局拿到的将令：wanjian / toushi / leiting
  // ---- 已实现的卡：名字 → 效果 ----
  const IMPL = {
    '直取要害': () => { S.crit += .05; },   // 看破：平时 +5%，打正在蓄力出招的敌人必暴击并打断
    '横扫千军': () => { S.split = 1; },
    '淬毒': () => { S.poison = 1; },
    '焚身': () => { S.fireAura = 1; auraStacks = 1; auraHold = 0; auraIdle = 0; },
    '护体': () => { S.shield = 1; },
    '饮血': () => { S.lifesteal = .5; },
    '避实': () => {}, '燎步': () => {}, '震慑': () => {}, '硬撼': () => {},
    '万箭齐发': () => { bing = 'wanjian'; S.summon = 1; },
    '霹雳飞石': () => { bing = 'toushi'; S.catapult = 1; S.catapultFire = 3; },
    '雷霆万钧': () => { bing = 'leiting'; },
    // ---- 第二批 ----
    '先声夺人': () => { vanguard = true; }, '一鼓作气': () => {}, '积羽沉舟': () => {}, '乘胜追击': () => {},
    '矢如连珠': () => {}, '声东击西': () => {}, '陷阵之志': () => {},
    '骤雨': () => {}, '破军': () => {}, '倒持': () => {}, '寸劲': () => {}, '回马': () => {},
    '明火': () => {}, '乘危': () => {},
    '解围': () => {}, '闪身': () => {}, '背水': () => {},
    '定海': () => {}, '崩山': () => {}, '飞蝗': () => {}, '血债': () => {}, '斩首': () => {}, '回矢': () => {},
    '草木皆兵': () => { bing = 'caomu'; }, '借我东风': () => { bing = 'xifeng'; }, '火烧连营': () => { bing = 'huoshao'; }, '水淹七军': () => { bing = 'shuiyan'; },
  };
  const WEIGHT = { n: 6, r: 3, l: 1 };
  function allCards() {
    const out = [];
    if (!window.TIPBAG) return out;
    for (const cat of TIPBAG.CATS) for (const c of TIPBAG.CARDS[cat.id] || []) {
      if (!IMPL[c[0]]) continue;
      out.push({ name: c[0], r: c[1], desc: c[2], trig: TIPBAG.trigOf ? TIPBAG.trigOf(c[0], cat.id) : '', weapon: c[3] || '', cat: cat.id, catName: cat.name, color: cat.color });
    }
    return out;
  }
  let pool = null, lockedNames = new Set(), seen = new Set(), bingChance = .3;
  let hoverI = -1;
  let open = false, offer = [], anim = 0, rects = [], rerollToken = false, rerollRect = null;
  let inputLockT = 0, shieldReady = false, shieldTimer = 10, skillCd = 0;
  let auraStacks = 0, auraHold = 0, auraIdle = 0;
  // 翻滚躲闪类
  let dodgeRollT = -1, finisherUntil = 0, finisherCd = 0, avoidUntil = 0, avoidCd = 0, avoidCrit = false;
  let thunder = [];
  // 第二批状态
  let vanguard = false, lastAlive = 0, momentum = 0, momentumIdle = 0, gale = 0, killCritUntil = 0;
  let rangedChain = { z: null, n: 0 }, volleyNext = false, stoneShots = 0, swing = { atk: null, n: 0 };
  let glowW = '', glowN = 0, glowIdle = 0, swapReady = false, swapPending = false, cunjin = false, cunjinNext = false;
  let backCd = 0, hurtAt = -9, guardShield = 0, guardShieldT = 0, sideUntil = 0, zhanUntil = 0, beng = [], fx = [];
  // 调试用锦囊统计：每张卡触发次数、造成伤害、回血
  const STATS = {};
  function stat(name, dmg = 0, trig = 1, heal = 0) { const o = STATS[name] ||= { trig: 0, dmg: 0, heal: 0 }; o.trig += trig; o.dmg += dmg || 0; o.heal += heal; }
  let leechFxT = 0, qiFxT = 0, avoidGhost = null;
  let rallyT = 0, jiyu = 0, ghosts = [], huifengNext = false, gustT = 0;
  let critCard = '';   // 锦囊给的必暴：下一次命中把暴击多出的伤害记到这张卡上（统计用）
  let windDir = 1, scarecrows = [], windT = 0, waters = [], spreadT = 0, ammoBackT = 0;
  const weaponNow = () => (typeof weapon !== 'undefined' ? weapon : '');
  const typeOf = traits => (traits && traits.gearToken && traits.gearToken.s && traits.gearToken.s.type) || weaponNow();
  const isBoss = z => !!(z && z.T && (z.T.boss || z.T.chapterBoss));
  const maxHp = () => (window.GEAR && GEAR.maxHp ? GEAR.maxHp() : 10);
  const lowHp = () => has['背水'] && typeof hero !== 'undefined' && hero.hp > 0 && hero.hp < maxHp() * .2;
  const pop = (x, y, txt, color, big) => { if (typeof floaters !== 'undefined') floaters.push({ x, y, t: 0, txt, color, big, gold: !color }); };
  const carried = () => { const A = window.ARMORY; if (!A || !A.equipped) return null; return ['long', 'short', 'ranged'].map(k => { try { const i = A.equipped(k); return i && i.type; } catch (e) { return null; } }).filter(Boolean); };
  const now = () => (typeof gameT !== 'undefined' ? gameT : performance.now() / 1000);

  function buildPool() {
    const own = carried();
    const cards = allCards().filter(c => c.cat !== 'bing' && (!c.weapon || !own || own.includes(c.weapon)));
    lockedNames = new Set();
    const locks = window.TIPBAG && TIPBAG.locks ? TIPBAG.locks().filter(x => IMPL[x.card[0]]) : [];
    locks.forEach(x => lockedNames.add(x.card[0]));   // 锁定已在面板里一次性付过钱
    const rest = cards.filter(c => !lockedNames.has(c.name));
    const picked = cards.filter(c => lockedNames.has(c.name));
    while (picked.length < 20 && rest.length) {
      const total = rest.reduce((a, c) => a + WEIGHT[c.r], 0);
      let r = Math.random() * total, k = rest.length - 1;
      for (let i = 0; i < rest.length; i++) { r -= WEIGHT[rest[i].r]; if (r <= 0) { k = i; break; } }
      picked.push(rest.splice(k, 1)[0]);
    }
    pool = picked; seen = new Set(); bingChance = .3;
  }
  const weightOf = c => (lockedNames.has(c.name) ? WEIGHT.n : WEIGHT[c.r]) * (c.weapon && c.weapon === weaponNow() ? 2 : 1);   // 兵刃：正在用的那把概率 ×2
  function pickN(list, n) {
    const out = [], p = list.slice();
    // 锁定的卡保底：还没出现过的先放一张进来
    const g = p.find(c => lockedNames.has(c.name) && !seen.has(c.name));
    if (g) { out.push(g); p.splice(p.indexOf(g), 1); }
    while (out.length < n && p.length) {
      const cats = out.map(c => c.cat), eligible = p.filter(c => !cats.includes(c.cat)), src = eligible.length ? eligible : p;
      const total = src.reduce((a, c) => a + weightOf(c), 0);
      let r = Math.random() * total, c = src[src.length - 1];
      for (const v of src) { r -= weightOf(v); if (r <= 0) { c = v; break; } }
      out.push(c); p.splice(p.indexOf(c), 1);
    }
    return out.sort(() => Math.random() - .5);
  }
  const setOpen = value => { open = value; document.body.classList.toggle('wzb-rogue', open); };
  const SKILL_NAME = { wanjian: '万箭齐发', toushi: '霹雳飞石', leiting: '雷霆万钧', caomu: '草木皆兵', xifeng: '借我东风', huoshao: '火烧连营', shuiyan: '水淹七军' };
  function updateSkillButton() {
    document.body.classList.toggle('wzb-summon', !!bing);
    document.body.classList.remove('wzb-catapult');
    const b = document.getElementById('bSkill');
    if (b && bing) {
      b.textContent = skillCd > 0 ? `${SKILL_NAME[bing]} · ${Math.ceil(skillCd)}s` : SKILL_NAME[bing];
      b.disabled = skillCd > 0; b.style.opacity = b.disabled ? '.52' : '1';
    }
  }
  function offerCards() {
    if (!pool) buildPool();
    const avail = pool.filter(c => !has[c.name] && (!window.XIAOCHANG || XIAOCHANG.cardAllowed({ school: c.catName })));
    offer = pickN(avail, 3);
    offer.forEach(c => seen.add(c.name));
    if (!bing) {
      const bings = allCards().filter(c => c.cat === 'bing' && !seen.has('bing:' + c.name));
      if (bings.length && Math.random() < bingChance) {
        const c = bings[Math.floor(Math.random() * bings.length)];
        seen.add('bing:' + c.name); offer.push({ ...c, isBing: true }); bingChance = .3;
      } else bingChance = Math.min(1, bingChance + .15);
    }
    anim = 0; setOpen(offer.length > 0); inputLockT = performance.now() + 350;
    try { if (typeof joy !== 'undefined' && joy) joy = null; } catch (_) {}
  }
  function choose(i) {
    if (!open || i < 0 || i >= offer.length) return;
    const c = offer[i]; if (has[c.name]) return;
    has[c.name] = 1; IMPL[c.name](); setOpen(false); skillCd = 0; updateSkillButton();
    if (typeof toast === 'function') toast('锦囊：' + c.name);
    if (typeof say === 'function') say('获得「' + c.name + '」—— ' + c.desc, 3);
  }
  function useSkill() {
    if (!bing || skillCd > 0) return '';
    skillCd = (window.GEAR ? (GEAR.refreshSkill() ? 0 : GEAR.skillCd()) : 30) * (window.MERIDIAN ? MERIDIAN.x('skillCd', 1) : 1); updateSkillButton(); stat(SKILL_NAME[bing], 0, 1);
    if (bing === 'wanjian') { castRain(); return 'rain'; }
    if (bing === 'leiting') castThunder();
    else if (bing === 'caomu') castScarecrows();
    else if (bing === 'xifeng') { windT = 8; gustT = 0; windDir = hero.f || 1; if (typeof say === 'function') say('借我东风！', 1.4); }
    else if (bing === 'huoshao') castFire();
    else if (bing === 'shuiyan') castWater();
    return bing;
  }
  // 旧接口保留（game.js 的按键/按钮还在调用）
  function useSummon() { return bing === 'wanjian' && useSkill() === 'wanjian'; }
  function useCatapult() { return bing === 'toushi' && useSkill() === 'toushi'; }
  function absorbHit() {
    if (guardShield > 0) { guardShield = 0; stat('解围', 0, 0); fx.push({ k: 'shieldBreak', t: 0, T: .3 }); pop(hero.x, hero.y - 44, '挡！', '#ffe08a'); return true; }
    if (!S.shield || !shieldReady) return false;
    fx.push({ k: 'shieldBreak', t: 0, T: .3 });
    shieldReady = false; shieldTimer = 10; stat('护体');
    if (typeof toast === 'function') toast('护体挡下了攻击！');
    return true;
  }
  // ---- 雷霆万钧：屏幕内落 6 道天雷，优先劈人多的地方 ----
  // 万箭齐发（改成箭雨）：身后弓手阵往敌群上空齐射，3 秒内约 42 支箭落在敌人最密的一片（宽 140），每支 0.9 伤害（半径约 16），同一敌人一次最多中 8 支
  let rain = null, rainArrows = [];
  function castRain() {
    const c = cluster(60); rain = { x: c.x, y: c.y, t: 0, acc: 0, hits: new Map() };
    if (typeof sfx === 'function') sfx('sling', hero.x); if (typeof say === 'function') say('万箭齐发！', 1.2);
  }
  function updateRain(dt) {
    if (rain) {
      rain.t += dt; rain.acc += dt * 14;
      // 箭雨跟着敌群慢慢挪（目标走开也能追上一点）
      if (rain.t > .5) { const c = cluster(60); rain.x += (c.x - rain.x) * Math.min(1, dt * 1.5); rain.y += (c.y - rain.y) * Math.min(1, dt * 1.5); }
      while (rain.acc >= 1 && rain.t > .4) { rain.acc--; const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()); rainArrows.push({ x: rain.x + Math.cos(a) * 60 * r, y: rain.y + Math.sin(a) * 18 * r, t: 0, hit: false }); }
      if (rain.t > 3.4) rain = null;
    }
    for (const a of rainArrows) {
      a.t += dt;
      if (a.t >= .25 && !a.hit) {
        a.hit = true;
        for (const z of zs) if (!z.dead && !z.air && Math.abs(z.x - a.x) < 16 && Math.abs(z.y - a.y) < 12) { const H = (rain && rain.hits) || new Map(), n = H.get(z) || 0; if (n >= 8) continue; H.set(z, n + 1); stat('万箭齐发', .9, 0); hit(z, .9, 10, Math.sign(z.x - hero.x) || 1, false, 0, .15, false, false, { secondary: true }); }
      }
    }
    rainArrows = rainArrows.filter(a => a.t < 1.2);
  }
  function drawRain() {
    if (rain && rain.t < 3.4) { ctx.save(); ctx.globalAlpha = .35 * Math.min(1, rain.t * 3); ctx.strokeStyle = '#ffe6a0'; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.ellipse(rain.x, rain.y, 70, 20, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    for (const a of rainArrows) {
      ctx.save();
      if (a.t < .25) { const p = a.t / .25, hy = a.y - 160 * (1 - p); ctx.strokeStyle = '#4a3420'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(a.x - 4, hy - 14); ctx.lineTo(a.x, hy); ctx.stroke(); ctx.fillStyle = '#cfd6dc'; ctx.fillRect(a.x - 1, hy - 1, 2, 2); }
      else { ctx.globalAlpha = Math.max(0, 1 - (a.t - .8) / .4); ctx.strokeStyle = '#4a3420'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(a.x - 3, a.y - 9); ctx.lineTo(a.x, a.y); ctx.stroke(); ctx.fillStyle = '#e8e0cc'; ctx.fillRect(a.x - 4, a.y - 10, 2, 2); }   // 插在地上的箭
      ctx.restore();
    }
  }
  function castThunder() {   // 雷霆万钧：4 道雷，每道落地后连劈 3 下，每下跳到附近另一个敌人身上（每下 2 伤害）
    const c = cluster(60);
    const cnt = new Map();   // 用户定：主动技能是清场用的，同一个敌人这一招最多挨 2 下雷（单体最多 6）
    for (let i = 0; i < 4; i++) thunder.push({ x: c.x + rnd(-30, 30), y: c.y + rnd(-10, 10), t: -i * .3 - .35, hit: false, hops: 4, done: [], cnt });
    if (typeof say === 'function') say('雷霆万钧！', 1.4);
  }
  function updateThunder(dt) {
    for (const b of thunder) {
      b.t += dt;
      if (b.t >= 0 && !b.hit) {
        b.hit = true; shake = Math.max(shake, .22);
        if (typeof sfx === 'function') sfx('finisher', b.x);
        for (const z of zs) if (!z.dead && !z.air && Math.abs(z.x - b.x) < 26 && Math.abs(z.y - b.y) < 13 && (b.cnt.get(z) || 0) < 2) { b.cnt.set(z, (b.cnt.get(z) || 0) + 1); rogueHitFull(z, 3, Math.sign(z.x - b.x) || 1); b.done.push(z); stat('雷霆万钧', 3, 0); }
        // 跳到下一个目标：最近的、还没被这道雷劈过的敌人；没有就在附近乱劈
        if (--b.hops > 0) {
          const n = zs.filter(z => !z.dead && !z.air && !b.done.includes(z) && (b.cnt.get(z) || 0) < 2 && Math.hypot(z.x - b.x, z.y - b.y) < 110).sort((a, c) => Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(c.x - b.x, c.y - b.y))[0];
          if (n) thunder.push({ x: n.x, y: n.y, t: -.28, hit: false, hops: b.hops, done: b.done, cnt: b.cnt, from: { x: b.x, y: b.y } });   // 没有新目标就不再乱劈
        }
      }
    }
    thunder = thunder.filter(b => b.t < .45);
  }
  const im = k => { const i = typeof IMG !== 'undefined' && IMG['ui_' + k]; return i && i.complete && i.naturalWidth ? i : null; };
  function drawImg(k, x, y, w, alpha = 1, flip = false) { const i = im(k); if (!i) return false; const h = w * i.height / i.width; ctx.save(); ctx.imageSmoothingEnabled = true; ctx.globalAlpha *= alpha; ctx.translate(x, y); if (flip) ctx.scale(-1, 1); ctx.drawImage(i, -w / 2, -h, w, h); ctx.restore(); return true; }
  function drawWorld() {
    if (typeof ctx === 'undefined') return;
    drawRain();
    const T = performance.now() / 1000;
    ctx.save();
    for (const w of waters) for (const v of w.waves) { const p = Math.abs(v.x - v.x0) / 320; drawImg(p < .7 ? 'tip_wave1' : 'tip_wave2', v.x, v.y + 6, 64, Math.min(1, (1 - p) * 3), w.dir < 0); }   // 海浪：一道道往前冲
    for (const s of scarecrows) { const k = s.boom != null ? (s.boom < .25 ? 'tip_scare_break1' : 'tip_scare_break2') : s.hitT > 0 ? 'tip_scare_hit' : 'tip_scare'; if (!drawImg(k, s.x, s.y + 2, 30)) { ctx.fillStyle = '#c9a050'; ctx.fillRect(s.x - 2, s.y - 26, 4, 26); } }
    if (windT > 0) { const a = Math.min(1, windT / .5) * .8; for (let i = 0; i < 4; i++) { const px = ((T * 160 + i * 140) % (viewW() + 120)) - 60; drawImg('tip_wind' + (1 + Math.floor(T * 6 + i) % 3), windDir > 0 ? cam.x + px : cam.x + viewW() - px, M.top + 30 + i * 32, 90, a, windDir < 0); } }
    if (guardShield > 0 || (S.shield && shieldReady)) drawImg('tip_shield', hero.x, hero.y + 4, 22, .55 + .15 * Math.sin(T * 4));
    for (const f of fx) {
      if (f.k === 'shieldBreak') drawImg(f.t < .15 ? 'tip_shield_break1' : 'tip_shield_break2', hero.x, hero.y + 4, 28, 1 - f.t / f.T);
      if (f.k === 'ring') { ctx.save(); ctx.globalAlpha = 1 - f.t / f.T; ctx.strokeStyle = '#ffe3a0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (.4 + .6 * f.t / f.T), f.r * .4 * (.4 + .6 * f.t / f.T), 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
      if (f.k === 'leech' && f.t > 0) { const p = f.t / f.T; ctx.fillStyle = 'rgba(230,40,40,' + (1 - p * .5) + ')'; ctx.fillRect(f.x + (hero.x - f.x) * p - 1, f.y + (hero.y - 16 - f.y) * p - Math.sin(p * Math.PI) * 10 - 1, 2.5, 2.5); }
      if (f.k === 'darkArrow') { const p = Math.min(1, f.t / f.T); drawImg('tip_arrow', f.x + (f.z.x - f.x) * p, f.y + 6, 50, 1, f.dir < 0); }
      if (f.k === 'bounce') { const p = Math.min(1, f.t / f.T); ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.arc(f.x0 + (f.z.x - f.x0) * p, f.y0 + (f.z.y - 10 - f.y0) * p - Math.sin(p * Math.PI) * 14, 2, 0, Math.PI * 2); ctx.fill(); }
    }
    // 着火的敌人：身上小火苗
    for (const z of zs) if (!z.dead && z.burnT > 0) { ctx.fillStyle = 'rgba(255,' + (120 + Math.floor(60 * Math.sin(T * 12))) + ',40,.75)'; ctx.beginPath(); ctx.ellipse(z.x, z.y - 16 - Math.sin(T * 9) * 2, 3, 6, 0, 0, Math.PI * 2); ctx.fill(); }
    // 一鼓作气 / 骤雨叠层：脚下光圈；倒持就绪：金色描边光；背水：红气
    const lv = Math.max(momentum / 10, gale / 5);
    if (lv > .05) { ctx.globalAlpha = .25 + .5 * lv; ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(hero.x, hero.y, 12 + 6 * lv, 4 + 2 * lv, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    if (swapReady) {   // 倒持就绪：头顶闪「⇄」+ 手边金色火星（不用光圈，免得和护体护盾混）
      ctx.globalAlpha = .6 + .4 * Math.sin(T * 8); ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 2; ctx.strokeStyle = '#3a2410'; ctx.fillStyle = '#ffe08a';
      ctx.strokeText('⇄', hero.x, hero.y - 44); ctx.fillText('⇄', hero.x, hero.y - 44); ctx.textAlign = 'left';
      for (let i = 0; i < 3; i++) { ctx.fillStyle = '#ffd76a'; ctx.fillRect(hero.x + hero.f * (8 + Math.sin(T * 9 + i) * 4), hero.y - 18 - ((T * 40 + i * 7) % 14), 1.5, 1.5); }
      ctx.globalAlpha = 1; }
    // 战意（先声夺人）：身上金光
    if (rallyT > 0) { ctx.globalAlpha = .25 + .15 * Math.sin(T * 10); ctx.fillStyle = '#ffd36a'; ctx.beginPath(); ctx.ellipse(hero.x, hero.y - 14, 10, 18, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
    // 积羽沉舟：头顶 3 个小点
    if (has['积羽沉舟']) for (let i = 0; i < 3; i++) { ctx.fillStyle = i < jiyu ? '#ffd25a' : 'rgba(60,40,20,.7)'; ctx.fillRect(hero.x - 6 + i * 5, hero.y - 40, 3, 3); }
    // 避实：躲过时原地留下蓝色残影
    if (avoidGhost && typeof drawChar === 'function') { ctx.save(); ctx.globalAlpha = .5 * (1 - avoidGhost.t / .4); ctx.filter = 'sepia(1) hue-rotate(180deg) saturate(4)'; drawChar('hero', avoidGhost.fr, avoidGhost.x, avoidGhost.y, avoidGhost.f < 0, 1); ctx.restore(); }
    // 乘胜追击就绪：武器位置金光闪烁；寸劲就绪且在蓄力：脚下金圈
    if (killCritUntil > now()) { ctx.globalAlpha = .6 + .4 * Math.sin(T * 14); ctx.fillStyle = '#ffe27a'; for (let i = 0; i < 4; i++) ctx.fillRect(hero.x + hero.f * (10 + i * 3), hero.y - 20 - i * 2, 2, 2); ctx.globalAlpha = 1; }
    if (cunjin && has['寸劲'] && typeof charging !== 'undefined' && charging) { ctx.strokeStyle = '#ffd25a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(hero.x, hero.y, 15, 5, 0, 0, Math.PI * 2); ctx.stroke(); }
    // 回马残影
    for (const g of ghosts) {   // 回马：只画一道武器残影（淡青），朝身后扫过去
      const W = WEAP[g.w] || {}, reach = (W.reach || 30) + 10, u = Math.min(1, g.t / .18), a = .7 * (1 - g.t / .45);
      ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.strokeStyle = '#bff4ff'; ctx.shadowColor = '#6fe0ff'; ctx.shadowBlur = 8; ctx.lineCap = 'round';
      const cx = g.x, cy = g.y - 18;
      if (W.class === 'ranged') { const x = cx + g.f * reach * 2 * u; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - g.f * 14, cy); ctx.lineTo(x, cy); ctx.stroke(); }
      else { const a0 = -1.1, a1 = 1.0, ang = a0 + (a1 - a0) * u; ctx.lineWidth = g.w === 'hammer' ? 5 : 3;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + g.f * Math.cos(ang) * reach, cy + Math.sin(ang) * reach * .55); ctx.stroke();
        ctx.globalAlpha *= .45; ctx.lineWidth = 7; ctx.beginPath(); ctx.ellipse(cx, cy, reach, reach * .55, 0, g.f > 0 ? a0 : Math.PI - ang, g.f > 0 ? ang : Math.PI - a0); ctx.stroke(); }
      ctx.restore();
    }
    if (lowHp()) { for (let i = 0; i < 3; i++) { ctx.globalAlpha = .35; ctx.fillStyle = '#ff3a2a'; ctx.beginPath(); ctx.ellipse(hero.x + Math.sin(T * 5 + i * 2) * 7, hero.y - 10 - ((T * 30 + i * 11) % 30), 2.5, 5, 0, 0, Math.PI * 2); ctx.fill(); } ctx.globalAlpha = 1; }
    ctx.restore();
    if (!thunder.length) return;
    ctx.save();
    for (const b of thunder) {
      if (b.t < 0) { // 预警圈
        const a = Math.min(1, (b.t + .6) / .6);
        ctx.globalAlpha = .25 + .35 * a; ctx.strokeStyle = '#eaf4ff'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(b.x, b.y, 22, 9, 0, 0, Math.PI * 2); ctx.stroke();
        continue;
      }
      const a = 1 - b.t / .45; ctx.globalAlpha = a;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.2; ctx.shadowColor = '#bfe0ff'; ctx.shadowBlur = 8;
      ctx.beginPath(); let x = b.x + rnd(-6, 6), y = b.y - 170; ctx.moveTo(x, y);
      while (y < b.y) { y += 18; x += rnd(-7, 7); ctx.lineTo(y >= b.y ? b.x : x, Math.min(y, b.y)); }
      ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,' + (.5 * a) + ')'; ctx.beginPath(); ctx.ellipse(b.x, b.y, 24 * (1 - a * .4), 9, 0, 0, Math.PI * 2); ctx.fill();
      if (b.from) { ctx.strokeStyle = '#dff0ff'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(b.from.x, b.from.y - 8); for (let k = 1; k <= 5; k++) ctx.lineTo(b.from.x + (b.x - b.from.x) * k / 5 + (k < 5 ? rnd(-5, 5) : 0), b.from.y - 8 + (b.y - b.from.y) * k / 5 + (k < 5 ? rnd(-6, 6) : 0)); ctx.stroke(); }   // 雷在地面上窜过去
    }
    ctx.restore();
  }
  // ---- 翻滚、受击、命中的挂钩（game.js 调用） ----
  function onRoll(x, y) {
    if (typeof hero !== 'undefined') hero.rollFrom = { x, y };
    if (has['解围'] && now() - hurtAt < 2) { hurtAt = -9; stat('解围'); shockwave(x, y, 55, .5, true, '解围'); guardShield = 1; guardShieldT = 3; pop(x, y - 48, '解围！', null, true); }
    if (has['燎步'] && typeof allyFires !== 'undefined') allyFires.push({ x, y, t: 2, r: 10, tick: 0, once: new Set(), dmg: .5, scale: .4 });   // 用户定：燎步的火要小
  }
  function onDodge(from, n, kind) {
    if (typeof hero === 'undefined' || hero.st !== 'roll') return;
    const rid = hero.rollId || 0; if (dodgeRollT === rid) return; dodgeRollT = rid;
    let fx = false;
    // 反戈：躲过蓄力攻击或技能，50% 让对方承受这招一半伤害
    const src = from && from.T ? from : from && from.source && from.source.T ? from.source : null;
    if (has['反戈'] && src && !src.dead && (kind === 'skill' || (n || 0) >= 2) && Math.random() < .5) {
      hit(src, (n || 2) * .5, 60, Math.sign(src.x - hero.x) || 1, false, 0, .35, true, false, { secondary: true });
      pop(src.x, src.y - 42, '反噬！', '#ff9a5a', true); fx = true;
    }
    if (has['回锋'] && finisherCd <= 0) { finisherUntil = now() + 3; finisherCd = 5; huifengNext = true; fx = true; if (typeof slowT !== 'undefined') slowT = Math.max(slowT, .4); pop(hero.x, hero.y - 52, '抓到了！', '#ffe08a', true); }   // 回锋：冷却 5 秒、0.4 秒慢动作，下一下终段 +50%
    if (has['避实'] && avoidCd <= 0) { avoidUntil = now() + 3; avoidCrit = true; avoidCd = 4; fx = true; avoidGhost = { x: hero.x, y: hero.y, f: hero.f, fr: typeof heroFrame === 'function' ? heroFrame(hero) : 'roll1', t: 0 }; }
    if (fx && typeof floaters !== 'undefined') floaters.push({ x: hero.x, y: hero.y - 44, t: 0, txt: '闪！', gold: true });
  }
  function takeFinisher() { if (swapPending) { swapPending = false; return 'swap'; } if (finisherUntil > now()) { finisherUntil = 0; return huifengNext ? (huifengNext = false, 'huifeng') : true; } return false; }
  function takeCrit() {
    if (avoidCrit && avoidUntil > now()) { avoidCrit = false; return true; }
    if (killCritUntil > now()) { killCritUntil = 0; stat('乘胜追击'); critCard = '乘胜追击'; pop(hero.x, hero.y - 52, '乘胜！', '#ffd25a', true); return true; }
    return false;
  }
  function onHit(z, dmg, traits, ranged) {
    if (critCard && !(traits && traits.dot)) { stat(critCard, dmg / 3, 0); critCard = ''; }   // 暴击约 ×1.5，多出的那部分算这张卡
    if (traits && (traits.dot || traits.secondary)) return dmg;
    const t = now(), type = typeOf(traits), charged = !!(traits && (traits.charged || traits.skyArrow || traits.halberdCharge || (traits.gearToken && traits.gearToken.charged)));
    const fin = !!(traits && traits.finisher);
    const mul = (n, k) => { const b = dmg; dmg *= k; stat(n, dmg - b); };   // 加伤并记统计
    if (has['震慑'] && z.flawUntil > t) mul('震慑', 1.25);
    if (windT > 0 && has['借我东风']) mul('借我东风', 1.2);
    if (window.SUPPLY && SUPPLY.drunk()) dmg *= SUPPLY.dmgMul();   // 杜康酒：伤害 +30%   // 风中敌人受到的伤害 +20%
    if (vanguard && has['先声夺人']) { vanguard = false; mul('先声夺人', 3); z.vanguardKnock = true; pop(z.x, z.y - 44, '先声夺人！', null, true); shockwave(z.x, z.y, 45, .5, true, '先声夺人'); }
    if (rallyT > 0 && has['先声夺人']) mul('先声夺人', 1.4);   // 战意：每波开头 4 秒伤害 +40%
    // 直取要害（看破）：打正在蓄力出招的敌人必暴击并打断
    if (has['直取要害'] && z.seenWind !== z.windId && (z.st === 'wind' || (z.enemySkill && z.enemySkill.phase === 'wind'))) {   // 同一次蓄力只看破一次（用户定）
      z.seenWind = z.windId; mul('直取要害', 1.3); pop(z.x, z.y - 46, '看破！', '#ffd25a', true);
      if (!isBoss(z)) { z.st = 'move'; z.tok = false; z.stun = Math.max(z.stun || 0, .5); if (z.enemySkill) z.enemySkill = null; }
    }
    if (has['一鼓作气']) { momentum = Math.min(10, momentum + 1); momentumIdle = 0; mul('一鼓作气', 1 + .015 * momentum); }
    if (has['骤雨']) { gale = Math.min(5, gale + 1); momentumIdle = 0; }
    if (has['积羽沉舟'] && !charged) { jiyu++; if (jiyu >= 3) { jiyu = 0; mul('积羽沉舟', 1.5); pop(z.x, z.y - 46, '沉舟！', '#ffd25a', true); if (!isBoss(z)) { z.daze = Math.max(z.daze || 0, .5); z.st = 'move'; z.tok = false; z.vx = (Math.sign(z.x - hero.x) || 1) * 90; } } }   // 不管打谁都累计，每第 3 下暴击、击退并晕 0.5 秒
    if (has['陷阵之志'] && !ranged && typeof hero !== 'undefined' && hero.atk) {
      if (swing.atk !== hero.atk) { swing.atk = hero.atk; swing.n = 0; }
      swing.n++; if (swing.n >= 2) mul('陷阵之志', 1 + .15 * Math.min(3, swing.n - 1));
      if (swing.n >= 4) z.vanguardKnock = true;
    }
    if (has['乘危'] && !charged && !fin && (z.daze > 0 || z.flawUntil > t || z.poisonT > 0 || z.burnT > 0)) {
      mul('乘危', 1.35); if (qiFxT <= t) { qiFxT = t + .5; pop(z.x, z.y - 42, '趁势', '#ff9a3a'); } if (z.daze > 0) z.daze += .5; if (z.flawUntil > t) z.flawUntil += .5; if (z.poisonT > 0) z.poisonT += .5; if (z.burnT > 0) z.burnT += .5;
    }
    if (lowHp()) mul('背水', 1.3);
    if (has['定海'] && type === 'staff' && z.daze > 0) mul('定海', 1.3);
    if (has['斩首'] && type === 'blade' && fin && zhanUntil > t) { zhanUntil = 0; mul('斩首', 1.5); pop(z.x, z.y - 48, '斩首！', '#ffd25a', true); }
    if (typeof hero !== 'undefined' && hero.atk && hero.atk.weak) { dmg *= .7; if (!hero.atk.statted) { hero.atk.statted = 1; stat('倒持', 0); } }
    if (has['寸劲'] && charged && !cunjin) { cunjin = true; stat('寸劲'); pop(hero.x, hero.y - 50, '寸劲', '#ffd25a'); }   // 这次蓄力打中 → 下一次蓄力 -30%
    if (has['倒持'] && !ranged) { if (glowW !== type) { glowW = type; glowN = 0; } glowN++; glowIdle = 0; if (glowN >= 5 && !swapReady) { swapReady = true; pop(hero.x, hero.y - 48, '可倒持', '#ffe08a'); } }
    if (ranged && !charged) {
      if (rangedChain.z === z) rangedChain.n++; else rangedChain = { z, n: 1 };
      if (has['矢如连珠'] && rangedChain.n >= 3) { rangedChain.n = 0; volleyNext = true; stat('矢如连珠'); }
      if (has['声东击西'] && Math.random() < .3) {
        const side = Math.sign(z.x - hero.x) || 1;
        fx.push({ k: 'darkArrow', z, x: z.x + side * 70, y: z.y - 14, t: 0, T: .18, dmg: dmg * .5, dir: -side }); stat('声东击西', dmg * .5);
      }
    }
    if (has['避实'] && avoidUntil > now()) {
      avoidUntil = 0; stat('避实', 0, 1, .5); pop(z.x, z.y - 48, '避实！', '#8fd0ff', true);
      if (!z.T.boss && !z.T.chapterBoss) { z.daze = Math.max(z.daze || 0, .8); z.st = 'move'; z.tok = false; }
      if (hero.hp < (window.GEAR ? GEAR.maxHp() : 10)) { hero.hp = Math.min(window.GEAR ? GEAR.maxHp() : 10, hero.hp + .5); floaters.push({ x: hero.x, y: hero.y - 46, t: 0, txt: '+0.5', color: '#8fe08a' }); }
    }
    // 饮血：吸血时红色光点飞回主角（gear_combat 里每 3 秒最多回一次血）
    if (has['饮血'] && leechFxT <= t) { leechFxT = t + 3; stat('饮血', 0, 1, 0);   /* 实际回血在 gear_combat 里按真回了多少记 */ for (let i = 0; i < 5; i++) fx.push({ k: 'leech', x: z.x + rnd(-6, 6), y: z.y - 16 + rnd(-6, 6), t: -i * .04, T: .45 }); }
    return dmg;
  }
  function afterHit(z, knocked, traits, dmg, ranged) {
    if (!z) return;
    const t = now(), secondary = !!(traits && (traits.secondary || traits.dot)), type = typeOf(traits), fin = !!(traits && traits.finisher);
    const charged = !!(traits && (traits.charged || traits.skyArrow || (traits.gearToken && traits.gearToken.charged)));
    if (z.vanguardKnock) { z.vanguardKnock = false; if (!z.dead && !isBoss(z) && !z.air && typeof launch === 'function') launch(z, (Math.sign(z.x - hero.x) || 1) * 80, 105); }
    if (z.dead && !z.rogueDeadSeen) {
      z.rogueDeadSeen = true;
      if (has['乘胜追击'] && !secondary) killCritUntil = t + 3;   // 武器亮金光，见 drawWorld
      if (z.burnT > 0 && typeof allyFires !== 'undefined') allyFires.push({ x: z.x, y: z.y, t: 2, r: 20, tick: 0 });   // 明火：着火的敌人死后留火场
      if (has['回矢'] && traits && traits.skyArrow && ammoBackT <= t && window.BOWAMMO && BOWAMMO.add) { ammoBackT = t + .3; BOWAMMO.add(1); stat('回矢'); pop(hero.x, hero.y - 50, '回矢 +1', '#9fd3ff'); }
    }
    if (secondary) return;
    if (has['破军'] && fin && !ranged) {
      if (z.dead) { stat('破军'); shockwave(z.x, z.y, 60, 1, false, '破军'); }
      else if ((z.T.elite || z.T.ch2Elite || isBoss(z)) && Math.random() < .3) { stat('破军'); shockwave(z.x, z.y, 40, .5, false, '破军'); }
    }
    if (has['明火'] && fin && !z.dead) { z.burnT = 3; z.burnTick = 0; z.burnSrc = '明火'; stat('明火'); }
    if (has['定海'] && type === 'staff' && fin && z.daze > 0) for (const o of zs) if (o !== z && !o.dead && !o.air && !isBoss(o) && Math.hypot(o.x - z.x, (o.y - z.y) * 2) < 50) { o.daze = Math.max(o.daze || 0, .6); o.st = 'move'; o.tok = false; }
    if (has['崩山'] && type === 'hammer' && fin && hero.atk && !hero.atk.bengDone) { hero.atk.bengDone = true; beng.push({ x: hero.x, y: hero.y, t: -.3 }); stat('崩山'); }
    if (has['飞蝗'] && type === 'stone' && charged && !z.rogueBounce) {
      const n = zs.filter(o => o !== z && !o.dead && !o.air && Math.hypot(o.x - z.x, o.y - z.y) < 90).sort((a, b) => Math.hypot(a.x - z.x, a.y - z.y) - Math.hypot(b.x - z.x, b.y - z.y))[0];
      if (n) { stat('飞蝗'); fx.push({ k: 'bounce', x0: z.x, y0: z.y - 10, z: n, t: 0, T: .15, dmg: (dmg || 1) * .6 }); }
    }
    if (has['震慑'] && !z.dead && (z.daze > 0 || knocked || z.air) && !(z.flawUntil > t)) { z.flawUntil = t + 4; stat('震慑', 0); pop(z.x, z.y - 40, '破绽', '#ff7a5a'); }
  }
  function shockwave(x, y, r, dmg, knock, name) {
    fx.push({ k: 'ring', x, y, r, t: 0, T: .3 });
    for (const o of zs) if (!o.dead && !o.air && Math.hypot(o.x - x, (o.y - y) * 2) < r) (name && stat(name, dmg, 0)), hit(o, dmg, 80, Math.sign(o.x - x) || 1, knock && !isBoss(o), 0, .3, true, false, { secondary: true });
  }
  // ---- 其他挂钩 ----
  function onShoot(C, c, finisher, sOff) {
    const h = hero, w = weaponNow();
    const extra = (k, mult, card) => { for (const ang of k) shots.push({ statCard: card, x: h.x + h.f * 16, y: h.y + sOff, z: 22, vx: h.f * C.spd * Math.cos(ang), vy: C.spd * Math.sin(ang) * .5, life: C.life || .8, C: { ...C, dmg: C.dmg * mult, noPierce: true, daze: 0, dazeChance: 0, dazeTime: 0 }, c, hitSet: [], secondary: true, kind: w === 'bow' ? 'arrow' : undefined }); };
    if (has['飞蝗'] && w === 'stone' && !finisher && ++stoneShots % 3 === 0) { stat('飞蝗'); extra([-.16, .16], .5, '飞蝗'); }
    if (has['矢如连珠'] && volleyNext) { volleyNext = false; extra([-.14, .14], .35, '矢如连珠'); }
  }
  function onSwap() {
    if (!has['倒持'] || !swapReady) return false;
    swapReady = false; glowN = 0; swapPending = true; stat('倒持', 0, 0); pop(hero.x, hero.y - 48, '倒持！', null, true); return true;
  }
  function onChargeRelease() { cunjin = false; }   // 松手出招时用掉（同一招打中后会重新点亮）
  function chargeScale() { return (cunjin && has['寸劲'] ? .7 : 1) * (lowHp() ? .5 : 1); }
  function onRollEnd() {
    if (has['回马'] && backCd <= 0 && hero.rollFrom) {   // 回马：翻滚起点留下青色残影，向身后挥一次普攻（主角不受影响）
      backCd = 3; const f = -(Math.sign(hero.rx || hero.f) || 1);
      ghosts.push({ x: hero.x, y: hero.y, f, t: 0,   /* 用户定：残影在翻滚终点、人物身后 */ w: weaponNow(), hit: false }); stat('回马');
    }
    return false;
  }
  function onHurt() { hurtAt = now(); glowN = 0; }
  function sidestep(n, kind) {
    if (!has['闪身'] || !(kind === 'skill' || n >= 2) || Math.random() >= .2) return false;
    hero.inv = Math.max(hero.inv || 0, .4); sideUntil = now() + 3; stat('闪身'); pop(hero.x, hero.y - 46, '闪', '#bfe8ff', true); return true;
  }
  function onExecute() { zhanUntil = now() + 3; }
  function decoyFor(z) {
    if (!scarecrows.length || !z || z.dead || isBoss(z)) return null;
    let best = null, bd = 140;
    for (const s of scarecrows) { if (s.boom != null) continue; const d = Math.hypot(z.x - s.x, (z.y - s.y) * 1.5); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  function enemyMove(z) { return z.wetUntil > now() ? .5 : 1; }   // 被浪冲过的敌人 1.5 秒内减速一半
  // ---- 将令（第二批） ----
  // 将令统一对准敌群：返回身边敌人最多的那个敌人的位置；没有敌人就是主角前方
  function cluster(r = 50) {
    const foes = zs.filter(z => !z.dead && !z.air && z.x > cam.x - 10 && z.x < cam.x + viewW() + 10);
    if (!foes.length) return { x: hero.x + hero.f * 80, y: hero.y };
    let best = foes[0], bn = -1;
    for (const z of foes) { const n = foes.filter(o => Math.hypot(o.x - z.x, (o.y - z.y) * 2) < r).length; if (n > bn) { bn = n; best = z; } }
    return { x: best.x, y: best.y };
  }
  function castScarecrows() {
    // 稻草人是新的「敌方目标」：附近敌人优先去打它（敌人更新时把它当成主角），被打碎或 8 秒后爆炸
    for (const dx of [50, 95]) scarecrows.push({ decoy: true, x: hero.x + hero.f * dx, y: Math.max(M.top + 6, Math.min(M.bot - 4, hero.y + (dx === 50 ? -14 : 14))), f: -hero.f, st: 'idle', t: 0, hp: 6, hitT: 0, inv: 0, air: false, z: 0 });
    if (typeof say === 'function') say('草木皆兵！', 1.4);
  }
  function castFire() {
    const c = cluster(70);   // 火铺在敌群那里：6 片，每秒 1 伤害，会在敌人之间传开
    for (let i = 0; i < 6; i++) allyFires.push({ x: c.x + (i % 3 - 1) * 34 + rnd(-6, 6), y: c.y + (i < 3 ? -12 : 12), t: 5, r: 28, tick: 0, dmg: .35, ignite: true });   // 伤害测试场：火烧连营偏强 .5→.35
    // 打击感：轰燃一声、震屏、火星四溅，范围内敌人当场着火并被掀一下
    shake = Math.max(shake, .35); if (typeof sfx === 'function') { sfx('fireLand', c.x); sfx('finisher', c.x); }
    for (let i = 0; i < 40; i++) propFx.push({ x: c.x + rnd(-60, 60), y: c.y + rnd(-18, 18), vx: rnd(-90, 90), vy: rnd(-180, -60), w: rnd(2, 4), h: rnd(2, 4), life: rnd(.4, .8), max: .8, c: ['#ff9a2e', '#ffd04a', '#ff5a1a'][i % 3] });
    for (const z of zs) if (!z.dead && !z.air && Math.abs(z.x - c.x) < 80 && Math.abs(z.y - c.y) < 26) { z.burnT = 3; z.burnSpread = true; hit(z, .2, 40, Math.sign(z.x - c.x) || 1, false, 0, .3, true, false, { secondary: true }); stat('火烧连营', .2); }
    if (typeof say === 'function') say('火烧连营！', 1.4);
  }
  function castWater() {
    // 改成海浪：6 秒里每 0.7 秒从主角身后涌出一道浪，冲过前方 300 的距离，沿途敌人被冲开、受 0.8 伤害并减速
    const c = cluster(80), dir = Math.sign(c.x - hero.x) || hero.f;
    waters.push({ dir, y: c.y, t: 0, T: 6, next: 0, waves: [] });
    if (typeof say === 'function') say('水淹七军！', 1.4);
  }
  function updateBing(dt) {
    // 草木皆兵：附近的敌人被稻草人吸引，停在旁边围着打；稻草人被打碎时爆炸
    for (const s of scarecrows) {
      s.t += dt; s.hitT = Math.max(0, s.hitT - dt);
      s.inv = 0; s.st = 'idle';
      // 飞来的敌方箭、石子打到稻草人
      if (s.boom == null && typeof eshots !== 'undefined') for (const e of eshots) if ((e.k === 'stone' || e.k === 'arrow') && e.life > 0 && Math.abs(e.x - s.x) < 9 && Math.abs(e.y - s.y) < 9) { e.life = 0; s.hp -= 1; s.hitT = .2; }
      if ((s.hp <= 0 || s.t > 8) && s.boom == null) { s.boom = 0; shockwave(s.x, s.y, 55, 3, true, '草木皆兵'); if (typeof sfx === 'function') sfx('finisher', s.x); shake = Math.max(shake, .2); }
    }
    for (const s of scarecrows) if (s.boom != null) s.boom += dt;
    scarecrows = scarecrows.filter(s => s.boom == null || s.boom < .5);
    // 借我东风：把敌人往远离主角的方向吹，敌人的箭被吹偏
    if (windT > 0) {   // 借我东风：8 秒；持续吹开，每 2 秒一阵强风吹倒普通敌人；敌人的箭石被吹回去
      windT -= dt; gustT -= dt;
      const gust = gustT <= 0; if (gust) gustT = 2;
      for (const z of zs) if (!z.dead && !z.air && !isBoss(z)) {
        const d = windDir; moveEnt(z, d * 45 * dt, 0);   // 用户定：风往放技能时主角朝向吹
        if (gust) { z.vx = d * 60; hit(z, .5, 0, d, false, 0, .2, false, false, { secondary: true }); stat('借我东风', .5); }   // 强风推一下并带 0.5 伤害
      }
      if (gust && typeof sfx === 'function') sfx('roll', hero.x);
      if (typeof eshots !== 'undefined') for (const e of eshots) if (e.vx && !e.windBent && Math.sign(e.vx) === -windDir && (e.k === 'stone' || e.k === 'arrow')) {
        e.windBent = true; e.life = 0;   // 被风吹回：变成我方的箭石打向敌人
        shots.push({ x: e.x, y: e.y, z: 22, vx: -e.vx, life: .9, C: { dmg: 1, kb: 20 }, c: 0, hitSet: [], kind: e.k === 'arrow' ? 'arrow' : undefined, secondary: true });
      }
    }
    // 水淹七军：水里的敌人持续受伤（减速在 enemyMove）
    for (const w of waters) {
      w.t += dt; w.next -= dt;
      if (w.next <= 0 && w.t < w.T) { w.next = .7; w.waves.push({ x: hero.x - w.dir * 20, y: (w.y + hero.y) / 2 + rnd(-16, 16), x0: hero.x, hit: new Set() }); if (typeof sfx === 'function') sfx('roll', hero.x); }
      for (const v of w.waves) {
        v.x += w.dir * 230 * dt;
        for (const z of zs) if (!z.dead && !z.air && !v.hit.has(z) && Math.abs(z.x - v.x) < 24 && Math.abs(z.y - v.y) < 30) { v.hit.add(z); stat('水淹七军', .8, 0); hit(z, .8, 140, w.dir, false, 0, .3, true, false, { secondary: true }); z.wetUntil = now() + 1.5; z.waveShove = now() + .5; }
      }
      w.waves = w.waves.filter(v => Math.abs(v.x - v.x0) < 320);
      // 浪卷敌兵相撞：被冲开的敌人撞上别的敌人，两个都再受 0.5 伤害并一起倒地（每个敌人每道浪只撞一次）
      for (const z of zs) if (z.waveShove > now() && !z.dead) for (const o of zs) if (o !== z && !o.dead && !o.air && !o.waveBumped && Math.abs(o.x - z.x) < 14 && Math.abs(o.y - z.y) < 10) {
        o.waveBumped = true; z.waveShove = 0;
        stat('水淹七军', 1, 0); for (const e of [z, o]) { hit(e, .5, 60, w.dir, !isBoss(e), 0, .4, true, false, { secondary: true }); }
        pop((z.x + o.x) / 2, z.y - 40, '相撞！', '#9fd3ff');
      }
      if (!w.waves.length) for (const z of zs) z.waveBumped = false;
    }
    waters = waters.filter(w => w.t < w.T || w.waves.length);
    // 着火（明火 / 火烧连营）：每秒掉血；火烧连营的火会传给身边的敌人
    spreadT -= dt;
    for (const z of zs) {
      if (z.dead || !(z.burnT > 0)) continue;
      z.burnT -= dt; z.burnTick = (z.burnTick || 0) - dt;
      if (z.burnTick <= 0) { z.burnTick = 1; hit(z, .3, 0, 0, false, 0, 0, false, false, { dot: true }); if (z.burnSrc) stat(z.burnSrc, .3, 0); if (z.dead && typeof allyFires !== 'undefined') allyFires.push({ x: z.x, y: z.y, t: 2, r: 20, tick: 0 }); }
      if (z.burnSpread && spreadT <= 0) for (const o of zs) if (o !== z && !o.dead && !(o.burnT > 0) && Math.hypot(o.x - z.x, o.y - z.y) < 26) { o.burnT = 3; o.burnSpread = true; }
    }
    if (spreadT <= 0) spreadT = 1;
    if (typeof allyFires !== 'undefined') for (const f of allyFires) if (f.ignite) for (const z of zs) if (!z.dead && !z.air && !(z.burnT > 0) && Math.abs(z.x - f.x) < f.r && Math.abs(z.y - f.y) < f.r * .45) { z.burnT = 3; z.burnSpread = true; }
  }
  function hardClash(from) {
    if (!has['硬撼'] || typeof charging === 'undefined' || !charging || chargeTier < 3) return false;
    atkHeldSince = performance.now() - chargeMaxMs() * .5; chargeTier = 2;   // 抵消这次伤害，蓄力效果只剩一半
    hero.inv = Math.max(hero.inv || 0, .4); shake = Math.max(shake, .2);
    floaters.push({ x: hero.x, y: hero.y - 48, t: 0, txt: '硬撼！', big: true, gold: true }); stat('硬撼');
    if (typeof sfx === 'function') sfx('finisher', hero.x);
    for (const z of zs) if (!z.dead && !z.air && Math.hypot(z.x - hero.x, (z.y - hero.y) * 2) < 55) rogueHitFull(z, 1, Math.sign(z.x - hero.x) || 1, true);
    return true;
  }
  function rogueHitFull(z, dmg, dir, knock = true) { if (typeof hit === 'function') hit(z, dmg, 110, dir, knock, 0, .35, true, false, { secondary: true }); }
  function tick(dt) {
    finisherCd = Math.max(0, finisherCd - dt); avoidCd = Math.max(0, avoidCd - dt); backCd = Math.max(0, backCd - dt);
    // 先声夺人：每波敌人出现（场上从没人到有人）时重新就绪
    const alive = zs.filter(z => !z.dead).length; if (alive > 0 && lastAlive === 0) { vanguard = true; if (has['先声夺人']) { rallyT = 4; pop(hero.x, hero.y - 50, '战意！', null, true); } } lastAlive = alive;
    rallyT = Math.max(0, rallyT - dt);
    for (const g of ghosts) {
      g.t += dt;
      if (g.t > .12 && !g.hit) { g.hit = true; const W = WEAP[g.w] || {}, reach = (W.reach || 30) + 10;
        for (const z of zs) if (!z.dead && !z.air && (z.x - g.x) * g.f > -6 && Math.abs(z.x - g.x) < reach && Math.abs(z.y - g.y) < 16) { stat('回马', 1.2, 0); hit(z, 1.2, 60, g.f, false, 0, .35, true, false, { secondary: true }); }
        if (typeof sfx === 'function') sfx('swing_' + (W.snd || g.w), g.x); }
    }
    ghosts = ghosts.filter(g => g.t < .45);
    // 一鼓作气 / 骤雨：2 秒没打中开始掉层（每秒 2 层）
    momentumIdle += dt; if (momentumIdle > 2) { momentum = Math.max(0, momentum - 2 * dt); gale = Math.max(0, gale - 2 * dt); }
    glowIdle += dt; if (glowIdle > 3 && !swapReady) glowN = 0;
    S.aspd = 1 / (1 + .03 * Math.floor(gale)); S.move = (1 + .03 * Math.floor(gale)) * (sideUntil > now() ? 1.2 : 1) * (rallyT > 0 ? 1.25 : 1);
    if (guardShield > 0) { guardShieldT -= dt; if (guardShieldT <= 0) guardShield = 0; }
    for (const b of beng) { b.t += dt; if (b.t >= 0 && !b.done) { b.done = true; fx.push({ k: 'ring', x: b.x, y: b.y, r: 60, t: 0, T: .3 }); for (const o of zs) if (!o.dead && !o.air && Math.hypot(o.x - b.x, (o.y - b.y) * 2) < 60) { hit(o, 1.5, 90, Math.sign(o.x - b.x) || 1, !isBoss(o), 0, .35, true, false, { secondary: true }); o.bengLand = 1; } if (typeof sfx === 'function') sfx('finisher', b.x); } }
    beng = beng.filter(b => !b.done);
    // 崩山：被第二圈击倒的敌人落地时再震一下周围（半径 35、0.5 伤害）
    for (const z of zs) if (z.bengLand) { if (z.air) z.bengLand = 2; else if (z.bengLand === 2) { z.bengLand = 0; fx.push({ k: 'ring', x: z.x, y: z.y, r: 35, t: 0, T: .25 }); for (const o of zs) if (o !== z && !o.dead && !o.air && Math.hypot(o.x - z.x, (o.y - z.y) * 2) < 35) hit(o, .5, 40, Math.sign(o.x - z.x) || 1, false, 0, .3, false, false, { secondary: true }); } else if (z.dead) z.bengLand = 0; }
    for (const f of fx) { f.t += dt;
      if (f.k === 'darkArrow' && f.t >= f.T && !f.done) { f.done = true; if (!f.z.dead) hit(f.z, f.dmg, 30, f.dir, false, 0, .2, false, false, { secondary: true }); }
      if (f.k === 'bounce' && f.t >= f.T && !f.done) { f.done = true; if (!f.z.dead) { f.z.rogueBounce = true; hit(f.z, f.dmg, 40, 1, false, 0, .3, false, true, { secondary: true }); f.z.rogueBounce = false; } }
    }
    if (avoidGhost) { avoidGhost.t += dt; if (avoidGhost.t > .4) avoidGhost = null; }
    fx = fx.filter(f => f.t < (f.k === 'darkArrow' ? f.T + .1 : f.T));
    updateBing(dt);
    if (S.shield && !shieldReady) { shieldTimer -= dt; if (shieldTimer <= 0) { shieldReady = true; shieldTimer = 0; } }
    if (skillCd > 0) { skillCd = Math.max(0, skillCd - dt); updateSkillButton(); }
    if (thunder.length) updateThunder(dt);
    if (rain || rainArrows.length) updateRain(dt);
    if (S.fireAura && typeof zs !== 'undefined') {
      let near = false;
      const lv = Math.max(1, auraStacks);
      for (const z of zs) {
        if (!z || z.dead || z.air || Math.hypot(z.x - hero.x, z.y - hero.y) > 24) continue;
        near = true;
        z.fireTick = (z.fireTick || 0) - dt;
        if (z.fireTick <= 0) { z.fireTick = .5; rogueHit(z, .2 * (1 + .5 * (lv - 1)), { secondary: true, scaled: true, dot: true }); }
      }
      if (near) { auraHold += dt; auraIdle = 0; if (auraHold >= 1) { auraHold -= 1; auraStacks = Math.min(3, auraStacks + 1); } }
      else { auraHold = Math.max(0, auraHold - dt); auraIdle += dt; if (auraIdle >= 1.2 && auraStacks > 1) { auraIdle = 0; auraStacks--; } }
    }
    if (!window.GEAR && S.poison && typeof zs !== 'undefined') for (const z of zs) {
      if (!z || !z.poisonT || z.dead) continue;
      z.poisonT = Math.max(0, z.poisonT - dt); z.poisonTick = (z.poisonTick || 1) - dt;
      if (z.poisonTick <= 0 && z.poisonT > 0) { z.poisonTick += 1; rogueHit(z, .25 * z.poisonStacks * (z.poisonScale || 1) * (z.T && z.T.boss ? .5 : 1), { secondary: true, scaled: true, dot: true }); }
      if (!z.poisonT) z.poisonStacks = 0;
    }
  }
  function rogueHit(z, dmg, traits) { if (typeof hit === 'function') hit(z, dmg, 0, 0, false, 0, 0, false, false, traits); }

  function draw() {
    if (!open) return false;
    const W = cv.width / DPR, H = cv.height / DPR;
    ctx.save(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = 'rgba(10,7,9,.78)'; ctx.fillRect(0, 0, W, H);
    const F = '"PingFang SC","Noto Sans CJK SC",sans-serif', compact = H < 500;
    const titleY = H * (compact ? .12 : .17), n = offer.length;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = '900 26px ' + F; ctx.fillStyle = '#f3d27c'; ctx.fillText('锦囊', W / 2, titleY);
    ctx.font = '600 14px ' + F; ctx.fillStyle = 'rgba(242,230,201,.88)'; ctx.fillText(`选一个带走（本局有效）· 按 1~${n} 或点击`, W / 2, titleY + 26);
    rects = [];
    const gap = Math.min(14, W * .018), ch = Math.min(290, H * (compact ? .62 : .5));
    const cw = Math.min(194, (W - 48 - gap * (n - 1)) / n, ch * .68), x0 = (W - (cw * n + gap * (n - 1))) / 2, y0 = H * (compact ? .245 : .29);
    const frame = typeof IMG !== 'undefined' ? IMG.ui_rogue_card : null;
    for (let i = 0; i < n; i++) {
      const hv = hoverI === i ? 1 : 0;   // 鼠标移上去：卡片上浮放大（代替选中框）
      const c = offer[i], x = x0 + i * (cw + gap), y = y0 + Math.sin(anim * 1.5 + i) * 2 - hv * 8;
      ctx.save(); if (hv) { ctx.translate(x + cw / 2, y + ch / 2); ctx.scale(1.04, 1.04); ctx.translate(-(x + cw / 2), -(y + ch / 2)); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 18; }
      if (frame && frame.complete && frame.naturalWidth) ctx.drawImage(frame, x, y, cw, ch);
      else { ctx.fillStyle = '#342117'; ctx.fillRect(x, y, cw, ch); }
      ctx.restore();
      // 稀有度（用户定：不用外框）：稀有木纹透青光 + 蓝印「稀」；传说四周飘金光点 + 朱印「传」；卡名颜色区分
      // 用户定：稀有不加蓝色滤镜，只靠名字颜色和角标区分
      // 用户定：锦囊卡不加任何滤镜/光效，稀有度只看卡名颜色
      const seal = null;   // 用户定：不要角标，稀有度只看卡名颜色（稀=蓝、传=金）
      if (seal) { ctx.save(); ctx.fillStyle = seal[0]; ctx.globalAlpha = .92; const sx = x + 16, sy = y + 18; ctx.fillRect(sx, sy, 18, 18); ctx.strokeStyle = 'rgba(255,240,220,.7)'; ctx.lineWidth = 1; ctx.strokeRect(sx + 2, sy + 2, 14, 14); ctx.fillStyle = '#fff4e0'; ctx.font = '700 12px "KaiTi","STKaiti",serif'; ctx.textAlign = 'center'; ctx.fillText(seal[1], sx + 9, sy + 13.5); ctx.restore(); }
      ctx.save(); ctx.beginPath(); ctx.rect(x + 18, y + 24, cw - 36, ch - 48); ctx.clip();
      ctx.font = '700 12px ' + F; ctx.fillStyle = c.color || '#d5b678'; ctx.fillText(c.catName, x + cw / 2, y + ch * .18, cw - 38);
      ctx.font = '900 ' + Math.round(Math.min(20, cw / 7)) + 'px ' + F; ctx.shadowColor = 'rgba(24,12,6,.9)'; ctx.shadowBlur = 3;
      ctx.fillStyle = c.isBing ? '#f0c27a' : c.r === 'l' ? '#ffd24a' : c.r === 'r' ? '#8fd0ff' : '#f6ecd6';
      ctx.fillText(c.name, x + cw / 2, y + ch * .29, cw - 38); ctx.shadowBlur = 0;
      const fs = Math.max(9, Math.min(12, cw * .067)); const lh = fs * 1.42; let ly = y + ch * .39;
      if (c.trig) { ctx.font = '700 ' + fs + 'px ' + F; ctx.fillStyle = '#ffcf6a'; ctx.fillText('【' + c.trig + '】', x + cw / 2, ly, cw - 40); ly += lh * 1.2; }   // 触发条件
      ctx.font = '600 ' + fs + 'px ' + F; ctx.fillStyle = '#f2e6c9';
      let line = '';
      for (const ch2 of c.desc) { if (ctx.measureText(line + ch2).width > cw - 42 && line) { ctx.fillText(line, x + cw / 2, ly, cw - 40); line = ch2; ly += lh; } else line += ch2; }
      if (line) ctx.fillText(line, x + cw / 2, ly, cw - 40);
      ctx.font = '700 11px ' + F; ctx.fillStyle = c.isBing ? '#f0c27a' : 'rgba(242,230,201,.8)';
      ctx.fillText(c.isBing ? '主动技能 · 一局只能拿一张' : lockedNames.has(c.name) ? '已锁定' : '本局限拿一次', x + cw / 2, y + ch * .82, cw - 40);
      ctx.font = '900 13px ' + F; ctx.fillStyle = '#f3d27c'; ctx.fillText(String(i + 1), x + cw / 2, y + ch * .90);
      ctx.restore(); rects.push({ x, y, w: cw, h: ch, i });
    }
    rerollRect = null;
    if (rerollToken) {
      const bw = Math.min(210, W - 40), bh = 42, bx = (W - bw) / 2, by = Math.min(H - bh - 8, y0 + ch + 12);
      ctx.fillStyle = '#503019'; ctx.fillRect(bx, by, bw, bh); ctx.strokeStyle = '#d9b667'; ctx.lineWidth = 2; ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
      ctx.font = '900 15px ' + F; ctx.fillStyle = '#ffe49a'; ctx.fillText('ROLL　重抽一次', W / 2, by + 27); rerollRect = { x: bx, y: by, w: bw, h: bh };
    }
    ctx.restore(); return true;
  }
  function update(dt) { if (open) anim += dt; }
  addEventListener('pointerdown', e => {
    if (!open) return;
    if (performance.now() < inputLockT) { e.preventDefault(); e.stopPropagation(); return; }
    if (rerollRect && e.clientX >= rerollRect.x && e.clientX <= rerollRect.x + rerollRect.w && e.clientY >= rerollRect.y && e.clientY <= rerollRect.y + rerollRect.h) { e.preventDefault(); e.stopPropagation(); rerollToken = false; offer.forEach(c => seen.delete(c.isBing ? 'bing:' + c.name : c.name)); offerCards(); return; }
    for (const r of rects) if (e.clientX >= r.x && e.clientX <= r.x + r.w && e.clientY >= r.y && e.clientY <= r.y + r.h) { e.preventDefault(); e.stopPropagation(); choose(r.i); return; }
  }, { capture: true });
  addEventListener('pointermove', e => { if (!open) return; hoverI = -1; for (const r of rects) if (e.clientX >= r.x && e.clientX <= r.x + r.w && e.clientY >= r.y && e.clientY <= r.y + r.h) hoverI = r.i; });
  addEventListener('keydown', e => { if (!open) return; e.preventDefault(); e.stopImmediatePropagation(); const k = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code); if (k >= 0) choose(k); }, true);   // 选锦囊时按键只给锦囊用（以前按 1~3 选卡会顺带换武器）
  window.ROGUE = {
    S, offer: offerCards, blocks: () => open, draw, drawWorld, update, tick, choose, useSkill, useSummon, useCatapult, absorbHit,
    onRoll, onDodge, takeFinisher, takeCrit, onHit, afterHit, hardClash, has: name => !!has[name],
    stat, stats: () => STATS, decoyFor, onShoot, onSwap, onChargeRelease, chargeScale, onRollEnd, onHurt, sidestep, onExecute, enemyMove,
    shieldReady: () => !!S.shield && shieldReady,
    summonState: () => ({ cooldown: skillCd }),
    catapultState: () => ({ cooldown: skillCd }),
    fireAura: () => ({ active: !!S.fireAura, stacks: S.fireAura ? auraStacks : 0 }),
    // 调试用：直接获得某张锦囊（兵卡会顶替已有的兵卡）
    grant(name) { if (!IMPL[name] || has[name]) return false; const isBing = allCards().some(c => c.name === name && c.cat === 'bing'); if (isBing && bing) { for (const k of Object.keys(has)) if (allCards().some(c => c.name === k && c.cat === 'bing')) delete has[k]; S.summon = 0; S.catapult = 0; } has[name] = 1; IMPL[name](); skillCd = 0; updateSkillButton(); return true; },
    grantReroll() { if (rerollToken) return false; rerollToken = true; return true; },
    rerolls: () => rerollToken, pickedUp: () => has, cards: () => offer,
    reset() {
      setOpen(false); offer = []; rerollToken = false; rerollRect = null; shieldReady = false; shieldTimer = 10; skillCd = 0; bing = '';
      auraStacks = 0; auraHold = 0; auraIdle = 0; pool = null; thunder = []; rain = null; rainArrows = []; hoverI = -1;
      finisherUntil = finisherCd = avoidUntil = avoidCd = 0; avoidCrit = false; dodgeRollT = -1;
      vanguard = false; lastAlive = 0; momentum = momentumIdle = gale = killCritUntil = 0; rangedChain = { z: null, n: 0 }; volleyNext = false; stoneShots = 0;
      glowW = ''; glowN = glowIdle = 0; swapReady = swapPending = cunjin = cunjinNext = false; backCd = 0; hurtAt = -9; guardShield = guardShieldT = 0; sideUntil = zhanUntil = 0;
      for (const k in STATS) delete STATS[k]; leechFxT = qiFxT = 0; avoidGhost = null;
      beng = []; fx = []; scarecrows = []; windT = 0; rallyT = 0; jiyu = 0; ghosts = []; huifengNext = false; gustT = 0; waters = []; spreadT = 0; ammoBackT = 0;
      for (const k in has) delete has[k]; for (const k in DEFAULT) S[k] = DEFAULT[k]; updateSkillButton();
    },
  };
})();
