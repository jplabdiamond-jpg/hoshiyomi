// POST /api/reading
// body: { divination: 'astrology'|'fourpillars'|'tarot', answers: {...} }
// → 確定計算 + Cloudflare Workers AI による鑑定文を返す
import { computeDivination, buildMessages, cleanReading, DISCLAIMER } from '../_lib/reading.js';
import { ensureSchema } from '../_lib/db.js';
import { getCheckoutSession } from '../_lib/stripe.js';

const PAID = new Set(['comprehensive_plus']); // 有料モード

const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export async function onRequestPost(context) {
  const { request, env } = context;
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSONの解析に失敗しました' }, 400);
  }

  let { divination, answers } = body || {};
  if (!divination) return json({ error: 'divination は必須です' }, 400);

  // 有料モードは支払い検証を通し、答えは「支払い済みの注文」から取得する（改ざん防止）
  let paidOrder = null;
  if (PAID.has(divination)) {
    const sessionId = body.paidSession;
    if (!sessionId) return json({ error: 'payment_required', message: '総合鑑定はお支払いが必要です' }, 402);
    if (!env.STRIPE_SECRET_KEY || !env.DB) return json({ error: '決済検証が利用できません' }, 503);
    try {
      await ensureSchema(env.DB);
      const row = await env.DB.prepare('SELECT * FROM orders WHERE stripe_session_id = ?').bind(sessionId).first();
      if (!row) return json({ error: 'invalid_order', message: '注文が見つかりません' }, 400);
      if (row.status === 'consumed') return json({ error: 'already_used', message: 'この支払いは既に鑑定に使用済みです' }, 409);
      const session = await getCheckoutSession(env.STRIPE_SECRET_KEY, sessionId);
      if (session.payment_status !== 'paid') return json({ error: 'not_paid', message: 'お支払いが確認できませんでした' }, 402);
      paidOrder = row;
      answers = JSON.parse(row.answers_json || '{}'); // 支払った内容で鑑定
    } catch (e) {
      return json({ error: String(e.message || e) }, 500);
    }
  }

  if (!answers) return json({ error: 'answers は必須です' }, 400);

  // 1) 確定計算（命式・チャート・カード）
  let computed;
  try {
    computed = computeDivination(divination, answers);
  } catch (e) {
    return json({ error: String(e.message || e) }, 400);
  }

  // 2) 鑑定文生成（Workers AI）
  const model = env.AI_MODEL || DEFAULT_MODEL;
  let reading = '';
  let aiError = null;
  if (env.AI) {
    try {
      const messages = buildMessages(divination, computed, answers);
      const resp = await env.AI.run(model, {
        messages,
        max_tokens: divination.startsWith('comprehensive') ? 3584 : 2048,
        temperature: 0.85,
        top_p: 0.95,
        frequency_penalty: 0.5, // 同じ語の繰り返しを抑制
        presence_penalty: 0.3,  // 話題の広がりを促す
      });
      reading = cleanReading(divination, (resp && (resp.response || resp.result || '')).trim());
    } catch (e) {
      aiError = String(e.message || e);
    }
  } else {
    aiError = 'AI binding (env.AI) が未設定です';
  }

  if (!reading) {
    reading =
      '【鑑定データは正しく算出されました】\n' +
      computed.material +
      '\n\n（鑑定文の自動生成が一時的に利用できませんでした。上記の確定データをもとに読み解いてください。）' +
      (aiError ? `\n[詳細: ${aiError}]` : '');
  }

  // 鑑定履歴を D1 に記録（任意・失敗しても鑑定は返す）
  let readingId = null;
  if (env.DB) {
    try {
      await ensureSchema(env.DB);
      readingId = crypto.randomUUID();
      await env.DB.prepare(
        'INSERT INTO readings (id, anon_id, divination, input_json, summary, model) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(
        readingId, (body.anonId || null), divination,
        JSON.stringify(answers).slice(0, 4000),
        computed.material.slice(0, 4000), model
      ).run();
      // 有料注文は「使用済み」にして二重利用を防ぐ
      if (paidOrder) {
        await env.DB.prepare('UPDATE orders SET status = ?, reading_id = ? WHERE id = ?')
          .bind('consumed', readingId, paidOrder.id).run();
      }
    } catch { readingId = null; }
  }

  return json({
    divination,
    title: computed.title,
    data: computed.data,
    material: computed.material,
    meta: computed.meta,
    reading,
    disclaimer: DISCLAIMER,
    model,
    readingId,
  });
}

export async function onRequestGet() {
  return json({ ok: true, usage: 'POST { divination, answers }' });
}
