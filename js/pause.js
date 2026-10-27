// 战斗暂停与安全退出；战斗状态检查和重开/退出由 game.js 的窄接口提供。
(() => {
  let paused = false, elapsed = 0;
  const style = document.createElement('style');
  style.id = 'pauseStyle';
  style.textContent = `
    #bPause{width:40px;height:42px;min-width:40px;padding:0;display:flex;align-items:center;justify-content:center;gap:3px}
    #bPause .pause-icon-bar{display:block;width:4px;height:16px;border-radius:2px;background:currentColor}
    #bPause[hidden]{display:none!important}
    #pauseScreen{position:fixed;inset:0;z-index:40;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box;background:rgba(8,6,5,.76);color:#f2dfb9;font-family:"PingFang SC","Microsoft YaHei",sans-serif}
    #pauseScreen[hidden],#pauseMenu[hidden],#pauseConfirm[hidden]{display:none!important}
    .pause-paper{box-sizing:border-box;width:min(390px,92vw);max-height:94dvh;overflow:auto;padding:clamp(22px,5vh,42px) clamp(26px,6vw,54px);background-position:center;background-size:100% 100%;filter:drop-shadow(0 12px 28px #000b);text-align:center}
    .pause-paper h2{margin:8px 0 18px;color:#583b20;font:700 clamp(25px,5vh,34px) MaShanZheng,"STKaiti",serif;text-shadow:0 1px #f5e2b4}
    .pause-actions{display:grid;gap:9px}
    .pause-action{box-sizing:border-box;width:100%;min-height:48px;padding:8px 14px;border:1px solid #9e7541;border-radius:6px;background-position:center;background-size:100% 100%;color:#f7e5bd;font:700 17px MaShanZheng,"STKaiti",serif;text-shadow:0 1px 2px #2d1b0e;cursor:pointer;touch-action:manipulation}
    .pause-action:active{transform:translateY(1px);filter:brightness(1.12)}
    .pause-volume{margin:13px 0 0;color:#593c21;font-size:14px}
    .pause-volume button{min-height:44px;margin-left:8px;padding:5px 12px;border:1px solid #8b673b;border-radius:5px;background:#513821;color:#f6e1b5;font-weight:700;touch-action:manipulation}
    #pauseConfirm .pause-paper{width:min(430px,92vw)}
    #pauseConfirm p{margin:8px 0 18px;color:#4d341e;font-size:16px;line-height:1.7}
    .pause-confirm-actions{display:flex;gap:10px;justify-content:center}
    .pause-confirm-actions .pause-action{flex:1;min-height:48px}
    @media(pointer:coarse){#bPause{width:46px;height:46px;min-width:46px}}
    @media(max-height:430px){.pause-paper{padding:26px 30px 14px;max-height:96dvh}.pause-paper h2{margin:6px 0 8px;font-size:24px}.pause-actions{grid-template-columns:1fr 1fr;gap:6px}.pause-action{min-height:44px;padding:5px 9px;font-size:15px}.pause-volume{margin-top:7px}.pause-volume button{min-height:40px}}
  `;
  document.head.appendChild(style);

  const pauseButton = document.createElement('button');
  pauseButton.id = 'bPause'; pauseButton.type = 'button';
  pauseButton.innerHTML = '<span class="pause-icon-bar" aria-hidden="true"></span><span class="pause-icon-bar" aria-hidden="true"></span>';
  pauseButton.title = '暂停'; pauseButton.setAttribute('aria-label', '暂停'); pauseButton.hidden = true;
  const toolbar = document.getElementById('wp'), muteButton = document.getElementById('bMute');
  if (toolbar) muteButton ? muteButton.after(pauseButton) : toolbar.append(pauseButton);

  const screen = document.createElement('div'); screen.id = 'pauseScreen'; screen.hidden = true;
  const menu = document.createElement('section'); menu.id = 'pauseMenu'; menu.className = 'pause-paper'; menu.setAttribute('role', 'dialog'); menu.setAttribute('aria-modal', 'true'); menu.setAttribute('aria-labelledby', 'pauseTitle');
  const confirm = document.createElement('section'); confirm.id = 'pauseConfirm'; confirm.hidden = true;
  const scroll = typeof ASSETS !== 'undefined' && ASSETS.ui && ASSETS.ui.scroll;
  const btn = typeof ASSETS !== 'undefined' && ASSETS.ui && ASSETS.ui.btn;
  if (scroll) { menu.style.backgroundImage = `url("${scroll}")`; }
  menu.innerHTML = '<h2 id="pauseTitle">暂停</h2><div class="pause-actions"><button class="pause-action" data-pause="resume">继续</button><button class="pause-action" data-pause="restart">重新开始</button><button class="pause-action" data-pause="preparation">返回整备</button><button class="pause-action" data-pause="home">返回主界面</button><button class="pause-action" data-pause="reload">重新载入游戏</button></div>';
  menu.querySelectorAll('.pause-action').forEach(b => { b.type = 'button'; if (btn) b.style.backgroundImage = `url("${btn}")`; });
  const volumeButton = menu.querySelector('[data-pause="volume"]');
  confirm.innerHTML = '<section class="pause-paper"><h2>确认退出</h2><p>确定退出这一局？已拾取的装备会保留。</p><div class="pause-confirm-actions"><button class="pause-action" data-confirm="yes">确定</button><button class="pause-action" data-confirm="no">取消</button></div></section>';
  if (scroll) confirm.querySelector('.pause-paper').style.backgroundImage = `url("${scroll}")`;
  confirm.querySelectorAll('.pause-action').forEach(b => { if (btn) b.style.backgroundImage = `url("${btn}")`; });
  screen.append(menu, confirm); document.body.appendChild(screen);

  const game = () => window.GAME_PAUSE;
  const allowed = () => !!(game() && game().canPause && game().canPause());
  function syncVolume() {
    const muted = !!(window.SFX && SFX.isMuted && SFX.isMuted());
    if (volumeButton) { volumeButton.textContent = muted ? '🔇 已静音' : '🔊 已开启'; volumeButton.setAttribute('aria-label', muted ? '开启音量' : '关闭音量'); }
  }
  function setPaused(value) {
    if (value && !allowed()) return false;
    paused = !!value;
    screen.hidden = !paused; confirm.hidden = true; menu.hidden = false;
    document.body.classList.toggle('wzb-paused', paused);
    pauseButton.setAttribute('aria-label', paused ? '继续游戏' : '暂停');
    pauseButton.title = paused ? '继续游戏' : '暂停';
    if (paused) {
      elapsed = 0;
      if (game().clearInput) game().clearInput();
      if (window.SFX && SFX.setPauseDucked) SFX.setPauseDucked(true);
      if (window.BGM && BGM.setPauseDucked) BGM.setPauseDucked(true);
      syncVolume();
    } else {
      if (window.SFX && SFX.setPauseDucked) SFX.setPauseDucked(false);
      if (window.BGM && BGM.setPauseDucked) BGM.setPauseDucked(false);
    }
    return true;
  }
  function ask(action) {
    confirm.querySelector('p').textContent=action==='reload'?'重新载入会退出这一局，已拾取的装备会保留':'确定退出这一局？已拾取的装备会保留。';
    confirm.dataset.action = action; menu.hidden = true; confirm.hidden = false;
  }
  function execute(action) {
    if(action==='reload'){location.reload();return;}
    const api = game(); setPaused(false);
    if (!api) return;
    if (action === 'restart' && api.restart) api.restart();
    else if (action === 'preparation' && api.returnPreparation) api.returnPreparation();
    else if (action === 'home' && api.returnHome) api.returnHome();
  }
  pauseButton.addEventListener('click', () => setPaused(!paused));
  menu.addEventListener('click', e => {
    const action = e.target.closest('[data-pause]')?.dataset.pause;
    if (action === 'resume') setPaused(false);
    else if (action === 'restart' || action === 'preparation' || action === 'home' || action === 'reload') ask(action);
    else if (action === 'volume') {
      if (window.SFX && SFX.toggleMute) SFX.toggleMute(); else if (muteButton) muteButton.click();
      syncVolume();
    }
  });
  confirm.addEventListener('click', e => {
    const yes = e.target.closest('[data-confirm]')?.dataset.confirm;
    if (yes === 'no') { confirm.hidden = true; menu.hidden = false; }
    if (yes === 'yes') execute(confirm.dataset.action);
  });
  function onKey(e) {
    if (!allowed() || !['Escape', 'KeyP'].includes(e.code) || e.repeat) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); setPaused(!paused);
  }
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('blur', () => { if (allowed()) setPaused(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && allowed()) setPaused(true); });

  window.PAUSE = {
    paused: () => paused,
    update(dt) { if (paused) elapsed += dt; },
    syncButton() {
      const show = allowed(); pauseButton.hidden = !show;
      if (!show && paused) setPaused(false);
    },
  };
})();
