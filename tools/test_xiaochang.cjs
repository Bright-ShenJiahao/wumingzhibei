// 无浏览器逻辑回归：运行真实游戏/装备/Boss/锦囊模块，DOM与绘图仅作替身。
// node tools/test_xiaochang.cjs；不访问网络，不读写正式玩家存档。
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const path = require('node:path'), root = path.resolve(__dirname, '..');
const source = file => fs.readFileSync(path.join(root, file), 'utf8');
let seed = 123456, now = 0;
const math = Object.create(Math);
math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const calls = [];
const context2d = new Proxy({measureText: t => ({width: String(t).length * 9}), createLinearGradient: () => ({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})}, {
  get(o,k) { return k in o ? o[k] : (...args) => { if (k === 'ellipse' || k === 'fillText') calls.push([k,...args]); }; },
});
const nodes = new Map();
class Element {
  constructor(){this.style={setProperty(){}};this.dataset={};this.children=[];this.width=1280;this.height=720;this.classList={add(){},remove(){},toggle(){}};}
  appendChild(e){this.children.push(e);return e;} append(e){this.children.push(e);} after(){} remove(){} setAttribute(){} addEventListener(){} blur(){}
  getContext(){return context2d;} querySelector(s){return node(s);} querySelectorAll(){return [];}
  getBoundingClientRect(){return {left:0,top:0,width:1280,height:720};}
}
function node(id){if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);}
const store = new Map(), progress = {};
const c = {
  console, Math:math, Date, URLSearchParams, Set, Map, performance:{now:()=>now},
  location:{search:'?debug=xiaochang'}, innerWidth:1280,innerHeight:720,devicePixelRatio:1,
  localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
  document:{head:new Element(),body:new Element(),getElementById:node,querySelector:node,querySelectorAll:()=>[],createElement:()=>new Element(),addEventListener(){}},
  Image: class {constructor(){this.complete=true;this.width=2160;this.height=915;this.naturalWidth=2160;}},
  addEventListener(){},requestAnimationFrame(){return 1;},cancelAnimationFrame(){},setTimeout(){},clearTimeout(){},
  TITLE:{skip(){},blocks:()=>false,draw:()=>false,playerName:()=> '校场逻辑测试',hasCleared:()=>true,ownsWeapon:()=>true,
    noviceMode:()=>true,hardMode:()=>false,preparedWeapon:()=> 'hammer',equippedWeapon:s=>({long:'staff',short:'hammer',ranged:'stone'})[s],
    legacyLoadout:()=>({owned:['staff','hammer','stone','halberd'],equipped:{long:'staff',short:'hammer',ranged:'stone'}}),
    campaignProgress:()=>({1:true,xiaochang:progress}),xiaochangProgress:ch=>progress[ch]||0,
    markXiaochang(ch,n){progress[ch]=Math.max(progress[ch]||0,n);},openPreparation(){},
  },
  ROOM:{skip(){},blocks:()=>false,draw:()=>false},BOARD:{submit(){throw new Error('校场不应提交英雄榜');}},
  BG:{far:'',mid:'',gnd:''},ASSETS:{chars:{},props:{},food:{},ui:{scroll:'',btn:''},xiaochang:''},
};
c.window=c;vm.createContext(c);
const atlas=JSON.parse(source('art/sprites/atlas.json'));
for(const [ch,frames] of Object.entries(atlas)){c.ASSETS.chars[ch]={};for(const [name,data]of Object.entries(frames))c.ASSETS.chars[ch][name]=['',...data];}
for(const [name,data] of Object.entries(JSON.parse(source('art/props/meta.json'))))c.ASSETS.props[name]=['',...data];
for(const [name,data] of Object.entries(JSON.parse(source('art/food/meta.json'))))c.ASSETS.food[name]=['',...data];
for(const file of ['js/affix_data.js','js/cloud_merge.js','js/equipment_rules.js','js/armory.js','js/rogue.js','js/gear_combat.js','js/boss.js','js/xiaochang.js','game.js'])vm.runInContext(source(file),c,{filename:file});
const run = code => vm.runInContext(code,c);
const originalTypes = run('JSON.stringify(TYPES)');
function step(dt=.033){now+=dt*1000;run(`update(${dt})`);}
function cards(){assert(c.ROGUE.blocks());const offered=c.ROGUE.cards();assert(offered.length>=1&&offered.length<=3);for(const card of offered)assert(c.XIAOCHANG.cardAllowed(card));c.ROGUE.choose(0);step();}
function finishFloor(floor){
  assert(c.XIAOCHANG.start({floor,wish:'stone'}));let choices=0,frames=0,bossPhases=new Set();
  // 自动战斗驱动：以普通攻击命中走真实伤害/词条/两阶段死亡入口，不直接写敌人血量或dead。
  // 给自动驾驶玩家无敌用于隔离波次/掉落回归；受伤和失败另行测试。
  while(c.XIAOCHANG.state().status!=='result'&&frames++<30000){
    if(c.ROGUE.blocks()){cards();choices++;continue;}
    run('hero.inv=2');
    if(frames%12===0)run("for(const z of zs.filter(z=>!z.dead)){if(z.T.boss)globalThis.phases.add(z.phase);hit(z,1.2,0,1,false,0,0,false,false,{});}");
    step();if(frames%120===0)run('draw()');
  }
  run('draw()');
  assert(frames<30000,'六波不得卡死');assert.equal(choices,6);assert(c.XIAOCHANG.state().win);assert.equal(run('result'),null);
  assert(c.ARMORY.state().items.some(i=>i.inscription.includes('管亥')),'Boss落款和自动拾取');
  assert(c.ARMORY.state().items.every(i=>['staff','hammer','stone','halberd'].includes(i.type)));
  assert.equal(Object.keys(c.ROGUE.pickedUp()).length,0);
  return frames;
}
c.phases=new Set();
const firstFrames=finishFloor(1);assert(c.phases.has(1)&&c.phases.has(2));assert.equal(progress[1],undefined,'debug不写正式进度');
assert.equal(c.XIAOCHANG.state().wave,6);
// 6波配置重复抽样检查数量限制、固定骨架、预算和第一章兵种。
for(let floor=1;floor<=5;floor++)for(let wave=1;wave<=6;wave++)for(let sample=0;sample<100;sample++){
  c.XIAOCHANG.start({floor});c.XIAOCHANG.state().wave=wave;
  cards(); // cards()用真实选择后触发spawnWave
  const types=run('zs.map(z=>z.type)'), n=types.filter(t=>['slinger','archer'].includes(t)).length;
  assert(n*3<=types.length);assert(types.filter(t=>t==='priest').length<=1);
  if(wave===1)assert(types.every(t=>['grunt','blade'].includes(t)));
  if(wave===2)assert(n>=1&&n<=2);
  if(wave===3)assert(types.includes('elite')&&n>=1);
}
// 第5层真实精英/Boss、两种光环绘图调用与伤害倍率。
c.XIAOCHANG.start({floor:5});cards();run("spawn('elite',20,220);spawn('elite',700,220)");
const elites=run('zs.filter(z=>z.T.elite)');assert(elites.every(z=>['rage','armor'].includes(z.xAffix)));
for(const z of elites){z.xAffix='rage';assert.equal(c.GEAR.enemyAttack(z),1.2);assert.equal(c.GEAR.enemyMove(z),1.2);c.XIAOCHANG.drawAffix(z);z.xAffix='armor';assert(Math.abs(c.XIAOCHANG.enemyDamage(z,1)-.75/1.6)<1e-9);c.XIAOCHANG.drawAffix(z);}
assert(calls.some(x=>x[0]==='fillText'&&x[1]==='狂暴'));assert(calls.some(x=>x[0]==='fillText'&&x[1]==='铁甲'));
run('hero.inv=0;hero.air=false;hero.st="idle";hero.hp=10;dmgHero(1,null,"skill")');assert(Math.abs(run('hero.hp')-8.76)<1e-9,'校场不受简单减半');
// 骑马冲锋、掷戟落地与回收、二阶段召兵均必须留在720范围。
c.XIAOCHANG.skipToSix();cards();
run("globalThis.bz=zs.find(z=>z.T.boss);bz.st='charge';bz.cx0=bz.x;bz.cdist=400;bz.f=1;bz.x=700;hero.inv=9");step();assert(run('bz.x<=710'));
run("bz.phase=2;bz.type='guanhai';bz.st='throw_a';bz.t=.46;bz.f=1;bz.x=700;hero.x=710;archerAddsDone=true");
for(let i=0;i<100;i++){run('hero.inv=9');step();assert(run('!bz.spear || (bz.spear.x>=12&&bz.spear.x<=708)'));}
assert(run('!bz.spear'),'掷戟后应能回收');
c.phases.clear();const fifthFrames=finishFloor(5);assert(c.phases.has(2));
// 分层品质与5%特殊：定向权重、第一层不出高阶、第五层可出传说/天工。
for(const [source,tables]of Object.entries(c.XIAOCHANG.CONFIG[1].drops))for(let f=0;f<5;f++){
  let seen=new Set();for(let i=0;i<4000;i++){const item=c.AFFIX_DATA.generate('stone',source,'',undefined,tables[f]);seen.add(item.q);assert(tables[f][Math.min(item.q,4)]>0);}
  if(f===4)assert(seen.has(4)&&seen.has(5));
}
const save=c.CLOUD_MERGE.merge({campaign:{1:true,xiaochang:{1:4}}},{campaign:{xiaochang:{1:2,2:3}}});assert.equal(save.campaign.xiaochang[1],4);assert.equal(save.campaign.xiaochang[2],3);
assert.equal(c.CLOUD_MERGE.merge({campaign:{xiaochang:{1:99}}}).campaign.xiaochang,undefined);
// 失败保留拾取，无主线结算/分享；特殊复活照常生效且每局一次。
c.XIAOCHANG.start({floor:1});cards();
run("globalThis.held=ARMORY.active(weapon);held.special='revival';GEAR.reset();hero.inv=0;hero.st='idle';hero.hp=.1;dmgHero(1,null,'skill')");assert.equal(run('over'),false);assert(run('hero.hp>0'));
run("hero.inv=0;hero.st='idle';hero.air=false;hero.hp=.1;dmgHero(1,null,'skill')");assert.equal(run('over'),true);
for(let i=0;i<400&&!c.XIAOCHANG.blocks();i++)step();assert(c.XIAOCHANG.blocks());assert(!c.XIAOCHANG.state().win);assert.equal(run('result'),null);
// 非debug模式解锁和层数上限，写入章节进度；满仓禁止开局。
c.location.search='';c.XIAOCHANG.leave();assert(c.XIAOCHANG.start({floor:5}));assert.equal(c.XIAOCHANG.state().floor,1);
// 验证正式进度记录与满仓拦截（存档替身仅保存在本测试进程）。
finishFloor(1);assert.equal(progress[1],1);assert(c.XIAOCHANG.start({floor:5}));assert.equal(c.XIAOCHANG.state().floor,2);
// 掉落路由统计：次数、许愿的最终62.5%、Boss落款、5%特殊。
c.location.search='?debug=xiaochang';assert(c.XIAOCHANG.start({floor:5,wish:'stone'}));
for(const kind of ['boss','elite','grunt']){
  let items=0,wishes=0,specials=0;const trials=5000;
  for(let i=0;i<trials;i++){
    run('drops=[]');c.XIAOCHANG.dropEnemy({T:{boss:kind==='boss',elite:kind==='elite'},x:360,y:220});
    const rolled=run('drops');items+=rolled.length;wishes+=rolled.filter(d=>d.weapon==='stone').length;specials+=rolled.filter(d=>d.item.special).length;
    for(const d of rolled){assert(['staff','hammer','stone','halberd'].includes(d.weapon));if(kind==='boss')assert(d.item.inscription.includes('管亥'));}
  }
  if(kind==='boss'){assert(items/trials>1.64&&items/trials<1.76);assert(wishes/items>.60&&wishes/items<.65);assert(specials/items>.03&&specials/items<.07);}
  if(kind==='elite')assert(items/trials>.47&&items/trials<.53);
  if(kind==='grunt')assert(items/trials>.004&&items/trials<.016);
}
assert.equal(run('JSON.stringify(TYPES)'),originalTypes);
while(c.ARMORY.count()<50)c.ARMORY.add(c.AFFIX_DATA.generate('stone','boss','',0));assert.equal(c.XIAOCHANG.start(),false);
// 对正式TITLE存档API单独回归，不执行标题动画/DOM初始化。
const saved=new Map([['wzb-name','测试甲'],['wzb-campaign-clear-v1',JSON.stringify({'测试甲':{1:true,xiaochang:{1:2}}})]]);
const t={window:null,location:{search:''},CLOUD_MERGE:c.CLOUD_MERGE,localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)}};t.window=t;vm.createContext(t);
vm.runInContext(source('js/title.js').replace(/\n  boot\(\);\n\}\)\(\);\s*$/, '\n  S.name=readName();\n})();'),t);
assert.equal(t.TITLE.xiaochangProgress(1),2);t.TITLE.markXiaochang(1,3);t.TITLE.applyCloudProgress({xiaochang:{1:4}});t.TITLE.applyCloudProgress({xiaochang:{1:1}});assert.equal(t.TITLE.xiaochangProgress(1),4);
assert.equal(t.TITLE.campaignProgress()[1],true);
console.log(JSON.stringify({ok:true,firstLayerFrames:firstFrames,fifthLayerFrames:fifthFrames,checks:'真实六波/两阶段/锦囊过滤/720边界/伤害/复活/失败/品质/云合并；绘图为记录调用，非截图验收'}));
