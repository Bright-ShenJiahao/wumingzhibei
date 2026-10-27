// 首领共用：连续远程命中后的格挡架势、格挡判定、架势结束冲刺与外观。
(() => {
  const WINDOW = 2, NEED = 3, STANCE = 1.5, COOLDOWN = 6;
  const isBoss = z => !!(z && (z.T.boss || z.T.chapterBoss));
  const front = (z, dir) => Math.sign(dir || 1) * Math.sign(z.f || 1) < 0;
  const canEnter = z => {
    if (!isBoss(z) || z.dead || z.air || z.stun > 0 || z.daze > 0 || (z.blockT || 0) > 0 || (z.blockChargeT || 0) > 0) return false;
    if (gameT < (z.blockCdUntil || 0)) return false;
    return ['idle', 'walk', 'move'].includes(z.st);
  };
  function sparks(z) {
    if (typeof propFx === 'undefined') return;
    for (let i = 0; i < 10; i++) {
      const life = rnd(.12, .3);
      propFx.push({ x: z.x + z.f * rnd(12, 30), y: z.y - rnd(12, 42), vx: rnd(-110, 110), vy: rnd(-130, -20),
        w: rnd(1, 2.5), h: rnd(1, 2.5), life, max: life, c: Math.random() < .65 ? '#ffe6a0' : '#ffc14f' });
    }
    if (typeof sfx === 'function') { sfx('hit_stone', z.x); sfx('crack', z.x); }
  }
  function effect(z) {
    sparks(z);
    if (typeof floaters !== 'undefined') floaters.push({ x: z.x, y: z.y - 50, t: 0, txt: '格挡！', big: true });
  }
  function isBlocking(z, dir) {
    if (!isBoss(z) || (z.blockT || 0) <= 0) return false;
    return front(z, dir);
  }
  function recordRanged(z, dir) {
    if (!isBoss(z) || z.dead || (z.blockT || 0) > 0 || (z.blockChargeT || 0) > 0) return false;
    z.blockHits = (z.blockHits || []).filter(t => gameT - t <= WINDOW);
    z.blockHits.push(gameT);
    if (z.blockHits.length < NEED || !canEnter(z)) return false;
    z.blockHits = [];
    z.blockT = STANCE;
    z.blockCdUntil = gameT + STANCE + COOLDOWN;
    z.blockChargeT = 0;
    effect(z);
    return true;
  }
  function tryStun(z, traits) {
    if (!isBoss(z) || z.dead || !traits || !traits.dazeChance) return false;
    if (Math.random() >= traits.dazeChance) return false;
    const time = traits.dazeTime || .6;
    z.daze = Math.max(z.daze || 0, time);
    z.stun = Math.max(z.stun || 0, time);
    return true;
  }
  // moveFn(z, tx, ty, speed, dt)：沿用各首领自己的移动函数。
  function update(z, dt, moveFn, baseSpeed) {
    if ((z.blockT || 0) > 0) {
      z.blockT = Math.max(0, z.blockT - dt);
      z.f = Math.sign(hero.x - z.x) || z.f;
      if (z.blockT <= 0) {
        z.blockChargeT = 1.5;
        z.blockCdUntil = gameT + COOLDOWN;   // 冷却从架势结束开始
      }
      return true;
    }
    if ((z.blockChargeT || 0) > 0) {
      z.blockChargeT = Math.max(0, z.blockChargeT - dt);
      const dx = hero.x - z.x, dy = hero.y - z.y, d = Math.hypot(dx, dy) || 1;
      z.f = Math.sign(dx) || z.f;
      if (d > 30 && z.blockChargeT > 0 && typeof moveFn === 'function') moveFn(z, hero.x, hero.y, (baseSpeed || z.T.spd || 30) * 1.5, dt);
      if (d <= 30 || z.blockChargeT <= 0) z.blockChargeT = 0;
      return true;
    }
    return false;
  }
  function draw(z) {
    if (!z || (z.blockT || 0) <= 0) return;
    const shield = z.type === 'zhang_bao' || z.sprite === 'zhang_bao';
    const pulse = .72 + .28 * Math.sin(gameT * 10);
    ctx.save(); ctx.translate(z.x, z.y); ctx.scale(z.f < 0 ? -1 : 1, 1);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (shield) {
      ctx.fillStyle = `rgba(255,211,92,${.16 + .05 * pulse})`;
      ctx.strokeStyle = `rgba(255,221,126,${.78 + .16 * pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(9, -43, 20, 47, 4) : ctx.rect(9, -43, 20, 47); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,238,174,.9)'; ctx.lineWidth = 1;
      ctx.strokeRect(13, -36, 12, 34);
      ctx.beginPath(); ctx.moveTo(15, -30); ctx.lineTo(23, -30); ctx.moveTo(15, -23); ctx.lineTo(23, -23); ctx.moveTo(15, -16); ctx.lineTo(23, -16); ctx.stroke();
      ctx.beginPath(); ctx.arc(19, -11, 3, 0, 7); ctx.stroke();
    } else {
      ctx.strokeStyle = `rgba(255,221,126,${.62 + .25 * pulse})`;
      ctx.shadowColor = 'rgba(255,198,78,.8)'; ctx.shadowBlur = 8;
      ctx.lineWidth = 2.4;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.arc(0, -22, 23 + i * 4, -1.12, 1.12); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,245,190,.9)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, -22, 31, -.95, .95); ctx.stroke();
    }
    ctx.restore();
  }
  window.BOSS_BLOCK = { isBoss, isBlocking, recordRanged, tryStun, update, draw, effect };
})();
