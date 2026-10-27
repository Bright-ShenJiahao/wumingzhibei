// 武器熟练度：按武器种类累计经验，10级；奇数级加攻击（远程更高），偶数级加攻速。
// 战斗中只记在内存里，回到整备页/结算/切后台时才写进存档，避免频繁触发云同步。
(() => {
  const TYPES = ['staff', 'hammer', 'stone', 'halberd', 'blade', 'bow'];
  const NAMES = { staff: '棍子', hammer: '锤子', stone: '石子', halberd: '长戟', blade: '大刀', bow: '汉弓' };
  const RANGED = { stone: true, bow: true };
  const NEED = [60, 180, 360, 600, 900, 1260, 1680, 2160, 2700, 3300];   // 原表×1.2（用户定：升级再慢约20%）   // 升到 Lv.1～10 的累计经验
  let pending = {};   // 本局还没写进存档的经验

  const saved = () => (window.ARMORY && ARMORY.state().mastery) || {};
  const xp = type => (Number(saved()[type]) || 0) + (pending[type] || 0);
  const levelOf = n => { let lv = 0; while (lv < NEED.length && n >= NEED[lv]) lv++; return lv; };
  const level = type => levelOf(xp(type));
  function bonusAt(type, lv) {
    const odd = Math.ceil(lv / 2), even = Math.floor(lv / 2);
    return { dmg: odd * (RANGED[type] ? .02 : .015), aspd: even * .01 };
  }
  const bonus = type => bonusAt(type, level(type));
  function rewardText(type, lv) { return lv % 2 ? '攻击+' + (RANGED[type] ? '2' : '1.5') + '%' : '攻速+1%'; }

  function gain(type, z, killed) {
    if (!NAMES[type] || !z || !z.T) return;
    let n = (z.T.boss || z.T.chapterBoss) ? 2 : 1;
    if (killed) n += 3;
    const hard = (typeof chapter2Run !== 'undefined' && chapter2Run) || (window.XIAOCHANG && XIAOCHANG.active() && (XIAOCHANG.state()?.floor || 1) >= 3);
    if (hard) n *= 1.5;
    const before = level(type);
    pending[type] = (pending[type] || 0) + n;
    const after = level(type);
    if (after > before && typeof floaters !== 'undefined' && typeof hero !== 'undefined')
      floaters.push({ x: hero.x, y: hero.y - 46, t: -.4, txt: NAMES[type] + '熟练 Lv.' + after + ' · ' + rewardText(type, after), gold: true });
  }

  function flush() {
    if (!window.ARMORY || !Object.keys(pending).length) return;
    const next = { ...saved() };
    for (const t of Object.keys(pending)) next[t] = Math.min(99999, Math.round((Number(next[t]) || 0) + pending[t]));
    pending = {};
    ARMORY.setMastery(next);
  }
  // 不在战斗中（标题/整备页、结算画面）时才落盘
  setInterval(() => {
    if (!Object.keys(pending).length) return;
    const settled = typeof result !== 'undefined' && result;
    if ((window.TITLE && TITLE.active()) || settled || (window.XIAOCHANG && XIAOCHANG.blocks())) flush();
  }, 1000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });

  // ---------- 整备页：熟练度面板 ----------
  function rows() {
    return TYPES.map(t => ({ t, n: xp(t), lv: level(t) })).sort((a, b) => b.lv - a.lv || b.n - a.n);
  }
  function summary() {
    const top = rows()[0];
    return top && top.n > 0 ? NAMES[top.t] + ' Lv.' + top.lv : '未修炼';
  }
  function pct(v) { return (Math.round(v * 1000) / 10) + '%'; }
  function open() {
    let box = document.getElementById('masteryPanel');
    if (!box) {
      box = document.createElement('div'); box.id = 'masteryPanel';
      const css = document.createElement('style');
      css.textContent = '#masteryPanel{position:fixed;inset:0;z-index:10002;display:flex;align-items:center;justify-content:center;padding:10px;box-sizing:border-box;background:#100b08c9;font:14px/1.5 sans-serif}#masteryPanel[hidden]{display:none!important}#masteryPanel section{position:relative;box-sizing:border-box;width:min(560px,94vw);max-height:92dvh;overflow:auto;padding:clamp(14px,3vh,24px) clamp(14px,3vw,26px);background:linear-gradient(#3b2c20,#271c14);border:2px solid #9d7845;border-radius:10px;box-shadow:0 12px 40px #000a;color:#ecdcbc}#masteryPanel h3{margin:4px 0 10px;text-align:center;font:700 22px MaShanZheng,"STKaiti",serif;color:#f1d58f}#masteryPanel .mx{position:absolute;right:clamp(14px,4vw,30px);top:clamp(12px,3vh,24px);border:1px solid #8a6538;background:#5a3923;color:#f5dfb2;border-radius:6px;padding:2px 9px;cursor:pointer}#masteryPanel .mr{display:grid;grid-template-columns:34px 1fr;gap:2px 10px;align-items:center;padding:6px 8px;margin:4px 0;background:#35271de8;border:1px solid #805d37;border-radius:6px;color:#ecdcbc}#masteryPanel .mr.dim{opacity:.55}#masteryPanel .mr img{width:30px;height:30px;object-fit:contain;grid-row:span 3;image-rendering:pixelated}#masteryPanel .mh{display:flex;justify-content:space-between;font-weight:700}#masteryPanel .mh b{color:#f1d58f}#masteryPanel .mb{height:6px;background:#1c140e;border-radius:3px;overflow:hidden}#masteryPanel .mb i{display:block;height:100%;background:linear-gradient(90deg,#c9953e,#f1d58f)}#masteryPanel .ms{font-size:12px;color:#cdb78e}#masteryPanel .mn{margin:10px 0 0;font-size:12px;color:#cdb78e;text-align:center}@media(max-height:450px){#masteryPanel section{padding:14px 26px}#masteryPanel .mr{padding:3px 6px;margin:3px 0}#masteryPanel h3{font-size:18px;margin:0 0 6px}}';
      document.head.append(css); document.body.append(box);
      box.addEventListener('click', e => { if (e.target === box || e.target.closest('.mx')) box.hidden = true; });
    }
    const icon = t => (typeof ASSETS !== 'undefined' && ASSETS.ui && ASSETS.ui['w_' + t]) || '';
    box.innerHTML = '<section><button class="mx" type="button">关闭</button><h3>武器熟练度</h3>' + rows().map(({ t, n, lv }) => {
      const b = bonusAt(t, lv), lo = lv ? NEED[lv - 1] : 0, hi = NEED[lv];
      const bar = lv >= 10 ? 100 : Math.max(0, Math.min(100, (n - lo) / (hi - lo) * 100));
      const now = lv ? '攻击+' + pct(b.dmg) + (b.aspd ? ' 攻速+' + pct(b.aspd) : '') : '暂无加成';
      const next = lv >= 10 ? '已精通' : '下一级：' + rewardText(t, lv + 1);
      return '<div class="mr' + (n > 0 ? '' : ' dim') + '"><img src="' + icon(t) + '" alt=""><div class="mh"><span>' + NAMES[t] + '</span><b>Lv.' + lv + '</b></div><div class="mb"><i style="width:' + bar + '%"></i></div><div class="ms">' + (lv >= 10 ? Math.floor(n) : Math.floor(n) + ' / ' + hi) + ' · ' + now + ' · ' + next + '</div></div>';
    }).join('') + '<p class="mn">用哪种武器打中敌人，哪种武器的熟练度就会提升。远程武器每级攻击加成更高。</p></section>';
    box.hidden = false;
  }

  window.MASTERY = { TYPES, NAMES, NEED, xp, level, bonus, gain, flush, summary, open };
})();
