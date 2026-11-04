// POST /api/predictions/check  body: { id, outcome: 'hit'|'partial'|'miss' }
// 予測の答え合わせを記録し、本人別較正を更新する。
import { ensureSchema } from '../../_lib/db.js';
import { getAuth } from '../../_lib/account.js';
import { recordOutcome } from '../../_lib/subscription.js';

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: 'D1未接続' }, 503);
  let b;
  try { b = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  try {
    await ensureSchema(env.DB);
    const { user, active } = await getAuth(env.DB, request);
    if (!user) return json({ error: 'not_logged_in' }, 401);
    if (!active) return json({ error: 'no_active_subscription' }, 402);
    const res = await recordOutcome(env.DB, user.id, b?.id, b?.outcome);
    if (!res.ok) return json({ error: res.error }, 400);
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
