// 按文件名先于title.js加载。详情从战斗配置实时读取，不另维护一份数值表。
(() => {
  let tip, active, root, itemFor;
  const fmt = value => Number(value.toFixed(2)).toString();
  const duration = c => c.d.reduce((sum, n) => sum + n, 0);
  function hide() {
    if (active) active.removeAttribute('aria-describedby');
    active = null;
    if (tip) tip.hidden = true;
  }
  function place(point) {
    if (!tip || tip.hidden || !active) return;
    const rect = active.getBoundingClientRect();
    const width = tip.offsetWidth, height = tip.offsetHeight;
    let x = point ? point.x + 16 : rect.right + 12;
    let y = point ? point.y + 16 : rect.top;
    if (x + width > innerWidth - 10) x = point ? point.x - width - 16 : rect.left - width - 12;
    if (y + height > innerHeight - 10) y = innerHeight - height - 10;
    tip.style.left = Math.max(10, x) + 'px';
    tip.style.top = Math.max(10, y) + 'px';
  }
  function show(node, point) {
    const id = node && (node.dataset.weapon || node.dataset.item);
    const item = id && itemFor(id);
    const w = typeof WEAP !== 'undefined' && WEAP[id];
    if (!item || !w || !root.classList.contains('open')) { hide(); return; }
    hide(); active = node;
    const combos = w.combo, first = combos[0], third = combos[2];
    const effects = third ? [third.pierce && '穿透', third.both && '前后攻击',
      third.multi && '多目标', third.knock && '击飞', w.interrupt && '打断蓄力',
      third.daze && `硬直 ${fmt(third.daze)}秒`].filter(Boolean) : [];
    const ranges = combos.map(c => w.proj ? c.spd * (c.life || (c.pierce ? 1.1 : .8)) : w.reach * (c.thrust ? 1.35 : 1));
    const lo = Math.round(Math.min(...ranges)), hi = Math.round(Math.max(...ranges));
    const range = lo === hi ? String(lo) : `${lo}～${hi}`;
    tip.replaceChildren();
    const heading = document.createElement('strong'); heading.textContent = item.name; tip.append(heading);
    const category = document.createElement('small');
    category.textContent = ({ long: '长武器', short: '短武器', ranged: '远程武器' })[w.class] || '武器';
    tip.append(category);
    const list = document.createElement('dl');
    const row = (label, value) => {
      const dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = label; dd.textContent = value; list.append(dt, dd);
    };
    row('基础伤害', combos.map(c => fmt(c.dmg)).join(' / '));
    row('攻击速度', `${fmt(1 / duration(first))}次/秒 · 首段${fmt(duration(first))}秒`);
    row(w.proj ? '射程' : '攻击范围', `${range} · 游戏距离单位`);
    row('连招', `${combos.length}段 · 完整一套${fmt(combos.reduce((n, c) => n + duration(c), 0))}秒`);
    if (third) row('第三段', `${fmt(third.dmg)}伤害 · ${fmt(duration(third))}秒${effects.length ? ' · ' + effects.join('、') : ''}`);
    const instance = window.ARMORY && (node.dataset.uid ? ARMORY.byId(node.dataset.uid) : ARMORY.active(id));
    if (instance) {
      heading.textContent = AFFIX_DATA.label(instance); heading.style.color = AFFIX_DATA.qualities[instance.q].color;
      const st = AFFIX_DATA.stats(instance);
      row('常驻伤害', combos.map(c => fmt(c.dmg * st.damage)).join(' / '));
      row('常驻攻速', `${fmt(st.speed / duration(first))}次/秒${st.speed >= 1.4 ? ' · 已达上限' : ''}`);
      row('实际距离', `${Math.round(lo * st.range)}～${Math.round(hi * st.range)}${st.range >= 1.35 ? ' · 已达上限' : ''}`);
      row('暴击／暴伤', `${fmt(st.crit*100)}% / ${fmt(st.critDamage*100)}%`);
      row('生命／减伤', `${fmt(st.health)} / ${fmt(st.guard*100)}%`);
      row('词条', AFFIX_DATA.lines(instance).join('；') || '无');
    }
    else row('词条', '无');
    row('基础暴击', '1% · 暴击伤害150%');
    tip.append(list);
    const note = document.createElement('p');
    note.textContent = '各段按顺序列出基础伤害；不含难度、锦囊及其他加成。攻速按动作时长计算。';
    tip.append(note);
    node.setAttribute('aria-describedby', tip.id);
    tip.hidden = false; place(point);
  }
  function weaponNode(target) {
    const node = target && target.closest && target.closest('[data-item],[data-weapon]');
    return node && root.contains(node) ? node : null;
  }
  function attach(container, lookup) {
    if (root) return;
    root = container; itemFor = lookup;
    const style = document.createElement('style');
    style.textContent = `
      #wWeaponTip { position:fixed; z-index:10000; pointer-events:none; box-sizing:border-box;
        width:min(350px,calc(100vw - 20px)); max-height:calc(100vh - 20px); overflow:auto;
        padding:15px 17px 12px; color:#e8d6af; font-family:inherit; font-size:13px; line-height:1.5;
        border:1px solid #ba9250; border-radius:5px;
        background:repeating-linear-gradient(3deg,rgba(211,171,104,.035) 0 1px,transparent 1px 7px),linear-gradient(135deg,#403022,#211b16);
        box-shadow:inset 0 0 0 3px #2c231b,inset 0 0 0 4px #715637,0 5px 22px #160f0ab3; }
      #wWeaponTip[hidden] { display:none; }
      #wWeaponTip strong { display:block; color:#f1cf82; font-size:20px; letter-spacing:2px; }
      #wWeaponTip small { display:block; color:#bca47e; padding-bottom:8px; border-bottom:1px solid #80623b; }
      #wWeaponTip dl { display:grid; grid-template-columns:66px minmax(0,1fr); gap:6px 9px; margin:10px 0; }
      #wWeaponTip dt { color:#bda57f; } #wWeaponTip dd { margin:0; overflow-wrap:anywhere; }
      #wWeaponTip p { margin:9px 0 0; padding-top:8px; border-top:1px solid #685034; font-size:11px; color:#b29e7d; }
      @media(max-height:430px) { #wWeaponTip { padding:9px 12px; font-size:11px; line-height:1.3; }
        #wWeaponTip strong { font-size:16px; } #wWeaponTip dl { margin:6px 0; gap:4px 7px; } }
    `;
    document.head.appendChild(style);
    tip = document.createElement('aside'); tip.id = 'wWeaponTip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true;
    document.body.appendChild(tip);
    root.addEventListener('pointerover', e => {
      if (e.pointerType === 'touch') return;
      const node = weaponNode(e.target);
      if (node && node !== active) show(node, { x: e.clientX, y: e.clientY });
    });
    root.addEventListener('pointermove', e => {
      if (!active || e.pointerType === 'touch') return;
      place({ x: e.clientX, y: e.clientY });
    });
    root.addEventListener('pointerout', e => {
      if (active && !active.contains(e.relatedTarget)) hide();
    });
    root.addEventListener('focusin', e => { const node = weaponNode(e.target); if (node) show(node); });
    root.addEventListener('focusout', e => { if (active && !active.contains(e.relatedTarget)) hide(); });
    root.addEventListener('pointerdown', hide);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });
    document.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide); window.addEventListener('blur', hide);
    new MutationObserver(() => { if (!root.classList.contains('open')) hide(); }).observe(root, { attributes: true, attributeFilter: ['class'] });
  }
  window.WEAPON_TIP = { attach, hide };
})();
