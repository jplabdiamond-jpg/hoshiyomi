// 姓名判断 計算モジュール（五格・画数吉凶・三才）
// 画数は KANJIDIC 由来の新字体ベース（kanji-strokes.json）。※流派により解釈差あり。
import STROKES from './kanji-strokes.js';

// 81数の吉凶（熊崎式ベースの一般的な分類。流派差あり）
const LUCK81 = {
  1:'大吉',3:'大吉',5:'大吉',6:'吉',7:'吉',8:'吉',11:'大吉',13:'大吉',15:'大吉',16:'大吉',
  17:'吉',18:'吉',21:'大吉',23:'大吉',24:'大吉',25:'吉',29:'吉',31:'大吉',32:'大吉',33:'大吉',
  35:'吉',37:'大吉',39:'大吉',41:'大吉',45:'吉',47:'大吉',48:'吉',52:'吉',57:'吉',61:'吉',
  63:'大吉',65:'大吉',67:'吉',68:'吉',81:'大吉',
  2:'凶',4:'凶',9:'凶',10:'大凶',12:'凶',14:'凶',19:'凶',20:'大凶',22:'凶',26:'半凶',27:'半凶',
  28:'凶',30:'半凶',34:'大凶',36:'凶',38:'半吉',40:'半凶',42:'凶',43:'凶',44:'凶',46:'凶',
  49:'半凶',50:'半凶',51:'半吉',53:'半凶',54:'大凶',55:'半凶',56:'凶',58:'半吉',59:'凶',60:'大凶',
  62:'凶',64:'凶',66:'凶',69:'凶',70:'大凶',71:'半吉',72:'凶',73:'半吉',74:'凶',75:'半吉',
  76:'凶',77:'半吉',78:'半凶',79:'凶',80:'凶',
};
function luck(n) {
  if (n > 81) n = ((n - 1) % 81) + 1;
  return LUCK81[n] || '半吉';
}

// 画数末尾 → 五行
function gogyo(n) {
  const d = n % 10;
  if (d === 1 || d === 2) return '木';
  if (d === 3 || d === 4) return '火';
  if (d === 5 || d === 6) return '土';
  if (d === 7 || d === 8) return '金';
  return '水';
}

// 三才（天・人・地の五行）の相性：相生=吉, 相剋=注意
const GEN = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' }; // 相生
function sancaiHarmony(a, b, c) {
  const ok = (x, y) => GEN[x] === y || GEN[y] === x || x === y;
  const good = ok(a, b) && ok(b, c);
  return good ? '安定（相生寄り）' : '変化に注意（相剋含む）';
}

function strokesOf(chars) {
  return chars.map((ch) => ({ ch, n: STROKES[ch] ?? null }));
}

/**
 * 姓名判断を計算する。
 * @param {string} sei 姓（漢字）
 * @param {string} mei 名（漢字）
 */
export function computeSeimei(sei, mei) {
  const seiChars = Array.from((sei || '').trim());
  const meiChars = Array.from((mei || '').trim());
  const s = strokesOf(seiChars);
  const m = strokesOf(meiChars);
  const unknown = [...s, ...m].filter((x) => x.n == null).map((x) => x.ch);
  if (unknown.length) {
    return { error: `画数を特定できない文字があります：${unknown.join('、')}（常用外・旧字体など）` };
  }
  const sv = s.map((x) => x.n);
  const mv = m.map((x) => x.n);
  const sumS = sv.reduce((a, b) => a + b, 0);
  const sumM = mv.reduce((a, b) => a + b, 0);

  const tenkaku = sumS + (sv.length === 1 ? 1 : 0); // 天格（姓1字は霊数+1）
  const chikaku = sumM + (mv.length === 1 ? 1 : 0); // 地格（名1字は霊数+1）
  const jinkaku = sv[sv.length - 1] + mv[0]; // 人格
  const soukaku = sumS + sumM; // 総格
  const gaikaku = soukaku - jinkaku + (sv.length === 1 ? 1 : 0) + (mv.length === 1 ? 1 : 0); // 外格

  const kaku = {
    天格: { stroke: tenkaku, luck: luck(tenkaku), meaning: '先祖・家系から受け継ぐ運' },
    人格: { stroke: jinkaku, luck: luck(jinkaku), meaning: '性格の中心・中年期の運（最重要）' },
    地格: { stroke: chikaku, luck: luck(chikaku), meaning: '幼年〜青年期・家庭や才能の基礎' },
    外格: { stroke: gaikaku, luck: luck(gaikaku), meaning: '対人・社会からの印象・環境運' },
    総格: { stroke: soukaku, luck: luck(soukaku), meaning: '人生全体・晩年の総合運' },
  };

  const san = [gogyo(tenkaku), gogyo(jinkaku), gogyo(chikaku)];
  return {
    sei: seiChars.join(''), mei: meiChars.join(''),
    strokes: { sei: s, mei: m },
    kaku,
    sancai: { 天: san[0], 人: san[1], 地: san[2], harmony: sancaiHarmony(san[0], san[1], san[2]) },
    note: '※画数は新字体ベース。流派により吉凶の解釈は異なります。',
  };
}

export function summarizeSeimei(r) {
  if (r.error) return `姓名判断: ${r.error}`;
  const lines = [`姓名: ${r.sei} ${r.mei}`];
  for (const [k, v] of Object.entries(r.kaku)) {
    lines.push(`${k}: ${v.stroke}画（${v.luck}）… ${v.meaning}`);
  }
  lines.push(`三才配置: 天${r.sancai.天}・人${r.sancai.人}・地${r.sancai.地}（${r.sancai.harmony}）`);
  return lines.join('\n');
}
