// 第二章「黄巾决战」关卡规划。当前整章锁定，地图与分支先随版本打包，玩家不能进入。
(() => {
  const MAP = 'battlefield';
  const unlocked = false;
  let selectedRoute = null;
  const battles = Object.freeze([
    Object.freeze({ number: 1, title: '曹军入阵', encounter: '黄巾正规军后翼', map: MAP, status: 'locked' }),
    Object.freeze({ number: 2, title: '黄巾后阵', encounter: '远程兵种为主', map: MAP, status: 'locked' }),
    Object.freeze({ number: 3, title: '正面突击：追击张梁', map: MAP, route: 'zhang-liang', status: 'locked' }),
    Object.freeze({ number: 4, title: '迂回包抄：追击张宝', map: MAP, route: 'zhang-bao', status: 'locked' }),
    Object.freeze({ number: 5, title: '祭台决战', map: null, status: 'map-pending' }),
  ]);
  const routes = Object.freeze([
    Object.freeze({ id: 'zhang-liang', label: '正面突击：追击张梁', battle: 3 }),
    Object.freeze({ id: 'zhang-bao', label: '迂回包抄：追击张宝', battle: 4 }),
  ]);
  const completed = new Set();
  const canEnterBattle = number => {
    if (!unlocked) return false;
    if (number === 1) return true;
    if (number === 2) return completed.has(1);
    if (number === 3) return completed.has(2) && selectedRoute === 'zhang-liang';
    if (number === 4) return completed.has(2) && selectedRoute === 'zhang-bao';
    if (number === 5) return selectedRoute === 'zhang-liang' ? completed.has(3) : selectedRoute === 'zhang-bao' && completed.has(4);
    return false;
  };

  window.CHAPTER2 = Object.freeze({
    id: 'yellow-turban-final',
    title: '黄巾决战',
    unlocked,
    battles,
    routeChoiceAfter: 2,
    routes,
    canEnter: () => unlocked,
    canEnterBattle,
    canChooseRoute: () => unlocked && completed.has(2) && selectedRoute === null,
    completeBattle: number => {
      if (!canEnterBattle(number)) return false;
      completed.add(number);
      return true;
    },
    // 未来开放时同一轮只能选一条追击路线；第三战、第四战互斥。
    chooseRoute: id => {
      if (!unlocked || !canChooseRoute() || !routes.some(route => route.id === id)) return false;
      selectedRoute = id;
      return true;
    },
    selectedRoute: () => selectedRoute,
    mapAsset: key => key === MAP && typeof ASSETS !== 'undefined' ? ASSETS.chapter2.battlefield : null,
  });
})();
