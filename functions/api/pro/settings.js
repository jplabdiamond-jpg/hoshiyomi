// GET  /api/pro/settings → ホワイトラベル設定を取得
// POST /api/pro/settings → 保存（占い師プランのみ）
import { ensureSchema } from '../../_lib/db.js';
import { getProAuth, getProSettings, saveProSettings } from '../../_lib/pro.js';

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: 'D1未接続' }, 503);
  await ensureSchema(env.DB);
  const { user, isPro } = await getProAuth(env.DB, request);
  if (!user) return json({ error: 'not_logged_in' }, 401);
  if (!isPro) return json({ error: 'not_pro' }, 402);
  return json({ ok: true, settings: await getProSettings(env.DB, user.id) });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: 'D1未接続' }, 503);
  await ensureSchema(env.DB);
  const { user, isPro } = await getProAuth(env.DB, request);
  if (!user) return json({ error: 'not_logged_in' }, 401);
  if (!isPro) return json({ error: 'not_pro' }, 402);
  let b;
  try { b = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  try {
    const settings = await saveProSettings(env.DB, user.id, b || {});
    return json({ ok: true, settings });
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
