// 锦囊（肉鸽抽卡）：每清完一个区域弹 3 张（30% 额外多一张诅咒），选 1 张，本局有效。
// 卡的效果通过 ROGUE.S 暴露给 game.js / ult.js 读取，全部带默认值，没抽卡时就是 1。
(() => {
  const S = {
    dmg: 1, move: 1, fin: 1, reach: 1, aspd: 1, daze: 1, take: 1, takeFlat: 0,
    lifesteal: 0, stoneExtra: 0, hammerAoe: 0, staffWave: 0,
  };
  const DEFAULT = JSON.parse(JSON.stringify(S));
  const CARDS = [
    { id: 'dmg', name: '蛮力', school: '伤害', w: 10, desc: '造成的伤害 +20%', apply: () => { S.dmg *= 1.2; } },
    { id: 'fin', name: '终招', school: '伤害', w: 9, desc: '连招终段伤害 +50%', apply: () => { S.fin *= 1.5; } },
    { id: 'move', name: '疾风', school: '速度', w: 9, desc: '移动速度 +15%', apply: () => { S.move *= 1.15; } },
    { id: 'aspd', name: '快打', school: '速度', w: 8, desc: '出招前后摇 -15%', apply: () => { S.aspd *= .85; } },
    { id: 'reach', name: '长手', school: '武器', w: 8, desc: '所有武器距离 +12%', apply: () => { S.reach *= 1.12; } },
    { id: 'tough', name: '硬骨', school: '防御', w: 8, desc: '受到的伤害 -20%（最多叠加 2 层，最低 1）', apply: () => { S.take *= .8; } },
    { id: 'leech', name: '汲取', school: '续航', w: 7, desc: '命中每 2 秒回 0.3 血', apply: () => { S.lifesteal += .3; } },
    { id: 'daze', name: '震击', school: '控制', w: 7, desc: '打晕时间 +50%', apply: () => { S.daze *= 1.5; } },
    { id: 'stone', name: '石子·连击', school: '武器', w: 6, desc: '扔石子时 30% 概率追加一颗（第二颗伤害减半）', apply: () => { S.stoneExtra = Math.min(.6, S.stoneExtra + .3); } },
    { id: 'hammer', name: '锤·震地', school: '武器', w: 6, desc: '锤子第三段变成范围砸地（半径 34）', apply: () => { S.hammerAoe = 34; } },
    { id: 'wave', name: '棍·冲击波', school: '武器', w: 6, desc: '棍子第三段附带一道直线冲击波', apply: () => { S.staffWave = 1; } },
  ];
  const CURSES = [
    { id: 'c_blood', name: '诅咒·狂血', school: '诅咒', w: 3, curse: true, desc: '受到伤害 +35%，但造成伤害 +45%', apply: () => { S.take *= 1.35; S.dmg *= 1.45; } },
  ];
  const MAX_STACK = 2, stacks = {};
  let open = false, offer = [], picked = -1, anim = 0, rects = [], rerollToken = false, rerollRect = null;

  const pickOne = (pool, exclude) => {
    const p = pool.filter(c => !exclude.includes(c.school)), src = p.length ? p : pool;
    if (!src.length) return null;
    const total = src.reduce((a, c) => a + weightOf(c), 0);
    let r = Math.random() * total, k = 0;
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
  const W_CARD = { staff: 'wave', hammer: 'hammer', stone: 'stone' };
  const curWeapon = () => (typeof weapon !== 'undefined' ? weapon : '');
  const weightOf = c => c.w * (W_CARD[curWeapon()] === c.id ? 3 : 1);
  const setOpen = value => {
    open = value;
    document.body.classList.toggle('wzb-rogue', open);
  };

  let inputLockT = 0;   // 面板刚弹出时短暂屏蔽点击，避免摇杆没松就选中卡
  function offerCards() {
    const all = CARDS.concat(CURSES);
    const avail = all.filter(c => (stacks[c.id] || 0) < MAX_STACK);
    offer = pickN(avail, 3);
    if (Math.random() < .3) offer = offer.concat(pickN(CURSES.filter(c => (stacks[c.id] || 0) < MAX_STACK), 1));
    picked = -1; anim = 0; setOpen(true);
    inputLockT = performance.now() + 350;
    try { if (typeof joy !== 'undefined' && joy) joy = null; } catch (e) {}   // 顺手松开摇杆
  }
  function grantReroll() {
    if (rerollToken) return false;
    rerollToken = true;
    return true;
  }
  function rerollOffer() {
    if (!open || !rerollToken) return;
    rerollToken = false;
    offerCards();
  }
  function choose(i) {
    if (!open || i < 0 || i >= offer.length) return;
    const c = offer[i];
    if ((stacks[c.id] || 0) >= MAX_STACK) return;
    stacks[c.id] = (stacks[c.id] || 0) + 1;
    c.apply(); picked = i; setOpen(false);
    if (typeof toast === 'function') toast('锦囊：' + c.name);
    if (typeof say === 'function') say('获得「' + c.name + '」—— ' + c.desc, 3);
  }

  function draw() {
    if (!open) return false;
    const W = cv.width / DPR, H = cv.height / DPR;
    ctx.save();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(10,7,9,.78)'; ctx.fillRect(0, 0, W, H);
    const F = '"PingFang SC","Noto Sans CJK SC",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const compact = H < 500;
    const titleY = H * (compact ? .12 : .17);
    ctx.font = '900 26px ' + F; ctx.fillStyle = '#f3d27c'; ctx.fillText('锦囊', W / 2, titleY);
    ctx.font = '600 14px ' + F; ctx.fillStyle = 'rgba(242,230,201,.88)';
    ctx.fillText('选一个带走（本局有效）· 按 1~4 或点击', W / 2, titleY + 26);

    rects = [];
    const n = offer.length, gap = Math.min(14, W * .018);
    const ch = Math.min(290, H * (compact ? .62 : .5));
    const cw = Math.min(194, (W - 48 - gap * (n - 1)) / n, ch * .68);
    const x0 = (W - (cw * n + gap * (n - 1))) / 2, y0 = H * (compact ? .245 : .29);
    const frame = typeof IMG !== 'undefined' ? IMG.ui_rogue_card : null;
    for (let i = 0; i < n; i++) {
      const c = offer[i], x = x0 + i * (cw + gap), y = y0 + Math.sin(anim * 1.5 + i) * 2;
      const curse = !!c.curse;
      if (frame && frame.complete && frame.naturalWidth) ctx.drawImage(frame, x, y, cw, ch);
      else {
        ctx.fillStyle = '#342117'; ctx.fillRect(x, y, cw, ch);
        ctx.strokeStyle = '#9c7042'; ctx.lineWidth = 4; ctx.strokeRect(x + 2, y + 2, cw - 4, ch - 4);
      }
      if (curse) { ctx.fillStyle = 'rgba(100,18,12,.24)'; ctx.fillRect(x + 12, y + 22, cw - 24, ch - 44); }
      ctx.save(); ctx.beginPath(); ctx.rect(x + 18, y + 24, cw - 36, ch - 48); ctx.clip();
      if (curse) { ctx.fillStyle = 'rgba(140,30,18,.34)'; ctx.fillRect(x + 19, y + 24, cw - 38, 47); }
      ctx.font = '700 12px ' + F; ctx.fillStyle = curse ? '#ffc1a8' : '#d5b678';
      ctx.fillText(c.school, x + cw / 2, y + ch * .18, cw - 38);
      ctx.font = '900 ' + Math.round(Math.min(20, cw / 7)) + 'px ' + F;
      ctx.fillStyle = curse ? '#ffd0c8' : '#ffe08a';
      ctx.shadowColor = 'rgba(24,12,6,.9)'; ctx.shadowBlur = 3;
      ctx.fillText(c.name, x + cw / 2, y + ch * .29, cw - 38); ctx.shadowBlur = 0;
      const descSize = Math.max(9, Math.min(12, cw * .067));
      ctx.font = '600 ' + descSize + 'px ' + F; ctx.fillStyle = '#f2e6c9';
      let line = '', ly = y + ch * .41;
      const lineH = descSize * 1.42;
      for (const ch2 of c.desc) {
        const tooWide = ctx.measureText(line + ch2).width > cw - 42;
        if (tooWide && /[）\])，。；：、！？，%]/.test(ch2) && line) line += ch2;
        else if (tooWide) { ctx.fillText(line, x + cw / 2, ly, cw - 40); line = ch2; ly += lineH; }
        else line += ch2;
      }
      if (line) ctx.fillText(line, x + cw / 2, ly, cw - 40);
      const st = stacks[c.id] || 0;
      ctx.font = '700 11px ' + F; ctx.fillStyle = st >= MAX_STACK ? '#b8dc88' : 'rgba(242,230,201,.8)';
      ctx.fillText('已拿 ' + st + '/' + MAX_STACK, x + cw / 2, y + ch * .82);
      ctx.font = '900 13px ' + F; ctx.fillStyle = '#f3d27c';
      ctx.fillText(String(i + 1), x + cw / 2, y + ch * .90);
      ctx.restore();
      rects.push({ x, y, w: cw, h: ch, i });
    }
    rerollRect = null;
    if (rerollToken) {
      const bw = Math.min(210, W - 40), bh = 42;
      const bx = (W - bw) / 2, by = Math.min(H - bh - 8, y0 + ch + 12);
      ctx.fillStyle = '#503019'; ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = '#d9b667'; ctx.lineWidth = 2; ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
      ctx.font = '900 15px ' + F; ctx.fillStyle = '#ffe49a'; ctx.fillText('ROLL　重抽一次', W / 2, by + 27);
      rerollRect = { x: bx, y: by, w: bw, h: bh };
    }
    ctx.restore();
    return true;
  }

  function update(dt) { if (open) anim += dt; }
  addEventListener('pointerdown', e => {
    if (!open) return;
    if (performance.now() < inputLockT) { e.preventDefault(); e.stopPropagation(); return; }   // 防误触
    if (rerollRect && e.clientX >= rerollRect.x && e.clientX <= rerollRect.x + rerollRect.w && e.clientY >= rerollRect.y && e.clientY <= rerollRect.y + rerollRect.h) {
      e.preventDefault(); e.stopPropagation(); rerollOffer(); return;
    }
    for (const r of rects) if (e.clientX >= r.x && e.clientX <= r.x + r.w && e.clientY >= r.y && e.clientY <= r.y + r.h) {
      e.preventDefault(); e.stopPropagation(); choose(r.i); return;
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
    S, offer: offerCards, blocks: () => open, draw, update, choose, grantReroll, rerolls: () => rerollToken,
    pickedUp: () => stacks, cards: () => offer, reset: () => {
      setOpen(false); offer = []; picked = -1; rerollToken = false; rerollRect = null;
      for (const k in stacks) delete stacks[k];
      for (const k in DEFAULT) S[k] = DEFAULT[k];
    },
  };
})();
