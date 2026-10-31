// 心魔强化学习（用户定 2026-10-31）：不画画面、加速跑「心魔 vs 测试玩家」对打，用进化策略（ES）训练心魔的走位网络。
// 网络结构和 tools/xinmo_train 的「像真人」头一样（29 输入 → 64 → 64 → 8 动作），只管中立时的走位/出手，保命还是规则。
// 用法：python3 -m http.server 8765 &   然后  node tools/xinmo_rl/selfplay.cjs [--minutes 60] [--init data/xinmo_model.json]
// 输出：data/xinmo_model.json（若测试赢过规则版才标 inGame:true）、docs/xinmo_train/日期-rl.md（每代的平均奖励、对比规则版的测试结果）
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const MINUTES = +arg('minutes', 60), BASE = arg('url', 'http://localhost:8765/index.html?debug'), ROOT = path.join(__dirname, '..', '..');
const WEAPONS = ['staff', 'hammer', 'stone', 'halberd', 'blade', 'bow'], BOTS = ['push', 'human', 'kite'];
const POP = +arg('pop', 16), SIGMA = +arg('sigma', .05), LR = +arg('lr', .03), EPS_PER = +arg('eps', 3);

// ---------- 页面里跑一局（同步推进 update，固定随机种子） ----------
const PAGE_FN = `
window.__xmTrain = true;
window.__rng = s => () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
window.__runEp = (net, weapon, bot, seed, secs) => {
  const R0 = Math.random; Math.random = __rng(seed);
  try {
    XINMO.setNet(net);
    if (!XIAOCHANG.start({ chapter: 1, xinmo: weapon })) return null;
    const c = document.getElementById('xmCard'); if (c) c.remove();
    const m = XINMO.mirror(); m.wait = 0; m.inv = 0; hero.inv = 0;
    const R = WEAP[weapon].proj ? 170 : (WEAP[weapon].reach || 30) + 2;
    let think = 0, frames = Math.round(secs * 60);
    for (let i = 0; i < frames && !over && !m.dead; i++) {
      think -= 1 / 60;
      if (think <= 0) {   // 测试玩家：约 0.2 秒做一次决定（像人）
        think = .18 + Math.random() * .08; for (const k in key) delete key[k];
        const dx = m.x - hero.x, dy = m.y - hero.y, adx = Math.abs(dx), ady = Math.abs(dy);
        hero.f = Math.sign(dx) || 1;
        if (bot === 'push') { if (Math.random() < .05) pressRoll = true; if (ady > 5) key[dy > 0 ? 'KeyS' : 'KeyW'] = true; if (adx > (WEAP[weapon].proj ? 110 : R * .8)) key[dx > 0 ? 'KeyD' : 'KeyA'] = true; if (ady < 9 && adx < R + 10) pressAtk = true; }
        else if (bot === 'human') { if (Math.random() < .12) pressRoll = true; else if (adx < R && ady < 8) pressAtk = true; else { key[dx > 0 ? 'KeyD' : 'KeyA'] = adx > R * .8; key[dy > 0 ? 'KeyS' : 'KeyW'] = ady > 3; } }
        else { const want = WEAP[weapon].proj ? 140 : R * 1.3; if (adx < want - 20) key[dx > 0 ? 'KeyA' : 'KeyD'] = true; else if (adx > want + 20) key[dx > 0 ? 'KeyD' : 'KeyA'] = true; if (ady > 4) key[dy > 0 ? 'KeyS' : 'KeyW'] = true; if (ady < 9 && adx < R + 20 && Math.random() < .7) pressAtk = true; if (Math.random() < .08) pressRoll = true; }
      }
      try { update(1 / 60); } catch (e) {}
    }
    const out = { heroHp: Math.max(0, hero.hp), heroMax: maxHeroHp(), mirHp: Math.max(0, m.hp), mirMax: m.T.hp, win: m.dead ? -1 : over ? 1 : 0 };
    for (const k in key) delete key[k]; pressAtk = pressRoll = false;
    XINMO.reset(); XIAOCHANG.leave();
    return out;
  } finally { Math.random = R0; }
};`;
const reward = o => !o ? -2 : (1 - o.heroHp / o.heroMax) - (1 - o.mirHp / o.mirMax) + o.win * .5;   // 打掉你多少 − 被打掉多少 + 胜负

// ---------- 网络参数 ⇄ 扁平向量 ----------
const KEYS = ['W1', 'b1', 'W2', 'b2', 'W3', 'b3'];
const flat = h => KEYS.flatMap(k => Array.isArray(h[k][0]) ? h[k].flat() : h[k]);
function unflat(v, like) { const o = { mean: like.mean, std: like.std }; let p = 0; for (const k of KEYS) { if (Array.isArray(like[k][0])) { o[k] = like[k].map(row => row.map(() => v[p++])); } else o[k] = like[k].map(() => v[p++]); } return o; }
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

(async () => {
  const init = JSON.parse(fs.readFileSync(path.join(ROOT, arg('init', 'data/xinmo_model.json')), 'utf8'));
  const head = init.heads.human; let theta = flat(head);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 640, height: 360 } });
  await p.goto(BASE); await p.waitForTimeout(5000); await p.addScriptTag({ content: PAGE_FN });
  await p.evaluate(() => { window.requestAnimationFrame = () => 0; TITLE.skip(); });   // 停掉画面循环，只用 update 同步推进
  const netOf = v => ({ heads: { human: unflat(v, head) }, inGame: true });
  const runSet = async (net, seeds) => p.evaluate(({ net, seeds }) => seeds.map(([w, bot, sd]) => __runEp(net, w, bot, sd, 25)), { net, seeds });
  const pick = (g, i) => [WEAPONS[(g * 7 + i) % WEAPONS.length], BOTS[(g + i) % BOTS.length], 1000 + g * 97 + i * 13];
  // 测速
  let t0 = Date.now(); await runSet(null, [pick(0, 0)]); const per = (Date.now() - t0) / 1000; console.log(`一局约 ${per.toFixed(2)} 秒`);
  const log = [`# 心魔强化学习报告 ${new Date().toISOString().slice(0, 16)} UTC`, '', `- 方法：进化策略（每代 ${POP} 组扰动 × ${EPS_PER} 局，σ=${SIGMA}，学习率 ${LR}），对手是 3 种测试玩家（压进连打 / 像人 / 拉距离）× 6 把武器`, `- 奖励：打掉玩家的血% − 自己被打掉的血% ± 胜负 0.5`, `- 一局约 ${per.toFixed(2)} 秒（不画画面加速跑）`, '', '| 代 | 平均奖励 | 用时(分) |', '|---|---|---|'];
  const end = Date.now() + MINUTES * 60e3; let gen = 0, episodes = 0;
  while (Date.now() < end) {
    const seeds = Array.from({ length: EPS_PER }, (_, i) => pick(gen, i)), eps = [], rs = [];
    for (let k = 0; k < POP; k++) {
      const e = theta.map(() => gauss()); eps.push(e);
      const plus = await runSet(netOf(theta.map((t, i) => t + SIGMA * e[i])), seeds), minus = await runSet(netOf(theta.map((t, i) => t - SIGMA * e[i])), seeds);
      rs.push([plus.reduce((a, o) => a + reward(o), 0) / EPS_PER, minus.reduce((a, o) => a + reward(o), 0) / EPS_PER]); episodes += EPS_PER * 2;
    }
    // 对偶采样 + 排名归一化
    const all = rs.flat(), sorted = [...all].sort((a, b) => a - b), rank = v => sorted.indexOf(v) / (all.length - 1) - .5;
    const g = theta.map(() => 0); rs.forEach(([a, bb], k) => { const w = rank(a) - rank(bb); eps[k].forEach((e, i) => g[i] += w * e); });
    theta = theta.map((t, i) => t + LR / (POP * SIGMA) * g[i]);
    const mean = all.reduce((a, v) => a + v, 0) / all.length; gen++;
    log.push(`| ${gen} | ${mean.toFixed(3)} | ${((MINUTES * 60e3 - (end - Date.now())) / 60e3).toFixed(1)} |`); console.log(`第 ${gen} 代 平均奖励 ${mean.toFixed(3)}（累计 ${episodes} 局）`);
  }
  // 测试：同一批没练过的种子，规则版 vs 网络
  const test = Array.from({ length: 36 }, (_, i) => [WEAPONS[i % 6], BOTS[Math.floor(i / 6) % 3], 900000 + i * 31]);
  const ruleR = await runSet(null, test), netR = await runSet(netOf(theta), test);
  const avg = a => a.reduce((s, o) => s + reward(o), 0) / a.length, wins = a => a.filter(o => o && o.win === 1).length;
  const rA = avg(ruleR), nA = avg(netR), ok = nA > rA + .05;
  log.push('', `## 测试（36 局没练过的对局，武器 × 测试玩家全覆盖）`, `- 累计训练 ${episodes} 局，${gen} 代`, `- 规则版心魔：平均奖励 ${rA.toFixed(3)}，赢 ${wins(ruleR)} 局`, `- 网络心魔：平均奖励 ${nA.toFixed(3)}，赢 ${wins(netR)} 局`,
    ok ? '- **网络赢过规则版 → 上场（inGame: true）**' : '- 网络没有明显赢过规则版 → 不上场，游戏继续用规则版');
  for (const w of WEAPONS) { const i = test.map((t, k) => t[0] === w ? k : -1).filter(k => k >= 0); log.push(`  - ${w}：规则 ${(i.reduce((s, k) => s + reward(ruleR[k]), 0) / i.length).toFixed(2)} / 网络 ${(i.reduce((s, k) => s + reward(netR[k]), 0) / i.length).toFixed(2)}`); }
  const model = { ...init, version: new Date().toISOString().slice(0, 16), heads: { ...init.heads, human: unflat(theta, head) }, inGame: ok, rl: { generations: gen, episodes, ruleReward: rA, netReward: nA } };
  fs.writeFileSync(path.join(ROOT, 'data', 'xinmo_model.json'), JSON.stringify(model));
  fs.mkdirSync(path.join(ROOT, 'docs', 'xinmo_train'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'docs', 'xinmo_train', new Date().toISOString().slice(0, 13).replace('T', '_') + '-rl.md'), log.join('\n') + '\n');
  console.log(log.slice(-9).join('\n')); await b.close();
})();
