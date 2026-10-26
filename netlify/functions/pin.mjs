// 设置或修改存档口令：没设过的名字直接设置；已设过的要先验证旧口令（错误次数和锁定规则与读档共用）。
import { pinStore, readPin, writePin, checkPin, PIN_RE } from '../lib/pins.mjs';
export const config = { path: '/api/pin' };
const reply = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

export default async function handler(req) {
  if (req.method !== 'POST') return reply({ ok: false, error: 'Method not allowed' }, 405);
  const url = new URL(req.url);
  if (req.headers.get('origin') && req.headers.get('origin') !== url.origin) return reply({ ok: false, error: 'Origin rejected' }, 403);
  let body; try { body = JSON.parse(await req.text()); } catch { return reply({ ok: false, error: 'Invalid JSON' }, 400); }
  const name = String(body?.name || '').trim();
  if (!name || name.length > 8 || /[\u0000-\u001f]/.test(name)) return reply({ ok: false, error: '名字不合法' }, 400);
  const pin = String(body?.pin || '');
  if (!PIN_RE.test(pin)) return reply({ ok: false, error: '口令要4～6位数字' }, 400);
  try {
    const store = pinStore();
    const rec = await readPin(store, name);
    if (rec && rec.pin) {
      const check = await checkPin(store, name, String(body?.oldPin || ''));
      if (!check.ok) return reply(check.body, check.status);
    }
    await writePin(store, name, { name, pin, setAt: new Date().toISOString(), fails: 0 });
    return reply({ ok: true, pinSet: true });
  } catch { return reply({ ok: false, error: '暂时无法设置口令，请稍后再试' }, 503); }
}
