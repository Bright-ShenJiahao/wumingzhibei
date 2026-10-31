// 敌人 AI：第二章精英/阵型/技能、普通敌人、投石车、首领（2026-10-31 从 game.js 原样拆出，逻辑不变）
// 依赖 game.js 的全局变量，只在运行时调用；本文件加载时不访问 game.js 的变量。
let enemySkillFx = [];
function ch2Armored(z) {
  return !!(ch2Troops() && z.enemySkill && (z.type === 'yellow-heavy' || (z.type === 'yellow-spear' && z.enemySkill.phase === 'dash')));
}
function ch2NearestShield(z) {
  return zs.filter(o=>o!==z&&!o.dead&&o.st!=='gone'&&o.type==='yellow-shield').sort((a,b)=>Math.hypot(a.x-z.x,a.y-z.y)-Math.hypot(b.x-z.x,b.y-z.y))[0];
}
// 第二章精英：现有小兵放大 15%、暗红光晕、名字加「精英·」，血/伤害提高并各有专属强化（用户定）
const CH2_ELITE_STATS = { 'yellow-shield': { hp: 20, dmg: 2 }, 'yellow-heavy': { hp: 18, dmg: 3 }, 'yellow-spear': { hp: 14, dmg: 2.5 } };
const CH2_ELITES = { 1: { 2: ['yellow-heavy'] }, 2: { 1: ['yellow-shield'] }, 3: { 1: ['yellow-shield'] }, 4: { 1: ['yellow-heavy', 'yellow-spear'] }, 5: { 1: ['yellow-shield', 'yellow-spear'] } };
function makeCh2Elite(z) {
  const s = CH2_ELITE_STATS[z.type]; if (!s || z.T.ch2Elite) return;
  z.T = { ...z.T, ...s, ch2Elite: true, name: '精英·' + z.T.name }; z.hp = z.T.hp; z.sc = (z.sc || 1) * 1.15;
}
function applyCh2Elites(battle, wave) {
  for (const type of (CH2_ELITES[battle] || {})[wave] || []) {
    let z = zs.find(e => !e.dead && e.type === type && !e.T.ch2Elite);
    if (!z) { spawn(type, hero.x + 220, (M.top + M.bot) / 2); z = zs[zs.length - 1]; }
    makeCh2Elite(z);
  }
}
function ch2Formation(z) {
  if(!ch2Troops())return null;
  const shield=ch2NearestShield(z);
  // 盾墙：盾兵自己照常往主角压上去（慢慢逼近），身后的枪兵、远程、方士跟着盾兵走。
  // （原来盾兵会退到后排兵前面守着，后排又跟着盾兵，两边互相等，结果整队停在远处不动）
  if(shield&&(z.T.ranged||z.T.priest||z.type==='yellow-spear')){
    const sd=Math.hypot(shield.x-hero.x,shield.y-hero.y);
    if(z.T.ranged&&sd<z.T.range[0])return null;            // 盾兵已经贴近主角：远程改回自己找射击距离
    const dx=shield.x-hero.x,dy=shield.y-hero.y,len=Math.hypot(dx,dy)||1,d=z.type==='yellow-spear'?20:25;
    return {x:shield.x+dx/len*d,y:Math.max(M.top,Math.min(M.bot,shield.y+dy/len*d))};
  }
  if(z.type==='yellow-heavy'){
    const peers=zs.filter(o=>!o.dead&&o.type==='yellow-heavy');
    if(peers.length>=2)return {x:hero.x+(peers.indexOf(z)%2?40:-40),y:hero.y};
  }
  return null;
}
function ch2BeginSkill(z) {
  z.enemySkill={phase:'wind',t:0,f:Math.sign(hero.x-z.x)||z.f,hit:false};
  z.f=z.enemySkill.f;z.moving=false;z.vx=0;set(z,'wind');
  z.skillCd=z.type==='yellow-heavy'?6:z.type==='yellow-shield'?7:5;sfx('bladeAlert',z.x);
}
function ch2Skill(z,dt) {
  if(!ch2Troops())return false;
  z.skillCd=Math.max(0,(z.skillCd||0)-dt);
  let skill=z.enemySkill;
  if(skill&&(z.dead||z.air||(!ch2Armored(z)&&(z.stun>0||z.daze>0)))){z.enemySkill=null;return false;}
  if(!skill){
    if(!['yellow-heavy','yellow-shield','yellow-spear'].includes(z.type)||z.skillCd>0||!['idle','move'].includes(z.st)||z.stun>0||z.daze>0)return false;
    const dx=hero.x-z.x,dy=hero.y-z.y,front=dx*z.f;
    const formation=ch2Formation(z);
    if(z.type==='yellow-heavy'&&formation&&Math.abs(z.x-formation.x)>18)return false;
    const can=z.type==='yellow-heavy'?front>=0&&front<=70&&Math.abs(dy)<35:z.type==='yellow-shield'?front>=0&&front<=40&&Math.abs(dy)<20:front>=60&&front<=110&&Math.abs(dy)<=20;
    if(!can)return false;
    ch2BeginSkill(z);skill=z.enemySkill;
  }
  skill.t+=dt;z.f=skill.f;z.moving=false;
  if(ch2Armored(z)){z.stun=0;z.daze=0;z.vx=0;}
  const wind=z.type==='yellow-heavy'?1:z.type==='yellow-shield'?.4:.6;
  if(skill.phase==='wind'){
    if(skill.t<wind)return true;
    set(z,'strike');skill.phase='dash';skill.t=0;
    if(z.type==='yellow-heavy'){
      enemySkillFx.push({x:z.x+z.f*20,y:z.y-15,f:z.f,t:0,T:.3});
      const dx=(hero.x-z.x)*z.f,dy=hero.y-z.y;
      if(dx>=0&&Math.hypot(dx,dy)<=45&&Math.abs(dy)<=dx+8)dmgHero(z.T.ch2Elite?3.2:2.5,z,'skill');
      for(const oy of z.T.ch2Elite?[-14,0,14]:[0])eshots.push({k:'enemyWave',x:z.x+z.f*12,y:z.y+oy,vx:z.f*150,left:z.T.ch2Elite?70:50,t:0,life:1,source:z});sfx('enemySwing',z.x);   // 精英：一次放 3 道剑气
      skill.phase='recover';return true;
    }
    skill.left=z.type==='yellow-shield'?30:z.T.ch2Elite?70:50;   // 精英枪兵冲得更远
    if(z.type==='yellow-spear')for(const other of zs){
      if(other!==z&&!other.dead&&!other.air&&other.type==='yellow-spear'&&!other.enemySkill&&(other.skillCd||0)<=0&&!(other.stun>0)&&!(other.daze>0)&&Math.hypot(other.x-z.x,other.y-z.y)<=100)ch2BeginSkill(other);
    }
  }
  if(skill.phase==='dash'){
    const step=Math.min(skill.left,180*dt);moveEnt(z,z.f*step,0);skill.left-=step;
    if(!skill.hit&&Math.abs(hero.x-z.x)<(z.type==='yellow-spear'?37:18)&&Math.abs(hero.y-z.y)<16&&(hero.x-z.x)*z.f>=-10){
      const before=hero.hp;dmgHero(z.type==='yellow-shield'?(z.T.ch2Elite?2:1):2,z,'skill');skill.hit=true;   // 精英盾撞 2 伤会撞倒
      if(z.type==='yellow-shield'&&hero.hp<before)moveEnt(hero,z.f*40,0);
    }
    if(skill.left<=0){
      if(z.T.ch2Elite&&z.type==='yellow-spear'&&!skill.second){skill.second=true;skill.f=Math.sign(hero.x-z.x)||skill.f;z.f=skill.f;skill.left=70;skill.hit=false;}   // 精英枪兵：立刻接第二次冲刺
      else{skill.phase='recover';skill.t=0;}
    }
  }
  if(skill.phase==='recover'&&skill.t>=.35){z.enemySkill=null;z.tok=false;set(z,'move');}
  return true;
}
const enemyTintCache=new Map();
// 敌方火箭 / 投石：箭杆 + 三角箭头 + 尾羽 + 箭头小火苗；投石是带火的黑石块（敌方特效：暗橙土红，不加白金高光）
function drawEnemyMissile(s, x, y, p) {
  const vx = (s.tx - s.x0) / s.T, vy = (s.ty - s.y0) / s.T - Math.cos(p * Math.PI) * 60 * Math.PI / s.T, ang = Math.atan2(vy, vx);
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(1.35, 1.35);   // 放大一点，在栅栏背景前也看得清
  if (s.k === 'catapult') {
    for (let i = 1; i <= 3; i++) { ctx.fillStyle = `rgba(120,50,25,${.35 - i * .09})`; ctx.beginPath(); ctx.arc(-i * 4, 0, 5 - i, 0, 7); ctx.fill(); }   // 拖尾烟火
    ctx.fillStyle = '#2a1c14'; ctx.beginPath(); ctx.arc(0, 0, 5.2, 0, 7); ctx.fill();
    ctx.fillStyle = '#4e3a2a'; ctx.beginPath(); ctx.arc(-1, -1, 3.6, 0, 7); ctx.fill();
    const fl = 1 + Math.sin(performance.now() / 60) * .3;
    ctx.fillStyle = '#a0461e'; ctx.beginPath(); ctx.arc(2.5, -2, 2.4 * fl, 0, 7); ctx.fill();
    ctx.fillStyle = '#c4682a'; ctx.beginPath(); ctx.arc(3, -2.5, 1.2 * fl, 0, 7); ctx.fill();
  } else {
    const head = s.enemyVolley ? '#7d3023' : '#8a3a1c', flame = s.enemyVolley ? '#a54a28' : '#b8521f';
    ctx.strokeStyle = 'rgba(120,60,30,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-7, 0); ctx.stroke();   // 速度线
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(-7.5, -1, 13, 2);          // 箭杆描边
    ctx.fillStyle = '#7a5530'; ctx.fillRect(-7, -.5, 12, 1);           // 箭杆
    ctx.fillStyle = '#2a1a10'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(4, -2.5); ctx.lineTo(4, 2.5); ctx.closePath(); ctx.fill();   // 箭头
    ctx.fillStyle = '#6b6a66'; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(4.5, -1.5); ctx.lineTo(4.5, 1.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle = head; ctx.fillRect(-8, -2.5, 3, 1.5); ctx.fillRect(-8, 1, 3, 1.5);   // 尾羽
    const fl = Math.sin(performance.now() / 50 + s.x0) * .8;
    ctx.fillStyle = flame; ctx.beginPath(); ctx.arc(5.5 + fl * .3, -1.5, 1.8, 0, 7); ctx.fill();   // 箭头上的小火苗
  }
  ctx.restore();
}
function drawEnemySheet(key,x,y,f,width,time,duration){
  const img=IMG['ui_'+key];if(!img||!img.complete||!img.naturalWidth)return;
  let canvas=enemyTintCache.get(key);
  if(!canvas){canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const g=canvas.getContext('2d');g.drawImage(img,0,0);g.globalCompositeOperation='source-in';g.fillStyle='#a34426';g.fillRect(0,0,canvas.width,canvas.height);enemyTintCache.set(key,canvas);}
  const fw=canvas.width/3,fh=canvas.height,frame=Math.min(2,Math.floor(time/duration*3)),height=width*fh/fw;
  ctx.save();ctx.translate(x,y);ctx.scale(f,1);ctx.imageSmoothingEnabled=false;ctx.drawImage(canvas,frame*fw,0,fw,fh,-width/2,-height/2,width,height);ctx.restore();
}
function ch2Telegraph(z){
  if(!ch2Troops()||!z.enemySkill||z.enemySkill.phase!=='wind'||z.dead)return;
  ctx.save();ctx.fillStyle='#b64c2b';ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.fillText('!',z.x,z.y-42);
  if(z.type==='yellow-spear'){ctx.fillStyle='rgba(130,42,29,.3)';ctx.fillRect(z.f>0?z.x:z.x-90,z.y-5,90,10);}
  ctx.restore();
}

// 敌人互相让位：两人几乎站在同一点时，沿上下方向（为主）慢慢错开，站成并排，不叠在一起
function separateEnemies(dt) {
  const L = zs.filter(z => !z.dead && !z.air && !z.static && z.st !== 'sleep' && z.st !== 'down' && !z.T.boss);
  const RX = 18, RY = 12, push = 60 * dt;
  for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
    const a = L[i], b = L[j], dx = b.x - a.x, dy = b.y - a.y;
    if (Math.abs(dx) >= RX || Math.abs(dy) >= RY) continue;
    // 主要上下分开；完全重合时按序号决定谁上谁下，避免两人一起抖
    let sy = Math.sign(dy) || (i % 2 ? 1 : -1);
    if (a.y - sy * push < M.top + 1 || b.y + sy * push > M.bot - 1) sy = -sy;
    const k = (1 - Math.abs(dy) / RY) * push, kx = (1 - Math.abs(dx) / RX) * push * .3 * (Math.sign(dx) || 1);
    for (const [e, m] of [[a, -1], [b, 1]]) {
      const ny = Math.max(M.top, Math.min(M.bot, e.y + m * sy * k)), nx = e.x + m * kx;
      if (!blocked(e.x, ny)) e.y = ny;
      if (!blocked(nx, e.y)) e.x = nx;
    }
  }
}
function zUpdate(z, dt) {
  if (window.GEAR && !z.dead) { dt = GEAR.enemyTime(z, dt); if (!dt) return; }
  if (z.T.boss) return Boss.update(z, dt);
  if (z.T.mirror) { if (window.XINMO) XINMO.update(z, dt); return; }   // 心魔试炼
  const T = z.T;
  if (T.siege) { updateChapter2Catapult(z, dt); return; }
  if (T.chapterBoss) { updateChapter2Boss(z, dt); return; }
  // 守车兵：主角离岗位远时回岗位站定，不追出去（投石车阵的盾兵、大刀兵）
  if (z.guard && !z.dead && !z.air && !(z.stun > 0) && (z.st === 'move' || z.st === 'idle') && !siegeAlarm(z) && (z.siegeArcher ? Math.hypot(z.x - z.guard.x, z.y - z.guard.y) > 10 : Math.hypot(hero.x - z.guard.x, (hero.y - z.guard.y) * 1.5) > 115)) {   // 投石车弓手：一步不离岗，只站着射
    const dx = z.guard.x - z.x, dy = z.guard.y - z.y, d = Math.hypot(dx, dy);
    if (z.siegeArcher && d > 40) { z.x = z.guard.x; z.y = z.guard.y; return; }   // 投石车弓手：出场就站在拒马墙后的岗位上（以前被锁屏边界推到墙前，卡在墙边走不过去）
    z.t += dt; z.flash = Math.max(0, z.flash - dt); z.cd = Math.max(z.cd, .4);
    if (d > 4) { z.moving = true; z.f = Math.sign(dx) || z.f; moveEnt(z, dx / d * T.spd * dt, dy / d * T.spd * .7 * dt); }
    else { z.moving = false; z.f = Math.sign(hero.x - z.x) || z.f; }
    return;
  }
  z.t += dt * (window.GEAR ? GEAR.enemyAttack(z) : (z.attackSlowT > 0 ? .9 : 1)); z.flash = Math.max(0, z.flash - dt); z.cd -= dt * (window.GEAR ? GEAR.enemyAttack(z) : (z.attackSlowT > 0 ? .9 : 1));
  z.moveSlowT = Math.max(0, (z.moveSlowT || 0) - dt); z.attackSlowT = Math.max(0, (z.attackSlowT || 0) - dt);
  if (z.qiCd > 0) z.qiCd -= dt;
  if (z.qi != null) {                     // 老卒蓄力中：0.62 秒后劈出扇形剑气
    z.qi += dt * (window.XIAOCHANG ? XIAOCHANG.actionScale(z) : 1);
    if (z.qi >= .62) {
      z.qi = null;
      qiFx.push({ x: z.x, y: z.y, f: z.f, t: 0, T: .28 });
      sfx('enemySwing', z.x); shake = Math.max(shake, .18);
      const hx = hero.x - z.x;
      if (Math.abs(hx) < 60 && Math.abs(hero.y - z.y) < 20 && hx * z.f > -10) dmgHero(2, z, 'skill');
    }
  }
  if (z.adds != null) {                 // 援军弓箭手：两轮箭，然后撤离
    if (z.dead || z.air || z.stun > 0 || z.daze > 0) { z.adds = null; return; }
    if (z.st === 'addwalk') {
      const dx = z.standX - z.x;
      z.f = Math.sign(dx) || z.f; z.moving = Math.abs(dx) >= 3;
      if (Math.abs(dx) < 3) {
        z.x = z.standX; z.moving = false; set(z, 'addaim');
        if (!zs.some(o => o !== z && o.adds != null && o.st === 'addwalk'))
          zs.forEach(o => { if (o.adds != null && o.st === 'addaim') { o.t = 0; o.addWait = .5 + o.addDelay; } });
      }
      else z.x += Math.sign(dx) * Math.min(Math.abs(dx), 55 * dt);
      return;
    }
    if (z.st === 'addaim') {
      if (zs.some(o => o.adds != null && o.st === 'addwalk')) return;
      if (z.t >= z.addWait) {
        eshots.push({ k: 'fire', x0: z.x + z.f * 14, y0: z.y, tx: hero.x + rnd(-26, 26), ty: hero.y + rnd(-8, 10), t: 0, T: .9, short: 1.8 });
        sfx('bow', z.x); z.adds = 1; set(z, 'addvolley'); z.volleyGap = 3 + 2 * .35;
      }
      return;
    }
    if (z.st === 'addvolley') {
      z.volleyGap -= dt;
      if (z.volleyGap <= 0) {
        if (z.adds > 0) {
          eshots.push({ k: 'fire', x0: z.x + z.f * 14, y0: z.y, tx: hero.x + rnd(-26, 26), ty: hero.y + rnd(-8, 10), t: 0, T: .9, short: 1.8 });
          sfx('bow', z.x); z.adds = 0; z.volleyGap = .18 + (2 - z.addOrder) * .35; set(z, 'addvolley');
        } else { z.f = z.addExitDir; z.moving = true; set(z, 'addleave'); }
      }
      return;
    }
    if (z.st === 'addleave') {
      z.moving = true; z.x += z.addExitDir * 70 * dt;
      if ((z.addExitDir < 0 && z.x <= z.addExitX) || (z.addExitDir > 0 && z.x >= z.addExitX)) {
        z.x = z.addExitX; z.st = 'gone'; z.t = 1;   // 走出画面直接消失（不播倒地、不计击倒）
      }
      return;
    }
    return;
  }
  if (z.air) { airStep(z, dt); return; }
  if (z.st === 'land') { if (z.t > .45) { if (z.dead) { z.st = 'gone'; z.t = 0; } else set(z, 'move'); } return; }
  if (z.dead) return;
  if(ch2Skill(z,dt))return;
  // 根因修复（柴业政/果汁/用户报「一个小兵打不死、闪白不掉血」）：草垛后的伏兵 hidden=true，受击直接跳过；
  // 以前被「区域只剩伏兵 / 尸体一起站起来」叫醒时没清 hidden，它起来照样打人，却永远打不到
  if (z.hidden && z.st !== 'sleep' && !z.T.chapterBoss) z.hidden = false;
  if (z.st === 'sleep') {
    if (Math.hypot(hero.x - z.x, hero.y - z.y) < 72) { set(z, 'wake'); z.hidden = false; sfx('wake', z.x); }
    return;
  }
  if (z.st === 'wake') { if (z.t > (z.T.elite ? 1.0 : .55)) set(z, 'move'); else return; }
  if (T.priest) {                        // 方士：远离玩家 → 念咒 → 回血/火球，念咒可被打断
    if (z.daze > 0) { z.daze -= dt; z.stun = Math.max(0, z.stun - dt); moveEnt(z, z.vx * dt, 0); z.vx *= .85; return; }
    if (z.stun > 0) { z.stun -= dt; moveEnt(z, z.vx * dt, 0); z.vx *= .85; if (z.stun <= 0) set(z, 'idle'); return; }
    if (z.st === 'hurt') set(z, 'idle');
    if (z.chantCd == null) z.chantCd = 1.5;
    z.chantCd -= dt;
    if (z.st === 'chant') {
      const fire = z.castKind === 'fire';
      if (z.t >= (fire ? 1 : 2)) { fire ? firePriestCast(z) : priestCast(z); set(z, 'idle'); z.chantCd = fire ? 3.5 : 8; }
      return;
    }
    if (z.chantCd <= 0) {
      // 所有方士：有友军受伤先回血（念咒2秒），否则丢火球（念咒1秒）
      const hurtAlly = zs.some(o => o !== z && !o.dead && !o.T.boss && o.hp < o.T.hp * .7);
      const canFire = inChapter2Context();   // 第一章方士只回血，第二章起才丢火球
      // 用户反馈：首领一掉血方士就一直回血、从不放火球 → 回血和火球轮流（刚回过血下一次必丢火球）
      const heal = hurtAlly && (!canFire || z.lastCast !== 'heal');
      if (heal || canFire) { z.castKind = heal ? 'heal' : 'fire'; z.lastCast = z.castKind; set(z, 'chant'); return; }
    }
    const pdx = hero.x - z.x, pad = Math.abs(pdx);
    if (pdx) z.f = Math.sign(pdx);
    let tx = z.x, ty = z.y, moving = false;
    if (pad < 110) { tx = z.x - Math.sign(pdx) * 40; moving = true; }          // 太近：快速后退
    else if (pad > 170) { tx = z.x + Math.sign(pdx) * 40; moving = true; }     // 太远：靠回战场（防被弹飞后卡住）
    else {                                                                     // 合适距离：躲到最近的友军身后
      let ally = null, bd = 1e9;
      for (const o of zs) {
        if (o === z || o.dead || o.T.priest || o.T.boss) continue;
        const d = Math.hypot(o.x - z.x, o.y - z.y);
        if (d < bd) { bd = d; ally = o; }
      }
      if (ally && bd > 46) { tx = ally.x - Math.sign(pdx) * 20; ty = ally.y; moving = true; }
    }
    const cover=ch2Formation(z);if(cover){tx=cover.x;ty=cover.y;moving=Math.hypot(tx-z.x,ty-z.y)>4;}
    z.moving = moving;
    if (moving) {
      const mx = tx - z.x, my = ty - z.y, l = Math.hypot(mx, my) || 1;
      moveEnt(z, mx / l * T.spd * dt, my / l * T.spd * dt);
      if (Math.abs(mx) > 2) z.f = Math.sign(mx) || z.f;
    }
    return;
  }
  if (z.daze > 0) { z.daze -= dt; z.stun = Math.max(0, z.stun - dt); moveEnt(z, z.vx * dt, 0); z.vx *= .85; return; }   // 晕眩：站着不动
  if (z.stun > 0) { z.stun -= dt; moveEnt(z, z.vx * dt, 0); z.vx *= .85; return; }
  if (Math.abs(z.vx) > 1) { moveEnt(z, z.vx * dt, 0); z.vx *= .85; }
  if (z.villagerChaser) {
    const target = [...villagers].reverse().find(v => v.state === 'run');
    if (target) {
      const dx = target.x - z.x, dy = target.y - z.y, d = Math.hypot(dx, dy);
      z.f = Math.sign(dx) || z.f; z.moving = d > 16;
      if (z.moving) {
        const cs = Math.min(T.spd, 26);                                // 比村民（30）慢，永远追不上
        moveEnt(z, dx / d * cs * dt, dy / d * cs * .7 * dt);
        if (z.bx && z.avoidDir == null) moveEnt(z, 0, (z.slot % 2 ? 1 : -1) * cs * dt);
      }
      return;
    }
  }
  const dx = hero.x - z.x, dy = hero.y - z.y;
  // 方士的加持：移速/出手 +20%，持续 4 秒（只刷新不叠加）
  const buff = (z.blessT > 0) ? 1 : 0;
  if (z.blessT > 0) z.blessT -= dt;
  if (z.st === 'wind') {
    // 防卡Y值：近战前摇时慢慢对齐主角的上下位置（每秒最多 22 像素，大步跑开仍能躲）
    if (!T.ranged && Math.abs(dy) < 30) moveEnt(z, 0, Math.sign(dy) * Math.min(Math.abs(dy), 22 * dt));
    // 完美闪避：敌人刀落下前 0.18 秒内翻滚 → 慢动作 + 1 秒暴击窗
    if (!z.pd && z.st === 'wind') {
      const rem = T.wind - z.t;
      if (rem > 0 && rem < .18 && hero.st === 'roll' && hero.t < .22 && pdCd <= 0 &&
          Math.abs(z.x - hero.x) < 130 && Math.abs(z.y - hero.y) < 40) {
        z.pd = true; pdCd = 1.5; slowT = .3; critT = 1.0;
        floaters.push({ x: hero.x, y: hero.y - 30, t: 0, txt: '闪避！', dodge: true });
        sfx('perfect', hero.x); shake = Math.max(shake, .12);
        for (let i = 1; i <= 3; i++) ghosts.push({ x: hero.x - hero.rx * i * 9, y: hero.y - (hero.ry || 0) * i * 9, f: hero.f, a: .45 - i * .1, t: 0 });
      }
    }
    if (z.t > T.wind) {
      set(z, 'strike'); sfx(T.ranged === 'stone' ? 'sling' : T.ranged === 'fire' ? 'bow' : 'enemySwing', z.x);
      if (T.ranged === 'stone') eshots.push({ source:z, k: 'stone', x: z.x + z.f * 16, y: z.y, z: 24, vx: z.f * 190, life: .95 });   // 射程约 180，和玩家一致
      else if (T.ranged === 'fire') {
        const dx=hero.x-z.x,dy=hero.y-z.y;
        for(const angle of ch2Troops()&&z.type==='archer'?[-Math.PI/15,0,Math.PI/15]:[0]){
          eshots.push({k:'fire',enemyVolley:ch2Troops(),x0:z.x+z.f*16,y0:z.y,tx:z.x+dx*Math.cos(angle)-dy*Math.sin(angle),ty:z.y+dx*Math.sin(angle)+dy*Math.cos(angle),t:0,T:.9});
        }
      }
      else if (Math.abs(dx) < T.reach && Math.abs(hero.y - z.y) < 14 && Math.sign(dx) === z.f) dmgHero(T.dmg, z);   // 上下判定 9→14，和主角攻击范围对齐
    }
    return;
  }
  if (z.st === 'strike') { if (!T.ranged) moveEnt(z, z.f * 40 * dt, 0); if (z.t > .25) set(z, 'rec'); return; }
  if (z.st === 'rec') { if (z.t > (T.ranged ? .4 : .7)) { z.tok = false; set(z, 'move'); } return; }
  z.f = Math.sign(dx) || z.f;
  let tx, ty;
  if (T.ranged) {   // 远程：和主角保持距离，站到差不多同一条线上
    const side = Math.sign(z.x - hero.x) || 1, want = (T.range[0] + T.range[1]) / 2;
    tx = hero.x + side * want; ty = hero.y + (z.slot % 2 ? 10 : -10);
    tx = Math.max(cam.x + 30, Math.min(tx, (lockR < Infinity ? lockR : cam.x + viewW()) - 30));
    if (z.siegeArcher && z.guard) { tx = z.guard.x; ty = z.guard.y; }   // 投石车弓手：站岗不动，远处也射（抛射）
    const ad = Math.abs(dx);
    if (z.cd <= 0 && ad > T.range[0] * .7 && ad < (z.siegeArcher ? 340 : T.range[1] * 1.2) && Math.abs(dy) < (z.siegeArcher ? 120 : T.ranged === 'stone' ? 14 : 60)) { set(z, 'wind'); z.cd = ch2Troops()&&z.type==='archer'?4.5:T.cd; return; }
  } else {          // 近战：最多 M.token 个同时贴身，其余在旁边游走
    const tokens = zs.filter(o => o.tok && !o.dead).length;
    if (!z.tok && tokens < (window.XIAOCHANG && XIAOCHANG.tokenCap ? XIAOCHANG.tokenCap() : M.token) && Math.abs(dx) < 130) z.tok = true;
    tx = hero.x - z.f * (z.tok ? T.reach - 6 : 52 + (z.slot % 3) * 14); ty = hero.y + (z.tok ? 0 : (z.slot % 2 ? 16 : -16));
    // 老卒专属：站到中距离就蓄力放剑气（6.5 秒一次）
    if (T.elite && !z.qi && (z.qiCd || 0) <= 0 && Math.abs(dx) < 130 && Math.abs(dy) < 26) {
      set(z, 'wind'); z.qi = 0; z.qiCd = 6.5; sfx('bladeAlert', z.x); return;
    }
    if (z.tok && !(ch2Troops() && z.type==='yellow-heavy' && ch2Formation(z) && Math.abs(z.x-ch2Formation(z).x)>18) && Math.abs(dx) < T.reach && Math.abs(dy) < 10) { set(z, 'wind'); if (T.heavy) sfx('bladeAlert', z.x); return; }
  }
  const formation=ch2Formation(z);if(formation){tx=formation.x;ty=formation.y;}
  const mx = tx - z.x, my = ty - z.y, l = Math.hypot(mx, my);
  z.moving = l > 4;
  if (z.moving) {
    const sp = T.spd * (!window.GEAR && z.moveSlowT > 0 ? .85 : 1) * (Math.abs(dx) > 150 ? 1.8 : 1);   // 离得远时快步冲过来
    moveEnt(z, mx / l * sp * dt, my / l * sp * .7 * dt);
    if (z.bx && z.avoidDir == null) moveEnt(z, 0, (z.slot % 2 ? 1 : -1) * T.spd * dt);   // 被草垛等挡住时上下绕开（已在绕行时不再额外推）
  }
}
// 投石车守卫（用户定）：主角贴近投石车或刚打过投石车 → 守卫全部来打；离开后追一小段再回岗
function siegeAlarm(z) {
  if (!z.guard || z.siegeArcher) return false;
  const carts = zs.filter(c => c.T.siege && !c.dead);
  const near = carts.some(c => Math.abs(hero.x - c.x) < 60 && Math.abs(hero.y - c.y) < 40) || gameT - (window.__cartHitAt || -9) < 3;
  if (near) z.alarmUntil = gameT + 2.5;
  return z.alarmUntil > gameT;
}
function updateChapter2Catapult(z, dt) {
  if (z.air || z.z || z.vz) { z.air = false; z.z = 0; z.vz = 0; z.vx = 0; if (z.st === 'air') z.st = 'idle'; }   // 根因：锤子终段会把投石车「击飞」，而投石车不走落地逻辑，卡在半空打不到、还继续开火
  if (!zs.some(c => c.T.siege && !c.dead) && !window.__siegeFreed) { window.__siegeFreed = true;   // 投石车全拆了：守卫/弓手解除站岗冲出来，防止卡关
    for (const o of zs) if (o.guard || o.siegeArcher) { o.guard = null; o.siegeArcher = false; o.alarmUntil = 0; } }
  if (z.lastHp != null && z.hp < z.lastHp) window.__cartHitAt = gameT; z.lastHp = z.hp;
  z.flash = Math.max(0, z.flash - dt); const attackDt=dt*(window.GEAR?GEAR.enemyAttack(z):1); z.t += attackDt; z.cd -= attackDt;
  if (!z.dead && z.hp <= 0) { z.dead = 1; kills++; }   // 保险：血打空就一定算拆掉
  if (z.dead) { if (z.st !== 'wreck') { z.st = 'wreck'; z.t = 0; shake = Math.max(shake, .3); sfx('land', z.x); floaters.push({ x: z.x, y: z.y - 40, t: 0, txt: '拆了！', big: true, gold: true });
      for (let i = 0; i < 18; i++) propFx.push({ x: z.x + rnd(-14, 14), y: z.y - rnd(4, 26), vx: rnd(-90, 90), vy: rnd(-150, -40), w: rnd(2, 4), h: rnd(2, 4), life: .6, max: .6, c: ['#6a4426', '#8a5a30', '#3a2414'][i % 3] }); } return; }   // 拆掉：木屑飞散、冒字，换成残骸
  if (z.st === 'wind' && z.t >= .72) {
    // 用户定：投石车集中砸主角一带，但不是同一点——按主角移动方向提前量，各车错开一点
    const lead = 1.15 * rnd(.6, 1.1), off = [[-22, -14], [0, 0], [22, 14], [-12, 16], [14, -16]][(z.catapultIndex || 0) % 5];
    const tx = Math.min(z.x - 70, hero.x + (hero.mvx || 0) * lead + off[0] + rnd(-8, 8));
    const ty = Math.max(M.top + 5, Math.min(M.bot - 5, hero.y + (hero.mvy || 0) * lead + off[1] + rnd(-5, 5)));
    eshots.push({ k: 'catapult', x0: z.x - 18, y0: z.y - 12, tx, ty, t: 0, T: 1.15, short: 3 });
    z.st = 'recoil'; z.t = 0; z.cd = 7; sfx('sling', z.x); return;   // 用户嫌弱：冷却 10→7
  }
  if (z.st === 'recoil' && z.t > .45) { z.st = 'idle'; z.t = 0; return; }
  if (z.st === 'wind') return;
  if (z.cd <= 0) { z.st = 'wind'; z.t = 0; }
}
function chapter2BossSummon(z) {
  if (!z || z.dead || z.summonedHalf) return;
  z.summonedHalf = true;
  const bx = z.x - z.f * 58, mid = (M.top + M.bot) / 2;
  if (z.type === 'zhang_liang') {
    spawn('yellow-heavy', bx, mid - 28);
    spawn('yellow-heavy', bx, mid + 28);
    // 台词由 CH2B 的怒吼统一说
    floaters.push({ x: z.x, y: z.y - 52, t: 0, txt: '给我上！', big: true, gold: true });
  } else if (z.type === 'zhang_bao') {
    spawn('priest', bx, mid - 28);
    spawn('priest', bx, mid + 28);
    // 台词由 CH2B 的黄沙迷阵统一说
    floaters.push({ x: z.x, y: z.y - 52, t: 0, txt: '众弟子，助我！', big: true, gold: true });
  }
}
function updateChapter2Boss(z, dt) {
  z.flash = Math.max(0, z.flash - dt); const attackDt=dt*(window.GEAR?GEAR.enemyAttack(z):1); z.t += attackDt; z.cd -= attackDt;
  z.daze = Math.max(0, (z.daze || 0) - dt);
  if (z.air) { airStep(z, dt); return; }
  if (z.st === 'land') {
    if (z.t > .45) {
      if (z.dead) { z.st = 'gone'; z.t = 0; }
      else { z.st = 'move'; z.t = 0; z.cd = .45; }
    }
    return;
  }
  if (z.dead) return;
  if (z.type === 'zhang_jiao' && window.ZJ && ZJ.duel(z, dt)) return;
  if (window.CH2B && CH2B.update(z, dt)) return;   // 张梁 / 张宝技能
  if (!z.summonedHalf && z.hp < z.T.hp * .5) chapter2BossSummon(z);
  if (window.BOSS_BLOCK && BOSS_BLOCK.update(z, dt, (o, tx, ty, sp, d2) => {
    const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy) || 1;
    moveEnt(o, dx / d * sp * d2, dy / d * sp * .5 * d2);
  }, z.T.spd || 30)) return;
  if (z.stun > 0) { z.stun -= dt; return; }
  if (z.st === 'wind') {
    if (z.t >= z.T.wind) {
      z.st = 'strike'; z.t = 0; sfx('enemySwing', z.x); shake = Math.max(shake, .12);
      if (Math.abs(hero.x - z.x) < z.T.reach + 10 && Math.abs(hero.y - z.y) < 20 && (hero.x - z.x) * z.f > -8) dmgHero(z.T.dmg, z);
    }
    return;
  }
  if (z.st === 'strike') { if (z.t > .25) { z.st = 'rec'; z.t = 0; } return; }
  if (z.st === 'rec') { if (z.t > .65) { z.st = 'move'; z.t = 0; z.cd = .6; } return; }
  const dx = hero.x - z.x, dy = hero.y - z.y;
  z.f = Math.sign(dx) || z.f; z.moving = Math.abs(dx) > z.T.reach - 5 || Math.abs(dy) > 10;
  if (z.moving) {
    const d = Math.hypot(dx, dy) || 1;
    moveEnt(z, dx / d * z.T.spd * dt, dy / d * z.T.spd * .5 * dt);
  } else if (z.cd <= 0) { z.st = 'wind'; z.t = 0; sfx('bladeAlert', z.x); }
}

// ---------- 投射物、火 ----------
