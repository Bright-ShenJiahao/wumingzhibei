// 装备生成参数：概率与效果数值分开保存，方便后续平衡。
(() => {
  const rows = [
    ['sharp','锋锐',10,[5,10,15],'攻击伤害'],['swift','迅捷',8,[4,7,10],'攻击速度'],
    ['reach','延展',8,[6,10,15],'攻击距离／射程'],['critical','精准',6,[3,5,8],'暴击率','pp'],
    ['severity','重创',6,[10,20,30],'暴击伤害','pp'],['guard','护身',8,[3,5,8],'减伤'],
    ['health','强健',10,[5,10,15],'最大生命'],['move','疾行',10,[4,7,10],'移动速度'],
    ['dodge','闪身',3,[3,5,10],'普攻闪避','pp'],['focus','专注',4,[4,7,10],'冷却／蓄力缩减'],
    ['charge','强力',8,[8,14,20],'蓄力伤害'],['hunt','追猎',8,[8,14,20],'对首领增伤'],
    ['troops','当关',10,[5,9,13],'对小兵／精英增伤'],['exploit','乘隙',6,[6,10,15],'对异常敌人增伤'],
    ['victory','乘胜',6,[5,8,12],'击杀后增伤4秒'],['chain','连刃',6,[2,3,4],'同目标每层增伤，最多3层'],
    ['push','猛击',8,[8,12,18],'概率额外击退'],['leech','吸取',3,[8,12,18],'概率回复0.25生命；冷却2秒'],
    ['survive','余生',4,[15,25,35],'击杀概率回复0.5生命；冷却1秒'],
    ['interrupt','震慑',3,[6,10,15],'概率打断可打断施法；冷却3秒'],
    ['slow','迟缓',6,[10,15,20],'20%概率减移速2秒'],['numb','麻痹',6,[8,12,16],'20%概率减攻速2秒'],
    ['blind','遮目',3,[10,15,20],'20%概率致盲2秒；普攻未命中率'],
    ['poison','淬毒',4,[4,6,8],'20%概率中毒；每秒伤害，3秒／2层'],
    ['bleed','流血',4,[6,9,12],'15%概率流血；每秒伤害，2秒／1层'],
    ['burn','点燃',4,[2,3,4],'20%概率点燃；每秒伤害，3秒／3层'],
    ['ice','冻结',3,[10,15,20],'概率积寒；3层冻结，首领6层'],
    ['pierce','贯穿',4,[15,25,35],'概率额外穿透1人，后续50%伤害','%', 'ranged'],
    ['split','分裂',4,[10,15,20],'概率范围分裂25%伤害，最多3人','%', 'melee'],
    ['scatter','散射',3,[12,20,28],'概率随机侧射1支，35%伤害','%', 'ranged'],
    ['repeat','连射',3,[10,15,20],'概率追加射击，50%伤害','%', 'ranged'],
    ['double','双击',3,[10,15,20],'概率追加近战，50%伤害','%', 'melee'],
    ['return','弹回',3,[10,15,20],'概率弹回，返回35%伤害','%', 'ranged'],
  ];
  const positive = Object.fromEntries(rows.map(([id,name,weight,values,desc,unit='%',type]) => [id,{id,name,weight,values,desc,unit,type}]));
  const negative = Object.fromEntries([
    ['blunt','钝刃',10,'攻击伤害'],['heavy','沉重',8,'攻击速度'],['short','短促',10,'距离／射程'],
    ['inaccurate','失准',5,'暴击率','pp'],['weakcrit','轻伤',20,'暴击伤害','pp'],
    ['soft','软手',25,'击退力度'],['fragile','裂甲',10,'受到伤害增加'],
    ['frail','虚弱',10,'最大生命'],['clumsy','笨重',8,'移动速度'],
  ].map(([id,name,max,desc,unit='%'])=>[id,{id,name,max,desc,unit,weight:1}]));
  const special = Object.fromEntries([
    ['favor','如有神助',5,'主动技能5%概率刷新；内部冷却30秒'],
    ['revival','神佑复生',3,'每次出征复活一次，回复30%生命，无敌2秒'],
    ['thunder','雷霆万钧',7,'8%概率随机敌方位置范围落雷；半径45，60%伤害，冷却2秒'],
    ['spirit','战意',10,'主攻击命中叠层，每层伤害／攻速+1%，最多10层；5秒未命中清空'],
    ['berserk','狂战士',10,'低于50%生命渐增伤，20%生命时最高+20%'],
    ['tenacity','坚韧',10,'低于50%生命渐减伤，20%生命时最高15%'],
    ['execute','斩杀',10,'对生命低于30%的敌人增伤20%'],
  ].map(([id,name,weight,desc])=>[id,{id,name,weight,desc}]));
  const qualities = [
    {name:'普通',color:'#d4cdbf',count:0}, {name:'优良',color:'#6eacf0',count:1},
    {name:'精致',color:'#81bd78',count:1,a:true}, {name:'极品',color:'#ed8172',count:2},
    {name:'传说',color:'#c190e5',count:2,a:true}, {name:'天工',color:'#edc465',count:2,a:true},
  ];
  const names = {staff:'棍子',halberd:'长戟',hammer:'锤子',blade:'大刀',stone:'石子',bow:'汉弓'};
  const slots = {staff:'long',halberd:'long',hammer:'short',blade:'short',stone:'ranged',bow:'ranged'};
  const templates = ['{人}曾用的','{人}嫌不顺手的','{人}一直没舍得扔的','{人}借走忘还的','{人}找了三天的','{人}醉后送人的','{人}偷偷卖掉的','{人}赢来的','{人}抵出去的','据说{人}用过的','疑似{人}遗失的','刻着{人}名字的','仿照{人}那把做的','和{人}那把很像的','{人}撤退时落下的','{人}亲兵从泥里拔出的','跟着{人}淋过大雨的','{人}出征前换下的'];
  const personal = {
    曹操:['曹操头疼时拿来敲桌的','让曹操头疼的'],刘备:['刘备再三叮嘱要还的','刘备送出后又借回的'],孙权:['孙权让人好好保管的'],
    吕布:['吕布嫌卖价太低的','吕布换老板得到的'],赵云:['赵云擦得一尘不染的','赵云替人保管的'],典韦:['典韦嫌太轻的'],关羽:['关羽看了一眼没说话的'],马超:['马超试过后点头的'],
    张飞:['张飞喝高后落下的','张飞找遍军营没找到的'],黄忠:['黄忠说还能再用十年的'],许褚:['许褚掂过分量的'],孙策:['孙策打赌赢来的'],太史慈:['太史慈答应替人送回的'],
    夏侯惇:['夏侯惇让亲兵收好的'],夏侯渊:['夏侯渊赶路时落下的'],张辽:['张辽巡营时收缴的'],张郃:['张郃仔细挑过的'],徐晃:['徐晃按军规登记过的'],庞德:['庞德出征前磨过的'],甘宁:['甘宁拿来抵酒钱的'],周泰:['周泰修过三回的'],魏延:['魏延说另有妙用的'],张绣:['张绣练手时用过的'],颜良:['颜良让人抬回来的'],文丑:['文丑认错成自己那把的'],邓艾:['邓艾带着翻过山的'],姜维:['姜维反复修补过的'],诸葛亮:['诸葛亮向天借来的'],庞统:['庞统随手搁在门后的'],周瑜:['周瑜嫌摆得不整齐的'],鲁肃:['鲁肃替人垫钱赎回的'],郭嘉:['郭嘉说迟早用得上的'],荀彧:['荀彧派人登记入库的'],贾诩:['贾诩不肯解释来历的'],司马懿:['司马懿一直没拿出来的'],
  };
  const pick = arr => arr[Math.floor(Math.random()*arr.length)];
  function weighted(entries) {
    let roll = Math.random()*entries.reduce((n,e)=>n+e.weight,0);
    for(const entry of entries) if((roll-=entry.weight)<0) return entry;
    return entries[entries.length-1];
  }
  function inscription(person) {
    if(!person && Math.random()>=.2) return '';
    person ||= pick(Object.keys(personal));
    return personal[person] && Math.random()<.5 ? pick(personal[person]) : pick(templates).replace('{人}',person);
  }
  const mainWeights = {boss:[12,42,26,15,5],elite:[36,40,17,6,1],grunt:[65,25,8,1.8,.2]};
  function generate(type,source='boss',person='',quality,qualityWeights) {
    const weights = qualityWeights || (source==='elite'?[35,40,17,6,2]:source==='grunt'?[65,25,8,1.5,.5]:[10,40,25,15,10]);
    let q = quality == null ? weighted(weights.map((weight,id)=>({weight,id}))).id : Math.min(4,quality);
    const specialId = Math.random()<.05 ? weighted(Object.values(special)).id : null;
    if(q===4 && specialId) q=5;
    const affixes=[];
    for(let i=0;i<qualities[q].count;i++) {
      const def=weighted(Object.values(positive).filter(e=>!affixes.some(a=>a.id===e.id)));
      const tier=qualities[q].a?2:weighted([{id:0,weight:40},{id:1,weight:35},{id:2,weight:25}]).id;
      affixes.push({id:def.id,tier,value:def.values[tier]});
    }
    const neg=q===1 && Math.random()<.3?weighted(Object.values(negative)):null;
    return {uid:typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),type,q,affixes,negative:neg?{id:neg.id,value:1+Math.floor(Math.random()*neg.max)}:null,special:specialId,inscription:inscription(person),locked:false};
  }
  const applicable=(a,type)=>!positive[a.id]?.type || (positive[a.id].type==='ranged')===(slots[type]==='ranged');
  function label(item) {return qualities[item.q].name+'·'+(item.affixes[0]?positive[item.affixes[0].id].name:'')+names[item.type];}
  function lines(item) {
    const out=item.affixes.map(a=>{const d=positive[a.id];return `${d.name} ${['初级','中级','高级'][a.tier]}：${d.desc} ${a.value}${d.unit==='pp'?'个百分点':'%'}${applicable(a,item.type)?'':'（当前武器不生效）'}`;});
    if(item.negative){const n=item.negative,d=negative[n.id];out.push(`${d.name}：${d.desc}${n.id==='fragile'?'+':'－'}${n.value}${d.unit==='pp'?'个百分点':'%'}`);}
    if(item.special)out.push('特殊·'+special[item.special].name+'：'+special[item.special].desc);
    if(item.inscription)out.push('「'+item.inscription+'」');
    return out;
  }
  function stats(item){
    const v={};for(const a of item.affixes)if(applicable(a,item.type))v[a.id]=a.value/100;
    if(item.negative)v[item.negative.id]=-item.negative.value/100;
    const n=k=>v[k]||0,cap=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
    return {damage:Math.max(.1,1+n('sharp')+n('blunt')),speed:cap(1+n('swift')+n('heavy'),.2,1.4),range:cap(1+n('reach')+n('short'),.2,1.35),crit:cap(.01+n('critical')+n('inaccurate'),0,.35),critDamage:cap(1.5+n('severity')+n('weakcrit'),1,2.5),health:10*(1+cap(n('health')+n('frail'),-.8,1)),guard:cap(n('guard')+n('fragile'),-1,.3),move:cap(1+n('move')+n('clumsy'),.2,1.3),dodge:cap(n('dodge'),0,.2),focus:cap(n('focus'),0,.3)};
  }
  window.AFFIX_DATA={positive,negative,special,qualities,names,slots,mainWeights,generate,label,lines,stats,applicable,pick};
})();
