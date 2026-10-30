// 鑑定文生成のためのプロンプト構築と計算オーケストレーション
import { computeNatalChart, summarizeChart } from './astrology.js';
import { computeFourPillars, summarizeFourPillars } from './fourpillars.js';
import { drawTarot, summarizeTarot } from './tarot.js';
import { getDivination, resolveCity, parseDate, parseTime } from './divinations.js';

const JP_TZ = 540; // 日本標準時（分）

// 入力(answers) → 計算結果 + LLM用素材
export function computeDivination(key, answers) {
  const div = getDivination(key);
  if (!div) throw new Error('unknown divination: ' + key);

  if (key === 'astrology') {
    const d = parseDate(answers.birthDate);
    if (!d) throw new Error('生年月日を読み取れませんでした');
    const t = parseTime(answers.birthTime);
    const city = t.known ? resolveCity(answers.birthPlace) : null;
    const chart = computeNatalChart({
      year: d.year, month: d.month, day: d.day,
      hour: t.hour, minute: t.minute,
      tzOffsetMinutes: JP_TZ,
      lat: city?.lat, lon: city?.lon,
      timeKnown: t.known && !!city,
    });
    return {
      title: '西洋占星術',
      data: chart,
      material: summarizeChart(chart),
      meta: { timeKnown: t.known, place: city?.matched || null },
    };
  }

  if (key === 'fourpillars') {
    const d = parseDate(answers.birthDate);
    if (!d) throw new Error('生年月日を読み取れませんでした');
    const t = parseTime(answers.birthTime);
    const fp = computeFourPillars({
      year: d.year, month: d.month, day: d.day,
      hour: t.hour, minute: t.minute,
      tzOffsetMinutes: JP_TZ,
      timeKnown: t.known,
    });
    return {
      title: '四柱推命',
      data: fp,
      material: summarizeFourPillars(fp),
      meta: { timeKnown: t.known },
    };
  }

  if (key === 'tarot') {
    const res = drawTarot(answers.spread || 'one', answers.question || '');
    return {
      title: 'タロット',
      data: res,
      material: summarizeTarot(res),
      meta: {},
    };
  }

  throw new Error('unsupported');
}

// LLM（Workers AI）用のメッセージを構築
export function buildMessages(key, computed, answers) {
  const common =
    'あなたは経験豊かで誠実な占い師です。以下の「鑑定データ」は専門的な計算によって厳密に求められた確定値です。' +
    'このデータだけを根拠に鑑定してください。データにない星の配置・干支・カードを新たに創作してはいけません。' +
    '日本語で、やわらかく前向きに、しかし具体的に語りかけてください。断定的な運命論や不安を煽る表現は避け、' +
    '相談者が自分で選択できるような助言にしてください。健康・法律・投資などの専門的判断は占いの範囲外であることを踏まえてください。';

  let instruction = '';
  if (key === 'astrology') {
    instruction =
      '西洋占星術の鑑定文を作成してください。構成:\n' +
      '①全体像（太陽・月・アセンダントが分かる場合はその3点から)\n' +
      '②性格と資質\n③今の運気の流れとテーマ\n④具体的なアドバイス。\n' +
      '各見出しを付け、合計600〜800字程度。';
  } else if (key === 'fourpillars') {
    instruction =
      '四柱推命の鑑定文を作成してください。日主（日柱の天干）を中心に、命式全体の五行バランスを踏まえて。構成:\n' +
      '①命式の全体像\n②基本的な性質（日主から）\n③才能・適性\n④運気の傾向と開運の指針。\n' +
      '各見出しを付け、合計600〜800字程度。';
  } else if (key === 'tarot') {
    instruction =
      'タロットの鑑定文を作成してください。構成:\n' +
      '①引いたカードが示す全体メッセージ\n②各ポジションのカードの意味（正逆を踏まえて）\n' +
      '③相談内容への具体的な示唆とアドバイス。\n合計500〜700字程度。';
  }

  const user =
    `【占術】${computed.title}\n【相談者の入力】${JSON.stringify(answers)}\n\n` +
    `【鑑定データ（確定値・この範囲で解釈すること）】\n${computed.material}\n\n` +
    `【依頼】\n${instruction}`;

  return [
    { role: 'system', content: common },
    { role: 'user', content: user },
  ];
}

export const DISCLAIMER =
  '※本鑑定は占術に基づく参考情報であり、娯楽・自己理解の目的でご利用ください。重要な判断はご自身の責任で行ってください。';
