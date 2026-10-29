// 整军备战页「锦囊」按钮：新锦囊系统的卡表 + 锁定面板（锁定功能尚未接入局内，先能浏览）。
// 规则（用户定）：每局卡池固定 20 张；攻/技/术/守/专属 每类最多花金币锁 1 张，其余随机；
// 兵类不进卡池，三选一时随机多出第 4 张兵卡，选了之后本局不再出现。
(() => {
  const CATS = [
    { id: 'gong', name: '破敌', color: '#d9644a' },
    { id: 'ji', name: '身法', color: '#e2b04a' },
    { id: 'shu', name: '秘术', color: '#8fc35a' },
    { id: 'shou', name: '坚守', color: '#5aa6d9' },
    { id: 'zhuan', name: '兵刃', color: '#c58ae0' },
    { id: 'bing', name: '将令', color: '#b98a52' },
  ];
  const CARDS = {
    gong: [
      ['先声夺人', 'n', '每波敌人出现后 4 秒「战意」：伤害 +40%、移速 +25%；第一下 3 倍伤害、击倒并震开周围'],
      ['直取要害', 'n', '暴击率 +5%；打正在蓄力出招（头顶冒!）的敌人必暴击并打断'],
      ['一鼓作气', 'n', '连续打中叠层，每层伤害 +1.5%，最多 10 层；2 秒没打中开始掉层'],
      ['横扫千军', 'n', '近战打中时，溅射周围最多 3 人，每人 30% 伤害'],
      ['积羽沉舟', 'r', '普攻不论打谁都累计，每第 3 下必暴击、击退并晕 0.5 秒'],
      ['乘胜追击', 'n', '击杀敌人后 3 秒内，下一击必暴击'],
      ['矢如连珠', 'n', '远程连续 3 发打中同一目标，第 4 发多射 2 支副弹'],
      ['声东击西', 'r', '远程打中时，30% 概率从敌人背后再飞来一支箭，伤害 50%'],
      ['陷阵之志', 'l', '一下打中越多人伤害越高；4 人以上全部击倒'],
    ],
    ji: [
      ['骤雨', 'n', '连续打中叠层，每层攻速、移速 +3%，最多 5 层'],
      ['破军', 'r', '终段打死敌人时放冲击波；打精英、首领有概率小冲击'],
      ['倒持', 'l', '同一把武器连续打中 5 次后发光，此时切武器直接挥出新武器终段'],
      ['藏势', 'r', '蓄力中可以翻滚，蓄力进度保留'],
      ['寸劲', 'n', '一档以上蓄力打中后，下一次蓄力时间 -30%'],
      ['回锋', 'l', '翻滚躲过攻击后慢动作一瞬，下一下普攻直接是终段且伤害 +50%，冷却 5 秒'],
      ['避实', 'r', '翻滚躲过攻击后，下一击必暴击、眩晕敌人并回 0.5 血，冷却 4 秒'],
      ['回马', 'r', '翻滚结束时在起点留下残影，向身后挥一次普攻，冷却 3 秒'],
      ['燎步', 'r', '翻滚时原地留一小片地火，每个敌人只烫一次'],
    ],
    shu: [
      ['震慑', 'n', '眩晕、击倒敌人时挂"破绽"，打带破绽的敌人伤害 +25%'],
      ['淬毒', 'n', '普攻让敌人中毒，持续掉血'],
      ['明火', 'n', '终段让敌人着火；着火的敌人死后留火场'],
      ['焚身', 'r', '贴身的敌人持续灼烧，每秒叠一层，最多 3 层'],
      ['乘危', 'r', '普攻打带状态的敌人伤害 +35%，并延长状态'],
    ],
    shou: [
      ['护体', 'r', '每 10 秒获得一层护盾，挡一次伤害'],
      ['饮血', 'n', '每次打中回少量血（打首领减半）'],
      ['解围', 'n', '受伤后 2 秒内翻滚，震开周围敌人并获得薄护盾'],
      ['反戈', 'r', '躲过敌人蓄力攻击或技能后，50% 概率让对方承受这招一半伤害'],
      ['闪身', 'n', '被蓄力攻击或技能打中时，20% 概率自动闪开并短暂加速'],
      ['硬撼', 'l', '蓄满力时被打中：抵消伤害并反击震开周围，但蓄力效果只剩 50%'],
      ['背水', 'l', '血量低于 20% 时伤害 +30%、蓄力时间减半，身上冒红气'],
    ],
    zhuan: [
      ['定海', 'r', '【棍】终段戳晕敌人时周围一起晕；打眩晕的敌人每段 +30% 伤害', 'staff'],
      ['崩山', 'r', '【锤】回旋锤转两圈，第二圈范围更大；击倒的敌人落地再震一下', 'hammer'],
      ['飞蝗', 'r', '【石子】每第 3 发变散弹；蓄力石子打中后弹向下一个敌人', 'stone'],
      ['血债', 'r', '【长戟】裂伤上限 5 → 8 层；引爆时把伤害溅给周围', 'halberd'],
      ['斩首', 'r', '【大刀】斩杀线 25% → 35%；斩杀后下一次终段 +50%', 'blade'],
      ['回矢', 'l', '【汉弓】蓄力箭打死目标时返还这支箭', 'bow'],
    ],
    bing: [
      ['万箭齐发', 'n', '对准前方连射两轮、每轮 10 支穿透箭，每支 1 伤害，同一敌人最多中 3 支'],
      ['霹雳飞石', 'r', '投石车出现在身后，连投两轮共 6 块燃烧石砸向敌群，每块 2 伤害并留火场'],
      ['草木皆兵', 'r', '召出 2 个稻草人吸引敌人，被打碎时爆炸（3 伤害）'],
      ['借我东风', 'r', '8 秒大风：持续吹开敌人，每 2 秒一阵强风吹倒普通敌人，敌人的箭石被吹回去'],
      ['火烧连营', 'l', '在敌群处铺开一大片地火，火会在敌人之间传开'],
      ['雷霆万钧', 'l', '落下 8 道天雷，优先劈人多的地方'],
      ['水淹七军', 'r', '对准敌群涌出大水：浪头先拍开敌人，之后 7 秒水里的敌人持续受伤、移速大降'],
    ],
  };
  // 每类按稀有度排：普通 → 稀有 → 传说（用户定），同稀有度保持原顺序
  const ORDER = { n: 0, r: 1, l: 2 };
  for (const k in CARDS) CARDS[k] = CARDS[k].map((c, i) => [c, i]).sort((x, y) => ORDER[x[0][1]] - ORDER[y[0][1]] || x[1] - y[1]).map(x => x[0]);
  let tab = 'gong', sel = 0;
  // 锁定（用户定）：锁定时一次性付金币，之后每局自动生效；换卡要按新卡价格重新付，取消免费但不退钱。
  // 存在玩家存档里（tipLocks，随云存档同步），价格 普通 150 / 稀有 300 / 传说 600。
  const PRICE = { n: 150, r: 300, l: 600 };
  const profile = () => window.ARMORY && ARMORY.state ? ARMORY.state() : null;
  const store = () => { const p = profile(); if (!p) return {}; if (!p.tipLocks || typeof p.tipLocks !== 'object') p.tipLocks = { _at: 0 }; for (const k in p.tipLocks) if (RENAMED[p.tipLocks[k]]) p.tipLocks[k] = RENAMED[p.tipLocks[k]]; return p.tipLocks; };
  const RENAMED = {'先登战意':'先声夺人','会心一击':'直取要害','分裂之击':'横扫千军','弱点击破':'积羽沉舟','乘胜连箭':'矢如连珠','暗箭伤人':'声东击西','狂风骤雨':'骤雨','避实回气':'避实','回马枪':'回马','风火轮':'燎步','烈火焚身':'焚身','乘人之危':'乘危','金光咒':'护体','以守为攻':'反戈','闪身步':'闪身','硬拼':'硬撼','背水一战':'背水','箭补':'回矢','投石问路':'霹雳飞石','借我西风':'借我东风'};   // 旧名 → 新名（用户定的改名），旧存档里的锁定自动换成新名
  let msg = '';
  function setLock(cat, name) {
    const t = store(); if (!profile()) { msg = '没有存档，无法锁定'; return; }
    if (name) {
      const card = find(cat, name); if (!card) return;
      if (!window.WALLET || !WALLET.spendCoins(PRICE[card[1]])) { msg = `金币不够（需要 ${PRICE[card[1]]}）`; return; }
      t[cat] = name; msg = `已锁定「${name}」，以后每局自动带上`;
    } else { delete t[cat]; msg = '已取消锁定（不退金币）'; }
    t._at = Date.now(); if (window.ARMORY && ARMORY.saveNow) ARMORY.saveNow();
    if (window.SHOP && SHOP.refresh) SHOP.refresh();
  }
  const find = (cat, name) => (CARDS[cat] || []).find(c => c[0] === name);
  const carried = () => { const A = window.ARMORY; if (!A || !A.equipped) return null; return ['long', 'short', 'ranged'].map(s => { try { const i = A.equipped(s); return i && i.type; } catch (e) { return null; } }).filter(Boolean); };
  const usable = (cat, c) => cat !== 'zhuan' || !c[3] || !carried() || carried().includes(c[3]);
  function lockList() { const locks = store(); return Object.entries(locks).filter(([k]) => k !== '_at').map(([cat, name]) => ({ cat, card: find(cat, name) })).filter(x => x.card && usable(x.cat, x.card)); }
  // 小锦囊图标：布袋 + 束口绳，按类别上色
  const pouch = c => `<svg viewBox="0 0 40 44" width="40" height="44" aria-hidden="true"><path d="M13 9 Q20 13 27 9 L25 15 Q34 20 34 31 Q34 41 20 41 Q6 41 6 31 Q6 20 15 15 Z" fill="${c}" stroke="#2a160f" stroke-width="2"/><path d="M14 15 Q20 18 26 15" fill="none" stroke="#f1d58f" stroke-width="2"/><circle cx="27" cy="17" r="2" fill="#f1d58f"/><path d="M27 19 l2 6 M27 19 l-1 6" stroke="#f1d58f" stroke-width="1.4"/><path d="M12 28 Q20 24 28 28 Q20 34 12 28" fill="none" stroke="#0005" stroke-width="1.5"/></svg>`;
  function css() {
    if (document.getElementById('tipBagCss')) return;
    const s = document.createElement('style'); s.id = 'tipBagCss';
    s.textContent = '#tipBag{position:fixed;inset:0;z-index:10002;display:flex;align-items:center;justify-content:center;padding:10px;box-sizing:border-box;background:#100b08c9;font:14px/1.5 sans-serif}#tipBag[hidden]{display:none!important}#tipBag section{position:relative;box-sizing:border-box;width:min(680px,96vw);max-height:92dvh;overflow:auto;padding:clamp(12px,3vh,22px) clamp(12px,3vw,24px);background:linear-gradient(#3b2c20,#271c14);border:2px solid #9d7845;border-radius:10px;box-shadow:0 12px 40px #000a;color:#ecdcbc}#tipBag h3{margin:2px 0 4px;text-align:center;font:700 22px MaShanZheng,"STKaiti",serif;color:#f1d58f}#tipBag .tx{position:absolute;right:14px;top:12px;border:1px solid #8a6538;background:#5a3923;color:#f5dfb2;border-radius:6px;min-height:34px;padding:2px 14px;cursor:pointer}#tipBag .tsub{text-align:center;font-size:12px;color:#cdb78e;margin:0 0 10px}#tipBag .tlocks{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:10px}#tipBag .tcol{background:#2a1f17;border:1px solid #6e5232;border-radius:6px;padding:4px;text-align:center;font-size:12px}#tipBag .tcol b{display:block;font-size:14px}#tipBag .tslot{margin-top:4px;height:26px;line-height:24px;border:1px dashed #7a5c38;border-radius:4px;color:#8f7656}#tipBag .ttabs{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px}#tipBag .ttabs button{flex:1;min-height:32px;border:1px solid #7a5c38;background:#35271d;color:#ecdcbc;border-radius:5px;cursor:pointer}#tipBag .ttabs button.on{background:#6b4a2a;color:#fff;border-color:#e5c98a}#tipBag .tgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(62px,1fr));gap:6px}#tipBag .tcell{position:relative;aspect-ratio:2/3;display:flex;align-items:center;justify-content:center;background:var(--card) center/100% 100% no-repeat;border-radius:6px;cursor:pointer;color:#f1d58f;outline:2px solid transparent;outline-offset:-1px}#tipBag .tcell.r{outline-color:#4f7fae}#tipBag .tcell.l{outline-color:#e0a63a;box-shadow:0 0 8px #e0a63a99}#tipBag .tcell.on{filter:brightness(1.3);box-shadow:0 0 0 3px #1c140e,0 0 0 5px #fff3c4}#tipBag .tcell.l.on{box-shadow:0 0 0 3px #1c140e,0 0 0 5px #fff3c4,0 0 10px #e0a63a}#tipBag .tnm{writing-mode:vertical-rl;font:700 15px MaShanZheng,"STKaiti",serif;letter-spacing:2px;text-shadow:0 1px 2px #000}#tipBag .tdot{position:absolute;top:9%;left:50%;width:8px;height:8px;margin-left:-4px;border-radius:50%;box-shadow:0 0 3px #000}#tipBag .tslot.got{border-style:solid;border-color:#e5c98a;color:#f1d58f;cursor:pointer}#tipBag .tslot.bad{opacity:.45;text-decoration:line-through}#tipBag .tsum{text-align:center;font-size:12px;margin:-4px 0 8px;color:#cdb78e}#tipBag .tsum b{color:#f1d58f}#tipBag .tlock{float:right;min-height:30px;padding:2px 12px;border:1px solid #e5c98a;border-radius:5px;background:#6b4a2a;color:#fff3c4;cursor:pointer}#tipBag .tlock.on{background:#3a2a1c;color:#cdb78e;border-color:#7a5c38}#tipBag .tno{float:right;font-size:12px;color:#c98a6a}#tipBag .tdet{margin-top:8px;padding:8px 10px;background:#35271de8;border:1px solid #805d37;border-radius:6px;min-height:44px}#tipBag .tdet b{color:#f1d58f;margin-right:8px}#tipBag .tdet i{font-style:normal;font-size:12px}#tipBag .tdet p{margin:3px 0 0;font-size:13px;color:#d9c8a4}#tipBag .tnote{margin:8px 0 0;font-size:12px;color:#cdb78e;text-align:center}';
    document.head.append(s);
  }
  function render(box) {
    const cat = CATS.find(c => c.id === tab);
    const locks = store();
    const lockRow = CATS.filter(c => c.id !== 'bing').map(c => { const card = locks[c.id] && find(c.id, locks[c.id]), ok = card && usable(c.id, card); return `<div class="tcol"><b style="color:${c.color}">${c.name}</b><div class="tslot${card ? ' got' : ''}${card && !ok ? ' bad' : ''}" ${card ? `data-unlock="${c.id}"` : ''}>${card ? `🔒 ${card[0]}` : '空'}</div></div>`; }).join('');
    const tabs = CATS.map(c => `<button type="button" data-tab="${c.id}" class="${c.id === tab ? 'on' : ''}">${c.name} ${CARDS[c.id].length}</button>`).join('');
    const cards = CARDS[tab], cur = cards[Math.min(sel, cards.length - 1)];
    const list = `<div class="tgrid">${cards.map(([n, r], i) => `<div class="tcell ${r}${cards[i] === cur ? ' on' : ''}" data-i="${i}"><span class="tnm">${n}</span><i class="tdot" style="background:${cat.color}"></i></div>`).join('')}</div><div class="tdet"><b>${cur[0]}</b>${tab === 'bing' ? '' : locks[tab] === cur[0] ? `<button type="button" class="tlock on" data-lock="0">取消锁定</button>` : usable(tab, cur) ? `<button type="button" class="tlock" data-lock="1">${locks[tab] ? '换成这张' : '锁定'} · ${PRICE[cur[1]]} 金币</button>` : '<span class="tno">武器槽里没有这把武器</span>'}<p>${cur[2]}</p></div>`;
    const card = typeof ASSETS !== 'undefined' && ASSETS.ui && ASSETS.ui.rogue_card;
    box.style.setProperty('--card', card ? `url(${card})` : '#3a2a1c');
    box.innerHTML = `<section><button class="tx" type="button">关闭</button><h3>锦囊</h3><p class="tsub">每局卡池 20 张：每类可锁定 1 张（长期有效），其余随机</p><div class="tlocks">${lockRow}</div><p class="tsum">已锁 ${lockList().length} / 5 · 现有金币 <b>${window.WALLET ? WALLET.coins() : 0}</b>${msg ? ' · ' + msg : ''}</p><div class="ttabs">${tabs}</div>${list}<p class="tnote">${tab === 'bing' ? '兵类不进卡池：三选一时偶尔多出第 4 张兵卡，选了后本局不再出现。' : tab === 'zhuan' ? '武器专属：武器槽里有这把武器才会抽到。' : '锁定一次付费，以后每局自动带上；换卡要重新付费，取消不退钱。'}</p></section>`;
  }
  function open() {
    css();
    let box = document.getElementById('tipBag');
    if (!box) {
      box = document.createElement('div'); box.id = 'tipBag'; document.body.append(box);
      box.addEventListener('click', e => {
        const b = e.target.closest('[data-tab]');
        if (b) { tab = b.dataset.tab; sel = 0; render(box); return; }
        const L = e.target.closest('[data-lock]');
        if (L) { setLock(tab, L.dataset.lock === '1' ? CARDS[tab][sel][0] : ''); render(box); return; }
        const U = e.target.closest('[data-unlock]');
        if (U) { setLock(U.dataset.unlock, ''); render(box); return; }
        const c = e.target.closest('[data-i]');
        if (c) { sel = +c.dataset.i; render(box); return; }
        if (e.target === box || e.target.closest('.tx')) box.hidden = true;
      });
    }
    msg = ''; render(box); box.hidden = false;
  }
  window.TIPBAG = { CATS, CARDS, PRICE, open, locks: lockList };
})();
