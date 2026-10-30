// 鑑定文生成のためのプロンプト構築と計算オーケストレーション
import { computeNatalChart, summarizeChart, forecastTransits, summarizeTransits } from './astrology.js';
import { computeFourPillars, summarizeFourPillars } from './fourpillars.js';
import { drawTarot, summarizeTarot } from './tarot.js';
import { computeSeimei, summarizeSeimei } from './seimei.js';
import { computeNumerology, summarizeNumerology } from './numerology.js';
import { computeFengShui, summarizeFengShui } from './fengshui.js';
import { assessRisk, summarizeRisk } from './riskmodel.js';
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
    const transits = forecastTransits(chart, new Date(), 36);
    chart.transits = transits;
    return {
      title: '西洋占星術',
      data: chart,
      material: summarizeChart(chart) + '\n\n' + summarizeTransits(transits),
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
      gender: answers.gender,
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

  if (key === 'seimei') {
    const res = computeSeimei(answers.sei, answers.mei);
    return { title: '姓名判断', data: res, material: summarizeSeimei(res), meta: {} };
  }

  if (key === 'numerology') {
    const d = parseDate(answers.birthDate);
    if (!d) throw new Error('生年月日を読み取れませんでした');
    const res = computeNumerology(d.year, d.month, d.day);
    return { title: '数秘術', data: res, material: summarizeNumerology(res), meta: {} };
  }

  if (key === 'comprehensive') {
    const d = parseDate(answers.birthDate);
    if (!d) throw new Error('生年月日を読み取れませんでした');
    const t = parseTime(answers.birthTime);
    const city = t.known ? resolveCity(answers.birthPlace) : null;

    const chart = computeNatalChart({
      year: d.year, month: d.month, day: d.day, hour: t.hour, minute: t.minute,
      tzOffsetMinutes: JP_TZ, lat: city?.lat, lon: city?.lon, timeKnown: t.known && !!city,
    });
    const transits = forecastTransits(chart, new Date(), 36);
    chart.transits = transits;
    const fp = computeFourPillars({
      year: d.year, month: d.month, day: d.day, hour: t.hour, minute: t.minute,
      tzOffsetMinutes: JP_TZ, timeKnown: t.known, gender: answers.gender,
    });
    const num = computeNumerology(d.year, d.month, d.day);
    let seimei = null;
    if (answers.sei && answers.mei) seimei = computeSeimei(answers.sei, answers.mei);
    const fengshui = computeFengShui(fp.solarYear, answers.gender);
    const risk = assessRisk({ job: answers.job, theme: answers.theme, lifestyle: answers.lifestyle });

    // 本人の状況（占術の入力ではなく、アドバイスを具体化する文脈）
    const ctx = [];
    if (answers.theme) ctx.push(`相談テーマ: ${answers.theme}`);
    if (answers.job) ctx.push(`職業: ${answers.job}`);
    if (answers.tenure) ctx.push(`勤続年数: ${answers.tenure}`);
    if (answers.income) ctx.push(`年収: ${answers.income}`);
    if (answers.lifestyle) ctx.push(`生活・習慣: ${answers.lifestyle}`);

    const parts = [
      '《西洋占星術》\n' + summarizeChart(chart) + '\n' + summarizeTransits(transits),
      '《四柱推命》\n' + summarizeFourPillars(fp),
      '《数秘術》\n' + summarizeNumerology(num),
      '《風水（八宅）》\n' + summarizeFengShui(fengshui),
    ];
    if (seimei && !seimei.error) parts.push('《姓名判断》\n' + summarizeSeimei(seimei));
    if (ctx.length) parts.push('《相談者の状況（文脈）》\n' + ctx.join('\n'));
    parts.push('《統計リスク層》\n' + summarizeRisk(risk));

    return {
      title: '総合鑑定',
      data: {
        astrology: chart, fourpillars: fp, numerology: num, seimei, fengshui, risk,
        context: { theme: answers.theme, job: answers.job, tenure: answers.tenure, income: answers.income, lifestyle: answers.lifestyle },
      },
      material: parts.join('\n\n'),
      meta: { timeKnown: t.known, place: city?.matched || null, hasName: !!seimei },
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
      '西洋占星術の鑑定文を作ってください。「占いと予知の中間」として、今後の見通しを重視します。次の見出しで構成します。\n' +
      '■ あなたという人（太陽・月・アセンダントが分かればその3点を、普段の自分・心の内側・第一印象として噛み砕く）\n' +
      '■ 強みと、少し気をつけたいところ（エレメント/クオリティの偏りも日常語で）\n' +
      '■ この先の見通しと転機【最重要・最も厚く】… 鑑定データのトランジット（時期つき）を必ず使い、「何年何月ごろ、どんなテーマの転機・山場・追い風が来そうか」を時系列で具体的に語る。土星=踏ん張りどき、木星=追い風、天王星=変化、のように噛み砕く。困難が予想される時期は、身構えさせるのではなく備え方とともに伝える\n' +
      '■ その時期をどう活かすか… 近い転機に向けて今日から始められる具体的な準備・行動を3つ、場面つきで\n' +
      '全体で1000〜1200字程度。専門用語には必ず一言の説明を添えること。トランジットのデータにない時期・出来事を創作しないこと。';
  } else if (key === 'fourpillars') {
    instruction =
      '四柱推命の鑑定文を作ってください。「占いと予知の中間」として、大運・流年による今後の時期予測を重視します。日主（あなたの核）・五行バランス・十神・身強身弱・大運・流年を手がかりにします。次の見出しで構成します。\n' +
      '■ あなたの核（日主を、どんな人柄かへ噛み砕いて）\n' +
      '■ 持ち味と活かし方（十神や、多い五行・足りない五行を才能や注意点として日常語で。五行名を連呼しない）\n' +
      '■ これからの運気の流れと転機【最重要・最も厚く】… 大運（10年ごとの流れ）と流年（各年）のデータを必ず使い、「今はどの大運にいて、何歳ごろ・西暦何年ごろにどんな転機や山場、しんどい時期や飛躍の時期が来そうか」を時系列で具体的に語る。官殺の時期＝責任や重圧が増す転機、冲の年＝環境が動く節目、財の年＝成果化のチャンス、のように噛み砕く。困難が予想される時期は備え方とともに伝える\n' +
      '■ その時期をどう活かすか… 近づく転機に向けて、足りない五行の補い方や強みの伸ばし方を、今日から始められる具体的な行動3つとして場面つきで\n' +
      '全体で1000〜1200字程度。「身強／身弱」「大運」「流年」などの用語はその場で意味を説明すること。データにない年や出来事を創作しないこと。';
  } else if (key === 'tarot') {
    instruction =
      'タロットの鑑定文を作ってください。次の見出しで構成します。\n' +
      '■ カード全体が伝えていること\n' +
      '■ 各ポジションのカードの意味（正位置・逆位置を、相談内容に引きつけて噛み砕く）\n' +
      '■ これからどうすると良いか（最重要・厚めに）… 相談内容に対して、今日から取れる具体的な一歩を複数、場面つきで提案する\n' +
      '全体で700〜900字程度。カード名の専門的な含意は日常語で説明すること。';
  } else if (key === 'seimei') {
    instruction =
      '姓名判断の鑑定文を作ってください。次の見出しで構成します。\n' +
      '■ 名前が示すあなた（人格＝中心、地格・外格・総格を日常語で）\n' +
      '■ 強みと気をつけたい面（吉凶と三才の配置を噛み砕く。画数の吉凶は一つの目安として、断定しすぎない）\n' +
      '■ これからどう活かすか（具体的な行動を複数、場面つきで）\n' +
      '全体で600〜800字程度。「五格」「三才」などの用語はその場で説明すること。';
  } else if (key === 'numerology') {
    instruction =
      '数秘術の鑑定文を作ってください。ライフパスナンバーを軸に、次の見出しで構成します。\n' +
      '■ あなたの本質（ライフパス・誕生数を噛み砕く）\n' +
      '■ 持ち味と人生のテーマ\n' +
      '■ これからどう活かすか（具体的な行動を複数、場面つきで）\n' +
      '全体で500〜700字程度。';
  } else if (key === 'comprehensive') {
    instruction =
      'これは占い・統計・風水を統合する「総合鑑定」です。あなたは複数の体系を読める熟練の鑑定士として、' +
      '西洋占星術・四柱推命・数秘術（＋あれば姓名判断）＝宿命と性格、風水（本命卦・吉方位）＝環境、' +
      '統計リスク層＝生活・職業からの傾向、の3種を突き合わせて一つの物語に統合してください。ばらばらに並べないこと。\n' +
      '次の見出しで構成します。\n' +
      '■ 総合的に見たあなた（複数の占術が一致して指す核・強み。どの体系が裏づけるか軽く触れ、専門用語は日常語で）\n' +
      '■ 相談テーマへの見立て（与えられたテーマに、各体系の観点から答える）\n' +
      '■ これからの見通しと転機【重要】… 四柱推命の大運・流年と占星術のトランジットを突き合わせ、「何歳ごろ・西暦何年ごろにどんな転機・山場・追い風が来そうか」を時系列で。複数の占術が同じ時期を指す場合は強調する\n' +
      '■ 分野別のリスクと対策【重要・具体的に】… 身体安全・健康・金銭・対人・メンタル・キャリアの各分野について、' +
      '統計リスク層のスコアと根拠、占いの性質、風水を合わせて「どこに気をつけ、どう下げるか」を書く。' +
      'リスクは運命ではなく“対策で下げられるもの”として前向きに。該当の薄い分野は簡潔でよい。数値（スコア）は絶対的な確率ではなく傾向の目安として扱う\n' +
      '■ 推奨行動とラッキー方位（今日から始められる具体行動を職業・生活に即して3〜5つ。風水の吉方位＝発展・健康・人間関係・安定の方角も、使える場面つきで一言添える）\n' +
      '全体で1400〜1700字程度。データにない出来事・時期・数値を創作しないこと。年収や生活情報は説教や決めつけに使わず、前向きな選択肢と具体的な対策の提案に使うこと。統計リスクは「一般的な傾向の目安」であり断定ではないと必要なら一言添える。';
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
