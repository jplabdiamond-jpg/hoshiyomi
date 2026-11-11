// POST /api/pro/checkout  → 占い師プラン（¥2,000/月・使い放題）の Stripe サブスク Checkout を作成
import { ensureSchema } from '../../_lib/db.js';
import { createSubscriptionCheckout, PRO_PRICE_JPY } from '../../_lib/stripe.js';

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.STRIPE_SECRET_KEY) return json({ error: '決済は現在準備中です（STRIPE_SECRET_KEY 未設定）' }, 503);
  if (!env.DB) return json({ error: '保存先が未設定です（D1未接続）' }, 503);
  try {
    await ensureSchema(env.DB);
    const origin = new URL(request.url).origin;
    const session = await createSubscriptionCheckout(env.STRIPE_SECRET_KEY, {
      amount: PRO_PRICE_JPY,
      name: 'Sibylla Vision 占い師プラン（月額・使い放題）',
      successUrl: `${origin}/api/pro/activate?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/pro/?canceled=1`,
    });
    return json({ ok: true, url: session.url });
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
