// 锦囊：每清完一个区域抽三选一；每张卡每局只能获得一次，本局结束后清空。
(() => {
  const S = {
    meleeDmg: 1, rangedDmg: 1, finMelee: 1, finRanged: 1,
    move: 1, aspd: 1, chargedDmg: 1, steady: 0,
    lifesteal: 0, shield: 0, stoneExtra: 0, scatter: 0,
    hammerAoe: 0, hammerBonus: 1, staffWave: 0, waveBonus: 1,
    crit: 0, poison: 0, summon: 0, fireAura: 0, split: 0,
  };
  const DEFAULT = { ...S };
  const CARDS = [
    { id: 'vanguard', name: '先登', school: '伤害', w: 10, desc: '近战伤害 +20%；远程伤害 +10%', apply: () => { S.meleeDmg *= 1.2; S.rangedDmg *= 1.1; } },
    { id: 'fin', name: '终招', school: '伤害', w: 8, desc: '连招终段伤害提升：近战 +40%；远程 +20%', apply: () => { S.finMelee *= 1.4; S.finRanged *= 1.2; } },
    { id: 'wind', name: '疾风', school: '速度', w: 8, desc: '移动速度、攻击速度 +10%', apply: () => { S.move *= 1.1; S.aspd /= 1.1; } },
    { id: 'shield', name: '金光盾', school: '防御', w: 8, desc: '每 10 秒生成护盾，完全抵挡一次伤害；就绪时有淡金光圈', apply: () => { S.shield = 1; } },
    { id: 'leech', name: '汲取', school: '续航', w: 7, desc: '命中后每 3 秒最多恢复 0.5 点生命', apply: () => { S.lifesteal = .5; } },
    { id: 'steady', name: '稳身', school: '蓄力', w: 7, desc: '蓄力伤害 +20%（远程 +10%）；蓄力受击时有 30% 概率不中断', apply: () => { S.chargedDmg = 1.2; S.steady = .3; } },
    { id: 'combo', name: '连击', school: '远程', w: 7, desc: '远程攻击有 20% 概率追加一次半伤攻击', apply: () => { S.stoneExtra = .2; } },
    { id: 'quake', name: '震地', school: '短武器', w: 6, desc: '第三段变为范围攻击，略增伤害；命中减移速 15%、减攻速 10%，持续 0.5 秒', apply: () => { S.hammerAoe = 34; S.hammerBonus = 1.15; } },
    { id: 'wave', name: '冲击波', school: '长武器', w: 6, desc: '第三段附带直线冲击波，略增伤害；命中减防 10%，持续 0.5 秒', apply: () => { S.staffWave = 1; S.waveBonus = 1.15; } },
    { id: 'crit', name: '致命一击', school: '暴击', w: 6, desc: '主动攻击有 10% 概率造成 150% 伤害', apply: () => { S.crit = .1; } },
    { id: 'poison', name: '淬毒', school: '持续伤害', w: 6, desc: '主动攻击使敌人中毒 2 秒；再次命中可叠至 2 层，每层每秒造成 0.25 伤害', apply: () => { S.poison = 1; } },
    { id: 'summon', name: '万箭齐发', school: '主动技能', w: 5, desc: '发射 8 箭，每箭 0.3 伤害；每局 2 次，冷却 40 秒', apply: () => { S.summon = 1; summonUses = 0; summonCd = 0; updateSkillButton(); } },
    { id: 'fire', name: '献祭', school: '范围伤害', w: 6, desc: '微弱火焰灼烧近身敌人：每名敌人每 0.5 秒受到 0.2 伤害', apply: () => { S.fireAura = 1; } },
    { id: 'split', name: '分裂', school: '近战', w: 6, desc: '近战命中后，对半径 45 内其他敌人造成本次伤害的 30%', apply: () => { S.split = 1; } },
    { id: 'scatter', name: '散射', school: '远程', w: 6, desc: '远程攻击增加上下各 30° 的副弹，各造成普通伤害的 10%', apply: () => { S.scatter = 1; } },
  ];
  const stacks = {};
  let open = false, offer = [], anim = 0, rects = [], rerollToken = false, rerollRect = null;
  let inputLockT = 0, shieldReady = false, shieldTimer = 10, summonUses = 0, summonCd = 0;

  const WEAPON_CARD = { long: 'wave', short: 'quake', ranged: 'combo' };
  const weightOf = c => {
    const kind = typeof weapon !== 'undefined' && typeof WEAP !== 'undefined' && WEAP[weapon] ? WEAP[weapon].class : '';
    return c.w * (WEAPON_CARD[kind] === c.id ? 3 : 1);
  };
  function pickN(pool, n) {
    const out = [], p = pool.slice(), schools = [];
    while (out.length < n && p.length) {
      const eligible = p.filter(c => !schools.includes(c.school));
      const src = eligible.length ? eligible : p;
      const total = src.reduce((a, c) => a + weightOf(c), 0);
      let r = Math.random() * total, c = src[src.length - 1];
      for (const v of src) { r -= weightOf(v); if (r <= 0) { c = v; break; } }
      out.push(c); schools.push(c.school); p.splice(p.indexOf(c), 1);
    }
    return out;
  }
  const setOpen = value => { open = value; document.body.classList.toggle('wzb-rogue', open); };
  function updateSkillButton() {
    document.body.classList.toggle('wzb-summon', !!S.summon);
    const b = document.getElementById('bSkill');
    if (!b) return;
    const left = Math.max(0, 2 - summonUses);
    b.textContent = summonCd > 0 ? `召唤 ${left} · ${Math.ceil(summonCd)}s` : `召唤 ${left}`;
    b.disabled = summonCd > 0 || left <= 0;
    b.style.opacity = b.disabled ? '.52' : '1';
  }
  function offerCards() {
    // 已获得卡从本局卡池移除，不会再次出现；每次最多三张，且优先保持不同流派。
    const avail = CARDS.filter(c => !stacks[c.id]);
    offer = pickN(avail, 3);
    anim = 0; setOpen(true); inputLockT = performance.now() + 350;
    try { if (typeof joy !== 'undefined' && joy) joy = null; } catch (_) {}
  }
  function choose(i) {
    if (!open || i < 0 || i >= offer.length) return;
    const c = offer[i]; if (stacks[c.id]) return;
    stacks[c.id] = 1; c.apply(); setOpen(false); updateSkillButton();
    if (typeof toast === 'function') toast('锦囊：' + c.name);
    if (typeof say === 'function') say('获得「' + c.name + '」—— ' + c.desc, 3);
  }
  function useSummon() {
    if (!S.summon || summonUses >= 2 || summonCd > 0) return false;
    summonUses++; summonCd = 40; updateSkillButton(); return true;
  }
  function absorbHit() {
    if (!S.shield || !shieldReady) return false;
    shieldReady = false; shieldTimer = 10;
    if (typeof toast === 'function') toast('金光盾挡下了攻击！');
    return true;
  }
  function tick(dt) {
    if (typeof zs !== 'undefined') for (const z of zs) if (z && z.defDownT > 0) z.defDownT = Math.max(0, z.defDownT - dt);
    if (S.shield && !shieldReady) { shieldTimer -= dt; if (shieldTimer <= 0) { shieldReady = true; shieldTimer = 0; } }
    if (summonCd > 0) { summonCd = Math.max(0, summonCd - dt); updateSkillButton(); }
    if (S.fireAura && typeof zs !== 'undefined') {
      for (const z of zs) {
        if (!z || z.dead || z.air || Math.hypot(z.x - hero.x, z.y - hero.y) > 24) continue;
        z.fireTick = (z.fireTick || 0) - dt;
        if (z.fireTick <= 0) { z.fireTick = .5; rogueHit(z, .2, { secondary: true, scaled: true, dot: true }); }
      }
    }
    if (S.poison && typeof zs !== 'undefined') for (const z of zs) {
      if (!z || !z.poisonT || z.dead) continue;
      z.poisonT = Math.max(0, z.poisonT - dt); z.poisonTick = (z.poisonTick || 1) - dt;
      if (z.poisonTick <= 0 && z.poisonT > 0) { z.poisonTick += 1; rogueHit(z, .25 * z.poisonStacks * (z.T && z.T.boss ? .5 : 1), { secondary: true, scaled: true, dot: true }); }
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
    const titleY = H * (compact ? .12 : .17);
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = '900 26px ' + F; ctx.fillStyle = '#f3d27c'; ctx.fillText('锦囊', W / 2, titleY);
    ctx.font = '600 14px ' + F; ctx.fillStyle = 'rgba(242,230,201,.88)'; ctx.fillText('选一个带走（本局有效）· 按 1~3 或点击', W / 2, titleY + 26);
    rects = [];
    const n = offer.length, gap = Math.min(14, W * .018), ch = Math.min(290, H * (compact ? .62 : .5));
    const cw = Math.min(194, (W - 48 - gap * (n - 1)) / n, ch * .68), x0 = (W - (cw * n + gap * (n - 1))) / 2, y0 = H * (compact ? .245 : .29);
    const frame = typeof IMG !== 'undefined' ? IMG.ui_rogue_card : null;
    for (let i = 0; i < n; i++) {
      const c = offer[i], x = x0 + i * (cw + gap), y = y0 + Math.sin(anim * 1.5 + i) * 2;
      if (frame && frame.complete && frame.naturalWidth) ctx.drawImage(frame, x, y, cw, ch);
      else { ctx.fillStyle = '#342117'; ctx.fillRect(x, y, cw, ch); ctx.strokeStyle = '#9c7042'; ctx.lineWidth = 4; ctx.strokeRect(x + 2, y + 2, cw - 4, ch - 4); }
      ctx.save(); ctx.beginPath(); ctx.rect(x + 18, y + 24, cw - 36, ch - 48); ctx.clip();
      ctx.font = '700 12px ' + F; ctx.fillStyle = '#d5b678'; ctx.fillText(c.school, x + cw / 2, y + ch * .18, cw - 38);
      ctx.font = '900 ' + Math.round(Math.min(20, cw / 7)) + 'px ' + F; ctx.fillStyle = '#ffe08a'; ctx.shadowColor = 'rgba(24,12,6,.9)'; ctx.shadowBlur = 3;
      ctx.fillText(c.name, x + cw / 2, y + ch * .29, cw - 38); ctx.shadowBlur = 0;
      const fs = Math.max(9, Math.min(12, cw * .067)); ctx.font = '600 ' + fs + 'px ' + F; ctx.fillStyle = '#f2e6c9';
      const words = c.desc.split(''); let line = '', ly = y + ch * .41, lh = fs * 1.42;
      for (const ch2 of words) { if (ctx.measureText(line + ch2).width > cw - 42 && line) { ctx.fillText(line, x + cw / 2, ly, cw - 40); line = ch2; ly += lh; } else line += ch2; }
      if (line) ctx.fillText(line, x + cw / 2, ly, cw - 40);
      ctx.font = '700 11px ' + F; ctx.fillStyle = 'rgba(242,230,201,.8)'; ctx.fillText('本局限拿一次', x + cw / 2, y + ch * .82);
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
    if (rerollRect && e.clientX >= rerollRect.x && e.clientX <= rerollRect.x + rerollRect.w && e.clientY >= rerollRect.y && e.clientY <= rerollRect.y + rerollRect.h) { e.preventDefault(); e.stopPropagation(); rerollToken = false; offerCards(); return; }
    for (const r of rects) if (e.clientX >= r.x && e.clientX <= r.x + r.w && e.clientY >= r.y && e.clientY <= r.y + r.h) { e.preventDefault(); e.stopPropagation(); choose(r.i); return; }
  }, { capture: true });
  addEventListener('keydown', e => { if (!open) return; if (e.code === 'Digit1') choose(0); if (e.code === 'Digit2') choose(1); if (e.code === 'Digit3') choose(2); }, true);
  window.ROGUE = {
    S, offer: offerCards, blocks: () => open, draw, update, tick, choose, useSummon, absorbHit,
    shieldReady: () => !!S.shield && shieldReady,
    summonState: () => ({ uses: summonUses, cooldown: summonCd }),
    grantReroll() { if (rerollToken) return false; rerollToken = true; return true; },
    rerolls: () => rerollToken, pickedUp: () => stacks, cards: () => offer,
    reset() { setOpen(false); offer = []; rerollToken = false; rerollRect = null; shieldReady = false; shieldTimer = 10; summonUses = 0; summonCd = 0; for (const k in stacks) delete stacks[k]; for (const k in DEFAULT) S[k] = DEFAULT[k]; updateSkillButton(); },
  };
})();
