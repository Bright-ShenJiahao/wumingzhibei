// 手机全屏提示：只要用手机打开就强制显示，直到在标题页勾选「关闭提醒」。
// 浏览器一定有工具栏/地址栏，只有"添加到主屏幕"后从桌面图标进入才是真全屏。
(function () {
  const KEY = 'wzb-hint-off';          // 勾选"关闭提醒"后写 '1'

  function ua() { return navigator.userAgent || ''; }
  function isMobile() { return /Android|iPhone|iPad|iPod|Mobile|MicroMessenger/i.test(ua()); }
  function isStandalone() {
    return (window.navigator.standalone === true) ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  }
  function off() { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } }

  // 常见 App 的内置浏览器（菜单里没有"添加到主屏幕"，必须先"在浏览器打开"）
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
    const u = ua(), app = inAppName();
    if (app) return app + '里玩会留黑边：点右上角「···」→「在浏览器打开」→ 浏览器菜单里「添加到主屏幕」，之后从桌面图标进入才是全屏。';
    if (/Android/i.test(u)) return '加到主屏幕才能全屏：浏览器右上角「⋮」→「添加到主屏幕」，之后从桌面图标进入。';
    if (/iPhone|iPad|iPod/i.test(u)) return '加到主屏幕才能全屏：底部「分享」→「添加到主屏幕」，之后从桌面图标进入。';
    return '加到主屏幕才能全屏：浏览器菜单里选「添加到主屏幕」，之后从桌面图标进入。';
  }

  const CSS = `
  #wzbHint{display:none;position:fixed;left:0;right:0;top:0;z-index:26;
    padding:0 calc(12px + env(safe-area-inset-right)) 0 calc(12px + env(safe-area-inset-left));
    font-family:"PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif;pointer-events:none}
  body.wzb-title #wzbHint.on{display:flex}
  #wzbHint .box{flex:1;max-width:640px;margin:0 auto;background:rgba(30,20,34,.92);
    border:1.5px solid #c9971f;border-radius:12px;padding:9px 13px;box-shadow:0 6px 18px rgba(0,0,0,.45)}
  #wzbHint .tx{color:#f2e6c9;font-size:12.5px;line-height:1.55;letter-spacing:.02em}
  #wzbHint .tail{margin-top:3px;color:#b9a273;font-size:11.5px}`;

  let box = null;

  function ensure() {
    if (box) return;
    if (!document.getElementById('wzbHintCss')) {
      const st = document.createElement('style'); st.id = 'wzbHintCss'; st.textContent = CSS;
      document.head.appendChild(st);
    }
    box = document.createElement('div');
    box.id = 'wzbHint';
    box.innerHTML = '<div class="box"><div class="tx"></div><div class="tail">不想看这条？在标题页勾选「关闭提醒」</div></div>';
    box.querySelector('.tx').textContent = text();
    document.body.appendChild(box);
  }

  // 放在「英雄榜」上方，避开输入框 / 教学模式 / 开始游戏
  function place() {
    if (!box) return;
    const anchor = document.getElementById('tBoard') || document.getElementById('tName') || document.getElementById('tStart');
    const h = box.offsetHeight || 60;
    let top = (innerHeight - h) * 0.35;
    if (anchor) top = Math.max(8, anchor.getBoundingClientRect().top - h - 10);
    box.style.top = Math.round(top) + 'px';
  }

  function tick() {
    if (!box) ensure();
    const shouldShow = isMobile() && !isStandalone() && !off() && document.body.classList.contains('wzb-title');
    const on = box.classList.contains('on');
    if (shouldShow && !on) { box.classList.add('on'); place(); addEventListener('resize', place); }
    else if (!shouldShow && on) box.classList.remove('on');
  }

  setInterval(tick, 500);
  addEventListener('DOMContentLoaded', tick);
})();
