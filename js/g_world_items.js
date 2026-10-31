// 掉落物、可破坏道具、通用特效（2026-10-31 从 game.js 原样拆出，逻辑不变）
// 依赖 game.js 的全局变量，只在运行时调用；本文件加载时不访问 game.js 的变量。
const FOOD = [
  { k: 'bun', heal: 1, w: 72 },   // 包子：最常见，回 1（权重 60→72）
  { k: 'leg', heal: 2, w: 22 },   // 鸡腿：中等，回 2（30→22）
  { k: 'pig', heal: 4, w: 6 },    // 烤乳猪：稀有，回 4（10→6）
];
function spawnDrop(x, y, forceK) {
  let pick;
  if (forceK) pick = FOOD.find(f => f.k === forceK) || FOOD[0];
  else {
    const r = Math.random() * 100;
    let acc = 0; pick = FOOD[0];
    for (const f of FOOD) { acc += f.w; if (r < acc) { pick = f; break; } }
  }
  drops.push({ k: pick.k, heal: pick.heal, x, y, y0: y, z: 10, vy: rnd(120, 190), t: 0, life: 8, got: 0 });
}
function spawnWeaponDrop(id, x, y) {
  if (!['bow', 'blade'].includes(id) || drops.some(d => d.weapon === id && !d.got)) return;
  drops.push({ k: 'weapon', weapon: id, x, y, z: 10, vy: 130, t: 0, life: Infinity, got: 0 });
  say(`发现${id === 'blade' ? '大刀' : '汉弓'}！靠近拾取，永久存入武器仓库。`, 4);
}
function updateDrops(dt) {
  const h = hero;
  for (const d of drops) {
    d.t += dt;
    // 弹跳落地
    if (d.z > 0 || d.vy) {
      d.vy -= 1400 * dt; d.z += d.vy * dt;
      if (d.z <= 0) {
        d.z = 0;
        if (d.vy < -70) { d.vy = -d.vy * .38; sfx('land', d.x); }
        else d.vy = 0;
      }
    }
    if (d.got) continue;
    d.life -= dt;
    if (d.life <= 0) { d.got = 1; continue; }   // 放久了消失
    if (Math.abs(d.x - h.x) < 15 && Math.abs(d.y - h.y) < 16 && d.z < 22) {
      if (d.item) {
        if (window.ARMORY && ARMORY.add(d.item)) { d.got=1; sfx('food',d.x); floaters.push({x:d.x,y:d.y-10,t:0,txt:AFFIX_DATA.names[d.item.type],color:AFFIX_DATA.qualities[d.item.q].color}); }
        continue;
      }
      if (d.weapon) {
        if (window.TITLE && TITLE.grantWeapon && TITLE.grantWeapon(d.weapon, true)) {
          d.got = 1;
          const blade = d.weapon === 'blade';
          if (weapon === (blade ? 'hammer' : 'stone')) setW(d.weapon); else ui();
          sfx('food', d.x);
          floaters.push({ x: d.x, y: d.y - 10, t: 0, txt: blade ? '获得大刀' : '获得汉弓' });
          say(blade ? '大刀已装备短武器槽，按 2 或点武器栏的刀切换。' : '汉弓已装备远程槽，按 3 或点武器栏的弓切换。', 4);
        }
        continue;
      }
      d.got = 1;
      if (d.k === 'roll') {
        const granted = window.ROGUE && ROGUE.grantReroll();
        floaters.push({ x: d.x, y: d.y - 10, t: 0, txt: granted ? 'ROLL +1' : '锦囊已满' });
        if (granted) { say('锦囊可重抽一次：下次选卡时按 ROLL', 3); sfx('food', d.x); }
        continue;
      }
      if (h.hp >= maxHeroHp()) {
        if (window.XIAOCHANG && XIAOCHANG.active()) {
          floaters.push({ x: d.x, y: d.y - 10, t: 0, txt: '已满血' });
        } else { // 主线满血时仍按 1 血 = 5 分折算积分。
          const bp = d.heal * 5;
          runBonus += bp;
          floaters.push({ x: d.x, y: d.y - 10, t: 0, txt: '+' + bp + '分' });
        }
      } else {
        h.hp = Math.min(maxHeroHp(), h.hp + d.heal);
        floaters.push({ x: d.x, y: d.y - 10, t: 0, txt: '+' + d.heal, heal: true });
      }
      sfx('food', d.x);
    }
  }
  drops = drops.filter(d => !d.got);
  for (const f of floaters) f.t += dt;
  floaters = floaters.filter(f => f.t < 1.1);
}
// 地面武器按可见内容的长边缩放；透明留白不参与尺寸计算。
const DROP_WEAPON_SIZE = { stone: 10, hammer: 18, blade: 20, bow: 20, staff: 28, halberd: 32 };
const dropIconBounds = new WeakMap();
function weaponDropBounds(im) {
  if (!im || !im.complete || !im.naturalWidth) return null;
  if (dropIconBounds.has(im)) return dropIconBounds.get(im);
  const w = im.naturalWidth, h = im.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const c = canvas.getContext('2d', { willReadFrequently: true });
  c.drawImage(im, 0, 0);
  let pixels;
  try { pixels = c.getImageData(0, 0, w, h).data; }
  catch (e) { const full = { x: 0, y: 0, w, h }; dropIconBounds.set(im, full); return full; }   // 跨域图片读不了像素（试玩网址上会这样）：退回整张图，不再报错卡死
  let left = w, top = h, right = -1, bottom = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!pixels[(y * w + x) * 4 + 3]) continue;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  const bounds = right < 0 ? null : { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
  dropIconBounds.set(im, bounds);
  return bounds;
}
function drawDrop(d) {
  if (d.weapon) {
    const im = IMG['ui_w_' + d.weapon], y = d.y - (d.z || 0) - 12;
    const size = DROP_WEAPON_SIZE[d.weapon] || 20;
    shadow(d.x, d.y, size * .2); // 影子宽度为长边的 0.4 倍。
    ctx.save(); ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = 'rgba(239,196,96,.18)';
    ctx.beginPath(); ctx.ellipse(d.x, y, size * .3, size * .3, 0, 0, Math.PI * 2); ctx.fill();
    const bounds = weaponDropBounds(im);
    if (bounds) {
      const scale = size / Math.max(bounds.w, bounds.h);
      const w = bounds.w * scale, h = bounds.h * scale;
      ctx.drawImage(im, bounds.x, bounds.y, bounds.w, bounds.h, d.x - w / 2, y - h / 2, w, h);
    }
    ctx.restore(); return;
  }
  const c = ctx, meta = (ASSETS.food || {})[d.k], im = IMG['food_' + d.k];
  const fw = meta ? meta[1] : 12, fh = meta ? meta[2] : 10;
  const zz = d.z || 0, y = d.y - zz;
  // 快消失时闪烁
  if (d.life < 1.2 && Math.floor(d.t * 8) % 2) return;
  // 影子（越高越淡越小）
  const sh = Math.max(.35, 1 - zz / 40);
  c.fillStyle = 'rgba(0,0,0,' + (.28 * sh) + ')';
  c.beginPath(); c.ellipse(d.x, d.y + 2, fw * .38 * sh, 2.4 * sh, 0, 0, 7); c.fill();
  // 光晕
  const gl = c.createRadialGradient(d.x, y - fh * .5, 1, d.x, y - fh * .5, fw * .9);
  gl.addColorStop(0, 'rgba(255,220,120,.22)'); gl.addColorStop(1, 'rgba(255,220,120,0)');
  c.fillStyle = gl; c.beginPath(); c.arc(d.x, y - fh * .5, fw * .9, 0, 7); c.fill();
  if (d.k === 'roll') {
    c.save(); c.translate(d.x, y - fh / 2); c.shadowColor = 'rgba(26,14,8,.9)'; c.shadowOffsetX = .9; c.shadowOffsetY = .9;
    c.fillStyle = '#442518'; c.beginPath(); c.ellipse(0, 0, 6.5, 5, 0, 0, 7); c.fill();
    c.fillStyle = '#c78b3d'; c.beginPath(); c.ellipse(0, -.5, 4.8, 3.5, 0, 0, 7); c.fill();
    c.strokeStyle = '#8e3a24'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-3, -3); c.lineTo(3, 3); c.moveTo(3, -3); c.lineTo(-3, 3); c.stroke();
    c.fillStyle = '#f3d27c'; c.fillRect(-1, -1, 2, 2); c.restore(); return;
  }
  if (im && im.complete) {
    c.save(); c.imageSmoothingEnabled = false;
    c.drawImage(im, Math.round(d.x - fw / 2), Math.round(y - fh), fw, fh);
    c.restore();
    return;
  }
  c.save(); c.translate(d.x, y - fh / 2);
  c.shadowColor = 'rgba(26,14,8,.9)'; c.shadowOffsetX = .9; c.shadowOffsetY = .9;   // 落到沙地上也看得清
  if (d.k === 'bun') {
    c.fillStyle = '#f6efdc'; c.beginPath(); c.ellipse(0, 0, 6, 5, 0, 0, 7); c.fill();
    c.fillStyle = '#fffdf4'; c.beginPath(); c.ellipse(-1, -1.5, 4, 3, 0, 0, 7); c.fill();
    c.fillStyle = '#d8c9a8'; c.fillRect(-.5, -4.5, 1, 1.5);
  } else if (d.k === 'leg') {
    c.strokeStyle = '#f1e6cf'; c.lineWidth = 2.2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(3, 4); c.lineTo(-1, 0); c.stroke();
    c.fillStyle = '#a05a2c'; c.beginPath(); c.ellipse(-3, -2, 6, 5, -.5, 0, 7); c.fill();
    c.fillStyle = '#c47a3e'; c.beginPath(); c.ellipse(-4, -3, 3.5, 2.6, -.5, 0, 7); c.fill();
  } else {
    c.fillStyle = '#b4522a'; c.beginPath(); c.ellipse(0, 0, 9, 6, 0, 0, 7); c.fill();
    c.fillStyle = '#d06a35'; c.beginPath(); c.ellipse(-1, -1.5, 6.5, 3.6, 0, 0, 7); c.fill();
    c.fillStyle = '#b4522a'; c.beginPath(); c.arc(7, -2, 3.4, 0, 7); c.fill();   // 头
    c.fillStyle = '#8a3d1e'; c.fillRect(-6, 4, 3, 2); c.fillRect(2, 4, 3, 2);    // 腿
    c.fillStyle = '#f4c07a'; c.beginPath(); c.arc(7.5, -2.5, 1.1, 0, 7); c.fill();
  }
  c.shadowColor = 'transparent'; c.shadowOffsetX = 0; c.shadowOffsetY = 0;
  c.restore();
}
function drawFloaters() {
  for (const f of floaters) {
    const emph = f.big || f.dodge || f.gold;
    ctx.globalAlpha = Math.max(0, 1 - f.t / 1.1);
    ctx.font = 'bold ' + (emph ? 17 : 13) + 'px "PingFang SC","Noto Sans CJK SC",sans-serif';
    ctx.textAlign = 'center';
    if(f.color){ctx.fillStyle=f.color;} else if (f.red) {
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(45,8,8,.9)'; ctx.lineJoin = 'round';
      ctx.strokeText(f.txt, f.x, f.y - f.t * 26);
      ctx.fillStyle = '#ff5a4d';
    } else if (f.dodge || f.gold) {
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(40,24,10,.85)'; ctx.lineJoin = 'round';
      ctx.strokeText(f.txt, f.x, f.y - f.t * 26);
      ctx.fillStyle = '#ffe27a';
    } else {
      // 颜色按用途分：回血绿色；暴击/背击/补刀/格挡橙色；掉落按品级色；其他提示米白
      const c = f.color || (f.heal ? '#8ef07a' : f.big ? '#ffa94d' : '#f3e6c4');
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(30,18,10,.85)'; ctx.lineJoin = 'round';
      ctx.strokeText(f.txt, f.x, f.y - f.t * 26);
      ctx.fillStyle = c;
    }
    ctx.fillText(f.txt, f.x, f.y - f.t * 26);
  }
  ctx.globalAlpha = 1; ctx.textAlign = 'left';
}
// 能打碎的道具：第一章草垛/推车/石碾，第二章全部道具和旗子
const BREAKABLE_PROPS = new Set(['hay', 'cart', 'mill', 'sacks', 'crate', 'rack', 'jumo', 'jumo_v', 'jumo_vs', 'debris', 'stones', 'brazier', 'flag_y', 'flag_ren', 'flag_di', 'flag_tian', 'flag_cang', 'flag_huang', 'fudeng', 'cao_crate', 'zb_wall']);   // cao_crate：第二章曹军补给箱（打碎变 'cao_crate_broken' 并掉补给，见 js/supply.js）
const canHitProp = p => !p.broken && BREAKABLE_PROPS.has(p.g) && !(IMG['p_' + p.g] && IMG['p_' + p.g].complete && !IMG['p_' + p.g].naturalWidth);   // 图片下载失败、玩家看不见的道具，不挡飞行物（防「石子打不到人」）
function hitProp(p, dir) {
  if (!canHitProp(p)) return;
  p.hp--; p.hitT = .15;   // 左右抖 0.15 秒
  const hay = p.g === 'hay', mill = p.g === 'mill', jumo = p.g === 'jumo' || p.g === 'jumo_v' || p.g === 'jumo_vs', broken = p.hp <= 0;
  sfx(broken ? 'land' : 'hit_staff', p.x);
  const sack = p.g === 'sacks';
  const flag = p.g.startsWith('flag_');
  const cols = flag ? ['#e8c24a', '#c99a2a', '#6b4a24'] : p.g === 'brazier' ? ['#ff8a2a', '#ffd04a', '#3a3030'] : p.g === 'stones' ? ['#6e6a66', '#9a958e', '#4a4440'] : hay ? ['#8a5a18', '#c98a25', '#edc34d'] : mill ? ['#5b5146', '#8a7a66', '#b3a286'] : sack ? ['#4a3a34', '#6b564a', '#a98c5a'] : p.g === 'crate' || p.g === 'rack' ? ['#2e221d', '#4a3a30', '#6a5444'] : ['#4b2c12', '#7a4d22', '#a3703c'];
  const n = broken ? 22 : 7;
  for (let i = 0; i < n; i++) {
    const life = broken ? rnd(.42, .65) : rnd(.32, .55);
    // 草垛掉细条状的稻草，推车掉方块状的木片，石碾掉碎石
    const w = hay ? rnd(2.8, 4.6) : rnd(1.8, 3.2), hh = hay ? 1.2 : w;
    propFx.push({ x: p.x + rnd(-p.w * .35, p.w * .35), y: p.y - rnd(4, p.h * .7),
      vx: rnd(-70, 70) + (dir || 0) * 35, vy: rnd(-130, -45), w, h: hh, life, max: life,
      c: cols[Math.floor(Math.random() * cols.length)] });
  }
  if (broken) {
    if (p.g === 'fudeng') {   // 符灯打灭：换成倒地熄灭的灯，不再挡路
      const meta = ASSETS.props.fudeng_off;
      p.g = 'fudeng_off'; p.solid = false; p.hp = 0;
      if (meta) { p.w = meta[1]; p.h = meta[2]; }
    } else if (p.zbWall) {   // 张宝的土墙被打碎：换成碎墙，淡出
      const meta = ASSETS.props.zb_wall_broken; p.g = 'zb_wall_broken'; p.solid = false; p.hp = 0; p.fadeAt = gameT; if (meta) { p.w = meta[1]; p.h = meta[2]; }
    } else if (p.supply && window.SUPPLY) {   // 曹军补给箱：换成碎箱子，掉一个补给
      SUPPLY.onCrateBreak(p);
    } else if (jumo) {
      const meta = ASSETS.props[p.g + '_broken'];   // 'jumo_broken' / 'jumo_v_broken' / 'jumo_vs_broken'
      p.g = p.g + '_broken'; p.solid = false; p.hp = 0; p.broken = true;   // 打碎就消失（碎屑已经飞出去了）
      if (meta && !p.vert) { p.w = meta[1]; p.h = meta[2]; }
    } else {
      p.broken = true; p.solid = false;
      if (flag) {
        // 打倒旗子：每一战第一次打倒旗子给一次锦囊
        if (chapter2Run && [1, 2, 4].includes(chapter2Run.battle) && window.ROGUE && !chapter2Run['flagCard' + chapter2Run.battle]) {   // 战一、二、四的黄旗打落给锦囊
          chapter2Run['flagCard' + chapter2Run.battle] = true;
          floaters.push({ x: p.x, y: p.y - 40, t: 0, txt: '斩旗！', big: true, gold: true });
          sfx('finisher', p.x); ROGUE.offer();
        }
      } else if (p.chapter2) { if (Math.random() < .4) spawnDrop(p.x, p.y); }   // 用户定：第二章道具掉回血 70%→40%   // 第二章道具 70% 掉回血食物（用户定）
      else if (Math.random() < .7) spawnDrop(p.x, p.y);                        // 第一章草垛/推车/石碾 70%（用户定）
    }
  }
}
// 命中/蓄力等临时特效
function updateFx(dt) {
  for (const q of qiFx) q.t += dt;
  qiFx = qiFx.filter(q => q.t < q.T);
  for (const q of chargeFx) q.t += dt;
  chargeFx = chargeFx.filter(q => q.t < q.T);
  for (const h of bluntHits) h.t += dt;
  bluntHits = bluntHits.filter(h => h.t < h.T);
  for (const f of hammerFx) f.t += dt;
  hammerFx = hammerFx.filter(f => f.t < f.T);
  for (const f of bladeFx) f.t += dt;
  bladeFx = bladeFx.filter(f => f.t < f.T);
  const bowImpacts = [];
  for (const f of bowFx) {
    f.t += dt;
    if (f.kind === 'sky' && !f.resolved && f.t >= .5) {
      f.resolved = true; resolveBowSky(f);
      bowImpacts.push({ kind: 'impact', x: f.x, y: f.y, t: 0, T: .2, r: f.data.radius });
    }
  }
  bowFx = bowFx.filter(f => f.kind === 'sky' ? f.t < .6 : f.t < f.T);
  bowFx.push(...bowImpacts);
  for (const q of chargeHitFx) q.t += dt;
  chargeHitFx = chargeHitFx.filter(q => q.t < q.T);
  for (const q of blessFx) q.t += dt;
  blessFx = blessFx.filter(q => q.t < q.T);
  for (const gh of ghosts) gh.t += dt;
  ghosts = ghosts.filter(gh => gh.t < .45);
}
function updatePropFx(dt) {
  for (const p of props) if (p.hitT > 0) p.hitT = Math.max(0, p.hitT - dt);
  for (const f of propFx) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 260 * dt; f.life -= dt; }
  propFx = propFx.filter(f => f.life > 0);
}
function drawPropFx() {
  for (const f of propFx) {
    ctx.globalAlpha = Math.max(0, Math.min(1, f.life / f.max * 1.8));
    // 先画一圈深色描边，否则黄稻草落在黄土地上根本看不见（和像素角色的描边风格一致）
    ctx.fillStyle = '#2a1c0c';
    ctx.fillRect(f.x - f.w / 2 - .5, f.y - f.h / 2 - .5, f.w + 1, f.h + 1);
    ctx.fillStyle = f.c;
    ctx.fillRect(f.x - f.w / 2, f.y - f.h / 2, f.w, f.h);
  }
  ctx.globalAlpha = 1;
}
let qiFx = [];   // 老卒的扇形剑气特效
let blessFx = []; // 方士施法成功的黄圈
// 攻击按下先等待：短按松开才出普通攻击，长按到 0.4 秒后转为蓄力。
