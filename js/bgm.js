// 背景音乐：Web Audio 实时合成，不用任何外部音频文件，也没有现成曲子的旋律。
// 调式：中国五声（宫商角徵羽）羽调式 A-C-D-E-G，乱世村庄的哀凉感。
// 乐器：低沉战鼓（正弦下坠 + 低频噪声）、拨弦（古筝/琵琶式的多倍频衰减 + 拨弦噪声）、
//       长音（埙/二胡式的三角波 + 颤音 + 气声）。
// 三首 16 小节的循环（村庄 90 BPM / 战斗 120 BPM / Boss 140 BPM），按小节循环、接缝处不断音；
// 切换时新旧两首同时跑 1.5 秒交叉淡入淡出。另有胜利、失败两段一次性短乐句。
// 不改 game.js：每 0.3 秒读一次 game.js 里的全局变量（won / over / zs / lockR）判断该放哪首。
// 静音跟随 js/sfx.js 的 SFX.isMuted()。
(() => {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;

  // ---------- 常量 ----------
  const OUT_LEVEL = .3;      // 总音量：约为音效的 37%（js/sfx.js 的主输出是 .8），不盖过打击声和配音
  const XFADE = 1.5;         // 换曲时淡入淡出（秒）
  const LOOK = .35;          // 提前排程的时间（秒）
  const A2 = 45;             // 五声基准音 A2
  const PENT = [0, 3, 5, 7, 10];   // 羽调式五声：A C D E G
  const m2f = m => 440 * Math.pow(2, (m - 69) / 12);
  const dn = d => A2 + 12 * Math.floor(d / 5) + PENT[d % 5];   // 五声级数 → MIDI（0=A2, 5=A3, 10=A4）

  // 鼓谱字符 → [音色, 力度]。每小节 16 个字符（16 分音符网格），'.' 表示空。
  const DRUM = { 1: ['kick', .3], 2: ['kick', .5], 3: ['kick', .78], 4: ['snare', .34], 5: ['tom', .5] };

  // ---------- 曲谱 ----------
  // drums：鼓谱片段；drumArr：16 小节各用哪个片段
  // ph：旋律片段（[16 分音符位置, 五声级数, 力度?, 余音?]）；melArr：16 小节各用哪个片段
  // tones：在某个小节开头上长音（形如 {小节: [级数, 拍数]}）
  const TRACKS = {
    // 村庄：中速，鼓点稀疏，古筝弹哀凉的短句，埙隔几小节吹一声长音
    village: {
      bpm: 90, bars: 16, lv: { drum: .48, pluck: .44, tone: .32 },
      drums: {
        a: '1...............',
        b: '1.......2.......',
        c: '1.......2...4...',
        d: '3.......2...4.2.',
      },
      drumArr: 'abacabacabadabac',
      ph: {
        a: [[0, 9], [6, 7], [10, 5]],
        b: [[0, 6], [4, 8], [8, 10], [12, 9]],
        c: [[0, 8], [6, 7], [10, 6], [14, 5]],
        d: [[0, 5], [8, 4]],
        e: [[0, 10], [4, 12], [8, 11]],
        f: [[0, 9], [6, 8], [10, 7], [14, 5]],
      },
      melArr: 'abcabefbacdabefd',
      tones: { 0: [5, 3], 4: [5, 3.5], 8: [7, 3], 12: [8, 4] },
    },
    // 战斗：快一些，鼓点密集（8 分音符脉动 + 收尾 16 分加花），拨弦连成急促的上下行
    battle: {
      bpm: 120, bars: 16, lv: { drum: .58, pluck: .4, tone: .28 },
      drums: {
        a: '3.2.3.1.3.2.1.2.',
        b: '3.2.3.13.2.1.24.',
        c: '3.3.2.1.3.3.2.1.',
        d: '3.13.2.13.2.34..',
      },
      drumArr: 'ababacbdababcdbd',
      ph: {
        a: [[0, 5], [2, 7], [4, 8], [6, 9], [8, 8], [10, 7], [12, 6], [14, 5]],
        b: [[0, 6], [2, 8], [4, 9], [6, 10], [8, 9], [10, 8], [12, 7], [14, 6]],
        c: [[0, 10], [2, 9], [4, 8], [6, 7], [8, 6], [10, 5], [12, 4], [14, 3]],
        d: [[0, 8], [1, 9], [2, 10], [4, 8], [6, 7], [8, 9], [10, 10], [12, 11], [14, 10]],
        e: [[0, 5], [1, 6], [2, 7], [3, 8], [4, 9], [6, 10], [8, 11], [10, 10], [12, 9], [14, 7]],
      },
      melArr: 'abacabaecbadabae',
      tones: { 0: [5, 2], 5: [9, 2.5], 10: [8, 2] },
    },
    // Boss：最快，重鼓连击 + 16 分拨弦 + 低音持续音（压迫感）
    boss: {
      bpm: 140, bars: 16, lv: { drum: .54, pluck: .4, tone: .28 },
      drone: { midi: 33, level: .075 },
      drums: {
        a: '3.2.3.1.3.2.3.1.',
        b: '3.2.3.23.2.3.1.4',
        c: '3.1.3.2.3.1.3.24',
        d: '3.1.2.1.3.2.44..',
      },
      drumArr: 'abababdcababcdba',
      ph: {
        a: [[0, 5], [1, 7], [2, 8], [3, 9], [4, 8], [6, 7], [8, 6], [10, 5], [12, 7], [14, 9]],
        b: [[0, 10], [1, 9], [2, 8], [3, 7], [4, 8], [6, 9], [8, 10], [10, 11], [12, 10], [14, 9]],
        c: [[0, 12], [1, 10], [2, 9], [3, 8], [4, 9], [5, 10], [6, 11], [8, 12], [10, 11], [12, 10], [14, 9]],
        d: [[0, 7], [2, 7], [4, 9], [6, 9], [8, 10], [10, 10], [12, 11], [14, 12]],
        e: [[0, 3], [2, 4], [4, 5], [6, 7], [8, 9], [10, 10], [12, 12], [14, 13]],
      },
      melArr: 'abacabdcacbedbac',
      tones: { 0: [3, 3], 7: [5, 2.5], 12: [2, 3] },
    },
  };

  // 把旋律片段展开成「整首循环里的绝对步数 → 音符」，并顺手检查曲谱长度
  function buildTracks() {
    for (const name in TRACKS) {
      const T = TRACKS[name];
      T.melMap = new Map();
      if (T.drumArr.length !== T.bars || T.melArr.length !== T.bars) console.warn('[BGM] 段落数不等于小节数：' + name);
      for (let bar = 0; bar < T.bars; bar++) {
        const dp = T.drums[T.drumArr[bar]];
        if (!dp || dp.length !== 16) console.warn('[BGM] 鼓谱必须 16 步：' + name + '.' + T.drumArr[bar]);
        for (const [st, d, vel, dur] of T.ph[T.melArr[bar]] || []) T.melMap.set(bar * 16 + st, [d, vel, dur]);
      }
    }
  }
  buildTracks();

  // ---------- 音频节点 ----------
  let ac = null, out = null, noiseBuf = null;
  let layers = [], state = null, muted = false, started = false, jingle = null;
  let schedT = 0, pollT = 0;

  function noiseSrc() {
    if (!noiseBuf) {
      noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 1.5), ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    return s;
  }
  const osc = (type, f, t) => { const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); return o; };

  // 战鼓：鼓皮的下坠正弦 + 鼓槌的闷响；重击再补一层很低的下潜（余震）
  function drum(t, kind, vel, dest) {
    if (!(vel > 0)) return;
    if (kind === 'snare') {   // 鼓边／脆击
      const g = ac.createGain(); g.connect(dest);
      const s = noiseSrc(), f = ac.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 1700; f.Q.value = .9;
      s.connect(f).connect(g);
      g.gain.setValueAtTime(vel * .9, t);
      g.gain.exponentialRampToValueAtTime(.0001, t + .13);
      s.start(t, Math.random()); s.stop(t + .16);
      return;
    }
    const g = ac.createGain(); g.connect(dest);
    const o = osc('sine', kind === 'tom' ? 250 : 150, t);
    o.frequency.exponentialRampToValueAtTime(kind === 'tom' ? 105 : 44, t + (kind === 'tom' ? .26 : .2));
    o.connect(g);
    g.gain.setValueAtTime(.0001, t);
    g.gain.linearRampToValueAtTime(vel, t + .006);
    g.gain.exponentialRampToValueAtTime(.0001, t + (kind === 'tom' ? .32 : .46));
    o.start(t); o.stop(t + .55);
    const s = noiseSrc(), lp = ac.createBiquadFilter(), ng = ac.createGain();
    lp.type = 'lowpass'; lp.frequency.value = kind === 'tom' ? 900 : 420;
    s.connect(lp).connect(ng).connect(dest);
    ng.gain.setValueAtTime(vel * .5, t);
    ng.gain.exponentialRampToValueAtTime(.0001, t + .09);
    s.start(t, Math.random()); s.stop(t + .12);
    if (kind === 'kick' && vel > .45) {
      const o2 = osc('sine', 72, t), g2 = ac.createGain();
      o2.frequency.exponentialRampToValueAtTime(36, t + .5);
      o2.connect(g2).connect(dest);
      g2.gain.setValueAtTime(.0001, t);
      g2.gain.linearRampToValueAtTime(vel * .6, t + .02);
      g2.gain.exponentialRampToValueAtTime(.0001, t + .7);
      o2.start(t); o2.stop(t + .8);
    }
  }

  // 拨弦（古筝/琵琶）：几个倍频同时衰减，低通随音量往下扫，再叠一点指甲拨弦的"咔"
  function pluck(t, midi, vel, dest, dur = .7) {
    if (!(vel > 0)) return;
    const f = m2f(midi);
    const g = ac.createGain(); g.connect(dest);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = .7;
    lp.frequency.setValueAtTime(Math.min(9000, f * 9), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(260, f * 1.6), t + .3);
    lp.connect(g);
    for (const [mul, amp, type] of [[1, 1, 'triangle'], [2, .4, 'sine'], [3, .18, 'sine'], [4.02, .1, 'sine']]) {
      const o = osc(type, f * mul, t);
      o.detune.value = (Math.random() - .5) * 7;
      const og = ac.createGain(); og.gain.value = amp;
      o.connect(og).connect(lp); o.start(t); o.stop(t + dur + .1);
    }
    g.gain.setValueAtTime(.0001, t);
    g.gain.linearRampToValueAtTime(vel, t + .005);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    const s = noiseSrc(), hp = ac.createBiquadFilter(), ng = ac.createGain();
    hp.type = 'highpass'; hp.frequency.value = 2400;
    s.connect(hp).connect(ng).connect(dest);
    ng.gain.setValueAtTime(vel * .18, t);
    ng.gain.exponentialRampToValueAtTime(.0001, t + .045);
    s.start(t, Math.random()); s.stop(t + .07);
  }

  // 长音（埙/二胡）：缓慢起音 + 颤音 + 气声，长尾音
  function longTone(t, midi, dur, vel, dest) {
    if (!(vel > 0)) return;
    const f = m2f(midi);
    const g = ac.createGain(); g.connect(dest);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.value = Math.min(3000, f * 5); lp.Q.value = .6; lp.connect(g);
    const vib = ac.createOscillator(); vib.frequency.value = 4.8;
    const vg = ac.createGain(); vg.gain.value = f * .008;
    vib.connect(vg);
    for (const [mul, amp, type] of [[1, .8, 'triangle'], [2, .22, 'sine'], [3, .1, 'sine']]) {
      const o = osc(type, f * mul, t);
      vg.connect(o.frequency);
      const og = ac.createGain(); og.gain.value = amp;
      o.connect(og).connect(lp); o.start(t); o.stop(t + dur + .9);
    }
    vib.start(t); vib.stop(t + dur + .9);
    g.gain.setValueAtTime(.0001, t);
    g.gain.linearRampToValueAtTime(vel, t + Math.min(.45, dur * .4));
    g.gain.setValueAtTime(vel, t + dur);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur + .8);
    const s = noiseSrc(), bp = ac.createBiquadFilter(), ng = ac.createGain();
    bp.type = 'bandpass'; bp.frequency.value = f * 3; bp.Q.value = 1.4;
    s.connect(bp).connect(ng).connect(dest);
    ng.gain.setValueAtTime(.0001, t);
    ng.gain.linearRampToValueAtTime(vel * .12, t + .4);
    ng.gain.setValueAtTime(vel * .12, t + dur);
    ng.gain.exponentialRampToValueAtTime(.0001, t + dur + .6);
    s.start(t, Math.random()); s.stop(t + dur + .7);
  }

  // ---------- 循环曲 ----------
  function playStep(L, bar, st, t) {
    const T = L.track;
    const dp = T.drums[T.drumArr[bar]];
    if (dp) {
      const c = dp[st];
      if (c && c !== '.') { const d = DRUM[c]; if (d) drum(t, d[0], d[1] * T.lv.drum, L.gain); }
    }
    const ev = T.melMap.get(bar * 16 + st);
    if (ev) pluck(t, dn(ev[0]), (ev[1] || .34) * T.lv.pluck, L.gain, ev[2] || .7);
    if (st === 0 && T.tones && T.tones[bar]) {
      const [d, beats] = T.tones[bar];
      longTone(t, dn(d), beats * 60 / T.bpm, T.lv.tone, L.gain);
    }
  }

  function newLayer(name) {
    const T = TRACKS[name];
    const g = ac.createGain(); g.gain.value = .0001; g.connect(out);
    const L = { name, track: T, gain: g, step: 0, time: ac.currentTime + .12, spb: 60 / T.bpm / 4, nodes: [] };
    if (T.drone) {   // 低音持续音，跟着本曲一起淡入淡出
      const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = m2f(T.drone.midi);
      const dg = ac.createGain(); dg.gain.value = T.drone.level;
      const lfo = ac.createOscillator(); lfo.frequency.value = .17;
      const lg = ac.createGain(); lg.gain.value = T.drone.level * .45;
      lfo.connect(lg).connect(dg.gain);
      o.connect(dg).connect(g);
      o.start(); lfo.start();
      L.nodes.push(o, lfo);
    }
    layers.push(L);
    return L;
  }

  function stopLayer(L, dur) {
    if (!L || L.stopping) return;
    L.stopping = true;
    const t = ac.currentTime;
    L.gain.gain.cancelScheduledValues(t);
    L.gain.gain.setValueAtTime(Math.max(.0001, L.gain.gain.value), t);
    L.gain.gain.linearRampToValueAtTime(.0001, t + dur);
    setTimeout(() => {
      for (const n of L.nodes) { try { n.stop(); } catch (e) {} }
      try { L.gain.disconnect(); } catch (e) {}
      layers = layers.filter(x => x !== L);
    }, (dur + .25) * 1000);
  }

  function pump() {
    if (!ac || ac.state !== 'running') return;
    const ahead = ac.currentTime + LOOK;
    for (const L of layers.slice()) {
      if (L.time < ac.currentTime - .2) L.time = ac.currentTime + .05;   // 被系统休眠/切后台后别补一堆音
      const total = L.track.bars * 16;
      while (L.time < ahead) {
        const s = L.step % total;
        playStep(L, Math.floor(s / 16), s % 16, L.time);
        L.step++; L.time += L.spb;
      }
    }
  }

  // ---------- 胜利 / 失败（一次性） ----------
  const JINGLE_LEN = { victory: 4.2, defeat: 4.8 };
  const JINGLES = {
    // 胜利：五声上行号角 + 鼓，落在明亮的宫和弦上
    victory(g, t) {
      [[0, 57], [.2, 64], [.4, 69], [.6, 72], [.8, 76], [1.0, 81]].forEach(([dt, m]) => {
        pluck(t + dt, m, .4, g, .9); drum(t + dt, 'kick', .42, g);
      });
      drum(t + 1.15, 'snare', .3, g);
      drum(t + 1.18, 'snare', .34, g);
      pluck(t + 1.3, 48, .28, g, 1.2);
      [60, 64, 67, 72].forEach(m => pluck(t + 1.3, m, .22, g, 2.3));
      drum(t + 1.3, 'kick', .8, g);
      longTone(t + 1.35, 72, 1.5, .2, g);
      drum(t + 2.25, 'kick', .3, g);
    },
    // 失败：低沉下行 + 一声哀凉的埙
    defeat(g, t) {
      drum(t, 'kick', .6, g);
      [[0, 69], [.45, 67], [.95, 64], [1.5, 62], [2.05, 60], [2.65, 57]].forEach(([dt, m], i) => {
        pluck(t + dt, m, .32 - i * .015, g, 1.2);
      });
      drum(t + 2.65, 'kick', .5, g);
      longTone(t + .9, 57, 2.4, .2, g);
      longTone(t + .9, 45, 2.4, .12, g);
      drum(t + 3.55, 'kick', .32, g);
    },
  };

  function playJingle(name) {
    stopJingle(.2);
    const g = ac.createGain(); g.gain.value = 1; g.connect(out);
    const t0 = ac.currentTime + .06;
    JINGLES[name](g, t0);
    jingle = g;
    const len = JINGLE_LEN[name] * 1000;
    setTimeout(() => { if (jingle === g) { jingle = null; try { g.disconnect(); } catch (e) {} } }, len);
  }
  function stopJingle(dur) {
    const g = jingle; if (!g) return;
    jingle = null;
    const t = ac.currentTime;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(.0001, t + dur);
    setTimeout(() => { try { g.disconnect(); } catch (e) {} }, (dur + .1) * 1000);
  }

  // ---------- 状态 ----------
  // 读 game.js 的全局变量（同一个 <script> 里，let 声明的可以直接读；开局前是 TDZ，用 try 兜住）
  function readState() {
    try {
      if (typeof won !== 'undefined' && won) return 'victory';
      if (typeof over !== 'undefined' && over) return 'defeat';
      if (typeof zs !== 'undefined' && zs && zs.some && zs.some(z => z && z.T && z.T.boss && !z.dead)) return 'boss';
      if (typeof lockR !== 'undefined' && lockR < Infinity) return 'battle';
    } catch (e) {}
    return 'village';
  }

  function applyState(st) {
    const prev = state; state = st;
    if (st === 'victory' || st === 'defeat') {
      if (layers.length) { layers.slice().forEach(L => stopLayer(L, .6)); }
      if (prev !== st) playJingle(st);
      return;
    }
    stopJingle(.4);
    const cur = layers[layers.length - 1];
    if (cur && cur.name === st && !cur.stopping) return;
    layers.filter(L => !L.stopping).forEach(L => stopLayer(L, XFADE));
    const L = newLayer(st);
    const t = ac.currentTime;
    L.gain.gain.setValueAtTime(.0001, t);
    L.gain.gain.linearRampToValueAtTime(1, t + XFADE);
  }

  function applyVolume() {
    if (!out) return;
    const t = ac.currentTime;
    out.gain.cancelScheduledValues(t);
    out.gain.setValueAtTime(out.gain.value, t);
    out.gain.linearRampToValueAtTime(muted ? .0001 : OUT_LEVEL, t + .12);
  }

  // 系统有时会把音频上下文挂起（切后台、来电），在手势或轮询时顺手恢复
  function resumeAudio() { if (ac && ac.state === 'suspended' && !document.hidden) { try { ac.resume(); } catch (e) {} } }
  function poll() {
    if (!started || !ac) return;
    resumeAudio();
    const st = readState();
    if (st !== state) applyState(st);
    const m = !!(window.SFX && typeof SFX.isMuted === 'function' && SFX.isMuted());
    if (m !== muted) { muted = m; applyVolume(); }
  }

  // ---------- 启动（浏览器要求先有用户操作） ----------
  function boot() {
    if (started) return;
    started = true;
    try {
      ac = new AC();
      out = ac.createGain();
      out.gain.value = .0001;
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = .01; comp.release.value = .2;
      // 手机喇叭放不出低频战鼓，给整体加一点高频，旋律和拨弦才听得见
      const hs = ac.createBiquadFilter(); hs.type = 'highshelf'; hs.frequency.value = 2400; hs.gain.value = 4.5;
      out.connect(hs).connect(comp).connect(ac.destination);
      if (ac.state === 'suspended') ac.resume();
      muted = !!(window.SFX && typeof SFX.isMuted === 'function' && SFX.isMuted());
      out.gain.linearRampToValueAtTime(muted ? .0001 : OUT_LEVEL, ac.currentTime + 1.2);
      state = null;
      applyState(readState());
      schedT = setInterval(pump, 40);
      pollT = setInterval(poll, 300);
      document.addEventListener('visibilitychange', onVisible);
    } catch (e) {
      started = false;
      console.warn('[BGM] 启动失败：', e);
    }
  }

  // 切到后台就挂起，回来时把排程时间对齐，避免一次补放很多音
  function onVisible() {
    if (!ac) return;
    if (document.hidden) { try { ac.suspend(); } catch (e) {} return; }
    try { ac.resume(); } catch (e) {}
    const now = ac.currentTime;
    for (const L of layers) if (L.time < now) L.time = now + .1;
  }

  ['pointerdown', 'touchend', 'keydown', 'click'].forEach(ev => addEventListener(ev, boot, { capture: true, passive: true }));
  ['pointerdown', 'touchend', 'keydown', 'click'].forEach(ev => addEventListener(ev, resumeAudio, { capture: true, passive: true }));

  // 供调试/其它模块使用（不改 game.js）
  window.BGM = {
    start: boot,
    state: () => state,
    isMuted: () => muted,
  };
})();
