// 商店商品（用户定 2026-10-31）：行军干粮 / 金创药 / 杜康酒 / 锦囊重抽符 / 护身符 / 强化符×6（每局最多带 1 张）/
// 重铸石（换掉武器一条词条）/ 武器锁定袋（仓库 +5，最多 3 次）/ 每日特价（每天一件 7 折）/ 天命签抽奖机。
// 消耗品买了存着，下一局自动带上（各 1 个）；存档字段 profile.goods。
(() => {
  const profile = () => window.ARMORY && ARMORY.state ? ARMORY.state() : null;
  const save = () => window.ARMORY && ARMORY.saveNow ? ARMORY.saveNow() : false;
  const FU = {
    fu_po: { name: '破军符', d: '伤害 +10%', k: 'sharp', v: .1 },
    fu_ji: { name: '疾风符', d: '攻速 +10%', k: 'swift', v: .1 },
    fu_shen: { name: '神行符', d: '移速 +12%', k: 'move', v: .12 },
    fu_gang: { name: '金刚符', d: '受到伤害 -10%', k: 'guard', v: .1 },
    fu_hui: { name: '会心符', d: '暴击率 +6%', k: 'critical', v: .06 },
    fu_ju: { name: '聚气符', d: '蓄力时间 -15%', k: 'chargeMul', v: .85 },
  };
  const CONS = {
    ration: { name: '行军干粮', d: '开局带 1 个鸡腿，按 H（手机点图标）随时吃，回 2 血', price: 40, icon: '粮' },
    jinchuang: { name: '金创药', d: '开局药格里存 1 瓶，血量掉到一半自动喝', price: 60, icon: '药' },
    dukang: { name: '杜康酒', d: '开局带 1 坛，按 Y（手机点图标）随时喝：10 秒伤害 +30%、攻速 +15%', price: 60, icon: '酒' },
    reroll: { name: '锦囊重抽符', d: '本局第一次选锦囊时可以重抽一次', price: 80, icon: '签' },
    amulet: { name: '护身符', d: '本局第一次被重击不会倒地', price: 120, icon: '护' },
  };
  function store() {
    const p = profile(); if (!p) return null;
    if (!p.goods || typeof p.goods !== 'object') p.goods = {};
    const g = p.goods; g.c ||= {}; g.off ||= {}; g.bag = Math.min(3, Math.max(0, g.bag | 0)); g.fu ||= ''; return g;
  }
  const count = id => { const g = store(); return g ? Math.max(0, g.c[id] | 0) : 0; };
  function add(id, n) { const g = store(); if (!g) return false; g.c[id] = count(id) + n; g._at = Date.now(); return save() !== false; }
  function take(id) { const g = store(); if (!g || count(id) <= 0) return false; g.c[id]--; g._at = Date.now(); save(); return true; }

  // ---- 每日特价：按本地日期挑一件，7 折 ----
  const ids = () => [...Object.keys(CONS), ...Object.keys(FU), 'stone'];
  function dailyId() { const d = new Date(), k = d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate(); const a = ids(); return a[(k * 2654435761 >>> 0) % a.length]; }
  const BASE = id => CONS[id] ? CONS[id].price : FU[id] ? 60 : id === 'stone' ? 300 : 0;
  const priceOf = id => Math.round(BASE(id) * (id === dailyId() ? .7 : 1));

  // ---- 局内 ----
  const R = { started: false, ration: 0, dukang: 0, jin: false, rerolled: false, amulet: false, fu: '' };
  function reset() { Object.assign(R, { started: false, ration: 0, dukang: 0, jin: false, rerolled: false, amulet: false, fu: '' }); hud(); }
  function off(id) { const g = store(); return !!(g && g.off[id]); }
  function tick() {   // game.js 每帧调用：真正开打的第一帧才消耗（不在标题页白扣）
    if (R.started || typeof hero === 'undefined' || (window.TITLE && TITLE.blocks && TITLE.blocks()) || (typeof result !== 'undefined' && result)) return;
    if (typeof zs === 'undefined' || !zs.some(z => !z.dead)) return;
    R.started = true; const got = [];
    for (const id of ['ration', 'dukang']) if (!off(id) && take(id)) { R[id] = 1; got.push(CONS[id].name); }
    if (!off('jinchuang') && take('jinchuang')) { R.jin = true; if (window.SUPPLY && SUPPLY.giveStash) SUPPLY.giveStash(); got.push('金创药'); }
    if (!off('reroll') && take('reroll') && window.ROGUE && ROGUE.grantReroll) { ROGUE.grantReroll(); got.push('锦囊重抽符'); }
    if (!off('amulet') && take('amulet')) { R.amulet = true; got.push('护身符'); }
    const g = store(); if (g && g.fu && FU[g.fu] && take(g.fu)) { R.fu = g.fu; got.push(FU[g.fu].name); }
    if (got.length && typeof floaters !== 'undefined') floaters.push({ x: hero.x, y: hero.y - 52, t: 0, txt: '带上：' + got.join('、'), color: '#ffd86e' });
    hud();
  }
  function eat() { if (!R.ration || typeof hero === 'undefined' || hero.hp <= 0) return; R.ration = 0; hero.hp = Math.min(typeof maxHeroHp === 'function' ? maxHeroHp() : 10, hero.hp + 2); if (typeof floaters !== 'undefined') floaters.push({ x: hero.x, y: hero.y - 50, t: 0, txt: '+2 行军干粮', heal: true }); if (typeof sfx === 'function') sfx('food', hero.x); hud(); }
  function drink() { if (!R.dukang || !window.SUPPLY || !SUPPLY.drink) return; R.dukang = 0; SUPPLY.drink(); hud(); }
  function useAmulet() { if (!R.amulet) return false; R.amulet = false; if (typeof floaters !== 'undefined') floaters.push({ x: hero.x, y: hero.y - 50, t: 0, txt: '护身符！', big: true, color: '#9fe3ff' }); return true; }
  const stat = k => { const f = FU[R.fu]; return f && f.k === k && k !== 'chargeMul' ? f.v : 0; };
  const chargeMul = () => { const f = FU[R.fu]; return f && f.k === 'chargeMul' ? f.v : 1; };
  addEventListener('keydown', e => { if (e.repeat) return; if (e.code === 'KeyH') eat(); if (e.code === 'KeyY') drink(); });
  // 手机：攻击键左上方两个小图标
  let bar = null;
  function hud() {
    if (!bar) { bar = document.createElement('div'); bar.id = 'goodsBar'; bar.style.cssText = 'position:fixed;z-index:3;right:calc(150px + env(safe-area-inset-right));bottom:calc(150px + env(safe-area-inset-bottom));display:flex;gap:6px';
      document.body.append(bar); bar.addEventListener('pointerdown', e => { const b = e.target.closest('[data-g]'); if (!b) return; e.preventDefault(); e.stopPropagation(); b.dataset.g === 'ration' ? eat() : drink(); }); }
    const btn = (k, t) => `<button type="button" data-g="${k}" style="width:42px;height:42px;padding:0;border-radius:50%;border:1.5px solid #e5c98a;background:rgba(40,26,16,.85);color:#ffe2a0;font:700 16px MaShanZheng,STKaiti,serif;touch-action:none">${t}</button>`;
    bar.innerHTML = (R.ration ? btn('ration', '粮') : '') + (R.dukang ? btn('dukang', '酒') : '');
  }

  // ---- 重铸石：选一把武器，随机换掉其中一条词条 ----
  function reforgeOne(uid) {
    const p = profile(), it = p && p.items.find(i => i.uid === uid), D = window.AFFIX_DATA; if (!it || !D || !it.affixes.length) return null;
    if (!take('stone')) return null;
    const i = Math.floor(Math.random() * it.affixes.length), old = it.affixes[i];
    const pool = Object.values(D.positive).filter(e => !it.affixes.some(a => a.id === e.id) && D.applicable({ id: e.id }, it.type));
    const def = pool[Math.floor(Math.random() * pool.length)]; if (!def) return null;
    it.affixes[i] = { id: def.id, tier: old.tier, value: def.values[old.tier] }; save();
    return { from: D.positive[old.id]?.name, to: def.name, item: it };
  }

  // ---- 天命签（抽奖机）----
  const PRIZES = [
    { w: 35, k: 'coin' }, { w: 20, k: 'fu' }, { w: 15, k: 'fruit' }, { w: 15, k: 'wq', q: [0, 1] }, { w: 8, k: 'wq', q: [2] },
    { w: 4, k: 'stone' }, { w: 2.5, k: 'wq', q: [3] }, { w: .5, k: 'wq', q: [4] },
  ];
  function roll(force) {
    let r = Math.random() * PRIZES.reduce((n, p) => n + p.w, 0), p = PRIZES[0];
    for (const x of PRIZES) { if ((r -= x.w) < 0) { p = x; break; } }
    if (force) p = Math.random() < .85 ? PRIZES[4] : Math.random() < .9 ? PRIZES[6] : PRIZES[7];   // 十连保底：精致以上
    const D = window.AFFIX_DATA;
    if (p.k === 'coin') { const n = 50 + Math.floor(Math.random() * 11) * 10; return { t: '金', ic: 'coin', name: n + ' 金币', give: () => WALLET.addCoins(n) }; }
    if (p.k === 'fu') { const id = Object.keys(FU)[Math.floor(Math.random() * 6)]; return { t: '符', ic: 'fu', name: FU[id].name, give: () => add(id, 1) }; }
    if (p.k === 'fruit') return { t: '果', ic: 'fruit', name: '彩色果 ×2', give: () => WALLET.addFruits(2) };
    if (p.k === 'stone') return { t: '石', ic: 'stone', name: '重铸石', give: () => add('stone', 1) };
    const q = p.q[Math.floor(Math.random() * p.q.length)], own = [...new Set((profile()?.items || []).map(i => i.type))], types = own.length ? own : ['staff', 'hammer', 'stone'];
    const it = D.generate(types[Math.floor(Math.random() * types.length)], 'boss', '', q); it.q = q;
    return { t: '器', ic: 'w' + (q >= 4 ? 4 : q >= 3 ? 3 : q >= 2 ? 2 : 0), name: D.label(it), q, give: () => { if (!ARMORY.add(it)) { WALLET.addCoins(100); return 'full'; } return true; } };
  }
  function lottery() {
    let box = document.getElementById('lotteryPanel');
    if (!box) {
      box = document.createElement('div'); box.id = 'lotteryPanel';
      const st = document.createElement('style');
      st.textContent = '#lotteryPanel{position:fixed;inset:0;z-index:10030;display:flex;align-items:center;justify-content:center;background:#0c0806cc;font:14px/1.5 sans-serif}#lotteryPanel[hidden]{display:none!important}#lotteryPanel .lm{position:relative;width:min(420px,94vw);max-height:94dvh;overflow:auto;padding:14px 16px 16px;box-sizing:border-box;background:repeating-linear-gradient(90deg,#6b4526 0 18px,#5d3b20 18px 36px);border:5px solid #3b2413;border-radius:10px;box-shadow:inset 0 0 0 3px #8a5d33,0 14px 50px #000c;color:#f3dfb5}#lotteryPanel .lt{margin:-4px auto 10px;width:max-content;padding:3px 26px;background:#2a170c;border:3px solid #c99a4a;border-radius:4px;color:#ffd77a;font:700 22px MaShanZheng,STKaiti,serif;letter-spacing:6px;box-shadow:0 0 12px #ffcf6a55}#lotteryPanel .lr{display:flex;gap:8px;justify-content:center;padding:10px;background:#2a170c;border:3px solid #c99a4a;border-radius:6px}#lotteryPanel .ls{width:72px;height:84px;display:flex;align-items:center;justify-content:center;background:linear-gradient(#e8d7b0,#fff4d8 45%,#e8d7b0);border:2px solid #3b2413;border-radius:4px;color:#5a2a10;font:700 40px MaShanZheng,STKaiti,serif;overflow:hidden}#lotteryPanel .ls.spin span{animation:lsp .09s linear infinite}@keyframes lsp{from{transform:translateY(-60%)}to{transform:translateY(60%)}}#lotteryPanel .lb{display:flex;gap:8px;justify-content:center;margin:12px 0 6px}#lotteryPanel .lb button,#lotteryPanel .lx{border:2px solid #c99a4a;border-radius:6px;background:linear-gradient(#8a3a20,#5a1e10);color:#ffe2a0;font:700 15px MaShanZheng,STKaiti,serif;padding:6px 14px;cursor:pointer}#lotteryPanel .lb button:disabled{opacity:.45}#lotteryPanel .lx{position:absolute;right:8px;top:8px;padding:2px 10px}#lotteryPanel .lo{min-height:46px;padding:6px 8px;background:#1d110acc;border-radius:5px;font-size:12px}#lotteryPanel .lo span{display:inline-block;margin:2px 4px;padding:1px 6px;border-radius:3px;background:#3a2414}#lotteryPanel .lp{margin-top:6px;font-size:11px;color:#cdb78e}#lotteryPanel .lw{text-align:center;font-size:12px;color:#ffd77a}';
      document.head.append(st); document.body.append(box);
      
    }
    const qc = q => (window.AFFIX_DATA && AFFIX_DATA.qualities[q] || {}).color || '#ffe2a0';
    const U = k => (typeof ASSETS !== 'undefined' && ASSETS.ui && ASSETS.ui['lot_' + k]) || '';
    const IC = ['coin', 'fu', 'fruit', 'stone', 'w0', 'w2', 'w3', 'w4'];
    let spinning = false, timer = null;
    const draw = (res) => {
      // 三个格子：十连时显示最好的三件；单抽三格都显示同一件
      const best = res ? [...res].sort((a, b) => (b.q ?? -1) - (a.q ?? -1)) : null, show = best ? [best[0], best[Math.min(1, best.length - 1)], best[Math.min(2, best.length - 1)]] : null;
      const hot = res && res.some(r => r.q >= 3);
      box.innerHTML = `<div class="lm2"><button class="lx" type="button">关闭</button>
        <div class="lmach" style="background-image:url(${U('machine')})">
          <div class="lwin">${[0, 1, 2].map(i => `<div class="lcell"><img data-cell="${i}" src="${U(show ? show[i].ic : IC[i * 2])}"></div>`).join('')}</div>
          <div class="lplaque">天命签</div><img class="llever${spinning ? ' dn' : ''}" data-lever src="${U(spinning ? 'lever_down' : 'lever_up')}" alt="拉杆">
          ${hot && !spinning ? `<img class="lburst" src="${U('burst')}">` : ''}
        </div>
        <div class="lb"><button type="button" data-n="1" ${WALLET.coins() < 200 || spinning ? 'disabled' : ''}>拉一次 · 200</button><button type="button" data-n="10" ${WALLET.coins() < 1800 || spinning ? 'disabled' : ''}>十连 · 1800</button></div>
        <div class="lw">余额 ${WALLET.coins()} 金币 · 也可以直接点拉杆（拉一次）</div><div class="lo">${res && !spinning ? res.map(r => `<span style="color:${r.q != null ? qc(r.q) : '#ffe2a0'}">${r.name}${r.full ? '（仓库满，折 100 金币）' : ''}</span>`).join('') : spinning ? '签筒转动中……' : '拉下拉杆，看看天命如何。'}</div>
        <div class="lp">概率：金币 35% · 强化符 20% · 彩色果 15% · 普通/优良武器 15% · 精致 8% · 重铸石 4% · 极品 2.5% · 传说 0.5%。十连保底一把精致以上。</div></div>`;
    };
    if (!document.getElementById('lotStyle2')) { const st = document.createElement('style'); st.id = 'lotStyle2';
      st.textContent = '#lotteryPanel .lm2{position:relative;width:min(460px,94vw);max-height:96dvh;overflow:auto;padding:10px 12px 14px;box-sizing:border-box;background:#2a1a10f2;border:2px solid #9d7845;border-radius:10px;color:#f3dfb5}#lotteryPanel .lmach{position:relative;width:min(400px,78vw,calc(60dvh * 480 / 410));aspect-ratio:480/410;margin:0 auto;background:center/100% 100% no-repeat}#lotteryPanel .lwin{position:absolute;left:14%;top:38%;width:72%;height:24%;display:flex;gap:4%;justify-content:center;align-items:center}#lotteryPanel .lcell{height:100%;aspect-ratio:1;overflow:hidden}#lotteryPanel .lcell img{width:100%;height:100%;object-fit:contain}#lotteryPanel .llever{position:absolute;right:-9%;top:6%;width:16%;cursor:pointer}#lotteryPanel .llever.dn{right:-15%;top:27%;width:24%}#lotteryPanel .lplaque{position:absolute;left:30%;top:4.5%;width:40%;text-align:center;color:#ffd77a;font:700 clamp(14px,4.2vw,24px) MaShanZheng,STKaiti,serif;letter-spacing:.4em;text-shadow:0 2px 2px #2a140a}#lotteryPanel .lm2 .lx{right:auto;left:8px}#lotteryPanel .lburst{position:absolute;left:50%;top:50%;width:90%;transform:translate(-50%,-50%);pointer-events:none;animation:lbst 1.8s ease-out forwards}@keyframes lbst{0%{opacity:0;transform:translate(-50%,-50%) scale(.4) rotate(-20deg)}25%{opacity:1}70%{opacity:1;transform:translate(-50%,-50%) scale(1.05) rotate(0)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.15)}}';
      document.head.append(st); }
    box.onclick = e => { if (e.target === box || e.target.closest('.lx')) { box.hidden = true; return; } if (spinning) return; const b = e.target.closest('[data-n]'); if (b) pull(+b.dataset.n); else if (e.target.closest('[data-lever]') && WALLET.coins() >= 200) pull(1); };
    function pull(n) {
      if (!WALLET.spendCoins(n === 10 ? 1800 : 200)) return;
      const res = []; for (let i = 0; i < n; i++) res.push(roll(false));
      if (n === 10 && !res.some(r => r.q != null && r.q >= 2)) res[9] = roll(true);
      for (const r of res) { const ok = r.give(); if (ok === 'full') r.full = true; }
      spinning = true; draw(null); if (typeof sfx === 'function') sfx('tick');
      let k = 0; clearInterval(timer);
      timer = setInterval(() => { k++; box.querySelectorAll('[data-cell]').forEach((im, i) => { im.src = U(IC[(k + i * 3) % IC.length]); }); }, 70);
      setTimeout(() => { clearInterval(timer); spinning = false; draw(res); if (typeof sfx === 'function') sfx(res.some(r => r.q >= 3) ? 'perfect' : 'pickup'); if (window.SHOP) SHOP.refresh(); }, 1100);
    }
    draw(null); box.hidden = false;
  }

  // ---- 商店货架 ----
  const items = window.SHOP && SHOP.SHOP_ITEMS;
  if (items) {
    const mk = (id, name, desc) => ({ id, name, desc, kind: 'stack', amounts: [1, 5], get price() { return priceOf(id); }, own: () => count(id), daily: () => id === dailyId(), buy: n => add(id, n), goods: true });
    for (const id in CONS) items.push(mk(id, CONS[id].name, CONS[id].d + '（每局用 1 个）'));
    for (const id in FU) items.push(Object.assign(mk(id, FU[id].name, '强化符：本局 ' + FU[id].d + '（每局只能带 1 张）'), { fu: true }));
    items.push(Object.assign(mk('stone', '重铸石', '随机换掉一把武器的其中一条词条（品级不变）'), { amounts: [1], useStone: true }));
    items.push({ id: 'bag', name: '武器锁定袋', desc: '武器仓库永久 +5 格（最多 3 个）', kind: 'stack', amounts: [1], get price() { return [500, 1000, 2000][store()?.bag | 0] || 0; }, own: () => store()?.bag | 0, soldOut: () => (store()?.bag | 0) >= 3, buy: () => { const g = store(); g.bag = Math.min(3, (g.bag | 0) + 1); g._at = Date.now(); save(); } });
    items.push({ id: 'lottery', name: '天命签', desc: '木制抽签机：拉一次 200，十连 1800（保底精致以上）', kind: 'open', price: 200, open: lottery });
  }

  window.GOODS = { FU, CONS, count, add, take, store, reset, tick, eat, drink, useAmulet, stat, chargeMul, reforgeOne, lottery, dailyId, priceOf, run: () => R };
})();
