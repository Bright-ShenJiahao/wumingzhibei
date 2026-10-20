// 结算分享：手机调系统分享面板，电脑复制到剪贴板，微信里只能提示点右上角。
// 只用浏览器的 Web Share API / clipboard，不引第三方库，也不改别的东西。
(() => {
  const url = () => location.origin + location.pathname;
  const isWeChat = () => /MicroMessenger/i.test(navigator.userAgent || '');
  const fmt = t => { const m = Math.floor(t / 60), s = Math.floor(t % 60); return m + ':' + (s < 10 ? '0' : '') + s; };

  // 文案随机挑一条，每次分享不完全一样
  const WIN = [
    r => `我在《无名之辈》里放倒了黄巾头目管亥：击倒 ${r.kills} 人，用时 ${fmt(r.time)}，评价 ${r.rank}。`,
    r => `《无名之辈》序章通关 —— ${r.kills} 杀 · ${fmt(r.time)} · ${r.rank} 评价。这成绩你敢比？`,
    r => `黄巾贼清完了。${fmt(r.time)} 打完序章，评价 ${r.rank}，${r.kills} 个人头。`,
    r => `东汉末年不好混，但我把管亥放倒了：${fmt(r.time)}，评价 ${r.rank}。`,
  ];
  const LOSE = [
    r => `我在《无名之辈》里被黄巾贼放倒了，只击倒 ${r.kills} 人……你来试试？`,
    r => `《无名之辈》：倒在半路，${r.kills} 杀。这黄巾贼比想象中难打。`,
    r => `刚在《无名之辈》里倒下，${r.kills} 杀。不服，再来。`,
  ];

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
    try {   // 老浏览器 / 非 https 时的退路
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch (e) { return false; }
  }

  // 返回值：shared / copied / wechat / cancel / fail
  async function send(r) {
    const pool = r.win ? WIN : LOSE;
    const line = pool[Math.floor(Math.random() * pool.length)](r);
    if (isWeChat()) return 'wechat';   // 微信内置浏览器调不起分享面板
    if (navigator.share) {
      try { await navigator.share({ title: '无名之辈', text: line, url: url() }); return 'shared'; }
      catch (e) { if (e && e.name === 'AbortError') return 'cancel'; }
    }
    return (await copy(line + ' ' + url())) ? 'copied' : 'fail';
  }

  window.SHARE = { send, text: (r) => (r.win ? WIN : LOSE)[0](r) };
})();
