// POST /api/reading
// body: { divination: 'astrology'|'fourpillars'|'tarot', answers: {...} }
// → 確定計算 + Cloudflare Workers AI による鑑定文を返す
import { computeDivination, buildMessages, cleanReading, DISCLAIMER } from '../_lib/reading.js';
import { ensureSchema } from '../_lib/db.js';
import { getCalibration, recordPredSignals } from '../_lib/calibration.js';
import { SPEC } from '../_lib/baserates.js';
import { getCheckoutSession } from '../_lib/stripe.js';
import { processPalmHands } from '../_lib/palm.js';

const PAID = new Set(['comprehensive_plus', 'palm']); // 有料モード

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

  // 有料フロー：paidSession があれば、占術・回答は「支払い済みの注文」から取得する（改ざん防止・占術も注文が正）
  let paidOrder = null;
  if (body.paidSession) {
    if (!env.STRIPE_SECRET_KEY || !env.DB) return json({ error: '決済検証が利用できません' }, 503);
    try {
      await ensureSchema(env.DB);
      const row = await env.DB.prepare('SELECT * FROM orders WHERE stripe_session_id = ?').bind(body.paidSession).first();
      if (!row) return json({ error: 'invalid_order', message: '注文が見つかりません' }, 400);
      if (row.status === 'consumed') return json({ error: 'already_used', message: 'この支払いは既に鑑定に使用済みです' }, 409);
      const session = await getCheckoutSession(env.STRIPE_SECRET_KEY, body.paidSession);
      if (session.payment_status !== 'paid') return json({ error: 'not_paid', message: 'お支払いが確認できませんでした' }, 402);
      paidOrder = row;
      divination = row.divination;                    // 認証された占術
      answers = JSON.parse(row.answers_json || '{}');  // 支払った内容で鑑定
    } catch (e) {
      return json({ error: String(e.message || e) }, 500);
    }
  } else {
    if (!divination) return json({ error: 'divination は必須です' }, 400);
    if (PAID.has(divination)) return json({ error: 'payment_required', message: 'この鑑定はお支払いが必要です' }, 402);
  }

  if (!answers) return json({ error: 'answers は必須です' }, 400);

  // 0) 確度較正の重み。A=希少度(静的・常時)、C=実測フィードバック(DBがあれば)。失敗しても中立で続行
  let calibWeights = {};
  if (divination.startsWith('comprehensive') && env.DB) {
    try { calibWeights = (await getCalibration(env.DB)).weights; } catch { calibWeights = {}; }
  }

  // 0.5) 手相：決済前(checkout)に抽出済みの特徴テキスト（palmFeatures/palmFeatures2）を使う。
  //   画像(palmImage)が直接来た場合のみフォールバックで解析する。
  let palmFeatures = null, palmFeatures2 = null, palmVisionModel = null;
  if (divination === 'palm' || divination.startsWith('comprehensive')) {
    if (answers && answers.palmFeatures) {
      palmFeatures = answers.palmFeatures; palmFeatures2 = answers.palmFeatures2 || null;
    } else if (divination === 'palm' && answers && answers.palmImage) {
      const res = await processPalmHands(env, answers);
      if (res.error) return json({ error: res.error, detail: res.detail }, res.error.includes('AI未設定') ? 503 : 400);
      if (res.retake) return json({ divination, title: '手相', data: {}, meta: {}, reading: res.retake, disclaimer: DISCLAIMER, readingId: null });
      palmFeatures = res.features; palmFeatures2 = res.features2; palmVisionModel = res.model;
    }
  }

  // 1) 確定計算（命式・チャート・カード／手相は特徴テキストを材料化）
  let computed;
  try {
    computed = computeDivination(divination, answers, { calibWeights, specTable: SPEC, features: palmFeatures, features2: palmFeatures2 });
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
        max_tokens: divination.startsWith('comprehensive') ? 4096 : 2048,
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
      // 画像のbase64は保存しない（プライバシー・容量）。手相は特徴テキストのみ残す
      let storeAnswers = answers;
      if (answers && (answers.palmImage || answers.palmImage2)) {
        storeAnswers = { ...answers };
        if (storeAnswers.palmImage) storeAnswers.palmImage = '[image omitted]';
        if (storeAnswers.palmImage2) storeAnswers.palmImage2 = '[image omitted]';
      }
      await env.DB.prepare(
        'INSERT INTO readings (id, anon_id, divination, input_json, summary, model) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(
        readingId, (body.anonId || null), divination,
        JSON.stringify(storeAnswers).slice(0, 4000),
        computed.material.slice(0, 4000), model
      ).run();
      // 有料注文は「使用済み」にして二重利用を防ぐ
      if (paidOrder) {
        await env.DB.prepare('UPDATE orders SET status = ?, reading_id = ? WHERE id = ?')
          .bind('consumed', readingId, paidOrder.id).run();
      }
      // C 確度に寄与したパターンを記録（後日フィードバックが来たら較正に使う）
      const used = computed.data && computed.data.foresight && computed.data.foresight.patternsUsed;
      if (readingId && used && used.length) await recordPredSignals(env.DB, readingId, used);
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
