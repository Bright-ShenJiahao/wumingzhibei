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

  function onPointer(e) {
    if (!S.active) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    advance();
  }
  function onKey(e) {
    if (!S.active) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    if (e.repeat) return;
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
    const panelW = Math.min(W - (small ? 18 : 36), 1240);
    const panelH = small ? 130 : 176;
    const px = (W - panelW) / 2;
    const py = Math.max(14, Math.min(H * .075, H - panelH - 70)) + (1 - Math.min(1, S.t / .22)) * -12;
    const avatar = line.portrait ? (small ? 88 : 142) : 0;
    const left = px + (line.portrait ? avatar + (small ? 24 : 34) : (small ? 20 : 34));
    const rightPad = small ? 16 : 28;
    const nameY = py + (small ? 28 : 38);
    const bodyY = py + (small ? 61 : 82);
    const fontSize = small ? 17 : 22;
    const maxLines = small ? 3 : 2;

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.save();
    ctx.globalAlpha = Math.min(1, S.t / .18);
    // 轻压战场亮度，让原背景仍可辨认。
    ctx.fillStyle = 'rgba(18,12,10,.22)'; ctx.fillRect(0, 0, W, H);
    ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
    ctx.fillStyle = 'rgba(30,22,18,.91)'; rounded(ctx, px, py, panelW, panelH, 8); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.lineWidth = 2; ctx.strokeStyle = '#e5c98a'; rounded(ctx, px + 1, py + 1, panelW - 2, panelH - 2, 7); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,238,194,.38)'; rounded(ctx, px + 6, py + 6, panelW - 12, panelH - 12, 5); ctx.stroke();

    if (line.portrait) {
      const ax = px + (small ? 10 : 12), ay = py + (small ? 10 : 12);
      ctx.fillStyle = '#b78b4d'; rounded(ctx, ax - 3, ay - 3, avatar + 6, avatar + 6, 6); ctx.fill();
      ctx.fillStyle = '#241912'; rounded(ctx, ax, ay, avatar, avatar, 4); ctx.fill();
      drawPortrait(ctx, line, ax, ay, avatar);
    }

    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = `700 ${small ? 17 : 24}px "PingFang SC","Microsoft YaHei",sans-serif`;
    ctx.fillStyle = '#f1cf75'; ctx.fillText(line.speaker, left, nameY);
    const nameW = ctx.measureText(line.speaker).width;
    ctx.fillStyle = 'rgba(211,165,83,.8)'; ctx.fillRect(left, nameY + 6, Math.min(nameW + 14, panelW * .26), 1.5);

    ctx.font = `700 ${fontSize}px "PingFang SC","Microsoft YaHei",sans-serif`;
    ctx.fillStyle = '#f7f0df';
    const shown = line.text.slice(0, S.chars);
    const lines = wrapText(ctx, shown, Math.max(80, panelW - (left - px) - rightPad)).slice(0, maxLines);
    lines.forEach((text, i) => ctx.fillText(text, left, bodyY + i * (small ? 23 : 31)));

    // 参考示意图中的攻击键快进提示，手机/桌面都放在右下角安全区内。
    const hintW = small ? 142 : 176, hintH = small ? 36 : 42;
    const hx = W - hintW - (small ? 12 : 22), hy = H - hintH - (small ? 12 : 20);
    ctx.fillStyle = 'rgba(26,19,17,.84)'; rounded(ctx, hx, hy, hintW, hintH, hintH / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(226,194,130,.42)'; ctx.lineWidth = 1; rounded(ctx, hx, hy, hintW, hintH, hintH / 2); ctx.stroke();
    ctx.fillStyle = '#f4ead7'; ctx.beginPath(); ctx.arc(hx + (small ? 20 : 24), hy + hintH / 2, small ? 12 : 14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#352a20'; ctx.font = `800 ${small ? 14 : 16}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('A', hx + (small ? 20 : 24), hy + hintH / 2 + .5);
    ctx.textAlign = 'left'; ctx.fillStyle = '#f4ead7'; ctx.font = `700 ${small ? 13 : 15}px "PingFang SC","Microsoft YaHei",sans-serif`;
    ctx.fillText('点攻击 快进', hx + (small ? 39 : 47), hy + hintH / 2 + .5);
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
