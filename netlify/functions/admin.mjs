// 站长专用：查看或清除某个名字的存档口令。
// 密钥：站长手里的内置密钥（代码只存 SHA-256 哈希），或 Netlify 环境变量 WZB_ADMIN_KEY。
// 查看：/api/admin?key=管理密钥&name=玩家名
// 清除：/api/admin?key=管理密钥&name=玩家名&action=clear
// 查熔掉/丢掉的武器：/api/admin?key=管理密钥&name=玩家名&action=lost
// 补发：/api/admin?key=管理密钥&name=玩家名&action=grant&q=1&count=5&types=staff,hammer,stone（q：0普通 1优良 2精致 3史诗 4传说）
// 补回一把：/api/admin?key=管理密钥&name=玩家名&action=restore&uid=武器编号（编号从 lost 结果里复制）
import { timingSafeEqual, createHash, randomUUID } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { pinStore, readPin, deletePin } from '../lib/pins.mjs';
import '../../js/cloud_merge.js';
import '../../js/equipment_rules.js';
export const config = { path: '/api/admin' };
const reply = (data, status = 200) => new Response(JSON.stringify(data, null, 2), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const Q = ['普通', '优良', '精致', '史诗', '传说', '天工'], W = { staff: '棍子', halberd: '长戟', hammer: '锤子', blade: '大刀', stone: '石子', bow: '汉弓' };
const label = i => (Q[i.q] || '?') + '·' + (W[i.type] || i.type) + (i.special ? '（特殊：' + i.special + '）' : '') + ' 词条:' + (i.affixes || []).map(a => a.id).join('/');
const fmt = t => t > 1e12 ? new Date(t).toLocaleString('zh-CN', { timeZone: 'Asia/Tokyo', hour12: false }) : '';
// 读这个名字所有设备的历史快照（每台设备取最近 40 份），按武器编号收集出现过的武器
async function history(store, prefix) {
  const { blobs } = await store.list({ prefix }), byWriter = new Map();
  for (const b of blobs || []) { const rest = b.key.slice(prefix.length); if (rest === 'current') continue; const [w] = rest.split('/'); if (!byWriter.has(w)) byWriter.set(w, []); byWriter.get(w).push(b.key); }
  const keys = []; for (const list of byWriter.values()) keys.push(...list.sort().slice(-40));
  const seen = new Map();
  for (let i = 0; i < keys.length; i += 16) {
    const batch = await Promise.all(keys.slice(i, i + 16).map(k => store.get(k, { type: 'json' }).catch(() => null)));
    for (const p of batch) for (const it of (p && p.items) || []) if (it && it.uid) seen.set(it.uid, it);
  }
  return { seen, snapshots: keys.length };
}
const ADMIN_HASH = '92f4e18af5440512c9b1a1b2bd54099be8e4cf4bb5b7a15197ff65c321f437e6';
async function affix() { globalThis.window ||= globalThis; if (!globalThis.AFFIX_DATA) await import('../../js/affix_data.js'); return globalThis.AFFIX_DATA; }
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

export default async function handler(req) {
  // 两种密钥都认：Netlify 环境变量 WZB_ADMIN_KEY，或代码里内置的站长密钥（只存哈希，明文只在站长手里）
  const secret = process.env.WZB_ADMIN_KEY, url = new URL(req.url), key = url.searchParams.get('key') || '';
  const okEnv = !!secret && secret.length >= 8 && same(key, secret);
  const okHash = same(createHash('sha256').update(key).digest('hex'), ADMIN_HASH);
  if (!okEnv && !okHash) return reply({ ok: false, error: '管理密钥不对' }, 403);
  const name = String(url.searchParams.get('name') || '').trim();
  if (!name) return reply({ ok: false, error: '请带上 name=玩家名' }, 400);
  const action = url.searchParams.get('action');
  if (action === 'lost' || action === 'restore' || action === 'grant') {
    try {
      const store = getStore({ name: 'wumingzhibei-profiles', consistency: 'strong' });
      const prefix = 'player/' + createHash('sha256').update(name).digest('hex') + '/';
      const entry = await store.getWithMetadata(prefix + 'current', { type: 'json' });
      if (!entry) return reply({ ok: false, error: '这个名字没有云存档' }, 404);
      const cur = entry.data, now = new Set((cur.items || []).map(i => i.uid)), back = new Set((cur.items || []).map(i => i.restoredFrom).filter(Boolean));
      if (action === 'grant') {
        const D = await affix(), q = Math.max(0, Math.min(4, Number(url.searchParams.get('q') ?? 1) | 0)), count = Math.max(1, Math.min(10, Number(url.searchParams.get('count') || 1) | 0));
        const types = String(url.searchParams.get('types') || 'staff,hammer,stone').split(',').filter(t => W[t]);
        if (!types.length) return reply({ ok: false, error: 'types 只能是 staff,hammer,stone,halberd,blade,bow' }, 400);
        if (now.size + count > globalThis.EQUIPMENT_RULES.CAPACITY) return reply({ ok: false, error: '补发后会超过50把，他现在有' + now.size + '把' }, 409);
        const items = Array.from({ length: count }, () => ({ ...D.generate(types[Math.floor(Math.random() * types.length)], 'boss', '', q), uid: randomUUID(), negative: null, locked: true, _at: Date.now(), gift: true }));
        const merged = globalThis.CLOUD_MERGE.merge(cur, { items });
        const r = await store.set(prefix + 'current', JSON.stringify(merged), { onlyIfMatch: entry.etag });
        if (!r.modified) return reply({ ok: false, error: '他的存档刚好在更新，请再点一次' }, 409);
        return reply({ ok: true, name, 已补发: items.map(label), 说明: '已锁定。他刷新网页、进整备页同步后就能看到。只点一次，再点会再发一批。' });
      }
      const { seen, snapshots } = await history(store, prefix);
      if (action === 'lost') {
        const lost = [...seen.values()].filter(i => !now.has(i.uid)).map(i => ({ uid: i.uid, 武器: label(i) + (back.has(i.uid) ? '【已补回】' : ''), 消失时间: fmt((cur._removed || {})[i.uid]), t: (cur._removed || {})[i.uid] || 0 }))
          .sort((a, b) => b.t - a.t).map(({ t, ...x }) => x);
        return reply({ ok: true, name, 读取快照: snapshots, 现有武器: now.size, 消失的武器: lost });
      }
      const uid = url.searchParams.get('uid') || '', old = seen.get(uid);
      if (!old) return reply({ ok: false, error: '历史里找不到这个编号' }, 404);
      if (now.size >= globalThis.EQUIPMENT_RULES.CAPACITY) return reply({ ok: false, error: '他的仓库已满50把，先让他清理一下' }, 409);
      // 用新编号补回（旧编号有删除标记，合并时会被删掉）；词条、品质原样保留
      const item = { ...JSON.parse(JSON.stringify(old)), uid: randomUUID(), locked: true, _at: Date.now(), restoredFrom: uid };
      const merged = globalThis.CLOUD_MERGE.merge(cur, { items: [item] });
      const r = await store.set(prefix + 'current', JSON.stringify(merged), { onlyIfMatch: entry.etag });
      if (!r.modified) return reply({ ok: false, error: '他的存档刚好在更新，请再点一次' }, 409);
      return reply({ ok: true, name, 已补回: label(item), 说明: '已锁定。他下次进整备页同步后就能看到。' });
    } catch (e) { return reply({ ok: false, error: '暂时无法读取：' + (e && e.message || '') }, 503); }
  }
  try {
    const store = pinStore();
    if (action === 'clear') { await deletePin(store, name); return reply({ ok: true, name, cleared: true }); }
    const rec = await readPin(store, name);
    return reply({ ok: true, name, pinSet: !!(rec && rec.pin), pin: rec?.pin || null, setAt: rec?.setAt || null, lockedUntil: rec?.lockUntil ? new Date(rec.lockUntil).toISOString() : null });
  } catch { return reply({ ok: false, error: '暂时无法读取' }, 503); }
}
