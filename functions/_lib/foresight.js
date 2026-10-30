// 予測モジュール（未来視寄り）：流月・パーソナルイヤー・名前のある節目・合致点＆確度・運気スコア
import {
  STEMS, BRANCHES, tenGod, isClash, monthPillarForDate,
} from './fourpillars.js';

function reduceNum(n) {
  while (n > 9) n = String(n).split('').reduce((a, d) => a + +d, 0);
  return n;
}
const PY_THEME = {
  1: '種まき・新しい始まり', 2: '育成・協力・下積み', 3: '発信・楽しみ・人脈',
  4: '基盤づくり・地道な努力', 5: '変化・自由・挑戦', 6: '責任・家庭・愛',
  7: '内省・学び・休養', 8: '収穫・成果・現実化', 9: '完結・手放し・次への準備',
};
function personalYear(birthMonth, birthDay, year) {
  const n = reduceNum(birthMonth + birthDay + reduceNum(String(year).split('').reduce((a, d) => a + +d, 0)));
  return { number: n, theme: PY_THEME[n] };
}

const GODVAL = { 偏財: 2, 正財: 2, 偏印: 1, 正印: 1, 食神: 1, 傷官: 0, 正官: 1, 偏官: -1, 比肩: 0, 劫財: -1 };
function godTheme(g) {
  if (['偏官', '正官'].includes(g)) return '責任・重圧・立場の変化';
  if (['偏財', '正財'].includes(g)) return '収入・成果・現実化';
  if (['偏印', '正印'].includes(g)) return '学び・支え・安定';
  if (['比肩', '劫財'].includes(g)) return '競争・出費・自立';
  return '表現・発信・人との交流';
}
// 干の冲（7つ離れ＝相剋の冲）。戊己は除く
function stemClash(a, b) {
  if ([4, 5].includes(a) || [4, 5].includes(b)) return false;
  return (a + 6) % 10 === b || (b + 6) % 10 === a;
}

/**
 * @param {object} o { fp, chart, birthYear, birthMonth, birthDay, gender, nowYear, nowMonth }
 */
export function computeForesight(o) {
  const { fp, chart } = o;
  const dStem = fp.dayStemIdx, dBranch = fp.dayBranchIdx;
  const nowYear = o.nowYear, nowMonth = o.nowMonth;

  // --- 流月（今後12ヶ月） ---
  const months = [];
  for (let i = 0; i < 12; i++) {
    const dt = new Date(nowYear, nowMonth - 1 + i, 15);
    const y = dt.getFullYear(), m = dt.getMonth() + 1;
    const mp = monthPillarForDate(y, m, 15);
    const g = tenGod(dStem, mp.stem);
    months.push({
      ym: `${y}年${m}月`,
      kanshi: STEMS[mp.stem] + BRANCHES[mp.branch],
      tenGod: g,
      theme: godTheme(g),
      clash: isClash(mp.branch, dBranch),
    });
  }

  // --- パーソナルイヤー（今後6年） ---
  const pys = [];
  for (let i = 0; i < 6; i++) {
    const y = nowYear + i;
    pys.push({ year: y, ...personalYear(o.birthMonth, o.birthDay, y) });
  }

  // --- 名前のある節目 ---
  const milestones = [];
  for (const age of [29, 58]) { // サターンリターン（約29.5年周期）
    const y = o.birthYear + age;
    if (y >= nowYear - 1 && y <= nowYear + 20) milestones.push({ year: y, age, name: 'サターンリターン', note: '人生の構造を見直す大きな節目（責任・自立・基盤の再構築）' });
  }
  // 天戦地冲（流年の干支が日柱と干冲＋支冲）＝特に大きな転機
  for (let i = 0; i < 10; i++) {
    const y = nowYear + i;
    const ys = ((y - 4) % 10 + 10) % 10, yb = ((y - 4) % 12 + 12) % 12;
    if (stemClash(ys, dStem) && isClash(yb, dBranch)) {
      milestones.push({ year: y, age: y - o.birthYear, name: '天戦地冲', note: '環境が大きく動きやすい節目。無理な拡大より足場固めを' });
    }
  }
  milestones.sort((a, b) => a.year - b.year);

  // --- 合致点＆確度（今後8年） ---
  const signals = {};
  const push = (year, src, label) => {
    if (year < nowYear || year > nowYear + 7) return;
    (signals[year] = signals[year] || []).push({ src, label });
  };
  // 流年
  for (const y of fp.liuNian || []) if (y.note) push(y.year, '四柱(流年)', y.note);
  // 大運の切替・転機 → 年に変換
  if (fp.daYun) {
    for (const p of fp.daYun.pillars) {
      if (p.note) {
        const y = Math.round(o.birthYear + p.ageStart);
        push(y, '四柱(大運)', p.note);
      }
    }
  }
  // トランジット
  for (const h of chart?.transits || []) {
    const y = parseInt(h.ym);
    push(y, '占星術', `${h.transit}が${h.natal}に${h.aspect}`);
  }
  // パーソナルイヤー（節目の数）
  for (const p of pys) {
    if (p.number === 1) push(p.year, '数秘(PY)', '新サイクルの始まり');
    if (p.number === 9) push(p.year, '数秘(PY)', '区切り・完結の年');
    if (p.number === 8) push(p.year, '数秘(PY)', '収穫・成果の年');
  }
  // 節目
  for (const ms of milestones) push(ms.year, '節目', ms.name);

  const convergence = [];
  for (let i = 0; i <= 7; i++) {
    const y = nowYear + i;
    const sig = signals[y] || [];
    const srcs = [...new Set(sig.map((s) => s.src.replace(/\(.*/, '')))];
    const level = srcs.length >= 3 ? '高' : srcs.length === 2 ? '中' : srcs.length === 1 ? '低' : '-';
    convergence.push({ year: y, age: y - o.birthYear, count: sig.length, srcCount: srcs.length, level, signals: sig });
  }

  // --- 年別 運気スコア（今後6年の折れ線/ヒートマップ用） ---
  const trend = [];
  for (let i = 0; i < 6; i++) {
    const y = nowYear + i;
    let s = 0;
    const ln = (fp.liuNian || []).find((x) => x.year === y);
    if (ln) s += GODVAL[ln.tenGod] ?? 0;
    for (const h of chart?.transits || []) {
      if (parseInt(h.ym) === y) s += h.transit === '木星' ? 1 : ['土星', '冥王星'].includes(h.transit) ? -1 : 0;
    }
    trend.push({ year: y, score: Math.max(-3, Math.min(3, s)) });
  }

  return { months, personalYears: pys, milestones, convergence, trend };
}

export function summarizeForesight(f) {
  const lines = [];
  lines.push('【流月＝今後12ヶ月の運気（月単位）】');
  for (const m of f.months) lines.push(`・${m.ym}: ${m.kanshi}（${m.tenGod}／${m.theme}）${m.clash ? ' ← 変化が起きやすい月' : ''}`);
  lines.push('\n【パーソナルイヤー（数秘の年テーマ）】');
  for (const p of f.personalYears) lines.push(`・${p.year}年: ${p.number}「${p.theme}」`);
  if (f.milestones.length) {
    lines.push('\n【名前のある節目】');
    for (const ms of f.milestones) lines.push(`・${ms.year}年(${ms.age}歳): ${ms.name} … ${ms.note}`);
  }
  lines.push('\n【合致点＝複数の占術が同じ時期を指す年と確度】');
  for (const c of f.convergence) {
    if (c.srcCount === 0) continue;
    lines.push(`・${c.year}年(${c.age}歳) 確度${c.level}（${c.srcCount}系統が示唆）: ${c.signals.map((s) => `${s.src}=${s.label}`).join(' / ')}`);
  }
  return lines.join('\n');
}
