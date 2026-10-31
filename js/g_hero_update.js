// 主角每帧更新：移动、翻滚、出招推进；通用 set()（2026-10-31 从 game.js 原样拆出，逻辑不变）
// 依赖 game.js 的全局变量，只在运行时调用；本文件加载时不访问 game.js 的变量。
function heroUpdate(dt) {
  if (dt > 0) { const vx = (hero.x - (hero.px ?? hero.x)) / dt, vy = (hero.y - (hero.py ?? hero.y)) / dt; hero.mvx = (hero.mvx || 0) * .85 + vx * .15; hero.mvy = (hero.mvy || 0) * .85 + vy * .15; hero.px = hero.x; hero.py = hero.y; }   // 平滑速度：投石车算提前量用
  const h = hero;
  if (pendingWeapon && !h.air && !['hurt','down','bounce','getup'].includes(h.st)) { const requested=pendingWeapon; pendingWeapon=null; setW(requested); }
  h.inv = Math.max(0, h.inv - dt); h.rollCd = Math.max(0, h.rollCd - dt); h.t += dt;
  if (h.st === 'down') return;
  // 被晕（只有心魔战会出现）：站着转星星，不能动、不能出手
  if (h.dazeT > 0) { h.dazeT -= dt; if (!h.air && !['bounce','getup','land'].includes(h.st)) { if (h.st !== 'hurt') { set(h, 'hurt'); h.atk = null; cancelCharge(); } h.t = 0; pressAtk = pressRoll = false; if (h.dazeT <= 0) set(h, 'idle'); return; } }
  if (h.air) { airStep(h, dt); pressAtk = pressRoll = false; return; }
  if (h.st === 'land') { set(h, over ? 'down' : 'bounce'); if (over) return; }   // 死了就躺下，不许再接管输入
  if (h.st === 'bounce') { if (h.t > .3) set(h, 'getup'); pressAtk = pressRoll = false; return; }
  if (h.st === 'getup') { if (h.t > .35 * (window.MERIDIAN ? MERIDIAN.x('getup', 1) : 1)) { set(h, 'idle'); h.inv = .5; } pressAtk = pressRoll = false; return; }
  let ix = (key.KeyD || key.ArrowRight ? 1 : 0) - (key.KeyA || key.ArrowLeft ? 1 : 0), iy = (key.KeyS || key.ArrowDown ? 1 : 0) - (key.KeyW || key.ArrowUp ? 1 : 0);
  if (joy) { ix = Math.abs(joy.dx) > .2 ? joy.dx : 0; iy = Math.abs(joy.dy) > .2 ? joy.dy : 0; }
  const l = Math.hypot(ix, iy); if (l > 1) { ix /= l; iy /= l; }
  h.ix = ix; h.iy = iy;   // 记下方向输入：跑动中扔石子会偏
  if (window.BRAWL && BRAWL.heroStep(h, dt, ix, iy)) return;   // 保险技 / 抓摔（js/brawl.js）
  if (h.st === 'hurt') { if (h.t > .3) set(h, 'idle'); moveEnt(h, h.vx * dt, 0); h.vx *= .85; pressAtk = pressRoll = false; return; }
  // 按住攻击键 0.4 秒 → 进入蓄力（连招暂停接续）
  if (atkHeldSince && !charging && performance.now() - atkHeldSince >= chargeGateMs() && !h.air && h.st !== 'down' && h.st !== 'hurt') {
    charging = true; chargeTier = 0; chargeTierFlash = 0; sfx('charge', h.x); h.comboWin = 0; h.q = 0;
  }
  if (charging) { h.comboWin = 0; if (h.st === 'hurt' || h.st === 'down' || h.air) charging = false; }
  if (pressRoll && h.rollCd === 0 && h.st !== 'roll') {
    sfx('roll', h.x);
    set(h, 'roll'); h.inv = IS_TOUCH ? .45 : .4; h.rollCd = .75; h.atk = null; h.q = 0; h.rollId = (h.rollId || 0) + 1;
    if (!(charging && window.ROGUE && ROGUE.has('藏势'))) cancelCharge();   // 藏势：蓄力中翻滚，进度保留
    if (window.ROGUE && ROGUE.onRoll) ROGUE.onRoll(h.x, h.y);
    const d = Math.hypot(ix, iy) > 0.1 ? [ix, iy] : [h.f, 0]; const dl = Math.hypot(...d); h.rx = d[0] / dl; h.ry = d[1] / dl;
    if (Math.abs(h.rx) > .1) h.f = Math.sign(h.rx);
  }
  updateHalberdDash(h, dt);
  pressRoll = false;
  if (h.st === 'roll' && charging && atkHeldSince) atkHeldSince += dt * 1000;   // 藏势：翻滚时蓄力暂停
  if (h.st === 'roll') { const rs = (window.Boss && Boss.wx && Boss.wx() === 'rain') ? 1.25 : 1; { const mr = window.MERIDIAN ? MERIDIAN.x('roll', 1) : 1; moveEnt(h, h.rx * 150 * rs * mr * dt, h.ry * 105 * rs * mr * dt); } if (h.t > .4) { set(h, 'idle'); if (window.ROGUE && ROGUE.onRollEnd) ROGUE.onRollEnd(); } pressAtk = false; return; }   // 回马：滚完自动向身后打一下
  h.comboWin = Math.max(0, (h.comboWin || 0) - dt);
  if (pressAtk && window.SUPPLY && SUPPLY.throwJar()) pressAtk = false;   // 拿着火油罐：攻击键先扔罐子
  if (pressAtk) { if (h.st === 'atk') h.q = 1; else startAtk(); pressAtk = false; }
  if (h.st === 'atk' && (!h.atk || !WEAP[weapon].combo[h.atk.c])) { h.atk = null; set(h, 'idle'); }   // 防卡死：出招状态和当前武器对不上就复位
  if (h.st === 'atk') {
    const W2 = WEAP[weapon], a = h.atk, C = W2.combo[a.c]; a.t += dt; a.lg += dt;
    if (a.t >= C.d[a.fi] * R_('aspd') / (W2.aspd || 1) * (window.Boss && Boss.wxAspd ? Boss.wxAspd() : 1)) {
      a.t = 0; a.fi++;
      if (a.fi === C.f.length - 1 && !a.visualOnly) strike();
      if (a.fi >= C.f.length) { h.combo = a.c; h.atk = null; h.comboWin = .45; if (h.q) { h.q = 0; startAtk(); } else set(h, 'idle'); return; }
    }
    if (ix && a.fi === 0) h.f = Math.sign(ix);
    // 锤子这类重型武器出手时朝面向方向前冲一小段（整段动作只冲一次），补足它短得可怜的攻击距离
    if (W2.lunge && a.lg < W2.lungeT) {
      // 前方已经有敌人贴得够近就别再冲，避免从敌人身上穿过去导致打空
      const tooClose = zs.some(z => !z.dead && Math.sign(z.x - h.x) === h.f
        && Math.abs(z.y - h.y) < W2.dy + 8
        && Math.abs(z.x - h.x) - (z.T.w || 0) / 2 < W2.reach * .6);
      if (!tooClose) moveEnt(h, h.f * W2.lunge * dt, 0);
    }
    // 出手时的移动：默认压到 15（有僵直）；像石子这种设了 move 的，按走路速度边走边扔（move = 1 即全速）
    const mvq = charging ? .2 : 1;   // 蓄力时只能极慢挪动
  if (W2.move != null) moveEnt(h, ix * 70 * W2.move * mvq * dt, iy * 52 * W2.move * mvq * dt);
    else moveEnt(h, ix * 15 * mvq * dt, 0);
    return;
  }
  if (over) return;   // 死亡后彻底停止玩家操作
  if (ix || iy) { if (h.st !== 'walk') set(h, 'walk'); if (ix) h.f = Math.sign(ix); const mv = R_('move') * (window.Boss && Boss.wxMove ? Boss.wxMove() : 1) * (window.CH2B && CH2B.sandOn && CH2B.sandOn() ? .75 : 1) * (charging ? (weapon === 'bow' ? .55 : .65) : 1); moveEnt(h, ix * 70 * mv * dt, iy * 52 * mv * dt); }   // 蓄力时走路慢 35%
  else if (h.st !== 'idle') set(h, 'idle');
  if (lockR < Infinity) h.x = Math.max(cam.x + 12, Math.min(h.x, cam.x + viewW() - 12));
}
function set(e, st) { if (st === 'wind' && e.st !== 'wind') e.windId = (e.windId || 0) + 1; e.st = st; e.t = 0; }
// ---------- 可破坏的道具（草垛、推车） ----------
// 每被打中一次掉 1 点耐久；打坏后取消碰撞（p.solid = false）并从画面消失，水井/旗子 hp 为 0 不受影响
// 回血道具：包子 +1（70%）、鸡腿 +2（20%）、烤乳猪 +3（10%）
