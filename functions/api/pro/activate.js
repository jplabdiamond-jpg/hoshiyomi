// GET /api/pro/activate?session_id=...
// 占い師プランの決済成立後に戻る先。ユーザー作成→サブスク記録→pro_users登録→ログインCookie→/pro/へ
import { ensureSchema } from '../../_lib/db.js';
import { getCheckoutSession, getSubscription } from '../../_lib/stripe.js';
import { upsertUserByEmail, setSubscription, createSession, sessionCookie } from '../../_lib/account.js';
import { markPro } from '../../_lib/pro.js';

function redirect(location, cookie) {
  const h = { Location: location };
  if (cookie) h['Set-Cookie'] = cookie;
  return new Response(null, { status: 302, headers: h });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const origin = new URL(request.url).origin;
  const sessionId = new URL(request.url).searchParams.get('session_id');
  if (!sessionId || !env.STRIPE_SECRET_KEY || !env.DB) return redirect(`${origin}/pro/?error=1`);

  try {
    await ensureSchema(env.DB);
    const s = await getCheckoutSession(env.STRIPE_SECRET_KEY, sessionId);
    const email = s.customer_details?.email || s.customer_email;
    const custId = typeof s.customer === 'string' ? s.customer : s.customer?.id;
    const subId = typeof s.subscription === 'string' ? s.subscription : s.subscription?.id;
    if (!email || !subId) return redirect(`${origin}/pro/?error=2`);

    let status = 'active', periodEnd = null;
    try { const sub = await getSubscription(env.STRIPE_SECRET_KEY, subId); status = sub.status; periodEnd = sub.current_period_end; } catch { /* 既定active */ }

    const user = await upsertUserByEmail(env.DB, email, custId);
    if (!user) return redirect(`${origin}/pro/?error=3`);

    await setSubscription(env.DB, user.id, { subId, custId, status, periodEnd });
    await markPro(env.DB, user.id);
    const token = await createSession(env.DB, user.id);
    return redirect(`${origin}/pro/?welcome=1`, sessionCookie(token));
  } catch {
    return redirect(`${origin}/pro/?error=9`);
  }
}
