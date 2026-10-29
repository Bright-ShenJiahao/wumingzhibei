// 浏览器和后端共用：按武器UID合并，删除标记胜过旧快照，关卡进度取并集。
(function(root){
  function merge(...profiles){
    const result={items:[],equipped:{},_equipAt:{},_removed:Object.create(null),campaign:{},played:false,migrated:true,wallet:{earned:0,spent:0},fruit:{got:6,used:0},outfit:{hair:0,shirt:0,pants:0,_at:0}};
    const items=new Map();let pityAt=-1,outfitAt=-1,tipAt=-1;
    const count=(v)=>{const n=Number(v);return Number.isInteger(n)&&n>=0?Math.min(1e9,n):0;};
    const part=(v)=>{const n=Number(v);return Number.isInteger(n)&&n>=0&&n<=7?n:0;};
    for(const p of profiles){if(!p||typeof p!=='object')continue;
      const oa=Number(p.outfit?._at)||0;
      if(oa>outfitAt){outfitAt=oa;result.outfit={hair:part(p.outfit?.hair),shirt:part(p.outfit?.shirt),pants:part(p.outfit?.pants),_at:oa};}
      // 神器：拥有取并集（只增不减），装备哪件以最后改动的为准
      if(p.artifacts&&typeof p.artifacts==='object'){result.artifacts ||= {owned:{},eq:'',_at:-1};for(const k of ['feijian'])if(p.artifacts.owned?.[k])result.artifacts.owned[k]=1;const aa=Number(p.artifacts._at)||0;if(aa>result.artifacts._at){result.artifacts._at=aa;result.artifacts.eq=typeof p.artifacts.eq==='string'&&p.artifacts.eq.length<=12?p.artifacts.eq:'';}}
      // 锦囊锁定（花金币买的，长期有效）：以最后改动的那份为准
      const ta=Number(p.tipLocks?._at)||0;
      if(p.tipLocks&&typeof p.tipLocks==='object'&&ta>tipAt){tipAt=ta;result.tipLocks={_at:ta};for(const k of ['gong','ji','shu','shou','zhuan'])if(typeof p.tipLocks[k]==='string'&&p.tipLocks[k].length<=12)result.tipLocks[k]=p.tipLocks[k];}
      result.wallet.earned=Math.max(result.wallet.earned,count(p.wallet?.earned));
      result.wallet.spent=Math.max(result.wallet.spent,count(p.wallet?.spent));
      result.fruit.got=Math.max(result.fruit.got,count(p.fruit?.got));
      result.fruit.used=Math.max(result.fruit.used,count(p.fruit?.used));
      result.played ||= !!p.played;
      for(const chapter of ['1','2'])if(p.campaign?.[chapter])result.campaign[chapter]=true;
      for(const chapter of ['1','2']) {
        const floor=Number(p.campaign?.xiaochang?.[chapter]);
        if(Number.isInteger(floor)&&floor>=1&&floor<=6){result.campaign.xiaochang ||= {};result.campaign.xiaochang[chapter]=Math.max(result.campaign.xiaochang[chapter]||0,floor);}
      }
      // 熔炼保底计数：以最后一次熔炼的那份为准
      if(p.pity&&typeof p.pity==='object'&&(Number(p._pityAt)||0)>pityAt){pityAt=Number(p._pityAt)||0;result.pity={};for(const q of ['0','1','2','3']){const n=Math.floor(Number(p.pity[q])||0);if(n>0)result.pity[q]=Math.min(30,n);}result._pityAt=pityAt;}
      // 武器熟练度：经验只增不减，每种武器取最大值
      for(const [t,n] of Object.entries(p.mastery||{})){const v=Math.min(99999,Math.max(0,Math.floor(Number(n)||0)));if(['staff','hammer','stone','halberd','blade','bow'].includes(t)&&v>0){result.mastery ||= {};result.mastery[t]=Math.max(result.mastery[t]||0,v);}}
      for(const [id,time] of Object.entries(p._removed||{}))result._removed[id]=Math.max(result._removed[id]||0,Number(time)||1);
      for(const item of p.items||[]){if(!item||typeof item.uid!=='string')continue;const old=items.get(item.uid);if(!old||(item._at||0)>(old._at||0))items.set(item.uid,item);}
      for(const slot of ['long','short','ranged'])if(Object.prototype.hasOwnProperty.call(p.equipped||{},slot)){
        const t=Number(p._equipAt?.[slot])||0;
        if(!Object.prototype.hasOwnProperty.call(result.equipped,slot)||t>(result._equipAt[slot]||0)||(t===0&&!result.equipped[slot]&&p.equipped[slot])){
          result.equipped[slot]=p.equipped[slot];result._equipAt[slot]=t;
        }
      }
    }
    result.items=[...items.values()].filter(i=>!result._removed[i.uid]);
    for(const slot of ['long','short','ranged'])if(!result.items.some(i=>i.uid===result.equipped[slot]))result.equipped[slot]=null;
    return result;
  }
  root.CLOUD_MERGE={merge};
})(typeof window==='undefined'?globalThis:window);
