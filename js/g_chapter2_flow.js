// 第二章流程：布景、波次表、开战/转场/选路（2026-10-31 从 game.js 原样拆出，逻辑不变）
// 依赖 game.js 的全局变量，只在运行时调用；本文件加载时不访问 game.js 的变量。
function addChapter2Props(battle = 1) {
  // 每战重新摆放；jumo 挡路可打碎，其余新道具与旗帜只作装饰。
  if (battle === 1 || battle === 6) props = props.filter(p => !p.chapter2);
  // 旗子插在场地最后排（贴着上边缘，像背景的一部分）；其他道具分散在前 120～420 的范围，留出中间的通道
  const T = M.top, B = M.bot, C = (M.top + M.bot) / 2;
  const layouts = {
    1: [['jumo_v', 110, C + 30], ['sacks', 260, T + 20], ['crate', 380, B - 12], ['flag_y', 200, T + 4]],
    2: [['debris', 150, B - 15], ['rack', 300, T + 18], ['jumo_vs', 120, C - 30], ['flag_y', 240, T + 4]],
    3: [['stones', 140, T + 22], ['brazier', 300, B - 12], ['crate', 420, C + 30]],
    4: [['jumo_v', 130, C + 20], ['rack', 330, B - 14], ['flag_y', 230, T + 4]],   // 黄旗打落给锦囊； 「人」字旗改由张梁出场时亲手插下（CH2B）
    5: [['sacks', 300, T + 22], ['stones', 140, B - 14]],   // 「地」字旗改由张宝出场时亲手插下（CH2B）
  };
  if (battle === 6) { addAltarProps(); return; }
  const place = layouts[battle] || [];
  for (const [g, dx, y] of place) {
    const meta = ASSETS.props[g];
    if (!meta) continue;
    const [, pw, ph] = meta;
    const solid = g.startsWith('jumo') || g === 'sacks' || g === 'crate' || g === 'rack';
    const oldProp = g === 'sacks' || g === 'crate' || g === 'rack';
    const vert = g.startsWith('jumo_v');   // 拒马竖着摆：顺着场地深度方向拦路（jumo_v 长 / jumo_vs 短）
    const vd = g === 'jumo_v' ? 40 : 28;
    props.push({ g, x: battle === 6 ? dx : hero.x + dx, y: vert ? y + vd / 2 : y, solid, broken: false,
      hp: g.startsWith('flag_') ? 2 : 3, hitT: 0, sc: 1, vert, d: vert ? vd : 0,
      w: vert ? 18 : pw * (oldProp ? .75 : 1), h: ph, chapter2: true, back: g.startsWith('flag') });
  }
}

// 祭台战（第六战）：背景图 2000×849 画成 300 高 → 宽 ALTAR_W；坐标都按这张图量
const ALTAR_W = Math.round(300 * 2000 / 849), ALTAR_C = { x: 353, y: 212 };
const ALTAR_COFFIN = { x: 117, y: 100 };   // 背景图里画好的开口棺材（棺口约在 y-28）   // 棺材放在祭台台面左半边、靠里一点（用户：别压在台阶口和台面前沿上）   // 圆形石坪中心
// 之后张角开场要用的：'coffin_open' 炸开的棺材、'coffin_lid' 飞出去的棺盖
function addAltarProps() {
  const P = (g, x, y, o) => { const [, w, h] = ASSETS.props[g] || [0, 10, 10]; props.push(Object.assign({ g, x, y, w, h, sc: 1, hitT: 0, hp: 0, solid: false, broken: false, chapter2: true }, o)); };
  P('bagua', ALTAR_C.x, ALTAR_C.y + 40, { back: true, ground: true, dw: 300, dh: 82, alpha: .82 });   // 八卦阵：贴地，画在人物下面
   // 正面棺材（用户补图），按 meta 尺寸画   // 底边落在祭台台面上（之前飘在台面后沿）
  P('flag_huang', 276, 127, { back: true, flip: true });                // 「黄天当立」，和右边的苍天旗一左一右
  P('flag_cang', 478, 124, { back: true });                 // 「苍天已死」血字旗，插在法台右侧                                  // 棺材摆在左侧祭台台面上
  // 八盏符灯立在八个卦位上（椭圆），打灭一盏少一盏；全灭后张角的法术阶段直接结束（张角接入后用 altarLampsLeft()）
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4 - Math.PI / 2;
    P('fudeng', Math.round(ALTAR_C.x + Math.cos(a) * 138), Math.round(ALTAR_C.y + Math.sin(a) * 36), { hp: 3, solid: true, w: 10, lamp: true });
  }
}
// 张角预览（战斗逻辑未接入前）：法台上浮空施法 / 降雷交替；地上站一个待机的，方便和主角比大小
const ZJ_HI = 1.9;   // 张角像素图比普通角色细 1.9 倍（用户嫌像素太糙），所以绘制缩放要除掉
const ZJ_SCALE = 1.35 / ZJ_HI;   // 下台决斗的张角：和法台上看起来一样大（法台那几帧原图本来就画得大）
const ALTAR_STAGE = { x: 353, y: 91 };   // 法台顶上平台（背景图上量的）
function drawZhangJiaoPreview() {
  const t = performance.now() / 1000, cyc = t % 3.2, fr = cyc < 2 ? 'float' : 'thunder';
  drawChar('zhang_jiao', fr, ALTAR_STAGE.x, ALTAR_STAGE.y - 4 + Math.sin(t * 2.2) * 2.5, hero.x < ALTAR_STAGE.x, 1, false, 1.12 / ZJ_HI);
  const gx = ALTAR_C.x + 175, gy = ALTAR_C.y + 30, walk = ['idle', 'wind', 'strike', 'idle'][Math.floor(t / .8) % 4];
  drawChar('zhang_jiao', walk, gx, gy, hero.x < gx, 1, false, ZJ_SCALE);
}
const altarLampsLeft = () => props.filter(p => p.lamp && p.g === 'fudeng').length;
// 第二章每战波次：每项是一个 spawn 函数，保持现有 spawn / 单位名。
const CHAPTER2_WAVES = {
  1: [
    () => { spawn('yellow-heavy', hero.x + 190, M.top + 28); spawn('yellow-heavy', hero.x + 215, M.bot - 23); spawn('archer', hero.x + 330, (M.top + M.bot) / 2); },
    () => { spawn('yellow-heavy', hero.x + 230, M.top + 20); spawn('yellow-heavy', hero.x + 230, M.bot - 20); spawn('slinger', hero.x + 300, M.top + 20); spawn('slinger', hero.x + 320, M.bot - 20); },
    () => { spawn('yellow-heavy', hero.x + 190, (M.top + M.bot) / 2 - 20); spawn('yellow-heavy', hero.x + 190, (M.top + M.bot) / 2 + 20); spawn('priest', hero.x + 340, (M.top + M.bot) / 2 - 16); spawn('priest', hero.x + 340, (M.top + M.bot) / 2 + 16); },
  ],
  2: [
    () => { spawn('yellow-shield', hero.x + 190, (M.top + M.bot) / 2 - 20); spawn('yellow-shield', hero.x + 190, (M.top + M.bot) / 2 + 20); spawn('archer', hero.x + 310, (M.top + M.bot) / 2 - 20); spawn('archer', hero.x + 310, (M.top + M.bot) / 2 + 20); },
    () => { spawn('yellow-shield', hero.x + 190, M.top + 28); spawn('yellow-shield', hero.x + 190, M.bot - 28); spawn('yellow-spear', hero.x + 250, (M.top + M.bot) / 2 - 18); spawn('yellow-spear', hero.x + 250, (M.top + M.bot) / 2 + 18); },
    () => { spawn('yellow-shield', hero.x + 190, (M.top + M.bot) / 2); spawn('yellow-heavy', hero.x + 210, M.top + 24); spawn('archer', hero.x + 310, (M.top + M.bot) / 2 - 20); spawn('archer', hero.x + 310, (M.top + M.bot) / 2 + 20); },
  ],
  3: [
    () => { spawn('yellow-shield', hero.x + 180, (M.top + M.bot) / 2 - 20); spawn('yellow-shield', hero.x + 180, (M.top + M.bot) / 2 + 20); spawn('archer', hero.x + 290, (M.top + M.bot) / 2 - 20); spawn('archer', hero.x + 290, (M.top + M.bot) / 2 + 20); },
    () => {
      // 投石车阵刷在主角往右一屏：先把锁屏右边界往右推一屏，玩家要往前推进才碰到拒马墙
      const vw = viewW(), R = Math.min(M.W, hero.x + vw * 1.6);
      lockR = R; say('投石车阵就在前方！往右推进 →', 2.5);
      for (let i = 0; i < 5; i++) {
        spawn('yellow-catapult', R - 40 + i * 6, M.top + 10 + (M.bot - M.top - 20) * i / 4);
        const z = zs[zs.length - 1]; z.f = -1; z.static = true; z.cd = [2.4, 3.5, 4.6, 5.8, 7.0][i] + 1.5; z.catapultIndex = i;
      }
      spawn('yellow-shield', R - 260, (M.top + M.bot) / 2 - 20);
      spawn('yellow-shield', R - 260, (M.top + M.bot) / 2 + 20);
      spawn('yellow-heavy', R - 230, M.top + 18); spawn('yellow-heavy', R - 230, M.bot - 18);   // 守车大刀兵
    },
  ],
  4: [
    () => { spawn('yellow-heavy', hero.x + 190, (M.top + M.bot) / 2 - 24); spawn('yellow-heavy', hero.x + 205, (M.top + M.bot) / 2); spawn('yellow-heavy', hero.x + 190, (M.top + M.bot) / 2 + 24); spawn('yellow-spear', hero.x + 270, (M.top + M.bot) / 2); },
    () => { for (let i = 0; i < 3; i++) spawn('yellow-spear', hero.x + 200 + i * 28, (M.top + M.bot) / 2); spawn('yellow-heavy', hero.x + 235, M.top + 22); spawn('yellow-heavy', hero.x + 235, M.bot - 22); },
    () => { spawn('zhang_liang', hero.x + 280, (M.top + M.bot) / 2); const boss = zs[zs.length - 1]; boss.f = -1; boss.cd = 1.4; boss.bossLabel = TYPES.zhang_liang.name; spawn('yellow-heavy', hero.x + 210, M.top + 24); spawn('yellow-spear', hero.x + 220, M.bot - 20); },
  ],
  5: [
    () => { for (const y of [M.top + 18, (M.top + M.bot) / 2, M.bot - 18]) spawn('yellow-shield', hero.x + 190, y); spawn('archer', hero.x + 310, (M.top + M.bot) / 2 - 20); spawn('archer', hero.x + 310, (M.top + M.bot) / 2 + 20); },
    () => { spawn('yellow-shield', hero.x + 190, M.top + 24); spawn('yellow-shield', hero.x + 190, M.bot - 24); spawn('priest', hero.x + 330, M.top + 22); spawn('priest', hero.x + 330, (M.top + M.bot) / 2); spawn('priest', hero.x + 330, M.bot - 22); },
    () => { spawn('zhang_bao', hero.x + 280, (M.top + M.bot) / 2); const boss = zs[zs.length - 1]; boss.f = -1; boss.cd = 1.4; boss.bossLabel = TYPES.zhang_bao.name; spawn('yellow-shield', hero.x + 200, (M.top + M.bot) / 2 - 22); spawn('priest', hero.x + 320, (M.top + M.bot) / 2 + 22); },
  ],
  6: [],
};
const CHAPTER2_TITLES = ['', '曹军入阵', '盾阵', '投石车阵', '追击张梁', '追击张宝', '祭台决战'];

function prepareChapter2Run(showOpening, battle = 1) {
  if (window.TITLE && TITLE.skip) TITLE.skip();
  if (window.ROOM && ROOM.skip) ROOM.skip();
  reset();
  M.top = 190;   // 第二章前景栅栏更低：人物脚底不能走进栅栏和营帐
  M.W = 3600;
  props = [];
  chapter2Run = { battle: 1, wave: 0, mode: showOpening ? 'intro' : 'fight', nextAt: 0, route: null };
  const topTitle = document.querySelector('#top b');
  if (topTitle) topTitle.textContent = '无名之辈 · 第二章：黄巾决战';
  tutorialQueue = [];   // 操作 / 武器 / 蓄力提示只在第一章出现
  hero.x = 60; hero.y = (M.top + M.bot) / 2; hero.f = 1; hero.hp = maxHeroHp();
  if (showOpening && window.CHAPTER2_INTRO) CHAPTER2_INTRO.start(() => startChapter2Battle(1));
  else startChapter2Battle(battle);
}
// 加载第二章素材期间 window.CHAPTER_LOADING=2，BGM 据此直接进第二章鼓乐，不会先响第一章的曲子。
function loadChapter2(showOpening, battle) {
  window.CHAPTER_LOADING = 2;
  flushLoads();
  Promise.all([ensureAssets('core', { silent: true }), ensureAssets('chapter2', { label: '正在加载第二章' })]).then(() => { /* 共用的小兵图也要下完 */ prepareChapter2Run(showOpening, battle); window.CHAPTER_LOADING = 0; });
}
function startChapter2Debug(battle) { loadChapter2(false, battle); }   // 开发者直跳：素材加载完再进指定的那一战
// 正式入口：播放第二章开场对白后开始第一战；开发者直跳仍可跳过开场。
function startChapter2() { loadChapter2(true); }
function startChapter2Battle(number, walkIn = false) {
  flushLoads();
  if (window.SFX && SFX.preloadVoices) SFX.preloadVoices(['caocao_', 'zl_', 'zb_', 'zj_']);   // 第二章语音进来才下
  if (window.GEAR) GEAR.collectDrops();
  M.W = number === 6 ? Math.max(ALTAR_W, Math.ceil(viewW())) : 8000;   // 战一到战五在同一片营地里一路往右走；祭台战就一屏
  M.top = number === 6 ? 150 : 190;   // 祭台石坪更宽，能走的地面往上放宽，留出八卦阵的位置
  chapter2Run.battle = number; chapter2Run.wave = 0; chapter2Run.mode = 'fight';
  if (number === 6) { spawnDrop(hero.x + 50, hero.y, 'leg'); drops.slice(-1).forEach(d => d.life = 60); }   // 用户定（难度评估后）：张角战开场只给一个鸡腿   // 张角战开打前不回满，地上摆食物（烤乳猪+鸡腿+包子，共 7 血）
  chapter2Run.nextAt = 0; chapter2Run.spawned = true; chapter2Run.nextBattle = null;
  enemySkillFx = []; zs.length = 0; shots.length = 0; eshots.length = 0; fires.length = 0; if (window.CH2B) CH2B.reset();
  if (!walkIn) { hero.st = 'idle'; hero.t = 0; hero.atk = null; hero.vx = 0; }
  hero.inv = Math.max(hero.inv || 0, .8);
  if (number === 6) { hero.x = Math.max(40, (M.W - viewW()) / 2 + 40); hero.y = (M.top + M.bot) / 2 + 20; }
  // 每战锁定一个屏幕：以开战时镜头的位置为准，左右都不能离开这一屏（祭台战镜头居中）
  const camX = number === 6 ? Math.max(0, (M.W - viewW()) / 2) : Math.max(0, Math.min(M.W - viewW(), hero.x - viewW() * (walkIn ? .4 : .28)));
  arenaL = camX; lockR = Math.min(M.W, camX + viewW()); clearAt = 0;
  addChapter2Props(number);
  if (number === 6) {
    if (window.ZJ) ZJ.start();
  } else {
    const waves = CHAPTER2_WAVES[number] || [];
    const begin = () => { if (waves[0]) { waves[0](); fitChapter2Wave(); applyCh2Elites(number, 0); }
      say(`第${['', '一', '二', '三', '四', '五', '六'][number]}战：${CHAPTER2_TITLES[number]}`, 3.5); };
    if (number === 1 && !walkIn && window.CH2OPEN) CH2OPEN.start(begin);   // 入场：旁白大字 + 曹操号令，再开打
    else begin();
  }
  if (!walkIn) cam.x = number === 6 ? camX : Math.max(0, Math.min(M.W - viewW(), hero.x - viewW() * .28));   // 走进下一战时镜头不跳
}
// 出怪位置收进当前这一屏（屏幕窄时，后排的弓手、方士、投石车会被挤到屏外）
function fitChapter2Wave() {
  if (!(lockR < Infinity)) return;
  for (const z of zs) if (!z.dead && z.x > lockR - 16) z.x = lockR - 16 - (z.static ? (z.catapultIndex || 0) * 6 : rnd(0, 18));
  if(chapter2Run.battle===3&&chapter2Run.wave===1&&!props.some(p=>p.siegeWall)){
    const carts=zs.filter(z=>!z.dead&&z.type==='yellow-catapult');
    if(carts.length){const right=Math.min(...carts.map(z=>z.x))-40,meta=ASSETS.props.jumo_v;
      // 三道竖排拒马墙，每道留一个约 24 宽的缺口，缺口位置错开（下 / 上 / 中）
      const span=M.bot-M.top,gap=24,seg=(span-gap)/2;
      [[0,2],[1,0],[2,1]].forEach(([col,gi])=>{const x=right-col*45;
        // gi=0 缺口在上，1 在中，2 在下；剩下的两段各成一个道具
        const segs=gi===0?[[M.top+gap+seg*2,seg],[M.top+gap+seg,seg]]:gi===2?[[M.top+seg*2,seg],[M.top+seg,seg]]:[[M.bot,seg],[M.top+seg,seg]];
        for(const [y,d] of segs)props.push({g:'jumo_v',x,y,d,vert:true,w:18,h:meta[2],sc:1,hp:3,hitT:0,solid:true,broken:false,chapter2:true,siegeWall:true});});
      zs.filter(z=>!z.dead&&z.type==='yellow-shield').forEach((z,i)=>{z.x=right-90-30;z.y=M.top+(M.bot-M.top)*(i+1)/3;z.guard={x:z.x,y:z.y};});
      zs.filter(z=>!z.dead&&z.type==='yellow-heavy').forEach((z,i)=>{z.x=right-90-55;z.y=M.top+(M.bot-M.top)*(i?.85:.15);z.guard={x:z.x,y:z.y};});   // 2 盾 2 刀固定守在拒马墙前
      if(!zs.some(z=>z.siegeArcher))for(let i=0;i<3;i++){spawn('archer',right+18,M.top+(M.bot-M.top)*(i+1)/4);const a=zs[zs.length-1];a.siegeArcher=true;a.f=-1;a.guard={x:a.x,y:a.y};}   // 用户定：拒马墙后 3 个弓箭手守着投石车
    }
  }
}
function chapter2Waves() {
  if (!chapter2Run) return;
  // 清完一战：和第一章一样往右走，走过关口才开始下一战
  if (chapter2Run.mode === 'walk') { if (hero.x >= chapter2Run.walkGate) { if (chapter2Run.nextBattle === 6) { chapter2Run.mode = 'transition'; chapter2Run.nextAt = gameT; } else startChapter2Battle(chapter2Run.nextBattle, true); } return; }
  if (chapter2Run.mode === 'transition' && gameT >= chapter2Run.nextAt) {
    // 战四/战五掉的大刀、汉弓：转场去祭台会换地图，没捡的自动收下，避免掉在够不着的地方
    for (const d of drops) if (d.k === 'weapon' && d.weapon && !d.item && !d.got && window.TITLE && TITLE.grantWeapon && TITLE.grantWeapon(d.weapon, false)) { d.got = 1; say(`已获得${d.weapon === 'blade' ? '大刀' : '汉弓'}，存入武器仓库。`, 3); }
    startChapter2Battle(chapter2Run.nextBattle || chapter2Run.battle + 1); return;
  }
  if (chapter2Run.mode === 'bowgift') { if (gameT >= chapter2Run.nextAt) { chapter2Run.mode = 'choice'; msgT = 0; } return; }   // 曹操赏完弓再弹选路
  if (chapter2Run.mode === 'clearing' && gameT >= chapter2Run.nextAt) {
    const battle = chapter2Run.battle, waves = CHAPTER2_WAVES[battle] || [];
    if (chapter2Run.wave < waves.length - 1) {
      chapter2Run.wave++; chapter2Run.mode = 'fight';
      waves[chapter2Run.wave](); fitChapter2Wave(); applyCh2Elites(battle, chapter2Run.wave);
      return;
    }
    if (window.CHAPTER2 && CHAPTER2.completeBattle) CHAPTER2.completeBattle(battle);
    // 战一到战五：清场后先抽一次锦囊；锦囊关闭后下一帧继续转场/选路。
    if (battle >= 1 && battle <= 5 && window.ROGUE && !chapter2Run['card' + battle]) {
      chapter2Run['card' + battle] = true; ROGUE.offer(); return;
    }
    if (battle === 3) {
      // 曹操赏汉弓（还没有的话），后半程就能用上
      if (!window.TITLE || !TITLE.ownsWeapon || !TITLE.ownsWeapon('bow')) { spawnWeaponDrop('bow', hero.x + 24, hero.y); if (window.CH2OPEN) CH2OPEN.bark('投石车阵已破，好身手！这张汉弓赏你——后面用得上！', 2.6); chapter2Run.mode = 'bowgift'; chapter2Run.nextAt = gameT + 2.9; return; }
      chapter2Run.mode = 'choice';
      msgT = 0; return;
    }
    if (battle === 4) {
      if (!window.TITLE || !TITLE.ownsWeapon || !TITLE.ownsWeapon('blade')) spawnWeaponDrop('blade', hero.x + 24, hero.y);
      chapter2Run.nextBattle = 6;
    } else if (battle === 5) {
      if (!window.TITLE || !TITLE.ownsWeapon || !TITLE.ownsWeapon('blade')) spawnWeaponDrop('blade', hero.x + 24, hero.y);   // 两条路都掉大刀；汉弓改由战三后曹操赏
      chapter2Run.nextBattle = 6;
    } else {
      walkToChapter2Battle(battle + 1); return;
    }
    walkToChapter2Battle(6); return;   // 用户定：战四/战五打完先捡东西，往右走才去祭台
  }
  if (chapter2Run.mode !== 'fight') return;
  if (!zs.some(z => !z.dead)) { chapter2Run.mode = 'clearing'; chapter2Run.nextAt = gameT + .72; }
}
function chooseChapter2Route(route) {
  if (!chapter2Run || chapter2Run.mode !== 'choice') return;
  chapter2Run.route = route;
  for (const d of drops) if (d.k === 'weapon' && d.weapon && !d.item && !d.got && window.TITLE && TITLE.grantWeapon && TITLE.grantWeapon(d.weapon, false)) { d.got = 1; floaters.push({ x: hero.x, y: hero.y - 50, t: 0, txt: `获得${d.weapon === 'blade' ? '大刀' : '汉弓'}！`, big: true, gold: true }); }   // 首次赏的武器没捡也自动收下
  if (window.CHAPTER2 && CHAPTER2.chooseRoute) CHAPTER2.chooseRoute(route);
  const caoLine = route === 'zhang-liang' ? '我去截张宝——你追张梁！' : '张梁交给我——你去截张宝！';
  if (window.CH2OPEN) CH2OPEN.bark(caoLine, 2.8); else say('曹操：' + caoLine, 2.8);
  if (window.SFX && SFX.voice) SFX.voice(route === 'zhang-liang' ? 'caocao_liang' : 'caocao_bao');
  walkToChapter2Battle(route === 'zhang-liang' ? 4 : 5);
}
function walkToChapter2Battle(next) {
  chapter2Run.nextBattle = next; chapter2Run.mode = 'walk';
  chapter2Run.walkGate = hero.x + 280;
  lockR = Infinity;
  say('往右走 →', 3);
}

// ---------- 主角 ----------
