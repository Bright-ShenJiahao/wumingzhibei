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
    '会心一击': () => { S.crit += .08; },
    '分裂之击': () => { S.split = 1; },
    '淬毒': () => { S.poison = 1; },
    '烈火焚身': () => { S.fireAura = 1; auraStacks = 1; auraHold = 0; auraIdle = 0; },
    '金光咒': () => { S.shield = 1; },
    '饮血': () => { S.lifesteal = .5; },
    '回锋': () => {}, '避实回气': () => {}, '藏势': () => {}, '风火轮': () => {}, '震慑': () => {}, '硬拼': () => {},
    '万箭齐发': () => { bing = 'wanjian'; S.summon = 1; },
    '投石问路': () => { bing = 'toushi'; S.catapult = 1; S.catapultFire = 6; },
    '雷霆万钧': () => { bing = 'leiting'; },
  };
  const WEIGHT = { n: 6, r: 3, l: 1 };
  function allCards() {
    const out = [];
    if (!window.TIPBAG) return out;
    for (const cat of TIPBAG.CATS) for (const c of TIPBAG.CARDS[cat.id] || []) {
      if (!IMPL[c[0]]) continue;
      out.push({ name: c[0], r: c[1], desc: c[2], weapon: c[3] || '', cat: cat.id, catName: cat.name, color: cat.color });
    }
    return out;
  }
  let pool = null, lockedNames = new Set(), seen = new Set(), bingChance = .3;
  let open = false, offer = [], anim = 0, rects = [], rerollToken = false, rerollRect = null;
  let inputLockT = 0, shieldReady = false, shieldTimer = 10, skillCd = 0;
  let auraStacks = 0, auraHold = 0, auraIdle = 0;
  // 翻滚躲闪类
  let dodgeRollT = -1, finisherUntil = 0, finisherCd = 0, avoidUntil = 0, avoidCd = 0, avoidCrit = false;
  let thunder = [];
  const now = () => (typeof gameT !== 'undefined' ? gameT : performance.now() / 1000);

  function buildPool() {
    const cards = allCards().filter(c => c.cat !== 'bing');
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
  const weightOf = c => lockedNames.has(c.name) ? WEIGHT.n : WEIGHT[c.r];
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
  const SKILL_NAME = { wanjian: '万箭齐发', toushi: '投石问路', leiting: '雷霆万钧' };
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
    skillCd = window.GEAR ? (GEAR.refreshSkill() ? 0 : GEAR.skillCd()) : 30; updateSkillButton();
    if (bing === 'leiting') castThunder();
    return bing;
  }
  // 旧接口保留（game.js 的按键/按钮还在调用）
  function useSummon() { return bing === 'wanjian' && useSkill() === 'wanjian'; }
  function useCatapult() { return bing === 'toushi' && useSkill() === 'toushi'; }
  function absorbHit() {
    if (!S.shield || !shieldReady) return false;
    shieldReady = false; shieldTimer = 10;
    if (typeof toast === 'function') toast('金光咒挡下了攻击！');
    return true;
  }
  // ---- 雷霆万钧：屏幕内落 6 道天雷，优先劈人多的地方 ----
  function castThunder() {
    const foes = (typeof zs !== 'undefined' ? zs : []).filter(z => !z.dead && !z.air && z.x > cam.x - 10 && z.x < cam.x + viewW() + 10);
    for (let i = 0; i < 6; i++) {
      let x, y;
      if (foes.length) {
        // 选身边敌人最多的那个
        const best = foes.map(z => [z, foes.filter(o => Math.hypot(o.x - z.x, (o.y - z.y) * 2) < 40).length + Math.random()]).sort((a, b) => b[1] - a[1]);
        const z = best[i % best.length][0]; x = z.x + rnd(-10, 10); y = z.y + rnd(-5, 5);
      } else { x = cam.x + rnd(40, viewW() - 40); y = rnd(M.top + 10, M.bot - 6); }
      thunder.push({ x, y, t: -i * .22 - .35, hit: false });
    }
    if (typeof say === 'function') say('雷霆万钧！', 1.4);
  }
  function updateThunder(dt) {
    for (const b of thunder) {
      b.t += dt;
      if (b.t >= 0 && !b.hit) {
        b.hit = true; shake = Math.max(shake, .22);
        if (typeof sfx === 'function') sfx('finisher', b.x);
        for (const z of zs) if (!z.dead && !z.air && Math.abs(z.x - b.x) < 26 && Math.abs(z.y - b.y) < 13) rogueHitFull(z, 2, Math.sign(z.x - b.x) || 1);
      }
    }
    thunder = thunder.filter(b => b.t < .45);
  }
  function drawWorld() {
    if (!thunder.length || typeof ctx === 'undefined') return;
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
    }
    ctx.restore();
  }
  // ---- 翻滚、受击、命中的挂钩（game.js 调用） ----
  function onRoll(x, y) {
    if (has['风火轮'] && typeof allyFires !== 'undefined') allyFires.push({ x, y, t: 2, r: 18, tick: 0, once: new Set(), dmg: .5 });
  }
  function onDodge() {
    if (typeof hero === 'undefined' || hero.st !== 'roll') return;
    const rid = hero.rollId || 0; if (dodgeRollT === rid) return; dodgeRollT = rid;
    let fx = false;
    if (has['回锋'] && finisherCd <= 0) { finisherUntil = now() + 3; finisherCd = 8; fx = true; }
    if (has['避实回气'] && avoidCd <= 0) { avoidUntil = now() + 3; avoidCrit = true; avoidCd = 4; fx = true; }
    if (fx && typeof floaters !== 'undefined') floaters.push({ x: hero.x, y: hero.y - 44, t: 0, txt: '闪！', gold: true });
  }
  function takeFinisher() { if (finisherUntil > now()) { finisherUntil = 0; return true; } return false; }
  function takeCrit() { if (avoidCrit && avoidUntil > now()) { avoidCrit = false; return true; } return false; }
  function onHit(z, dmg, traits) {
    if (traits && (traits.dot || traits.secondary)) return dmg;
    if (has['震慑'] && z.flawUntil > now()) dmg *= 1.25;
    if (has['避实回气'] && avoidUntil > now()) {
      avoidUntil = 0;
      if (!z.T.boss && !z.T.chapterBoss) { z.daze = Math.max(z.daze || 0, .8); z.st = 'move'; z.tok = false; }
      if (hero.hp < (window.GEAR ? GEAR.maxHp() : 10)) { hero.hp = Math.min(window.GEAR ? GEAR.maxHp() : 10, hero.hp + .5); floaters.push({ x: hero.x, y: hero.y - 46, t: 0, txt: '+0.5', color: '#8fe08a' }); }
    }
    return dmg;
  }
  function afterHit(z, knocked) {
    if (!has['震慑'] || !z || z.dead) return;
    if ((z.daze > 0 || knocked || z.air) && !(z.flawUntil > now())) { z.flawUntil = now() + 4; floaters.push({ x: z.x, y: z.y - 40, t: 0, txt: '破绽', color: '#ff7a5a' }); }
  }
  function hardClash(from) {
    if (!has['硬拼'] || typeof charging === 'undefined' || !charging || chargeTier < 3) return false;
    atkHeldSince = performance.now() - chargeMaxMs() * .5; chargeTier = 2;   // 抵消这次伤害，蓄力效果只剩一半
    hero.inv = Math.max(hero.inv || 0, .4); shake = Math.max(shake, .2);
    floaters.push({ x: hero.x, y: hero.y - 48, t: 0, txt: '硬拼！', big: true, gold: true });
    if (typeof sfx === 'function') sfx('finisher', hero.x);
    for (const z of zs) if (!z.dead && !z.air && Math.hypot(z.x - hero.x, (z.y - hero.y) * 2) < 55) rogueHitFull(z, 1, Math.sign(z.x - hero.x) || 1, true);
    return true;
  }
  function rogueHitFull(z, dmg, dir, knock = true) { if (typeof hit === 'function') hit(z, dmg, 110, dir, knock, 0, .35, true, false, { secondary: true }); }
  function tick(dt) {
    finisherCd = Math.max(0, finisherCd - dt); avoidCd = Math.max(0, avoidCd - dt);
    if (S.shield && !shieldReady) { shieldTimer -= dt; if (shieldTimer <= 0) { shieldReady = true; shieldTimer = 0; } }
    if (skillCd > 0) { skillCd = Math.max(0, skillCd - dt); updateSkillButton(); }
    if (thunder.length) updateThunder(dt);
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
      const c = offer[i], x = x0 + i * (cw + gap), y = y0 + Math.sin(anim * 1.5 + i) * 2;
      if (frame && frame.complete && frame.naturalWidth) ctx.drawImage(frame, x, y, cw, ch);
      else { ctx.fillStyle = '#342117'; ctx.fillRect(x, y, cw, ch); }
      // 稀有度只用框色：稀有蓝、传说金；兵卡青铜
      const edge = c.isBing ? '#c08a4a' : c.r === 'l' ? '#f0b84a' : c.r === 'r' ? '#5d9ad6' : '';
      if (edge) { ctx.save(); ctx.strokeStyle = edge; ctx.lineWidth = 3; if (c.r === 'l') { ctx.shadowColor = edge; ctx.shadowBlur = 10; } ctx.strokeRect(x + 3, y + 3, cw - 6, ch - 6); ctx.restore(); }
      ctx.save(); ctx.beginPath(); ctx.rect(x + 18, y + 24, cw - 36, ch - 48); ctx.clip();
      ctx.font = '700 12px ' + F; ctx.fillStyle = c.color || '#d5b678'; ctx.fillText(c.catName, x + cw / 2, y + ch * .18, cw - 38);
      ctx.font = '900 ' + Math.round(Math.min(20, cw / 7)) + 'px ' + F; ctx.fillStyle = '#ffe08a'; ctx.shadowColor = 'rgba(24,12,6,.9)'; ctx.shadowBlur = 3;
      ctx.fillText(c.name, x + cw / 2, y + ch * .29, cw - 38); ctx.shadowBlur = 0;
      const fs = Math.max(9, Math.min(12, cw * .067)); ctx.font = '600 ' + fs + 'px ' + F; ctx.fillStyle = '#f2e6c9';
      let line = '', ly = y + ch * .41; const lh = fs * 1.42;
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
  addEventListener('keydown', e => { if (!open) return; if (window.XIAOCHANG && XIAOCHANG.active()) { e.preventDefault(); e.stopImmediatePropagation(); } const k = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code); if (k >= 0) choose(k); }, true);
  window.ROGUE = {
    S, offer: offerCards, blocks: () => open, draw, drawWorld, update, tick, choose, useSkill, useSummon, useCatapult, absorbHit,
    onRoll, onDodge, takeFinisher, takeCrit, onHit, afterHit, hardClash, has: name => !!has[name],
    shieldReady: () => !!S.shield && shieldReady,
    summonState: () => ({ cooldown: skillCd }),
    catapultState: () => ({ cooldown: skillCd }),
    fireAura: () => ({ active: !!S.fireAura, stacks: S.fireAura ? auraStacks : 0 }),
    grantReroll() { if (rerollToken) return false; rerollToken = true; return true; },
    rerolls: () => rerollToken, pickedUp: () => has, cards: () => offer,
    reset() {
      setOpen(false); offer = []; rerollToken = false; rerollRect = null; shieldReady = false; shieldTimer = 10; skillCd = 0; bing = '';
      auraStacks = 0; auraHold = 0; auraIdle = 0; pool = null; thunder = [];
      finisherUntil = finisherCd = avoidUntil = avoidCd = 0; avoidCrit = false; dodgeRollT = -1;
      for (const k in has) delete has[k]; for (const k in DEFAULT) S[k] = DEFAULT[k]; updateSkillButton();
    },
  };
})();
