// 伤害测试场（用户定，仅开发者模式）：把游戏按 1/60 秒一帧快速空跑，让主角对木桩连按普攻，统计 10 秒伤害。
// 三张表：① 6 种武器 单体/群体（5 个木桩）；② 每张锦囊相对「不带卡」的提升%（用当前武器）；③ 7 个将令对 6 个木桩 10 秒总伤。
// 对比方式：每张表按数值排序 + 条形图；超过中位数 1.5 倍标红（偏强）、低于 0.6 倍标蓝（偏弱）。
(() => {
  const DT = 1 / 60, SECS = 10;
  function dummies(n) {
    zs.length = 0; shots.length = 0; eshots.length = 0; lockR = Infinity;
    hero.x = cam.x + 120; hero.y = (M.top + M.bot) / 2; hero.f = 1; hero.inv = 9999; hero.hp = 999;
    const out = [], pos = [[0, 0], [10, -12], [10, 12], [22, -6], [22, 6], [34, 0]];
    for (let i = 0; i < n; i++) { spawn('grunt', hero.x + 34 + pos[i][0], hero.y + pos[i][1]); const z = zs[zs.length - 1]; z.T = { ...z.T, hp: 99999, elite: false }; z.hp = 99999; z.dummy = { x: z.x, y: z.y }; z.cd = 99; out.push(z); }
    return out;
  }
  function sim(n, ranged, skill) {
    const ds = dummies(n); if (ranged) { hero.x -= 90; }
    if (skill && typeof useRogueSkill === 'function') useRogueSkill();
    for (let f = 0; f < SECS * 60; f++) {
      if (!skill) pressAtk = true;
      try { update(DT); } catch (e) { break; }
      for (const z of ds) { if (z.dead) { z.dead = 0; z.st = 'move'; } z.x = z.dummy.x; z.y = z.dummy.y; z.air = false; z.z = 0; z.vz = 0; z.vx = 0; z.cd = 99; z.st = z.st === 'wind' || z.st === 'strike' ? 'move' : z.st; }
      hero.hp = 999; hero.inv = 9999;
    }
    pressAtk = false;
    return ds.reduce((s, z) => s + (99999 - z.hp), 0);
  }
  function setW(w) { weapon = w; if (window.GEAR && GEAR.switch) GEAR.switch(); hero.atk = null; hero.st = 'idle'; hero.combo = 0; }
  function table(title, rows, unit) {
    const vals = rows.map(r => r[1]).sort((a, b) => a - b), med = vals[Math.floor(vals.length / 2)] || 1, max = Math.max(...vals, 1);
    return `<h4 style="margin:10px 0 4px;color:#f1d58f">${title}</h4>` + rows.sort((a, b) => b[1] - a[1]).map(([n, v, note]) => {
      const c = v > med * 1.5 ? '#e0533a' : v < med * .6 ? '#5aa0e0' : '#c9a24a';
      return `<div style="display:flex;align-items:center;gap:6px;font-size:12px;margin:2px 0"><span style="width:84px;flex:none">${n}</span><span style="flex:1;background:#2a1f17;height:12px;border-radius:2px"><span style="display:block;height:12px;width:${Math.max(1, v / max * 100)}%;background:${c};border-radius:2px"></span></span><b style="width:70px;text-align:right;color:${c}">${v.toFixed(unit === '%' ? 0 : 1)}${unit}</b>${note ? `<i style="font-style:normal;color:#9b8a6c;width:60px">${note}</i>` : ''}</div>`;
    }).join('') + `<div style="font-size:11px;color:#9b8a6c">中位数 ${med.toFixed(1)}${unit} · 红=偏强（&gt;1.5 倍中位数）· 蓝=偏弱（&lt;0.6 倍）</div>`;
  }
  async function run(box) {
    const W = ['staff', 'hammer', 'blade', 'stone', 'bow', 'halberd'].filter(w => WEAP[w]);
    const keep = weapon, say0 = (t) => { box.querySelector('.dtMsg').textContent = t; return new Promise(r => setTimeout(r, 20)); };
    if (window.ROGUE) ROGUE.reset();
    const r1 = [], r1b = [];
    for (const w of W) { await say0('测武器：' + WEAP[w].name); setW(w); const ranged = WEAP[w].class === 'ranged'; const v1 = sim(1, ranged) / SECS; if (!v1) { r1.push([WEAP[w].name + '（未拥有）', 0]); continue; } r1.push([WEAP[w].name, v1]); r1b.push([WEAP[w].name, sim(5, ranged) / SECS]); }
    // 锦囊：当前武器（测试开始前拿着的那把）
    setW(keep); const base = sim(3, WEAP[keep].class === 'ranged');
    const r2 = [], cards = window.TIPBAG ? Object.entries(TIPBAG.CARDS).filter(([c]) => c !== 'bing').flatMap(([, l]) => l) : [];
    for (const [name, , , wpn] of cards) {
      if (wpn && wpn !== keep) continue;
      await say0('测锦囊：' + name); ROGUE.reset(); ROGUE.grant(name); setW(keep);
      const v = sim(3, WEAP[keep].class === 'ranged'); r2.push([name, (v / base - 1) * 100]);
    }
    // 将令
    const r3 = [], bings = window.TIPBAG ? TIPBAG.CARDS.bing.map(c => c[0]) : [];
    for (const name of bings) { await say0('测将令：' + name); ROGUE.reset(); ROGUE.grant(name); setW(keep); r3.push([name, sim(6, false, true)]); }
    ROGUE.reset(); setW(keep); zs.length = 0;
    box.querySelector('.dtOut').innerHTML = table('① 武器 单体 每秒伤害（连按普攻，含当前装备词条）', r1, '') + table('① 武器 群体 每秒伤害（5 个木桩）', r1b, '')
      + table(`② 锦囊 伤害提升（武器：${WEAP[keep].name}，3 个木桩，对比不带卡；木桩不会死也不出招，击杀后/被打时/打蓄力触发的卡显示 0%）`, r2, '%') + table('③ 将令 10 秒总伤（6 个木桩，放一次）', r3, '');
    await say0('完成。测试会打乱当前这一局，建议测完回整备重开。');
  }
  function open() {
    let box = document.getElementById('dmgTest');
    if (!box) { box = document.createElement('div'); box.id = 'dmgTest'; box.style.cssText = 'position:fixed;left:8px;top:8px;bottom:8px;width:min(520px,92vw);overflow:auto;z-index:10040;background:#1d140ef4;border:1px solid #9d7845;border-radius:8px;padding:10px;font:13px sans-serif;color:#ecdcbc';
      box.addEventListener('touchmove', e => e.stopPropagation(), { passive: true }); document.body.append(box); }
    box.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center"><b style="color:#f1d58f;font-size:16px">伤害测试场</b><span><button data-go style="min-height:30px">开始测试</button> <button data-x style="min-height:30px">关闭</button></span></div><div class="dtMsg" style="margin:6px 0;color:#9fd3ff">先进入任意一关，再点开始（约 10～30 秒）。</div><div class="dtOut"></div>';
    box.querySelector('[data-x]').onclick = () => box.remove();
    box.querySelector('[data-go]').onclick = () => { if (!hero || (window.TITLE && TITLE.blocks && TITLE.blocks())) { box.querySelector('.dtMsg').textContent = '请先进入一关。'; return; } run(box); };
  }
  window.DMGTEST = { open };
})();
