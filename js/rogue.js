// 锦囊（肉鸽抽卡）：每清完一个区域弹 3 张（30% 额外多一张诅咒），选 1 张，本局有效。
// 卡的效果通过 ROGUE.S 暴露给 game.js / ult.js 读取，全部带默认值，没抽卡时就是 1。
// game.js 只挂 3 处：update 冻结、draw 画面板、清区时 offer()。
(() => {
  const S = {
    dmg: 1,        // 造成伤害倍率
    move: 1,       // 移速倍率
    fin: 1,        // 连招第三段伤害倍率
    reach: 1,      // 武器距离倍率
    aspd: 1,       // 攻击动作时长倍率（<1 更快）
    daze: 1,       // 眩晕时长倍率
    take: 1,       // 受到伤害倍率
    takeFlat: 0,   // 受到伤害减免（点数）
    lifesteal: 0,  // 命中吸血（每次触发量）
    stoneExtra: 0, // 石子追加一颗的概率
    hammerAoe: 0,  // 锤子第三段范围半径（0 = 无）
    staffWave: 0,  // 棍子第三段冲击波（0 = 无）
  };
  const DEFAULT = JSON.parse(JSON.stringify(S));
  const CARDS = [
    { id: 'dmg', name: '蛮力', school: '伤害', w: 10, desc: '造成的伤害 +20%', apply: () => { S.dmg *= 1.2; } },
    { id: 'fin', name: '连打', school: '伤害', w: 9, desc: '连招第三段伤害 +50%', apply: () => { S.fin *= 1.5; } },
    { id: 'move', name: '疾风', school: '速度', w: 9, desc: '移动速度 +15%', apply: () => { S.move *= 1.15; } },
    { id: 'aspd', name: '快打', school: '速度', w: 8, desc: '出招前后摇 -15%', apply: () => { S.aspd *= .85; } },
    { id: 'reach', name: '长手', school: '武器', w: 8, desc: '所有武器距离 +12%', apply: () => { S.reach *= 1.12; } },
    { id: 'tough', name: '硬骨', school: '防御', w: 8, desc: '受到的伤害 -1（最少 1）', apply: () => { S.takeFlat += 1; } },
    { id: 'leech', name: '汲取', school: '续航', w: 7, desc: '命中每 2 秒回 0.3 血', apply: () => { S.lifesteal += .3; } },
    { id: 'daze', name: '震击', school: '控制', w: 7, desc: '打晕时间 +50%', apply: () => { S.daze *= 1.5; } },
    { id: 'stone', name: '石子·连击', school: '武器', w: 6, desc: '扔石子时 30% 概率追加一颗（第二颗伤害减半）', apply: () => { S.stoneExtra = Math.min(.6, S.stoneExtra + .3); } },
    { id: 'hammer', name: '锤·震地', school: '武器', w: 6, desc: '锤子第三段变成范围砸地（半径 34）', apply: () => { S.hammerAoe = 34; } },
    { id: 'wave', name: '棍·冲击波', school: '武器', w: 6, desc: '棍子第三段附带一道直线冲击波', apply: () => { S.staffWave = 1; } },
  ];
  const CURSES = [
    { id: 'c_blood', name: '诅咒·狂血', school: '诅咒', w: 3, curse: true, desc: '受到伤害 +35%，但造成伤害 +45%',
      apply: () => { S.take *= 1.35; S.dmg *= 1.45; } },
  ];
  const MAX_STACK = 2;
  const stacks = {};
  let open = false, offer = [], picked = -1, anim = 0, rects = [];

  // 按权重抽一张；exclude 里放已经抽到的流派，保证三张不重样
  const pickOne = (pool, exclude) => {
    const p = pool.filter(c => !exclude.includes(c.school));
    const src = p.length ? p : pool;
    if (!src.length) return null;
    const tot = src.reduce((a, c) => a + weightOf(c), 0); let r = Math.random() * tot, k = 0;
    for (; k < src.length; k++) { r -= weightOf(src[k]); if (r <= 0) break; }
    return src.splice(Math.min(k, src.length - 1), 1)[0];
  };
  const pickN = (pool, n) => {
    const out = [], p = pool.slice(), schools = [];
    while (out.length < n && p.length) {
      const c = pickOne(p, schools);
      if (!c) break;
      out.push(c); schools.push(c.school);
      const i = p.indexOf(c); if (i >= 0) p.splice(i, 1);
    }
    return out;
  };

  // 当前武器对应的"专属卡"：拿到它时出现概率 ×3
  const W_CARD = { staff: 'wave', hammer: 'hammer', stone: 'stone' };
  const curWeapon = () => (typeof weapon !== 'undefined' ? weapon : '');
  const weightOf = (c) => c.w * (W_CARD[curWeapon()] === c.id ? 3 : 1);

  function offerCards() {
    // 已经拿满 2 次的卡（含诅咒）不会再出现
    const all = CARDS.concat(CURSES);
    const avail = all.filter(c => (stacks[c.id] || 0) < MAX_STACK);
    offer = pickN(avail, 3);
    if (Math.random() < .3) offer = offer.concat(pickN(CURSES.filter(c => (stacks[c.id] || 0) < MAX_STACK), 1));
    picked = -1; anim = 0; open = true;
  }

  function choose(i) {
    if (!open || i < 0 || i >= offer.length) return;
    const c = offer[i];
    if ((stacks[c.id] || 0) >= MAX_STACK) return;   // 保险：已满的卡不再生效
    stacks[c.id] = (stacks[c.id] || 0) + 1;
    c.apply();
    picked = i; open = false;
    if (typeof toast === 'function') toast('锦囊：' + c.name);
    if (typeof say === 'function') say('获得「' + c.name + '」—— ' + c.desc, 3);
  }
  // ---------- 画 ----------
  function draw() {
    if (!open) return false;
    const W = cv.width / DPR, H = cv.height / DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = 'rgba(8,6,12,.74)'; ctx.fillRect(0, 0, W, H);
    const F = '"PingFang SC","Noto Sans CJK SC",sans-serif';
    ctx.textAlign = 'center';
    ctx.font = '900 26px ' + F; ctx.fillStyle = '#ffd86e'; ctx.fillText('锦囊', W / 2, H * .18);
    ctx.font = '600 14px ' + F; ctx.fillStyle = 'rgba(242,230,201,.75)';
    ctx.fillText('选一个带走（本局有效）· 按 1~4 或点击', W / 2, H * .18 + 26);

    rects = [];
    const n = offer.length, gap = 14;
    const cw = Math.min(160, (W - 60 - gap * (n - 1)) / n), ch = Math.min(220, H * .5);
    const x0 = (W - (cw * n + gap * (n - 1))) / 2, y0 = H * .30;
    for (let i = 0; i < n; i++) {
      const c = offer[i], x = x0 + i * (cw + gap), y = y0 + Math.sin(anim * 1.5 + i) * 2;
      const curse = !!c.curse;
      ctx.fillStyle = curse ? 'rgba(46,12,12,.96)' : 'rgba(28,20,14,.96)';
      ctx.fillRect(x, y, cw, ch);
      ctx.strokeStyle = curse ? '#e04a3a' : (c.school === '武器' ? '#ffd86e' : c.school === '大招' ? '#c78bf0' : '#8fd07a');
      ctx.lineWidth = 2.5; ctx.strokeRect(x + 1, y + 1, cw - 2, ch - 2);
      // 顶条
      ctx.fillStyle = curse ? 'rgba(224,74,58,.25)' : 'rgba(255,216,110,.14)';
      ctx.fillRect(x + 1, y + 1, cw - 2, 40);
      ctx.font = '700 12px ' + F; ctx.fillStyle = curse ? '#ff9a8a' : 'rgba(242,230,201,.8)';
      ctx.fillText(c.school, x + cw / 2, y + 18);
      ctx.font = '900 ' + Math.round(Math.min(20, cw / 7)) + 'px ' + F;
      ctx.fillStyle = curse ? '#ffd0c8' : '#ffd86e';
      ctx.fillText(c.name, x + cw / 2, y + 38);
      // 描述（自动换行）
      ctx.font = '600 13px ' + F; ctx.fillStyle = '#f2e6c9';
      let line = '', ly = y + 70;
      for (const ch2 of c.desc) {
        if (ctx.measureText(line + ch2).width > cw - 22) { ctx.fillText(line, x + cw / 2, ly); line = ch2; ly += 19; }
        else line += ch2;
      }
      if (line) ctx.fillText(line, x + cw / 2, ly);
      // 层数
      const st = stacks[c.id] || 0;
      ctx.font = '700 11px ' + F;
      ctx.fillStyle = st >= MAX_STACK ? '#8ef07a' : 'rgba(242,230,201,.55)';
      ctx.fillText('已拿 ' + st + '/' + MAX_STACK, x + cw / 2, y + ch - 26);
      // 序号
      ctx.font = '900 13px ' + F; ctx.fillStyle = 'rgba(255,216,110,.9)';
      ctx.fillText(String(i + 1), x + cw / 2, y + ch - 8);
      rects.push({ x, y, w: cw, h: ch, i });
    }
    ctx.textAlign = 'left';
    return true;
  }

  function update(dt) { if (open) anim += dt; }

  addEventListener('pointerdown', e => {
    if (!open) return;
    for (const r of rects) {
      if (e.clientX >= r.x && e.clientX <= r.x + r.w && e.clientY >= r.y && e.clientY <= r.y + r.h) {
        e.preventDefault(); e.stopPropagation(); choose(r.i); return;
      }
    }
  }, { capture: true });

  addEventListener('keydown', e => {
    if (!open) return;
    if (e.code === 'Digit1') choose(0);
    if (e.code === 'Digit2') choose(1);
    if (e.code === 'Digit3') choose(2);
    if (e.code === 'Digit4') choose(3);
  });

  window.ROGUE = {
    S, offer: offerCards, blocks: () => open, draw, update, choose,
    pickedUp: () => stacks, cards: () => offer, reset: () => {
      open = false; offer = []; picked = -1;
      for (const k in stacks) delete stacks[k];
      for (const k in DEFAULT) S[k] = DEFAULT[k];
    },
  };
})();
