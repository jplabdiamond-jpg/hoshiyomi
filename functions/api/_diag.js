// 一時診断用（調査後に削除）。?k=sv-diag-7731 でガード。読み取り専用（通常の ensureSchema を呼ぶだけ）。
import { ensureSchema } from '../_lib/db.js';
const json = (o, s = 200) => new Response(JSON.stringify(o, null, 2), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (url.searchParams.get('k') !== 'sv-diag-7731') return json({ error: 'nope' }, 404);
  if (!env.DB) return json({ hasDB: false });

  await ensureSchema(env.DB);

  let tables = [];
  try { const r = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all(); tables = (r.results || []).map(x => x.name); }
  catch (e) { tables = 'THREW: ' + String(e && e.message || e); }

  const probe = {};
  for (const t of ['users','subscriptions','auth_sessions','pro_users','magic_tokens','sub_readings','predictions','user_calibration','clients','client_readings','pro_settings']) {
    try { const r = await env.DB.prepare(`SELECT COUNT(*) AS c FROM ${t}`).first(); probe[t] = 'ok c=' + (r && r.c); }
    catch (e) { probe[t] = 'THREW: ' + String(e && e.message || e); }
  }
  return json({ hasDB: true, tables, probe });
}
