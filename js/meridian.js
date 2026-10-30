// 经脉（用户定，仿梦幻西游奇经八脉）：整军备战「经脉」栏点开。一棵 3 列 × 7 行的树：左攻、中身法、右守。
// 每行点 1 格、只能点在上一格的正下方或斜下方，每格花 1 颗通脉丹。点满 7 格才揭晓封号（某列 ≥4 格封那一列，否则安邦上将）。
// 通脉丹：第一/二/三章首通各 1、各章校场第 5 层各 1、任意魔化通关 1，共 7 颗。重置 200 金币，全部返还。
// 节点以数值为主（不和锦囊撞机制）；数值走 gear_combat 的 stat()，少数特殊效果在 game.js 里按 MERIDIAN.x(key) 读取。
(() => {
  const COLS = [
    { id: 'gong', name: '攻', color: '#e0533a' },
    { id: 'ji', name: '身法', color: '#3fb6c8' },
    { id: 'shou', name: '守', color: '#e2b23c' },
  ];
  // 穴位：在人物剪影上的位置（相对剪影外框的比例），从上往下对应第 1–7 行
  const POINTS = [
    { name: '百会', note: '头顶正中，诸阳之会', x: .52, y: .06 },
    { name: '膻中', note: '两乳之间，气之海', x: .5, y: .36 },
    { name: '肩井', note: '肩上凹陷处', x: .7, y: .28 },
    { name: '曲池', note: '屈肘横纹尽头', x: .78, y: .47 },
    { name: '气海', note: '脐下一寸半，元气所聚', x: .5, y: .55 },
    { name: '足三里', note: '膝下三寸，强健之穴', x: .42, y: .8 },
    { name: '涌泉', note: '足底前部，肾经之始', x: .44, y: .97 },
  ];
  // e：数值（gear_combat 的属性键：sharp 伤害、critical 暴击率、severity 暴击伤害、charge 蓄力伤害、swift 攻速、move 移速、
  //    health 血量（0.1=1 血）、guard 减伤、reach 攻击距离、dodge 闪避）；x：特殊效果
  const T = [
    [{ s: '怒', n: '怒目', d: '伤害 +6%', e: { sharp: .06 } }, { s: '轻', n: '轻身', d: '移速 +8%、攻速 +3%', e: { move: .08, swift: .03 } }, { s: '筋', n: '筋骨', d: '血量上限 +1', e: { health: .1 } }],
    [{ s: '狠', n: '狠劲', d: '暴击率 +8%', e: { critical: .08 } }, { s: '捷', n: '捷手', d: '攻速 +5%', e: { swift: .05 } }, { s: '硬', n: '硬气', d: '受到伤害 -6%', e: { guard: .06 } }],
    [{ s: '重', n: '重手', d: '蓄力伤害 +15%', e: { charge: .15 } }, { s: '凝', n: '凝神', d: '蓄力速度 +15%', x: { chargeMul: .87 } }, { s: '桩', n: '稳桩', d: '更难被打倒：击倒伤害门槛 +40%', x: { knock: 1.4 } }],
    [{ s: '烈', n: '烈劲', d: '暴击伤害 +40%', e: { severity: .4 } }, { s: '滑', n: '滑步', d: '翻滚距离 +20%', x: { roll: 1.2 } }, { s: '起', n: '鲤跃', d: '倒地起身快 30%', x: { getup: .7 } }],
    [{ s: '猎', n: '猎首', d: '打精英、首领伤害 +10%', x: { elite: .1 } }, { s: '令', n: '令行', d: '将令（U）冷却 -15%', x: { skillCd: .85 } }, { s: '气', n: '回气', d: '每清空一波敌人回 0.5 血', x: { waveHeal: .5 } }],
    [{ s: '锐', n: '锐气', d: '伤害 +6%', e: { sharp: .06 } }, { s: '疾', n: '疾行', d: '移速 +8%、攻速 +3%', e: { move: .08, swift: .03 } }, { s: '骨', n: '铁骨', d: '血量上限 +1', e: { health: .1 } }],
    [{ s: '破', n: '破盾', d: '伤害 +6%；盾兵正面减伤降低（近战降一半、远程降四分之一）', e: { sharp: .06 }, x: { shield: 1 } }, { s: '闪', n: '灵闪', d: '10% 概率闪开敌人的普通攻击', e: { dodge: .1 } }, { s: '屈', n: '不屈', d: '抵御一次致命伤（保留 1 血），一局一次', x: { unyield: 1 } }],
  ];
  const TITLES = {
    gong: { name: '陷阵虎将', eff: '虎威：暴击率 +10%，暴击伤害 +50%', e: { critical: .1, severity: .5 } },
    ji: { name: '破虏飞将', eff: '飞将：攻速 +15%，移速 +15%', e: { swift: .15, move: .15 } },
    shou: { name: '镇关宿将', eff: '镇关：每受伤一次积 1 层，满 5 层震开周围敌人并回 1 血', x: { zhenguan: 1 } },
    mix: { name: '安邦上将', eff: '安邦：伤害、移速、减伤各 +6%', e: { sharp: .06, move: .06, guard: .06 } },
  };
  const SOURCES = [
    ['ch1', '第一章首次通关'], ['ch2', '第二章首次通关'], ['ch3', '第三章首次通关（未开放）'],
    ['xc1', '第一章校场演武第 5 层'], ['xc2', '第二章校场演武第 5 层'], ['xc3', '第三章校场演武第 5 层（未开放）'], ['mo', '任意一次魔化通关'],
  ];
  const RESET_COST = 200;

  const profile = () => window.ARMORY && ARMORY.state ? ARMORY.state() : null;
  function store() {
    const p = profile(); if (!p) return { got: {}, path: [], _at: 0 };
    if (!p.meridian || typeof p.meridian !== 'object') p.meridian = { got: {}, path: [], _at: 0 };
    p.meridian.got ||= {}; if (!Array.isArray(p.meridian.path)) p.meridian.path = [];
    return p.meridian;
  }
  const save = () => { if (window.ARMORY && ARMORY.saveNow) ARMORY.saveNow(); };
  const total = () => Object.keys(store().got).filter(k => SOURCES.some(s => s[0] === k)).length;
  const path = () => store().path.slice(0, 7);
  const free = () => Math.max(0, total() - path().length);
  function titleKey() {
    const p = path(); if (p.length < 7) return '';
    const c = [0, 0, 0]; p.forEach(i => c[i]++);
    const best = c.indexOf(Math.max(...c));
    return c[best] >= 4 ? COLS[best].id : 'mix';
  }
  const label = () => { const k = titleKey(); return k ? TITLES[k].name : path().length ? `已通 ${path().length}/7` : '未通'; };
  function award(key) {   // 拿到一颗通脉丹（每个来源只给一次）；返回 true 表示这次是新给的
    const s = store(); if (s.got[key]) return false;
    s.got[key] = 1; s._at = Date.now(); save(); return true;
  }
  const canPick = (row, col) => { const p = path(); return row === p.length && free() > 0 && (row === 0 || Math.abs(col - p[row - 1]) <= 1); };
  function pick(row, col) { if (!canPick(row, col)) return false; const s = store(); s.path = path().concat(col); s._at = Date.now(); save(); return true; }
  function reset() {
    if (!path().length) return 'empty';
    if (!window.WALLET || !WALLET.spendCoins(RESET_COST)) return 'coins';
    const s = store(); s.path = []; s._at = Date.now(); save(); return 'ok';
  }

  // ---- 数值汇总（缓存到下次面板改动；path 很短，直接算也很便宜）----
  function sums() {
    const e = {}, x = {};
    const add = (src, dst, mul) => { for (const k in src || {}) dst[k] = mul ? (dst[k] ?? 1) * src[k] : (dst[k] || 0) + src[k]; };
    path().forEach((c, r) => { const n = T[r][c]; add(n.e, e); add(n.x, x, false); });
    // 乘法类特殊效果：chargeMul / skillCd / roll / getup / knock 取乘积
    const mulKeys = ['chargeMul', 'skillCd', 'roll', 'getup', 'knock']; for (const k of mulKeys) { x[k] = 1; path().forEach((c, r) => { const v = T[r][c].x?.[k]; if (v) x[k] *= v; }); }
    const tk = titleKey(); if (tk) { add(TITLES[tk].e, e); add(TITLES[tk].x, x); }
    return { e, x };
  }
  const stat = k => sums().e[k] || 0;
  const x = (k, d = 0) => { const v = sums().x[k]; return v == null ? d : v; };

  // ---- 局内：不屈 / 回气 / 镇关 ----
  const R = { unyield: false, alive: 0, stack: 0 };
  function startRun() { R.unyield = x('unyield') > 0; R.alive = 0; R.stack = 0; }
  function tryUnyield() {   // game.js dmgHero：这一下会致死时调用，返回 true 表示挡住（留 1 血）
    if (!R.unyield) return false; R.unyield = false;
    if (typeof hero === 'undefined') return false;
    hero.hp = 1; hero.inv = 1.5;
    if (typeof floaters !== 'undefined') floaters.push({ x: hero.x, y: hero.y - 50, t: 0, txt: '不屈！', big: true, color: '#e2b23c' });
    return true;
  }
  function onHurt() {   // 镇关：受伤积层，满 5 层震开周围并回 1 血
    if (!x('zhenguan') || typeof hero === 'undefined') return;
    if (++R.stack < 5) return; R.stack = 0;
    if (typeof shake !== 'undefined') shake = Math.max(shake, .35);
    for (const z of zs) if (!z.dead && !z.air && Math.hypot(z.x - hero.x, (z.y - hero.y) * 2) < 70) hit(z, .5, 140, Math.sign(z.x - hero.x) || 1, true, 0, .4, true, false, { secondary: true });
    hero.hp = Math.min(typeof maxHeroHp === 'function' ? maxHeroHp() : 10, hero.hp + 1);
    if (typeof floaters !== 'undefined') floaters.push({ x: hero.x, y: hero.y - 50, t: 0, txt: '镇关！+1', big: true, color: '#e2b23c' });
  }
  function tick() {   // 回气：场上敌人从有到清空（每一波）回血
    const heal = x('waveHeal'); if (!heal || typeof zs === 'undefined' || typeof hero === 'undefined') return;
    const alive = zs.filter(z => !z.dead && !z.ally && !z.decoy).length;
    if (R.alive > 0 && alive === 0 && hero.hp > 0) { hero.hp = Math.min(typeof maxHeroHp === 'function' ? maxHeroHp() : 10, hero.hp + heal); if (typeof floaters !== 'undefined') floaters.push({ x: hero.x, y: hero.y - 50, t: 0, txt: '回气 +' + heal, color: '#8fe08a' }); }
    R.alive = alive;
  }

  // ---- 面板 ----
  let sel = null, msg = '';
  function open() {
    let box = document.getElementById('meridianPanel');
    if (!box) {
      box = document.createElement('div'); box.id = 'meridianPanel';
      const css = document.createElement('style');
      css.textContent = '#meridianPanel{position:fixed;inset:0;z-index:10002;display:flex;align-items:center;justify-content:center;padding:8px;box-sizing:border-box;background:#100b08c9;font:14px/1.5 sans-serif}#meridianPanel[hidden]{display:none!important}#meridianPanel section{position:relative;box-sizing:border-box;width:min(760px,97vw);max-height:96dvh;overflow:auto;padding:clamp(10px,2.4vh,20px) clamp(10px,2.5vw,22px);background:linear-gradient(#3b2c20,#271c14);border:2px solid #9d7845;border-radius:10px;box-shadow:0 12px 40px #000a;color:#ecdcbc}#meridianPanel h3{margin:0 0 2px;text-align:center;font:700 22px MaShanZheng,"STKaiti",serif;color:#f1d58f}#meridianPanel .mx{position:absolute;right:12px;top:10px;border:1px solid #8a6538;background:#5a3923;color:#f5dfb2;border-radius:6px;min-height:32px;padding:2px 14px;cursor:pointer}#meridianPanel .mtop{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 14px;font-size:12px;color:#cdb78e;margin:2px 0 8px}#meridianPanel .mtop b{color:#f1d58f}#meridianPanel .mrst{border:1px solid #8a6538;background:#4a3020;color:#f5dfb2;border-radius:5px;padding:0 10px;cursor:pointer;min-height:24px}#meridianPanel .mbody{display:flex;gap:12px;align-items:stretch}#meridianPanel .mgrid{position:relative;flex:0 0 auto;display:grid;grid-template-columns:repeat(3,46px);grid-auto-rows:46px;gap:8px 22px;padding:8px 10px;background:#2a1f17;border:1px solid #6e5232;border-radius:8px}#meridianPanel .mgrid svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}#meridianPanel .mn{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;border:2px solid #5b4630;border-radius:6px;background:#1c140e;color:var(--c);opacity:.5;font:700 20px MaShanZheng,"STKaiti",serif;cursor:pointer;padding:0}#meridianPanel .mn.can,#meridianPanel .mn.on{opacity:1}#meridianPanel .mn.can{border-color:var(--c);color:var(--c);box-shadow:0 0 8px var(--c);animation:mPulse 1.2s ease-in-out infinite}#meridianPanel .mn.on{background:var(--c);border-color:#fff3c4;color:#1c140e;box-shadow:0 0 10px var(--c)}#meridianPanel .mn.sel{outline:2px solid #fff3c4;outline-offset:2px}@keyframes mPulse{50%{box-shadow:0 0 2px var(--c)}}#meridianPanel .mfig{position:relative;flex:1;min-width:170px;min-height:260px;background:radial-gradient(circle at 50% 45%,#4a3626,#2a1f17 70%);border:1px solid #6e5232;border-radius:8px;overflow:hidden}#meridianPanel .mfig canvas{position:absolute;inset:0;width:100%;height:100%}#meridianPanel .mseal{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-6deg);padding:6px 14px;border:3px solid #c0392b;color:#ffe2b8;background:#8e1f14d9;font:700 26px MaShanZheng,"STKaiti",serif;letter-spacing:4px;border-radius:6px;box-shadow:0 0 18px #000a;animation:mSeal .6s ease-out}@keyframes mSeal{from{transform:translate(-50%,-50%) rotate(-6deg) scale(2.2);opacity:0}}#meridianPanel .mdet{margin-top:8px;padding:8px 10px;background:#35271de8;border:1px solid #805d37;border-radius:6px;min-height:44px;font-size:13px}#meridianPanel .mdet b{color:#f1d58f;margin-right:8px}#meridianPanel .mdet i{font-style:normal;color:#8fb8c8;font-size:12px}#meridianPanel .mdet p{margin:3px 0 0;color:#d9c8a4}#meridianPanel details{margin-top:6px;font-size:12px;color:#cdb78e}#meridianPanel details li.ok{color:#8fe08a}@media(max-height:450px){#meridianPanel .mgrid{grid-template-columns:repeat(3,34px);grid-auto-rows:34px;gap:4px 16px}#meridianPanel .mn{font-size:15px}#meridianPanel .mfig{min-height:200px}}';
      document.head.append(css); document.body.append(box);
      box.addEventListener('click', e => {
        const n = e.target.closest('[data-r]');
        if (n) {
          const r = +n.dataset.r, c = +n.dataset.c; sel = [r, c]; msg = '';
          if (canPick(r, c)) { pick(r, c); if (path().length === 7) msg = 'seal'; refresh(); }
          else if (path()[r] !== c && r === path().length && !free()) msg = '通脉丹不够了';
          render(box); return;
        }
        if (e.target.closest('.mrst')) { const res = reset(); msg = res === 'coins' ? `金币不够（重置要 ${RESET_COST}）` : res === 'ok' ? '经脉已重置，通脉丹全部返还' : ''; sel = null; render(box); refresh(); return; }
        if (e.target === box || e.target.closest('.mx')) box.hidden = true;
      });
    }
    msg = ''; render(box); box.hidden = false;
  }
  const refresh = () => { try { if (window.TITLE && TITLE.refreshPreparation) TITLE.refreshPreparation(); } catch (e) {} };
  function render(box) {
    const p = path(), tk = titleKey();
    const cells = T.map((row, r) => row.map((n, c) => {
      const on = p[r] === c, can = canPick(r, c), isSel = sel && sel[0] === r && sel[1] === c;
      return `<button type="button" class="mn${on ? ' on' : ''}${can ? ' can' : ''}${isSel ? ' sel' : ''}" style="--c:${COLS[c].color}" data-r="${r}" data-c="${c}" title="${n.n}：${n.d}">${n.s}</button>`;
    }).join('')).join('');
    const sn = sel ? T[sel[0]][sel[1]] : null, pt = sel ? POINTS[sel[0]] : null;
    const det = msg && msg !== 'seal' ? `<b>${msg}</b>` : sn ? `<b>${sn.n}</b><i>第 ${sel[0] + 1} 层 · ${pt.name}穴（${pt.note}）</i><p>${sn.d}</p>` : tk ? `<b>封 · ${TITLES[tk].name}</b><p>${TITLES[tk].eff}</p>` : '<p>点亮的格子之间要相连：下一格只能在上一格的正下方或斜下方。点满 7 层揭晓封号。</p>';
    const srcs = SOURCES.map(([k, t]) => `<li class="${store().got[k] ? 'ok' : ''}">${store().got[k] ? '✓ ' : ''}${t}</li>`).join('');
    box.innerHTML = `<section><button class="mx" type="button">关闭</button><h3>经脉</h3><div class="mtop"><span>通脉丹：可用 <b>${free()}</b> · 已用 <b>${p.length}</b> · 共获得 <b>${total()}</b>/7</span><span>封号：<b>${tk ? TITLES[tk].name : '？？？（点满 7 层揭晓）'}</b></span><button type="button" class="mrst">重置（${RESET_COST} 金币）</button></div><div class="mbody"><div class="mgrid"><svg></svg>${cells}</div><div class="mfig"><canvas></canvas>${tk && msg === 'seal' ? `<div class="mseal">封 · ${TITLES[tk].name}</div>` : ''}</div></div><div class="mdet">${det}</div><details><summary>通脉丹从哪里来</summary><ul>${srcs}</ul></details></section>`;
    requestAnimationFrame(() => { drawLines(box); drawFigure(box); });
  }
  function drawLines(box) {   // 点亮的格子之间连发光的线
    const g = box.querySelector('.mgrid'), svg = g && g.querySelector('svg'); if (!svg) return;
    const gr = g.getBoundingClientRect(), p = path();
    const ctr = (r, c) => { const b = g.querySelector(`[data-r="${r}"][data-c="${c}"]`).getBoundingClientRect(); return [b.left - gr.left + b.width / 2, b.top - gr.top + b.height / 2]; };
    let h = '';
    for (let r = 1; r < p.length; r++) { const [x1, y1] = ctr(r - 1, p[r - 1]), [x2, y2] = ctr(r, p[r]); h += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${COLS[p[r]].color}" stroke-width="5" stroke-linecap="round" opacity=".85"/>`; }
    svg.setAttribute('viewBox', `0 0 ${gr.width} ${gr.height}`); svg.innerHTML = h;
  }
  let sil = null;
  function silhouette() {   // 用主角站立图生成纯色剪影
    if (sil) return sil;
    const fr = typeof CH !== 'undefined' && CH.hero && CH.hero.idle; if (!fr || !fr.img.complete || !fr.img.naturalWidth) return null;
    const im = fr.img, c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#7a5a3c'; x.fillRect(0, 0, c.width, c.height);
    // 去掉透明边，得到人物外框
    let d; try { d = x.getImageData(0, 0, c.width, c.height).data; } catch (e) { sil = { c, bx: 0, by: 0, bw: c.width, bh: c.height }; return sil; }
    let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
    for (let yy = 0; yy < c.height; yy++) for (let xx = 0; xx < c.width; xx++) if (d[(yy * c.width + xx) * 4 + 3] > 20) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
    sil = { c, bx: x0, by: y0, bw: Math.max(1, x1 - x0 + 1), bh: Math.max(1, y1 - y0 + 1) }; return sil;
  }
  function drawFigure(box) {
    const cv = box.querySelector('.mfig canvas'); if (!cv) return;
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1; cv.width = r.width * dpr; cv.height = r.height * dpr;
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.imageSmoothingEnabled = false;
    const s = silhouette(), p = path(), tk = titleKey();
    const H = r.height * .86, W = s ? H * s.bw / s.bh : H * .45, ox = (r.width - W) / 2, oy = (r.height - H) / 2;
    if (tk) { c.save(); c.shadowColor = tk === 'mix' ? '#f1d58f' : COLS[COLS.findIndex(q => q.id === tk)].color; c.shadowBlur = 24; }
    if (s) c.drawImage(s.c, s.bx, s.by, s.bw, s.bh, ox, oy, W, H); else { c.fillStyle = '#7a5a3c'; c.fillRect(ox, oy, W, H); }
    if (tk) c.restore();
    const pos = i => [ox + POINTS[i].x * W, oy + POINTS[i].y * H];
    // 经络连线：已点亮的穴位之间
    c.lineWidth = 2; c.setLineDash([3, 4]);
    for (let i = 1; i < p.length; i++) { const [a, b] = pos(i - 1), [e, f] = pos(i); c.strokeStyle = COLS[p[i]].color; c.globalAlpha = .7; c.beginPath(); c.moveTo(a, b); c.lineTo(e, f); c.stroke(); }
    c.setLineDash([]); c.globalAlpha = 1;
    POINTS.forEach((pt, i) => {
      const [px, py] = pos(i), on = p[i] != null, col = on ? COLS[p[i]].color : '#3b2c20';
      if (on) { c.fillStyle = col; c.globalAlpha = .3; c.beginPath(); c.arc(px, py, 11, 0, 7); c.fill(); c.globalAlpha = 1; }
      c.fillStyle = on ? '#fff3c4' : '#2a1f17'; c.strokeStyle = on ? col : '#a68a62'; c.lineWidth = 2.5; c.beginPath(); c.arc(px, py, 5.5, 0, 7); c.fill(); c.stroke();
      if (sel && sel[0] === i) { c.strokeStyle = '#fff3c4'; c.lineWidth = 1.5; c.beginPath(); c.arc(px, py, 10, 0, 7); c.stroke(); }
    });
    if (!s) setTimeout(() => { if (!box.hidden) drawFigure(box); }, 400);
  }

  window.MERIDIAN = { COLS, T, TITLES, SOURCES, open, label, award, stat, x, startRun, tryUnyield, onHurt, tick, total, free, path, titleKey, pick, canPick };
})();
