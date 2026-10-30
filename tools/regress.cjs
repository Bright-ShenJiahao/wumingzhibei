// 回归测试（拆代码前后各跑一次对比）：node tools/regress.cjs [save|check]
// 需要先在仓库根目录起服务器：python3 -m http.server 8765
// 1) 冒烟：电脑+手机尺寸，标题→第一章→第二章 1/3/4/5/6 战→校场→经脉/商店面板，不能有报错
// 2) 伤害测试场三张表的数值（带随机，允许 ±15% 浮动）
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const BASE = path.join(__dirname, 'regress-baseline.json'), mode = process.argv[2] || 'check';
(async () => {
  const b = await chromium.launch(), errs = [];
  for (const vp of [{ width: 1280, height: 640 }, { width: 844, height: 390, hasTouch: true }]) {
    const p = await b.newPage({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.hasTouch }); p.on('pageerror', e => errs.push(vp.width + ': ' + e.message));
    await p.goto('http://localhost:8765/?debug'); await p.waitForTimeout(3000);
    await p.fill('input', '回归'); await p.click('text=开始游戏'); await p.waitForTimeout(3000);
    for (let i = 0; i < 15; i++) { await p.keyboard.press('j'); await p.waitForTimeout(100); }
    for (const n of [1, 3, 4, 5, 6]) { await p.evaluate(n => startChapter2Debug(n), n); await p.waitForTimeout(6500); for (let i = 0; i < 12; i++) { await p.keyboard.press('j'); await p.waitForTimeout(100); } }
    await p.evaluate(() => XIAOCHANG.start({ chapter: 1, floor: 1 })); await p.waitForTimeout(3500);
    await p.evaluate(() => { MERIDIAN.open(); SHOP.open(); GOODS.lottery(); }); await p.waitForTimeout(500);
    const e2 = await p.evaluate(() => window.WZB_ERR || ''); if (e2) errs.push(vp.width + ' WZB_ERR: ' + e2);
    await p.close();
  }
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } }); p.on('pageerror', e => errs.push('dmg: ' + e.message));
  await p.goto('http://localhost:8765/?debug'); await p.waitForTimeout(2500); await p.mouse.click(400, 200);
  await p.evaluate(() => startChapter2Debug(1)); await p.waitForTimeout(7000);
  await p.evaluate(() => { DMGTEST.open(); document.querySelector('#dmgTest [data-go]').click(); });
  for (let i = 0; i < 90; i++) { await p.waitForTimeout(2000); if ((await p.evaluate(() => document.querySelector('#dmgTest .dtMsg').textContent)).startsWith('完成')) break; }
  const nums = await p.evaluate(() => { const o = {}; let t = ''; document.querySelectorAll('#dmgTest .dtOut > *').forEach(el => { if (el.tagName === 'H4') t = el.textContent.slice(0, 6); else if (el.children.length >= 3) o[t + '|' + el.children[0].textContent] = parseFloat(el.children[2].textContent); }); return o; });
  await b.close();
  console.log(errs.length ? '报错：\n' + errs.join('\n') : '冒烟：没有报错');
  if (mode === 'save') { fs.writeFileSync(BASE, JSON.stringify(nums, null, 1)); console.log('已保存基线', Object.keys(nums).length, '项'); return; }
  const base = JSON.parse(fs.readFileSync(BASE, 'utf8')); let bad = 0;
  for (const k in base) { const a = base[k], v = nums[k]; if (v == null) { console.log('缺少', k); bad++; continue; } const tol = Math.max(k.includes('锦囊') ? 6 : 3, Math.abs(a) * .15); /* 锦囊提升% 在 0 附近随机抖动 */ if (Math.abs(v - a) > tol) { console.log('变化', k, a, '→', v); bad++; } }
  console.log(bad ? `数值有 ${bad} 项超出浮动` : '数值：和基线一致'); process.exit(errs.length || bad ? 1 : 0);
})();
