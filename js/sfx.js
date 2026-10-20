// 音效：Web Audio 实时合成，不需要外部音频文件。
// 设计思路：每个音效由几层组成（瞬态 + 主体 + 尾音），用滤波后的噪声做挥风、布料、泥土，
// 用正弦/三角波做身体闷响和木头敲击，用不和谐泛音做金属声；每次播放带一点随机音高和音量，
// 避免连打时像机关枪；按画面左右位置做立体声；主输出经过轻微混响和压缩，让所有声音像在同一个空间里。
(() => {
  const KEY = 'wzb-muted';
  let muted = false;
  try { muted = localStorage.getItem(KEY) === '1'; } catch (e) {}
  let ac, master, verb, noiseBuf;

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return ac; }
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return null;
    ac = new A();
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = .003; comp.release.value = .15;
    master = ac.createGain(); master.gain.value = .8;
    master.connect(comp).connect(ac.destination);
    // 短混响：户外村庄，空间感很轻
    const len = Math.floor(ac.sampleRate * .7), ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    const conv = ac.createConvolver(); conv.buffer = ir;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200;
    verb = ac.createGain(); verb.gain.value = .22;
    verb.connect(conv).connect(lp).connect(master);
    // 共用噪声
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    return ac;
  }
  const R = (a, b) => a + Math.random() * (b - a);

  // 每次播放建立一条输出线：音量 → 立体声 → 主输出 + 混响
  function bus(pan, vol, wet) {
    const g = ac.createGain(); g.gain.value = vol;
    let out = g;
    if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = Math.max(-.8, Math.min(.8, pan || 0)); g.connect(p); out = p; }
    out.connect(master);
    const s = ac.createGain(); s.gain.value = wet; out.connect(s); s.connect(verb);
    return g;
  }
  // 包络：起音 a，持续到 a+d 衰减到 0
  function env(param, t, peak, a, d, curve = 'exp') {
    param.setValueAtTime(0.0001, t);
    param.linearRampToValueAtTime(peak, t + a);
    if (curve === 'exp') param.exponentialRampToValueAtTime(0.0001, t + a + d);
    else param.linearRampToValueAtTime(0.0001, t + a + d);
  }
  // 滤波噪声层：f0→f1 频率扫动
  function noise(out, t, { type = 'bandpass', f0 = 1000, f1 = f0, q = 1, gain = .5, a = .005, d = .1, hp = 0 }) {
    const src = ac.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = R(.9, 1.1);
    const f = ac.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + a + d);
    const g = ac.createGain(); env(g.gain, t, gain, a, d);
    let node = src.connect(f);
    if (hp) { const h = ac.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp; node = node.connect(h); }
    node.connect(g).connect(out);
    src.start(t, Math.random() * 1.5); src.stop(t + a + d + .05);
  }
  // 音调层：p0→p1 音高扫动
  function tone(out, t, { type = 'sine', p0 = 200, p1 = p0, gain = .5, a = .002, d = .1, lp = 0 }) {
    const o = ac.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(p0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, p1), t + a + d);
    const g = ac.createGain(); env(g.gain, t, gain, a, d);
    let node = o;
    if (lp) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node = o.connect(f); }
    node.connect(g).connect(out);
    o.start(t); o.stop(t + a + d + .05);
  }
  // 金属泛音（不和谐倍频），用于刀光、亮刀预警
  function ring(out, t, base, gain, d) {
    [1, 2.76, 5.4, 8.93].forEach((m, i) => tone(out, t, { p0: base * m, p1: base * m * .995, gain: gain / (i + 1.3), a: .001, d: d / (1 + i * .5) }));
  }

  const S = {
    // —— 主角挥空 ——
    swing_staff(o, t, k) {   // 粗木棍：低沉、慢一点的"呼——"
      noise(o, t, { f0: 260 * k, f1: 900 * k, q: 1.4, gain: .55, a: .07, d: .16 });
      noise(o, t + .05, { type: 'lowpass', f0: 500, f1: 180, gain: .35, a: .03, d: .14 });
    },
    swing_knife(o, t, k) {   // 柴刀：短促尖锐的"嗖"
      noise(o, t, { f0: 1600 * k, f1: 5200 * k, q: 2.2, gain: .45, a: .035, d: .09 });
      noise(o, t + .02, { f0: 900 * k, f1: 2400 * k, q: 1, gain: .22, a: .02, d: .08 });
    },
    swing_stone(o, t, k) {   // 甩手扔石子：短风声 + 指尖弹出
      noise(o, t, { f0: 700 * k, f1: 2000 * k, q: 1.6, gain: .35, a: .03, d: .08 });
      tone(o, t + .04, { type: 'triangle', p0: 1800 * k, p1: 1200, gain: .08, d: .02 });
    },
    // —— 命中 ——
    hit_staff(o, t, k) {     // 木棍砸肉：闷响 + 木头"梆"
      tone(o, t, { p0: 150 * k, p1: 52, gain: .9, d: .14 });
      noise(o, t, { type: 'lowpass', f0: 1800, f1: 250, gain: .6, a: .001, d: .09 });
      noise(o, t, { f0: 820 * k, q: 9, gain: .55, a: .001, d: .07 });
      tone(o, t, { type: 'triangle', p0: 390 * k, p1: 330, gain: .18, d: .06 });
    },
    hit_knife(o, t, k) {     // 刀砍：锐利的"嚓"+ 布料撕开 + 轻闷响
      noise(o, t, { type: 'highpass', f0: 4200 * k, gain: .55, a: .001, d: .05 });
      noise(o, t + .005, { f0: 2400 * k, f1: 900, q: 1.8, gain: .5, a: .002, d: .12 });
      tone(o, t, { p0: 120 * k, p1: 55, gain: .55, d: .1 });
      ring(o, t, 1900 * k, .05, .18);
    },
    hit_stone(o, t, k) {     // 石子打中："啪"的硬碰
      noise(o, t, { f0: 2600 * k, q: 6, gain: .45, a: .001, d: .035 });
      tone(o, t, { p0: 210 * k, p1: 80, gain: .55, d: .08 });
    },
    finisher(o, t, k) {      // 第三段重击：在命中声上加低频冲击和一点空间
      tone(o, t, { p0: 95 * k, p1: 34, gain: 1, d: .38 });
      noise(o, t, { type: 'lowpass', f0: 900, f1: 120, gain: .6, a: .002, d: .28 });
      noise(o, t + .01, { f0: 300, f1: 120, q: 1, gain: .3, a: .01, d: .3 });
    },
    // —— 身体动作 ——
    roll(o, t, k) {          // 翻滚：两下布料摩擦 + 泥土
      noise(o, t, { f0: 700 * k, f1: 1500, q: .9, gain: .22, a: .05, d: .12 });
      noise(o, t + .14, { f0: 900 * k, f1: 1900, q: .9, gain: .2, a: .05, d: .14 });
      noise(o, t + .1, { type: 'lowpass', f0: 380, f1: 150, gain: .28, a: .02, d: .2 });
    },
    land(o, t, k) {          // 被打飞落地：闷"咚" + 尘土
      tone(o, t, { p0: 90 * k, p1: 40, gain: .8, d: .2 });
      noise(o, t, { type: 'lowpass', f0: 600, f1: 150, gain: .55, a: .002, d: .22 });
      noise(o, t + .02, { f0: 2200, q: .8, gain: .12, a: .01, d: .18 });
    },
    enemyDown(o, t, k) {     // 敌人被打倒：更重的倒地
      tone(o, t, { p0: 75 * k, p1: 34, gain: .9, d: .32 });
      noise(o, t, { type: 'lowpass', f0: 500, f1: 120, gain: .6, a: .003, d: .3 });
      noise(o, t + .04, { f0: 1800, q: .7, gain: .14, a: .02, d: .25 });
    },
    hurt(o, t, k) {          // 主角挨打：闷击 + 短促的吸气声（低音量，偏闷）
      tone(o, t, { p0: 125 * k, p1: 48, gain: .9, d: .16, lp: 600 });
      noise(o, t, { type: 'lowpass', f0: 1400, f1: 300, gain: .55, a: .001, d: .1 });
      noise(o, t + .03, { f0: 1100 * k, f1: 700, q: 4, gain: .12, a: .02, d: .12 });
      noise(o, t + .03, { f0: 2400 * k, f1: 1600, q: 5, gain: .06, a: .02, d: .1 });
    },
    heroDown(o, t, k) {      // 主角倒下：重落地 + 低沉尾音
      S.land(o, t, .85);
      tone(o, t + .05, { type: 'triangle', p0: 110, p1: 55, gain: .25, a: .05, d: .9, lp: 400 });
    },
    // —— 敌人 ——
    enemySwing(o, t, k) {    // 敌人出手的风声（比主角低沉，便于分辨）
      noise(o, t, { f0: 380 * k, f1: 1100 * k, q: 1.3, gain: .32, a: .05, d: .12 });
    },
    bladeAlert(o, t, k) {    // 刀手举刀：亮刀的金属"铮——"，预警
      ring(o, t, 1250 * k, .16, .55);
      noise(o, t, { type: 'highpass', f0: 5000, gain: .1, a: .03, d: .15 });
    },
    sling(o, t, k) {         // 投石索甩出
      noise(o, t, { f0: 500 * k, f1: 1600, q: 1.5, gain: .3, a: .04, d: .1 });
      tone(o, t + .05, { type: 'triangle', p0: 900, p1: 500, gain: .06, d: .03 });
    },
    bow(o, t, k) {           // 弓弦"嘣" + 箭离弦
      tone(o, t, { type: 'triangle', p0: 210 * k, p1: 180, gain: .35, a: .001, d: .22 });
      tone(o, t, { type: 'sawtooth', p0: 420 * k, p1: 360, gain: .06, a: .001, d: .12, lp: 1500 });
      noise(o, t + .01, { f0: 1500, f1: 3500, q: 2, gain: .18, a: .02, d: .12 });
    },
    fireLand(o, t, k) {      // 火箭落地起火："轰"+ 噼啪
      noise(o, t, { type: 'lowpass', f0: 700, f1: 200, gain: .5, a: .01, d: .35 });
      for (let i = 0; i < 9; i++) noise(o, t + .05 + Math.random() * .6, { f0: R(1800, 4200), q: 6, gain: R(.08, .2), a: .001, d: R(.01, .03) });
    },
  };

  function updateButton() {
    const b = document.getElementById('bMute'); if (!b) return;
    b.textContent = muted ? '🔇' : '🔊'; b.title = muted ? '开启音效' : '静音';
    b.setAttribute('aria-label', b.title); b.classList.toggle('on', muted);
  }
  const b = document.getElementById('bMute');
  if (b) b.addEventListener('click', () => {
    muted = !muted; try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch (e) {}
    if (!muted) init(); updateButton();
  });
  updateButton();
  // 浏览器要求用户操作后才能出声：第一次按键/触摸时启动
  ['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, () => { if (!muted) init(); }, { once: true }));

  const VOL = { swing_staff: .5, swing_knife: .45, swing_stone: .4, hit_staff: .7, hit_knife: .6, hit_stone: .55, finisher: .6, roll: .55, land: .55, enemyDown: .6,
    hurt: .7, heroDown: .7, enemySwing: .4, bladeAlert: .35, sling: .4, bow: .45, fireLand: .55 };
  const WET = { finisher: .5, enemyDown: .35, heroDown: .5, bladeAlert: .4, fireLand: .3 };
  const lastAt = {};
  // 配音：ASSETS.voice 里的 mp3，第一次播放时解码并缓存
  const vcache = {};
  async function voice(name, pan = 0) {
    if (muted || !window.ASSETS || !ASSETS.voice || !ASSETS.voice[name] || !init()) return;
    try {
      if (!vcache[name]) { const buf = await (await fetch(ASSETS.voice[name])).arrayBuffer(); vcache[name] = await new Promise((ok, no) => ac.decodeAudioData(buf, ok, no)); }
      const src = ac.createBufferSource(); src.buffer = vcache[name];
      src.connect(bus(pan * .5, 1.1, .12)); src.start();
    } catch (e) {}
  }
  window.SFX = {
    voice,
    // name：音效名；pan：-1（左）到 1（右）
    play(name, pan = 0) {
      if (muted || !S[name]) return;
      if (!init()) return;
      const now = ac.currentTime;
      if (lastAt[name] && now - lastAt[name] < .025) return;   // 同一帧重复触发只播一次
      lastAt[name] = now;
      const o = bus(pan, (VOL[name] || .5) * R(.88, 1.05), WET[name] || .18);
      S[name](o, now + .005, R(.94, 1.06));
    },
  };
})();
