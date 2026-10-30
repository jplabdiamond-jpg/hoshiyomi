// 西洋占星術（トロピカル）計算モジュール
// astronomy-engine を用いて of-date(真春分点基準) の黄経を実計算する。
import * as Astronomy from 'astronomy-engine';

const DEG = 180 / Math.PI;
const RAD = Math.PI / 180;

export const SIGNS = [
  { key: 'aries', ja: '牡羊座', symbol: '♈', element: '火', quality: '活動' },
  { key: 'taurus', ja: '牡牛座', symbol: '♉', element: '地', quality: '不動' },
  { key: 'gemini', ja: '双子座', symbol: '♊', element: '風', quality: '柔軟' },
  { key: 'cancer', ja: '蟹座', symbol: '♋', element: '水', quality: '活動' },
  { key: 'leo', ja: '獅子座', symbol: '♌', element: '火', quality: '不動' },
  { key: 'virgo', ja: '乙女座', symbol: '♍', element: '地', quality: '柔軟' },
  { key: 'libra', ja: '天秤座', symbol: '♎', element: '風', quality: '活動' },
  { key: 'scorpio', ja: '蠍座', symbol: '♏', element: '水', quality: '不動' },
  { key: 'sagittarius', ja: '射手座', symbol: '♐', element: '火', quality: '柔軟' },
  { key: 'capricorn', ja: '山羊座', symbol: '♑', element: '地', quality: '活動' },
  { key: 'aquarius', ja: '水瓶座', symbol: '♒', element: '風', quality: '不動' },
  { key: 'pisces', ja: '魚座', symbol: '♓', element: '水', quality: '柔軟' },
];

const PLANETS = [
  { body: Astronomy.Body.Sun, ja: '太陽', symbol: '☉' },
  { body: Astronomy.Body.Moon, ja: '月', symbol: '☽' },
  { body: Astronomy.Body.Mercury, ja: '水星', symbol: '☿' },
  { body: Astronomy.Body.Venus, ja: '金星', symbol: '♀' },
  { body: Astronomy.Body.Mars, ja: '火星', symbol: '♂' },
  { body: Astronomy.Body.Jupiter, ja: '木星', symbol: '♃' },
  { body: Astronomy.Body.Saturn, ja: '土星', symbol: '♄' },
  { body: Astronomy.Body.Uranus, ja: '天王星', symbol: '♅' },
  { body: Astronomy.Body.Neptune, ja: '海王星', symbol: '♆' },
  { body: Astronomy.Body.Pluto, ja: '冥王星', symbol: '♇' },
];

const ASPECTS = [
  { ja: '合', en: 'conjunction', angle: 0, orb: 8 },
  { ja: '衝（オポジション）', en: 'opposition', angle: 180, orb: 8 },
  { ja: '三分（トライン）', en: 'trine', angle: 120, orb: 7 },
  { ja: '矩（スクエア）', en: 'square', angle: 90, orb: 7 },
  { ja: '六分（セクスタイル）', en: 'sextile', angle: 60, orb: 5 },
];

function norm360(x) {
  x %= 360;
  return x < 0 ? x + 360 : x;
}

// 平均黄道傾斜角（of-date, TT基準）
function meanObliquityDeg(time) {
  const T = time.tt / 36525; // J2000 からのユリウス世紀（TT）
  const seconds =
    84381.406 -
    46.836769 * T -
    0.0001831 * T * T +
    0.0020034 * T * T * T;
  return seconds / 3600;
}

// 天体の of-date 黄経（度）
function eclipticLongitude(body, time) {
  const vec = Astronomy.GeoVector(body, time, true);
  const rot = Astronomy.Rotation_EQJ_ECT(time);
  const ec = Astronomy.RotateVector(rot, vec);
  return norm360(Math.atan2(ec.y, ec.x) * DEG);
}

// 逆行判定（1日前後の黄経差）
function isRetrograde(body, time) {
  if (body === Astronomy.Body.Sun || body === Astronomy.Body.Moon) return false;
  const before = eclipticLongitude(body, time.AddDays(-0.5));
  const after = eclipticLongitude(body, time.AddDays(0.5));
  let d = after - before;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d < 0;
}

function toSign(lon) {
  const idx = Math.floor(norm360(lon) / 30);
  const deg = norm360(lon) - idx * 30;
  const d = Math.floor(deg);
  const m = Math.floor((deg - d) * 60);
  return {
    sign: SIGNS[idx],
    signIndex: idx,
    degreeInSign: deg,
    label: `${SIGNS[idx].ja} ${d}°${String(m).padStart(2, '0')}′`,
  };
}

// アセンダント・MC（出生時刻と緯度経度が必要）
function computeAngles(time, latDeg, lonDeg) {
  const gastHours = Astronomy.SiderealTime(time); // グリニッジ視恒星時(h)
  const lstHours = (gastHours + lonDeg / 15) % 24;
  const ramc = norm360(lstHours * 15); // 度
  const eps = meanObliquityDeg(time) * RAD;
  const ramcR = ramc * RAD;
  const phi = latDeg * RAD;

  // MC
  let mc = Math.atan2(Math.sin(ramcR), Math.cos(ramcR) * Math.cos(eps)) * DEG;
  mc = norm360(mc);

  // Ascendant
  let asc =
    Math.atan2(
      Math.cos(ramcR),
      -(Math.sin(ramcR) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps))
    ) * DEG;
  asc = norm360(asc);

  return { ascendant: asc, mc };
}

// イコールハウス（アセンダント基準）とプラネットの所属ハウス
function assignHouses(ascendant, planets) {
  const cusps = [];
  for (let i = 0; i < 12; i++) cusps.push(norm360(ascendant + i * 30));
  for (const p of planets) {
    const rel = norm360(p.longitude - ascendant);
    p.house = Math.floor(rel / 30) + 1;
  }
  return cusps;
}

function computeAspects(planets) {
  const out = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      let diff = Math.abs(planets[i].longitude - planets[j].longitude);
      if (diff > 180) diff = 360 - diff;
      for (const a of ASPECTS) {
        const orb = Math.abs(diff - a.angle);
        if (orb <= a.orb) {
          out.push({
            a: planets[i].ja,
            b: planets[j].ja,
            aspect: a.ja,
            orb: Number(orb.toFixed(2)),
          });
          break;
        }
      }
    }
  }
  return out.sort((x, y) => x.orb - y.orb);
}

/**
 * ネイタルチャートを計算する。
 * @param {object} o
 * @param {number} o.year 現地の年
 * @param {number} o.month 1-12
 * @param {number} o.day 1-31
 * @param {number} [o.hour] 現地時（0-23）
 * @param {number} [o.minute]
 * @param {number} o.tzOffsetMinutes 現地のUTCオフセット（分, 日本=540）
 * @param {number} [o.lat] 出生地緯度（北緯+）
 * @param {number} [o.lon] 出生地経度（東経+）
 * @param {boolean} o.timeKnown 出生時刻が分かっているか
 */
export function computeNatalChart(o) {
  const hour = o.timeKnown ? (o.hour ?? 12) : 12;
  const minute = o.timeKnown ? (o.minute ?? 0) : 0;
  // 現地時 → UTC
  const utcMs =
    Date.UTC(o.year, o.month - 1, o.day, hour, minute, 0) -
    o.tzOffsetMinutes * 60000;
  const date = new Date(utcMs);
  const time = new Astronomy.AstroTime(date);

  const planets = PLANETS.map((pl) => {
    const lon = eclipticLongitude(pl.body, time);
    const s = toSign(lon);
    return {
      ja: pl.ja,
      symbol: pl.symbol,
      longitude: lon,
      sign: s.sign.ja,
      element: s.sign.element,
      position: s.label,
      retrograde: isRetrograde(pl.body, time),
    };
  });

  const result = {
    input: { ...o, hourUsed: hour, minuteUsed: minute },
    planets,
    aspects: computeAspects(planets),
  };

  if (o.timeKnown && typeof o.lat === 'number' && typeof o.lon === 'number') {
    const { ascendant, mc } = computeAngles(time, o.lat, o.lon);
    result.ascendant = { longitude: ascendant, ...toSign(ascendant) };
    result.mc = { longitude: mc, ...toSign(mc) };
    result.houseCusps = assignHouses(ascendant, planets).map((c, i) => ({
      house: i + 1,
      ...toSign(c),
    }));
    result.ascendant.label = toSign(ascendant).label;
    result.mc.label = toSign(mc).label;
  } else {
    result.notice =
      '出生時刻が不明のため、アセンダント・MC・ハウス・月の正確な度数は省略しています（太陽星座など日付依存の要素は有効です）。';
  }

  return result;
}

// 要約（鑑定文生成プロンプト用の素材）
export function summarizeChart(chart) {
  const lines = [];
  for (const p of chart.planets) {
    lines.push(
      `${p.ja}: ${p.position}${p.retrograde ? '（逆行）' : ''}${p.house ? ` / 第${p.house}ハウス` : ''}`
    );
  }
  if (chart.ascendant) lines.push(`アセンダント: ${chart.ascendant.label}`);
  if (chart.mc) lines.push(`MC: ${chart.mc.label}`);
  const asp = chart.aspects
    .slice(0, 8)
    .map((a) => `${a.a}${a.aspect}${a.b}(orb${a.orb}°)`)
    .join('、');
  if (asp) lines.push(`主要アスペクト: ${asp}`);
  if (chart.notice) lines.push(`注意: ${chart.notice}`);
  return lines.join('\n');
}
