// 予測モジュール（未来視寄り）
// ① 時期は「日付レンジ＋山場」まで解像度を上げる（トランジットのオーブ窓を利用）
// ② 複数の占術が同じ時期に重なる「合致窓」を月解像度で抽出し、重なり本数＋実測較正で確度を決める
// ③ 各シグナルを生活領域（キャリア・金銭・対人・健康・メンタル・身体安全）に固有化し、本人の偏差に重ねる
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

// ── ③ 分野固有化：各シグナルを生活領域＋プラス/マイナスの傾きへ ──
// 十神 → 主な生活領域（domain）と傾き（pol: +有利 / -要注意 / 0中立）
function godDomains(g) {
  if (['偏官', '正官'].includes(g)) return [{ domain: 'キャリア', pol: 1, why: '責任・立場が上がる局面' }, { domain: 'メンタル', pol: -1, why: '重圧がかかりやすい' }];
  if (['偏財', '正財'].includes(g)) return [{ domain: '金銭', pol: 1, why: '成果が収入・現実に結びつきやすい' }];
  if (['偏印', '正印'].includes(g)) return [{ domain: 'メンタル', pol: 1, why: '学びと支えが得やすく安定しやすい' }];
  if (['比肩', '劫財'].includes(g)) return [{ domain: '金銭', pol: -1, why: '競争・出費がかさみやすい' }, { domain: '対人', pol: 0, why: '張り合い・自立のテーマ' }];
  return [{ domain: '対人', pol: 1, why: '表現・発信・人との縁が活きる' }]; // 食神・傷官
}
// トランジット（運行天体×ネイタル点×アスペクト）→ 生活領域と傾き
const HARD = ['合', 'スクエア', 'オポジション'];
function transitDomains(natal, body, aspect) {
  const dom = natal === '月' ? 'メンタル' : natal === 'アセンダント' ? '対人' : 'キャリア'; // 太陽/MC=キャリア
  let pol = 0, why = '';
  if (body === '木星') { pol = 1; why = '追い風・広がりの時期'; }
  else if (body === '土星') { pol = HARD.includes(aspect) ? -1 : 1; why = HARD.includes(aspect) ? '踏ん張りどき・基盤を固める時期' : '努力が形になりやすい時期'; }
  else if (body === '天王星') { pol = 0; why = '予想外の変化・解放が起きやすい'; }
  else if (body === '海王星') { pol = 0; why = '理想とゆらぎ・手放しのテーマ'; }
  else if (body === '冥王星') { pol = HARD.includes(aspect) ? -1 : 0; why = '根本から作り変わる深い変容'; }
  return [{ domain: dom, pol, why }];
}

// ── ① 日付レンジのラベル化 ──
function decade(day) { return day <= 10 ? '上旬' : day <= 20 ? '中旬' : '下旬'; }
function rangeLabel(startISO, endISO, peakISO) {
  const s = startISO ? new Date(startISO) : null;
  const e = endISO ? new Date(endISO) : null;
  const p = peakISO ? new Date(peakISO) : null;
  let label = '', peakLabel = '';
  if (s && e) {
    const sy = s.getFullYear(), sm = s.getMonth() + 1, sd = s.getDate();
    const ey = e.getFullYear(), em = e.getMonth() + 1, ed = e.getDate();
    if (sy === ey && sm === em) {
      label = decade(sd) === decade(ed) ? `${sy}年${sm}月${decade(sd)}` : `${sy}年${sm}月${decade(sd)}〜${decade(ed)}`;
    } else if (sy === ey) {
      label = `${sy}年${sm}月${decade(sd)}〜${em}月${decade(ed)}`;
    } else {
      label = `${sy}年${sm}月〜${ey}年${em}月`;
    }
  }
  if (p) peakLabel = `${p.getFullYear()}年${p.getMonth() + 1}月${decade(p.getDate())}が山場`;
  return { label, peakLabel };
}

// ── ② 確度（合致本数＋実測較正） ──
function confidence(systems, { transitTight = 0, calibWeights = {} } = {}) {
  const n = systems.length;
  const base = n >= 4 ? 92 : n === 3 ? 80 : n === 2 ? 60 : 35;
  // 較正：寄与した占術の実測的中率から得た重み（平均）。データが無ければ1.0（＝ヒューリスティックのまま）
  let w = 0, cnt = 0;
  for (const s of systems) { const v = calibWeights[s]; if (typeof v === 'number') { w += v; cnt++; } }
  const calib = cnt ? w / cnt : 1;
  const c = Math.round(Math.max(5, Math.min(99, (base + transitTight) * calib)));
  return c;
}
const levelOf = (c) => (c >= 75 ? '高' : c >= 55 ? '中' : '低');

function mergeDomains(list) {
  const map = new Map();
  for (const d of list) {
    const cur = map.get(d.domain) || { domain: d.domain, pol: 0, whys: [] };
    cur.pol += d.pol;
    if (d.why && !cur.whys.includes(d.why)) cur.whys.push(d.why);
    map.set(d.domain, cur);
  }
  return [...map.values()].map((d) => ({ domain: d.domain, pol: Math.max(-1, Math.min(1, d.pol)), why: d.whys.join('・') }));
}

/**
 * @param {object} o { fp, chart, birthYear, birthMonth, birthDay, gender, nowYear, nowMonth,
 *                      profileNet?(分野→偏差), calibWeights?(占術→実測重み) }
 */
export function computeForesight(o) {
  const { fp, chart } = o;
  const dStem = fp.dayStemIdx, dBranch = fp.dayBranchIdx;
  const nowYear = o.nowYear, nowMonth = o.nowMonth;
  const profileNet = o.profileNet || {};
  const calibWeights = o.calibWeights || {};

  // --- 流月（UI表示用=12ヶ月、合致判定用=24ヶ月） ---
  const monthsAll = [];
  for (let i = 0; i < 24; i++) {
    const dt = new Date(nowYear, nowMonth - 1 + i, 15);
    const y = dt.getFullYear(), m = dt.getMonth() + 1;
    const mp = monthPillarForDate(y, m, 15);
    const g = tenGod(dStem, mp.stem);
    monthsAll.push({
      key: `${y}-${String(m).padStart(2, '0')}`, year: y, month: m,
      ym: `${y}年${m}月`, kanshi: STEMS[mp.stem] + BRANCHES[mp.branch],
      tenGod: g, theme: godTheme(g), clash: isClash(mp.branch, dBranch),
    });
  }
  const months = monthsAll.slice(0, 12);

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
  for (let i = 0; i < 10; i++) {
    const y = nowYear + i;
    const ys = ((y - 4) % 10 + 10) % 10, yb = ((y - 4) % 12 + 12) % 12;
    if (stemClash(ys, dStem) && isClash(yb, dBranch)) {
      milestones.push({ year: y, age: y - o.birthYear, name: '天戦地冲', note: '環境が大きく動きやすい節目。無理な拡大より足場固めを' });
    }
  }
  milestones.sort((a, b) => a.year - b.year);

  // --- 年ごとのシグナル（年解像度。合致点＆年単位の確度に使う） ---
  const SYS = { fp: '四柱推命', astro: '占星術', num: '数秘術', node: '節目' };
  const yearSignals = {}; // year -> [{sys,label,domains}]
  const pushYear = (year, sys, label, domains) => {
    if (year < nowYear || year > nowYear + 7) return;
    (yearSignals[year] = yearSignals[year] || []).push({ sys, label, domains: domains || [] });
  };
  for (const y of fp.liuNian || []) if (y.note) pushYear(y.year, SYS.fp, `流年:${y.note}`, godDomains(y.tenGod));
  if (fp.daYun) {
    for (const p of fp.daYun.pillars) {
      if (p.note) { const y = Math.round(o.birthYear + p.ageStart); pushYear(y, SYS.fp, `大運の切替:${p.note}`, godDomains(p.tenGod)); }
    }
  }
  for (const h of chart?.transits || []) {
    const y = parseInt(h.ym);
    pushYear(y, SYS.astro, `${h.transit}が${h.natal}に${h.aspect}`, transitDomains(h.natal, h.transit, h.aspect));
  }
  for (const p of pys) {
    if (p.number === 1) pushYear(p.year, SYS.num, '新サイクルの始まり', [{ domain: 'キャリア', pol: 0, why: '仕切り直し・種まき' }]);
    if (p.number === 9) pushYear(p.year, SYS.num, '区切り・完結の年', [{ domain: 'メンタル', pol: 0, why: '手放しと整理' }]);
    if (p.number === 8) pushYear(p.year, SYS.num, '収穫・成果の年', [{ domain: '金銭', pol: 1, why: '努力が実りやすい' }]);
  }
  for (const ms of milestones) pushYear(ms.year, SYS.node, ms.name, ms.name === 'サターンリターン'
    ? [{ domain: 'キャリア', pol: 0, why: '基盤の再構築' }, { domain: 'メンタル', pol: -1, why: '重さを感じやすい節目' }]
    : [{ domain: 'キャリア', pol: 0, why: '環境が動く節目' }]);

  // 年解像度の合致点（従来互換：ヒートマップ／年タイムライン用）
  const convergence = [];
  for (let i = 0; i <= 7; i++) {
    const y = nowYear + i;
    const sig = yearSignals[y] || [];
    const srcs = [...new Set(sig.map((s) => s.sys))];
    const conf = sig.length ? confidence(srcs, { calibWeights }) : 0;
    convergence.push({ year: y, age: y - o.birthYear, count: sig.length, srcCount: srcs.length, conf, level: srcs.length ? levelOf(conf) : '-', signals: sig.map((s) => ({ src: s.sys, label: s.label })) });
  }

  // --- ② 月解像度の合致窓（今後24ヶ月） ---
  // 種：トランジットのピーク月 / 流月の冲月。各窓は「その月のシグナル ∪ その年の年シグナル」で確度を決める。
  const monthWindows = {};
  const ensure = (key, year, month) => (monthWindows[key] = monthWindows[key] || { key, year, month, signals: [], transit: null });
  const inHorizon = (y, m) => { const idx = (y - nowYear) * 12 + (m - nowMonth); return idx >= 0 && idx < 24; };

  for (const h of chart?.transits || []) {
    const pk = h.peak ? new Date(h.peak) : null;
    if (!pk) continue;
    const y = pk.getFullYear(), m = pk.getMonth() + 1;
    if (!inHorizon(y, m)) continue;
    const key = `${y}-${String(m).padStart(2, '0')}`;
    const w = ensure(key, y, m);
    w.signals.push({ sys: SYS.astro, label: `運行する${h.transit}が${h.natal}に${h.aspect}（${h.theme}）`, domains: transitDomains(h.natal, h.transit, h.aspect) });
    const r = rangeLabel(h.start, h.end, h.peak);
    w.transit = { ...r, theme: h.theme, body: h.transit };
  }
  for (const mm of monthsAll) {
    if (!(mm.clash || ['偏官', '正官'].includes(mm.tenGod))) continue;
    const key = mm.key;
    const w = ensure(key, mm.year, mm.month);
    w.signals.push({ sys: SYS.fp, label: `流月 ${mm.kanshi}：${mm.theme}${mm.clash ? '／変化が起きやすい月' : ''}`, domains: godDomains(mm.tenGod) });
  }

  const windows = [];
  for (const key of Object.keys(monthWindows)) {
    const w = monthWindows[key];
    const yearSys = (yearSignals[w.year] || []);
    // この窓に効く占術＝月シグナル ∪ その年の年シグナル
    const allSig = [...w.signals, ...yearSys];
    const systems = [...new Set(allSig.map((s) => s.sys))];
    const transitTight = w.transit ? 6 : 0;
    const conf = confidence(systems, { transitTight, calibWeights });
    const domains = mergeDomains(allSig.flatMap((s) => s.domains || []))
      .map((d) => ({ ...d, net: profileNet[d.domain] ?? 0 }));
    // 時期ラベル：トランジット窓があればレンジ、なければ月単位
    const label = w.transit && w.transit.label ? w.transit.label : `${w.year}年${w.month}月ごろ`;
    const peakLabel = w.transit ? w.transit.peakLabel : '';
    // 詳細はその月のシグナルを出し、同年の年シグナルは1行の文脈にまとめる（重複ノイズを防ぐ）
    const detail = w.signals.map((s) => ({ src: s.sys, label: s.label }));
    const yearCtxLabels = [...new Set(yearSys.map((s) => s.label))].slice(0, 3);
    if (yearCtxLabels.length) detail.push({ src: `${w.year}年の流れ`, label: yearCtxLabels.join('／') });
    windows.push({
      key, year: w.year, month: w.month, resolution: w.transit ? 'range' : 'month',
      label, peakLabel, systems, conf, level: levelOf(conf), domains,
      signals: detail,
    });
  }
  // 確度→時期順に並べ、上位を採用
  windows.sort((a, b) => (b.conf - a.conf) || (a.year - b.year) || (a.month - b.month));
  const topWindows = windows.slice(0, 8).sort((a, b) => (a.year - b.year) || (a.month - b.month));

  // --- 年別 運気スコア（ヒートマップ用・今後6年） ---
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

  // ④ 用：この鑑定で確度に寄与した占術（高・中の窓／年合致）
  const systemsUsed = [...new Set([
    ...topWindows.filter((w) => w.level !== '低').flatMap((w) => w.systems),
    ...convergence.filter((c) => c.srcCount >= 2).flatMap((c) => [...new Set(c.signals.map((s) => s.src))]),
  ])];

  return { months, personalYears: pys, milestones, convergence, windows: topWindows, trend, systemsUsed };
}

const POLMARK = (p) => (p > 0 ? '追い風' : p < 0 ? '要注意' : '変化');
function domainPhrase(domains) {
  if (!domains || !domains.length) return '';
  return domains.map((d) => {
    const net = d.net || 0;
    const overlap = net < 0 && d.pol < 0 ? '（もともと注意の分野に重なる）' : net > 0 && d.pol > 0 ? '（もともと強い分野をさらに押し上げる）' : '';
    return `${d.domain}=${POLMARK(d.pol)}${overlap}`;
  }).join('、');
}

export function summarizeForesight(f) {
  const lines = [];

  lines.push('【最重要＝合致窓：複数の占術が同じ時期を指し示す「転機の窓」。確度順ではなく時期順。確度が高い窓ほど優先的に語ること】');
  if (!f.windows || !f.windows.length) {
    lines.push('・今後24ヶ月で複数系統が強く重なる窓は見当たりません（大きな転機より、日々の積み上げが効く時期）。');
  } else {
    for (const w of f.windows) {
      const sysPart = w.systems.join('＋');
      const peak = w.peakLabel ? `／${w.peakLabel}` : '';
      lines.push(`・${w.label}${peak}｜確度${w.level}(${w.conf})｜重なる占術: ${sysPart}（${w.systems.length}系統）｜領域: ${domainPhrase(w.domains)}`);
      for (const s of w.signals) lines.push(`    - ${s.src}: ${s.label}`);
    }
  }

  lines.push('\n【年単位の合致点（中長期の見通し・今後8年）】');
  for (const c of f.convergence) {
    if (c.srcCount === 0) continue;
    lines.push(`・${c.year}年(${c.age}歳) 確度${c.level}(${c.conf}) ${c.srcCount}系統: ${c.signals.map((s) => `${s.src}=${s.label}`).join(' / ')}`);
  }

  lines.push('\n【流月＝今後12ヶ月の運気（月単位）】');
  for (const m of f.months) lines.push(`・${m.ym}: ${m.kanshi}（${m.tenGod}／${m.theme}）${m.clash ? ' ← 変化が起きやすい月' : ''}`);

  lines.push('\n【パーソナルイヤー（数秘の年テーマ）】');
  for (const p of f.personalYears) lines.push(`・${p.year}年: ${p.number}「${p.theme}」`);

  if (f.milestones.length) {
    lines.push('\n【名前のある節目】');
    for (const ms of f.milestones) lines.push(`・${ms.year}年(${ms.age}歳): ${ms.name} … ${ms.note}`);
  }
  return lines.join('\n');
}
