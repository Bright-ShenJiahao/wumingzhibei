// 受击结算：hit/rawHit、击飞、落地、敌人欢呼（2026-10-31 从 game.js 原样拆出，逻辑不变）
// 依赖 game.js 的全局变量，只在运行时调用；本文件加载时不访问 game.js 的变量。
function hit(z, dmg, kb, dir, knock, daze = 0, stun = .35, interrupt = false, ranged = false, traits = {}) {
  // 盾兵举盾（第二章）：穿云箭、投石车这类从天上砸下的攻击，盾兵周围 45 内的黄巾兵：50% 完全挡住，否则只吃 40% 且不硬直（用户定）
  if (chapter2Run && z && !z.dead && (traits.skyArrow || traits.siegeShot)) {
    const sh = zs.find(s => s.type === 'yellow-shield' && !s.dead && Math.hypot(s.x - z.x, (s.y - z.y) * 2) < (s.T.ch2Elite ? 65 : 45));
    if (sh) {
      if (!(sh.shieldUpUntil > gameT)) { sh.shieldUpUntil = gameT + .8; floaters.push({ x: sh.x, y: sh.y - 40, t: 0, txt: '举盾！' }); }
      if (Math.random() < (sh.T.ch2Elite ? .2 : .1)) { floaters.push({ x: z.x, y: z.y - 30, t: 0, txt: '挡住' }); return 'blocked'; }   // 用户定：举盾 10% 整下挡掉（精英 20%），否则只吃 40%
      dmg *= .4; stun = 0; daze = 0; kb = 0; knock = false;
    }
  }
  if (ranged && !traits.skyArrow && !traits.secondary && window.BOWAMMO && z && !z.dead && (traits.gearToken?.s.type || weapon) === 'bow') BOWAMMO.onHit();   // 普通箭射中回蓄力箭
  const armor=z&&ch2Armored(z),old=armor?{st:z.st,t:z.t}:null;
  const hp0=z&&z.hp;
  const outcome=window.GEAR ? GEAR.hit(z,dmg,kb,dir,knock,daze,stun,interrupt,ranged,traits) : rawHit(z,dmg,kb,dir,knock,daze,stun,interrupt,ranged,traits);
  if(armor&&!z.dead){z.st=old.st;z.t=old.t;z.air=false;z.z=0;z.vz=0;z.vx=0;z.stun=0;z.daze=0;}
  if (z && !traits.dot && !traits.secondary) window.__lastHit = `${z.type} 伤害${(+dmg).toFixed(2)} 血${(+hp0).toFixed(1)}→${(+z.hp).toFixed(1)} 击退${Math.round(kb)} ${outcome || ''}${z.air ? ' 空中' : ''}${z.hidden ? ' 隐身' : ''}${window.XIAOCHANG && XIAOCHANG.active() ? ' 校场' : ''}`;   // 排查「打了没伤害」
  return outcome;
}
function rawHit(z, dmg, kb, dir, knock, daze = 0, stun = .35, interrupt = false, ranged = false, traits = {}) {
  if (!z || z.dead || (z.air && !traits.dot) || z.hidden) return;
  if (z.T.mirror) { if (window.XINMO) XINMO.takeHit(z, dmg, dir, (traits.dot || traits.secondary) && !traits.zg ? 'extra' : traits.skyArrow ? [1, stun] : [traits.dazeChance != null ? traits.dazeChance : daze, traits.dazeTime != null ? traits.dazeTime : 1.5 * R_('daze')], !(traits.finisher || traits.charged || traits.skyArrow || traits.halberdCharge)); return; }   // 心魔：和玩家对称的受伤规则
  if(ch2Troops()&&z.type==='yellow-shield'&&!traits.dot&&!traits.secondary){
    const type=traits.gearToken?.s.type||weapon,charged=traits.charged||traits.halberdCharge||traits.skyArrow||traits.gearToken?.charged;
    const sb=window.MERIDIAN&&MERIDIAN.x('shield')?.5:1;   // 经脉·破盾：盾的挡/卸概率减半、减伤也打折
    const front=dir*z.f<0&&type!=='hammer',cls=(type==='bow'||type==='stone')?'ranged':(type==='staff'||type==='halberd')?'long':'short';
    // 用户定：正面打盾兵按武器分——远程 ×0.5、长杆 ×0.75、短兵（大刀）×1.15 且格挡概率减半；锤子照旧无视盾；从背后打不受影响。
    // 蓄力 / 终段（含弓的第三段）不再无视盾：不会被整下挡掉，但倍率照算。
    if(front&&!traits.skyArrow&&!traits.siegeShot){const m=cls==='ranged'?.5:cls==='long'?.75:1.05;dmg*=m<1?1-(1-m)*(sb<1?(cls==='ranged'?.75:.5):1):m;}
    const roll=Math.random(),fullP=(z.T.ch2Elite?.2:.1)*sb*(cls==='short'?.5:1);   // 正面普攻 10% 整下挡掉、50% 只吃一半、其余吃满（精英 20% / 50%）
    if(!charged&&!traits.finisher&&front&&roll>=fullP&&roll<fullP+.5*sb*(cls==='short'?.5:1)){
      dmg*=.5;stun=0;kb*=.3;daze=0;interrupt=false;   // 盾卸了一半力：照样掉血，但不硬直
      for(let i=0;i<4;i++)propFx.push({x:z.x+z.f*8,y:z.y-18+rnd(-6,6),vx:rnd(-40,40)+z.f*30,vy:rnd(-80,-20),w:1.5,h:1.5,life:.2,max:.2,c:'#d88a4a'});
    }
    else if(!charged&&!traits.finisher&&front&&roll<fullP){

      const start=propFx.length, firstFloater=floaters.length;if(window.BOSS_BLOCK)BOSS_BLOCK.effect(z);
      for(let i=firstFloater;i<floaters.length;i++)floaters[i].color='#aa4c2c';
      for(let i=start;i<propFx.length;i++){propFx[i].c='#aa4c2c';propFx[i].w*=.7;propFx[i].h*=.7;}
      return 'blocked';
    }
  }
  if (ranged && z.T.chapterBoss && window.BOSS_BLOCK && BOSS_BLOCK.isBlocking(z, dir)) { BOSS_BLOCK.effect(z); return 'blocked'; }
  if (window.XIAOCHANG && XIAOCHANG.active()) dmg = XIAOCHANG.enemyDamage(z, dmg);
  if (ranged && z.T.rangedResist && !(ch2Troops() && z.type === 'yellow-shield')) dmg *= window.MERIDIAN && MERIDIAN.x('shield') ? 1 - (1 - z.T.rangedResist) * .75 : z.T.rangedResist;   // 破盾：远程减伤降四分之一
  if (z.T.boss) {
    const hp0 = z.hp;
    if (window.ROGUE && ROGUE.onHit) dmg = ROGUE.onHit(z, dmg, traits, ranged);
    const res = Boss.hit(z, dmg, dir, ranged, traits);
    if (z.hp < hp0) {
      if (window.ROGUE && ROGUE.afterHit) ROGUE.afterHit(z, false, traits, dmg, ranged);
      if (traits.dot) return res;

      countComboHit();
    }
    return res;
  }
  if (traits.dot) {
    z.hp -= dmg; z.flash = .08;
    if (z.hp <= 0) {
      z.dead = 1; kills++; set(z, 'land');
      if (z.villagerChaser) thankVillagers();
      if (z.T.elite) { spawnDrop(z.x - 8, z.y, 'leg'); if (!chapter2Run) spawnDrop(z.x + 12, z.y); }
    }
    return;
  }
  countComboHit();
  if (z.adds != null) z.adds = null;   // 受击后立即退出援军状态机，后续按普通弓手受击/击飞处理
  hero.lastHit = gameT; hero.lastHitC = hero.atk ? hero.atk.c : hero.lastShotC;
    if (!traits.secondary && z.T.priest && z.st === 'chant') {   // 打断念咒：这一轮白念，冷却照走
      set(z, 'hurt'); z.t = 0; z.chantCd = z.castKind === 'fire' ? 3.5 : 8; z.chant = 0;
      sfx('crack', z.x);
      for (let i = 0; i < 6; i++) propFx.push({ x: z.x + rnd(-6, 6), y: z.y - 18 + rnd(-6, 4), w: 2, h: 2, life: .35, max: .35, c: '#3a2410' });
    }
  if (window.ROGUE && ROGUE.onHit) dmg = ROGUE.onHit(z, dmg, traits, ranged);   // 震慑破绽加伤、避实眩晕回血
  z.hp -= dmg * (z.daze > 0 ? 1.5 : 1);   // 被打晕的目标吃 1.5 倍伤害
  z.flash = .1; z.stun = z.T.siege ? 0 : (z.T.heavy && z.st === 'wind' && !interrupt ? 0 : stun); z.vx = z.T.siege ? 0 : kb * dir * (z.T.heavy ? .6 : 1);
  if (z.T.chapterBoss) {   // 用户定：第二章首领沿用管亥的「韧性」——挨打累积，满了才踉跄；出招中不被打断；平时只被推一点
    const POISE = { zhang_liang: 8, zhang_bao: 6, zhang_jiao: 10 }[z.type] || 8;
    z.poise = (z.poise || 0) + dmg; (z.hitLog ||= []).push(gameT); z.hitLog = z.hitLog.filter(t => gameT - t < 2);
    const busy = z.cb || (z.combo && !z.combo.rest) || z.array || z.st === 'tele';   // 出招/施法中（张角的法术在 z.combo 里）：霸体不踉跄
    if (z.poise >= POISE && !busy) { z.poise = 0; z.stun = .5; z.vx = dir * 70; floaters.push({ x: z.x, y: z.y - 50, t: 0, txt: '踉跄！', color: '#ffd86e' }); }
    else { z.stun = 0; z.vx = dir * 18; }
  }
  const heavyDazeScale = z.T.heavy ? (weapon === 'staff' ? .7 : .5) : 1;
  const dazeChance = traits.dazeChance != null ? traits.dazeChance : daze * heavyDazeScale;
  const dazeTime = traits.dazeTime != null ? traits.dazeTime : (z.T.heavy ? 1 : 1.5) * R_('daze');
  // 只有 traits 明确给出 dazeChance 的伤害（目前是石子）才能晕首领
  if ((!z.T.boss && !z.T.chapterBoss || traits.dazeChance != null) && dazeChance && !z.daze && Math.random() < dazeChance) {
    z.daze = dazeTime;
    if (z.T.chapterBoss) z.stun = Math.max(z.stun || 0, dazeTime);
    z.st = 'move'; z.tok = false;
  }
  if (ranged && z.T.chapterBoss && window.BOSS_BLOCK) BOSS_BLOCK.recordRanged(z, dir);
  if (z.stun) { z.st = 'move'; z.tok = false; }
  // 命中定格：轻击短、重击长。棍子每下 1 点伤害只停 0.038 秒（原来一律 0.05，连击会显得一顿一顿的）
  const W0 = WEAP[weapon] || {};
  freeze = Math.min(.11, W0.freeze != null ? W0.freeze : .02 + dmg * .018);   // 棍子有单独的定格时长，打起来更"实"
  shake = Math.max(shake, .12);
  // 命中火花：几粒白/金色小碎块朝被击退方向溅出（复用碎屑系统）
  for (let i = 0; i < 6; i++) {
    const life = rnd(.1, .26);
    propFx.push({ x: z.x - dir * 6, y: z.y - rnd(12, 26), vx: rnd(-70, 70) - dir * 45, vy: rnd(-110, -20),
      w: rnd(1, 2.2), h: rnd(1, 2.2), life, max: life, c: Math.random() < .5 ? '#fffbe6' : '#ffdd7a' });
  }
  if (z.hp <= 0) {
    z.dead = 1; kills++; knock = true;
    if (z.villagerChaser) thankVillagers();
    if (z.T.elite) { spawnDrop(z.x - 8, z.y, 'leg'); if (!chapter2Run) spawnDrop(z.x + 12, z.y); sfx('finisher', z.x); shake = .2; }   // 精英必掉：至少一个中等
    if (z.T.ch2Elite) { spawnDrop(z.x, z.y, Math.random() < .65 ? 'leg' : 'pig'); sfx('finisher', z.x); shake = .2; }   // 第二章精英：必掉鸡腿或烤乳猪
  }
  if (knock && !(z.T.boss || z.T.chapterBoss || z.T.noLaunch) && (traits.knockSiege || !z.T.siege)) launch(z, dir * (z.dead ? 110 : 80) * (z.T.heavy ? .7 : 1), z.dead ? 130 : 105);
  if (window.ROGUE && ROGUE.afterHit) ROGUE.afterHit(z, knock, traits, dmg, ranged);   // 震慑：眩晕/击倒挂破绽

}
let volleyAgainAt = 0;
function summonArchersVolley(again) {
  // 万箭齐发（加强）：两轮、每轮 10 支、40° 扇形，每支 1 伤害并穿透；同一敌人一次技能最多吃 3 支
  if (!again) { volleyAgainAt = gameT + .5; zs.forEach(z => z.wjHits = 0); }
  const angles = Array.from({ length: 10 }, (_, i) => (-20 + i * 40 / 9) * Math.PI / 180);
  for (const a of angles) {
    const C = { dmg: 1.5, kb: 12, pierce: true, pierceOff: .6 };
    const ang = a * hero.f;
    shots.push({ x: hero.x + hero.f * 14, y: hero.y + rnd(-8, 8), z: 24, vx: Math.cos(ang) * 260 * hero.f, vy: Math.sin(a) * 190, life: 1.05, C, c: 0, hitSet: [], kind: 'arrow', secondary: true, summon: true });
  }
  sfx('sling', hero.x); if (!again) say('万箭齐发！', 1.2);
}
// 击飞：腾空 → 落地弹一下 → （敌人）爬起 /（死亡）倒地消失
function launch(e, vx, vz) { e.air = true; e.z = 0.1; e.vz = vz; e.ax = vx; e.st = 'air'; e.t = 0; e.tok = false; e.stun = 0; e.daze = 0; }
function airStep(e, dt) {
  e.z += e.vz * dt; e.vz -= e.deathArc ? 220 * dt : 420 * dt; moveEnt(e, e.ax * dt, 0);
  if (e.z <= 0 && e.vz < 0) {
    e.z = 0; e.air = false; e.st = 'land'; e.t = 0; shake = Math.max(shake, .08);
    sfx(e.dead ? 'enemyDown' : e === hero && over ? 'heroDown' : 'land', e.x);
    if (e === hero && over) { e.deathArc = false; deathLandedAt = gameT; startEnemyCelebration(); }
  }
}
function startEnemyCelebration() {
  if (enemiesCelebrating) return;
  enemiesCelebrating = true;
  zs.forEach(z => {
    if (z.dead) return;
    z.celebrating = true; z.celebrateT = 0; z.vx = 0; z.qi = null;
    if (!z.T.boss) set(z, 'idle');
  });
}
