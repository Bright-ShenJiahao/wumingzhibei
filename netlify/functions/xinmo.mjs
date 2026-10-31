// 心魔训练数据（用户定 2026-10-31）：对局录像只用来训练心魔 AI，训练完自动删除
// POST /api/xinmo            上传一局：{ kind:'xinmo'|'play', name, weapon, win, dt, cols, rows, keys, hits, ... }
//                            玩家名不存原文，只存一段不可还原的编号（同一个人编号相同，方便学「这个人的习惯」）
// GET  /api/xinmo            列出全部对局编号（公开，训练任务用；用户定：不要密钥）
// GET  /api/xinmo?ep=ep:xxx  下载一局
// 自动删除：GitHub 训练任务把「已经训练过的对局编号」提交到仓库 data/xinmo_trained.json；
//          本接口每次被调用时读那个公开文件，删掉列在里面的对局——只有真的训练过、并且训练记录已经提交进仓库的才会被删。
import { getStore } from '@netlify/blobs';
import { createHash } from 'node:crypto';
export const config = { path: '/api/xinmo' };
const STORE = 'wumingzhibei-xinmo', MAX_BYTES = 900000, MAX_ROWS = 8000, MAX_EV = 20000;
const TRAINED_URL = 'https://raw.githubusercontent.com/Bright-ShenJiahao/wumingzhibei/main/data/xinmo_trained.json';
const WEAPONS = ['staff', 'hammer', 'stone', 'halberd', 'blade', 'bow'];
const reply = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*' } });
const pid = n => createHash('sha256').update('wzb-xinmo|' + String(n || '')).digest('hex').slice(0, 12);
async function sweep(store) {   // 删掉已训练的对局（最多每 10 分钟查一次）
  const meta = await store.get('_sweep', { type: 'json' }).catch(() => null);
  if (meta && Date.now() - meta.at < 600000) return meta.deleted || 0;
  let deleted = 0;
  try {
    const r = await fetch(TRAINED_URL, { cache: 'no-store' });
    if (r.ok) { const t = await r.json(); for (const ep of (t.eps || [])) { if (typeof ep === 'string' && ep.startsWith('ep:') && await store.get(ep)) { await store.delete(ep); deleted++; } } }
  } catch (e) {}
  await store.setJSON('_sweep', { at: Date.now(), deleted: (meta?.deleted || 0) + deleted });
  return deleted;
}
export default async function handler(req) {
  const store = getStore({ name: STORE, consistency: 'strong' }), url = new URL(req.url);
  if (req.method === 'OPTIONS') return new Response(null, { headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' } });
  if (req.method === 'POST') {
    const text = await req.text(); if (text.length > MAX_BYTES) return reply({ ok: false, error: '太大' }, 413);
    let d; try { d = JSON.parse(text); } catch (e) { return reply({ ok: false, error: '格式不对' }, 400); }
    if (!Array.isArray(d.rows) || !d.rows.length || d.rows.length > MAX_ROWS || !Array.isArray(d.cols) || !WEAPONS.includes(d.weapon)) return reply({ ok: false, error: '数据不对' }, 400);
    if (!d.rows.every(r => Array.isArray(r) && r.length === d.cols.length && r.every(v => typeof v === 'number' && Number.isFinite(v)))) return reply({ ok: false, error: '数据不对' }, 400);
    const ev = a => Array.isArray(a) ? a.slice(0, MAX_EV).filter(e => Array.isArray(e) && e.length <= 6 && e.every(v => (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.length <= 8))) : [];
    const snap = d.snap && typeof d.snap === 'object' ? Object.fromEntries(Object.entries(d.snap).filter(([k, v]) => k.length <= 12 && typeof v === 'number' && Number.isFinite(v)).slice(0, 40)) : {};
    const rec = { v: 2, kind: d.kind === 'play' ? 'play' : 'xinmo', mode: String(d.mode || '').slice(0, 12), at: Date.now(), player: pid(d.name), weapon: d.weapon, win: !!d.win, dt: Number(d.dt) || .05, lvl: Number(d.lvl) || 0,
      touch: d.touch ? 1 : 0, snap, cols: d.cols.map(String).slice(0, 128), rows: d.rows, keys: ev(d.keys), hits: ev(d.hits) };
    const key = 'ep:' + rec.at + '-' + Math.random().toString(36).slice(2, 8);
    await store.set(key, JSON.stringify(rec));
    sweep(store).catch(() => {});
    return reply({ ok: true, key });
  }
  const ep = url.searchParams.get('ep');
  if (ep) { if (!ep.startsWith('ep:')) return reply({ ok: false }, 400); const raw = await store.get(ep); return raw ? new Response(raw, { headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' } }) : reply({ ok: false, error: '没有这局' }, 404); }
  const deleted = await sweep(store);
  const list = await store.list({ prefix: 'ep:' });
  return reply({ ok: true, count: (list.blobs || []).length, deletedTotal: deleted, eps: (list.blobs || []).map(b => b.key) });
}
