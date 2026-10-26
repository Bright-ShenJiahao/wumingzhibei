// 主界面 / 整军备战 / 校场页的轻音乐：《灯下》——温暖的 Lofi 电钢琴，72 BPM，32 小节循环。
// 「现实世界」的客厅感：钢琴分解和弦 + 五声旋律（A C D E G）+ 极轻的铺底长音 + 黑胶沙沙声。
// 全部 Web Audio 合成，不加载音频文件。render() 同时用于游戏里实时播放和离线试听渲染。
(() => {
  const BPM = 72, BEAT = 60 / BPM, BAR = BEAT * 4, BARS = 32;
  const m2f = m => 440 * Math.pow(2, (m - 69) / 12);

  // ---------- 和弦（每小节一个）：[低音, 分解和弦音...] ----------
  const CH = {
    Am: [45, 52, 55, 59, 60, 64],   // Am9：A E G B C E
    F:  [41, 48, 52, 57, 60, 64],   // Fmaj7：F C E A C E
    C:  [36, 48, 55, 62, 64, 67],   // Cadd9：C G D E G
    G:  [43, 50, 55, 59, 62, 64],   // G6：G D G B D E
    Dm: [38, 50, 57, 60, 64, 65],   // Dm9：D A C E F
    Em: [40, 47, 55, 59, 62, 67],   // Em7：E B G B D G
  };
  // 前奏 F G 引向 Am；A、A' 各8小节；B 段换和声；尾声收在 Am → Em，循环回到前奏
  const PROG = 'F G Am F C G Am F Dm Em Am F C G Am F Dm Em F G Em Am F G C C Dm Em F G Am Em'.split(' ');

  // ---------- 旋律：[小节, 拍, MIDI, 时值(拍), 力度] ----------
  // 前2小节只有和弦（前奏），A段(3-10) → A'段(11-18，高八度点缀) → B段(19-26) → 尾声(27-32，稀疏，接回开头)
  const MEL = [
    // A
    [2,0,76,1.5,.8],[2,1.5,74,.5,.6],[2,2,72,2,.7],
    [3,0,69,2,.7],[3,2.5,67,.5,.5],[3,3,69,1,.6],
    [4,0,72,1.5,.75],[4,1.5,74,.5,.6],[4,2,76,2,.75],
    [5,0,74,3,.7],[5,3,67,1,.45],
    [6,0,69,1.5,.7],[6,1.5,72,.5,.6],[6,2,76,1,.75],[6,3,79,1,.7],
    [7,0,81,2,.8],[7,2,79,1,.6],[7,3,76,1,.6],
    [8,0,74,1.5,.7],[8,1.5,72,.5,.55],[8,2,74,2,.65],
    [9,0,76,4,.65],
    // A'
    [10,0,76,1.5,.8],[10,1.5,74,.5,.6],[10,2,72,1,.7],[10,3,84,1,.45],
    [11,0,69,2,.7],[11,2.5,67,.5,.5],[11,3,72,1,.6],
    [12,0,76,1,.75],[12,1,74,1,.6],[12,2,76,1,.7],[12,3,79,1,.7],
    [13,0,81,3,.75],[13,3,79,1,.5],
    [14,0,84,1.5,.75],[14,1.5,81,.5,.6],[14,2,79,1,.65],[14,3,76,1,.6],
    [15,0,79,2,.7],[15,2,76,2,.6],
    [16,0,74,1.5,.65],[16,1.5,76,.5,.55],[16,2,72,2,.6],
    [17,0,69,4,.6],
    // B（换和声：F G Em Am / F G C C）
    [18,0,72,2,.65],[18,2,69,1,.55],[18,3,72,1,.55],
    [19,0,74,2,.65],[19,2,76,2,.6],
    [20,0,79,1.5,.7],[20,1.5,76,.5,.55],[20,2,74,2,.6],
    [21,0,76,3,.65],[21,3,72,1,.5],
    [22,0,72,1,.6],[22,1,74,1,.6],[22,2,76,1,.65],[22,3,79,1,.65],
    [23,0,81,2,.75],[23,2,79,2,.6],
    [24,0,76,4,.6],
    [25,2,79,1,.5],[25,3,76,1,.5],
    // 尾声
    [26,0,74,2,.55],[26,2,72,2,.5],
    [27,0,76,3,.55],
    [28,0,72,1.5,.5],[28,1.5,69,.5,.45],[28,2,67,2,.45],
    [29,0,69,4,.5],
    [31,2,64,2,.35],
  ];

  // 分解和弦节奏：每小节8个八分音符，取和弦音的下标（0=低音）
  const ARP = [0, 2, 3, 4, 5, 4, 3, 2];
  const ARP_SOFT = [0, 2, 4, null, 3, null, 4, null];   // 前奏与尾声更稀疏

  // 固定种子的随机数，让每次合成的人味抖动一样
  let seed = 7;
  const rand = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  // ---------- 音色 ----------
  function piano(ctx, out, t, midi, dur, vel) {
    const f = m2f(midi);
    const low = Math.max(0, Math.min(1, (72 - midi) / 36));       // 越低音越长
    const decay = 1.1 + 2.6 * low;
    const g = ctx.createGain(); g.connect(out);
    const peak = .16 * vel;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + .005);
    g.gain.setTargetAtTime(peak * .35, t + .005, decay * .35);    // 先快后慢的衰减
    const end = t + dur;
    g.gain.setTargetAtTime(0, end, .18);                            // 松键（制音器）
    const stop = end + 1.2;
    const partials = [1, .42, .22, .12, .07, .04];
    partials.forEach((a, i) => {
      const n = i + 1, o = ctx.createOscillator(), pg = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f * n * Math.sqrt(1 + .00035 * n * n);    // 轻微非谐，像琴弦
      o.detune.value = (rand() - .5) * 4;
      pg.gain.setValueAtTime(a, t);
      pg.gain.setTargetAtTime(a * .05, t, Math.max(.12, decay / (1 + .9 * i)));   // 高次泛音先消失 → 音色由亮变暗
      o.connect(pg); pg.connect(g); o.start(t); o.stop(stop);
    });
    // 琴槌敲击的一点噪声
    const nb = ctx.createBuffer(1, Math.floor(ctx.sampleRate * .03), ctx.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const ns = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
    ns.buffer = nb; bp.type = 'bandpass'; bp.frequency.value = Math.min(5000, f * 6); bp.Q.value = 1.2;
    ng.gain.value = .02 * vel; ns.connect(bp); bp.connect(ng); ng.connect(out); ns.start(t);
  }
  function pad(ctx, out, t, dur, notes) {
    const g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 700; lp.connect(out); g.connect(lp);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.022, t + 1.2);
    g.gain.setValueAtTime(.022, t + dur - .4); g.gain.linearRampToValueAtTime(0, t + dur + .8);
    notes.forEach(m => [-6, 6].forEach(dt => {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = m2f(m); o.detune.value = dt;
      o.connect(g); o.start(t); o.stop(t + dur + 1);
    }));
  }
  function vinyl(ctx, out, t, dur) {
    const len = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) {
      let v = (Math.random() * 2 - 1) * .0035;                        // 极轻的底噪
      if (Math.random() < .00008) v += (Math.random() * 2 - 1) * .16; // 很偶尔一声轻微爆点
      d[i] = v;
    }
    const s = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = b; hp.type = 'highpass'; hp.frequency.value = 2400; g.gain.value = .12;
    s.connect(hp); hp.connect(g); g.connect(out); s.start(t);
  }
  function makeBus(ctx, dest) {
    // 暖色总线：低通 + 简单混响
    const master = ctx.createGain(), lp = ctx.createBiquadFilter(), dry = ctx.createGain(), wet = ctx.createGain(), rev = ctx.createConvolver();
    lp.type = 'lowpass'; lp.frequency.value = 5200; lp.Q.value = .3;
    const len = Math.floor(ctx.sampleRate * 2.6), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    rev.buffer = ir; dry.gain.value = .82; wet.gain.value = .26;
    master.connect(lp); lp.connect(dry); lp.connect(rev); rev.connect(wet); dry.connect(dest); wet.connect(dest);
    return master;
  }

  // ---------- 排程：从 fromBar 开始排 bars 个小节，返回总时长 ----------
  function render(ctx, dest, t0, fromBar = 0, bars = BARS, bus = null) {
    const out = bus || makeBus(ctx, dest);
    for (let k = 0; k < bars; k++) {
      const bar = (fromBar + k) % BARS, t = t0 + k * BAR, chord = CH[PROG[bar]];
      const soft = bar < 2 || bar >= 26;
      (soft ? ARP_SOFT : ARP).forEach((idx, i) => {
        if (idx == null) return;
        const swing = i % 2 ? BEAT * .06 : 0;                           // 轻微摇摆
        const tt = t + i * BEAT / 2 + swing + (rand() - .5) * .012;
        const v = (idx === 0 ? .62 : .34 + rand() * .08) * (soft ? .85 : 1);
        piano(ctx, out, tt, chord[idx], idx === 0 ? BEAT * 3.5 : BEAT * 1.2, v);
      });
      pad(ctx, out, t, BAR, [chord[1], chord[3], chord[4]]);
      for (const [b, beat, midi, len, vel] of MEL) if (b === bar) piano(ctx, out, t + beat * BEAT + (rand() - .5) * .01, midi, len * BEAT, vel * 1.15);
    }
    return bars * BAR;
  }

  window.MENU_MUSIC = { BPM, BAR, BARS, render, vinyl, makeBus };
})();
