// 第二章「黄巾决战」关卡规划。已从章节选择开放；第五战祭台地图已接入，张角 Boss 待完成。
(() => {
  const MAP = 'battlefield';
  const BOSS_MAP = 'altar';
  const unlocked = false;                         // 正常关闭；仅 ?debug 开发者模式可进入
  const debugMode = /[?&]debug(?:=|&|$)/.test(location.search);
  let selectedRoute = null;
  const battles = Object.freeze([
    Object.freeze({
      number: 1, title: '曹军入阵', encounter: '黄巾正规军后翼',
      units: ['yellow-heavy', 'yellow-priest', 'yellow-slinger'], enemyCount: 9,
      // 先让玩家读懂正面大刀兵，再逐步展开两翼与远程支援；左右投石手错开发射。
      waves: [
        Object.freeze({ id: 'center-guard', trigger: 'battle-start', enemies: [
          Object.freeze({ unit: 'yellow-heavy', count: 2, formation: 'front-center' }),
        ] }),
        Object.freeze({ id: 'flanking-reserve', trigger: 'first-center-enemy-defeated', enemies: [
          Object.freeze({ unit: 'yellow-heavy', count: 2, formation: 'rear-left' }),
          Object.freeze({ unit: 'yellow-heavy', count: 2, formation: 'rear-right' }),
        ] }),
        Object.freeze({ id: 'ranged-support', trigger: 'flanking-reserve-entered', delay: 1.2, enemies: [
          Object.freeze({ unit: 'yellow-priest', count: 1, formation: 'rear-center' }),
          Object.freeze({ unit: 'yellow-slinger', count: 1, formation: 'rear-left', attackDelay: 0 }),
          Object.freeze({ unit: 'yellow-slinger', count: 1, formation: 'rear-right', attackDelay: 0.8 }),
        ] }),
      ],
      map: MAP, status: 'locked',
    }),
    Object.freeze({ number: 2, title: '黄巾后阵', encounter: '四名盾兵、四名枪兵、三台固定投石车', units: ['yellow-shield', 'yellow-spear', 'yellow-catapult'], enemyCount: 11, map: MAP, status: 'locked' }),
    Object.freeze({ number: 3, title: '正面突击：追击张梁', units: ['yellow-heavy', 'yellow-spear', 'zhang-liang'], map: MAP, route: 'zhang-liang', status: 'locked' }),
    Object.freeze({ number: 4, title: '迂回包抄：追击张宝', units: ['yellow-shield', 'yellow-spear', 'zhang-bao'], map: MAP, route: 'zhang-bao', status: 'locked' }),
    Object.freeze({ number: 5, title: '祭台决战', map: BOSS_MAP, status: 'locked' }),
  ]);
  const routes = Object.freeze([
    Object.freeze({ id: 'zhang-liang', label: '正面突击：追击张梁', battle: 3 }),
    Object.freeze({ id: 'zhang-bao', label: '迂回包抄：追击张宝', battle: 4 }),
  ]);
  // 第二章专属兵种资料。整章仍锁定；战斗素材已接入独立的第二章战斗流程。
  const units = Object.freeze([
    Object.freeze({ id: 'yellow-heavy', name: '黄巾大刀兵', sprite: 'yellow_heavy', kind: 'heavy-melee', role: '慢速大范围劈砍；明显蓄力后攻击，适合正面突击路线。', actions: ['idle', 'walk1', 'walk2', 'wind', 'strike', 'hurt', 'fly1', 'fly2', 'down', 'land'], firstBattle: 1 }),
    Object.freeze({ id: 'yellow-shield', name: '黄巾盾兵', sprite: 'yellow_shield', kind: 'shield-frontline', role: '持大盾掩护后排；正面格挡远程攻击，侧后方可突破。', actions: ['idle', 'walk1', 'walk2', 'wind', 'strike', 'hurt', 'fly1', 'fly2', 'down', 'land'], firstBattle: 2 }),
    Object.freeze({ id: 'yellow-spear', name: '黄巾枪兵', sprite: 'yellow_spear', kind: 'long-melee', role: '预备后直线突刺，攻击距离较长；横向走位躲开后反击。', actions: ['idle', 'walk1', 'walk2', 'wind', 'strike', 'hurt', 'fly1', 'fly2', 'down', 'land'], firstBattle: 3 }),
    Object.freeze({ id: 'yellow-catapult', name: '投石车', sprite: 'yellow_catapult', kind: 'siege', role: '固定远程攻城器械；慢速向左投掷燃烧石块，落点预警后形成大范围火场。', actions: ['idle', 'load', 'fire', 'recoil', 'break', 'wreck'], firstBattle: 2 }),
    Object.freeze({ id: 'zhang-liang', name: '人公将军·张梁', sprite: 'zhang_liang', kind: 'boss', role: '正面突击路线首领；重型大刀近战。', actions: ['idle', 'walk1', 'walk2', 'wind', 'strike', 'hurt', 'fly1', 'fly2', 'down', 'land'], firstBattle: 3 }),
    Object.freeze({ id: 'zhang-bao', name: '地公将军·张宝', sprite: 'zhang_bao', kind: 'boss', role: '迂回包抄路线首领；快速近战并压迫玩家走位。', actions: ['idle', 'walk1', 'walk2', 'wind', 'strike', 'hurt', 'fly1', 'fly2', 'down', 'land'], firstBattle: 4 }),
    Object.freeze({ id: 'yellow-priest', name: '黄巾方士', sprite: 'priest', kind: 'support', role: '沿用第一章方士；在后排为黄巾兵提供支援。', firstBattle: 1 }),
    Object.freeze({ id: 'yellow-slinger', name: '黄巾投石手', sprite: 'slinger', kind: 'ranged', role: '沿用第一章投石手；左右错开发射，避免同时压中玩家。', firstBattle: 1 }),
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
    units,
    routeChoiceAfter: 2,
    routes,
    canEnter: () => unlocked || debugMode,
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
    mapAsset: key => typeof ASSETS !== 'undefined' && ASSETS.chapter2 ? ASSETS.chapter2[key] || null : null,
  });
})();
