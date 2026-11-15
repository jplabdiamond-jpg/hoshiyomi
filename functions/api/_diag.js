// 一時診断用（調査後に削除）。?k=sv-diag-7731 でガード。
import { ensureSchema } from '../_lib/db.js';
const json = (o, s = 200) => new Response(JSON.stringify(o, null, 2), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (url.searchParams.get('k') !== 'sv-diag-7731') return json({ error: 'nope' }, 404);

  const out = { hasDB: !!env.DB, hasStripe: !!env.STRIPE_SECRET_KEY, steps: {} };
  if (!env.DB) return json(out);

  // 1) ensureSchema を明示実行し、例外を捕捉
  try { await ensureSchema(env.DB); out.steps.ensureSchema = 'ok'; }
  catch (e) { out.steps.ensureSchema = 'THREW: ' + String(e && e.message || e); }

  // 2) テーブル一覧
  try {
    const r = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
    out.tables = (r.results || []).map(x => x.name);
  } catch (e) { out.tables = 'THREW: ' + String(e && e.message || e); }

  // 3) 有効化で使う各操作を個別に試す（例外箇所の特定）
  const probes = {
    users_select: "SELECT COUNT(*) AS c FROM users",
    subscriptions_select: "SELECT COUNT(*) AS c FROM subscriptions",
    auth_sessions_select: "SELECT COUNT(*) AS c FROM auth_sessions",
    pro_users_select: "SELECT COUNT(*) AS c FROM pro_users",
    orders_select: "SELECT COUNT(*) AS c FROM orders",
  };
  out.probes = {};
  for (const [k, sql] of Object.entries(probes)) {
    try { const r = await env.DB.prepare(sql).first(); out.probes[k] = 'ok c=' + (r && r.c); }
    catch (e) { out.probes[k] = 'THREW: ' + String(e && e.message || e); }
  }
  return json(out);
}
