// 前后端共用容量；熔炼预览和结算共用概率，预览不消耗随机数。
(function(root){
  const CAPACITY=50;
  const upgrades={3:[.10,.06,.03,.01,0],4:[.15,.10,.05,.02,0],5:[.20,.15,.08,.03,0]};
  // 保底：每档品质分开计数，熔这一档失败一次，下次这一档的升阶概率加一截；升阶成功清零。
  // 放5把时：普通第5次、优良第7次、精致第9次、史诗第14次必升。
  const PITY_STEP=[.20,.15,.12,.08,0];
  const chanceOf=(count,q,pity)=>{const base=upgrades[count][q];return base?Math.min(1,base+PITY_STEP[q]*Math.max(0,Number(pity?.[q])||0)):0;};
  function modes(values){const counts=new Map();for(const v of values)counts.set(v,(counts.get(v)||0)+1);const highest=Math.max(...counts.values());return [...counts].filter(([,n])=>n===highest).map(([v])=>v);}
  function forgePlan(items,pity){
    if(!Array.isArray(items)||items.length<3||items.length>5)return null;
    const types=modes(items.map(i=>i.type)),qualities=modes(items.map(i=>Math.min(4,i.q))),outcomes={};let upgradeChance=0,pityBonus=0;
    for(const q of qualities){const chance=chanceOf(items.length,q,pity),weight=1/qualities.length;pityBonus+=weight*(chance-upgrades[items.length][q]);outcomes[q]=(outcomes[q]||0)+weight*(1-chance);if(chance)outcomes[q+1]=(outcomes[q+1]||0)+weight*chance;upgradeChance+=weight*chance;}
    return {count:items.length,types,qualities,outcomes,upgradeChance,pityBonus};
  }
  root.EQUIPMENT_RULES={CAPACITY,upgrades,PITY_STEP,chanceOf,forgePlan};
})(typeof window==='undefined'?globalThis:window);
