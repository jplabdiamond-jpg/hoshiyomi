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

// 構造化された生活要因（選択式）→ 分野別deltas。詳細プランで使用。
// value は divinations.js の select の value と一致させる。
export const STRUCTURED = {
  drinking: {
    label: '飲酒',
    daily: { deltas: { 健康: -2, 金銭: -1 }, reason: '毎日の飲酒は肝臓・生活習慣病や出費の面で負担が大きい' },
    weekly: { deltas: { 健康: -1 }, reason: '週数回の飲酒は量しだいで健康面に影響' },
    rare: { deltas: {}, reason: '' },
    none: { deltas: { 健康: 1 }, reason: '飲酒習慣がなく健康面で有利' },
  },
  smoking: {
    label: '喫煙',
    daily: { deltas: { 健康: -2, 身体安全: 0 }, reason: '毎日の喫煙は呼吸器・循環器リスクを高める' },
    sometimes: { deltas: { 健康: -1 }, reason: '時々の喫煙も健康面でマイナス' },
    none: { deltas: {}, reason: '' },
  },
  sleep: {
    label: '睡眠時間',
    under6: { deltas: { 健康: -1, メンタル: -1 }, reason: '睡眠6時間未満は体調と気分の乱れにつながりやすい' },
    '6to7': { deltas: {}, reason: '' },
    '7to8': { deltas: { 健康: 1 }, reason: '7〜8時間の睡眠は回復に理想的で健康面に有利' },
    over8: { deltas: {}, reason: '' },
  },
  exercise: {
    label: '運動習慣',
    none: { deltas: { 健康: -1 }, reason: '運動不足は体力・代謝の低下につながりやすい' },
    light: { deltas: {}, reason: '' },
    regular: { deltas: { 健康: 1, メンタル: 1 }, reason: '週3回以上の運動は心身の健康に有利' },
  },
  commute: {
    label: '通勤手段',
    car: { deltas: { 身体安全: -1 }, reason: '車通勤は事故に遭う機会がやや増える' },
    bike: { deltas: { 身体安全: -1 }, reason: 'バイク・自転車通勤は転倒・事故に注意' },
    train: { deltas: {}, reason: '' },
    remote: { deltas: { 身体安全: 1 }, reason: '在宅中心で移動由来のリスクが低い' },
  },
  worktime: {
    label: '労働時間',
    normal: { deltas: {}, reason: '' },
    long: { deltas: { メンタル: -1 }, reason: 'やや長めの労働時間で疲労がたまりやすい' },
    verylong: { deltas: { メンタル: -1, 健康: -1 }, reason: '長時間労働は心身の消耗リスクが高い' },
  },
  diet: {
    label: '食生活',
    irregular: { deltas: { 健康: -1 }, reason: '外食・不規則な食事は栄養の偏りに注意' },
    normal: { deltas: {}, reason: '' },
    healthy: { deltas: { 健康: 1 }, reason: '自炊・規則的な食事は健康面に有利' },
  },
  stress: {
    label: 'ストレス感',
    low: { deltas: {}, reason: '' },
    mid: { deltas: { メンタル: -1 }, reason: '中程度のストレスが続くと消耗につながりやすい' },
    high: { deltas: { メンタル: -2 }, reason: '高いストレス状態はメンタルの最優先ケア対象' },
  },
};

/**
 * 職業テキスト＋構造化生活要因から分野別リスクスコアを算出。
 * @param {object} answers 全回答（job, theme, lifestyle, drinking, smoking, sleep, …）
 */
export function assessRisk(answers) {
  const a = answers || {};
  const scores = Object.fromEntries(DOMAINS.map((d) => [d, 0]));
  const fired = [];
  let hasInput = false;

  // 1) 職業などテキストからのキーワードルール
  const text = [a.job, a.theme, a.lifestyle].filter(Boolean).join(' ');
  if (text.trim()) {
    hasInput = true;
    for (const rule of RULES) {
      if (rule.keywords.some((k) => text.includes(k))) {
        for (const [dom, v] of Object.entries(rule.deltas)) scores[dom] += v;
        fired.push({ id: rule.id, reason: rule.reason, deltas: rule.deltas });
      }
    }
  }

  // 2) 構造化された生活要因（詳細プラン）
  for (const [field, table] of Object.entries(STRUCTURED)) {
    const v = a[field];
    if (v && table[v]) {
      hasInput = true;
      const entry = table[v];
      if (Object.keys(entry.deltas).length) {
        for (const [dom, dv] of Object.entries(entry.deltas)) scores[dom] += dv;
        fired.push({ id: `${field}:${v}`, reason: entry.reason, deltas: entry.deltas });
      }
    }
  }

  return { scores, fired, hasInput };
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
