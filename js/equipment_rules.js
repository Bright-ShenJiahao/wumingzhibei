// 前后端共用容量；熔炼预览和结算共用概率，预览不消耗随机数。
(function(root){
  const CAPACITY=50;
  const upgrades={3:[.10,.06,.03,.01,0],4:[.15,.10,.05,.02,0],5:[.20,.15,.08,.03,0]};
  function modes(values){const counts=new Map();for(const v of values)counts.set(v,(counts.get(v)||0)+1);const highest=Math.max(...counts.values());return [...counts].filter(([,n])=>n===highest).map(([v])=>v);}
  function forgePlan(items){
    if(!Array.isArray(items)||items.length<3||items.length>5)return null;
    const types=modes(items.map(i=>i.type)),qualities=modes(items.map(i=>Math.min(4,i.q))),outcomes={};let upgradeChance=0;
    for(const q of qualities){const chance=upgrades[items.length][q],weight=1/qualities.length;outcomes[q]=(outcomes[q]||0)+weight*(1-chance);if(chance)outcomes[q+1]=(outcomes[q+1]||0)+weight*chance;upgradeChance+=weight*chance;}
    return {count:items.length,types,qualities,outcomes,upgradeChance};
  }
  root.EQUIPMENT_RULES={CAPACITY,upgrades,forgePlan};
})(typeof window==='undefined'?globalThis:window);
