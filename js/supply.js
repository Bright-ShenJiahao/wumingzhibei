// 第二章战场补给（用户定）：金创药 / 杜康酒 / 火油罐。金创药捡到先存 1 瓶、半血自动喝；其余拾取即生效。
// 来源：每战开打和第 2 波各放一个「曹」字补给箱（打碎必出一个补给）。
(() => {
  const KINDS = {
    jinchuang: { name: '金创药', icon: 'sup_jinchuang', tip: '回 3 血，之后 4 秒每秒再回 0.5', w: 25 },
    jiu: { name: '杜康酒', icon: 'sup_jiu', tip: '10 秒内伤害 +30%、攻速 +15%', w: 20 },   // 用户定：金创药、酒再少一些（火油罐 30 不变）
    huoyou: { name: '火油罐', icon: 'sup_huoyou', tip: '按攻击扔出：爆炸 1.5 伤害并留下大火场', w: 30 },
  };
  let stash = 0, ground = [], regenT = 0, drunkT = 0, jar = null, flying = [], fx = [], bossDrop = new Set(), placed = {};
  const img = k => { const i = typeof IMG !== 'undefined' && IMG['ui_' + k]; return i && i.complete && i.naturalWidth ? i : null; };
  const maxHp = () => (typeof maxHeroHp === 'function' ? maxHeroHp() : 10);
  const pop = (txt, color, big) => { if (typeof floaters !== 'undefined') floaters.push({ x: hero.x, y: hero.y - 50, t: 0, txt, color, big }); };
  function pick(noFire) { if (noFire) return Math.random() < .55 ? 'jinchuang' : 'jiu'; let r = Math.random() * 100; for (const k in KINDS) { r -= KINDS[k].w; if (r <= 0) return k; } return 'jinchuang'; }
  function drop(x, y, kind) { ground.push({ k: kind || pick(), x, y, z: 14, vz: 90, t: 0 }); }
  function reset() { stash = 0; ground = []; regenT = 0; drunkT = 0; jar = null; flying = []; fx = []; bossDrop = new Set(); placed = {}; }
  // 放补给箱：画在地上的道具（props），打碎后换成碎箱子并掉补给
  function placeCrate(x, wave) {
    const m = ASSETS.props.cao_crate; if (!m || typeof props === 'undefined') return;
    const y = Math.max(M.top + 14, Math.min(M.bot - 10, (M.top + M.bot) / 2 + (Math.random() - .5) * 40));
    props.push({ g: 'cao_crate', x, y, w: m[1], h: m[2], sc: 1, hitT: 0, hp: 2, solid: true, broken: false, supply: true, chapter2: true, wave });
  }
  function onCrateBreak(p) {
    const m = ASSETS.props.cao_crate_broken;
    p.g = 'cao_crate_broken'; p.solid = false; p.hp = 0; p.fadeAt = gameT; if (m) { p.w = m[1]; p.h = m[2]; }
    // 火油罐只在第 2 波、场上敌人 4 个以上时才可能开出来；开局的箱子只出金创药/烈酒
    const foes = zs.filter(z => !z.dead && !z.ally).length;
    if (p.wave === 0 && Math.random() < .5) { if (typeof floaters !== 'undefined') floaters.push({ x: p.x, y: p.y - 30, t: 0, txt: '空箱子' }); return; }   // 开局的箱子一半是空的
    drop(p.x, p.y, pick(!(p.wave === 1 && foes >= 4)));
  }
  function apply(k, useNow) {
    const K = KINDS[k];
    if (typeof sfx === 'function') sfx('food', hero.x);
    if (k === 'jinchuang' && !stash && !useNow) { stash = 1; pop('金创药收好了 · 半血自动服用', '#8fe08a', true); return; }   // 金创药先存着（最多 1 瓶），血掉到一半自动喝
    if (k === 'jinchuang') { hero.hp = Math.min(maxHp(), hero.hp + 3); regenT = 4; pop('+3 金创药', '#8fe08a', true); for (let i = 0; i < 10; i++) fx.push({ k: 'heal', x: hero.x + (Math.random() - .5) * 18, y: hero.y - Math.random() * 20, t: -i * .03 }); }
    else if (k === 'jiu') { drunkT = 10; pop('痛快！', '#ff9a5a', true); fx.push({ k: 'drink', t: 0 }); }
    else if (k === 'huoyou') { jar = { t: 0 }; pop('按攻击扔出火油罐', '#ffb04a'); }
    if (typeof say === 'function') say(`${K.name}：${K.tip}`, 2.4);
  }
  // 攻击键：拿着火油罐时先扔罐子（game.js 在出招前调用，返回 true 就不出普攻）
  function throwJar() {
    if (!jar || typeof hero === 'undefined') return false;
    jar = null;
    const foes = zs.filter(z => !z.dead && !z.air && Math.sign(z.x - hero.x) === hero.f && Math.abs(z.x - hero.x) < 220);
    let tx = hero.x + hero.f * 120, ty = hero.y;
    if (foes.length) { const best = foes.map(z => [z, foes.filter(o => Math.hypot(o.x - z.x, (o.y - z.y) * 2) < 45).length]).sort((a, b) => b[1] - a[1])[0][0]; tx = best.x; ty = best.y; }
    flying.push({ sx: hero.x + hero.f * 8, sy: hero.y - 26, tx, ty, t: 0, T: .5 });
    if (typeof sfx === 'function') sfx('swing_stone', hero.x);
    return true;
  }
  function explode(x, y) {
    shake = Math.max(shake, .3); if (typeof sfx === 'function') sfx('fireLand', x);
    for (const z of zs) if (!z.dead && !z.air && Math.hypot(z.x - x, (z.y - y) * 2) < 40) hit(z, 1.5, 110, Math.sign(z.x - x) || 1, false, 0, .4, true, false, { secondary: true });
    if (typeof allyFires !== 'undefined') allyFires.push({ x, y, t: 4, r: 38, tick: 0, dmg: .35 });
    for (let i = 0; i < 14; i++) fx.push({ k: 'shard', x, y: y - 6, vx: (Math.random() - .5) * 160, vy: -60 - Math.random() * 120, t: 0 });
    fx.push({ k: 'boom', x, y, t: 0 });
  }
  function tick(dt) {
    if (typeof hero === 'undefined') return;
    // 第二章：每战开打、第 2 波各放一个补给箱（在主角前方）
    if (typeof chapter2Run !== 'undefined' && chapter2Run && chapter2Run.mode === 'fight' && chapter2Run.battle <= 5) {
      const key = chapter2Run.battle + ':' + chapter2Run.wave;
      if (!placed[key] && (chapter2Run.wave === 0 || chapter2Run.wave === 1)) { placed[key] = true; placeCrate(hero.x + 170 + Math.random() * 60, chapter2Run.wave); }
    }
    if (stash && hero.hp > 0 && hero.hp <= maxHp() * .5 && !(typeof over !== 'undefined' && over)) { stash = 0; apply('jinchuang', true); }
    for (const g of ground) {
      g.t += dt; if (g.z > 0 || g.vz) { g.vz -= 500 * dt; g.z = Math.max(0, g.z + g.vz * dt); if (g.z === 0) g.vz = 0; }
      if (g.z < 6 && Math.abs(g.x - hero.x) < 15 && Math.abs(g.y - hero.y) < 14 && hero.st !== 'down') { g.got = true; apply(g.k); }
    }
    ground = ground.filter(g => !g.got && g.t < 30);
    if (regenT > 0) { const before = regenT; regenT = Math.max(0, regenT - dt); if (Math.floor(before) !== Math.floor(regenT)) { hero.hp = Math.min(maxHp(), hero.hp + .5); pop('+0.5', '#8fe08a'); } if (Math.random() < dt * 8) fx.push({ k: 'heal', x: hero.x + (Math.random() - .5) * 16, y: hero.y - Math.random() * 10, t: 0 }); }
    if (drunkT > 0) { if (zs.some(z => !z.dead && !z.ally && !z.decoy)) drunkT -= dt;   // 用户定：没敌人时酒劲不掉（战后喝的留到下一波）
       if (drunkT <= 0) pop('酒醒了', '#ccc'); if (Math.random() < dt * 6) fx.push({ k: 'steam', x: hero.x + (Math.random() - .5) * 10, y: hero.y - 26, t: 0 }); }
    if (jar) { jar.t += dt; if (jar.t > 20) { jar = null; explode(hero.x, hero.y); pop('火油罐掉了！', '#ff7a4a'); } }
    for (const f of flying) { f.t += dt; if (f.t >= f.T && !f.done) { f.done = true; explode(f.tx, f.ty); } }
    flying = flying.filter(f => !f.done);
    for (const f of fx) { f.t += dt; if (f.k === 'shard') { f.vy += 400 * dt; f.x += f.vx * dt; f.y += f.vy * dt; } }
    fx = fx.filter(f => f.t < (f.k === 'boom' ? .35 : f.k === 'drink' ? .6 : f.k === 'shard' ? .7 : .8));
  }
  // 战斗加成：伤害（rogue.js 的 onHit 读取）和攻速（R_('aspd') 读取）
  const dmgMul = () => (drunkT > 0 ? 1.3 : 1);
  const aspdMul = () => (drunkT > 0 ? 1 / 1.15 : 1);
  const drunk = () => drunkT > 0;
  function drawWorld() {
    if (typeof ctx === 'undefined') return;
    const T = performance.now() / 1000;
    ctx.save(); ctx.imageSmoothingEnabled = false;
    for (const g of ground) {   // 地上的补给：浮动 + 光晕 + 名字
      const im = img(KINDS[g.k].icon), bob = g.z > 0 ? g.z : 2 + Math.sin(T * 4 + g.x) * 2, a = g.t > 26 ? (Math.floor(g.t * 6) % 2 ? .3 : 1) : 1;
      ctx.globalAlpha = .35 * a; ctx.fillStyle = g.k === 'jinchuang' ? '#8fe08a' : g.k === 'jiu' ? '#ff9a5a' : '#ffb04a'; ctx.beginPath(); ctx.ellipse(g.x, g.y, 10, 3.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = a;
      if (im) { const h = 15, w = h * im.width / im.height; ctx.drawImage(im, g.x - w / 2, g.y - h - bob, w, h); }
      if (Math.abs(g.x - hero.x) < 50) { ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe9b0'; ctx.fillText(KINDS[g.k].name, g.x, g.y - 22 - bob); ctx.textAlign = 'left'; }
    }
    ctx.globalAlpha = 1;
    if (jar && hero.st !== 'down') { const im = img('sup_huoyou'); if (im) { const h = 12, w = h * im.width / im.height; ctx.drawImage(im, hero.x - w / 2 + hero.f * 3, hero.y - 50 - h + Math.sin(T * 6), w, h); } if (Math.random() < .3) fx.push({ k: 'drip', x: hero.x + hero.f * 3, y: hero.y - 50, t: 0 }); }   // 举在头顶的火油罐
    for (const f of flying) {   // 抛物线飞出去、翻转
      const p = Math.min(1, f.t / f.T), x = f.sx + (f.tx - f.sx) * p, y = f.sy + (f.ty - f.sy) * p - Math.sin(p * Math.PI) * 50, im = img('sup_huoyou');
      if (im) { const h = 11, w = h * im.width / im.height; ctx.save(); ctx.translate(x, y); ctx.rotate(p * 9); ctx.drawImage(im, -w / 2, -h / 2, w, h); ctx.restore(); }
      ctx.fillStyle = 'rgba(80,70,60,.4)'; ctx.fillRect(x - 6 * hero.f, y + 2, 3, 3);
    }
    for (const f of fx) {
      if (f.t < 0) continue;
      if (f.k === 'heal') { ctx.globalAlpha = 1 - f.t / .8; ctx.fillStyle = Math.random() < .5 ? '#8fe08a' : '#ffffff'; const y = f.y - f.t * 30; ctx.fillRect(f.x - .5, y - 2, 1, 4); ctx.fillRect(f.x - 2, y - .5, 4, 1); }
      else if (f.k === 'steam') { ctx.globalAlpha = .4 * (1 - f.t / .8); ctx.fillStyle = '#ff7a5a'; ctx.beginPath(); ctx.arc(f.x, f.y - f.t * 20, 2 + f.t * 3, 0, Math.PI * 2); ctx.fill(); }
      else if (f.k === 'drip') { ctx.globalAlpha = 1 - f.t / .8; ctx.fillStyle = '#3a2a1a'; ctx.fillRect(f.x, f.y + f.t * 40, 1.5, 2); }
      else if (f.k === 'shard') { ctx.globalAlpha = 1 - f.t / .7; ctx.fillStyle = '#5a3a26'; ctx.fillRect(f.x, f.y, 2.5, 2); }
      else if (f.k === 'boom') { const p = f.t / .35; ctx.globalAlpha = 1 - p; ctx.fillStyle = '#ffb040'; ctx.beginPath(); ctx.ellipse(f.x, f.y - 8, 12 + p * 30, 8 + p * 18, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#fff1a0'; ctx.beginPath(); ctx.ellipse(f.x, f.y - 8, 6 + p * 14, 4 + p * 9, 0, 0, Math.PI * 2); ctx.fill(); }
      else if (f.k === 'drink') { const im = img('sup_jiu'); if (im) { ctx.globalAlpha = 1 - f.t / .6; ctx.save(); ctx.translate(hero.x + hero.f * 6, hero.y - 46); ctx.rotate(-hero.f * (.3 + f.t * 2)); ctx.drawImage(im, -6, -6, 12, 12); ctx.restore(); } }
    }
    ctx.restore();
  }
  // 屏幕左上角：持续中的补给效果和倒计时
  function hud(x, y) {
    if (typeof ctx === 'undefined') return;
    const list = []; if (drunkT > 0) list.push(['sup_jiu', drunkT]); if (regenT > 0) list.push(['sup_jinchuang', regenT]); if (jar) list.push(['sup_huoyou', 20 - jar.t]); if (stash) list.push(['sup_jinchuang', '存']);
    list.forEach(([k, t], i) => { const im = img(k); ctx.save(); ctx.imageSmoothingEnabled = false; ctx.fillStyle = 'rgba(20,14,10,.65)'; ctx.fillRect(x + i * 46, y, 42, 22); if (im) ctx.drawImage(im, x + i * 46 + 3, y + 2, 18 * im.width / im.height, 18); ctx.fillStyle = '#ffe9b0'; ctx.font = 'bold 12px sans-serif'; ctx.fillText(typeof t === 'string' ? t : Math.ceil(t) + 's', x + i * 46 + 22, y + 16); ctx.restore(); });
  }
  // 商店带进来的：开局存一瓶金创药 / 直接喝一坛杜康酒
  function giveStash() { stash = 1; }
  function drink() { apply('jiu', true); }
  window.SUPPLY = { giveStash, drink, reset, drop, onCrateBreak, throwJar, tick, drawWorld, hud, dmgMul, aspdMul, drunk, holding: () => !!jar, stashed: () => stash };
})();
