// 结算画面（从 game.js 拆出，2026-10-31）：卷轴结算、金币雨、数字滚动、结算按钮和键盘操作。
// 依赖 game.js 的全局（result、ctx、IMG、hero 等），只在运行时调用，不在加载时访问。
// ---------- 结算画面 ----------
const eOut = t => 1 - Math.pow(1 - t, 3);
const eBack = t => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);   // 盖章回弹
let stampPlayed = false, pressAct = null, pressAt = 0;

// 结算动画：数字滚动 + 街机式金币雨（用户定）
function countUp(v, raw, t0, dur) {
  v = Math.round(v || 0); if (result.countSkip) return v;
  const p = Math.max(0, Math.min(1, (raw - t0) / dur));
  const n = Math.round(v * (1 - Math.pow(1 - p, 2)));
  if (p > 0 && p < 1 && n !== (result['_c' + t0] || 0)) { const now = performance.now(); if (now - (result.tickAt || 0) > 55) { result.tickAt = now; sfx('tick'); } }
  if (p >= 1 && v > 0 && !result['_d' + t0]) { result['_d' + t0] = 1; sfx('food'); }
  result['_c' + t0] = n; return n;
}
function drawCoinRain(HW, HH, raw) {
  const R = result; R.rain ||= []; const dt = Math.min(.05, Math.max(0, raw - (R.rainT || raw))); R.rainT = raw;
  const rate = Math.min(26, 4 + (R.coins || 0) / 6) * (raw < 3.2 ? 1 : .25);   // 赚得越多掉得越密；滚完后变稀疏
  R.rainAcc = (R.rainAcc || 0) + rate * dt;
  while (R.rainAcc >= 1 && R.coins > 0) { R.rainAcc--; R.rain.push({ x: Math.random() * HW, y: -12, vy: 60 + Math.random() * 80, vx: (Math.random() - .5) * 20, r: 5 + Math.random() * 4, ph: Math.random() * 6, sp: 5 + Math.random() * 6 }); }
  ctx.save();
  for (const c of R.rain) {
    c.vy += 260 * dt; c.y += c.vy * dt; c.x += c.vx * dt; c.ph += c.sp * dt;
    const w = Math.abs(Math.cos(c.ph)) * c.r + .8;   // 翻转：宽度随角度变化
    ctx.fillStyle = '#c98a1c'; ctx.beginPath(); ctx.ellipse(c.x, c.y + 1, w, c.r, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd65a'; ctx.beginPath(); ctx.ellipse(c.x, c.y, w * .86, c.r * .86, 0, 0, Math.PI * 2); ctx.fill();
    if (w > c.r * .5) { ctx.fillStyle = '#9a6612'; ctx.fillRect(c.x - w * .25, c.y - c.r * .25, w * .5, c.r * .5); }   // 方孔
    if (Math.sin(c.ph * 2) > .9) { ctx.fillStyle = '#fff8d0'; ctx.fillRect(c.x - 1, c.y - c.r, 2, 2); }   // 闪光
  }
  ctx.restore();
  R.rain = R.rain.filter(c => c.y < HH + 20);
}
function drawResult(HW, HH) {
  if (!result || gameT < result.born) return;
  const raw = gameT - result.born;
  uiBtns = [];
  const BRUSH = '"MaShanZheng","KaiTi","STKaiti","Kaiti SC",serif';
  const F = '"PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif';

  // 背景压暗 + 四角暗角
  ctx.fillStyle = 'rgba(8,5,10,.74)'; ctx.fillRect(0, 0, HW, HH);
  const vg = ctx.createRadialGradient(HW / 2, HH / 2, Math.min(HW, HH) * .22, HW / 2, HH / 2, Math.max(HW, HH) * .72);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.66)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, HW, HH);
  drawCoinRain(HW, HH, raw);

  // 卷轴：按屏幕适配，从中间向左右展开
  const sw0 = Math.min(HW * .90, HH * 1.62) * .75, sh0 = sw0 / 1.66;   // 缩到 3/4，仍然居中
  const p = eOut(Math.min(1, Math.max(0, (raw - .05) / .40)));
  const sw = Math.max(40, sw0 * p), sx = (HW - sw) / 2, sy = Math.round((HH - sh0) / 2);
  const sh = sh0, sc = sh / 561;
  const roll = 92 * sc;
  const scroll = IMG['ui_scroll'];
  if (scroll && scroll.complete) {
    ctx.drawImage(scroll, 0, 0, 92, 561, sx, sy, roll, sh);
    ctx.drawImage(scroll, 838, 0, 92, 561, sx + sw - roll, sy, roll, sh);
    if (sw > roll * 2) ctx.drawImage(scroll, 92, 0, 746, 561, sx + roll, sy, sw - roll * 2, sh);
  } else {
    ctx.fillStyle = '#e8d9b5'; ctx.fillRect(sx, sy, sw, sh);
  }

  // 内容区（卷轴中间的纸面）
  const px0 = sx + roll * 1.12, px1 = sx + sw - roll * 1.12, pw = px1 - px0;
  const ink = '#2c2117';
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const fade = Math.min(1, Math.max(0, (raw - .30) / .25));
  ctx.globalAlpha = fade;

  // 左侧像素人物：通关 = 管亥跪地，倒下 = 主角倒地
  const frName = result.win ? (chapter2Run ? { n: 'zhang_jiao', f: 'defeat' } : { n: 'guanhai', f: 'kneel' }) : { n: 'hero', f: 'down' };   // 第二章通关画倒地的张角
  const fr = CH[frName.n] && CH[frName.n][frName.f];
  if (fr && fr.img.complete) {
    const k = frName.n === 'zhang_jiao' ? Math.min(1, sh * .2 / fr.h) : Math.max(1, Math.min(Math.round(sh * .14 / fr.h), Math.max(1, Math.floor(pw * .15 / fr.w))));   // 张角原图细，按比例缩小
    const dx = px0 + pw * .13, dy = sy + sh * .27;   // 用户截图：人挡住了复活按钮 → 缩小并挪到左上空白处
    ctx.save(); ctx.imageSmoothingEnabled = false; ctx.globalAlpha = fade * .95;
    ctx.drawImage(fr.img, Math.round(dx - fr.ax * k), Math.round(dy - fr.ay * k), fr.w * k, fr.h * k);
    ctx.restore();
  }

  // 标题（毛笔）
  const title = result.win ? '通关' : '倒下';
  ctx.font = Math.round(sh * .142) + 'px ' + BRUSH;
  ctx.fillStyle = ink;
  ctx.fillText(title, px0 + pw * .50, sy + sh * .295);

  // 击倒 / 用时
  ctx.font = Math.round(sh * .058) + 'px ' + F;
  ctx.fillStyle = '#4a3a2a';
  // 数字从 0 往上跳：击倒 → 评分 → 金币，依次滚动；点一下屏幕直接跳到最终值
  const cK = countUp(result.kills, raw, .55, .55), cS = countUp(result.score, raw, 1.0, .8), cC = countUp(result.coins || 0, raw, 1.7, .8);
  ctx.fillText('击倒 ' + cK + ' 名　用时 ' + fmtTime(result.time) + '　评分 ' + cS, px0 + pw * .50, sy + sh * .385);
  ctx.fillStyle = '#a97618';
  const pop = result.coins && !result.countSkip && raw > 2.5 && raw < 2.8 ? 1 + .25 * Math.sin((raw - 2.5) / .3 * Math.PI) : 1;   // 金币滚完：放大弹一下
  ctx.font = Math.round(sh * .050 * pop) + 'px ' + F;
  ctx.fillText('💰 本局获得金币 ' + cC, px0 + pw * .50, sy + sh * .455);

  // 台词：按卷轴内宽换行，标点不能单独落到下一行
  const line = result.line || '';
  if (line) {
    // 用户反馈：通关文字被截断 → 最多 3 行，放不下就自动缩小字号
    let lfs = Math.max(11, Math.round(sh * .046)), rows = [];
    const maxW = pw * .78, cx = px0 + pw * .50, noStart = '，。！？、；：”’）》」』…';
    for (let tries = 0; tries < 6; tries++) {
      ctx.font = lfs + 'px ' + BRUSH; rows = []; let row = '';
      for (const ch of line) {
        if (row && ctx.measureText(row + ch).width > maxW) {
          if (noStart.includes(ch)) { row += ch; rows.push(row); row = ''; }
          else { rows.push(row); row = ch; }
        } else row += ch;
      }
      if (row) rows.push(row);
      if (rows.length <= 3 || lfs <= 10) break; lfs = Math.max(10, Math.round(lfs * .88));
    }
    ctx.fillStyle = '#3a2410';
    const lh = lfs * 1.3, top = sy + sh * .525 - (rows.length > 2 ? lh * .35 : 0);
    rows.slice(0, 3).forEach((r2, i) => ctx.fillText(r2, cx, top + i * lh));
  }
  ctx.globalAlpha = 1;

  // 印章
  const sealDelay = .52;
  if (raw > sealDelay) {
    const q = Math.min(1, (raw - sealDelay) / .22);
    if (!stampPlayed) { stampPlayed = true; sfx('stamp', HW / 2); shake = .12; }
    const sc2 = .6 + .4 * eBack(q);
    const img = IMG[result.win ? 'ui_seal_square' : 'ui_seal_round'];
    const side = sh * (result.win ? .24 : .22) * sc2;
    const cx2 = px0 + pw * .89, cy2 = sy + sh * .245;
    ctx.save();
    ctx.globalAlpha = Math.min(1, q * 1.6);
    if (img && img.complete) ctx.drawImage(img, cx2 - side / 2, cy2 - side / 2, side, side);
    else { ctx.strokeStyle = '#a4321f'; ctx.lineWidth = 3; ctx.strokeRect(cx2 - side / 2, cy2 - side / 2, side, side); }
    ctx.fillStyle = '#9c2b1c';
    const sealTxt = result.win ? result.rank : '败';
    let fs2 = Math.round(side * (result.win ? .44 : .58));
    ctx.font = fs2 + 'px ' + BRUSH;
    const tw = ctx.measureText(sealTxt).width;
    if (tw > side * .62) { fs2 = Math.max(8, Math.floor(fs2 * side * .62 / tw)); ctx.font = fs2 + 'px ' + BRUSH; }
    ctx.textAlign = 'center';
    ctx.fillText(sealTxt, cx2, cy2 + fs2 * .36);
    ctx.restore();
  }

  // 木牌按钮
  const btnFade = Math.min(1, Math.max(0, (raw - .62) / .3));
  ctx.globalAlpha = btnFade;
  const gap = pw * .035;
  const actionCount = result.win ? 4 : 3;
  const bw = (pw * .84 - gap * (actionCount - 1)) / actionCount, bh = bw / 1.66;
  const byy = sy + sh * .755;
  const bx0 = px0 + (pw - (bw * actionCount + gap * (actionCount - 1))) / 2;
  // 按当前结算按钮中的最长标签计算统一字号
  let ufs = Math.round(bh * .46);
  ctx.font = ufs + 'px ' + BRUSH;
  const actionLabels = result.win
    ? (chapter2Run ? ['分享', '返回首页', '再来一局', '返回整备'] : ['分享', '返回首页', '再来一局', '第二章'])
    : ['分享', '返回首页', '再来一局'];
  const longest = Math.max(...actionLabels.map(t => ctx.measureText(t).width));
  if (longest > bw * .78) ufs = Math.max(8, Math.floor(ufs * bw * .78 / longest));
  const plank = (i, label, act, red, off) => {
    const x = bx0 + i * (bw + gap);
    const pressed = pressAct === act && performance.now() - pressAt < 140;
    const yy = byy + (pressed ? bh * .06 : 0);
    const img = IMG[red ? 'ui_btn_red' : 'ui_btn'];
    ctx.save();
    ctx.globalAlpha = btnFade * (pressed ? .82 : 1) * (off ? .72 : 1);
    if (img && img.complete) ctx.drawImage(img, x, yy, bw, bh);
    else { ctx.fillStyle = red ? '#8e2f22' : '#7a5530'; ctx.fillRect(x, yy, bw, bh); }
    ctx.restore();
    ctx.save();
    const lfs = ufs;
    ctx.font = lfs + 'px ' + BRUSH;
    ctx.fillStyle = off ? 'rgba(52,40,26,.92)' : (red ? '#f6e2c0' : '#2b1a0c');
    ctx.fillText(label, x + bw / 2, yy + bh * .62 + lfs * .18);
    ctx.restore();
    if (result.sel === act) { ctx.save(); ctx.globalAlpha = btnFade; ctx.strokeStyle = '#fff1b8'; ctx.lineWidth = 3; ctx.shadowColor = '#ffd76a'; ctx.shadowBlur = 10; ctx.strokeRect(x - 3, yy - 3, bw + 6, bh + 6); ctx.restore(); }   // 键盘选中
    uiBtns.push({ x, y: yy, w: bw, h: bh, act });
  };
  plank(0, '分享', 'share', false);
  plank(1, '返回首页', 'home', false);
  plank(2, '再来一局', 'restart', true);
  if (result.win) {
    const chapter2Locked = !chapter2Run && (!window.CHAPTER2 || !CHAPTER2.canEnter());
    plank(3, chapter2Run ? '返回整备' : '第二章', chapter2Run ? 'prep' : 'next', false, chapter2Locked);
  }

  // 复活按钮
  if (!result.win && raw > .8) {
    const rw = pw * .66, rh = sh * .078, rx = px0 + (pw - rw) / 2, ry = sy + sh * .60;
    const pressed = pressAct === 'revive' && performance.now() - pressAt < 140;
    const pulse = .5 + .5 * Math.sin(performance.now() / 220);   // 呼吸，吸引注意
    ctx.save();
    ctx.globalAlpha = Math.min(1, (raw - .8) / .2);
    // 外发光
    ctx.shadowColor = 'rgba(140,240,122,' + (.35 + .35 * pulse) + ')';
    ctx.shadowBlur = 14 + 8 * pulse;
    ctx.fillStyle = pressed ? 'rgba(40,90,48,.97)' : 'rgba(47,107,58,.95)';
    ctx.fillRect(rx, ry + (pressed ? 2 : 0), rw, rh);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#8ef07a'; ctx.lineWidth = 2.5;
    ctx.strokeRect(rx + 1, ry + (pressed ? 2 : 0) + 1, rw - 2, rh - 2);
    ctx.fillStyle = '#e9ffe2'; ctx.font = 'bold ' + Math.round(rh * .5) + 'px ' + F;
    ctx.textAlign = 'center';
    const label = revives >= 1 ? '分享复活（第 3 条命起评分减半）' : '分享给好友 · 免费复活';
    ctx.fillText(label, rx + rw / 2, ry + rh * .68 + (pressed ? 2 : 0));
    ctx.restore();
    if (result.sel === 'revive') { ctx.save(); ctx.strokeStyle = '#fff1b8'; ctx.lineWidth = 3; ctx.strokeRect(rx - 4, ry - 4, rw + 8, rh + 8); ctx.restore(); }
    uiBtns.push({ x: rx, y: ry, w: rw, h: rh, act: 'revive' });
  }
  ctx.globalAlpha = 1;
  // 开发者模式：结算时在左上角列出本局锦囊统计（触发次数 / 伤害 / 回血），方便测强弱
  if (/[?&]debug/.test(location.search) && window.ROGUE && ROGUE.stats) {
    const st = Object.entries(ROGUE.stats()).sort((a, b) => b[1].dmg - a[1].dmg);
    if (st.length) {
      ctx.save(); ctx.font = '12px sans-serif'; ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(15,10,6,.82)'; ctx.fillRect(8, 40, 220, 22 + st.length * 16);
      ctx.fillStyle = '#f1d58f'; ctx.fillText('锦囊统计（调试）', 16, 56);
      st.forEach(([n, o], i) => { ctx.fillStyle = '#ecdcbc'; ctx.fillText(`${n}  触发 ${o.trig}  伤害 ${o.dmg.toFixed(1)}${o.heal ? '  回血 ' + o.heal.toFixed(1) : ''}`, 16, 74 + i * 16); });
      ctx.restore();
    }
  }

  if (toastT > 0) {   // 分享结果的提示条：放在屏幕下方，不压面板
    ctx.font = 'bold 15px ' + F;
    const tw = ctx.measureText(toastMsg).width, ty = HH - 52;
    ctx.fillStyle = 'rgba(20,14,30,.88)'; ctx.fillRect(HW / 2 - tw / 2 - 14, ty - 22, tw + 28, 30);
    ctx.fillStyle = '#ffd86e'; ctx.fillText(toastMsg, HW / 2, ty);
  }
  ctx.textAlign = 'left'; ctx.globalAlpha = 1;
}

function resultAct(act) {
  pressAct = act; pressAt = performance.now();
  setTimeout(() => {
        if (act === 'share') doShare();
        else if (act === 'revive') doRevive();
        else if (act === 'home') { if (window.TITLE) TITLE.show(); }
        else if (act === 'next') {
          if (window.CHAPTER2 && !CHAPTER2.canEnter()) toast('第二章「黄巾决战」尚未开放');
          else toast('下一关还在做，敬请期待');
        }
        else if (act === 'prep') { if (window.TITLE) TITLE.openPreparation({ chapter: 2, view: 'campaign' }); }
        else if (chapter2Run && window.CHAPTER2 && CHAPTER2.canEnter()) { reset(); startChapter2(); }   // 用户定：第二章「再来一局」= 重打第二章
        else reset();
  }, 140);
}
function resultKey(e) {
  if (!result || gameT < result.born) return false;
  const acts = uiBtns.map(b => b.act); if (!acts.length) return false;
  if (!acts.includes(result.sel)) result.sel = acts.includes('revive') ? 'revive' : 'restart';
  const order = ['revive', 'share', 'home', 'restart', 'next', 'prep'].filter(a => acts.includes(a));
  const k = order.indexOf(result.sel);
  if (['ArrowLeft', 'KeyA', 'ArrowUp', 'KeyW'].includes(e.code)) { result.sel = order[(k + order.length - 1) % order.length]; sfx('tick'); return true; }
  if (['ArrowRight', 'KeyD', 'ArrowDown', 'KeyS'].includes(e.code)) { result.sel = order[(k + 1) % order.length]; sfx('tick'); return true; }
  if (['Enter', 'KeyJ', 'Space', 'NumpadEnter'].includes(e.code)) { if (result.countSkip === false || gameT - result.born < 2.6) result.countSkip = true; resultAct(result.sel); return true; }
  return false;
}
