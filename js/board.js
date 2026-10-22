// 英雄榜：读取 /api/scores 显示「斩敌榜 / 速通榜」，通关后自动提交成绩
(function () {
  const top = 20;
  let wrap = null, body = null, title = null;
  let data = null, loading = false, err = null;

  const CSS = `
  #wzbBoard{position:fixed;inset:0;z-index:30;display:none;align-items:center;justify-content:center;
    background:rgba(10,6,12,.78);backdrop-filter:blur(2px);font-family:"PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif;
    padding:calc(10px + env(safe-area-inset-top)) calc(10px + env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) calc(10px + env(safe-area-inset-left));}
  #wzbBoard.on{display:flex}
  #wzbBoard .panel{width:min(680px,96vw);max-height:88vh;display:flex;flex-direction:column;
    background:linear-gradient(180deg,#241a12,#1a120c);border:2px solid #8a6a3a;border-radius:14px;
    box-shadow:0 18px 50px rgba(0,0,0,.6);color:#f2e4c8;overflow:hidden}
  #wzbBoard .hd{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid #4a3722}
  #wzbBoard .hd h2{margin:0;font-size:19px;letter-spacing:2px;color:#ffd86e;flex:1}
  #wzbBoard .x{border:1px solid #8a6a3a;background:#2e2118;color:#f2e4c8;border-radius:8px;
    font-size:15px;padding:4px 12px;cursor:pointer}
  #wzbBoard .tabs{display:flex;gap:8px;padding:10px 14px 0}
  #wzbBoard .tabs button{flex:1;padding:8px 6px;border-radius:9px 9px 0 0;border:1px solid #4a3722;border-bottom:none;
    background:#2b1f16;color:#c9b691;font-size:15px;cursor:pointer}
  #wzbBoard .tabs button.on{background:#3a2a1c;color:#ffd86e;font-weight:700}
  #wzbBoard .body{overflow:auto;padding:10px 14px 14px}
  #wzbBoard table{width:100%;border-collapse:collapse;font-size:14px}
  #wzbBoard th,#wzbBoard td{padding:6px 4px;text-align:left;border-bottom:1px dashed #3a2a1c}
  #wzbBoard th{color:#b79c72;font-weight:600;font-size:13px}
  #wzbBoard td.num{text-align:right;color:#ffd86e;font-variant-numeric:tabular-nums}
  #wzbBoard tr.me td{background:rgba(255,216,110,.12)}
  #wzbBoard .empty{padding:26px 6px;text-align:center;color:#a08d70;line-height:1.7}
  #wzbBoard .foot{padding:8px 14px 12px;color:#8d7a5e;font-size:12px;text-align:center}
  #wzbBoard .rowName{max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  @media (max-width:520px){
    #wzbBoard .panel{width:96vw}
    #wzbBoard table{font-size:13px}
    #wzbBoard .rowName{max-width:92px}
  }`;

  function fmtTime(s) {
    const m = Math.floor(s / 60), ss = Math.floor(s % 60);
    return m + ':' + String(ss).padStart(2, '0');
  }
  function fmtDate(ms) {
    const d = new Date(ms);
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  function ensure() {
    if (wrap) return;
    if (!document.getElementById('wzbBoardCss')) {
      const st = document.createElement('style'); st.id = 'wzbBoardCss'; st.textContent = CSS;
      document.head.appendChild(st);
    }
    wrap = document.createElement('div');
    wrap.id = 'wzbBoard';
    wrap.innerHTML = `
      <div class="panel">
        <div class="hd"><h2>英雄榜</h2><button class="x" type="button">关闭</button></div>
        <div class="tabs"><button type="button" class="on" style="cursor:default">积分榜</button></div>
        <div class="body"></div>
        <div class="foot">评分 = 击杀×10 + 通关区域数×100 + 时间分 + 无伤分 · 共 6 个区域</div>
      </div>`;
    document.body.appendChild(wrap);
    body = wrap.querySelector('.body');
    wrap.querySelector('.x').addEventListener('click', close);
    wrap.addEventListener('pointerdown', e => e.stopPropagation());
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen()) close(); });
  }

  function render() {
    if (!body) return;
    if (loading) { body.innerHTML = '<div class="empty">正在读取榜单……</div>'; return; }
    if (err) { body.innerHTML = '<div class="empty">榜单暂时连不上<br><span style="font-size:12px">' + err + '</span></div>'; return; }
    const list = (data && data.list) || [];
    if (!list.length) {
      body.innerHTML = '<div class="empty">还没有人上榜<br>打一局就能留下名字</div>';
      return;
    }
    const rows = list.map((r, i) => {
      const cl = r.cleared == null ? '—' : (r.win ? (r.cleared + ' 通关') : String(r.cleared));
      return `<tr class="${r.me ? 'me' : ''}">
        <td style="width:26px;color:#b79c72">${i + 1}</td>
        <td class="rowName" title="${esc(r.name)}">${esc(r.name)}</td>
        <td class="num" style="font-size:16px">${r.score == null ? '-' : r.score}</td>
        <td class="num">${r.kills} 杀</td>
        <td class="num">${cl}</td>
        <td class="num">${fmtTime(r.t)}</td>
        <td style="text-align:right;color:#8d7a5e;font-size:12px">${fmtDate(r.at)}</td>
      </tr>`;
    }).join('');
    body.innerHTML = `<table>
      <thead><tr><th>#</th><th>玩家</th><th style="text-align:right">评分</th>
      <th style="text-align:right">击杀</th><th style="text-align:right">通关区域数</th>
      <th style="text-align:right">用时</th><th style="text-align:right">日期</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function load() {
    if (loading) return;
    loading = true; err = null; render();
    fetch('/api/scores', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status)))
      .then(j => { if (!j || !j.ok) throw new Error('接口返回异常'); data = j; })
      .catch(e => { err = e && e.message ? e.message : '网络错误'; })
      .then(() => { loading = false; render(); });
  }

  function open() {
    ensure(); load();
    wrap.classList.add('on');
  }
  function close() { if (wrap) wrap.classList.remove('on'); }
  function isOpen() { return !!(wrap && wrap.classList.contains('on')); }

  // 通关后提交成绩；失败不打扰玩家
  function submit(rec) {
    const payload = { name: rec && rec.name, kills: rec && rec.kills, t: rec && rec.t,
      zone: rec && rec.zone, win: !!(rec && rec.win), hits: rec && rec.hits };   // 关卡/通关/受击都要传，否则服务端算不出一样的评分
    return fetch('/api/scores', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(r => r.json().catch(() => ({ ok: false })))
      .then(j => { if (j && j.ok && typeof toast === 'function') toast('成绩已上传 · 首页可看英雄榜'); return j; })
      .catch(() => { if (typeof toast === 'function') toast('成绩上传失败（不影响游戏）'); return { ok: false }; });
  }

  window.BOARD = { open, close, submit, isOpen, reload: load };
})();
