// 四柱推命 計算モジュール
// 年柱・月柱は太陽黄経（節入り）で正確に判定し、日柱は干支60日周期、時柱は時辰で算出する。
import * as Astronomy from 'astronomy-engine';

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
// 天干の陰陽五行
const STEM_INFO = [
  { ja: '甲', yin: false, element: '木' },
  { ja: '乙', yin: true, element: '木' },
  { ja: '丙', yin: false, element: '火' },
  { ja: '丁', yin: true, element: '火' },
  { ja: '戊', yin: false, element: '土' },
  { ja: '己', yin: true, element: '土' },
  { ja: '庚', yin: false, element: '金' },
  { ja: '辛', yin: true, element: '金' },
  { ja: '壬', yin: false, element: '水' },
  { ja: '癸', yin: true, element: '水' },
];
const BRANCH_INFO = [
  { ja: '子', element: '水', zodiac: '鼠' },
  { ja: '丑', element: '土', zodiac: '牛' },
  { ja: '寅', element: '木', zodiac: '虎' },
  { ja: '卯', element: '木', zodiac: '兎' },
  { ja: '辰', element: '土', zodiac: '龍' },
  { ja: '巳', element: '火', zodiac: '蛇' },
  { ja: '午', element: '火', zodiac: '馬' },
  { ja: '未', element: '土', zodiac: '羊' },
  { ja: '申', element: '金', zodiac: '猿' },
  { ja: '酉', element: '金', zodiac: '鶏' },
  { ja: '戌', element: '土', zodiac: '犬' },
  { ja: '亥', element: '水', zodiac: '猪' },
];

const DEG = 180 / Math.PI;
function norm360(x) {
  x %= 360;
  return x < 0 ? x + 360 : x;
}
function sunLongitude(date) {
  const time = new Astronomy.AstroTime(date);
  const vec = Astronomy.GeoVector(Astronomy.Body.Sun, time, true);
  const rot = Astronomy.Rotation_EQJ_ECT(time);
  const ec = Astronomy.RotateVector(rot, vec);
  return norm360(Math.atan2(ec.y, ec.x) * DEG);
}

// グレゴリオ暦 → ユリウス通日（整数, その暦日の正午を指す）
function gregorianToJDN(y, m, d) {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return (
    d +
    Math.floor((153 * mm + 2) / 5) +
    365 * yy +
    Math.floor(yy / 4) -
    Math.floor(yy / 100) +
    Math.floor(yy / 400) -
    32045
  );
}

// 日柱の干支（60周期）。アンカーは既知の日干支で較正済み。
// JDN 2451545 = 2000-01-01（正午）は「戊午」日（干=戊[4], 支=午[6], 60干支番号54）。
const DAY_ANCHOR_JDN = 2451545;
const DAY_ANCHOR_STEM = 4; // 戊
const DAY_ANCHOR_BRANCH = 6; // 午

function dayPillar(y, m, d) {
  const jdn = gregorianToJDN(y, m, d);
  const diff = jdn - DAY_ANCHOR_JDN;
  const stem = ((DAY_ANCHOR_STEM + diff) % 10 + 10) % 10;
  const branch = ((DAY_ANCHOR_BRANCH + diff) % 12 + 12) % 12;
  return { stem, branch };
}

function pillarLabel(stem, branch) {
  return {
    stem: STEMS[stem],
    branch: BRANCHES[branch],
    kanshi: STEMS[stem] + BRANCHES[branch],
    element: STEM_INFO[stem].element,
    yin: STEM_INFO[stem].yin,
    branchElement: BRANCH_INFO[branch].element,
    zodiac: BRANCH_INFO[branch].zodiac,
  };
}

/**
 * 四柱（年月日時）を算出する。
 * @param {object} o
 * @param {number} o.year 現地の年
 * @param {number} o.month 1-12
 * @param {number} o.day 1-31
 * @param {number} [o.hour] 現地時 0-23
 * @param {number} [o.minute]
 * @param {number} o.tzOffsetMinutes 現地のUTCオフセット（分, 日本=540）
 * @param {boolean} o.timeKnown 時刻が分かっているか
 */
export function computeFourPillars(o) {
  const hour = o.timeKnown ? (o.hour ?? 0) : 0;
  const minute = o.timeKnown ? (o.minute ?? 0) : 0;
  // 年柱・月柱判定用：出生の瞬間(UTC)の太陽黄経
  const utcMs =
    Date.UTC(o.year, o.month - 1, o.day, hour, minute, 0) -
    o.tzOffsetMinutes * 60000;
  const lambda = sunLongitude(new Date(utcMs));

  // 年柱：立春(黄経315°)を境に年が変わる
  let solarYear = o.year;
  // 立春前（1〜2月で、黄経が立春[315]を超えていない＝黄経が 315未満かつ 春分前域）
  // 黄経が [315,360)∪[0,315) のどこにあるかで前年扱いを判定
  // 立春〜翌立春 の1年。黄経 315未満(= 立春前, ちょうど冬の寒期 285-315付近や春先)かどうかを月で補正
  if (o.month <= 2) {
    // 2月でも立春(通常2/4頃)前なら前年。黄経315未満なら立春前
    if (lambda >= 285 && lambda < 315) solarYear = o.year - 1;
    else if (lambda < 285 && o.month === 1) solarYear = o.year - 1; // 1月（小寒〜大寒, 黄経285-315手前は小寒以降）
  }
  const yStem = ((solarYear - 4) % 10 + 10) % 10;
  const yBranch = ((solarYear - 4) % 12 + 12) % 12;

  // 月柱：節入り（立春315から30°ごと）で月支を決定
  const k = Math.floor((norm360(lambda - 315)) / 30); // 0=寅月
  const mBranch = (2 + k) % 12;
  // 月干（五虎遁）：寅月の干 = (年干 mod 5)*2 + 2
  const tigerStem = ((yStem % 5) * 2 + 2) % 10;
  const monthOrdinal = (mBranch - 2 + 12) % 12; // 寅=0
  const mStem = (tigerStem + monthOrdinal) % 10;

  // 日柱
  const { stem: dStem, branch: dBranch } = dayPillar(o.year, o.month, o.day);

  const result = {
    input: { ...o },
    solarLongitude: Number(lambda.toFixed(3)),
    year: pillarLabel(yStem, yBranch),
    month: pillarLabel(mStem, mBranch),
    day: pillarLabel(dStem, dBranch),
    dayMaster: { stem: STEMS[dStem], ...STEM_INFO[dStem] }, // 日主（命式の主体）
  };

  if (o.timeKnown) {
    // 時柱
    const hBranch = Math.floor((hour + 1) / 2) % 12;
    const ratStem = ((dStem % 5) * 2) % 10; // 子時の干（五鼠遁）
    const hStem = (ratStem + hBranch) % 10;
    result.hour = pillarLabel(hStem, hBranch);
  } else {
    result.notice = '出生時刻が不明のため、時柱は省略しています（年柱・月柱・日柱は有効です）。';
  }

  return result;
}

export function summarizeFourPillars(fp) {
  const lines = [];
  lines.push(`年柱: ${fp.year.kanshi}（${fp.year.element}／${fp.year.zodiac}年）`);
  lines.push(`月柱: ${fp.month.kanshi}（${fp.month.element}）`);
  lines.push(`日柱: ${fp.day.kanshi}（${fp.day.element}）← 日主=${fp.dayMaster.stem}(${fp.dayMaster.element})`);
  if (fp.hour) lines.push(`時柱: ${fp.hour.kanshi}（${fp.hour.element}）`);
  if (fp.notice) lines.push(`注意: ${fp.notice}`);
  return lines.join('\n');
}
