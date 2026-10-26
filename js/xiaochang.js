// 校场仅供开发者检查地图；不启动章节波次、装备掉落或结算。
window.XIAOCHANG = (() => {
  let active = false;
  const FENCE_RATIO = 264 / 434;

  function refillXiaochangProps() {
    if (!active) return;
    const pool = ['hay', 'cart', 'mill'];
    const cartH = ASSETS.props.cart[2];
    let count = props.filter(p => p.xiaochang && !p.broken).length;
    for (let tries = 0; count < 3 && tries < 200; tries++) {
      const g = pool[Math.floor(Math.random() * pool.length)];
      const [, pw, ph] = ASSETS.props[g];
      const sc = g === 'cart' ? .5 : g === 'mill' ? cartH * .5 / ph : 1;
      const x = Math.random() < .5 ? rnd(60, 220) : rnd(500, 660);
      const y = rnd(M.top + 24, M.bot - 8), w = pw * .75 * sc, h = ph * sc;
      if (props.some(p => !p.broken && Math.abs(p.x - x) < (p.w + w) / 2 + 8 && Math.abs(p.y - y) < 28)) continue;
      props.push({ g, x, y, sc, w, h, solid: true, broken: false, hp: 3, hitT: 0, xiaochang: true });
      count++;
    }
  }

  function start() {
    if (new URLSearchParams(location.search).get('debug') !== 'xiaochang') return;
    if (window.TITLE) TITLE.skip();
    if (window.ROOM) ROOM.skip();
    reset();
    active = true;
    M.W = 720;
    props = [];
    hero.x = 360; hero.y = (M.top + M.bot) / 2;
    cam.x = Math.max(0, Math.min(M.W - viewW(), hero.x - viewW() / 2));
    tutorialQueue = []; say('', 0);
    refillXiaochangProps();
    for (const [x, y] of [[280, 195], [400, 228], [440, 270]]) spawn('grunt', x, y);
  }

  function clampActors() {
    for (const actor of [hero, ...zs]) {
      actor.x = Math.max(10, Math.min(710, actor.x));
      actor.y = Math.max(M.top, Math.min(M.bot, actor.y));
    }
    cam.x = Math.max(0, Math.min(Math.max(0, M.W - viewW()), cam.x));
  }

  function drawBackground() {
    const im = IMG.xiaochang;
    if (!im || !im.complete || !im.naturalWidth) return;
    const scale = Math.max(720 / im.width, 134 / ((1 - FENCE_RATIO) * im.height));
    const w = im.width * scale, h = im.height * scale;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(im, (720 - w) / 2, 166 - h * FENCE_RATIO, w, h);
    ctx.imageSmoothingEnabled = false;
  }

  return { active: () => active, leave: () => { active = false; }, start, clampActors, drawBackground, refillXiaochangProps };
})();
function refillXiaochangProps() { XIAOCHANG.refillXiaochangProps(); }
