// 英雄榜接口：GET /api/scores 取榜，POST /api/scores 提交一局成绩
// 存储：Netlify Blobs（每局一个 run:xxx，避免并发写入互相覆盖）
import { getStore } from '@netlify/blobs';

export const config = { path: '/api/scores' };

const STORE = 'wumingzhibei-board';
const SEASON = 's1';        // 换赛季只改这里（旧数据自动被忽略）
const NAME_MAX = 8;
const MIN_TIME = 90;        // 用时低于 90 秒视为异常（正常通关要几分钟）
const MAX_KILLS = 200;
const MAX_ZONE = 6;         // 一共 6 个区域
const RATE_WINDOW = 60;     // 同一 IP 60 秒内最多 3 次提交
const RATE_MAX = 3;
const TOP_N = 20;
// 清理口令：只有知道这一句的人能删记录 / 列出内部 key（普通玩家拿不到）
const ADMIN = 'wzb-qingli-2026';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

function cleanName(raw) {
  let s = String(raw == null ? '' : raw).replace(/[\u0000-\u001f<>\\"'`]/g, '').trim();
  if (!s) s = '无名氏';
  return Array.from(s).slice(0, NAME_MAX).join('');
}

// 读取全部成绩（只读当前赛季）
async function readAll(store) {
  const list = await store.list({ prefix: 'run:' });
  const items = await Promise.all(
    (list.blobs || []).map(async b => {
      try {
        const raw = await store.get(b.key);
        if (!raw) return null;
        const rec = JSON.parse(raw);
        rec.key = b.key;                     // 内部 key（只在管理员接口返回）
        return rec;
      } catch (e) { return null; }
    })
  );
  return items.filter(x => x && x.season === SEASON && Number.isFinite(x.kills) && Number.isFinite(x.t));
}

// 评分 = 击杀 x10 + 通关数 x100 + 通关时间分（最多 +240）+ 无伤分（最多 +200）
//   通关时间分：只有通关才算，(900 - 用时秒) x 0.4，不封顶、每秒都在变
//   无伤分：每被打 1 下扣 20 分，200 分封顶
// 死掉也能上榜：没通关就没有时间分
function scoreOf(kills, t, cleared, win, hits, bonus) {
  const progress = Math.max(0, Math.min(MAX_ZONE, cleared)) * 100;
  const speed = win ? Math.max(0, Math.round((900 - t) * .4)) : 0;
  const safe = Math.max(0, 200 - Math.max(0, Math.min(99, hits || 0)) * 20);
  return kills * 10 + progress + speed + safe + Math.max(0, Math.min(200, bonus || 0));   // 满血吃补血道具的额外分，最多 200
}
function pub(x) {
  const zone = Number.isFinite(x.zone) ? x.zone : (x.win ? MAX_ZONE : 0);
  const win = !!x.win;
  const hits = Number.isFinite(x.hits) ? x.hits : 99;   // 老记录没有受击数据 → 无伤分按 0 算，不白给
  const cleared = win ? MAX_ZONE : Math.max(0, zone - 1);   // 通过的区域数：死在 3 关 = 过了 2 关
  const diff = x.diff === 'easy' ? 'easy' : 'hard';     // 没有 diff 的老记录 = 当时的难度就是现在的困难
  const base = scoreOf(x.kills, x.t, cleared, win, hits, x.bonus);
  return { name: x.name, kills: x.kills, t: x.t, zone, win, cleared, hits, at: x.at, diff,
    score: Math.round(base * (diff === 'hard' ? 1.5 : 1)) };   // 困难模式评分 ×1.5
}

export default async function handler(req, context) {
  const store = getStore({ name: STORE, consistency: 'strong' });

  if (req.method === 'GET') {
    try {
      const all = await readAll(store);
      const u = new URL(req.url);
      // 管理员视角：?admin=口令 → 附带内部 key，方便精确删除
      if (u.searchParams.get('admin') === ADMIN) {
        return json({ ok: true, rows: all.map(x => ({ key: x.key, name: x.name, kills: x.kills, t: x.t, zone: x.zone, win: !!x.win, hits: x.hits, at: x.at, ip: x.ip, cheat: x.cheat })) });
      }
      const clean = all.filter(x => !x.cheat).map(pub);
      // 同一个名字只留最好的那一条（评分高的优先；同分比击杀，再比用时）
      const best = new Map();
      for (const r of clean) {
        const cur = best.get(r.name);
        if (!cur || r.score > cur.score ||
            (r.score === cur.score && (r.kills > cur.kills || (r.kills === cur.kills && r.t < cur.t)))) {
          best.set(r.name, r);
        }
      }
      // 只按评分排；同分时击杀多者靠前，再同则用时短者靠前
      const list = [...best.values()].sort((a, b) => b.score - a.score || b.kills - a.kills || a.t - b.t).slice(0, TOP_N);
      return json({ ok: true, season: SEASON, total: best.size, list });
    } catch (e) {
      return json({ ok: false, error: 'read failed' }, 500);
    }
  }

  if (req.method !== 'POST') return json({ ok: false, error: 'method not allowed' }, 405);

  let body;
  try { body = await req.json(); } catch (e) { return json({ ok: false, error: 'bad json' }, 400); }

  // 维护用：删单条 / 清空（口令写在代码里，只有维护者知道）
  if (body && (body.op === 'del' || body.op === 'purge')) {
    if (body.token !== ADMIN) return json({ ok: false, error: 'forbidden' }, 403);
    try {
      if (body.op === 'del') { await store.delete(String(body.key)); return json({ ok: true, deleted: 1 }); }
      const list = await store.list({ prefix: 'run:' });
      for (const b of list.blobs || []) await store.delete(b.key);
      return json({ ok: true, deleted: (list.blobs || []).length });
    } catch (e) { return json({ ok: false, error: 'del failed' }, 500); }
  }

  const name = cleanName(body.name);
  const kills = Math.round(Number(body.kills));
  const t = Math.round(Number(body.t));
  const win = !!body.win;
  const zone = Math.round(Number(body.zone)) || 0;
  const hits = Math.max(0, Math.min(99, Math.round(Number(body.hits)) || 0));
  const bonus = Math.max(0, Math.min(200, Math.round(Number(body.bonus)) || 0));
  const diff = body.diff === 'hard' ? 'hard' : 'easy';
  if (!Number.isFinite(kills) || !Number.isFinite(t)) return json({ ok: false, error: 'bad numbers' }, 400);
  if (win && t < MIN_TIME) return json({ ok: false, error: 'too fast' }, 400);      // 通关不可能这么快
  if (!win && t < 10) return json({ ok: false, error: 'too fast' }, 400);
  if (kills < 0 || kills > MAX_KILLS) return json({ ok: false, error: 'bad kills' }, 400);
  if (zone < 0 || zone > MAX_ZONE) return json({ ok: false, error: 'bad zone' }, 400);

  const ip = (context && context.ip) || req.headers.get('x-nf-client-connection-ip') || 'unknown';
  const now = Date.now();

  try {
    // 简单限流：同一 IP 最近 60 秒的提交数
    const recent = (await readAll(store)).filter(x => x.ip === ip && now - x.at < RATE_WINDOW * 1000);
    if (recent.length >= RATE_MAX) return json({ ok: false, error: 'too many' }, 429);

    const rec = { name, kills, t, zone, win, hits, bonus, diff, at: now, season: SEASON, ip, cheat: 0 };
    const key = 'run:' + now.toString(36) + Math.random().toString(36).slice(2, 8);
    await store.set(key, JSON.stringify(rec));
    return json({ ok: true, key });
  } catch (e) {
    return json({ ok: false, error: 'write failed' }, 500);
  }
}
