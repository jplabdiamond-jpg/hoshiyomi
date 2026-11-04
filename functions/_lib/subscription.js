// ③ 継続鑑定の中核：毎月の鑑定生成 → 予測(合致窓)の保存 → 答え合わせ → 本人別較正
import { computeDivination, buildMessages, cleanReading, DISCLAIMER } from './reading.js';
import { getCalibration } from './calibration.js';
import { SPEC } from './baserates.js';

const DEFAULT_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

// 答え合わせ実績 → パターン別の本人較正重み（的中で>1、外れで<1）
export async function getUserWeights(DB, userId) {
  const w = {};
  try {
    const rs = await DB.prepare('SELECT pattern, hits, misses FROM user_calibration WHERE user_id = ?').bind(userId).all();
    for (const r of (rs.results || [])) {
      const n = (r.hits || 0) + (r.misses || 0);
      if (!n) continue;
      const rate = (r.hits || 0) / n;             // 0..1
      // 的中率0.5を中立に、±で0.6〜1.5へ。件数が少ないうちは中立寄り（n/(n+2)で減衰）
      const strength = n / (n + 2);
      w[r.pattern] = Math.max(0.6, Math.min(1.5, 1 + (rate - 0.5) * 2 * 0.5 * strength));
    }
  } catch { /* 無ければ中立 */ }
  return w;
}

function mergeWeights(a, b) {
  const out = { ...a };
  for (const k of Object.keys(b)) out[k] = (out[k] ?? 1) * b[k];
  return out;
}

// 継続鑑定を1回生成して保存し、予測(合致窓)を登録する
export async function generateSubReading(env, user) {
  const DB = env.DB;
  const answers = JSON.parse(user.answers_json || '{}');

  // 較正：A=希少度(静的) / C=母集団実測 / U=本人の答え合わせ実績
  let pop = {};
  try { pop = (await getCalibration(DB)).weights; } catch { pop = {}; }
  const userW = await getUserWeights(DB, user.id);
  const calibWeights = mergeWeights(pop, userW);

  const computed = computeDivination('comprehensive_plus', answers, {
    calibWeights, specTable: SPEC,
    features: answers.palmFeatures || null, features2: answers.palmFeatures2 || null,
  });

  const model = env.AI_MODEL || DEFAULT_MODEL;
  let reading = '';
  if (env.AI) {
    try {
      const messages = buildMessages('comprehensive_plus', computed, answers);
      const resp = await env.AI.run(model, { messages, max_tokens: 3584, temperature: 0.85, top_p: 0.95, frequency_penalty: 0.5, presence_penalty: 0.3 });
      reading = cleanReading('comprehensive_plus', (resp && (resp.response || resp.result || '')).trim());
    } catch { /* フォールバック下 */ }
  }
  if (!reading) reading = '【今月の鑑定データ】\n' + computed.material + '\n\n（鑑定文の自動生成が一時的に混み合っています。上記データをもとにご覧ください。）';

  const windows = (computed.data?.foresight?.windows || []);
  const readingId = crypto.randomUUID();
  const now = new Date();

  // 前回との差分（推移）: 直近の sub_reading の windows と比較
  let diff = null;
  try {
    const prev = await DB.prepare('SELECT data_json FROM sub_readings WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').bind(user.id).first();
    if (prev) {
      const pj = JSON.parse(prev.data_json || '{}');
      const prevKeys = new Set((pj.windows || []).map((w) => w.key));
      const nowKeys = new Set(windows.map((w) => w.key));
      diff = {
        added: windows.filter((w) => !prevKeys.has(w.key)).map((w) => ({ label: w.label, level: w.level })),
        gone: (pj.windows || []).filter((w) => !nowKeys.has(w.key)).map((w) => ({ label: w.label })),
      };
    }
  } catch { /* 初回 */ }

  // 保存
  try {
    await DB.prepare('INSERT INTO sub_readings (id, user_id, summary, data_json, model) VALUES (?, ?, ?, ?, ?)')
      .bind(readingId, user.id, reading.slice(0, 8000),
        JSON.stringify({ windows: windows.map((w) => ({ key: w.key, label: w.label, level: w.level, conf: w.conf, year: w.year, month: w.month, patterns: w.patterns, domains: w.domains })), timing: computed.data?.timing?.timingSignals || [] }).slice(0, 12000),
        model).run();

    // 予測の登録（上位の合致窓を“あとで答え合わせする予測”として保存）
    const stmts = [];
    for (const w of windows.slice(0, 6)) {
      const dueYm = `${w.year}-${String(w.month).padStart(2, '0')}`;
      const pid = crypto.randomUUID();
      stmts.push(DB.prepare(
        'INSERT INTO predictions (id, user_id, reading_id, window_key, label, due_ym, conf, level, domains, patterns) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(pid, user.id, readingId, w.key, w.label.slice(0, 300), dueYm, w.conf || 0, w.level || '-', JSON.stringify(w.domains || []).slice(0, 500), JSON.stringify(w.patterns || []).slice(0, 500)));
    }
    if (stmts.length) await DB.batch(stmts);
  } catch { /* 保存失敗は無視 */ }

  // 本人較正が効いているか（答え合わせ実績の件数）
  let calibratedN = 0;
  try { const c = await DB.prepare('SELECT COUNT(*) n FROM predictions WHERE user_id = ? AND checked = 1').bind(user.id).first(); calibratedN = c?.n || 0; } catch { /* */ }

  return { readingId, reading, disclaimer: DISCLAIMER, windows, diff, calibratedN, createdAt: now.toISOString() };
}

// 期限が来て未回答の予測（答え合わせ待ち）を返す
export async function pendingChecks(DB, userId) {
  const nowYm = new Date().toISOString().slice(0, 7); // YYYY-MM
  try {
    const rs = await DB.prepare(
      'SELECT id, label, due_ym, level, conf FROM predictions WHERE user_id = ? AND checked = 0 AND due_ym <= ? ORDER BY due_ym ASC LIMIT 20'
    ).bind(userId, nowYm).all();
    return rs.results || [];
  } catch { return []; }
}

// 答え合わせを記録し、本人較正(user_calibration)を更新
export async function recordOutcome(DB, userId, predictionId, outcome) {
  if (!['hit', 'partial', 'miss'].includes(outcome)) return { ok: false, error: 'bad_outcome' };
  const p = await DB.prepare('SELECT * FROM predictions WHERE id = ? AND user_id = ?').bind(predictionId, userId).first();
  if (!p) return { ok: false, error: 'not_found' };
  if (p.checked) return { ok: true, already: true };
  await DB.prepare('UPDATE predictions SET checked = 1, outcome = ?, checked_at = CURRENT_TIMESTAMP WHERE id = ?').bind(outcome, predictionId).run();
  // パターン別に加点/減点（partialは的中0.5相当＝hit+miss両方に0.5は扱いづらいのでhit側に弱く）
  let patterns = [];
  try { patterns = JSON.parse(p.patterns || '[]'); } catch { patterns = []; }
  const hitInc = outcome === 'hit' ? 1 : outcome === 'partial' ? 1 : 0;
  const missInc = outcome === 'miss' ? 1 : 0;
  const stmts = [];
  for (const pat of patterns) {
    stmts.push(DB.prepare(
      `INSERT INTO user_calibration (user_id, pattern, hits, misses) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, pattern) DO UPDATE SET hits = hits + ?, misses = misses + ?`
    ).bind(userId, pat, hitInc, missInc, hitInc, missInc));
  }
  if (stmts.length) { try { await DB.batch(stmts); } catch { /* */ } }
  return { ok: true };
}
