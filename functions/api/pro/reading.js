// POST /api/pro/reading  body: { divination, answers, clientId? , saveToClient? }
// 占い師プラン専用。全鑑定を決済なしで実行（使い放題）。clientId があれば鑑定履歴を保存。
import { computeDivination, buildMessages, cleanReading, DISCLAIMER } from '../../_lib/reading.js';
import { ensureSchema } from '../../_lib/db.js';
import { getCalibration, recordPredSignals } from '../../_lib/calibration.js';
import { SPEC } from '../../_lib/baserates.js';
import { processPalmHands } from '../../_lib/palm.js';
import { getProAuth } from '../../_lib/pro.js';

const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: 'D1未接続' }, 503);
  await ensureSchema(env.DB);
  const { user, isPro } = await getProAuth(env.DB, request);
  if (!user) return json({ error: 'not_logged_in' }, 401);
  if (!isPro) return json({ error: 'not_pro', message: '占い師プラン（¥2,000/月）が必要です' }, 402);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSONの解析に失敗しました' }, 400); }
  let { divination, answers } = body || {};
  if (!divination) return json({ error: 'divination は必須です' }, 400);
  if (!answers) answers = {};

  // clientId があれば所有確認
  let client = null;
  if (body.clientId) {
    client = await env.DB.prepare('SELECT * FROM clients WHERE id = ? AND pro_user_id = ?').bind(String(body.clientId), user.id).first();
    if (!client) return json({ error: 'client_not_found' }, 404);
  }

  // 較正の重み（総合系のみ・母集団較正）
  let calibWeights = {};
  if (divination.startsWith('comprehensive') && env.DB) {
    try { calibWeights = (await getCalibration(env.DB)).weights; } catch { calibWeights = {}; }
  }

  // 手相：画像があれば特徴抽出。保存済み特徴（palmFeatures）があればそれを使う
  let palmFeatures = null, palmFeatures2 = null;
  if (divination === 'palm' || divination.startsWith('comprehensive')) {
    if (answers.palmFeatures) {
      palmFeatures = answers.palmFeatures; palmFeatures2 = answers.palmFeatures2 || null;
    } else if (answers.palmImage) {
      const res = await processPalmHands(env, answers);
      if (res.error) return json({ error: res.error, detail: res.detail }, res.error.includes('AI未設定') ? 503 : 400);
      if (res.retake) return json({ divination, title: '手相', data: {}, meta: {}, reading: res.retake, disclaimer: DISCLAIMER, readingId: null });
      palmFeatures = res.features; palmFeatures2 = res.features2;
    }
  }

  // 確定計算
  let computed;
  try {
    computed = computeDivination(divination, answers, { calibWeights, specTable: SPEC, features: palmFeatures, features2: palmFeatures2 });
  } catch (e) {
    return json({ error: String(e.message || e) }, 400);
  }

  // 鑑定文生成
  const model = env.AI_MODEL || DEFAULT_MODEL;
  let reading = '', aiError = null;
  if (env.AI) {
    try {
      const messages = buildMessages(divination, computed, answers);
      const resp = await env.AI.run(model, {
        messages,
        max_tokens: divination.startsWith('comprehensive') ? 3584 : 2048,
        temperature: 0.85, top_p: 0.95, frequency_penalty: 0.5, presence_penalty: 0.3,
      });
      reading = cleanReading(divination, (resp && (resp.response || resp.result || '')).trim());
    } catch (e) { aiError = String(e.message || e); }
  } else {
    aiError = 'AI binding (env.AI) が未設定です';
  }
  if (!reading) {
    reading = '【鑑定データは正しく算出されました】\n' + computed.material +
      '\n\n（鑑定文の自動生成が一時的に利用できませんでした。上記の確定データをもとに読み解いてください。）' +
      (aiError ? `\n[詳細: ${aiError}]` : '');
  }

  // クライアント履歴へ保存（画像base64は保存しない）
  let readingId = null;
  if (client) {
    try {
      readingId = crypto.randomUUID();
      await env.DB.prepare(
        'INSERT INTO client_readings (id, client_id, pro_user_id, divination, title, summary, data_json, model) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(readingId, client.id, user.id, divination, computed.title || '',
        reading.slice(0, 9000),
        JSON.stringify(trimData(computed.data)).slice(0, 12000), model).run();

      // 再鑑定用に入力を保存（手相は特徴テキストのみ、画像は捨てる）
      if (body.saveToClient !== false) {
        const store = { ...answers };
        delete store.palmImage; delete store.palmImage2;
        if (palmFeatures) store.palmFeatures = palmFeatures;
        if (palmFeatures2) store.palmFeatures2 = palmFeatures2;
        await env.DB.prepare('UPDATE clients SET answers_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND pro_user_id = ?')
          .bind(JSON.stringify(store).slice(0, 8000), client.id, user.id).run();
      }

      const used = computed.data && computed.data.foresight && computed.data.foresight.patternsUsed;
      if (used && used.length) { try { await recordPredSignals(env.DB, readingId, used); } catch { /* */ } }
    } catch { readingId = null; }
  }

  return json({
    divination, title: computed.title, data: computed.data, material: computed.material,
    meta: computed.meta, reading, disclaimer: DISCLAIMER, model, readingId,
  });
}

// 保存用にdataを軽量化（巨大な配列を落とす）
function trimData(d) {
  if (!d || typeof d !== 'object') return d;
  const out = {};
  for (const k of Object.keys(d)) {
    if (k === 'foresight' && d[k]) {
      out.foresight = {
        windows: (d[k].windows || []).slice(0, 8).map((w) => ({ key: w.key, label: w.label, level: w.level, conf: w.conf, year: w.year, month: w.month })),
        heat: d[k].heat || null,
      };
    } else if (k === 'timing' && d[k]) {
      out.timing = { timingSignals: (d[k].timingSignals || []).slice(0, 12) };
    } else {
      out[k] = d[k];
    }
  }
  return out;
}
