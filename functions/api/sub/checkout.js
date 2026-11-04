// POST /api/sub/checkout  body: { answers }
// 継続鑑定（月額）の Stripe サブスク Checkout を作成。手相は決済前に特徴抽出して保存。
import { ensureSchema } from '../../_lib/db.js';
import { createSubscriptionCheckout } from '../../_lib/stripe.js';
import { processPalmHands } from '../../_lib/palm.js';

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.STRIPE_SECRET_KEY) return json({ error: '決済は現在準備中です（STRIPE_SECRET_KEY 未設定）' }, 503);
  if (!env.DB) return json({ error: '保存先が未設定です（D1未接続）' }, 503);

  let b;
  try { b = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  let answers = b?.answers;
  if (!answers) return json({ error: 'answers は必須です' }, 400);

  // 手相（両手）を決済前に解析し、画像を特徴テキストへ（毎月の再計算で再アップ不要にする）
  if (answers.palmImage || answers.palmImage2) {
    try {
      const palm = await processPalmHands(env, answers);
      if (palm.error) return json({ error: palm.error, detail: palm.detail }, 400);
      if (palm.retake) return json({ error: palm.retake }, 400);
      answers = { ...answers, palmFeatures: palm.features, palmFeatures2: palm.features2 };
      delete answers.palmImage; delete answers.palmImage2;
    } catch (e) {
      return json({ error: '手相の画像解析に失敗しました。明るい場所で撮り直してお試しください。', detail: String(e.message || e) }, 200);
    }
  }

  try {
    await ensureSchema(env.DB);
    const pendingId = crypto.randomUUID();
    // 入力は orders テーブルに一時保存（支払い成立後、activateでユーザーに紐付ける）
    await env.DB.prepare(
      'INSERT INTO orders (id, anon_id, divination, answers_json, status) VALUES (?, ?, ?, ?, ?)'
    ).bind(pendingId, b.anonId || null, 'subscription', JSON.stringify(answers).slice(0, 8000), 'pending').run();

    const origin = new URL(request.url).origin;
    const session = await createSubscriptionCheckout(env.STRIPE_SECRET_KEY, {
      clientRef: pendingId,
      successUrl: `${origin}/api/sub/activate?session_id={CHECKOUT_SESSION_ID}&p=${pendingId}`,
      cancelUrl: `${origin}/?sub_canceled=1`,
    });
    await env.DB.prepare('UPDATE orders SET stripe_session_id = ? WHERE id = ?').bind(session.id, pendingId).run();
    return json({ ok: true, url: session.url });
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
