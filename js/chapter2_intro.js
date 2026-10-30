// 第二章开场：管亥伏诛后拔营赶赴主战场。由正式章节入口调用；对白期间冻结战斗。
(() => {
  const LINES = [
    { speaker: '旁白', portrait: null, text: '管亥伏诛，村庄暂得安宁。你随皇甫嵩、曹操所部拔营起行，赶赴黄巾主战场。' },
    { speaker: '传令兵', portrait: 'messenger', text: '禀骑都尉！张角已病故，然黄巾贼众顽抗不退！张梁、张宝各率残部护送张角棺椁，正企图北撤！' },
    { speaker: '曹操', portrait: 'caocao', text: '张角既死，贼众为何反倒死战不退？……那具棺椁里，恐怕另有蹊跷。' },
    { speaker: '曹操', portrait: 'caocao', text: '传我军令，全速追击！截下棺椁，看看他们到底在护送什么！' },
  ];
  const S = { active: false, index: 0, chars: 0, charClock: 0, t: 0, done: null };
  const TYPE_SPEED = .035;

  function start(onDone) {
    S.active = true; S.index = 0; S.chars = 0; S.charClock = 0; S.t = 0; S.done = onDone;
  }

  function finish() {
    S.active = false;
    const done = S.done; S.done = null;
    if (typeof done === 'function') done();
  }

  function advance() {
    if (!S.active) return;
    const line = LINES[S.index];
    if (S.chars < line.text.length) {
      S.chars = line.text.length;
      S.charClock = 0;
      return;
    }
    S.index++;
    if (S.index >= LINES.length) { finish(); return; }
    S.chars = 0; S.charClock = 0;
  }
  function skip() {
    if (!S.active) return;
    finish();
  }

  function onPointer(e) {
    if (!S.active) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    const target = e.target;
    if (target && target.closest && target.closest('#bR')) skip();
    else advance();
  }
  function onKey(e) {
    if (!S.active) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    if (e.repeat) return;
    if (e.code === 'KeyK') { skip(); return; }
    if (e.code === 'KeyJ' || e.code === 'Space' || e.code === 'Enter') advance();
  }
  document.addEventListener('pointerdown', onPointer, true);
  document.addEventListener('keydown', onKey, true);

  function wrapText(ctx, text, maxWidth) {
    const lines = []; let line = '';
    for (const ch of text) {
      if (line && ctx.measureText(line + ch).width > maxWidth) { lines.push(line); line = ch; }
      else line += ch;
    }
    if (line) lines.push(line);
    return lines;
  }

  function rounded(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else { ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); }
  }

  function drawPortrait(ctx, line, x, y, size) {
    if (!line.portrait) return;
    const im = IMG['dialog_' + line.portrait];
    if (!im || !im.complete || !im.naturalWidth) return;
    ctx.save();
    rounded(ctx, x, y, size, size, 5); ctx.clip();
    ctx.imageSmoothingEnabled = false;
    const scale = Math.max(size / im.width, size / im.height);
    const w = im.width * scale, h = im.height * scale;
    ctx.drawImage(im, x + (size - w) / 2, y + (size - h) / 2, w, h);
    ctx.restore();
  }

  function draw() {
    if (!S.active) return;
    const W = cv.width / DPR, H = cv.height / DPR;
    const line = LINES[S.index];
    const small = H < 520 || W < 760;
    const f = small ? Math.max(.62, Math.min(1, H / 480)) : 1;   // 手机横屏：整个对话框按屏幕高度再缩一档
    const panelW = Math.min(W - (small ? 18 : 36), 1240);
    const panelH = Math.round((small ? 130 : 176) * f);
    const px = (W - panelW) / 2;
    const py = Math.max(10, Math.min(H * .05, H - panelH - 70)) + (1 - Math.min(1, S.t / .22)) * -12;
    const avatar = line.portrait ? Math.round((small ? 88 : 142) * f) : 0;
    const left = px + (line.portrait ? avatar + (small ? 24 : 34) * f : (small ? 20 : 34));
    const rightPad = small ? 16 : 28;
    const nameY = py + (small ? 28 : 38) * f;
    const bodyY = py + (small ? 61 : 82) * f;
    const fontSize = Math.round((small ? 17 : 22) * f);
    const maxLines = small ? 3 : 2;

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.save();
    ctx.globalAlpha = Math.min(1, S.t / .18);
    // 开场使用确定好的黄昏主战场底图，保持整张构图完整铺满屏幕。
    const bg = IMG.chapter2_intro;
    if (bg && bg.complete && bg.naturalWidth) {
      const scale = Math.max(W / bg.naturalWidth, H / bg.naturalHeight);
      const bw = bg.naturalWidth * scale, bh = bg.naturalHeight * scale;
      ctx.drawImage(bg, (W - bw) / 2, (H - bh) / 2, bw, bh);
    }
    // 轻压底图亮度，让对白更清晰，同时仍能看清战场细节。
    ctx.fillStyle = 'rgba(18,12,10,.22)'; ctx.fillRect(0, 0, W, H);
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
    ctx.fillStyle = 'rgba(30,22,18,.91)'; rounded(ctx, px, py, panelW, panelH, 8); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.lineWidth = 2; ctx.strokeStyle = '#e5c98a'; rounded(ctx, px + 1, py + 1, panelW - 2, panelH - 2, 7); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,238,194,.38)'; rounded(ctx, px + 6, py + 6, panelW - 12, panelH - 12, 5); ctx.stroke();

    if (line.portrait) {
      const ax = px + (small ? 10 : 12) * f, ay = py + (small ? 10 : 12) * f;
      ctx.fillStyle = '#b78b4d'; rounded(ctx, ax - 3, ay - 3, avatar + 6, avatar + 6, 6); ctx.fill();
      ctx.fillStyle = '#241912'; rounded(ctx, ax, ay, avatar, avatar, 4); ctx.fill();
      drawPortrait(ctx, line, ax, ay, avatar);
    }

    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = `700 ${Math.round((small ? 17 : 24) * f)}px "PingFang SC","Microsoft YaHei",sans-serif`;
    ctx.fillStyle = '#f1cf75'; ctx.fillText(line.speaker, left, nameY);
    const nameW = ctx.measureText(line.speaker).width;
    ctx.fillStyle = 'rgba(211,165,83,.8)'; ctx.fillRect(left, nameY + 6, Math.min(nameW + 14, panelW * .26), 1.5);

    ctx.font = `700 ${fontSize}px "PingFang SC","Microsoft YaHei",sans-serif`;
    ctx.fillStyle = '#f7f0df';
    const shown = line.text.slice(0, S.chars);
    const lines = wrapText(ctx, shown, Math.max(80, panelW - (left - px) - rightPad)).slice(0, maxLines);
    lines.forEach((text, i) => ctx.fillText(text, left, bodyY + i * Math.round((small ? 23 : 31) * f)));

    // 右下角两块并排的小圆牌：J/攻击快进，K/翻滚整段跳过。
    const labels = small ? ['攻击 快进', '翻滚 跳过'] : ['J 快进', 'K 跳过'];
    const badgeW = small ? 70 : 88, badgeH = small ? 34 : 38, gap = small ? 7 : 9;
    const hx = px + panelW - badgeW * 2 - gap, hy = py + panelH + (small ? 8 : 12);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    labels.forEach((label, i) => {
      const x = hx + i * (badgeW + gap);
      ctx.fillStyle = 'rgba(26,19,17,.88)';
      rounded(ctx, x, hy, badgeW, badgeH, badgeH / 2); ctx.fill();
      ctx.strokeStyle = 'rgba(226,194,130,.48)'; ctx.lineWidth = 1;
      rounded(ctx, x, hy, badgeW, badgeH, badgeH / 2); ctx.stroke();
      ctx.fillStyle = '#f4ead7'; ctx.font = `700 ${small ? 11 : 12}px "PingFang SC","Microsoft YaHei",sans-serif`;
      ctx.fillText(label, x + badgeW / 2, hy + badgeH / 2 + .5);
    });
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  window.CHAPTER2_INTRO = Object.freeze({
    start,
    active: () => S.active,
    blocks: () => S.active,
    update(dt) {
      if (!S.active) return;
      S.t += dt;
      const line = LINES[S.index];
      if (S.chars < line.text.length) {
        S.charClock += dt;
        while (S.charClock >= TYPE_SPEED && S.chars < line.text.length) { S.charClock -= TYPE_SPEED; S.chars++; }
      }
    },
    draw,
  });
})();
