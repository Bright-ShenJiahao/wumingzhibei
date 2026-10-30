// 投射物：主角和敌人的箭石、霹雳飞石、我方火场（2026-10-31 从 game.js 原样拆出，逻辑不变）
// 依赖 game.js 的全局变量，只在运行时调用；本文件加载时不访问 game.js 的变量。
function updateShots(dt) {
  for(const fx of enemySkillFx)fx.t+=dt;enemySkillFx=enemySkillFx.filter(fx=>fx.t<fx.T);
  for (const s of shots) {
    if (window.GEAR && !s.gearInitialized) { s.gearInitialized=true; GEAR.projectile(s); }
    s.x += s.vx * dt; s.y += (s.vy || 0) * dt; s.life -= dt;
    if (s.kind === 'arrow' && !s.sky) s.traveled = (s.traveled || 0) + Math.hypot(s.vx, s.vy || 0) * dt;
    // 石子碰到草垛/推车/石碾：扣 1 点耐久，石子消失（打中道具也算打中，可以接连招）
    if (s.life > 0) for (const p of props) {
      if (!canHitProp(p)) continue;
      if (Math.abs(propXAt(p, s.y) - s.x) < p.w / 2 + 3 && propDY(p, s.y) < 8) {
        hero.lastHit = gameT; hero.lastHitC = s.c;
        hitProp(p, Math.sign(s.vx)); s.life = 0; break;
      }
    }
    if (s.life > 0) for (const v of villagers) {
      if (v.state === 'gone' || Math.abs(v.x - s.x) >= 10 || Math.abs(v.y - s.y) >= 10) continue;
      s.villagerHits ||= new Set();
      if (!s.villagerHits.has(v)) { v.flash = .12; s.villagerHits.add(v); }
    }
    const projectileTargets = chapter2Run ? zs.slice().sort((a, b) => s.vx >= 0 ? a.x - b.x : b.x - a.x) : zs;
    for (const z of projectileTargets) if (!z.dead && !s.hitSet.includes(z) && !(s.summon && (z.wjHits || 0) >= 4) && Math.abs(z.x - s.x) < 10 + (z.T.w || 0) && Math.abs(z.y - s.y) < 10 && s.life > 0) {
      const baseDmg = window.GEAR ? GEAR.projectileDamage(s,z) : s.C.dmg;
      let pdmg = s.hitSet.length > 0 ? baseDmg * (s.C.pierce ? (s.C.pierceOff || .4) : .5) : baseDmg;   // 穿透：后续目标按武器系数衰减（石子 40%、箭 30%）
      if (s.kind === 'arrow') pdmg *= bowRangeMult(s.traveled || 0);   // 汉弓远射：按已飞行距离结算
      const traits = window.GEAR ? GEAR.projectileTraits(s) : { secondary: !!s.secondary, scatter: !!s.scatter };
      if (s.C.dazeChance != null) traits.dazeChance = s.C.dazeChance;
      if (s.C.dazeTime != null) traits.dazeTime = s.C.dazeTime;
      if ((z.T.boss || z.T.chapterBoss) && s.C.dazeChance) { traits.dazeChance = s.C.dazeChance * .5; traits.dazeTime = s.C.dazeTime; }
      if (s.stoneVolley) { if (s.stoneVolley.hit.has(z)) { pdmg *= .3; traits.dazeChance = 0; } else s.stoneVolley.hit.add(z); }
      if (s.summon) { z.wjHits = (z.wjHits || 0) + 1; if (window.ROGUE && ROGUE.stat) ROGUE.stat('万箭齐发', pdmg, 0); }
      const result = hit(z, pdmg, s.C.kb, Math.sign(s.vx), false, s.C.daze || 0, .15, false, true, traits);   // 最后 true = 远程，管亥可能拨开
      if (result === 'blocked') { s.life = 0; s.gearReturn = false; continue; }
      if (s.charged && s.kind !== 'arrow') addChargeHitFx('stone', s.x, s.y - 5);
      else if (s.kind !== 'arrow') stoneHits.push({ x: s.x, y: s.y - 6, t: 0, T: .2 });
      if (s.statCard && window.ROGUE && ROGUE.stat) ROGUE.stat(s.statCard, pdmg, 0);
      if (!s.secondary) hero.lastHitC = s.c; sfx('hit_stone', s.x); s.hitSet.push(z);
      if (s.gearReturn && !s.spun) { s.spun = true; s.gearReturn = false; gearSpins.push({ x: z.x, y: z.y - 12, t: 0, T: .42, dmg: pdmg * .45, kind: s.kind, dir: Math.sign(s.vx) || 1, done: false }); }   // 回旋（用户定）：打中后绕着中箭处转一小圈，再扫到最多 2 人，每人 45%   // 标记已命中，避免同一颗石子反复打同一个敌人
      if (s.C.noPierce || z.T.blocksPierce || (!s.C.pierce && (!s.gearPierce || s.hitSet.length >= 2))) { s.life = 0; s.gearReturn=false; }
    }
  }
  shots = shots.filter(s => s.life > 0);
  for (const g of gearSpins) {
    g.t += dt;
    if (!g.done && g.t >= g.T * .55) { g.done = true;
      const near = zs.filter(z => !z.dead && !z.air && Math.hypot(z.x - g.x, (z.y - g.y - 12) * 1.6) < 32).sort((a, b) => Math.hypot(a.x - g.x, a.y - g.y) - Math.hypot(b.x - g.x, b.y - g.y)).slice(0, 2);
      for (const z of near) hit(z, g.dmg, 20, Math.sign(z.x - g.x) || g.dir, false, 0, .1, false, true, { secondary: true });
    }
  }
  gearSpins = gearSpins.filter(g => g.t < g.T);
  for (const h of stoneHits) h.t += dt;
  stoneHits = stoneHits.filter(h => h.t < h.T);
  for (const s of eshots) {
    if(s.k==='enemyWave'){const step=Math.min(s.left,Math.abs(s.vx)*dt);s.x+=Math.sign(s.vx)*step;s.left-=step;s.t+=dt;if(Math.abs(hero.x-s.x)<12&&Math.abs(hero.y-s.y)<12&&heroOpen()){dmgHero(1.5,s.source,'skill');s.left=0;}s.life=s.left>0?1:0;continue;}
    if (s.k === 'stone' || s.k === 'arrow') {
      s.x += s.vx * dt; s.life -= dt;
      if (s.life > 0 && Math.abs(hero.x - s.x) < 9 && Math.abs(hero.y - s.y) < 9 && heroOpen()) { sfx(s.k === 'arrow' ? 'hurt' : 'hit_stone', s.x); dmgHero(1, { x: s.x - s.vx, source:s.source }); s.life = 0; }
    } else {
      s.t += dt;
      if (s.t >= s.T) {
        fires.push({ x: s.tx, y: s.ty, t: s.short || 3, r: s.k === 'catapult' ? 32 : 16, seed: rnd(0, 4) }); sfx('fireLand', s.tx); s.life = 0;
        if (s.k === 'catapult') {   // 石块砸地：落点范围内直接伤 2（会击倒），再留火场
          shake = Math.max(shake, .25);
          if (Math.abs(hero.x - s.tx) < 30 && Math.abs(hero.y - s.ty) < 14) dmgHero(2, { x: s.tx, y: s.ty });
          for (let i = 0; i < 10; i++) propFx.push({ x: s.tx + rnd(-8, 8), y: s.ty - 3, vx: rnd(-90, 90), vy: rnd(-140, -50), w: 2.5, h: 2.5, life: .5, max: .5, c: Math.random() < .5 ? '#5a4a3a' : '#a0461e' });
        }
      } else s.life = 1;
    }
  }
  eshots = eshots.filter(s => s.life > 0);
  for (const f of fires) {
    f.t -= dt;
    if (Math.abs(hero.x - f.x) < f.r && Math.abs(hero.y - f.y) < f.r * .45) dmgHero(1, null);

  }
  fires = fires.filter(f => f.t > 0);
  updateCatapults(dt);
}

// ---------- 投石车 ----------
let volleyHits = new Map(), gearSpins = [];   // 霹雳飞石：同一个敌人这一招最多挨 3 块石头（用户定：主动技能清场，不打单体爆发）
function catapultVolley() {
  volleyHits = new Map();
  for (const k in CH.yellow_catapult || {}) { const fr = CH.yellow_catapult[k], e = (LAZY.chapter2 || []).find(x => x[0] === fr.img); if (e && !e[0].src) e[0].src = e[1]; }   // 第一章也用正式投石车图：只单独下载这几帧
  // 霹雳飞石（加强）：投石车直接出现在主角身后，不再慢慢走进来；每台投两轮（共 6 块），砸向敌群
  for (let i = 0; i < 3; i++) {
    // 用户定：投石车在画面最左边一字排开，往右投，投完往左撤出
    const x = cam.x + 24 + (i % 2) * 26, y = M.top + 40 + i * ((M.bot - M.top - 60) / 2);
    catapults.push({ x: x - 50, y, tx: x, t: -i * .15, fired: false, phase: 'in', ft: 0, shots: 2 });
  }
  sfx('land', cam.x + 40); say('投石车来了！', 1.6);
}
function updateCatapults(dt) {
  for (const c of catapults) {
    c.t += dt;
    if (c.t < 0) continue;
    if (c.phase === 'in') {
      c.x += 160 * dt;   // 快速推进场
      if (c.x >= c.tx) { c.x = c.tx; c.phase = 'aim'; c.ft = 0; }
    } else if (c.phase === 'aim') {
      c.ft += dt;
      if (c.ft > .35) {
        c.phase = 'fire'; c.fired = true; c.ft = 0;
        // 优先砸向画面里的敌人（略带随机偏移），没有敌人才砸玩家附近
        const foes = zs.filter(z => !z.dead && !z.air && z.x > cam.x - 20 && z.x < cam.x + viewW() + 20);
        let tx, ty;
        if (foes.length) {   // 砸人多的地方（每台挑一个不同的敌群）
          const ranked = foes.map(z => [z, foes.filter(o => Math.hypot(o.x - z.x, (o.y - z.y) * 2) < 45).length + Math.random() * .5]).sort((a, b) => b[1] - a[1]);
          const tgt = ranked[(catapults.indexOf(c) + (c.shots === 1 ? 1 : 0)) % ranked.length][0];
          tx = tgt.x + rnd(-6, 6); ty = tgt.y + rnd(-4, 4);
        } else {
          tx = hero.x + rnd(-90, 90); ty = rnd(M.top + 10, M.bot - 6);
        }
        tx = Math.max(cam.x + 40, Math.min(cam.x + viewW() - 30, tx));
        ty = Math.max(M.top + 8, Math.min(M.bot - 4, ty));
        allyShots.push({ sx: c.x, sy: c.y - 26, x: c.x, y: c.y - 26, tx, ty, t: 0, T: .75, rogue: true });
        sfx('sling', c.x);
      }
    } else if (c.phase === 'fire') {
      c.ft += dt;
      if (c.ft > .3) { c.shots = (c.shots || 1) - 1; if (c.shots > 0) { c.phase = 'aim'; c.ft = -.5; } else c.phase = 'out'; }
    } else if (c.phase === 'out') {
      c.x -= 70 * dt;
    }
  }
  catapults = catapults.filter(c => !(c.phase === 'out' && c.x < cam.x - 90));
  for (const s of allyShots) {
    s.t += dt;
    const k = Math.min(1, s.t / s.T);
    s.x = s.sx + (s.tx - s.sx) * k;
    s.y = s.sy + (s.ty - s.sy) * k - Math.sin(k * Math.PI) * 120;
    if (k >= 1) {
      s.done = true;
      shake = Math.max(shake, .18);
      sfx('land', s.tx);
      for (const z of zs) {
        if (z.dead || z.air) continue;
        if (Math.abs(z.x - s.tx) < 40 && Math.abs(z.y - s.ty) < 24 && (!s.rogue || (volleyHits.get(z) || 0) < 3) && (!s.rogue || volleyHits.set(z, (volleyHits.get(z) || 0) + 1))) (window.ROGUE && ROGUE.stat && ROGUE.stat('霹雳飞石', 1.5, 0)), hit(z, 1.5, 40, Math.sign(z.x - s.tx) || 1, false, .3, .4, true, true, { scaled: true, siegeShot: true });
      }
      if (!allyFires.some(f => f.cat && Math.hypot(f.x - s.tx, (f.y - s.ty) * 2) < 18)) allyFires.push({ x: s.tx, y: s.ty, t: R_('catapultFire', 4), r: 26, tick: 0, dmg: .2, cat: true });   // 火场不叠在同一处   // 霹雳飞石火场：3 秒、每 0.5 秒 0.2
      for (let i = 0; i < 10; i++) propFx.push({ x: s.tx + rnd(-16, 16), y: s.ty + rnd(-8, 4), vx: rnd(-60, 60), vy: rnd(-110, -30), w: rnd(2, 4), h: rnd(2, 4), life: rnd(.3, .6), max: .6, c: '#ff9a2e' });
    }
  }
  allyShots = allyShots.filter(s => !s.done);
  for (const f of allyFires) {
    f.t -= dt; f.tick -= dt;
    if (f.tick <= 0) {
      f.tick = .5;
      for (const z of zs) {
        if (z.dead || z.air) continue;
        if (Math.abs(z.x - f.x) < f.r && Math.abs(z.y - f.y) < f.r * .45) {
          if (f.once) { if (f.once.has(z)) continue; f.once.add(z); }   // 燎步：每个敌人只烫一次
          hit(z, f.dmg || .3, 0, 0, false, 0, 0, false, true, { dot: true });
        }
      }
    }
  }
  allyFires = allyFires.filter(f => f.t > 0);
}
function drawCatapults() {
  for (const c of catapults) {
    if (c.t < 0) continue;
    const fr = c.phase === 'fire' ? 'fire' : c.phase === 'aim' ? 'load' : 'idle';
    const f = CH.yellow_catapult && (CH.yellow_catapult[fr] || CH.yellow_catapult.idle);
    if (f && f.img && f.img.complete && f.img.naturalWidth) {
      const sc = .62, w = f.w * sc, h = f.h * sc;
      ctx.save(); ctx.translate(Math.round(c.x), 0); ctx.scale(-1, 1); ctx.drawImage(f.img, Math.round(-w / 2), Math.round(c.y + 4 - h), w, h); ctx.restore();   // 原图朝左（敌方用），我方投石车往右投，镜像
    } else {   // 第一章没加载投石车图（只在第二章按需下载）：用代码画一台简易投石车
      ctx.save(); ctx.translate(c.x, c.y); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(0, 1, 18, 4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#6b4424'; ctx.fillRect(-16, -8, 32, 6); ctx.fillStyle = '#3a2412'; ctx.beginPath(); ctx.arc(-11, -1, 4, 0, 7); ctx.arc(11, -1, 4, 0, 7); ctx.fill();
      ctx.fillStyle = '#7a5030'; ctx.fillRect(-3, -22, 6, 15);
      const ang = c.phase === 'fire' ? -1.1 : -.25; ctx.save(); ctx.translate(0, -20); ctx.rotate(ang); ctx.fillStyle = '#8a5a32'; ctx.fillRect(-20, -2, 26, 4); ctx.fillStyle = '#4a3020'; ctx.fillRect(-22, -4, 5, 8); ctx.restore(); ctx.restore();
    }
  }
  for (const s of allyShots) {
    ctx.fillStyle = '#6b6b6b';
    ctx.beginPath(); ctx.arc(s.x, s.y, 5, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,150,40,.9)';
    ctx.beginPath(); ctx.arc(s.x, s.y, 2.4, 0, 7); ctx.fill();
  }
}

// 投石车火场：复用弓箭手地面火苗的 4 帧，整体调成偏朱红，和黄橙色的火箭火区分开。
const allyFireTint = [];
function allyFireFrame(k) {
  if (allyFireTint[k]) return allyFireTint[k];
  const im = IMG['ui_fire' + k];   // 打包时 UI 图统一加 ui_ 前缀
  if (!im || !im.complete || !im.naturalWidth) return null;
  const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
  const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  let px; try { px = g.getImageData(0, 0, c.width, c.height); } catch (e) { allyFireTint[k] = im; return im; }   // 跨域读不了像素：直接用原图
  const d = px.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const lum = d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114;
    d[i] = Math.min(255, d[i] * .92 + 16);                 // 红
    d[i + 1] = Math.min(255, d[i + 1] * .42 + lum * .08);  // 压掉黄绿
    d[i + 2] = Math.min(255, d[i + 2] * .58 + lum * .12);  // 蓝略抬，偏朱红
  }
  g.putImageData(px, 0, 0);
  allyFireTint[k] = c;
  return c;
}
function drawAllyFire() {
  const now = performance.now() / 90;
  for (const f of allyFires) {
    f.t0 ??= f.t;   // 用户反馈「火烧连营有延迟」：原来按 4 秒火场写死，5 秒的火前 1 秒是透明的 → 改按各自时长淡入淡出
    const fade = Math.min(1, f.t / .6);
    const a = Math.min(1, (f.t0 - f.t) / .15) * fade;
    if (a <= 0) continue;
    // 地面被烤红的一圈（和伤害范围一致）
    const gd = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, f.r);
    gd.addColorStop(0, 'rgba(255,120,70,' + (.26 * a) + ')');
    gd.addColorStop(1, 'rgba(210,40,20,0)');
    ctx.fillStyle = gd;
    ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r, f.r * .45, 0, 0, 7); ctx.fill();
    // 三簇火苗，错开相位和高度
    const seeds = (f.scale || 1) < .6 ? [[0, 1, .4]] : [[-.52, .92, 0], [0, 1.22, .4], [.52, .98, .75]];   // 小火（燎步）只画一簇
    for (let i = 0; i < seeds.length; i++) {
      const [ox, sc, ph] = seeds[i];
      const im = allyFireFrame(Math.floor(now + ph * 4) % 4);
      if (!im) continue;
      const FH = 32 * sc * (f.scale || 1), FW = FH * im.width / im.height;
      ctx.globalAlpha = a * (.86 + .14 * Math.sin(now * .6 + i));
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(im, Math.round(f.x + ox * f.r - FW / 2), Math.round(f.y - FH + 6 * (f.scale || 1)), FW, FH);
      ctx.globalAlpha = 1;
    }
  }
}

