// 开发者调试面板（只在网址带 ?debug 时出现，普通玩家看不到）
//   ?debug        打开面板
//   ?debug=boss   直接进管亥一阶段（骑马）
//   ?debug=boss2  直接进管亥二阶段（步战）
//   ?debug=chapter2  直接测试第二章战斗流程（玩家章节入口保持锁定）
//   ?debug=chapter2altar  直接预览第六战祭台地图（张角 Boss 尚未接入）
// 桌面也可以按 F2 收起/展开面板，F3 跳 Boss 一阶段，F4 跳二阶段。
(() => {
  const m = /[?&]debug(?:=([a-z0-9]+))?/.exec(location.search);
  if (!m) return;
  const auto = m[1] || '';
  let panel = null, god = false, fps = 60, last = performance.now(), frames = 0, acc = 0;
  let groupState = {};
  try { groupState = JSON.parse(localStorage.getItem('wzb-dbg-groups') || '{}') || {}; } catch (e) { groupState = {}; }

  const css = document.createElement('style');
  css.textContent = `
    #dbg { position:fixed; right:8px; top:64px; z-index:20; width:220px; box-sizing:border-box;
      background:rgba(10,8,16,.9); border:1px solid rgba(255,216,110,.5); border-radius:8px;
      padding:6px; font:600 11px/1.35 "Consolas","PingFang SC",monospace; color:#ffd86e;
      box-shadow:0 6px 24px rgba(0,0,0,.5); max-height:calc(100vh - 80px); overflow-y:auto; }
    #dbg>.dbgHead{display:block; cursor:pointer; user-select:none; color:#8ef07a; font-size:11px; margin:0 0 5px; }
    #dbg.collapsed>.dbgBody{display:none!important}
    #dbg .dbgGroup{border-top:1px solid rgba(255,216,110,.16); padding-top:4px; margin-top:4px}
    #dbg .dbgGroup:first-child{border-top:0}
    #dbg .dbgGroup>h3{margin:0 0 3px; color:#f0c96b; font:700 12px "PingFang SC",sans-serif; cursor:pointer; user-select:none}
    #dbg .dbgGroup.closed>.dbgItems{display:none!important}
    #dbg .dbgItems{display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:3px}
    #dbg button{display:block; width:100%; min-width:0; height:26px; margin:0; padding:2px 4px;
      font:700 12px/1.1 "PingFang SC",sans-serif; color:#2b1a06;
      background:linear-gradient(180deg,#f7dd8a,#d9a93c); border:1px solid #8a5f12; border-radius:5px;
      cursor:pointer; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    #dbg button:active{transform:translateY(1px)}
    #dbg button.alt{background:linear-gradient(180deg,#b6e9a0,#6fbf55); border-color:#2f6b3a}
    #dbg button.off{background:#4a4a52; color:#ddd; border-color:#333}
    #dbg .dbgWide{grid-column:1/-1}
    #dbg .dbgTrial{grid-column:1/-1; display:flex; gap:3px; align-items:center}
    #dbg .dbgTrial>span{flex:none; color:#cdb98e; font:12px "PingFang SC",sans-serif}
    #dbg .dbgTrial button{flex:1 1 0}
    #dbg .dbgFloors{grid-column:1/-1; display:grid; grid-template-columns:auto repeat(6,minmax(0,1fr)); gap:2px; align-items:center}
    #dbg .dbgFloors>span{color:#cdb98e;font:12px "PingFang SC",sans-serif;white-space:nowrap}
    #dbg .dbgFloors button{padding:1px; font-size:11px}
    #dbg i{display:block; color:#9bb0c9; font-style:normal; font-size:10px; line-height:1.35; margin-top:5px; white-space:pre-line}
  `;
  document.head.appendChild(css);

  const btn = (parent, label, cls, fn) => {
    const b = document.createElement('button');
    b.textContent = label; if (cls) b.className = cls;
    b.addEventListener('click', e => { e.stopPropagation(); fn(); });
    parent.appendChild(b);
    return b;
  };
  function saveGroups() { try { localStorage.setItem('wzb-dbg-groups', JSON.stringify(groupState)); } catch (e) {} }
  function addGroup(key, title) {
    const section = document.createElement('section'); section.className = 'dbgGroup';
    const head = document.createElement('h3'); head.textContent = '【' + title + '】';
    const body = document.createElement('div'); body.className = 'dbgItems';
    section.append(head, body); panel.querySelector('.dbgBody').appendChild(section);
    const apply = () => section.classList.toggle('closed', !!groupState[key]);
    head.addEventListener('click', e => { e.stopPropagation(); groupState[key] = !groupState[key]; apply(); saveGroups(); });
    apply();
    return body;
  }

  function build() {
    panel = document.createElement('div'); panel.id = 'dbg';
    document.body.appendChild(panel);
    const head = document.createElement('b'); head.className = 'dbgHead';
    const body = document.createElement('div'); body.className = 'dbgBody';
    panel.append(head, body);
    const setCollapsed = v => {
      panel.classList.toggle('collapsed', v);
      head.textContent = '开发者模式 ' + (v ? '▸' : '▾');
      try { localStorage.setItem('wzb-dbg-collapsed', v ? '1' : ''); } catch (e) {}
    };
    let saved = false; try { saved = localStorage.getItem('wzb-dbg-collapsed') === '1'; } catch (e) {}
    setCollapsed(saved);
    head.addEventListener('click', e => { e.stopPropagation(); setCollapsed(!panel.classList.contains('collapsed')); });

    const heroGroup = addGroup('hero', '主角');
    btn(heroGroup, '回到主界面', 'alt', () => { if (typeof returnFromPausedGame === 'function') returnFromPausedGame(true); else if (window.TITLE && TITLE.show) TITLE.show(); });
    btn(heroGroup, '回满血', '', () => { if (typeof hero !== 'undefined') hero.hp = maxHeroHp(); });
    const godBtn = btn(heroGroup, god ? '无敌：开' : '无敌：关', 'off', () => {
      god = !god; godBtn.textContent = god ? '无敌：开' : '无敌：关'; godBtn.className = god ? 'alt' : 'off';
    });
    const revive = btn(heroGroup, '复活次数 +1', '', () => { if (typeof reviveUsed !== 'undefined') reviveUsed = false; });
    // 测试用：六种武器熟练度拉满，并每种各给一把传说武器（会写进当前玩家的存档）
    btn(heroGroup, '满熟练+传说武器', '', () => {
      if (!window.MASTERY || !window.ARMORY || !window.AFFIX_DATA) return;
      const top = MASTERY.NEED[MASTERY.NEED.length - 1], m = {};
      MASTERY.TYPES.forEach(t => { m[t] = top; });
      ARMORY.setMastery(m);
      let n = 0;
      for (const t of MASTERY.TYPES) { const item = AFFIX_DATA.generate(t, 'boss', '', 4); if (ARMORY.add(item)) n++; }
      if (window.TITLE && TITLE.grantWeapon) for (const t of MASTERY.TYPES) TITLE.grantWeapon(t, false);
      if (typeof say === 'function') say(`熟练度已满；获得传说武器 ${n} 把（仓库可装备）`, 3);
    });
    revive.classList.add('dbgWide');
    const trial = document.createElement('div'); trial.className = 'dbgTrial';
    const tlabel = document.createElement('span'); tlabel.textContent = '试用：'; trial.appendChild(tlabel);
    for (const [id, label] of [['halberd', '长戟'], ['bow', '汉弓'], ['blade', '大刀']]) {
      btn(trial, label, 'alt', () => {
        if (window.TITLE) { TITLE.skip(); if (TITLE.grantWeapon) TITLE.grantWeapon(id, true); }
        if (window.ROOM) ROOM.skip();
        if (typeof setW === 'function') setW(id);
      });
    }
    heroGroup.appendChild(trial);

    const c1 = addGroup('chapter1', '第一章');
    btn(c1, 'Boss 一阶段', 'alt', () => jumpBoss(false));
    btn(c1, 'Boss 二阶段', 'alt', () => jumpBoss(true));
    btn(c1, '清空本区域', '', () => { if (typeof zs !== 'undefined') zs.forEach(z => { z.dead = 1; z.hp = 0; }); });
    btn(c1, '跳到下一关', '', () => {
      if (typeof gateI === 'undefined') return;
      gateI++; lockR = Infinity; zs.length = 0; clearAt = 0;
      if (gateI < M.gates.length) warpTo(M.gates[gateI] + 10);
    });

    const c2 = addGroup('chapter2', '第二章');
    btn(c2, '测试第二章', 'alt', () => { if (typeof startChapter2Debug === 'function') startChapter2Debug(); });
    // 选战：直接进第二章任意一战（素材异步加载完再进）。4=张梁、5=张宝、6=张角祭台
    const battles = document.createElement('div'); battles.className = 'dbgFloors';
    const bl = document.createElement('span'); bl.textContent = '选战'; battles.appendChild(bl);
    ['1', '2', '3', '张梁', '张宝', '张角'].forEach((t, i) => btn(battles, t, 'alt', () => {
      if (typeof startChapter2Debug !== 'function') return;
      startChapter2Debug(i + 1);
      if (i + 1 === 4 || i + 1 === 5) setTimeout(() => { if (typeof chapter2Run !== 'undefined' && chapter2Run) chapter2Run.route = i + 1 === 4 ? 'zhang-liang' : 'zhang-bao'; }, 1500);
    }));
    c2.appendChild(battles);

    const xc = addGroup('xiaochang', '校场');
    const floors = document.createElement('div'); floors.className = 'dbgFloors';
    const floorLabel = document.createElement('span'); floorLabel.textContent = '选层';
    floors.appendChild(floorLabel);
    for (let floor = 1; floor <= 6; floor++) btn(floors, floor === 6 ? '魔' : String(floor), 'alt', () => { if (window.XIAOCHANG) XIAOCHANG.start({ chapter: 1, floor }); });
    xc.appendChild(floors);
    btn(xc, '跳到第6波', 'dbgWide alt', () => { if (window.XIAOCHANG) XIAOCHANG.skipToSix(); });

    // 瞬移主角到新区域入口，并把镜头一起拉过去（否则镜头要滑半天）
    function warpTo(x) {
      hero.x = x; hero.y = (M.top + M.bot) / 2; hero.f = 1; hero.st = 'idle';
      cam.x = Math.max(0, Math.min(M.W - viewW(), hero.x - viewW() / 2));
    }
    const info = document.createElement('i'); panel.appendChild(info);
    setInterval(() => {
      if (!panel || typeof gateI === 'undefined') return;
      const z = typeof zs !== 'undefined' && zs.find(o => o.T && o.T.boss);
      info.textContent = `区域 ${Math.min(gateI + 1, M.gates.length)}/${M.gates.length}\n` +
        (z ? `管亥 ${Math.max(0, Math.round(z.hp))}/80 · ${z.st}\n` : '') +
        `帧率 ${Math.round(fps)} · 血 ${typeof hero !== 'undefined' ? hero.hp : '-'}`;
    }, 300);
  }

  // 跳关：直接站到最后一个区域（Boss 触发点）前，下一帧就会开打
  function jumpBoss(phase2) {
    if (window.TITLE && TITLE.skip) TITLE.skip();
    if (window.ROOM && ROOM.skip) ROOM.skip();
    if (typeof reset === 'function') reset();
    zs.length = 0; eshots.length = 0;
    gateI = M.gates.length - 1;
    lockR = Infinity; clearAt = 0;
    hero.x = M.gates[gateI] + 6; hero.y = (M.top + M.bot) / 2;
    cam.x = Math.max(0, Math.min(M.W - viewW(), hero.x - viewW() / 2));
    hero.hp = maxHeroHp(); hero.inv = 1.5;
    say('调试：直接开打', 1.2);
    setTimeout(() => {
      const z = zs.find(o => o.T && o.T.boss);
      if (!z) return;
      hero.x = Math.max(M.gates[gateI] + 20, z.x - 150); hero.y = z.y;
      cam.x = Math.max(0, Math.min(M.W - viewW(), hero.x - viewW() / 2));
      if (phase2) { z.phase = 2; z.type = 'guanhai'; z.st = 'idle'; z.t = 0; z.z = 0; z.cd = .6; z.hp = 80; }
    }, 150);
  }

  addEventListener('keydown', e => {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.code === 'F2') {
      if (panel) { const c = !panel.classList.contains('collapsed'); panel.classList.toggle('collapsed', c); panel.querySelector('.dbgHead').textContent = '开发者模式 ' + (c ? '▸' : '▾'); }
      e.preventDefault();
    }
    if (e.code === 'F3') { jumpBoss(false); e.preventDefault(); }
    if (e.code === 'F4') { jumpBoss(true); e.preventDefault(); }
  });

  // 帧率统计 + 无敌
  function tick(t) {
    frames++; acc += t - last; last = t;
    if (acc > 500) { fps = frames * 1000 / acc; frames = 0; acc = 0; }
    if (god && typeof hero !== 'undefined' && hero) hero.hp = maxHeroHp();
    requestAnimationFrame(tick);
  }

  function boot() {
    build();
    last = performance.now();
    requestAnimationFrame(tick);
    if (auto === 'xiaochang') setTimeout(() => { if (window.XIAOCHANG) XIAOCHANG.start(); }, 900);
    // 试玩网址（raw.githack 读 preview 分支）：直接进整军备战，六种武器熟练度满、每种一把传说并装上
    if (/githack|jsdelivr/.test(location.hostname) || auto === 'preview') setTimeout(() => {
      if (!window.TITLE || !TITLE.previewStart) return;
      // 方案 A：从正式网站只读拉取真实存档（默认 PO仔；网址可带 &name=名字&pin=口令），试玩里的改动不写回
      const qs = new URLSearchParams(location.search), who = qs.get('name') || 'PO仔', pin = qs.get('pin') || '';
      TITLE.previewStart(who);
      fetch('https://wumingzhibei.netlify.app/api/profile?name=' + encodeURIComponent(who), { headers: pin ? { 'X-Save-Pin': pin } : {}, cache: 'no-store' })
        .then(r => r.json()).then(d => {
          if (d && d.ok && d.profile && window.ARMORY && ARMORY.mergeCloud(d.profile)) { if (TITLE.refreshPreparation) TITLE.refreshPreparation(); if (typeof say === 'function') say(`已读取「${who}」的正式存档（只读）`, 3); }
          else if (typeof say === 'function') say(d && d.error ? '读取存档失败：' + d.error : '读取存档失败', 4);
        }).catch(() => { if (typeof say === 'function') say('读取正式存档失败（网络）', 4); });
      if (window.MASTERY && window.ARMORY && window.AFFIX_DATA) {
        const top = MASTERY.NEED[MASTERY.NEED.length - 1], m = {}; MASTERY.TYPES.forEach(t => { m[t] = top; }); ARMORY.setMastery(m);
        const items = ARMORY.state().items;
        for (const t of MASTERY.TYPES) {
          let it = items.find(i => i.type === t && i.q >= 4);
          if (!it) { it = AFFIX_DATA.generate(t, 'boss', '', 4); ARMORY.add(it); }
          ARMORY.equip(it.uid);
        }
        if (TITLE.refreshPreparation) TITLE.refreshPreparation();
      }
    }, 900);
    if (auto === 'boss' || auto === 'boss2') setTimeout(() => jumpBoss(auto === 'boss2'), 900);
    if (auto === 'chapter2' || auto === 'chapter2altar') setTimeout(() => {
      if (typeof startChapter2Debug === 'function') startChapter2Debug(auto === 'chapter2altar' ? 6 : 1);
    }, 900);
    console.log('%c[开发者模式] 已开启', 'color:#8ef07a;font-weight:bold', 'F2 面板 / F3 Boss一阶段 / F4 Boss二阶段');
  }
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot); else boot();
})();

