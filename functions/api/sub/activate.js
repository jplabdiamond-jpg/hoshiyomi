// GET /api/sub/activate?session_id=...&p=pendingId
// 決済成立後に Stripe から戻る先。ユーザー作成→サブスク記録→セッション発行→Cookieでログイン状態にしてアプリへ。
import { ensureSchema } from '../../_lib/db.js';
import { getCheckoutSession, getSubscription } from '../../_lib/stripe.js';
import { upsertUserByEmail, setSubscription, createSession, sessionCookie } from '../../_lib/account.js';

function redirect(location, cookie) {
  const h = { Location: location };
  if (cookie) h['Set-Cookie'] = cookie;
  return new Response(null, { status: 302, headers: h });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const origin = url.origin;
  const sessionId = url.searchParams.get('session_id');
  const pendingId = url.searchParams.get('p');
  if (!sessionId || !env.STRIPE_SECRET_KEY || !env.DB) return redirect(`${origin}/?sub_error=1`);

  try {
    await ensureSchema(env.DB);
    const s = await getCheckoutSession(env.STRIPE_SECRET_KEY, sessionId);
    const email = s.customer_details?.email || s.customer_email;
    const custId = typeof s.customer === 'string' ? s.customer : s.customer?.id;
    const subId = typeof s.subscription === 'string' ? s.subscription : s.subscription?.id;
    if (!email || !subId) return redirect(`${origin}/?sub_error=2`);

    // サブスクの状態を取得
    let status = 'active', periodEnd = null;
    try { const sub = await getSubscription(env.STRIPE_SECRET_KEY, subId); status = sub.status; periodEnd = sub.current_period_end; } catch { /* 既定active */ }

    const user = await upsertUserByEmail(env.DB, email, custId);
    if (!user) return redirect(`${origin}/?sub_error=3`);

    // 保存しておいた入力をユーザーに紐付け
    if (pendingId) {
      try {
        const o = await env.DB.prepare('SELECT answers_json FROM orders WHERE id = ?').bind(pendingId).first();
        if (o && o.answers_json) {
          await env.DB.prepare('UPDATE users SET answers_json = ? WHERE id = ?').bind(o.answers_json, user.id).run();
          await env.DB.prepare('UPDATE orders SET status = ? WHERE id = ?').bind('consumed', pendingId).run();
        }
      } catch { /* */ }
    }

    await setSubscription(env.DB, user.id, { subId, custId, status, periodEnd });
    const token = await createSession(env.DB, user.id);
    return redirect(`${origin}/?welcome=sub`, sessionCookie(token));
  } catch {
    return redirect(`${origin}/?sub_error=9`);
  }
}
