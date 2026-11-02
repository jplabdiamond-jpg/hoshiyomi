// ④ フィードバック実測較正
// 「どの占術が当たりやすいか」を過去の当たり外れ評価から学習し、確度の重みに反映する。
// pred_signals（鑑定ごとに確度へ寄与した占術）× feedback（当たり/外れ）を突き合わせて
// 占術ごとの的中率を出し、重み 0.7〜1.3 に写像する（サンプルが少ない占術は 1.0＝中立）。
import { ensureSchema } from './db.js';

const MIN_SAMPLES = 5; // これ未満は中立（1.0）
const W_LO = 0.7, W_HI = 1.3;

// パターン → 重み のマップを返す（DB不可・データ無しなら空＝全て中立）
// 手法(占星術/四柱推命…)単位ではなく、個人によらず共通する「パターン」単位で較正する。
// 例: astro:木星:soft / fp:m:官殺 / fp:y:冲 / num:py8 / node:サターンリターン
export async function getCalibration(DB) {
  if (!DB) return { weights: {}, samples: {} };
  try {
    await ensureSchema(DB);
    const r = await DB.prepare(
      `SELECT p.pattern AS pattern, COUNT(*) AS n, AVG(f.accurate) AS acc
         FROM pred_signals p
         JOIN feedback f ON p.reading_id = f.reading_id
        WHERE f.accurate IS NOT NULL AND p.pattern IS NOT NULL
        GROUP BY p.pattern`
    ).all();
    const weights = {}, samples = {};
    for (const row of (r.results || [])) {
      const n = Number(row.n) || 0;
      samples[row.pattern] = n;
      // acc 0..1 → 重み W_LO..W_HI（acc=0.5 で 1.0）
      weights[row.pattern] = n >= MIN_SAMPLES ? W_LO + (W_HI - W_LO) * Number(row.acc) : 1.0;
    }
    return { weights, samples };
  } catch {
    return { weights: {}, samples: {} };
  }
}

// この鑑定で確度に寄与したパターンを記録（後日のフィードバックで較正に使う）
export async function recordPredSignals(DB, readingId, patterns) {
  if (!DB || !readingId || !Array.isArray(patterns) || !patterns.length) return;
  try {
    await ensureSchema(DB);
    const uniq = [...new Set(patterns)].slice(0, 12);
    const stmt = DB.prepare('INSERT INTO pred_signals (id, reading_id, pattern) VALUES (?, ?, ?)');
    await DB.batch(uniq.map((p) => stmt.bind(crypto.randomUUID(), readingId, p)));
  } catch {
    // 記録に失敗しても鑑定は返す
  }
}
