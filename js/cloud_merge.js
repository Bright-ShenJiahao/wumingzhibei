// 浏览器和后端共用：按武器UID合并，删除标记胜过旧快照，关卡进度取并集。
(function(root){
  function merge(...profiles){
    const result={items:[],equipped:{},_equipAt:{},_removed:Object.create(null),campaign:{},played:false,migrated:true};
    const items=new Map();
    for(const p of profiles){if(!p||typeof p!=='object')continue;
      result.played ||= !!p.played;
      for(const chapter of ['1','2'])if(p.campaign?.[chapter])result.campaign[chapter]=true;
      for(const chapter of ['1','2']) {
        const floor=Number(p.campaign?.xiaochang?.[chapter]);
        if(Number.isInteger(floor)&&floor>=1&&floor<=5){result.campaign.xiaochang ||= {};result.campaign.xiaochang[chapter]=Math.max(result.campaign.xiaochang[chapter]||0,floor);}
      }
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
