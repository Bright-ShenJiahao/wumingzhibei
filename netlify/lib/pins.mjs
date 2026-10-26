// 存档口令：按用户要求以原文保存在单独的 Blobs 存储（wumingzhibei-pins），方便站长在后台帮玩家找回。
// 网页端永远拿不到口令原文；只有带管理密钥的 /api/admin 能查看或清除。
import { getStore } from '@netlify/blobs';
import { createHash } from 'node:crypto';

export const PIN_RE = /^\d{4,6}$/;
const MAX_FAILS = 5, LOCK_MS = 10 * 60 * 1000;
const keyOf = name => 'pin/' + createHash('sha256').update(name).digest('hex');
export const pinStore = () => getStore({ name: 'wumingzhibei-pins', consistency: 'strong' });

export async function readPin(store, name) {
  return await store.get(keyOf(name), { type: 'json' }) || null;
}
export async function writePin(store, name, record) { await store.set(keyOf(name), JSON.stringify(record)); }
export async function deletePin(store, name) { await store.delete(keyOf(name)); }

// 返回 { ok:true, pinSet } 或 { ok:false, status, body }。没设口令的名字一律放行。
export async function checkPin(store, name, pin) {
  const rec = await readPin(store, name);
  if (!rec || !rec.pin) return { ok: true, pinSet: false };
  const now = Date.now();
  if (rec.lockUntil && rec.lockUntil > now) {
    const minutes = Math.ceil((rec.lockUntil - now) / 60000);
    return { ok: false, status: 423, body: { ok: false, locked: true, needPin: true, retryAfter: minutes, error: `口令输错次数太多，${minutes}分钟后再试` } };
  }
  if (typeof pin === 'string' && pin === rec.pin) {
    if (rec.fails) { rec.fails = 0; delete rec.lockUntil; await writePin(store, name, rec); }
    return { ok: true, pinSet: true };
  }
  if (!pin) return { ok: false, status: 401, body: { ok: false, needPin: true, error: '这个名字设了存档口令，请输入口令' } };
  rec.fails = (rec.fails || 0) + 1;
  let body = { ok: false, needPin: true, wrong: true, left: MAX_FAILS - rec.fails, error: `口令不对，还能再试${MAX_FAILS - rec.fails}次` };
  if (rec.fails >= MAX_FAILS) {
    rec.fails = 0; rec.lockUntil = now + LOCK_MS;
    body = { ok: false, locked: true, needPin: true, retryAfter: 10, error: '口令输错5次，锁定10分钟' };
  }
  await writePin(store, name, rec);
  return { ok: false, status: rec.lockUntil > now ? 423 : 401, body };
}
