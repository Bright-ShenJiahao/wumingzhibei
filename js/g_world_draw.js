// 世界绘制：投射物/命中特效/道具/主角/敌人（2026-10-31 从 game.js 原样拆出，逻辑不变）
// 依赖 game.js 的全局变量，只在运行时调用；本文件加载时不访问 game.js 的变量。
function drawShot(s) {
  if (s.kind === 'arrow') {
    const ar = IMG.ui_arrow;
    ctx.save(); ctx.translate(s.x, s.y - s.z); ctx.rotate(Math.atan2(s.vy || 0, s.vx || 1));
    if (s.volley) {
      ctx.strokeStyle = 'rgba(255,228,150,.65)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-19, 0); ctx.stroke();
    }
    if (ar && ar.complete) { ctx.imageSmoothingEnabled = false; ctx.drawImage(ar, -ar.width * PX / 2, -ar.height * PX / 2, ar.width * PX, ar.height * PX); }
    ctx.restore();
    return;
  }
  const img = s.charged ? IMG.ui_stone_shot_charge : s.final ? IMG.ui_stone_shot_final : IMG.ui_stone_shot;
  if (!img || !img.complete) { stone(s.x, s.y - s.z); return; }
  const w = s.charged ? 14 : s.final ? 16 : 6;
  const h = w * img.height / img.width;
  ctx.save(); ctx.translate(s.x, s.y - s.z);
  if (s.vx < 0) ctx.scale(-1, 1);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}
function drawStoneHit(h) {
  const img = IMG.ui_stone_hit;
  if (!img || !img.complete) return;
  const frame = Math.min(3, Math.max(0, Math.floor(h.t / .05)));
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, frame * 48, 0, 48, 48, h.x - 6, h.y - 6, 12, 12);
  ctx.restore();
}
function drawBluntHit(h) {
  if (h.big) {   // 终段爆发：80×80 三帧，画成 30 像素
    const im = IMG.ui_hit_finisher;
    if (!im || !im.complete) return;
    const fr = Math.min(2, Math.floor(h.t / .067));
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(im, fr * 80, 0, 80, 80, h.x - 15, h.y - 15, 30, 30);
    ctx.restore(); return;
  }
  const img = IMG.ui_hit_blunt;
  if (!img || !img.complete) return;
  const frame = Math.min(2, Math.max(0, Math.floor(h.t / .05)));
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, frame * 48, 0, 48, 48, h.x - 7, h.y - 7, 14, 14);
  ctx.restore();
}
function drawBleedFx(f) {
  const kind = f.kind;
  const img = kind === 'rip' ? IMG.ui_halberd_rip : kind === 'splash' ? IMG.ui_bleed_splash : IMG.ui_bleed_drip;
  if (!img || !img.complete) return;
  const fw = kind === 'rip' ? 64 : kind === 'splash' ? 48 : 32;
  const frame = Math.min(2, Math.max(0, Math.floor(f.t / (kind === 'rip' ? .067 : .05))));
  const size = kind === 'rip' ? 30 : kind === 'splash' ? (f.big ? 24 : 14) : 12;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, frame * fw, 0, fw, fw, f.x - size / 2, f.y - size / 2, size, size);
  ctx.restore();
}
function drawHammerFx(f) {
  const img = f.kind === 'spin' ? IMG.ui_hammer_spin : IMG.ui_hammer_slam;
  if (!img || !img.complete) return;
  const w = f.size, h = w * 60 / 96;
  const frame = Math.min(2, Math.max(0, Math.floor(f.t / .1)));
  ctx.save(); ctx.imageSmoothingEnabled = false;
  const cy = f.kind === 'spin' ? f.y - h * .35 : f.y - h * .6;   // 图的下沿贴着地面，不再以脚底为中心（之前偏下）
  ctx.drawImage(img, frame * 96, 0, 96, 60, f.x - w / 2, cy - h / 2, w, h);
  ctx.restore();
}
function drawBladeFx(f) {
  const slash = f.kind === 'slash';
  const img = slash ? IMG.ui_blade_slash : IMG.ui_blade_crescent;
  if (!img || !img.complete) return;
  const fw = slash ? 96 : 56, w = 50, h = slash ? 25 : 90;
  const frame = Math.min(2, Math.max(0, Math.floor(f.t / (f.T / 3))));
  ctx.save(); ctx.imageSmoothingEnabled = false;
  ctx.translate(f.x, f.y);
  if (f.dir < 0) ctx.scale(-1, 1);
  ctx.drawImage(img, frame * fw, 0, fw, fw === 96 ? 48 : 96, -w / 2, -h / 2, w, h);
  ctx.restore();
}
function drawBowFx(f) {
  if (f.kind === 'volley') {
    const img = IMG.ui_bow_volley; if (!img || !img.complete) return;
    const frame = Math.min(2, Math.floor(f.t / (f.T / 3)));
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(f.x, f.y); if (f.dir < 0) ctx.scale(-1, 1);
    ctx.drawImage(img, frame * 72, 0, 72, 40, 0, -8.5, 30, 17);
    ctx.restore(); return;
  }
  if (f.kind === 'impact') {
    const img = IMG.ui_bow_impact; if (!img || !img.complete) return;
    const frame = Math.min(2, Math.floor(f.t / (f.T / 3)));
    ctx.save(); ctx.imageSmoothingEnabled = false;
    const iw = (f.r || 30) * 2.2, ih = iw * 56 / 96;   // 冲击环大小跟判定范围一致
    ctx.drawImage(img, frame * 96, 0, 96, 56, f.x - iw / 2, f.y - ih * .77, iw, ih);   // 图里的环在下方 77% 处，对准落点
    ctx.restore(); return;
  }
  if (f.kind !== 'sky') return;
  if (f.t < .3) {
    const p = f.t / .3, a = .35 + .35 * Math.sin(p * Math.PI);
    ctx.save(); ctx.strokeStyle = `rgba(255,221,112,${a})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(f.x, f.y, f.data.radius, f.data.radius / 2, 0, 0, Math.PI * 2);   // 标记大小 = 实际判定范围 ctx.stroke();
    ctx.fillStyle = `rgba(255,205,80,${a * .22})`; ctx.fill();
    ctx.restore(); return;
  }
  if (f.t >= .5) return;
  const img = IMG.ui_bow_sky; if (!img || !img.complete) return;
  const p = (f.t - .3) / .2, sx = f.x - f.dir * 60, sy = f.y - 60;   // 图里箭尾在左上，箭从主角这一侧的斜上方落下
  const tipX = sx + (f.x - sx) * p, tipY = sy + (f.y - sy) * p;
  const frame = Math.min(2, Math.floor(p * 3));
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(tipX, tipY); if (f.dir < 0) ctx.scale(-1, 1);
  ctx.drawImage(img, frame * 48, 0, 48, 96, -10, -40, 20, 40);
  ctx.restore();
}
function drawHalberdBleedDots(z, top) {
  return;   // 用户定：头顶层数红点不好看，取消；层数改由滴血频率表现
  const n = halberdStacks(z);
  if (!n) return;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const x = z.x + (i - (n - 1) / 2) * 5;
    ctx.fillStyle = '#5b1715'; ctx.beginPath(); ctx.arc(x, top, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ef4b42'; ctx.beginPath(); ctx.arc(x, top - .4, 1.7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
function stone(x, y) { ctx.fillStyle = '#2a2234'; ctx.fillRect(x - 2, y - 2, 4, 4); ctx.fillStyle = '#9a9ea8'; ctx.fillRect(x - 1, y - 1.5, 2, 2); }
function drawProp(p) {
  if (p.broken) return;   // 打坏的草垛/推车不再画
  if (p.fadeAt != null) { const k = gameT - p.fadeAt; if (k > 2) { p.broken = true; return; } if (k > 1.4) { ctx.save(); ctx.globalAlpha = 1 - (k - 1.4) / .6; drawProp({ ...p, fadeAt: null }); ctx.restore(); return; } }   // 碎箱子等：留 1.4 秒后淡出消失
  const [, w0, h0] = ASSETS.props[p.g];
  if (p.vert) {
    // 竖放拒马（jumo_v / jumo_vs 及打坏版）：图本身就是上下排列，前端（图底）贴在 p.y
    const sh = p.hitT > 0 ? Math.sin(p.hitT * 90) * 2.2 : 0;
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(IMG['p_' + p.g], Math.round(p.x - w0 / 2 + sh), Math.round(p.y + 3 - h0), w0, h0);
    ctx.restore(); return;
  }
  const w = (p.dw || w0) * (p.sc || 1), h = (p.dh || h0) * (p.sc || 1);
  const a = p.alpha || (p.solid && hero.y < p.y && hero.y > p.y - h + 6 && Math.abs(hero.x - p.x) < w / 2 + 4 ? .5 : 1);
  const sh = p.hitT > 0 ? Math.sin(p.hitT * 90) * 2.2 : 0;   // 被打中时左右抖一下
  ctx.save(); ctx.globalAlpha = a; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  if (p.chapter2 && ['hay', 'cart', 'mill'].includes(p.g)) ctx.filter = 'brightness(.66) saturate(.6)';   // 第二章暮色战场：道具压暗，不抢人物
  if (p.flip) { ctx.translate(Math.round(p.x), 0); ctx.scale(-1, 1); ctx.translate(-Math.round(p.x), 0); }   // 左右翻转（旗面朝左）
  ctx.drawImage(IMG['p_' + p.g], Math.round(p.x - w / 2 + sh), Math.round(p.y + 2 - h), w, h);
  ctx.restore();
}
function drawChargeAura(h) {
  const p = chargeRatio(), t = performance.now() / 1000, pulse = .5 + .5 * Math.sin(t * (7 + p * 5));
  const col = chargeTier === 3 ? '#ff9a3d' : chargeTier === 2 ? '#ffd84a' : '#ffffff';
  const height = 34 + 34 * p, width = 18 + 10 * p;
  const K = .55;                      // 只比主角大一点点
  ctx.save(); ctx.translate(h.x, h.y - (h.z || 0)); ctx.scale(K, K);
  // 低蓄力时火焰贴身，接近满蓄逐渐向上拔高并向两侧扩张。
  ctx.globalAlpha = .10 + .16 * p + .05 * pulse;
  ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 5 + 8 * p;
  ctx.beginPath(); ctx.ellipse(0, -22, width * (.72 + pulse * .08), 26 + 8 * p, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 2 + 4 * p;
  // 先铺宽阔的火焰主体，再叠尖舌；避免效果看成几根细长光柱。
  const body = [
    [-15, 0], [-27, -7], [-21, -14], [-33, -23], [-24, -28], [-31, -38],
    [-19, -35], [-21, -49], [-11, -43], [-7, -59], [-1, -48], [3, -75],
    [10, -51], [19, -63], [17, -44], [30, -50], [23, -34], [34, -26],
    [25, -16], [29, -7], [16, 0],
  ];
  const sx = width / 28, sy = height / 68;
  for (const [scale, alpha] of [[1, .18 + .20 * p], [.76, .16 + .22 * p]]) {
    ctx.globalAlpha = alpha * (.88 + pulse * .12); ctx.fillStyle = col;
    ctx.beginPath();
    body.forEach(([x, y], i) => {
      const xx = x * sx * scale + Math.sin(t * 8 + i * .7) * (1 + p * 1.3);
      const yy = y * sy * scale;
      if (!i) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
    });
    ctx.closePath(); ctx.fill();
  }
  // 成组的折线火舌：每侧有高低错落的尖峰，底部围住人物而不是几根孤立光柱。
  const tongues = [
    [-1, .58, .23, 0], [-1, .82, .17, 1.4], [-1, .69, .13, 2.8], [-1, .94, .10, 4.1],
    [ 1, .63, .23, 1.1], [ 1, .88, .17, 2.5], [ 1, .72, .13, 3.7], [ 1, .98, .10, 5.2],
  ];
  for (let layer = 0; layer < 2; layer++) {
    for (const [side, peakN, spreadN, phase] of tongues) {
      const sway = Math.sin(t * (8 + layer) + phase) * (1.2 + p * 2.2);
      const peak = height * peakN * (.94 + pulse * .08);
      const spread = width * spreadN * (layer ? .72 : 1);
      const base = side * (4 + layer * 1.5);
      const tip = side * (width * (.42 + spreadN * 1.25) + sway);
      ctx.globalAlpha = (layer ? .46 : .60) * (.45 + .55 * p) + .06 * pulse;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(base - side * spread, -1);
      ctx.lineTo(base - side * (spread * .74), -height * .20);
      ctx.lineTo(tip - side * spread * .32, -height * .31);
      ctx.lineTo(tip, -peak);
      ctx.lineTo(tip + side * spread * .12, -height * (.46 + peakN * .08));
      ctx.lineTo(base + side * spread, -height * .28);
      ctx.lineTo(base + side * spread * .72, -height * .10);
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.shadowBlur = 0;
  // 火舌之间穿插短促碎光，地面有扩散的白色气浪环。
  const moteCount = 5 + Math.round(p * 10);
  for (let i = 0; i < moteCount; i++) {
    const phase = (t * (.24 + (i % 4) * .035) + i / moteCount) % 1;
    const side = i % 2 ? 1 : -1, x = side * (8 + phase * (width + 7)) + Math.sin(t * 9 + i * 2) * 2;
    const y = -4 - phase * (height * (.72 + (i % 3) * .08));
    const size = 1 + (i % 3) * .45;
    ctx.globalAlpha = (.22 + p * .48) * (1 - phase * .55); ctx.fillStyle = col;
    ctx.fillRect(Math.round(x), Math.round(y), size, size * (1.3 + pulse * .6));
  }
  ctx.globalAlpha = .20 + .35 * p + .18 * pulse; ctx.strokeStyle = col; ctx.lineWidth = 1 + p * 1.4;
  ctx.beginPath(); ctx.ellipse(0, -1, 13 + p * 9 + pulse * 2, 3 + p * 2, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = .12 + .22 * p; ctx.fillStyle = col;
  for (let i = 0; i < 7; i++) {
    const side = i % 2 ? 1 : -1, x = side * (12 + (i % 4) * 4 + Math.sin(t * 8 + i) * 2);
    const y = -3 - (i % 3) * 2, r = 1.5 + (i % 3) * .6;
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.6, r * .7, side * .12, 0, Math.PI * 2); ctx.fill();
  }
  if (chargeTierFlash > 0) {
    ctx.globalAlpha = (chargeTierFlash / .18) * .85;
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(0, -24, 30 + 5 * (1 - chargeTierFlash / .18), 38, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

// 献祭：主角身上一层淡红色光晕；敌人贴身每秒叠 1 层（最多 3 层），层数越高红光越亮、光环越多。
function drawFireAura(h) {
  if (!window.ROGUE || !ROGUE.fireAura) return;
  const A = ROGUE.fireAura(); if (!A.active) return;
  const lv = Math.max(1, Math.min(3, A.stacks || 1));
  const t = performance.now() / 1000, pulse = .5 + .5 * Math.sin(t * 2.6);
  const R = 26 + lv * 6;
  // 外层柔光：正常混合压暗一点背景，浅色地面上也能看见
  ctx.save();
  const g = ctx.createRadialGradient(h.x, h.y - 18, 3, h.x, h.y - 18, R);
  g.addColorStop(0, `rgba(255,86,66,${.20 + lv * .035 + pulse * .02})`);
  g.addColorStop(.55, `rgba(214,42,44,${.13 + lv * .025})`);
  g.addColorStop(1, 'rgba(140,16,26,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(h.x, h.y - 18, R * .9, R * 1.05, 0, 0, 7); ctx.fill();
  ctx.restore();
  // 贴身光晕：每层一圈淡红光环（1~3 层），最内圈最亮
  for (let i = 0; i < lv; i++) {
    const rx = 15 + i * 3.2, ry = 20 + i * 3.2;
    ctx.save();
    ctx.strokeStyle = `rgba(255,104,82,${.26 - i * .05 + pulse * .03})`;
    ctx.lineWidth = 1.4;
    ctx.shadowColor = 'rgba(255,70,50,.55)';
    ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.ellipse(h.x, h.y - 17, rx, ry, 0, 0, 7); ctx.stroke();
    ctx.restore();
  }
  // 贴地范围圈：淡红，尽量不抢画面
  ctx.save();
  ctx.strokeStyle = `rgba(255,96,78,${.12 + lv * .04})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(h.x, h.y, 24, 10, 0, 0, 7); ctx.stroke();
  ctx.restore();
  // 缓缓上升的火星
  ctx.save();
  for (let i = 0; i < lv * 4; i++) {
    const ph = (t * (.32 + i * .045) + i * .37) % 1;
    const x = h.x + Math.sin(t * 1.6 + i * 2.3) * (9 + lv * 2.4);
    const y = h.y - 7 - ph * (26 + lv * 6);
    ctx.globalAlpha = (1 - ph) * (.30 + lv * .09);
    ctx.fillStyle = i % 2 ? '#ff9a64' : '#ff4a3a';
    ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
  }
  ctx.restore();
}

function drawHero() {
  const h = hero; shadow(h.x, h.y, 10);
  if (!over && h.st !== 'down') drawFireAura(h);
  h.shieldFlash = Math.max(0, (h.shieldFlash || 0) - 1 / 60);
  if (window.ROGUE && ROGUE.shieldReady && ROGUE.shieldReady()) {
    const pulse = .72 + .18 * Math.sin(performance.now() / 230);
    ctx.save(); ctx.globalAlpha = pulse; ctx.strokeStyle = '#d9b968'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(h.x, h.y - 13, 15, 20, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,236,171,.68)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(h.x, h.y - 13, 12, 17, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }
  if (h.shieldFlash > 0) { ctx.save(); ctx.globalAlpha = h.shieldFlash / .22; ctx.fillStyle = '#ffe79b'; ctx.beginPath(); ctx.arc(h.x, h.y - 15, 17, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  if (charging) drawChargeAura(h);   // 蓄力聚气（白色气焰）
  if (h.inv > 0 && h.inv < 2 && h.st !== 'roll' && h.st !== 'down' && Math.floor(h.inv * 20) % 2) return;
  const lift = window.ARTIFACT ? ARTIFACT.drawUnder(h) : 0;   // 踩在飞剑上：剑画在脚下，人抬高一点
  const drunk = window.SUPPLY && SUPPLY.drunk(), sway = drunk && h.st === 'idle' ? Math.sin(performance.now() / 300) * 1.5 : 0;   // 杜康酒：泛红、站着时轻轻摇晃
  if (drunk) { ctx.save(); ctx.filter = 'sepia(.35) saturate(1.8) hue-rotate(-20deg)'; }
  drawChar('hero', heroFrame(h), h.x + sway, h.y - (h.z || 0) - lift, h.f < 0);
  if (drunk) ctx.restore();
}
function drawZ(z) {
  if (z.T.mirror && window.XINMO) { XINMO.draw(z); return; }
  ch2Telegraph(z);
  if (z.T.boss) { Boss.draw(z); drawHalberdBleedDots(z, z.y - 68); if (z.poisonT > 0) { ctx.fillStyle = '#8fd16a'; ctx.fillRect(z.x - 1, z.y - 64, 3, 3); }
    if (z.celebrating) drawCheer(z); return; }
  if (z.T.chapterBoss) {
    if (z.hidden) { shadow(z.x, z.y, 6); return; }   // 张宝土遁：钻在地下
    shadow(z.x, z.y, 16);
    const recoil = 0;
    drawChar(z.sprite, zFrame(z), z.x + recoil, z.y - (z.z || 0), z.f < 0, 1, z.flash > 0, z.sc || 1, !!z.dark);
    if (window.BOSS_BLOCK) BOSS_BLOCK.draw(z);
    return;   // 第二章首领的血条和名字统一画在屏幕上方（ZJ.hud）
    drawHalberdBleedDots(z, z.y - 58);
    const w = 34, y = z.y - 49;
    ctx.fillStyle = '#211510'; ctx.fillRect(z.x - w / 2, y, w, 4);
    ctx.fillStyle = '#c93420'; ctx.fillRect(z.x - w / 2 + 1, y + 1, (w - 2) * Math.max(0, z.hp / z.T.hp), 2);
    ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 2; ctx.strokeStyle = '#2a160f'; ctx.fillStyle = '#ffe4ad';
    ctx.strokeText(z.T.name, z.x, y - 3); ctx.fillText(z.T.name, z.x, y - 3); ctx.textAlign = 'left';
    return;
  }
  shadow(z.x, z.y, 10);
  const a = z.st === 'gone' ? Math.max(0, 1 - z.t * 1.2) * (Math.floor(z.t * 12) % 2 ? .4 : 1) : 1;
  const hop = z.celebrating ? Math.abs(Math.sin(z.celebrateT * 7)) * 2.5 : 0;
  drawChar(z.sprite || z.type, zFrame(z), z.x, z.y - (z.z || 0) - hop, z.f < 0, a, z.flash > 0, z.sc || 1, !!z.dark);
  if (z.celebrating) drawCheer(z);
  if (z.dead || z.air || z.st === 'land') return;
  drawHalberdBleedDots(z, z.y - 40);
  const top = z.y - 34;
  if (z.st === 'sleep') {
    const bob = Math.sin(performance.now() / 300) * 2;
    ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = 2;
    ctx.strokeStyle = '#34231b'; ctx.fillStyle = '#fff0a8';
    ctx.strokeText('Z', z.x + 9, z.y - 20 + bob); ctx.fillText('Z', z.x + 9, z.y - 20 + bob);
    ctx.textAlign = 'left'; return;
  }
  if (z.st === 'wake') {
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = 3;
    ctx.strokeStyle = '#34231b'; ctx.fillStyle = '#ff4a32';
    ctx.strokeText('!', z.x, top - 4); ctx.fillText('!', z.x, top - 4); ctx.textAlign = 'left';
  }
  if (z.daze > 0) {   // 头顶转圈的小黄星
    const t = performance.now() / 260;
    for (let k = 0; k < 3; k++) {
      const a = t + k * 2.094, sx = z.x + Math.cos(a) * 7, sy = top - 6 + Math.sin(a) * 2;
      ctx.fillStyle = '#3a2410'; ctx.fillRect(sx - 2, sy - 2, 4, 4); ctx.fillStyle = '#ffd84a'; ctx.fillRect(sx - 1.5, sy - .5, 3, 1); ctx.fillRect(sx - .5, sy - 1.5, 1, 3);
    }
  }
  if (z.poisonT > 0) { ctx.fillStyle = '#8fd16a'; ctx.fillRect(z.x - 1, top - 5, 3, 3); ctx.fillStyle = '#4c8a43'; ctx.fillRect(z.x + 3, top - 7, 2, 2); }
  if (z.st === 'wind' && !z.T.ranged) { ctx.fillStyle = '#e03a2a'; ctx.fillRect(z.x - 1, top - 10, 3, 6); ctx.fillRect(z.x - 1, top - 2.5, 3, 2); }
  const barW = (z.T.elite || z.T.ch2Elite) ? 26 : 18;
  const barY = top;
  ctx.fillStyle = '#18101e'; ctx.fillRect(z.x - barW / 2, barY, barW, 3); ctx.fillStyle = (z.T.elite || z.T.ch2Elite) ? '#e04a2a' : z.T.heavy ? '#e0a030' : '#7ad06a'; ctx.fillRect(z.x - barW / 2 + 1, barY + 1, (barW - 2) * z.hp / z.T.hp, 1);
}
function drawCheer(z) {
  const t = z.celebrateT || 0, bob = Math.abs(Math.sin(t * 7)) * 2.5, y = z.y - 20 - bob;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < 3; i++) {
    const phase = (t * 2.8 + i / 3) % 1, x = z.x + (i - 1) * 9 + Math.sin(t * 5 + i) * 2;
    const sy = y - 12 - phase * 14;
    ctx.globalAlpha = 1 - phase;
    ctx.fillStyle = i % 2 ? '#f5c75e' : '#e76a3b';
    ctx.fillRect(x, sy, 2, 3);
  }
  ctx.restore();
}

// 画布按实际显示尺寸 × 设备像素比绘制（手机上更清晰），窗口/横竖屏变化时重新适配
