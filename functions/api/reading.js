// POST /api/reading
// body: { divination: 'astrology'|'fourpillars'|'tarot', answers: {...} }
// → 確定計算 + Cloudflare Workers AI による鑑定文を返す
import { computeDivination, buildMessages, DISCLAIMER } from '../_lib/reading.js';
import { ensureSchema } from '../_lib/db.js';

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

  const { divination, answers } = body || {};
  if (!divination || !answers) {
    return json({ error: 'divination と answers は必須です' }, 400);
  }

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
      reading = (resp && (resp.response || resp.result || '')).trim();
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
