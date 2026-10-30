// 風水（八宅）計算モジュール：本命卦と吉方位を算出
// 生年（立春基準の年）と性別から本命卦（Kua）を求める。

const KUA_INFO = {
  1: { gua: '坎', group: '東四命', element: '水' },
  2: { gua: '坤', group: '西四命', element: '土' },
  3: { gua: '震', group: '東四命', element: '木' },
  4: { gua: '巽', group: '東四命', element: '木' },
  6: { gua: '乾', group: '西四命', element: '金' },
  7: { gua: '兌', group: '西四命', element: '金' },
  8: { gua: '艮', group: '西四命', element: '土' },
  9: { gua: '離', group: '東四命', element: '火' },
};

// 吉方位（生気=発展/活力, 天医=健康, 延年=人間関係/安定, 伏位=安らぎ）
const LUCKY = {
  1: { 生気: '南東', 天医: '東', 延年: '南', 伏位: '北' },
  2: { 生気: '北東', 天医: '西', 延年: '北西', 伏位: '南西' },
  3: { 生気: '南', 天医: '北', 延年: '南東', 伏位: '東' },
  4: { 生気: '北', 天医: '南', 延年: '東', 伏位: '南東' },
  6: { 生気: '西', 天医: '北東', 延年: '南西', 伏位: '北西' },
  7: { 生気: '北西', 天医: '南西', 延年: '北東', 伏位: '西' },
  8: { 生気: '南西', 天医: '北西', 延年: '西', 伏位: '北東' },
  9: { 生気: '東', 天医: '南東', 延年: '北', 伏位: '南' },
};

function reduceDigit(n) {
  while (n > 9) n = String(n).split('').reduce((a, d) => a + +d, 0);
  return n;
}

/**
 * 本命卦を算出。
 * @param {number} year 立春基準の年
 * @param {string} gender 'male' | 'female'
 */
export function computeFengShui(year, gender) {
  const s = reduceDigit(String(year).split('').reduce((a, d) => a + +d, 0));
  let kua;
  if (gender === 'male') kua = year < 2000 ? 10 - s : 9 - s;
  else kua = year < 2000 ? s + 5 : s + 6;
  kua = reduceDigit(kua);
  if (kua === 0) kua = 9;
  if (kua === 5) kua = gender === 'male' ? 2 : 8; // 5は男=坤2/女=艮8

  const info = KUA_INFO[kua];
  return {
    kua,
    gua: info.gua,
    group: info.group,
    element: info.element,
    lucky: LUCKY[kua],
    note: '※本命卦は立春基準の生年で算出。吉方位は八宅の一般的な対応。',
  };
}

export function summarizeFengShui(f) {
  return [
    `本命卦: ${f.kua}・${f.gua}（${f.group}／${f.element}）`,
    `吉方位: 発展=${f.lucky.生気}、健康=${f.lucky.天医}、人間関係=${f.lucky.延年}、安定=${f.lucky.伏位}`,
  ].join('\n');
}
