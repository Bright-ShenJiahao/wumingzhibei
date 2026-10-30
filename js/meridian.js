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
  // 穴位（用户定：像梦幻西游，点不同节点亮不同位置）：攻在两臂和拳、身法在腿脚、守在头和躯干。坐标是 mer_body 剪影外框的比例
  const PTS = [
    [{ name: '肩髃', note: '肩头前凹陷处', x: .74, y: .33 }, { name: '环跳', note: '臀外侧，髋关节处', x: .37, y: .6 }, { name: '百会', note: '头顶正中，诸阳之会', x: .51, y: .07 }],
    [{ name: '臂臑', note: '上臂外侧，三角肌下', x: .8, y: .41 }, { name: '风市', note: '大腿外侧中部', x: .66, y: .66 }, { name: '大椎', note: '颈后第七颈椎下', x: .51, y: .29 }],
    [{ name: '曲池', note: '屈肘横纹尽头', x: .85, y: .5 }, { name: '血海', note: '大腿内侧，膝上二寸', x: .36, y: .71 }, { name: '膻中', note: '两乳之间，气之海', x: .49, y: .38 }],
    [{ name: '合谷', note: '虎口处，手阳明之原', x: .87, y: .63 }, { name: '足三里', note: '膝下三寸，强健之穴', x: .66, y: .79 }, { name: '中脘', note: '脐上四寸，胃之募穴', x: .49, y: .46 }],
    [{ name: '肩井', note: '肩上凹陷处', x: .2, y: .34 }, { name: '阳陵泉', note: '膝外下方，筋之会', x: .32, y: .79 }, { name: '气海', note: '脐下一寸半，元气所聚', x: .49, y: .54 }],
    [{ name: '手三里', note: '肘下二寸，前臂外侧', x: .05, y: .43 }, { name: '承山', note: '小腿后正中', x: .7, y: .88 }, { name: '关元', note: '脐下三寸，元阴元阳交关', x: .49, y: .6 }],
    [{ name: '劳宫', note: '掌心，握拳中指尖处', x: .28, y: .51 }, { name: '涌泉', note: '足底前部，肾经之始', x: .2, y: .97 }, { name: '命门', note: '腰后正中，生命之门', x: .55, y: .51 }],
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
  // 整军备战里 经脉/神器/时装 三个按钮：换成和「校场演武」同款的横幅（暗红底+右侧插画，文字靠左）
  { const st = document.createElement('style'); st.textContent = '.outfitSlot.outfitSlot.bnr{background:var(--bnr) right center/cover no-repeat,#5a1610!important;border:2px solid #d4a24c!important;box-shadow:inset 0 0 0 1px #2a0a06,0 3px 8px #120a08aa!important;min-height:58px}.outfitSlot.bnr .outfitIco{display:none}.outfitSlot.bnr .outfitCopy{left:14px;right:auto;text-align:left;text-shadow:0 1px 3px #000,0 0 6px #000}.outfitSlot.bnr .outfitCopy strong{font-family:MaShanZheng,"STKaiti",serif;font-size:clamp(16px,1.9vw,21px);color:#ffe2a0;letter-spacing:2px}.outfitSlot.bnr .outfitCopy small{color:#f1d9b0}.outfitSlot.bnr:hover{filter:brightness(1.12)}'; (document.head || document.documentElement).append(st); }

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

  // ---- 面板（仿梦幻西游：亮色羊皮纸底、左边图标格+直角发光连线、右边主角剪影+穴位）----
  const uiImg = k => (typeof ASSETS !== 'undefined' && ASSETS.ui && ASSETS.ui[k]) || '';
  let sel = null, msg = '';
  function open() {
    let box = document.getElementById('meridianPanel');
    if (!box) {
      box = document.createElement('div'); box.id = 'meridianPanel';
      const css = document.createElement('style');
      css.textContent = '#meridianPanel{position:fixed;inset:0;z-index:10002;display:flex;align-items:center;justify-content:center;padding:8px;box-sizing:border-box;background:#100b08c9;font:14px/1.5 sans-serif}#meridianPanel[hidden]{display:none!important}#meridianPanel section{position:relative;box-sizing:border-box;width:min(820px,97vw);max-height:96dvh;overflow:auto;padding:clamp(8px,2vh,16px) clamp(10px,2.4vw,20px);background:linear-gradient(#f3e6c8,#e6d3aa);border:3px solid #b8863e;border-radius:12px;box-shadow:inset 0 0 0 2px #fff4d8,0 12px 40px #000a;color:#5a3c22}#meridianPanel h3{margin:-2px auto 6px;width:max-content;padding:2px 34px;text-align:center;font:700 20px MaShanZheng,"STKaiti",serif;color:#fff1cc;background:linear-gradient(#c79a4c,#9a6c2c);border-radius:0 0 14px 14px;text-shadow:0 1px 2px #5a3010}#meridianPanel .mx{position:absolute;right:10px;top:8px;width:34px;height:34px;border:2px solid #fff1cc;background:radial-gradient(#f08a3a,#c0501a);color:#fff;border-radius:50%;font-size:18px;line-height:28px;cursor:pointer;padding:0}#meridianPanel .mtop{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:6px 10px;font-size:12px;margin:0 0 8px}#meridianPanel .mtop span{padding:2px 10px;background:#fff6e0;border:1px solid #d2b27a;border-radius:6px}#meridianPanel .mtop b{color:#b4421c}#meridianPanel .mrst{border:1px solid #b8863e;background:linear-gradient(#fbe7b6,#e8c47e);color:#6a3f16;border-radius:6px;padding:2px 12px;cursor:pointer;font-weight:700}#meridianPanel .mbody{display:flex;gap:12px;align-items:stretch}#meridianPanel .mgrid{position:relative;flex:0 0 auto;display:grid;grid-template-columns:repeat(3,54px);grid-auto-rows:54px;gap:10px 24px;padding:10px 14px;background:#ead8b0;border:1px solid #c9a86e;border-radius:8px}#meridianPanel .mgrid svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible}#meridianPanel .mn{position:relative;z-index:1;padding:0;border:3px solid #a99a83;border-radius:6px;background:#3a2c20 center/cover no-repeat;cursor:pointer;filter:grayscale(1) brightness(.85);box-shadow:0 2px 3px #0005}#meridianPanel .mn.can{filter:none;border-color:var(--c);animation:mPulse 1.1s ease-in-out infinite}#meridianPanel .mn.on{filter:none;border-color:#fff6d0;box-shadow:0 0 0 2px var(--c),0 0 14px 3px var(--c)}#meridianPanel .mn.sel{outline:2px dashed #7a4a1c;outline-offset:3px}@keyframes mPulse{50%{box-shadow:0 0 12px 2px var(--c)}}#meridianPanel .mfig{position:relative;flex:1;min-width:180px;min-height:300px;background:radial-gradient(circle at 50% 48%,#fbf1da 0,#f0e0bc 45%,#e6d3aa 75%);border:1px solid #c9a86e;border-radius:8px;overflow:hidden}#meridianPanel .mfig:before{content:"";position:absolute;left:50%;top:50%;width:78%;aspect-ratio:1;transform:translate(-50%,-50%);border:10px solid #e2cd9f;border-radius:50%;opacity:.7}#meridianPanel .mfig canvas{position:absolute;inset:0;width:100%;height:100%}#meridianPanel .mseal{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(-6deg);padding:6px 14px;border:3px solid #7a1a10;color:#ffe2b8;background:#a8261ae6;font:700 26px MaShanZheng,"STKaiti",serif;letter-spacing:4px;border-radius:6px;box-shadow:0 0 18px #0007;animation:mSeal .6s ease-out;white-space:nowrap}@keyframes mSeal{from{transform:translate(-50%,-50%) rotate(-6deg) scale(2.2);opacity:0}}#meridianPanel .mdet{margin-top:8px;padding:8px 10px;background:#fff6e0;border:1px solid #d2b27a;border-radius:6px;min-height:44px;font-size:13px}#meridianPanel .mdet b{color:#9a3a14;margin-right:8px}#meridianPanel .mdet i{font-style:normal;color:#5d7f8a;font-size:12px}#meridianPanel .mdet p{margin:3px 0 0}#meridianPanel details{margin-top:6px;font-size:12px}#meridianPanel details li.ok{color:#2f7a2a}@media(max-height:470px){#meridianPanel .mgrid{grid-template-columns:repeat(3,36px);grid-auto-rows:36px;gap:5px 16px;padding:6px 10px}#meridianPanel .mn{border-width:2px}#meridianPanel .mfig{min-height:230px}#meridianPanel h3{font-size:16px;margin-bottom:3px}}';
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
      addEventListener('resize', () => { if (!box.hidden) render(box); });
    }
    msg = ''; render(box); box.hidden = false;
  }
  const refresh = () => { try { if (window.TITLE && TITLE.refreshPreparation) TITLE.refreshPreparation(); } catch (e) {} };
  function render(box) {
    const p = path(), tk = titleKey();
    const cells = T.map((row, r) => row.map((n, c) => {
      const on = p[r] === c, can = canPick(r, c), isSel = sel && sel[0] === r && sel[1] === c, im = uiImg(`mer_${r}${c}`);
      return `<button type="button" class="mn${on ? ' on' : ''}${can ? ' can' : ''}${isSel ? ' sel' : ''}" style="--c:${COLS[c].color};${im ? `background-image:url(${im})` : ''}" data-r="${r}" data-c="${c}" title="${n.n}：${n.d}" aria-label="${n.n}">${im ? '' : n.s}</button>`;
    }).join('')).join('');
    const sn = sel ? T[sel[0]][sel[1]] : null, pt = sel ? PTS[sel[0]][sel[1]] : null;
    const det = msg && msg !== 'seal' ? `<b>${msg}</b>` : sn ? `<b>${sn.n}</b><i>第 ${sel[0] + 1} 层 · ${pt.name}穴（${pt.note}）</i><p>${sn.d}</p>` : tk ? `<b>封 · ${TITLES[tk].name}</b><p>${TITLES[tk].eff}</p>` : '<p>点亮的格子要相连：下一格只能在上一格的正下方或斜下方。点满 7 层揭晓封号。</p>';
    const srcs = SOURCES.map(([k, t]) => `<li class="${store().got[k] ? 'ok' : ''}">${store().got[k] ? '✓ ' : ''}${t}</li>`).join('');
    box.innerHTML = `<section><button class="mx" type="button" aria-label="关闭">✕</button><h3>经 脉</h3><div class="mtop"><span>可用通脉丹 <b>${free()}</b></span><span>已用 <b>${p.length}</b></span><span>共获得 <b>${total()}</b>/7</span><span>封号 <b>${tk ? TITLES[tk].name : '？？？'}</b></span><button type="button" class="mrst">重置经脉（${RESET_COST} 金币）</button></div><div class="mbody"><div class="mgrid"><svg></svg>${cells}</div><div class="mfig"><canvas></canvas>${tk && msg === 'seal' ? `<div class="mseal">封 · ${TITLES[tk].name}</div>` : ''}</div></div><div class="mdet">${det}</div><details><summary>通脉丹从哪里来</summary><ul>${srcs}</ul></details></section>`;
    requestAnimationFrame(() => { drawLines(box); drawFigure(box); });
  }
  function drawLines(box) {   // 直角折线：上一格底边 → 两行之间 → 横到下一格上方 → 下一格顶边
    const g = box.querySelector('.mgrid'), svg = g && g.querySelector('svg'); if (!svg) return;
    const gr = g.getBoundingClientRect(), p = path();
    const rect = (r, c) => { const b = g.querySelector(`[data-r="${r}"][data-c="${c}"]`).getBoundingClientRect(); return { x: b.left - gr.left + b.width / 2, t: b.top - gr.top, b: b.bottom - gr.top }; };
    let h = '';
    for (let r = 1; r < p.length; r++) {
      const a = rect(r - 1, p[r - 1]), b = rect(r, p[r]), my = (a.b + b.t) / 2, col = COLS[p[r]].color;
      const d = `M${a.x} ${a.b} V${my} H${b.x} V${b.t}`;
      h += `<path d="${d}" stroke="${col}" stroke-width="8" fill="none" opacity=".75" stroke-linejoin="round"/><path d="${d}" stroke="#fffbe8" stroke-width="2.5" fill="none" stroke-linejoin="round"/>`;
    }
    svg.setAttribute('viewBox', `0 0 ${gr.width} ${gr.height}`); svg.innerHTML = h;
  }
  let bodyImg = null;
  function body() { if (bodyImg) return bodyImg; const u = uiImg('mer_body'); if (!u) return null; bodyImg = new Image(); bodyImg.src = u; return bodyImg; }
  function drawFigure(box) {
    const cv = box.querySelector('.mfig canvas'); if (!cv) return;
    const r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1; cv.width = r.width * dpr; cv.height = r.height * dpr;
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const im = body(), p = path(), tk = titleKey();
    if (!im || !im.complete || !im.naturalWidth) { if (im) im.onload = () => drawFigure(box); return; }
    const H = r.height * .9, W = H * im.naturalWidth / im.naturalHeight, ox = (r.width - W) / 2, oy = (r.height - H) / 2;
    if (tk) { c.save(); c.shadowColor = tk === 'mix' ? '#f1c35a' : COLS[COLS.findIndex(q => q.id === tk)].color; c.shadowBlur = 30; c.drawImage(im, ox, oy, W, H); c.restore(); }
    c.drawImage(im, ox, oy, W, H);
    const T0 = performance.now() / 1000;
    PTS.forEach((row, ri) => row.forEach((pt, ci) => {
      const px = ox + pt.x * W, py = oy + pt.y * H, on = p[ri] === ci, col = COLS[ci].color;
      if (on) {
        const g = c.createRadialGradient(px, py, 0, px, py, 16); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.globalAlpha = .8; c.beginPath(); c.arc(px, py, 16, 0, 7); c.fill(); c.globalAlpha = 1;
        c.fillStyle = '#fffbe8'; c.strokeStyle = col; c.lineWidth = 3; c.beginPath(); c.arc(px, py, 6, 0, 7); c.fill(); c.stroke();
      } else { c.fillStyle = 'rgba(60,38,20,.55)'; c.beginPath(); c.arc(px, py, 3, 0, 7); c.fill(); }
      if (sel && sel[0] === ri && sel[1] === ci) { c.strokeStyle = '#fffbe8'; c.lineWidth = 2; c.setLineDash([3, 3]); c.beginPath(); c.arc(px, py, 11, 0, 7); c.stroke(); c.setLineDash([]); }
    }));
  }

  window.MERIDIAN = { COLS, T, TITLES, SOURCES, open, label, award, stat, x, startRun, tryUnyield, onHurt, tick, total, free, path, titleKey, pick, canPick };
})();
