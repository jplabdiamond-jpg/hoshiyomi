// ① 個人タイミングの個人化（計算のみ・追加入力不要）
// 年間プロフェクション / 二次進行（月・太陽）/ ソーラーアーク方向法 /
// 個人天体トランジットの日付化 / ソーラーリターン・ルナーリターン /
// 四柱の空亡（天中殺）・十二運。
// すべて出生データから決定的に算出する。出生時刻が要るもの（プロフェクション等）は
// timeKnown のときだけ出す（未入力時は正直に省略）。
import { SIGNS, bodyEclipticLongitude } from './astrology.js';
import { STEMS, BRANCHES } from './fourpillars.js';

const DAY = 86400000;
const TROPICAL_YEAR = 365.2422;
function norm360(x) { x %= 360; return x < 0 ? x + 360 : x; }
function sep(a, b) { let d = Math.abs(norm360(a - b)); return d > 180 ? 360 - d : d; }
function signIdx(lon) { return Math.floor(norm360(lon) / 30); }
function signJa(lon) { return SIGNS[signIdx(lon)].ja; }
function signLabel(lon) {
  const i = signIdx(lon), deg = norm360(lon) - i * 30;
  const d = Math.floor(deg), m = Math.floor((deg - d) * 60);
  return `${SIGNS[i].ja} ${d}°${String(m).padStart(2, '0')}′`;
}

// 伝統的支配星（プロフェクションの年の支配星＝タイムロード）
const RULERS = ['火星', '金星', '水星', '月', '太陽', '水星', '金星', '火星', '木星', '土星', '土星', '木星'];
// 天体→主な生活領域（foresightの領域語彙に合わせる）
const BODY_DOMAIN = {
  太陽: 'キャリア', 月: 'メンタル', 水星: '対人', 金星: '対人', 火星: 'キャリア',
  木星: '金銭', 土星: 'キャリア', 天王星: 'キャリア', 海王星: 'メンタル', 冥王星: '身体安全',
};
const HOUSE_THEME = {
  1: '自分自身・心身・第一印象', 2: '収入・所有・自己価値', 3: '学び・近い人間関係・移動',
  4: '家庭・住まい・基盤', 5: '恋愛・創造・楽しみ', 6: '仕事・健康・日々の習慣',
  7: 'パートナー・契約・対人', 8: '共有・継承・深い変容', 9: '遠方・学問・philosophy',
  10: '社会的立場・キャリア・目標', 11: '仲間・ネットワーク・未来設計', 12: '内面・休養・手放し',
};

function birthUTCms(chart) {
  const inp = chart.input || {};
  const h = inp.hourUsed ?? 12, mi = inp.minuteUsed ?? 0;
  return Date.UTC(inp.year, inp.month - 1, inp.day, h, mi, 0) - (inp.tzOffsetMinutes ?? 540) * 60000;
}
function natalLon(chart, ja) {
  if (ja === 'アセンダント') return chart.ascendant ? chart.ascendant.longitude : null;
  if (ja === 'MC') return chart.mc ? chart.mc.longitude : null;
  const p = (chart.planets || []).find((x) => x.ja === ja);
  return p ? p.longitude : null;
}
function preciseAge(chart, now) {
  const inp = chart.input;
  const b = Date.UTC(inp.year, inp.month - 1, inp.day);
  return (now.getTime() - b) / (TROPICAL_YEAR * DAY);
}

// ── 年間プロフェクション（要・出生時刻／アセンダント） ──
function profection(chart, age) {
  if (!chart.ascendant) return null;
  const whole = Math.floor(age);
  const h = (whole % 12) + 1;                 // 年齢0=1ハウス
  const ascSign = signIdx(chart.ascendant.longitude);
  const yearSign = (ascSign + (whole % 12)) % 12; // ホールサイン
  const ruler = RULERS[yearSign];
  return { age: whole, house: h, sign: SIGNS[yearSign].ja, ruler, theme: HOUSE_THEME[h], domain: BODY_DOMAIN[ruler] || 'キャリア' };
}

// ── 二次進行（1日=1年）：進行の月・太陽 ──
function progressions(chart, age, now, horizon = 30) {
  const bms = birthUTCms(chart);
  const progDate = new Date(bms + age * DAY);
  const pMoon = bodyEclipticLongitude('月', progDate);
  const pSun = bodyEclipticLongitude('太陽', progDate);
  const natalSun = natalLon(chart, '太陽');
  const out = { progMoonSign: pMoon != null ? signJa(pMoon) : null, progSunSign: pSun != null ? signJa(pSun) : null, progSunChange: null, progMoonNextSign: null };
  // 進行の太陽のサイン切替年（約30年に一度の人生の節目）
  if (pSun != null) {
    const rate = 360 / 360 / 1; // 進行太陽≒1°/年
    const nextBoundary = (signIdx(pSun) + 1) * 30;
    const degToGo = norm360(nextBoundary - pSun);
    const yrs = degToGo / 1.0; // ≒度数＝年数
    if (yrs <= horizon) out.progSunChange = { year: now.getFullYear() + Math.round(yrs), sign: SIGNS[(signIdx(pSun) + 1) % 12].ja };
  }
  // 進行の月の次サイン入り（約2.3年周期＝感情の季節替わり）
  if (pMoon != null) {
    const nextB = (signIdx(pMoon) + 1) * 30;
    const degToGo = norm360(nextB - pMoon);
    const yrs = degToGo / 13.2; // 進行月≒13.2°/年
    out.progMoonNextSign = { year: now.getFullYear() + Math.round(yrs * 10) / 10, sign: SIGNS[(signIdx(pMoon) + 1) % 12].ja };
  }
  if (natalSun != null && pSun != null) out.arc = norm360(pSun - natalSun); // ソーラーアーク量
  return out;
}

// ── ソーラーアーク方向法：方向点が出生の点に合（±1°）する年 ──
function solarArc(chart, age, now, horizon = 9) {
  const bms = birthUTCms(chart);
  const natalSun = natalLon(chart, '太陽');
  if (natalSun == null) return [];
  const movers = ['太陽', '月', 'アセンダント', 'MC'].filter((m) => natalLon(chart, m) != null);
  const targets = ['太陽', '月', '水星', '金星', '火星', '木星', '土星', '天王星', '海王星', '冥王星', 'アセンダント', 'MC']
    .map((ja) => ({ ja, lon: natalLon(chart, ja) })).filter((t) => t.lon != null);
  const hits = [];
  const nowAge = age;
  for (const mv of movers) {
    const mvLon = natalLon(chart, mv);
    for (const t of targets) {
      if (t.ja === mv) continue;
      const requiredArc = norm360(t.lon - mvLon); // 方向点が前進して合に至る弧（0..360）
      const ageAtHit = requiredArc / 1.0;         // ≒1°/年
      if (ageAtHit < nowAge - 0.5 || ageAtHit > nowAge + horizon) continue;
      const year = Math.round((chart.input.year) + ageAtHit);
      hits.push({ year, mover: mv, target: t.ja, domain: BODY_DOMAIN[t.ja === 'アセンダント' || t.ja === 'MC' ? '太陽' : t.ja] || 'キャリア' });
    }
  }
  hits.sort((a, b) => a.year - b.year);
  return hits.slice(0, 6);
}

// ── 個人天体トランジットの日付化（今後約120日・合±1.5°） ──
function innerTransits(chart, now, days = 120) {
  const movers = ['太陽', '水星', '金星', '火星'];
  const targets = ['太陽', '月', '金星', '火星', 'アセンダント', 'MC']
    .map((ja) => ({ ja, lon: natalLon(chart, ja) })).filter((t) => t.lon != null);
  const ORB = 1.5;
  const track = {}; // key -> {minOrb, date}
  for (let d = 0; d <= days; d += 1) {
    const date = new Date(now.getTime() + d * DAY);
    for (const mv of movers) {
      const lon = bodyEclipticLongitude(mv, date);
      if (lon == null) continue;
      for (const t of targets) {
        if (t.ja === mv) continue;
        const o = sep(lon, t.lon);
        if (o <= ORB) {
          const key = `${mv}>${t.ja}`;
          if (!track[key] || o < track[key].minOrb) track[key] = { minOrb: o, date, mover: mv, target: t.ja };
        }
      }
    }
  }
  const meaning = {
    太陽: '物事の焦点が当たり動き出す', 金星: '人間関係・好意・金運が動く',
    火星: '行動力・情熱・衝突のエネルギー', 水星: '連絡・契約・情報が動く',
  };
  return Object.values(track)
    .filter((h) => h.mover !== '太陽' || ['月', 'アセンダント', 'MC'].includes(h.target)) // 太陽は要所のみ
    .sort((a, b) => a.date - b.date)
    .slice(0, 8)
    .map((h) => ({ ...h, ymd: `${h.date.getFullYear()}年${h.date.getMonth() + 1}月${h.date.getDate()}日ごろ`, note: meaning[h.mover] || '' }));
}

// ── ソーラーリターン（毎年の誕生日図の瞬間）＆ルナーリターン（今月の情緒リセット日） ──
function returns(chart, now) {
  const natalSun = natalLon(chart, '太陽');
  const natalMoon = natalLon(chart, '月');
  const out = {};
  // ソーラーリターン：太陽が出生黄経に戻る次の瞬間（±数日を日単位で探索）
  if (natalSun != null) {
    const y = now.getFullYear();
    for (const yy of [y, y + 1]) {
      let bestD = null, bestOrb = 999;
      const center = new Date(chart.input.year === yy ? now : now); // 近傍探索（誕生日付近）
      // 誕生月日付近を中心に±20日
      const approx = new Date(yy, chart.input.month - 1, chart.input.day);
      for (let d = -20; d <= 20; d++) {
        const date = new Date(approx.getTime() + d * DAY);
        const lon = bodyEclipticLongitude('太陽', date);
        const o = sep(lon, natalSun);
        if (o < bestOrb) { bestOrb = o; bestD = date; }
      }
      if (bestD && bestD.getTime() >= now.getTime() - 2 * DAY) {
        const srMoon = bodyEclipticLongitude('月', bestD);
        out.solar = { date: bestD, ymd: `${bestD.getFullYear()}年${bestD.getMonth() + 1}月${bestD.getDate()}日`, moonSign: srMoon != null ? signJa(srMoon) : null };
        break;
      }
    }
  }
  // ルナーリターン：月が出生黄経に戻る次の日（今後約30日）
  if (natalMoon != null) {
    let bestD = null, bestOrb = 999;
    for (let d = 0; d <= 29; d++) {
      const date = new Date(now.getTime() + d * DAY);
      const lon = bodyEclipticLongitude('月', date);
      const o = sep(lon, natalMoon);
      if (o < bestOrb) { bestOrb = o; bestD = date; }
    }
    if (bestD) out.lunar = { date: bestD, ymd: `${bestD.getFullYear()}年${bestD.getMonth() + 1}月${bestD.getDate()}日ごろ` };
  }
  return out;
}

// ── 四柱：空亡（天中殺）と十二運 ──
const STAGES = ['長生', '沐浴', '冠帯', '臨官', '帝旺', '衰', '病', '死', '墓', '絶', '胎', '養'];
const STAGE_POL = { 長生: 1, 冠帯: 1, 臨官: 1, 帝旺: 1, 養: 1, 沐浴: 0, 衰: 0, 胎: 0, 病: -1, 死: -1, 墓: -1, 絶: -1 };
const LONGSHENG = [11, 6, 2, 9, 2, 9, 5, 0, 8, 3]; // 甲乙丙丁戊己庚辛壬癸 の長生の支
function twelveStage(dayStemIdx, branchIdx) {
  const ls = LONGSHENG[dayStemIdx];
  const yang = dayStemIdx % 2 === 0;
  const idx = yang ? norm12(branchIdx - ls) : norm12(ls - branchIdx);
  return STAGES[idx];
}
function norm12(x) { return ((x % 12) + 12) % 12; }
function kuubou(dayStemIdx, dayBranchIdx) {
  const b0 = norm12(dayBranchIdx - dayStemIdx);
  return [norm12(b0 + 10), norm12(b0 + 11)]; // 空亡の2支
}

/**
 * @param {object} o { chart, fp, now?:Date }
 */
export function computeTiming(o) {
  const { chart, fp } = o;
  const now = o.now || new Date();
  const age = preciseAge(chart, now);
  const timeKnown = !!chart.ascendant;

  const prof = profection(chart, age);
  const prog = progressions(chart, age, now);
  const sa = solarArc(chart, age, now);
  const inner = innerTransits(chart, now);
  const ret = returns(chart, now);

  // 四柱の空亡・十二運
  let fourTiming = null;
  if (fp && typeof fp.dayStemIdx === 'number' && typeof fp.dayBranchIdx === 'number') {
    const [v1, v2] = kuubou(fp.dayStemIdx, fp.dayBranchIdx);
    const curYearBranch = ((now.getFullYear() - 4) % 12 + 12) % 12;
    const yearStage = twelveStage(fp.dayStemIdx, curYearBranch);
    const inVoid = (curYearBranch === v1 || curYearBranch === v2);
    fourTiming = {
      voidBranches: [BRANCHES[v1], BRANCHES[v2]],
      yearStage, yearStagePol: STAGE_POL[yearStage] ?? 0,
      yearInVoid: inVoid,
      // 今後の空亡年（今後8年）
      voidYears: [],
    };
    for (let i = 0; i < 8; i++) {
      const yy = now.getFullYear() + i;
      const yb = ((yy - 4) % 12 + 12) % 12;
      if (yb === v1 || yb === v2) fourTiming.voidYears.push(yy);
    }
  }

  // foresightの合致エンジンへ渡す年シグナル（決定的なものだけ厳選）
  const timingSignals = [];
  if (prof) timingSignals.push({ year: now.getFullYear(), sys: '節目', label: `プロフェクション:${prof.house}ハウス期（${prof.theme}／年の支配星=${prof.ruler}）`, domains: [{ domain: prof.domain, pol: 0, why: `${prof.house}ハウス（${prof.theme}）が一年の主題` }], pattern: `prof:${prof.house}` });
  if (prog.progSunChange) timingSignals.push({ year: prog.progSunChange.year, sys: '占星術', label: `進行の太陽が${prog.progSunChange.sign}へ（約30年に一度の自己テーマの転換）`, domains: [{ domain: 'キャリア', pol: 0, why: '生き方の基調が変わる大節目' }], pattern: 'prog:sun-sign' });
  for (const h of sa) timingSignals.push({ year: h.year, sys: '占星術', label: `ソーラーアーク：方向${h.mover}が出生${h.target}に合（人生の設計図が動く年）`, domains: [{ domain: h.domain, pol: 0, why: `${h.target}の主題が前面に出る` }], pattern: `sa:${h.target}` });
  if (fourTiming) {
    for (const yy of fourTiming.voidYears) timingSignals.push({ year: yy, sys: '節目', label: '空亡（天中殺）：拡大より充電・整理に向く年', domains: [{ domain: 'メンタル', pol: 0, why: '結果を急がず基盤を整える時期' }], pattern: 'fp:kuubou' });
  }

  return { age: Math.floor(age), timeKnown, profection: prof, progressions: prog, solarArc: sa, innerTransits: inner, returns: ret, fourTiming, timingSignals };
}

export function summarizeTiming(t) {
  const L = [];
  L.push('【個人タイミング（あなた固有の時計。上の合致窓と併せて、日付・年の具体性を補強すること）】');
  if (t.profection) {
    L.push(`・年間プロフェクション：現在 ${t.profection.house}ハウス期（${t.profection.theme}）。この一年の主題で、年の支配星は${t.profection.ruler}。関連領域＝${t.profection.domain}。`);
  } else {
    L.push('・年間プロフェクション：出生時刻が未確定のため省略（時刻が分かるとこの一年の主題を特定できる）。');
  }
  if (t.progressions) {
    const p = t.progressions;
    if (p.progMoonSign) L.push(`・二次進行の月：いま「${p.progMoonSign}」の感情の季節${p.progMoonNextSign ? `（約${Math.max(0, Math.round((p.progMoonNextSign.year - new Date().getFullYear()) * 10) / 10)}年後に${p.progMoonNextSign.sign}へ）` : ''}。日々の気分・関心の土台。`);
    if (p.progSunSign) L.push(`・二次進行の太陽：「${p.progSunSign}」。生き方の基調${p.progSunChange ? `。${p.progSunChange.year}年ごろ${p.progSunChange.sign}入り＝自己テーマの転換` : ''}。`);
  }
  if (t.solarArc && t.solarArc.length) {
    L.push('・ソーラーアーク（人生の設計図が動く年）：');
    for (const h of t.solarArc) L.push(`    - ${h.year}年ごろ：方向${h.mover}→出生${h.target}（${h.domain}）`);
  }
  if (t.innerTransits && t.innerTransits.length) {
    L.push('・個人天体トランジット（この数ヶ月の具体日）：');
    for (const h of t.innerTransits) L.push(`    - ${h.ymd}：運行${h.mover}があなたの${h.target}に重なる — ${h.note}`);
  }
  if (t.returns) {
    if (t.returns.solar) L.push(`・ソーラーリターン：次の誕生日図は ${t.returns.solar.ymd}${t.returns.solar.moonSign ? `（その年の情緒トーン=月が${t.returns.solar.moonSign}）` : ''}。一年の雰囲気の起点。`);
    if (t.returns.lunar) L.push(`・ルナーリターン：${t.returns.lunar.ymd}が今月の情緒リセット日（仕切り直しに向く）。`);
  }
  if (t.fourTiming) {
    const f = t.fourTiming;
    L.push(`・四柱：空亡（天中殺）は【${f.voidBranches.join('・')}】の年月。今年は十二運「${f.yearStage}」${f.yearStagePol > 0 ? '＝勢いが乗る時期' : f.yearStagePol < 0 ? '＝力を蓄える時期' : '＝移ろいの時期'}${f.yearInVoid ? '／かつ空亡年（拡大より整理）' : ''}。`);
    if (f.voidYears && f.voidYears.length) L.push(`    - 今後の空亡年：${f.voidYears.join('・')}年（新規の大勝負より充電・見直しに向く）`);
  }
  L.push('※これらは出生データから決定的に算出した“あなた固有”の時計。汎用的な一般論ではなく、必ず上記の具体的な年・日付に紐づけて語ること。');
  return L.join('\n');
}
