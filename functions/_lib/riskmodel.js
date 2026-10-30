// 統計リスク層（ヒューリスティック・編集可能）
// 職業・生活要因から、分野ごとのリスク傾向をスコア化する。
// ※各deltaは「実測の確率」ではなく、一般的な傾向にもとづく目安の重み。
//   数値はマイナス＝注意が増える方向、プラス＝有利/保護的な方向。
// ※出典つきの実データで差し替えたい場合は、各ルールに source を追加して値を更新する。

export const DOMAINS = ['身体安全', '健康', '金銭', '対人', 'メンタル', 'キャリア'];

// ルール：text（職業＋テーマ＋生活メモ）に keyword が含まれたら deltas を適用
export const RULES = [
  {
    id: 'driving',
    keywords: ['ドライバー', '配送', '運送', 'トラック', 'タクシー', '運転手', '配達', '長距離'],
    deltas: { 身体安全: -2, 金銭: -1 },
    reason: '運転時間が長いほど交通事故に遭う確率が上がり、事故時は身体・金銭の負担も大きくなりやすい',
  },
  {
    id: 'sales_field',
    keywords: ['営業', '外回り', 'セールス'],
    deltas: { 身体安全: -1, メンタル: -1, キャリア: 1 },
    reason: '移動が多く対人ストレスも高い一方、成果が評価に直結しキャリアの伸びしろは大きい',
  },
  {
    id: 'desk_work',
    keywords: ['エンジニア', 'プログラマ', '事務', 'デスク', 'IT', 'デザイナー', '経理', 'プログラマー'],
    deltas: { 健康: -1 },
    reason: '座っている時間が長く、運動不足・肩腰の不調が出やすい',
  },
  {
    id: 'care_medical',
    keywords: ['看護', '介護', '医療', '保育', '福祉', 'ケア'],
    deltas: { メンタル: -1, 身体安全: -1, 対人: 1 },
    reason: '心身の負荷が高い対人援助職。やりがいと感謝が得やすい反面、消耗に注意',
  },
  {
    id: 'self_employed',
    keywords: ['自営', 'フリーランス', '個人事業', '経営', 'オーナー', '起業'],
    deltas: { 金銭: -1, キャリア: 1 },
    reason: '収入が変動しやすい一方、裁量と上振れの可能性が大きい',
  },
  {
    id: 'shift_night',
    keywords: ['夜勤', 'シフト', '交代', '深夜'],
    deltas: { 健康: -1, メンタル: -1 },
    reason: '生活リズムが乱れやすく、睡眠と自律神経のケアが重要',
  },
  {
    id: 'construction',
    keywords: ['建設', '工事', '現場', '土木', '製造', '工場', '職人'],
    deltas: { 身体安全: -2 },
    reason: '身体を使う現場作業は怪我のリスクがあり、安全対策の徹底が効く',
  },
  {
    id: 'high_stress',
    keywords: ['管理職', 'マネージャー', '責任者', '店長', 'リーダー'],
    deltas: { メンタル: -1, キャリア: 1 },
    reason: '責任とプレッシャーが大きい分、評価と成長の機会も大きい',
  },
];

/**
 * 文脈テキストから分野別リスクスコアを算出。
 * @param {object} ctx { job, theme, lifestyle }
 */
export function assessRisk(ctx) {
  const text = [ctx.job, ctx.theme, ctx.lifestyle].filter(Boolean).join(' ');
  const scores = Object.fromEntries(DOMAINS.map((d) => [d, 0]));
  const fired = [];
  if (!text.trim()) return { scores, fired, hasInput: false };

  for (const rule of RULES) {
    if (rule.keywords.some((k) => text.includes(k))) {
      for (const [dom, v] of Object.entries(rule.deltas)) scores[dom] += v;
      fired.push({ id: rule.id, reason: rule.reason, deltas: rule.deltas });
    }
  }
  return { scores, fired, hasInput: true };
}

export function summarizeRisk(r) {
  if (!r.hasInput || !r.fired.length) {
    return '統計リスク傾向: 判定に使える職業・生活情報が少ないため、一般的な範囲で評価します。';
  }
  const lines = ['【統計リスク傾向（ヒューリスティックな目安。実測確率ではない）】'];
  lines.push('分野別スコア（マイナス＝注意、プラス＝有利）:');
  lines.push(
    DOMAINS.map((d) => `${d}${r.scores[d] > 0 ? '+' : ''}${r.scores[d]}`).join(' / ')
  );
  lines.push('根拠:');
  for (const f of r.fired) lines.push(`・${f.reason}`);
  return lines.join('\n');
}
