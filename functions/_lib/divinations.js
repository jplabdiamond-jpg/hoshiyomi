// 占いのレジストリ：各占いに必要な入力項目を定義する。
// フロント・バックエンド共通の「必要事項確認」仕様の単一ソース。

export const DIVINATIONS = [
  {
    key: 'astrology',
    ja: '西洋占星術',
    icon: '♓',
    tagline: '生まれた瞬間の星の配置から性質と運勢を読む',
    fields: [
      { key: 'birthDate', label: '生年月日', type: 'date', required: true, help: '例）1990/5/15' },
      {
        key: 'birthTime',
        label: '出生時刻',
        type: 'time',
        required: false,
        help: '例）10:30（不明なら「不明」でもOK。※アセンダント等の精度に影響します）',
      },
      {
        key: 'birthPlace',
        label: '出生地',
        type: 'place',
        required: false,
        help: '例）東京都（市区町村でも可。時刻が分かる場合のみ使用）',
      },
    ],
  },
  {
    key: 'fourpillars',
    ja: '四柱推命',
    icon: '🀄',
    tagline: '生年月日時の干支（命式）と大運・流年から宿命と運気の時期を読む',
    fields: [
      { key: 'birthDate', label: '生年月日', type: 'date', required: true, help: '例）1990/5/15' },
      {
        key: 'birthTime',
        label: '出生時刻',
        type: 'time',
        required: false,
        help: '例）10:30（不明なら時柱を省略します）',
      },
      {
        key: 'gender',
        label: '性別',
        type: 'select',
        required: true,
        help: '大運（10年ごとの運気の流れ）の算出に使います',
        options: [
          { value: 'male', label: '男性' },
          { value: 'female', label: '女性' },
        ],
      },
    ],
  },
  {
    key: 'tarot',
    ja: 'タロット',
    icon: '🃏',
    tagline: '今の問いに対してカードが示す示唆を読む',
    fields: [
      {
        key: 'spread',
        label: 'スプレッド',
        type: 'select',
        required: true,
        options: [
          { value: 'one', label: 'ワンオラクル（1枚）' },
          { value: 'three', label: 'スリーカード（過去・現在・未来）' },
          { value: 'celtic', label: 'ケルト十字（10枚・本格）' },
        ],
      },
      {
        key: 'question',
        label: '相談内容',
        type: 'text',
        required: true,
        help: '例）転職すべきか迷っています',
      },
    ],
  },
  {
    key: 'seimei',
    ja: '姓名判断',
    icon: '㊟',
    tagline: '氏名の画数から五格と運勢を読む',
    fields: [
      { key: 'sei', label: '姓（漢字）', type: 'text', required: true, help: '例）鈴木' },
      { key: 'mei', label: '名（漢字）', type: 'text', required: true, help: '例）一郎' },
    ],
  },
  {
    key: 'numerology',
    ja: '数秘術',
    icon: '🔢',
    tagline: '生年月日からライフパスと本質を読む',
    fields: [
      { key: 'birthDate', label: '生年月日', type: 'date', required: true, help: '例）1990/5/15' },
    ],
  },
  {
    key: 'comprehensive_plus',
    ja: '総合鑑定',
    icon: '✺',
    price: 500,
    tagline: '占い×統計×風水を統合。日常情報から分野別のリスクと今後のアドバイスを出す',
    privacyNote: '入力項目が多い詳細プランです。生活情報・フルネーム・任意の職業/年収などは鑑定の精度向上のためだけに使い、サーバーには保存しません（計算後に破棄）。答えたくない項目はスキップできます。',
    fields: [
      { key: 'birthDate', label: '生年月日', type: 'date', required: true, help: '例）1990/5/15' },
      { key: 'birthTime', label: '出生時刻', type: 'time', required: false, help: '例）10:30（不明でもOK）' },
      { key: 'birthPlace', label: '出生地', type: 'place', required: false, help: '例）東京都（時刻が分かる場合のみ使用）' },
      {
        key: 'gender', label: '性別', type: 'select', required: true,
        options: [{ value: 'male', label: '男性' }, { value: 'female', label: '女性' }],
      },
      { key: 'sei', label: '姓（漢字）', type: 'text', required: false, help: '姓名判断に使用。任意' },
      { key: 'mei', label: '名（漢字）', type: 'text', required: false, help: '姓名判断に使用。任意' },
      { key: 'theme', label: '相談したいテーマ', type: 'text', required: true, help: '例）仕事／健康／お金／人間関係 など' },
      { key: 'job', label: '職業（任意）', type: 'text', required: false, sensitive: true, help: '統計リスク評価に使用。スキップ可' },
      { key: 'tenure', label: '勤続年数（任意）', type: 'text', required: false, sensitive: true, help: '例）5年。スキップ可' },
      { key: 'income', label: '年収（任意）', type: 'text', required: false, sensitive: true, help: '例）500万円。保存なし。スキップ可' },
      {
        key: 'drinking', label: '飲酒', type: 'select', required: false, sensitive: true,
        options: [
          { value: 'none', label: '飲まない' }, { value: 'rare', label: '月に数回' },
          { value: 'weekly', label: '週に数回' }, { value: 'daily', label: 'ほぼ毎日' },
        ],
      },
      {
        key: 'smoking', label: '喫煙', type: 'select', required: false, sensitive: true,
        options: [
          { value: 'none', label: '吸わない' }, { value: 'sometimes', label: '時々' }, { value: 'daily', label: '毎日' },
        ],
      },
      {
        key: 'sleep', label: '睡眠時間', type: 'select', required: false, sensitive: true,
        options: [
          { value: 'under6', label: '6時間未満' }, { value: '6to7', label: '6〜7時間' },
          { value: '7to8', label: '7〜8時間' }, { value: 'over8', label: '8時間以上' },
        ],
      },
      {
        key: 'exercise', label: '運動習慣', type: 'select', required: false, sensitive: true,
        options: [
          { value: 'none', label: 'ほとんどしない' }, { value: 'light', label: '週1〜2回' }, { value: 'regular', label: '週3回以上' },
        ],
      },
      {
        key: 'commute', label: '通勤手段', type: 'select', required: false, sensitive: true,
        options: [
          { value: 'car', label: '車' }, { value: 'bike', label: 'バイク・自転車' },
          { value: 'train', label: '電車・徒歩' }, { value: 'remote', label: '在宅中心' },
        ],
      },
      {
        key: 'worktime', label: '労働時間', type: 'select', required: false, sensitive: true,
        options: [
          { value: 'normal', label: '標準的' }, { value: 'long', label: 'やや長い' }, { value: 'verylong', label: 'かなり長い（残業多）' },
        ],
      },
      {
        key: 'diet', label: '食生活', type: 'select', required: false, sensitive: true,
        options: [
          { value: 'irregular', label: '外食・不規則' }, { value: 'normal', label: '普通' }, { value: 'healthy', label: '自炊・規則的' },
        ],
      },
      {
        key: 'stress', label: 'ストレス感', type: 'select', required: false, sensitive: true,
        options: [
          { value: 'low', label: '低い' }, { value: 'mid', label: '中くらい' }, { value: 'high', label: '高い' },
        ],
      },
    ],
  },
];

export function getDivination(key) {
  return DIVINATIONS.find((d) => d.key === key) || null;
}

// 日本の主要都市・都道府県庁所在地の緯度経度（出生地→座標）
// 占星術のアセンダント計算に使用。網羅でなくても県庁所在地レベルで十分な精度。
export const CITIES = {
  札幌: [43.0618, 141.3545], 青森: [40.8244, 140.74], 盛岡: [39.7036, 141.1527],
  仙台: [38.2688, 140.8721], 秋田: [39.7186, 140.1024], 山形: [38.2404, 140.3633],
  福島: [37.75, 140.4678], 水戸: [36.3418, 140.4468], 宇都宮: [36.5658, 139.8836],
  前橋: [36.3907, 139.0604], さいたま: [35.8617, 139.6455], 大宮: [35.9065, 139.6239],
  千葉: [35.6073, 140.1063], 東京: [35.6895, 139.6917], 新宿: [35.6938, 139.7036],
  横浜: [35.4478, 139.6425], 川崎: [35.5308, 139.7029], 新潟: [37.9026, 139.0236],
  富山: [36.6953, 137.2114], 金沢: [36.5947, 136.6256], 福井: [36.0652, 136.2216],
  甲府: [35.6642, 138.5684], 長野: [36.6513, 138.181], 岐阜: [35.3912, 136.7223],
  静岡: [34.9769, 138.3831], 浜松: [34.7108, 137.7261], 名古屋: [35.1815, 136.9066],
  津: [34.7303, 136.5086], 大津: [35.0045, 135.8686], 京都: [35.0116, 135.7681],
  大阪: [34.6937, 135.5023], 堺: [34.5733, 135.483], 神戸: [34.6901, 135.1955],
  奈良: [34.6851, 135.8048], 和歌山: [34.226, 135.1675], 鳥取: [35.5036, 134.2383],
  松江: [35.4723, 133.0505], 岡山: [34.6618, 133.9344], 広島: [34.3853, 132.4553],
  山口: [34.1859, 131.4714], 徳島: [34.0658, 134.5593], 高松: [34.3401, 134.0434],
  松山: [33.8416, 132.7657], 高知: [33.5597, 133.5311], 福岡: [33.6064, 130.4181],
  北九州: [33.8835, 130.8752], 佐賀: [33.2494, 130.2988], 長崎: [32.7448, 129.8737],
  熊本: [32.7898, 130.7417], 大分: [33.2382, 131.6126], 宮崎: [31.9111, 131.4239],
  鹿児島: [31.5602, 130.5581], 那覇: [26.2124, 127.6809], 沖縄: [26.3344, 127.8056],
};

// 出生地テキスト → 緯度経度（部分一致）
export function resolveCity(text) {
  if (!text) return null;
  const t = String(text).replace(/[都道府県市区町村]/g, '').trim();
  if (CITIES[t]) return { lat: CITIES[t][0], lon: CITIES[t][1], matched: t };
  for (const name of Object.keys(CITIES)) {
    if (text.includes(name)) return { lat: CITIES[name][0], lon: CITIES[name][1], matched: name };
  }
  return null;
}

// "YYYY/MM/DD" や "YYYY年M月D日" をパース
export function parseDate(s) {
  if (!s) return null;
  const m = String(s).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!m) return null;
  const year = +m[1], month = +m[2], day = +m[3];
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

// "HH:MM" や "10時30分" をパース。不明系の語は null。
export function parseTime(s) {
  if (!s) return { known: false };
  if (/不明|わからない|分からない|不詳|なし|skip/i.test(s)) return { known: false };
  const m = String(s).match(/(\d{1,2})\D+(\d{1,2})|(\d{1,2})\s*時/);
  if (m) {
    if (m[1] != null) return { known: true, hour: +m[1], minute: +m[2] };
    return { known: true, hour: +m[3], minute: 0 };
  }
  const h = String(s).match(/^\s*(\d{1,2})\s*$/);
  if (h) return { known: true, hour: +h[1], minute: 0 };
  return { known: false };
}
