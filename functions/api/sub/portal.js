// POST /api/sub/portal → Stripeカスタマーポータル（解約・支払い方法変更）URLを返す
import { ensureSchema } from '../../_lib/db.js';
import { getAuth } from '../../_lib/account.js';
import { createBillingPortal } from '../../_lib/stripe.js';

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB || !env.STRIPE_SECRET_KEY) return json({ error: '利用できません' }, 503);
  try {
    await ensureSchema(env.DB);
    const { user, sub } = await getAuth(env.DB, request);
    if (!user) return json({ error: 'not_logged_in' }, 401);
    const custId = sub?.stripe_customer_id || user.stripe_customer_id;
    if (!custId) return json({ error: 'no_customer' }, 400);
    const origin = new URL(request.url).origin;
    const { url } = await createBillingPortal(env.STRIPE_SECRET_KEY, { customerId: custId, returnUrl: `${origin}/?from=portal` });
    return json({ ok: true, url });
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
