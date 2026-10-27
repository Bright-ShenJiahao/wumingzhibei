// 战斗中的装备快照、统一属性结算、触发冷却与敌人异常。
(() => {
  const D=AFFIX_DATA,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  let current=null,currentUid='',cool={},pending=[],spirit=0,lastSpirit=-99,chainTarget=null,chain=0,chainAt=-99,victoryUntil=-1,soulUntil=-1,revived=false,healLog=[],fx=[];
  const rogue=(k,d=0)=>window.ROGUE&&ROGUE.S[k]!=null?ROGUE.S[k]:d;
  function snapshot(type){const item=ARMORY.active(type),v={};if(item)for(const a of item.affixes)if(D.applicable(a,type))v[a.id]=a.value/100;
    if(item?.negative)v[item.negative.id]=-item.negative.value/100;
    return {uid:item?.uid||type,type,q:item?.q||0,v,special:item?.special||null,special2:item?.special2||null};}
  function sync(){const next=ARMORY.active(weapon),uid=next?.uid||weapon;if(uid!==currentUid){current=snapshot(weapon);currentUid=uid;spirit=0;chain=0;chainTarget=null;pending=[];if(hero){const max=maxHp();hero.hp=Math.min(hero.hp,max);}}return current;}
  const stat=(s,k)=>s.v[k]||0;
  function reduction(s){return clamp(stat(s,'focus'),0,.3);}
  function maxHp(){const s=current||snapshot(typeof weapon==='undefined'?'hammer':weapon);return 10*(1+clamp(stat(s,'health')+stat(s,'frail'),-.8,1));}
  function lowHp(){return hero?clamp((.5-hero.hp/maxHp())/.3,0,1):0;}
  function speed(k,base){const s=sync();
    if(k==='move')return clamp(base+stat(s,'move')+stat(s,'clumsy'),.2,1.3);
    if(k==='aspd')return 1/clamp(1/base+stat(s,'swift')+stat(s,'heavy')+(window.MASTERY?MASTERY.bonus(s.type).aspd:0)+(s.special==='spirit'?spirit*.01:0),.2,1.4);
    return base;
  }
  const ready=(key,seconds)=>{if((cool[key]||-99)>gameT)return false;cool[key]=gameT+seconds;return true;};
  const chance=p=>Math.random()<p;
  function heal(amount){healLog=healLog.filter(e=>gameT-e.t<3);const used=healLog.reduce((n,e)=>n+e.n,0);amount=Math.min(amount,Math.max(0,.5-used));if(amount>0){hero.hp=Math.min(maxHp(),hero.hp+amount);healLog.push({t:gameT,n:amount});floaters.push({x:hero.x,y:hero.y-28,t:0,txt:'+'+Number(amount.toFixed(2)),color:'#9bc981'});}}
  function attackToken(charged=false){const s=JSON.parse(JSON.stringify(sync()));return {s,charged,crit:critT>0||chance(clamp(.01+stat(s,'critical')+stat(s,'inaccurate')+rogue('crit'),0,.35)),thunderChecked:false,spiritCounted:false,dualChecked:false,leechChecked:false,chainHits:new Set()};}
  function abnormal(z){return (z.gearDot&&Object.values(z.gearDot).some(a=>a.length))||z.poisonT>0||z.moveSlowT>0||z.attackSlowT>0||z.daze>0||z.gearSlow>gameT||z.gearNumb>gameT||z.gearBlind>gameT||z.gearFrozen>gameT||z.gearColdUntil>gameT;}
  function primaryBonus(s,z,traits,token){
    let add=stat(s,'sharp')+stat(s,'blunt')+rogue(traits.ranged?'rangedDmg':'meleeDmg',1)-1+(window.MASTERY?MASTERY.bonus(s.type).dmg:0);
    const boss=z.T.boss||z.T.chapterBoss;
    add+=stat(s,boss?'hunt':'troops');if(abnormal(z))add+=stat(s,'exploit');
    if(victoryUntil>gameT)add+=stat(s,'victory');
    if(chainTarget===z&&gameT-chainAt<2)add+=chain*stat(s,'chain');
    if(s.special==='spirit')add+=spirit*.01;if(s.special==='berserk')add+=.2*lowHp();
    if(s.special==='execute'&&z.hp/z.T.hp<.3)add+=.2;
    if((s.special==='soul'||s.special2==='soul')&&soulUntil>gameT)add+=.1;
    if(traits.finisher)add+=rogue(traits.ranged?'finRanged':'finMelee',1)-1;
    if(traits.quake)add+=rogue('hammerBonus',1)-1;
    if(token.charged)add+=stat(s,'charge')+rogue('chargedDmg',1)-1;
    const qualityBase=D.qualities[s.q]?.base||1;
    return Math.max(.1,1+add)*qualityBase;
  }
  function extra(z,damage,token,crit=true){if(!z||z.dead)return;const s=token.s;z.lastGear=s;const value=damage*(crit&&token.crit?clamp(1.5+stat(s,'severity')+stat(s,'weakcrit'),1,2.5):1);hit(z,value,0,0,false,0,0,false,false,{secondary:true,scaled:true,gearSecondary:true});}
  function hitPrimary(z,damage,kb,dir,knock,daze,stun,interrupt,ranged,traits){
    if(!z||z.dead||(z.air&&!traits.dot))return;
    if(traits.dot||traits.scaled||traits.secondary){const previous=[hero.lastHit,hero.lastHitC];const result=rawHit(z,damage,kb,dir,knock,daze,stun,interrupt,ranged,traits);if(traits.secondary){hero.lastHit=previous[0];hero.lastHitC=previous[1];}return result;}
    const token=traits.gearToken||hero?.atk?.gearToken||attackToken(!!traits.charged),s=token.s;
    const base=damage*primaryBonus(s,z,{...traits,ranged},token);let dmg=base;
    if(token.crit){dmg*=clamp(1.5+stat(s,'severity')+stat(s,'weakcrit'),1,2.5);floaters.push({x:z.x,y:z.y-34,t:0,txt:'暴击！',big:true});}
    kb*=Math.max(0,1+stat(s,'soft'));if(chance(stat(s,'push'))&&!z.T.boss&&!z.T.chapterBoss)kb+=40;
    const hp=z.hp;const result=rawHit(z,dmg,kb,dir,knock,daze,stun,interrupt,ranged,{...traits,scaled:true});
    if(z.hp>=hp)return result;
    if(window.MASTERY)MASTERY.gain(s.type,z,!!z.dead);   // 武器熟练度：只算主角武器的直接命中
    z.lastGear=s;
    // 发射后可以保留原伤害，但换武器后旧武器不能再施加新词条效果。
    if(sync().uid!==s.uid)return result;
    if(!token.spiritCounted){token.spiritCounted=true;if(s.special==='spirit'&&sync().uid===s.uid){spirit=Math.min(10,spirit+1);lastSpirit=gameT;}}
    if(!token.chainHits.has(z)){token.chainHits.add(z);if(chainTarget!==z||gameT-chainAt>=2)chain=0;chainTarget=z;chainAt=gameT;chain=Math.min(3,chain+1);}
    if(!token.leechChecked){token.leechChecked=true;if(rogue('lifesteal')&&ready('cardLeech',3))heal(rogue('lifesteal'));if(chance(stat(s,'leech'))&&ready('leech',2))heal(.25);}
    if(!z.dead){
      applyStatuses(z,base,s);
    if(['chant','wind'].includes(z.st)&&!z.T.boss&&chance(stat(s,'interrupt'))&&ready('interrupt',3)){z.st=z.T.priest?'hurt':'move';z.t=0;z.tok=false;z.cd=Math.max(z.cd||0,.5);z.stun=Math.max(z.stun||0,.25);if(z.T.priest){z.chant=0;z.chantCd=8;}}
    }
    if(!ranged&&!token.dualChecked){token.dualChecked=true;if(chance(stat(s,'double')))pending.push({t:gameT+.1,uid:s.uid,run:()=>{if(Math.abs(z.x-hero.x)<WEAP[s.type].reach*range(s)+12&&Math.abs(z.y-hero.y)<WEAP[s.type].dy)extra(z,base*.5,token);}});}
    const splitProbability=clamp(stat(s,'split')+(rogue('split')?1:0),0,1);
    if(!ranged&&chance(splitProbability)){
      const coeff=rogue('split')?.3:.25;
      zs.filter(o=>o!==z&&!o.dead&&Math.hypot(o.x-z.x,(o.y-z.y)*2)<=45).sort((a,b)=>Math.hypot(a.x-z.x,a.y-z.y)-Math.hypot(b.x-z.x,b.y-z.y)).slice(0,3).forEach(o=>extra(o,base*coeff,token));
    }
    if(!token.thunderChecked){token.thunderChecked=true;if(s.special==='thunder'&&chance(.08)&&ready('thunder',2)){
      const enemies=zs.filter(o=>!o.dead&&!o.hidden&&o.x>=cam.x&&o.x<=cam.x+viewW());
      if(enemies.length){const center=D.pick(enemies);fx.push({x:center.x,y:center.y,life:.28});for(const o of enemies)if(Math.hypot(o.x-center.x,(o.y-center.y)*2)<=45)extra(o,base*.6,token,false);sfx('finisher',center.x);}
    }}
    return result;
  }
  function dot(z,id,damage,duration,max){z.gearDot||={};let entries=z.gearDot[id]||[];entries=entries.filter(e=>e.until>gameT);if(entries.length<max)entries.push({damage,until:gameT+duration,next:gameT+1});else{const weakest=entries.reduce((a,b)=>a.damage<b.damage?a:b);weakest.damage=Math.max(weakest.damage,damage);weakest.until=gameT+duration;}z.gearDot[id]=entries;}
  function applyStatuses(z,base,s){
    const poison=stat(s,'poison'),weaponPoison=poison&&chance(.2);if(weaponPoison||rogue('poison'))dot(z,'poison',(weaponPoison?base*poison:0)+(rogue('poison')?.25:0),3,2);
    if(chance(.15)&&stat(s,'bleed'))dot(z,'bleed',base*stat(s,'bleed'),2,1);
    if(chance(.2)&&stat(s,'burn'))dot(z,'burn',base*stat(s,'burn'),3,3);
    for(const [id,key]of [['slow','gearSlow'],['numb','gearNumb'],['blind','gearBlind']])if(stat(s,id)&&chance(.2)){const previous=z[key]>gameT?z[key+'Value']||0:0;z[key]=gameT+2;z[key+'Value']=Math.max(previous,stat(s,id));}
    if(stat(s,'ice')&&gameT>=(z.gearIceImmune||0)&&chance(stat(s,'ice'))){if(gameT>(z.gearColdUntil||0))z.gearCold=0;z.gearCold=(z.gearCold||0)+1;z.gearColdUntil=gameT+3;const boss=z.T.boss||z.T.chapterBoss;if(z.gearCold>=(boss?6:3)){z.gearCold=0;z.gearColdUntil=0;z.gearFrozen=gameT+(boss?.3:.8);z.gearIceImmune=z.gearFrozen+3;}}
  }
  function range(s=sync()){return clamp(1+stat(s,'reach')+stat(s,'short'),.2,1.35);}
  function projectile(s){
    if(s.secondary)return;
    const token=s.gearToken||attackToken(!!s.charged);s.gearToken=token;
    const snap=token.s;s.life*=range(snap);s.gearLife=s.life;s.originX=s.x;s.originY=s.y;s.originalVx=s.vx;s.originalVy=s.vy||0;
    s.gearPierce=chance(stat(snap,'pierce'));s.gearReturn=chance(stat(snap,'return'));
    const extraShot=(coefficient,angle=0)=>({...s,C:{...s.C,dmg:s.C.dmg*coefficient,kb:s.C.kb*.5,pierce:false,daze:0,dazeChance:0,dazeTime:0},secondary:true,gearReturn:false,gearPierce:false,hitSet:[],vx:s.originalVx*Math.cos(angle),vy:Math.abs(s.originalVx)*Math.sin(angle)*.5,gearToken:token,gearCoefficient:coefficient});
    const scatter=clamp(stat(snap,'scatter')+(rogue('scatter')?.2:0),0,.4);
    if(!token.projectileExtrasChecked){token.projectileExtrasChecked=true;
      if(chance(scatter))shots.push(extraShot(.35,Math.random()<.5?-Math.PI/6:Math.PI/6));
      if(chance(clamp(stat(snap,'repeat')+rogue('stoneExtra'),0,.4)))pending.push({t:gameT+.15,uid:snap.uid,run:()=>shots.push({...extraShot(.5),x:hero.x+hero.f*16,y:hero.y})});
    }
  }
  function projectileTraits(s){return {secondary:!!s.secondary,scaled:!!s.secondary,gearToken:s.gearToken,finisher:!s.secondary&&s.c===WEAP[s.gearToken?.s.type||weapon].combo.length-1,charged:s.charged};}
  function projectileDamage(s,z){if(!s.secondary)return s.C.dmg;
    const token=s.gearToken;if(!token)return s.C.dmg;return s.C.dmg*primaryBonus(token.s,z,{ranged:true},token)*(token.crit?clamp(1.5+stat(token.s,'severity')+stat(token.s,'weakcrit'),1,2.5):1);
  }
  function enemyTime(z,dt){if(z.dead)return dt;if(z.gearFrozen>gameT)return 0;return dt;}
  function enemyAttack(z){return (window.XIAOCHANG ? XIAOCHANG.actionScale(z) : 1)*(1-Math.max(z.gearNumb>gameT?(z.gearNumbValue||0):0,z.attackSlowT>0?.1:0));}
  function enemyMove(z){let slow=Math.max(z.gearSlow>gameT?z.gearSlowValue||0:0,z.moveSlowT>0?.15:0);if(z.gearColdUntil>gameT)slow=Math.max(slow,Math.min(3,z.gearCold||0)*.05);return (1-slow)*(window.XIAOCHANG ? XIAOCHANG.moveScale(z) : 1);}
  function incoming(n,from,kind='basic'){const s=sync();if(from&&kind==='basic'&&chance(clamp(stat(s,'dodge'),0,.2))){floaters.push({x:hero.x,y:hero.y-28,t:0,txt:'闪避'});return 0;}
    const source=from?.source||from;
    if(from&&kind==='basic'&&source?.gearBlind>gameT&&chance(source.gearBlindValue||0)){floaters.push({x:hero.x,y:hero.y-28,t:0,txt:'未命中'});return 0;}
    const reduce=stat(s,'guard')+stat(s,'fragile')+(s.special==='tenacity'?.15*lowHp():0);
    return n*(1-clamp(reduce,-1,.3));
  }
  function tryRevive(){if(sync().special!=='revival'||revived)return false;revived=true;hero.hp=maxHp()*.3;hero.inv=2;hero.air=false;hero.deathArc=false;hero.z=0;hero.ax=0;hero.st='idle';hero.atk=null;hero.vx=0;hero.vz=0;cancelCharge();say('神佑复生！',2);sfx('finisher',hero.x);return true;}
  function skillCd(){return 30*(1-reduction(sync()));}
  function refreshSkill(){return sync().special==='favor'&&chance(.05)&&ready('favor',30);}
  function dropEnemy(z){
    if(window.XIAOCHANG && XIAOCHANG.active()){XIAOCHANG.dropEnemy(z);return;}
    if(z.gearDropped)return;z.gearDropped=true;
    const boss=!!(z.T.boss||z.T.chapterBoss),source=boss?'boss':z.T.elite?'elite':'grunt';
    if(!boss&&!z.T.elite&&!chance(.005))return;
    const r=Math.random(),count=boss?(r<.5?1:r<.8?2:3):1;
    const person=boss?(z.T.boss?'管亥':z.type==='zhang_liang'?'张梁':z.type==='zhang_bao'?'张宝':''):'';
    const pool=['staff','hammer','stone'];
    if(TITLE.ownsWeapon('halberd')||TITLE.hasCleared(1))pool.push('halberd');
    // 按当前战斗章节限制，而不是按是否拥有；回第一章刷装也不会掉大刀或汉弓。
    if(chapter2Run){pool.push('blade');if(TITLE.ownsWeapon('bow'))pool.push('bow');}
    for(let i=0;i<count;i++){const type=z.T.boss&&!TITLE.hasCleared(1)&&i===0?'halberd':D.pick(pool),item=D.generate(type,source,person,undefined,chapter2Run?undefined:D.mainWeights[source]);drops.push({k:'weapon',weapon:type,item,x:z.x+(i-(count-1)/2)*18,y:z.y,z:10,vy:130,t:0,life:Infinity,got:0});}
    if(!boss)return;say('将领已败！靠近拾取武器，失败也会保留。',3);
  }
  function collectDrops(){for(const d of drops)if(d.item&&!d.got&&ARMORY.add(d.item))d.got=1;}
  function tick(dt){sync();if(gameT-lastSpirit>5)spirit=0;
    const due=pending.filter(p=>p.t<=gameT);pending=pending.filter(p=>p.t>gameT);for(const p of due)if(p.uid===current.uid&&!over&&!hero.air&&hero.st!=='hurt')p.run();
    for(const z of zs){if(z.dead){dropEnemy(z);if(!z.gearKillRewarded){z.gearKillRewarded=true;if(window.WALLET)WALLET.awardKill(z);const s=z.lastGear;if(s&&s.uid===current.uid){if(stat(s,'victory'))victoryUntil=gameT+4;if(s.special==='soul'||s.special2==='soul')soulUntil=gameT+3;if(chance(stat(s,'survive'))&&ready('survive',1))hero.hp=Math.min(maxHp(),hero.hp+.5);}}continue;}
      if(z.gearDot)for(const entries of Object.values(z.gearDot))for(let i=entries.length-1;i>=0;i--){const e=entries[i];if(e.next<=gameT&&e.next<=e.until){e.next+=1;hit(z,e.damage,0,0,false,0,0,false,false,{secondary:true,scaled:true,dot:true});}if(e.until<=gameT)entries.splice(i,1);}
      if(z.dead)dropEnemy(z);
    }
    fx.forEach(e=>e.life-=dt);fx=fx.filter(e=>e.life>0);
  }
  function draw(){for(const e of fx){ctx.save();ctx.globalAlpha=e.life/.28;ctx.strokeStyle='#d9e6f5';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(e.x-10,e.y-150);ctx.lineTo(e.x+5,e.y-85);ctx.lineTo(e.x-4,e.y-65);ctx.lineTo(e.x,e.y);ctx.stroke();ctx.strokeStyle='#a7a0d6';ctx.beginPath();ctx.ellipse(e.x,e.y,45,22,0,0,Math.PI*2);ctx.stroke();ctx.restore();}}
  function attackScale(z){const s=sync();return z&&s?primaryBonus(s,z,{},{charged:false}):1;}   // 长戟裂伤等按主攻击结算的伤害用
  window.GEAR={attackScale,snapshot,sync,attackToken,hit:hitPrimary,range,maxHp,speed,tick,draw,incoming,tryRevive,skillCd,refreshSkill,enemyTime,enemyMove,enemyAttack,projectile,projectileTraits,projectileDamage,collectDrops,
    chargeScale:()=>1-reduction(sync()),
    reset(){current=null;currentUid='';cool={};pending=[];spirit=0;lastSpirit=-99;chain=0;chainTarget=null;victoryUntil=-1;soulUntil=-1;revived=false;healLog=[];fx=[];sync();},
    switch(){currentUid='';sync();victoryUntil=-1;soulUntil=-1;chain=0;chainTarget=null;},
  };
})();
