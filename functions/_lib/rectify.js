// 出生時刻のレクティフィケーション（計算のみ・追加入力不要）
// 原理: アセンダント/MCは出生時刻に敏感（約15°/時）。過去の大きな転機の時期に、
//   出生時刻に依存するASC/MCへ外惑星トランジットが最もよく合う時刻を逆推定する。
// 位置（緯度経度）が必要。
// ハードなpass/failではなく「確信度(confidence 0..1)」を返す。拮抗して絞れない時は
// 低confidence（または null）で返し、呼び出し側が採用可否・重みを決める。
import { ascMcAtUTC, bodyEclipticLongitude } from './astrology.js';

const JP_TZ = 540; // 分
// 外惑星ほど「その時期だけの」希少な配置＝鑑定の決め手になりやすい
const SLOW = [
  { ja: '木星', w: 0.9 }, { ja: '土星', w: 1.3 }, { ja: '天王星', w: 1.2 },
  { ja: '海王星', w: 1.0 }, { ja: '冥王星', w: 1.4 },
];
const ASPECTS = [0, 180, 120, 90, 60]; // 合・衝・三分・矩・六分
const ORB = 3;      // 度（レクティフィケーションはタイトに）
const STEP_MIN = 15; // 候補時刻の刻み（分）。ASCは15分で約4°動く

function sep(a, b) { let d = Math.abs(((a - b) % 360 + 360) % 360); return d > 180 ? 360 - d : d; }
// アスペクトの近さを 0..1 で返す（タイトなほど1）。段階的スコアでピークを鋭くする
function aspectScore(a, b) {
  let bestClose = 0;
  for (const ang of ASPECTS) {
    const d = Math.abs(sep(a, b) - ang);
    if (d <= ORB) { const c = 1 - d / ORB; if (c > bestClose) bestClose = c; }
  }
  return bestClose;
}
function median(xs) { const a = xs.slice().sort((p, q) => p - q); const n = a.length; return n ? (n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2) : 0; }
// 分単位の円環差（1日=1440分）
function circMin(a, b) { let d = Math.abs(a - b) % 1440; return d > 720 ? 1440 - d : d; }

/**
 * @param {object} o { year, month, day, lat, lon, events:[{cat,year,month}] }
 * @returns {null | { hour, minute, score, confidence, windowMin, asc, mc }}
 */
export function rectifyBirthTime(o) {
  const { year, month, day, lat, lon } = o;
  const events = (o.events || []).filter((e) => e && e.year);
  if (typeof lat !== 'number' || typeof lon !== 'number' || !events.length) return null;

  // 各イベント時の外惑星の黄経を先に計算（候補時刻に依存しない＝重い計算はここだけ）
  const evTransits = [];
  for (const ev of events) {
    const em = ev.month || 6;
    const dt = new Date(Date.UTC(ev.year, em - 1, 15, 3, 0, 0)); // おおよそ正午(JST)
    const arr = [];
    for (const s of SLOW) {
      try { const lonT = bodyEclipticLongitude(s.ja, dt); if (typeof lonT === 'number') arr.push({ w: s.w, lon: lonT }); } catch { /* skip */ }
    }
    if (arr.length) evTransits.push(arr);
  }
  if (!evTransits.length) return null;

  // 候補時刻を総当り（ASC/MC計算は軽い三角計算のみ）
  const cands = [];
  for (let mins = 0; mins < 24 * 60; mins += STEP_MIN) {
    const hour = Math.floor(mins / 60), minute = mins % 60;
    const utc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0) - JP_TZ * 60000);
    let asc, mc;
    try { ({ ascendant: asc, mc } = ascMcAtUTC(utc, lat, lon)); } catch { continue; }
    let score = 0;
    for (const et of evTransits) {
      for (const t of et) {
        score += aspectScore(t.lon, asc) * t.w;        // ASCは体感・対人・人生の方向に敏感
        score += aspectScore(t.lon, mc) * t.w * 0.9;   // MCは社会的立場・仕事
      }
    }
    cands.push({ mins, hour, minute, asc, mc, score });
  }
  if (!cands.length) return null;

  const scores = cands.map((c) => c.score);
  const max = Math.max(...scores);
  const med = median(scores);
  if (max <= 0) return null;
  // 信号がフラット（最良が中央値とほぼ同じ）＝情報なし
  if (max < med * 1.2 + 0.3) return null;

  let best = cands[0];
  for (const c of cands) if (c.score > best.score) best = c;

  // 0°/180°対称により、best の約12時間後（ASC↔DSC反転＝同じ幾何）は必ず近接タイになる。
  // これは本質的なAM/PM曖昧性であって「外れ」ではないので、識別力の評価から除外する。
  const oppMins = (best.mins + 720) % 1440;

  // (1) 識別力: best から3時間以上離れ、かつ12時間ミラーでもない候補の最良との差
  let rival = 0;
  for (const c of cands) {
    if (circMin(c.mins, best.mins) < 180) continue;      // ピーク近傍は同一クラスタ
    if (circMin(c.mins, oppMins) < 40) continue;          // 12hミラーは本質的対称なので除外
    if (c.score > rival) rival = c.score;
  }
  const sep01 = max > 0 ? Math.max(0, (max - rival) / max) : 0;

  // (2) ピーク集中度: softmaxの質量のうち best の±90分に集まる割合
  const T = Math.max(max - med, 0.5);
  let mass = 0, nearMass = 0;
  for (const c of cands) {
    const w = Math.exp((c.score - max) / T);
    mass += w;
    if (circMin(c.mins, best.mins) <= 90) nearMass += w;
  }
  const conc = mass > 0 ? nearMass / mass : 0;

  // 推定時刻の窓（±）: best付近で max の85%以上を保つ範囲
  const thr = max * 0.85;
  let windowMin = STEP_MIN;
  for (const c of cands) if (c.score >= thr) { const d = circMin(c.mins, best.mins); if (d <= 180 && d > windowMin) windowMin = d; }

  const confidence = Math.max(0, Math.min(1, 0.6 * sep01 + 0.4 * conc));

  // AM/PM（12hミラー）が解けているか: best が自分のミラー時刻を明確に上回るか。
  // 解けていなければ星座のペアは分かっても昼夜が確定しない＝ハウスを当てると反転リスク。
  let mirrorMax = 0;
  for (const c of cands) if (circMin(c.mins, oppMins) <= 40 && c.score > mirrorMax) mirrorMax = c.score;
  const mirrorSep = max > 0 ? Math.max(0, (max - mirrorMax) / max) : 0;
  const amPmResolved = mirrorSep >= 0.15;

  return {
    hour: best.hour, minute: best.minute,
    score: Math.round(best.score * 10) / 10,
    confidence: Math.round(confidence * 100) / 100,
    mirrorSep: Math.round(mirrorSep * 100) / 100,
    amPmResolved,
    windowMin,
    asc: best.asc, mc: best.mc,
  };
}
