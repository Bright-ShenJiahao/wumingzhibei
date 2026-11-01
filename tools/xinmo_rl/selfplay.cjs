// 心魔强化学习（用户定 2026-10-31）：不画画面、加速跑「心魔 vs 测试玩家」对打，用进化策略（ES）训练心魔的走位网络。
// 网络结构和 tools/xinmo_train 的「像真人」头一样（29 输入 → 64 → 64 → 8 动作），只管中立时的走位/出手，保命还是规则。
// 用法：python3 -m http.server 8765 &   然后  node tools/xinmo_rl/selfplay.cjs [--minutes 60] [--init data/xinmo_model.json]
// 输出：data/xinmo_model.json（若测试赢过规则版才标 inGame:true）、docs/xinmo_train/日期-rl.md（每代的平均奖励、对比规则版的测试结果）
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const MINUTES = +arg('minutes', 60), BASE = arg('url', 'http://localhost:8765/index.html?debug'), ROOT = path.join(__dirname, '..', '..');
const WEAPONS = ['staff', 'hammer', 'stone', 'halberd', 'blade', 'bow'], BOTS = ['push', 'human', 'kite', 'charger', 'ylane', 'poke', 'oki', 'fake', 'walkdodge', 'rollatk', 'camp', 'switch', 'push2', 'charger2', 'pin'];   // oki：打倒就压起身（真人柴业政的打法）   // fake 假蓄力骗；walkdodge 只走位躲弹不滚；rollatk 滚过来马上打；camp 站桩蓄满等对齐；switch 每 8 秒换打法   // poke：蓄着往前逼，蓄力一碰到就立刻往后滚拉开，循环（用户实战打法）   // …2 = 血量和伤害都是心魔 2 倍的强敌，逼心魔找办法赢   // charger：蓄满等你靠近放、放完翻滚跑；ylane：站在你判定外的斜线上再一步对齐打
const POP = +arg('pop', 16), SIGMA = +arg('sigma', .05), LR = +arg('lr', .03), EPS_PER = +arg('eps', 3), EVAL_N = +arg('evaln', 39), NF = 43;   // NF：网络输入维度（29 基础 + 8 新增 + 6 武器种类）

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
    const boost = /2$/.test(bot) ? 2 : 1; bot = bot.replace(/2$/, ''); window.__xmBoost = boost; if (boost > 1) hero.hp = maxHeroHp() * boost; const heroMax0 = hero.hp;
    const R = WEAP[weapon].proj ? 170 : (WEAP[weapon].reach || 30) + 2;
    window.__rollAtk = false; window.__swB = null;
    let think = 0, frames = Math.round(secs * 60), hold = 0, after = 0, fakeT = 9, errs = 0; const PN = performance.now; let now = PN.call(performance); performance.now = () => now;   // 蓄力按住时长用游戏时钟
    for (let i = 0; i < frames && !over && !m.dead; i++) {
      think -= 1 / 60;
      if (think <= 0) {   // 测试玩家：约 0.2 秒做一次决定（像人）
        think = .18 + Math.random() * .08; for (const k in key) delete key[k];
        const dx = m.x - hero.x, dy = m.y - hero.y, adx = Math.abs(dx), ady = Math.abs(dy);
        hero.f = Math.sign(dx) || 1;
        let B = bot; if (bot === 'switch') { B = ['push', 'poke', 'kite'][Math.floor(i / 480) % 3]; if (B !== window.__swB) { window.__swB = B; if (atkHeldSince) atkRelease(); after = 0; } }   // 局中换打法（换时清掉上一种的按住/撤退状态）
        const ms = (XINMO.shots ? XINMO.shots() : []).filter(p => p.life > 0 && Math.sign(p.vx) === Math.sign(hero.x - p.x) && Math.abs(hero.x - p.x) < 140 && Math.abs(hero.y - p.y) < 14);
        if (B === 'walkdodge' && ms.length) { key[(hero.y > (M.top + M.bot) / 2 ? 'KeyW' : 'KeyS')] = true; }   // 有弹过来：只走上下躲，不滚
        else if (B === 'walkdodge') { const want = WEAP[weapon].proj ? 140 : R; if (adx > want + 15) key[dx > 0 ? 'KeyD' : 'KeyA'] = true; else if (adx < want - 25) key[dx > 0 ? 'KeyA' : 'KeyD'] = true; if (ady > 5) key[dy > 0 ? 'KeyS' : 'KeyW'] = true; if (ady < 8 && adx < R + 10) pressAtk = true; }
        else if (B === 'rollatk') { if (adx > 70 && adx < 125 && hero.rollCd === 0 && ady < 12 && hero.st !== 'roll') { key[dx > 0 ? 'KeyD' : 'KeyA'] = true; pressRoll = true; window.__rollAtk = true; } else if (window.__rollAtk) { /* 滚完那一帧在下面逐帧处理 */ } else { if (adx > 120) key[dx > 0 ? 'KeyD' : 'KeyA'] = true; else if (adx < 60) key[dx > 0 ? 'KeyA' : 'KeyD'] = true; if (ady > 4) key[dy > 0 ? 'KeyS' : 'KeyW'] = true; if (adx < R && ady < 8) pressAtk = true; } }
        else if (B === 'fake') {   // 先点一下（不到蓄力门槛）骗心魔，再真蓄
          if (after > 0) { after -= .2; key[dx > 0 ? 'KeyA' : 'KeyD'] = true; }
          else if (!atkHeldSince && hero.st === 'idle') { atkPress(); hold = 0; fakeT = Math.random() < .5 ? .25 : 9; }
          else if (atkHeldSince) { if (hold >= fakeT) { atkRelease(); after = .2; } else if (hold >= .45 && adx < (WEAP[weapon].proj ? 150 : 85) && ady < 22) { atkRelease(); after = .6; pressRoll = true; } else { key[dx > 0 ? 'KeyD' : 'KeyA'] = true; if (ady > 4) key[dy > 0 ? 'KeyS' : 'KeyW'] = true; if (hold > 5) { atkRelease(); after = .4; } } }
        }
        else if (B === 'camp') {   // 站在约 107 蓄满，等心魔对上线再放
          const want = WEAP[weapon].proj ? 107 : 85;
          if (after > 0) { after -= .2; }
          else if (!atkHeldSince && hero.st === 'idle') { if (adx < want - 15) key[dx > 0 ? 'KeyA' : 'KeyD'] = true; else if (adx > want + 15) key[dx > 0 ? 'KeyD' : 'KeyA'] = true; else atkPress(); hold = 0; }   // 先走到 107 附近再蓄
          else if (atkHeldSince) { if (hold >= chargeMaxMs() / 1000 && ady < 10 && adx < want + 40) { atkRelease(); after = .4; } else if (hold > 4) { atkRelease(); after = .3; } }
        }
        else if (B === 'oki' && (m.air || ['bounce', 'getup', 'land'].includes(m.st) || (m.st === 'idle' && m.inv > 0 && m.inv < .6))) {   // 心魔倒地：站到它起身的位置旁边，等无敌快结束就出手
          const side = Math.sign(hero.x - m.x) || -1, tx = m.x + side * (R - 6);
          if (Math.abs(hero.x - tx) > 4) key[hero.x < tx ? 'KeyD' : 'KeyA'] = true; if (ady > 3) key[dy > 0 ? 'KeyS' : 'KeyW'] = true; hero.f = -side;
          if ((m.st === 'getup' && m.t > .22) || (m.st === 'idle' && m.inv < .2)) pressAtk = true;
        }
        else if (B === 'pin') {   // 11/01 真人打法：站在心魔靠场中那一侧，把它压到墙角，一直平 A
          const side = m.x < 360 ? 1 : -1, tx = m.x + side * R * .75; if (Math.abs(hero.x - tx) > 6) key[hero.x < tx ? 'KeyD' : 'KeyA'] = true; else if ((dx > 0) !== (hero.f > 0)) key[dx > 0 ? 'KeyD' : 'KeyA'] = true; if (ady > 4) key[dy > 0 ? 'KeyS' : 'KeyW'] = true; if (ady < 9 && adx < R + 10) pressAtk = true; }
        else if (B === 'push' || B === 'oki') { if (Math.random() < .05) pressRoll = true; if (ady > 5) key[dy > 0 ? 'KeyS' : 'KeyW'] = true; if (adx > (WEAP[weapon].proj ? 110 : R * .8)) key[dx > 0 ? 'KeyD' : 'KeyA'] = true; if (ady < 9 && adx < R + 10) pressAtk = true; }
        else if (B === 'human') { if (Math.random() < .12) pressRoll = true; else if (adx < R && ady < 8) pressAtk = true; else { key[dx > 0 ? 'KeyD' : 'KeyA'] = adx > R * .8; key[dy > 0 ? 'KeyS' : 'KeyW'] = ady > 3; } }
        else if (B === 'charger') {
          const T = { staff: 64, hammer: 80, blade: 45, halberd: 120, stone: 160, bow: 170 }[weapon];
          if (after > 0) { after -= .2; key[dx > 0 ? 'KeyA' : 'KeyD'] = true; if (after > .3) pressRoll = true; }
          else if (!atkHeldSince && hero.st === 'idle') { atkPress(); hold = 0; }
          else if (atkHeldSince) { if (hold >= chargeMaxMs() / 1000 && adx < T && ady < 22) { atkRelease(); after = .7; } else if (hold > 3.5) { atkRelease(); after = .5; } else if (ady > 6) key[dy > 0 ? 'KeyS' : 'KeyW'] = true; }
        }
        else if (B === 'poke') {
          const T = { staff: 80, hammer: 96, blade: 60, halberd: 140, stone: 150, bow: 200 }[weapon];
          if (after > 0) { after -= .2; key[dx > 0 ? 'KeyA' : 'KeyD'] = true; }   // 滚完再退一小段
          else if (!atkHeldSince && hero.st === 'idle') { atkPress(); hold = 0; }
          else if (atkHeldSince) {
            if (hold >= .45 && adx < T && ady < 22) { atkRelease(); after = .6; pressRoll = true; key[dx > 0 ? 'KeyA' : 'KeyD'] = true; }   // 放完当场往后滚   // 过了蓄力门槛、够得着就放（不等满蓄）
            else { key[dx > 0 ? 'KeyD' : 'KeyA'] = true; if (ady > 4) key[dy > 0 ? 'KeyS' : 'KeyW'] = true; if (hold > 5) { atkRelease(); after = .65; } }   // 蓄着往前逼
          }
        }
        else if (B === 'ylane') { const dyW = WEAP[weapon].dy || 14; if (adx > R * .9) { key[dx > 0 ? 'KeyD' : 'KeyA'] = true; key[dy > 0 ? 'KeyW' : 'KeyS'] = ady < dyW + 3; } else if (ady > dyW - 3) key[dy > 0 ? 'KeyS' : 'KeyW'] = true; else pressAtk = true; if (Math.random() < .06) pressRoll = true; }
        else { const want = WEAP[weapon].proj ? 140 : R * 1.3; if (adx < want - 20) key[dx > 0 ? 'KeyA' : 'KeyD'] = true; else if (adx > want + 20) key[dx > 0 ? 'KeyD' : 'KeyA'] = true; if (ady > 4) key[dy > 0 ? 'KeyS' : 'KeyW'] = true; if (ady < 9 && adx < R + 20 && Math.random() < .7) pressAtk = true; if (Math.random() < .08) pressRoll = true; }
      }
      if (atkHeldSince) hold += 1 / 60; now += 1000 / 60;
      if (bot === 'fake' && atkHeldSince && fakeT < 1 && hold >= fakeT) { atkRelease(); after = .2; }   // 假蓄力：逐帧检查，保证在门槛前松手
      if (window.__rollAtk && hero.st !== 'roll' && hero.st !== 'hurt' && i > 0) { window.__rollAtk = false; pressAtk = true; }   // 滚完立刻出手
      try { update(1 / 60); } catch (e) { errs++; window.__epErr = String(e && e.stack || e).slice(0, 300); break; }   // 出错立刻结束这一局
    }
    performance.now = PN; if (atkHeldSince) { atkHeldSince = 0; charging = false; }
    if (errs) { window.__errCount = (window.__errCount || 0) + 1; }
    const out = { err: errs, heroHp: Math.max(0, hero.hp), heroMax: heroMax0, mirHp: Math.max(0, m.hp), mirMax: m.T.hp, win: m.dead ? -1 : over ? 1 : 0 };
    for (const k in key) delete key[k]; pressAtk = pressRoll = false;
    window.__xmBoost = 1; XINMO.reset(); XIAOCHANG.leave();
    return out;
  } finally { Math.random = R0; }
};`;
const reward = o => !o || o.err ? -2 : o.win * 1 + .25 * ((1 - o.heroHp / o.heroMax) - (1 - o.mirHp / o.mirMax)) - (o.win === 0 ? .3 : 0);   // 超时再扣 0.3（11/01 加大）：不鼓励拖时间   // 赢 +1 / 输 −1 为主，换血只算辅助（×0.25）；出错的对局 −2 并记数

// ---------- 网络参数 ⇄ 扁平向量 ----------
const KEYS = ['W1', 'b1', 'W2', 'b2', 'W3', 'b3'];
const flat = h => KEYS.flatMap(k => Array.isArray(h[k][0]) ? h[k].flat() : h[k]);
function unflat(v, like) { const o = { mean: like.mean, std: like.std }; let p = 0; for (const k of KEYS) { if (Array.isArray(like[k][0])) { o[k] = like[k].map(row => row.map(() => v[p++])); } else o[k] = like[k].map(() => v[p++]); } return o; }
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

(async () => {
  const init = JSON.parse(fs.readFileSync(path.join(ROOT, arg('init', 'data/xinmo_model.json')), 'utf8'));
  const head = JSON.parse(JSON.stringify(init.heads.human));
  if (head.W1.length < NF) { const add = NF - head.W1.length; head.mean.push(...Array(add).fill(0)); head.std.push(...Array(add).fill(1)); for (let k = 0; k < add; k++) head.W1.push(head.W1[0].map(() => 0)); }   // 新增 8 维输入：权重从 0 开始，不改变原来的行为
  head.std = head.std.map(v => v > 1e-6 ? v : 1);
  let theta = flat(head);
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 640, height: 360 } });
  await p.goto(BASE); await p.waitForTimeout(5000); await p.addScriptTag({ content: PAGE_FN }); if (arg('alias', '')) await p.evaluate(a => { window.__netAlias = Object.fromEntries(a.split(',').map(x => x.split(':'))); }, arg('alias', ''));
  await p.evaluate(() => { window.requestAnimationFrame = () => 0; TITLE.skip(); });   // 停掉画面循环，只用 update 同步推进
  const netOf = v => ({ heads: { human: unflat(v, head) }, inGame: true });
  const runSet = async (net, seeds) => p.evaluate(({ net, seeds }) => seeds.map(([w, bot, sd]) => __runEp(net, w, bot, sd, 30)), { net, seeds });
  const HOLDOUT = ['camp', 'rollatk'], TRAIN_BOTS = BOTS.filter(b => !HOLDOUT.includes(b));   // 留出 2 种测试玩家只在评测里出现，检查有没有只会打练过的对手
  const TRAIN_W = arg('weapons', '') ? arg('weapons', '').split(',').filter(w => WEAPONS.includes(w)) : WEAPONS;   // 只练指定武器（评测仍然 6 把都测）
  const FOCUS = (arg('focus', '') || '').split(',').filter(w => TRAIN_W.includes(w)), FW = +arg('focusw', 3);   // 重点练的武器：抽到的机会是其他武器的 FW 倍
  const COMBOS = TRAIN_W.flatMap(w => TRAIN_BOTS.map(b => [w, b]));   // 武器 × 测试玩家全覆盖（之前索引绑在一起，只练到一半组合）
  const score = COMBOS.map(() => 0);   // 每个组合最近的平均奖励（越差越常练：按对手优先采样）
  const pick = (g, i) => { const wts = score.map((v, j) => (1 + Math.max(0, .5 - v) * 2) * (FOCUS.includes(COMBOS[j][0]) ? FW : 1)), tot = wts.reduce((a, b) => a + b, 0); let r = (Math.sin(g * 9301 + i * 49297) * 233280 % 1 + 1) % 1 * tot, k = 0; while (r > wts[k] && k < wts.length - 1) { r -= wts[k]; k++; } return [COMBOS[k][0], COMBOS[k][1], 1000 + g * 97 + i * 13, k]; };
  // 测速
  let t0 = Date.now(); await runSet(null, [pick(0, 0)]); const per = (Date.now() - t0) / 1000; console.log(`一局约 ${per.toFixed(2)} 秒`);
  const log = [`# 心魔强化学习报告 ${new Date().toISOString().slice(0, 16)} UTC`, '', `- 方法：进化策略（每代 ${POP} 组扰动 × ${EPS_PER} 局，σ=${SIGMA}，学习率 ${LR}），对手 ${BOTS.length} 种测试玩家 × 6 把武器，按“越打不过越常练”采样`, `- 奖励：赢 +1 / 输 −1；换血（打掉你的血% − 被打掉的血%）× 0.25 作辅助；一局最长 30 秒`, `- 网络输入 ${NF} 维（新增：你的翻滚冷却、你是否在蓄、你是否被晕、离左右墙、离中线、我上次打中你多久、我翻滚冷却）`, `- 一局约 ${per.toFixed(2)} 秒（不画画面加速跑）`, '', '| 代 | 平均奖励 | 用时(分) |', '|---|---|---|'];
  const end = Date.now() + MINUTES * 60e3; let gen = 0, episodes = 0;
  while (Date.now() < end) {
    const seeds = Array.from({ length: EPS_PER }, (_, i) => pick(gen, i)), eps = [], rs = [], acc = seeds.map(() => 0);
    for (let k = 0; k < POP; k++) {
      const e = theta.map(() => gauss()); eps.push(e);
      const plus = await runSet(netOf(theta.map((t, i) => t + SIGMA * e[i])), seeds), minus = await runSet(netOf(theta.map((t, i) => t - SIGMA * e[i])), seeds);
      rs.push([plus.reduce((a, o) => a + reward(o), 0) / EPS_PER, minus.reduce((a, o) => a + reward(o), 0) / EPS_PER]); episodes += EPS_PER * 2;
      seeds.forEach((sd, j) => { acc[j] += (reward(plus[j]) + reward(minus[j])) / 2 / POP; });
    }
    seeds.forEach((sd, j) => { score[sd[3]] = score[sd[3]] * .8 + acc[j] * .2; });   // 每代只更新一次
    // 对偶采样 + 排名归一化
    const all = rs.flat(), sorted = [...all].sort((a, b) => a - b), rank = v => sorted.indexOf(v) / (all.length - 1) - .5;
    const g = theta.map(() => 0); rs.forEach(([a, bb], k) => { const w = rank(a) - rank(bb); eps[k].forEach((e, i) => g[i] += w * e); });
    theta = theta.map((t, i) => t + LR / (POP * SIGMA) * g[i]);
    const mean = all.reduce((a, v) => a + v, 0) / all.length; gen++;
    if (all.every(v => v === -2)) { console.log('对局开不起来（全部失败），停止训练'); break; }
    log.push(`| ${gen} | ${mean.toFixed(3)} | ${((MINUTES * 60e3 - (end - Date.now())) / 60e3).toFixed(1)} |`); console.log(`第 ${gen} 代 平均奖励 ${mean.toFixed(3)}（累计 ${episodes} 局）`);
  }
  // 测试：每把武器 EVAL_N 局（轮换全部测试玩家），规则版和网络用同一批种子成对比较；网络在这把武器上的提升，单侧 95% 置信下界 > 0 才启用
  const EB = arg('evalbots', '') ? arg('evalbots', '').split(',') : BOTS;   // 只评测指定测试玩家（本地快速核对用）
  const test = WEAPONS.flatMap((w, wi) => Array.from({ length: EVAL_N }, (_, k) => [w, EB[k % EB.length], 900000 + wi * 1000 + k * 31]));
  const ruleR = await runSet(null, test), netR = await runSet(netOf(theta), test);
  const avg = a => a.reduce((s, o) => s + reward(o), 0) / a.length, wins = a => a.filter(o => o && o.win === 1).length, errN = a => a.filter(o => !o || o.err).length;
  const rA = avg(ruleR), nA = avg(netR);
  log.push('', `## 测试（每把武器 ${EVAL_N} 局没练过的对局，${BOTS.length} 种测试玩家轮换，成对比较）`, `- 累计训练 ${episodes} 局，${gen} 代`, `- 规则版心魔：平均奖励 ${rA.toFixed(3)}，赢 ${wins(ruleR)} / ${test.length} 局，出错 ${errN(ruleR)} 局`, `- 网络心魔：平均奖励 ${nA.toFixed(3)}，赢 ${wins(netR)} / ${test.length} 局，出错 ${errN(netR)} 局`);
  const perW = [], STRESS = b => /2$/.test(b);
  const errAny = errN(ruleR) + errN(netR);
  for (const w of WEAPONS) {
    const ix = test.map((t, k) => t[0] === w && !STRESS(t[1]) ? k : -1).filter(k => k >= 0), d = ix.map(k => reward(netR[k]) - reward(ruleR[k]));   // 上线判定只看正常镜像对手；2 倍强敌另列
    const mu = d.reduce((a, b) => a + b, 0) / d.length, sd = Math.sqrt(d.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(1, d.length - 1)), lo = mu - 2.13 * sd / Math.sqrt(d.length);   // 6 把武器一起判：Bonferroni 校正后的单侧 95%
    const wr = ix.filter(k => ruleR[k] && ruleR[k].win === 1).length, wn = ix.filter(k => netR[k] && netR[k].win === 1).length, ln = ix.filter(k => netR[k] && netR[k].win === -1).length, lr = ix.filter(k => ruleR[k] && ruleR[k].win === -1).length;
    const ho = test.map((t, k) => t[0] === w && HOLDOUT.includes(t[1]) ? k : -1).filter(k => k >= 0), hoD = ho.length ? ho.reduce((a, k) => a + reward(netR[k]) - reward(ruleR[k]), 0) / ho.length : 0;
    const st = test.map((t, k) => t[0] === w && STRESS(t[1]) ? k : -1).filter(k => k >= 0), stN = st.filter(k => netR[k] && netR[k].win === 1).length, stR = st.filter(k => ruleR[k] && ruleR[k].win === 1).length;
    const ok = !errAny && lo > 0 && wn - ln >= wr - lr && hoD > -.1;   // 置信下界 > 0、胜负差不比规则版差、留出对手不明显退步、没有出错对局
    if (ok) perW.push(w);
    log.push(`  - ${w}：规则 胜${wr}负${lr} / 网络 胜${wn}负${ln}（${ix.length} 局正常对手），奖励提升 ${mu.toFixed(2)}，下界 ${lo.toFixed(2)}，留出对手提升 ${hoD.toFixed(2)}；2 倍强敌 规则胜${stR} / 网络胜${stN} → ${ok ? '**用网络**' : '用规则版'}`);
  }
  const ok = perW.length > 0;
  if (errAny) log.push(`- **有 ${errAny} 局出错，本次不上线**（看下面的出错示例）`);
  log.push(ok ? `- **网络上场，只用在：${perW.join('、')}**` : '- 网络没有在任何武器上稳定赢过规则版 → 不上场');
  const bad = await p.evaluate(() => window.__epErr || ''); if (bad) log.push('', '出错示例：', '```', bad, '```');
  const model = { ...init, weapons: perW, version: new Date().toISOString().slice(0, 16), heads: { ...init.heads, human: ok || nA > rA ? unflat(theta, head) : init.heads.human }, inGame: ok,   /* 没变好就保留旧权重，下次不从更差的地方开始 */ nf: NF, rl: { generations: gen, episodes, ruleReward: rA, netReward: nA, evalPerWeapon: EVAL_N } };
  fs.writeFileSync(path.join(ROOT, 'data', 'xinmo_model.json'), JSON.stringify(model));
  fs.mkdirSync(path.join(ROOT, 'docs', 'xinmo_train'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'docs', 'xinmo_train', new Date().toISOString().slice(0, 13).replace('T', '_') + '-rl.md'), log.join('\n') + '\n');
  console.log(log.slice(-12).join('\n')); await b.close();
})();
