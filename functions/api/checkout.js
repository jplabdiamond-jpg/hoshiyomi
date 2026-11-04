// POST /api/checkout
// body: { answers, anonId }
// 総合鑑定の支払い用 Stripe Checkout セッションを作成する。
import { ensureSchema } from '../_lib/db.js';
import { createCheckoutSession } from '../_lib/stripe.js';
import { processPalmHands } from '../_lib/palm.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: '決済は現在準備中です（STRIPE_SECRET_KEY 未設定）' }, 503);
  }
  if (!env.DB) {
    return json({ error: '注文の保存先が未設定です（D1未接続）' }, 503);
  }

  let b;
  try { b = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  let answers = b?.answers;
  if (!answers) return json({ error: 'answers は必須です' }, 400);

  // 手相（両手）を決済前に解析し、画像を特徴テキストに置き換えてから注文を保存する
  // （画像base64は大きく保存できないため、また不備な写真で課金させないため）
  try {
    const palm = await processPalmHands(env, answers);
    if (palm.error) return json({ error: palm.error, detail: palm.detail }, 400);
    if (palm.retake) return json({ error: palm.retake }, 400);
    answers = { ...answers, palmFeatures: palm.features, palmFeatures2: palm.features2 };
    delete answers.palmImage; delete answers.palmImage2;
  } catch (e) {
    return json({ error: '手相の画像解析に失敗しました。明るい場所で撮り直してお試しください。', detail: String(e.message || e) }, 200);
  }

  try {
    await ensureSchema(env.DB);
    const orderId = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO orders (id, anon_id, divination, answers_json, status) VALUES (?, ?, ?, ?, ?)'
    ).bind(orderId, b.anonId || null, 'comprehensive_plus', JSON.stringify(answers).slice(0, 6000), 'pending').run();

    const origin = new URL(request.url).origin;
    const session = await createCheckoutSession(env.STRIPE_SECRET_KEY, {
      orderId,
      successUrl: `${origin}/?paid={CHECKOUT_SESSION_ID}&order=${orderId}`,
      cancelUrl: `${origin}/?canceled=1`,
    });
    await env.DB.prepare('UPDATE orders SET stripe_session_id = ? WHERE id = ?').bind(session.id, orderId).run();

    return json({ ok: true, url: session.url, orderId });
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
