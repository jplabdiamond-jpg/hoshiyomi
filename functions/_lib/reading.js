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
    'あなたは経験豊かで、話がとても分かりやすいと評判の占い師です。以下の「鑑定データ」は専門的な計算で厳密に求めた確定値です。' +
    'このデータだけを根拠に鑑定し、データにない星の配置・干支・カードを創作してはいけません。\n' +
    '【書き方のルール（厳守）】\n' +
    '・占いの知識がまったくない人にも伝わるように、専門用語は避けるか、使うときは必ずその場で日常語に言い換える（例:「食神」→「自分を素直に表現する才能」）。\n' +
    '・同じ単語の繰り返しを避ける。特に五行名（木火土金水）や元素名を同じ段落で何度も連呼しない。言い換え・比喩・具体例でふくらませる。\n' +
    '・抽象語だけで終わらせず、仕事・人間関係・日常の場面に落とした具体例を添える。\n' +
    '・文の長さや始まり方に変化をつけ、単調な箇条書きの羅列にしない。温かく、前向きに、しかし中身のある言葉で。\n' +
    '・断定的な運命論や不安を煽る表現は使わない。最後は相談者が自分で選べる形の助言にする。\n' +
    '・全文を自然で読みやすい日本語だけで書く。英単語や他言語の文字（ハングル・簡体字など）、不自然な漢字変換を混ぜない。\n' +
    '・健康・法律・お金の専門判断は占いの範囲外であることを踏まえる。';

  let instruction = '';
  if (key === 'astrology') {
    instruction =
      '西洋占星術の鑑定文を作ってください。次の見出しで構成します。\n' +
      '■ あなたという人（太陽・月・アセンダントが分かればその3点を、普段の自分・心の内側・第一印象として噛み砕く）\n' +
      '■ 強みと、少し気をつけたいところ（エレメント/クオリティの偏りも日常語で）\n' +
      '■ 今の運気の流れ\n' +
      '■ これからどうすると良いか（最重要・厚めに）… 今日から試せる具体的な行動を3つ、場面つきで提案する\n' +
      '全体で800〜1000字程度。専門用語には必ず一言の説明を添えること。';
  } else if (key === 'fourpillars') {
    instruction =
      '四柱推命の鑑定文を作ってください。日主（あなたの核となる性質）を中心に、五行バランス・十神・身強身弱を手がかりにします。次の見出しで構成します。\n' +
      '■ あなたの核（日主を、どんな人柄かへ噛み砕いて）\n' +
      '■ 持ち味と活かし方（十神や、多い五行・足りない五行を、才能や注意点として日常語で。五行名を連呼しない）\n' +
      '■ 運気の傾向\n' +
      '■ これからどうすると良いか（最重要・厚めに）… 足りない五行の補い方や、強みの伸ばし方を、仕事・人間関係・習慣の具体的な行動として3つ提案する\n' +
      '全体で800〜1000字程度。「身強／身弱」などの用語はその場で意味を説明すること。';
  } else if (key === 'tarot') {
    instruction =
      'タロットの鑑定文を作ってください。次の見出しで構成します。\n' +
      '■ カード全体が伝えていること\n' +
      '■ 各ポジションのカードの意味（正位置・逆位置を、相談内容に引きつけて噛み砕く）\n' +
      '■ これからどうすると良いか（最重要・厚めに）… 相談内容に対して、今日から取れる具体的な一歩を複数、場面つきで提案する\n' +
      '全体で700〜900字程度。カード名の専門的な含意は日常語で説明すること。';
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
