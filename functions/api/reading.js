// POST /api/reading
// body: { divination: 'astrology'|'fourpillars'|'tarot', answers: {...} }
// → 確定計算 + Cloudflare Workers AI による鑑定文を返す
import { computeDivination, buildMessages, cleanReading, DISCLAIMER } from '../_lib/reading.js';
import { ensureSchema } from '../_lib/db.js';
import { getCalibration, recordPredSignals } from '../_lib/calibration.js';
import { SPEC } from '../_lib/baserates.js';
import { getCheckoutSession } from '../_lib/stripe.js';

const PAID = new Set(['comprehensive_plus']); // 有料モード

const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const DEFAULT_VISION_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';

const PALM_VISION_PROMPT =
  'これは手相鑑定用の手のひらの写真です。実際に画像から見える特徴だけを、できるだけ細かく具体的に日本語の箇条書きで報告してください（推測で線を作らない。見えない/不明瞭な項目は「不明瞭」と書く）。各項目をこの形式で:\n' +
  '【手の形】手のひらは四角形/長方形のどちらに近いか。指は長い/短い。手の厚み・硬さ・血色の印象。\n' +
  '【指先・親指】指先の形（尖る/円錐/四角/先広がり）。人差し指と薬指どちらが長いか。親指は大きい/小さい、よく開くか、硬いか。\n' +
  '【生命線】見えるか。親指の付け根をどの程度大きく囲むか（大きく張り出す/小さい）、濃さ、長さ、二重線の有無。途切れ・島・鎖・向上線（上向きの細い支線）があれば、線の上の方/中ほど/手首寄りの下の方のどこにあるか（流年＝時期の判断に使う）。\n' +
  '【知能線（頭脳線）】見えるか。真横に直線か下（月丘）へカーブか。長さ（中指下/薬指下/小指下）。起点が生命線とくっつくか離れるか。先端の枝分かれ（二又）の有無。手を横断して小指側へ抜けていないか。\n' +
  '【感情線】見えるか。終点（人差し指の下/人差し指と中指の間/中指の下）。直線的かカーブか。鎖状・枝分かれの有無。知能線との間隔は広い/狭い。\n' +
  '【運命線】中指へ向かう縦線が見えるか。濃さ、起点（手首中央/小指側の下＝月丘側/生命線上/知能線あたり）、途切れ・ずれ・支線合流の有無とその高さ（手首寄り/中ほど/感情線付近）。見えなければ「見えない」。\n' +
  '【太陽線・財運線】薬指の下（太陽線）／小指の下（財運線）に縦線が見えるか。長さ・本数。\n' +
  '【結婚線】小指の付け根と感情線の間の短い横線。本数、上向き/下向き、二又や島の有無。\n' +
  '【金星帯】人差し指〜小指の付け根を弧で結ぶ線が見えるか。\n' +
  '【丘のふくらみ】金星丘(親指付け根)/木星丘(人差し指下)/土星丘(中指下)/太陽丘(薬指下)/水星丘(小指下)/月丘(小指側の下)のうち、特に発達して見えるもの。\n' +
  '【特殊な印】星(★)・十字・三角・四角・格子・島・魚の形などの印、仏眼(親指第一関節)、マスカケ線(知能線と感情線が一本に繋がり手を横断)が見えるか。\n' +
  'もし手のひらが写っていない/手の甲だけ/不鮮明で線が読めない場合は、必ず先頭行に「[NOT_PALM]」とだけ書くこと。';

// 候補のビジョンモデル（上から順に試す）。
// llama-3.2-visionはアカウントでのライセンス同意が必要なため、非ゲートのモデルも併せて試す。
// kind: 'messages'=image_url(dataURL)形式 / 'llava'=バイト配列+prompt形式。
// Llama 3.2 Vision（ライセンス同意済み・日本語の特徴抽出が高品質）を優先し、
// 不調時は非ゲートの llava にフォールバックする。
const VISION_CANDIDATES = [
  { model: '@cf/meta/llama-3.2-11b-vision-instruct', kind: 'messages' },
  { model: '@cf/llava-hf/llava-1.5-7b-hf', kind: 'llava' },
];

function dataUrlToBytes(u) {
  const b64 = (u.split(',')[1] || '');
  const bin = atob(b64);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return [...a];
}

// 画像＋プロンプトでビジョンモデルを呼ぶ（候補を順に試す）
async function runVision(env, dataUrl, promptText, maxTokens = 768) {
  const kindOf = (m) => (m.includes('llava') || m.includes('uform') ? 'llava' : 'messages');
  const pref = env.PALM_VISION_MODEL
    ? [{ model: env.PALM_VISION_MODEL, kind: kindOf(env.PALM_VISION_MODEL) }]
    : [];
  const list = [...pref, ...VISION_CANDIDATES.filter((c) => !pref.some((p) => p.model === c.model))];
  let lastErr = null;
  for (const c of list) {
    try {
      let text = '';
      if (c.kind === 'messages') {
        const r = await env.AI.run(c.model, {
          messages: [{ role: 'user', content: [
            { type: 'text', text: promptText },
            { type: 'image_url', image_url: { url: dataUrl } },
          ] }],
          max_tokens: maxTokens, temperature: 0.1,
        });
        text = (r && (r.response || r.result || '')).trim();
      } else {
        const r = await env.AI.run(c.model, { image: dataUrlToBytes(dataUrl), prompt: promptText, max_tokens: maxTokens });
        text = (r && (r.description || r.response || r.result || '')).trim();
      }
      if (text) return { model: c.model, text };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('利用可能なビジョンモデルがありません');
}

// 厳格判定：写っている主被写体を一語で答えさせる（「手のひらか？」はモデルが"はい"に偏るため不可）。
const PALM_CLASSIFY_PROMPT =
  'この写真に写っている主な被写体は何ですか。最も当てはまるものを、短い日本語の名詞ひとつだけで答えてください。' +
  '例: 手のひら / 手の甲 / 風景 / 空 / 文字 / 人の顔 / 料理 / 動物 / 建物 / 画面 / 物。' +
  '説明や文章は書かず、名詞ひとつだけを答えること。';

// 手のひらか判定（true=手のひらのみ）。手の甲・それ以外・曖昧はすべて false（＝弾く）。
async function classifyPalm(env, dataUrl) {
  const { text } = await runVision(env, dataUrl, PALM_CLASSIFY_PROMPT, 24);
  const t = (text || '').toLowerCase();
  const backOrOther = /甲|背|back/.test(t);
  const isPalm = !backOrOther && (/手のひら|掌|手相|ての?ひら|palm/.test(t) || (/(^|[^の])手|hand/.test(t) && !/甲|背/.test(t)));
  return { isPalm, raw: text };
}

// 写真から手相の特徴を抽出
async function extractPalmFeatures(env, dataUrl) {
  return runVision(env, dataUrl, PALM_VISION_PROMPT, 1000);
}

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

  // 0) 確度較正の重み。A=希少度(静的・常時)、C=実測フィードバック(DBがあれば)。失敗しても中立で続行
  let calibWeights = {};
  if (divination.startsWith('comprehensive') && env.DB) {
    try { calibWeights = (await getCalibration(env.DB)).weights; } catch { calibWeights = {}; }
  }

  // 0.5) 手相：アップロードされた写真から特徴を抽出（ビジョンモデル）
  let palmFeatures = null, palmVisionModel = null;
  if (divination === 'palm') {
    const img = answers && answers.palmImage;
    if (!img || typeof img !== 'string' || !/^data:image\/(png|jpe?g|webp);base64,/i.test(img)) {
      return json({ error: '手のひらの写真（JPEG/PNG）をアップロードしてください' }, 400);
    }
    if (!env.AI) return json({ error: '画像の解析が利用できません（AI未設定）' }, 503);
    const RETAKE = '手のひらの写真として読み取れませんでした。手のひら全体（指先まで）がはっきり写るように、明るい場所で手を少し広げて撮った写真をアップロードしてください。';
    // ① 手のひらか厳格判定（手以外・手の甲・不鮮明は弾く）
    try {
      const cls = await classifyPalm(env, img);
      if (!cls.isPalm) {
        return json({ divination, title: '手相', data: {}, meta: {}, reading: RETAKE, disclaimer: DISCLAIMER, readingId: null });
      }
    } catch { /* 判定自体が失敗したら②の抽出＋[NOT_PALM]に委ねる */ }
    // ② 特徴抽出
    try {
      const v = await extractPalmFeatures(env, img);
      palmFeatures = v.text; palmVisionModel = v.model;
    } catch (e) {
      return json({ error: '画像の解析に失敗しました。明るい場所で撮り直してお試しください。', detail: String(e.message || e) }, 200);
    }
    // 手のひらとして読み取れない場合は、鑑定せず撮り直しを案内
    if (/^\s*\[NOT_PALM\]/.test(palmFeatures)) {
      return json({
        divination, title: '手相', data: {}, meta: {},
        reading: '手のひらがはっきり読み取れませんでした。明るい場所で、手のひら全体（指先まで）がはっきり写るように撮り直していただけますか。手を少し広げ、影が入らないようにすると占いやすくなります。',
        disclaimer: DISCLAIMER, model: palmVisionModel, readingId: null,
      });
    }
  }

  // 1) 確定計算（命式・チャート・カード／手相は特徴テキストを材料化）
  let computed;
  try {
    computed = computeDivination(divination, answers, { calibWeights, specTable: SPEC, features: palmFeatures });
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
      // 画像のbase64は保存しない（プライバシー・容量）。手相は特徴テキストのみ残す
      const storeAnswers = divination === 'palm' ? { ...answers, palmImage: '[image omitted]' } : answers;
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
