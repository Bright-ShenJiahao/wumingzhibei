// 心魔对局数据（用户定 2026-10-31，为以后训练神经网络心魔攒数据）
// POST /api/xinmo  上传一局：{ name, weapon, win, dt, cols, rows:[[...],...] }，（v2：rows 每 0.05 秒一行状态，keys 按键事件 [t,谁(0你/1心魔),键,值]，hits 命中 [t,被打(0心魔/1你),伤害,晕]）每局存成一个 ep:时间-随机 的 blob
// GET  /api/xinmo?key=管理密钥            列出全部对局（只有 key、玩家、武器、胜负、行数）
// GET  /api/xinmo?key=管理密钥&ep=ep:xxx   下载一局完整数据（训练脚本 tools/xinmo_fetch.py 用）
import { getStore } from '@netlify/blobs';
import { createHash, timingSafeEqual } from 'node:crypto';
export const config = { path: '/api/xinmo' };
const STORE = 'wumingzhibei-xinmo', MAX_BYTES = 900000, MAX_ROWS = 6000, MAX_EV = 20000;
const ADMIN_HASH = '92f4e18af5440512c9b1a1b2bd54099be8e4cf4bb5b7a15197ff65c321f437e6';   // 和 admin.mjs 同一把站长密钥
const WEAPONS = ['staff', 'hammer', 'stone', 'halberd', 'blade', 'bow'];
const reply = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };
function admin(key) { const env = process.env.WZB_ADMIN_KEY; return (!!env && env.length >= 8 && same(key, env)) || same(createHash('sha256').update(key).digest('hex'), ADMIN_HASH); }
export default async function handler(req) {
  const store = getStore({ name: STORE, consistency: 'strong' }), url = new URL(req.url);
  if (req.method === 'POST') {
    const text = await req.text(); if (text.length > MAX_BYTES) return reply({ ok: false, error: '太大' }, 413);
    let d; try { d = JSON.parse(text); } catch (e) { return reply({ ok: false, error: '格式不对' }, 400); }
    if (!Array.isArray(d.rows) || !d.rows.length || d.rows.length > MAX_ROWS || !Array.isArray(d.cols) || !WEAPONS.includes(d.weapon)) return reply({ ok: false, error: '数据不对' }, 400);
    if (!d.rows.every(r => Array.isArray(r) && r.length === d.cols.length && r.every(v => typeof v === 'number' && Number.isFinite(v)))) return reply({ ok: false, error: '数据不对' }, 400);
    const ev = a => Array.isArray(a) ? a.slice(0, MAX_EV).filter(e => Array.isArray(e) && e.length <= 6 && e.every(v => (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.length <= 8))) : [];
    const snap = d.snap && typeof d.snap === 'object' ? Object.fromEntries(Object.entries(d.snap).filter(([k, v]) => k.length <= 12 && typeof v === 'number' && Number.isFinite(v)).slice(0, 40)) : {};
    const rec = { v: 2, keys: ev(d.keys), hits: ev(d.hits), touch: d.touch ? 1 : 0, snap, at: Date.now(), name: String(d.name || '').slice(0, 8), weapon: d.weapon, win: !!d.win, dt: Number(d.dt) || .1, lvl: Number(d.lvl) || 0, cols: d.cols.map(String).slice(0, 64), rows: d.rows };
    const key = 'ep:' + rec.at + '-' + Math.random().toString(36).slice(2, 8);
    await store.set(key, JSON.stringify(rec));
    return reply({ ok: true, key });
  }
  if (!admin(url.searchParams.get('key') || '')) return reply({ ok: false, error: '管理密钥不对' }, 403);
  const ep = url.searchParams.get('ep');
  if (ep) { const raw = await store.get(ep); return raw ? new Response(raw, { headers: { 'content-type': 'application/json; charset=utf-8' } }) : reply({ ok: false, error: '没有这局' }, 404); }
  const list = await store.list({ prefix: 'ep:' });
  return reply({ ok: true, count: (list.blobs || []).length, eps: (list.blobs || []).map(b => b.key) });
}
