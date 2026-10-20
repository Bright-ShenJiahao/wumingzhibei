// Web Audio 合成音效，无需加载外部音频文件。
(() => {
  const KEY = 'wzb-muted';
  let muted = localStorage.getItem(KEY) === '1';
  let audio;

  function context() {
    if (!audio) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return null;
      audio = new Audio();
    }
    if (audio.state === 'suspended') audio.resume();
    return audio;
  }

  function tone(ctx, from, to, duration, type = 'sine', volume = .12, delay = 0) {
    const osc = ctx.createOscillator(), gain = ctx.createGain();
    const start = ctx.currentTime + delay;
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
    gain.gain.setValueAtTime(.001, start);
    gain.gain.linearRampToValueAtTime(volume, start + Math.min(.012, duration / 3));
    gain.gain.exponentialRampToValueAtTime(.001, start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start); osc.stop(start + duration + .01);
  }

  const sounds = {
    swing: c => tone(c, 430, 95, .13, 'triangle', .09),
    hit: c => { tone(c, 155, 48, .11, 'square', .16); tone(c, 720, 210, .07, 'triangle', .07); },
    combo3: c => { tone(c, 220, 70, .2, 'sawtooth', .16); tone(c, 520, 110, .16, 'triangle', .11, .025); },
    roll: c => { tone(c, 300, 75, .22, 'triangle', .08); tone(c, 170, 65, .16, 'sawtooth', .035, .04); },
    hurt: c => { tone(c, 185, 82, .2, 'sawtooth', .13); tone(c, 270, 130, .12, 'square', .045); },
    enemyDown: c => { tone(c, 125, 38, .28, 'triangle', .17); tone(c, 78, 44, .2, 'sine', .12, .035); },
    heroDown: c => { tone(c, 210, 52, .48, 'sawtooth', .16); tone(c, 145, 38, .38, 'triangle', .14, .12); },
  };

  function updateButton() {
    const button = document.getElementById('bMute');
    if (!button) return;
    button.textContent = muted ? '🔇' : '🔊';
    button.title = muted ? '开启音效' : '静音';
    button.setAttribute('aria-label', button.title);
    button.classList.toggle('on', muted);
  }

  const button = document.getElementById('bMute');
  if (button) button.addEventListener('click', () => {
    muted = !muted;
    localStorage.setItem(KEY, muted ? '1' : '0');
    if (!muted) context();
    updateButton();
  });
  updateButton();

  window.SFX = {
    play(name) {
      if (muted || !sounds[name]) return;
      const ctx = context();
      if (ctx) sounds[name](ctx);
    },
  };
})();
