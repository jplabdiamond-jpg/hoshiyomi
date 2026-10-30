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

// 五行のインデックス（相生の順）：木0→火1→土2→金3→水4→木…
const ELEMENT_INDEX = { 木: 0, 火: 1, 土: 2, 金: 3, 水: 4 };
const ELEMENT_NAMES = ['木', '火', '土', '金', '水'];

// 日主（dm）から見た、ある天干の十神を返す
function tenGod(dmStemIdx, otherStemIdx) {
  const dm = STEM_INFO[dmStemIdx];
  const o = STEM_INFO[otherStemIdx];
  const diff = (ELEMENT_INDEX[o.element] - ELEMENT_INDEX[dm.element] + 5) % 5;
  const same = dm.yin === o.yin; // 同じ陰陽か
  const table = [
    ['比肩', '劫財'], // diff0: 同じ五行
    ['食神', '傷官'], // diff1: 我が生む（表現・才能）
    ['偏財', '正財'], // diff2: 我が剋す（お金・現実）
    ['偏官', '正官'], // diff3: 我を剋す（規律・プレッシャー）
    ['偏印', '正印'], // diff4: 我を生む（支え・学び）
  ];
  return same ? table[diff][0] : table[diff][1];
}

// 八字（年月日時の天干4＋地支4）の五行バランスを集計
function elementBalance(stems, branches) {
  const count = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const s of stems) count[STEM_INFO[s].element]++;
  for (const b of branches) count[BRANCH_INFO[b].element]++;
  return count;
}

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

// 地支どうしの冲（6つ離れた対沖）判定
function isClash(b1, b2) {
  return (b1 + 6) % 12 === b2;
}

// 大運（10年ごとの運気の柱）を算出
function computeDaYun(o, birthDate, lambda, yStem, mStem, mBranch, dStem, dBranch) {
  const birthTime = new Astronomy.AstroTime(birthDate);
  const yearYang = yStem % 2 === 0; // 甲丙戊庚壬=陽
  const male = o.gender === 'male';
  const forward = (yearYang && male) || (!yearYang && !male); // 陽年男/陰年女=順行

  // 起運：順行は次の節まで、逆行は前の節からの日数 ÷ 3 = 歳
  const k = Math.floor(norm360(lambda - 315) / 30);
  let days;
  if (forward) {
    const Lnext = norm360(315 + 30 * (k + 1));
    const t = Astronomy.SearchSunLongitude(Lnext, birthTime, 40);
    days = t ? t.ut - birthTime.ut : 0;
  } else {
    const Lprev = norm360(315 + 30 * k);
    const start = new Astronomy.AstroTime(new Date(birthDate.getTime() - 45 * 86400000));
    const t = Astronomy.SearchSunLongitude(Lprev, start, 46);
    days = t ? birthTime.ut - t.ut : 0;
  }
  const startAge = Math.max(0, days / 3);
  const dir = forward ? 1 : -1;

  const pillars = [];
  for (let i = 1; i <= 8; i++) {
    const stem = ((mStem + dir * i) % 10 + 10) % 10;
    const branch = ((mBranch + dir * i) % 12 + 12) % 12;
    const god = tenGod(dStem, stem);
    pillars.push({
      kanshi: STEMS[stem] + BRANCHES[branch],
      ageStart: Math.round((startAge + (i - 1) * 10) * 10) / 10,
      ageEnd: Math.round((startAge + i * 10) * 10) / 10,
      tenGod: god,
      clashDay: isClash(branch, dBranch),
      note: ['偏官', '正官'].includes(god) ? '転機・責任が増す時期' : isClash(branch, dBranch) ? '変化・揺らぎの時期' : '',
    });
  }
  return { forward, startAge: Math.round(startAge * 10) / 10, pillars };
}

// 流年（毎年の運気）を算出
function computeLiuNian(o, dStem, dBranch, yBranch, nowYear) {
  const out = [];
  for (let y = nowYear; y < nowYear + 9; y++) {
    const ys = ((y - 4) % 10 + 10) % 10;
    const yb = ((y - 4) % 12 + 12) % 12;
    const god = tenGod(dStem, ys);
    const clashDay = isClash(yb, dBranch);
    const clashYear = isClash(yb, yBranch); // 歳破（本命の年支との冲）
    let note = '';
    if (clashDay) note = '生活や環境が動きやすい年';
    else if (clashYear) note = '節目・仕切り直しの年';
    else if (['偏官', '正官'].includes(god)) note = 'プレッシャーと成長の年';
    else if (['偏財', '正財'].includes(god)) note = '成果・現実化のチャンスの年';
    else if (['食神', '傷官'].includes(god)) note = '表現・発信が活きる年';
    out.push({
      year: y,
      age: y - o.year,
      kanshi: STEMS[ys] + BRANCHES[yb],
      tenGod: god,
      clash: clashDay || clashYear,
      note,
    });
  }
  return out;
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
    solarYear,
    solarLongitude: Number(lambda.toFixed(3)),
    year: pillarLabel(yStem, yBranch),
    month: pillarLabel(mStem, mBranch),
    day: pillarLabel(dStem, dBranch),
    dayMaster: { stem: STEMS[dStem], ...STEM_INFO[dStem] }, // 日主（命式の主体）
  };

  // 時柱
  let hStem = null, hBranch = null;
  if (o.timeKnown) {
    hBranch = Math.floor((hour + 1) / 2) % 12;
    const ratStem = ((dStem % 5) * 2) % 10; // 子時の干（五鼠遁）
    hStem = (ratStem + hBranch) % 10;
    result.hour = pillarLabel(hStem, hBranch);
  } else {
    result.notice = '出生時刻が不明のため、時柱は省略しています（年柱・月柱・日柱は有効です）。';
  }

  // 五行バランス（天干・地支をすべて集計）
  const stems = [yStem, mStem, dStem];
  const branches = [yBranch, mBranch, dBranch];
  if (o.timeKnown) { stems.push(hStem); branches.push(hBranch); }
  const balance = elementBalance(stems, branches);
  result.elementBalance = balance;
  const total = Object.values(balance).reduce((a, b) => a + b, 0);
  const sorted = ELEMENT_NAMES.slice().sort((a, b) => balance[b] - balance[a]);
  result.elementStrongest = sorted[0];
  result.elementMissing = ELEMENT_NAMES.filter((e) => balance[e] === 0);

  // 十神（日主から見た 年干・月干・時干 の役割）
  result.tenGods = {
    year: tenGod(dStem, yStem),
    month: tenGod(dStem, mStem),
  };
  if (o.timeKnown) result.tenGods.hour = tenGod(dStem, hStem);

  // 身強・身弱の簡易判定：日主と同五行(比劫)＋日主を生む五行(印)の割合で概算
  const dmE = ELEMENT_INDEX[STEM_INFO[dStem].element];
  const supportE = [STEM_INFO[dStem].element, ELEMENT_NAMES[(dmE + 4) % 5]]; // 同五行＋生じる五行
  const support = supportE.reduce((a, e) => a + balance[e], 0);
  // 月令（月支の五行が日主を支えるか）を加味
  const monthSupports = supportE.includes(BRANCH_INFO[mBranch].element);
  result.dayMasterStrength = {
    label: support >= total / 2 || (monthSupports && support >= total / 2 - 1) ? '身強（やや強め）' : '身弱（やや弱め）',
    supportCount: support,
    total,
    monthSupports,
    note: '※簡易判定。厳密な身強身弱は蔵干・通根も要考慮',
  };

  // 大運・流年（今後の運気の時期）
  const nowYear = o.nowYear || new Date().getFullYear();
  if (o.gender === 'male' || o.gender === 'female') {
    result.daYun = computeDaYun(o, new Date(utcMs), lambda, yStem, mStem, mBranch, dStem, dBranch);
  } else {
    result.daYunNotice = '性別が未指定のため、大運（10年ごとの運気）は省略しています。';
  }
  result.liuNian = computeLiuNian(o, dStem, dBranch, yBranch, nowYear);
  result.nowYear = nowYear;

  return result;
}

export function summarizeFourPillars(fp) {
  const lines = [];
  lines.push(`年柱: ${fp.year.kanshi}（${fp.year.element}／${fp.year.zodiac}年）… 十神:${fp.tenGods.year}`);
  lines.push(`月柱: ${fp.month.kanshi}（${fp.month.element}）… 十神:${fp.tenGods.month}`);
  lines.push(`日柱: ${fp.day.kanshi}（${fp.day.element}）← 日主=${fp.dayMaster.stem}(${fp.dayMaster.element}・${fp.dayMaster.yin ? '陰' : '陽'})`);
  if (fp.hour) lines.push(`時柱: ${fp.hour.kanshi}（${fp.hour.element}）… 十神:${fp.tenGods.hour}`);
  const b = fp.elementBalance;
  lines.push(`五行バランス: 木${b.木}・火${b.火}・土${b.土}・金${b.金}・水${b.水}（最多:${fp.elementStrongest}${fp.elementMissing.length ? ` / 不足:${fp.elementMissing.join('')}` : ''}）`);
  lines.push(`日主の強弱: ${fp.dayMasterStrength.label}（支える五行の数 ${fp.dayMasterStrength.supportCount}/${fp.dayMasterStrength.total}、月令の支え:${fp.dayMasterStrength.monthSupports ? 'あり' : 'なし'}）`);

  if (fp.daYun) {
    lines.push(`\n【大運＝10年ごとの運気の流れ（${fp.daYun.forward ? '順行' : '逆行'}・${fp.daYun.startAge}歳から切替）】`);
    for (const p of fp.daYun.pillars) {
      lines.push(`・${p.ageStart}〜${p.ageEnd}歳: ${p.kanshi}（${p.tenGod}）${p.note ? ' ← ' + p.note : ''}`);
    }
  } else if (fp.daYunNotice) {
    lines.push(fp.daYunNotice);
  }

  if (fp.liuNian) {
    lines.push(`\n【流年＝今後の各年の運気（${fp.nowYear}年〜）】`);
    for (const y of fp.liuNian) {
      lines.push(`・${y.year}年（${y.age}歳）: ${y.kanshi}（${y.tenGod}）${y.note ? ' ← ' + y.note : ''}`);
    }
  }

  if (fp.notice) lines.push(`注意: ${fp.notice}`);
  return lines.join('\n');
}
