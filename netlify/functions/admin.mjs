// 站长专用：查看或清除某个名字的存档口令。
// 需要在 Netlify 后台设置环境变量 WZB_ADMIN_KEY；没设置时这个接口直接关闭。
// 查看：/api/admin?key=管理密钥&name=玩家名
// 清除：/api/admin?key=管理密钥&name=玩家名&action=clear
import { timingSafeEqual } from 'node:crypto';
import { pinStore, readPin, deletePin } from '../lib/pins.mjs';
export const config = { path: '/api/admin' };
const reply = (data, status = 200) => new Response(JSON.stringify(data, null, 2), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

export default async function handler(req) {
  const secret = process.env.WZB_ADMIN_KEY;
  if (!secret || secret.length < 8) return reply({ ok: false, error: '管理接口未开启：请在 Netlify 设置至少8位的环境变量 WZB_ADMIN_KEY' }, 503);
  const url = new URL(req.url);
  if (!same(url.searchParams.get('key') || '', secret)) return reply({ ok: false, error: '管理密钥不对' }, 403);
  const name = String(url.searchParams.get('name') || '').trim();
  if (!name) return reply({ ok: false, error: '请带上 name=玩家名' }, 400);
  try {
    const store = pinStore();
    if (url.searchParams.get('action') === 'clear') { await deletePin(store, name); return reply({ ok: true, name, cleared: true }); }
    const rec = await readPin(store, name);
    return reply({ ok: true, name, pinSet: !!(rec && rec.pin), pin: rec?.pin || null, setAt: rec?.setAt || null, lockedUntil: rec?.lockUntil ? new Date(rec.lockUntil).toISOString() : null });
  } catch { return reply({ ok: false, error: '暂时无法读取' }, 503); }
}
