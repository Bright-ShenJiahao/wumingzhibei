// 手机提示：浏览器一定有边框，只有“添加到主屏幕”后从桌面图标进入才是真全屏。
// 只在手机 + 标题页显示；点“知道了”后 7 天内不再出现。
(function () {
  const KEY = 'wzb-hint-fullscreen';
  const WEEK = 7 * 24 * 3600 * 1000;

  function ua() { return navigator.userAgent || ''; }
  function isMobile() { return /Android|iPhone|iPad|iPod|Mobile|MicroMessenger/i.test(ua()); }
  function isStandalone() {
    return (window.navigator.standalone === true) ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }
  function dismissedRecently() {
    try { const t = Number(localStorage.getItem(KEY) || 0); return t && Date.now() - t < WEEK; } catch (e) { return false; }
  }

  // 常见 App 的内置浏览器（它们的菜单里没有"添加到主屏幕"，必须先"在浏览器打开"）
  const INAPP = [
    [/MicroMessenger/i, '微信'],
    [/AlipayClient/i, '支付宝'],
    [/Weibo/i, '微博'],
    [/aweme|ByteLocale|BytedanceWebview|TikTok/i, '抖音'],
    [/DingTalk/i, '钉钉'],
    [/xhsdiscover|XHS/i, '小红书'],
    [/Kwai|Kuaishou/i, '快手'],
    [/baiduboxapp/i, '百度'],
    [/QQ\/|QQBrowser/i, 'QQ'],
  ];
  function inAppName() {
    const u = ua();
    for (const [re, name] of INAPP) if (re.test(u)) return name;
    return '';
  }

  function text() {
    const u = ua();
    const app = inAppName();
    if (app) return app + '里玩会留黑边：点右上角「···」→「在浏览器打开」→ 浏览器菜单里「添加到主屏幕」，之后从桌面图标进入才是全屏。';
    if (/Android/i.test(u)) return '加到主屏幕才能全屏：浏览器右上角「⋮」→「添加到主屏幕」，之后从桌面图标进入。';
    if (/iPhone|iPad|iPod/i.test(u)) return '加到主屏幕才能全屏：底部「分享」→「添加到主屏幕」，之后从桌面图标进入。';
    return '加到主屏幕才能全屏：浏览器菜单里选「添加到主屏幕」，之后从桌面图标进入。';
  }

  const CSS = `
  #wzbHint{display:none;position:fixed;left:0;right:0;top:0;z-index:26;
    padding:0 calc(12px + env(safe-area-inset-right)) 0 calc(12px + env(safe-area-inset-left));
    font-family:"PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif}
  body.wzb-title #wzbHint.on{display:flex}
  #wzbHint .box{flex:1;max-width:640px;margin:0 auto;display:flex;gap:10px;align-items:center;background:rgba(30,20,34,.92);
    border:1.5px solid #c9971f;border-radius:12px;padding:9px 12px;box-shadow:0 6px 18px rgba(0,0,0,.45)}
  #wzbHint .tx{flex:1;color:#f2e6c9;font-size:12.5px;line-height:1.55;letter-spacing:.02em}
  #wzbHint .ok{flex:none;background:rgba(255,216,110,.16);border:1px solid #c9971f;color:#ffd86e;
    border-radius:9px;padding:6px 12px;font-size:13px;font-weight:700;cursor:pointer}
  #wzbHint .ok:active{background:rgba(255,216,110,.3)}`;

  let box = null, shown = false;

  function ensure() {
    if (box) return;
    if (!document.getElementById('wzbHintCss')) {
      const st = document.createElement('style'); st.id = 'wzbHintCss'; st.textContent = CSS;
      document.head.appendChild(st);
    }
    box = document.createElement('div');
    box.id = 'wzbHint';
    box.innerHTML = '<div class="box"><div class="tx"></div><button class="ok" type="button">知道了</button></div>';
    box.querySelector('.tx').textContent = text();
    box.querySelector('.ok').addEventListener('click', e => {
      e.stopPropagation();
      try { localStorage.setItem(KEY, String(Date.now())); } catch (err) {}
      box.classList.remove('on');
    });
    box.addEventListener('pointerdown', e => e.stopPropagation());
    document.body.appendChild(box);
  }

  // 放在"开始游戏"按钮上方，避免挡住它（横屏时底部空间很紧）
  function place() {
    if (!box) return;
    const anchor = document.getElementById('tBoard') || document.getElementById('tName') || document.getElementById('tStart');
    const h = box.offsetHeight || 60;
    let top = (innerHeight - h) * 0.5;
    if (anchor) {
      const r = anchor.getBoundingClientRect();
      top = Math.max(8, r.top - h - 10);   // 放在"输入名字"上方，不压住输入框/教学模式/开始游戏
    }
    box.style.top = Math.round(top) + 'px';
  }

  function tick() {
    if (shown || dismissedRecently() || !isMobile() || isStandalone()) return;
    if (!document.body.classList.contains('wzb-title')) return;   // 只在标题页
    ensure();
    box.classList.add('on');
    place();
    shown = true;
    addEventListener('resize', place);
  }

  // 标题页 class 由 js/title.js 维护，这里周期性检查即可（开销可忽略）
  setInterval(tick, 800);
  addEventListener('DOMContentLoaded', tick);
})();
