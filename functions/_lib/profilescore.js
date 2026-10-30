// プロファイル・スコア（偏差モデル）
// 平均(=0)を基準に、①統計層（生活・職業）のズレ ②占い結果のズレ を足し、
// 分野ごとの「その人の偏差」を算出する。
// ※すべてヒューリスティックな目安。将来、分野ごとに実データの平均値を入れれば本物の偏差に差し替え可能。
import { DOMAINS } from './riskmodel.js';

function blank() {
  return Object.fromEntries(DOMAINS.map((d) => [d, 0]));
}

// 占い結果 → 分野別の補正値（占いによる平均からのズレ）
function occultDeltas({ fp, chart, seimei, numerology, nowYear, birthYear }) {
  const d = blank();
  const reasons = [];
  const add = (dom, v, why) => { d[dom] += v; reasons.push({ dom, v, why }); };

  // --- 四柱推命 ---
  if (fp) {
    const strong = fp.dayMasterStrength && fp.dayMasterStrength.label.includes('身強');
    if (strong) { add('キャリア', 1, '身強＝推進力・自走力が高い'); add('メンタル', 1, '身強＝打たれ強い'); }
    else { add('メンタル', -1, '身弱＝無理が利きにくく休養が鍵'); add('対人', 1, '身弱＝協力を得て伸びやすい'); }

    // 現在の大運の十神
    if (fp.daYun) {
      const age = (nowYear || new Date().getFullYear()) - birthYear;
      const cur = fp.daYun.pillars.find((p) => age >= p.ageStart && age < p.ageEnd) || fp.daYun.pillars[0];
      if (cur) {
        const g = cur.tenGod;
        if (['偏官', '正官'].includes(g)) { add('メンタル', -1, `現在の大運(${g})＝責任・重圧が増す局面`); add('キャリア', 1, '同＝立場と成長の機会'); }
        else if (['偏財', '正財'].includes(g)) add('金銭', 1, `現在の大運(${g})＝成果・収入の伸びやすい局面`);
        else if (['偏印', '正印'].includes(g)) add('メンタル', 1, `現在の大運(${g})＝学び・支えが得やすく安定`);
        else if (['比肩', '劫財'].includes(g)) add('金銭', -1, `現在の大運(${g})＝競争・出費がかさみやすい`);
        else if (['食神', '傷官'].includes(g)) add('対人', 1, `現在の大運(${g})＝表現・発信が活きる`);
      }
    }
    // 五行の極端
    if (fp.elementBalance) {
      if (fp.elementBalance.水 === 0) add('健康', -1, '命式に水が少なく、潤い・休息の管理が課題になりやすい');
      if (fp.elementBalance.火 >= 3) add('身体安全', -1, '火が強く勢い・急ぎが出やすいため落ち着きが鍵');
    }
  }

  // --- 西洋占星術 ---
  if (chart) {
    // 風(コミュニケーション)が0
    const air = chart.planets.filter((p) => p.element === '風').length;
    if (air === 0) add('対人', -1, '星の配置で風（言語化・社交）の要素が手薄');
    // 直近12ヶ月の重いトランジット
    if (chart.transits) {
      const soon = chart.transits.find((h) =>
        ['土星', '冥王星'].includes(h.transit) &&
        ['合', 'スクエア', 'オポジション'].includes(h.aspect) &&
        ['太陽', '月'].includes(h.natal));
      if (soon) add('メンタル', -1, `${soon.ym}ごろ${soon.transit}の重い運行があり心身に負荷がかかりやすい`);
    }
  }

  // --- 姓名判断 ---
  if (seimei && !seimei.error) {
    if (seimei.kaku.外格.luck.includes('凶')) add('対人', -1, '姓名の外格が弱めで対人運に注意');
    if (seimei.kaku.総格.luck === '大吉') add('キャリア', 1, '姓名の総格が大吉で後半の総合運が強い');
    if (seimei.kaku.人格.luck.includes('凶')) add('メンタル', -1, '姓名の人格が弱めで内面の揺れに注意');
  }

  // --- 数秘術 ---
  if (numerology) {
    const lp = numerology.lifePath.number;
    if ([4, 8, 22].includes(lp)) add('金銭', 1, `ライフパス${lp}＝現実化・経済の才`);
    if ([2, 6, 9, 33].includes(lp)) add('対人', 1, `ライフパス${lp}＝人を支え結ぶ力`);
  }

  return { deltas: d, reasons };
}

/**
 * 分野別の偏差を統合。
 * @param {object} args { risk(統計層の結果), fp, chart, seimei, numerology, nowYear, birthYear }
 */
export function computeProfileScore(args) {
  const statistical = args.risk && args.risk.hasInput ? args.risk.scores : blank();
  const { deltas: occult, reasons } = occultDeltas(args);
  const net = blank();
  for (const dom of DOMAINS) net[dom] = statistical[dom] + occult[dom];

  // 偏差の大きい順に注目分野を抽出
  const ranked = DOMAINS.slice().sort((a, b) => Math.abs(net[b]) - Math.abs(net[a]));
  return {
    baseline: 0,
    statistical,
    occult,
    net,
    occultReasons: reasons,
    focus: ranked.filter((d) => net[d] !== 0),
  };
}

export function summarizeProfileScore(ps) {
  const lines = ['【分野別の偏差（平均=0。マイナス＝平均より注意、プラス＝平均より有利）】'];
  for (const dom of DOMAINS) {
    const s = ps.statistical[dom], o = ps.occult[dom], n = ps.net[dom];
    lines.push(`${dom}: 合計${n > 0 ? '+' : ''}${n}（統計${s > 0 ? '+' : ''}${s} / 占い${o > 0 ? '+' : ''}${o}）`);
  }
  if (ps.occultReasons.length) {
    lines.push('占いによるズレの根拠:');
    for (const r of ps.occultReasons) lines.push(`・${r.dom}${r.v > 0 ? '+' : ''}${r.v}: ${r.why}`);
  }
  lines.push('※偏差はヒューリスティックな目安であり、実測の確率・平均ではありません。');
  return lines.join('\n');
}
