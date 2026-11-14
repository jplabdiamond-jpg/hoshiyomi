// 鑑定文生成のためのプロンプト構築と計算オーケストレーション
import { computeNatalChart, summarizeChart, forecastTransits, summarizeTransits } from './astrology.js';
import { computeFourPillars, summarizeFourPillars } from './fourpillars.js';
import { drawTarot, summarizeTarot } from './tarot.js';
import { computeSeimei, summarizeSeimei } from './seimei.js';
import { computeNumerology, summarizeNumerology } from './numerology.js';
import { computeFengShui, summarizeFengShui } from './fengshui.js';
import { assessRisk, summarizeRisk } from './riskmodel.js';
import { computeProfileScore, summarizeProfileScore } from './profilescore.js';
import { computeForesight, summarizeForesight } from './foresight.js';
import { getDivination, resolveCity, parseDate, parseTime } from './divinations.js';
import { PALMISTRY_REFERENCE } from './palmistry.js';
import { rectifyBirthTime } from './rectify.js';
import { computeTiming, summarizeTiming } from './timing.js';

const JP_TZ = 540; // 日本標準時（分）

// 過去の転機入力を正規化：[{cat, year, month?}] の配列にする（文字列/配列どちらでも受ける）
function parsePastEvents(raw) {
  if (!raw) return [];
  let arr = raw;
  if (typeof raw === 'string') { try { arr = JSON.parse(raw); } catch { return []; } }
  if (!Array.isArray(arr)) return [];
  return arr.map((e) => ({
    cat: (e && e.cat) ? String(e.cat) : 'other',
    year: Number(e && e.year) || 0,
    month: e && e.month ? Number(e.month) : null,
  })).filter((e) => e.year >= 1900 && e.year <= 2100).slice(0, 3);
}

// 入力(answers) → 計算結果 + LLM用素材
// opts.calibWeights: 占術→実測重み（④）。無ければ全て中立（1.0）。
export function computeDivination(key, answers, opts = {}) {
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

  if (key === 'palm') {
    // 画像からの特徴抽出（ビジョンモデルの結果）。features=利き手、features2=反対の手（任意）
    const features = (opts.features || '').trim();
    const features2 = (opts.features2 || '').trim();
    const left = answers.hand === 'left';
    const domLabel = left ? '左手（利き手＝今の自分・努力で培ったもの・これからの運）' : '右手（利き手＝今の自分・努力で培ったもの・これからの運）';
    const othLabel = left ? '右手（反対の手＝生まれ持った性質・素質）' : '左手（反対の手＝生まれ持った性質・素質）';
    const bothHands = !!features2;
    const parts = [`《${domLabel}の観察》\n${features || '（特徴を読み取れませんでした）'}`];
    if (bothHands) parts.push(`《${othLabel}の観察》\n${features2}`);
    const ctx = [`利き手: ${left ? '左利き' : '右利き'}`, `写真: ${bothHands ? '両手' : '利き手のみ'}`];
    if (answers.question) ctx.push(`相談者が気にしていること: ${answers.question}`);
    parts.push(`《文脈》\n${ctx.join('\n')}`);
    return {
      title: '手相',
      data: { features, features2: features2 || null, bothHands, hand: answers.hand || null, question: answers.question || null },
      material: parts.join('\n\n'),
      meta: { hand: answers.hand || null, bothHands },
    };
  }

  if (key === 'comprehensive' || key === 'comprehensive_plus') {
    const d = parseDate(answers.birthDate);
    if (!d) throw new Error('生年月日を読み取れませんでした');
    let t = parseTime(answers.birthTime);
    const city = resolveCity(answers.birthPlace); // 時刻不明でもレクティフィケーションに使うため常に解決
    const pastEv = parsePastEvents(answers.pastEvents);

    // 出生時刻レクティフィケーション：時刻不明＋出生地＋過去の転機があれば、過去の出来事に
    // 最も合う出生時刻を逆推定する。確信度が十分な時だけアセンダント/MC・ハウスを有効化し
    // （低確信度の角度は誤差を持ち込むため採用しない）、鑑定文には確度に応じた断りを入れる。
    const RECT_APPLY = 0.3;   // これ以上かつAM/PM解決時のみASC/MC/ハウスを採用
    const RECT_MENTION = 0.08; // これ以上なら「推定の目安」として言及（角度は未採用）
    let rectified = null;
    if (!t.known && city && pastEv.length) {
      try {
        const r = rectifyBirthTime({ year: d.year, month: d.month, day: d.day, lat: city.lat, lon: city.lon, events: pastEv });
        if (r && r.confidence >= RECT_MENTION) {
          // 時刻依存の角度（ASC/MC/ハウス）は、確信度が十分で かつ 昼夜が確定している時だけ採用
          r.applied = r.confidence >= RECT_APPLY && r.amPmResolved;
          if (r.applied) { t = { known: true, hour: r.hour, minute: r.minute }; }
          rectified = r;
        }
      } catch { /* 推定失敗時は従来どおり時刻なしで続行 */ }
    }

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
    // ① 個人タイミング（プロフェクション／進行／ソーラーアーク／個人天体トランジット／空亡・十二運）
    const timing = computeTiming({ chart, fp, now: new Date() });
    const risk = assessRisk(answers);
    const profile = computeProfileScore({
      risk, fp, chart, seimei, numerology: num,
      nowYear: fp.nowYear, birthYear: d.year,
    });
    const now = new Date();
    const foresight = computeForesight({
      fp, chart, birthYear: d.year, birthMonth: d.month, birthDay: d.day,
      gender: answers.gender, nowYear: now.getFullYear(), nowMonth: now.getMonth() + 1,
      profileNet: profile.net, calibWeights: opts.calibWeights || {}, specTable: opts.specTable || {},
      pastEvents: parsePastEvents(answers.pastEvents),
      timingSignals: timing.timingSignals,
    });

    // 本人の状況（占術の入力ではなく、アドバイスを具体化する文脈）
    const ctx = [];
    if (answers.theme) ctx.push(`相談テーマ: ${answers.theme}`);
    if (answers.job) ctx.push(`職業: ${answers.job}`);
    if (answers.tenure) ctx.push(`勤続年数: ${answers.tenure}`);
    if (answers.income) ctx.push(`年収: ${answers.income}`);
    if (answers.lifestyle) ctx.push(`生活・習慣: ${answers.lifestyle}`);

    // タロット（ケルト十字・10枚）: 相談テーマを問いに引き、星・命式・統計と“擦り合わせる”象徴（今の状況・心模様）の層。
    // ジャーニー中に見せた札と一致させるため、answers.tarotSeed があれば同じ種から再現する
    const tSeed = Number.isFinite(answers.tarotSeed) ? answers.tarotSeed : null;
    const tarot = drawTarot('celtic', answers.theme || '', tSeed);

    const parts = [
      '《西洋占星術》\n' + summarizeChart(chart) + '\n' + summarizeTransits(transits),
      '《四柱推命》\n' + summarizeFourPillars(fp),
      '《数秘術》\n' + summarizeNumerology(num),
      '《風水（八宅）》\n' + summarizeFengShui(fengshui),
      '《タロット（ケルト十字・10枚）》\n' + summarizeTarot(tarot),
    ];
    if (seimei && !seimei.error) parts.push('《姓名判断》\n' + summarizeSeimei(seimei));
    // 手相（両手）。checkoutで抽出済みの特徴テキストを opts.features / opts.features2 で受け取る
    const palmF = (opts.features || '').trim();
    const palmF2 = (opts.features2 || '').trim();
    if (palmF) {
      const left = answers.hand === 'left';
      const domL = left ? '左手（利き手＝今の自分・後天）' : '右手（利き手＝今の自分・後天）';
      const othL = left ? '右手（反対の手＝生まれ持った性質）' : '左手（反対の手＝生まれ持った性質）';
      let pm = `《手相》\n【${domL}の観察】\n${palmF}`;
      if (palmF2) pm += `\n\n【${othL}の観察】\n${palmF2}`;
      parts.push(pm);
    }
    if (ctx.length) parts.push('《相談者の状況（文脈）》\n' + ctx.join('\n'));
    parts.push('《統計リスク層》\n' + summarizeRisk(risk));
    parts.push('《分野別の偏差（統計＋占いを合算した、平均からのズレ）》\n' + summarizeProfileScore(profile));
    parts.push('《未来予測（流月・パーソナルイヤー・節目・合致点）》\n' + summarizeForesight(foresight));
    parts.push('《個人タイミング（プロフェクション・二次進行・ソーラーアーク・個人天体トランジット・ソーラー/ルナーリターン・空亡/十二運）》\n' + summarizeTiming(timing));
    if (rectified) {
      const hh = String(rectified.hour).padStart(2, '0'), mm = String(rectified.minute).padStart(2, '0');
      const win = rectified.windowMin >= 60 ? `±${Math.round(rectified.windowMin / 60 * 10) / 10}時間` : `±${rectified.windowMin}分`;
      const conf = rectified.confidence >= 0.5 ? '高め' : rectified.confidence >= 0.3 ? '中程度' : '低め';
      if (rectified.applied) {
        parts.push(`《鑑定の補足》\n出生時刻が未入力のため、申告された過去の転機に最もよく合う時刻（推定 ${hh}:${mm} 前後 ${win}／確度${conf}）でアセンダント等を算出しています。鑑定文の中で一度だけ軽く「出生時刻は過去の出来事から推定しました（より正確な時刻が分かると精度が上がります）」と断りを入れ、時刻に依存する読み（アセンダント・ハウス・ASC/MCへの転機）は“推定に基づく参考”として扱うこと。`);
      } else {
        parts.push(`《鑑定の補足》\n出生時刻は未入力。過去の転機からの推定では ${hh}:${mm} 前後（${win}・確度${conf}）が候補だが、決め手が弱いためアセンダント・ハウスは用いず、時刻に依存しない読み（星座・四柱・数秘など）で鑑定している。鑑定文の最後で一度だけ「出生時刻が分かるとアセンダントやハウスまで踏み込め、さらに精度が上がります」と自然に添えること。時刻や推定時刻の数字そのものは本文に書かないこと。`);
      }
    }

    return {
      title: '総合鑑定',
      data: {
        astrology: chart, fourpillars: fp, numerology: num, seimei, fengshui, risk, profile, foresight, timing,
        tarot: { spread: tarot.spread, cards: tarot.cards },
        context: { theme: answers.theme, job: answers.job, tenure: answers.tenure, income: answers.income, lifestyle: answers.lifestyle },
      },
      material: parts.join('\n\n'),
      meta: { timeKnown: t.known, place: city?.matched || null, hasName: !!seimei, rectified: rectified ? { hour: rectified.hour, minute: rectified.minute, confidence: rectified.confidence, applied: rectified.applied, windowMin: rectified.windowMin } : null },
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
    '・解説・読み解きの地の文は、文の長さや始まり方に変化をつけた“文章”で書く。温かく、前向きに、しかし中身のある言葉で。\n' +
    '・ただし、行動・対策・アドバイス・気をつける点など「複数の実践項目」を挙げるときは、長い文章で続けず、各項目を改行して行頭「・」で始まる短い箇条書きにする（1項目1〜2文）。手順や順序があるものは「1. 」「2. 」と番号を付ける。読み手がひと目で要点を拾えるようにする。\n' +
    '・全体を箇条書きだけで埋めない。「見た立て・読み解き（文章）」＋「やること（箇条書き）」の組み合わせで、長文を読みやすく区切る。\n' +
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
      'タロットの鑑定文を、やさしく短めに作ってください。次の2つの見出しだけで構成します（見出しは■も含めてこの文言を一字一句そのまま使う）。\n' +
      '■ カードが教えてくれること\n' +
      '（引いたカード全体と各ポジションの流れを、相談内容に引きつけて2〜4文で。カード名は「愚者」「恋人」「運命の輪」のように日本語の通称で呼び、正位置・逆位置のニュアンスも一言添える。専門用語は避ける）\n' +
      '■ これから意識するとよいこと\n' +
      '（相談内容に対して、今日から取れる具体的な一歩を2つほど、場面つきで）\n' +
      '全体で350〜450字程度。簡潔に、温かく、断定しすぎないこと。';
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
  } else if (key === 'palm') {
    instruction =
      '手相の鑑定文を作ってください。手順は厳密に次の通り:\n' +
      '(1) 下の【手相リファレンス】は、手相の「特徴→意味」の対応辞書です。\n' +
      '(2) 鑑定データの「手相の観察」に書かれた“実際に写真から見えた特徴”だけを取り上げ、その一つひとつをリファレンスの該当項目に照合して意味を導く。\n' +
      '(3) 観察に無い線・印は一切語らない（創作禁止）。「不明瞭」とある項目は触れない。\n' +
      '(4) 【両手がある場合】利き手＝今の自分・努力で培ったもの・これからの運、反対の手＝生まれ持った性質・素質。両手を突き合わせ、「生まれ持った素質（反対の手）→ 今の姿（利き手）」の流れで語り、左右で違う特徴があれば“そこがあなたが成長・変化した点”として具体的に描く（例: 反対の手では知能線が短め＝元々は直感型だが、利き手では長く伸びて熟慮型に育っている）。似ている点は“生来の資質をまっすぐ活かせている強み”として語る。利き手だけの場合は、それを今の総合的な手相として読む。\n\n' +
      '【絶対の禁止事項】誰にでも当てはまる一般論・曖昧な性格描写は禁止。例えば「あなたは優しいが芯がある」「情熱と冷静さを併せ持つ」のような、どんな人にも言える文は書かないこと。' +
      '必ず「観察された具体的な特徴（例: 知能線が小指の下まで長く下へカーブ）」→「その特徴が示す具体的な意味（例: 想像力が豊かで企画や創作に向く）」という形で、特徴を名指しして根拠とセットで述べること。\n\n' +
      '次の見出しで構成します。\n' +
      '■ 手に表れたあなた（手の形の分類と、生命線・知能線・感情線の“観察された具体的な形状”から、気質と強みを。各段落は必ず「〜という線（特徴）があるので、〜」と特徴起点で書く。手相用語はその場で一言説明）\n' +
      '■ 線が語る運の流れ（運命線・太陽線・財運線・結婚線・丘・特殊な印のうち“観察されたもの”から、仕事・金運・人間関係・愛情・転機を具体的に。観察に「線の上/中/下のどこに切れ・島・支線がある」と位置が分かるものがあれば、リファレンスの流年に従って「◯代ごろ」と時期を添える。見えなかった線は「今回は読み取れなかった」と一言添える程度でよい）\n' +
      '■ これから活かすとよいこと（相談内容があればそこへ寄せ、上で読んだ手相の強み・課題に紐づけた具体的な行動を2〜3つ、場面つきで）\n' +
      '全体で700〜1000字程度。手相は生き方で変わるものとして温かく前向きに、しかし中身は具体的に。断定しすぎない。\n' +
      'もし観察データが「[NOT_PALM]」や「手のひらがはっきり写っていない」旨を示す場合は、占わず、明るい場所で手のひら全体を撮り直すと精度が上がる、とやさしく案内する一文だけにすること。\n\n' +
      '【手相リファレンス】\n' + PALMISTRY_REFERENCE;
  } else if (key === 'comprehensive' || key === 'comprehensive_plus') {
    instruction =
      'これは占い・統計・風水を統合する「総合鑑定」です。あなたは複数の体系を同時に読み解ける熟練の鑑定士であり、' +
      '単なる占い師ではなく「複数の星回りと運命のリズムが同じ時期を指したときにだけ、その時を“視える”人」として語ってください。' +
      '西洋占星術・四柱推命・数秘術（＋あれば姓名判断）＝宿命と性格、手相（両手）＝生まれ持った性質と今の自分、風水（本命卦・吉方位）＝環境、統計リスク層＝生活・職業の傾向を、' +
      'ばらばらに並べず一つの物語へ統合します。\n' +
      '【手相の扱い】手相データがある場合、利き手＝今の自分・後天、反対の手＝生来の性質として読み、他の占術が示す性格・強みと一致する点は「星や命式と手相が同じことを指している＝確かな強み/傾向」として裏づけに使う（性格面のコンバージェンス）。左右で違う点があれば「生来→今の成長・変化」として性格像に厚みを足す。手相は時期（何年）には使わない。\n' +
      '【タロット（ケルト十字）の扱い・最重要の“擦り合わせ”】タロットのデータがある場合、10枚のケルト十字（現状／障害・課題／目標・理想／原因＝過去の根／顕在意識／近い未来／本音・自分／周囲の環境／希望と不安／結末）を「“今この瞬間”の状況・心模様・相談テーマの力学」を映す象徴の層として読む。これを単独で並べるのではなく、必ず星・命式・数秘・統計・合致窓の見立てと突き合わせて“擦り合わせた結論”を出すこと:\n' +
      '  ・一致する点＝「複数の体系とカードが同じことを指している」として確信を一段強める（例:「星の巡りも、引かれた“運命の輪”も、同じ追い風を示しています」）。\n' +
      '  ・食い違う点＝「ここに“今の揺れ・選択の分岐”がある」として、どちらに転ぶかの鍵と、本人が選び取れる余地を示す。矛盾を隠さず、むしろ見どころとして語る。\n' +
      '  ・「近い未来」「結末」のカードは、直近の合致窓（時期つきの転機）の読みと重ねて、“何が起こりやすいか”の象徴的な補強に使う。ただしタロットは象徴・心理・状況の読みに使い、具体的な時期（何年何月）はあくまで星と命式の合致窓が担当する（カードから日付を創作しない）。\n' +
      '  ・カード名は「愚者」「恋人」「運命の輪」のように日本語の通称で呼び、正位置・逆位置のニュアンスを一言添える。星や命式にない出来事をカードから創作しない。\n' +
      '次の見出しで構成します。\n' +
      '■ 総合的に見たあなた（複数の占術＋手相が一致して指す核・強み。どの体系が裏づけるか軽く触れ、専門用語は日常語で）\n' +
      '■ 相談テーマへの見立て（与えられたテーマに、各体系＋タロット（ケルト十字）を突き合わせて一つの答えとして。引かれたカードの要（とくに「現状」「障害・課題」「近い未来」「結末」）を2〜3枚名指しで引用し、星・命式・数秘・統計の見立てと「一致する点／食い違う点」を具体的に示して“擦り合わせた結論”を出す。食い違いがあればそれ自体を選択の分岐として語る）\n' +
      '■ これから訪れる転機【最重要・最も厚く・ここが鑑定の核心】…\n' +
      '  「合致窓」データ（複数の占術が同じ時期を指し示す、確度つきの転機の窓）を主役にして、未来を“視る”ように時系列で語る。手順は次の通り:\n' +
      '  (1) 各窓を時期の早い順に並べ、必ず「◯年◯月上旬〜中旬ごろ」のようにデータにある日付レンジと山場で具体的に名指しする。ぼかさない。\n' +
      '  (2) 確度(高/中/低)と「何系統の占術が重なっているか」を自信の根拠として言葉にする。例:「星の巡りと生まれ持った運のリズム、二つが同じ春を指しています。これはかなり確かな転機です」。確度“高”の窓は断定に近いトーンで、確度“低”は「兆し」程度に弱める。\n' +
      '  (3) 各窓で何が動くかを、データの「領域」（キャリア/金銭/対人/健康/メンタル/身体安全）と結びつけ、生活の具体的な情景として描く。例:「人を介した新しい話が舞い込む」「責任ある立場を任される」。領域に“もともと注意／もともと強い”の注記があれば、本人の傾向に重ねて語る。\n' +
      '  (4) 追い風の窓は活かし方を、要注意の窓は不安を煽らず「備えれば越えられるもの」として備え方を添える。\n' +
      '  (5) 「個人タイミング」データ（プロフェクション＝今年の主題、二次進行の月＝今の感情の季節、ソーラーアーク＝人生の設計図が動く年、個人天体トランジット＝この数ヶ月の具体日、ソーラー/ルナーリターン、空亡・十二運）を必ず織り込み、合致窓を補強する。とくに個人天体トランジットの「◯月◯日ごろ」は“あなた固有の具体日”として1〜2個を名指しで示し、汎用的な一般論に流れないようにする。プロフェクションの「今年は◯ハウス期」と流月・合致窓を結びつけて、今年一年のストーリーの軸にする。\n' +
      '  中長期は「年単位の合致点」、人生の大きな山場はサターンリターン等の節目に触れる。データにない時期・出来事は決して創作しない。\n' +
      '■ 分野別のリスクと対策【重要・具体的に】… 「分野別の偏差」データ（平均=0からのズレ＝統計＋占いの合算）を軸に、偏差が大きい分野から順に。' +
      '各分野で「平均よりどれくらい・なぜズレているか（生活/職業の統計要因か、占いの要因か）」を一言で示し、マイナスは具体的な戻し方、プラスは活かし方を。偏差0は省略可。数値は傾向の目安として扱う。\n' +
      '■ 推奨行動とラッキー方位（今日から始められる具体行動を職業・生活に即して3〜5つ。直近の合致窓に向けた準備を必ず1つ含める。風水の吉方位も使える場面つきで一言）\n' +
      '全体で1500〜1900字程度。「視える」口調は転機のパートで活かし、全体は温かく前向きに。最後は相談者が自分で選べる形の助言で締める。' +
      'データにない出来事・時期・数値を創作しないこと。年収や生活情報は説教や決めつけに使わず、前向きな選択肢と対策の提案に使う。確度や統計は「複数の占術・傾向が重なった度合いの目安」であり絶対の予言ではないと、鑑定の自然な流れの中で一言添える。';
    // ② 行動データによる個人化：同じ運気でも助言の出し方を本人仕様に調整
    const bt = [];
    const ds = { bold: '相談者は「チャンスは積極的に攻めたい」タイプ。追い風の窓は踏み込んだ一手まで提案し、要注意の窓も“止める”より“攻め方を変える/守りを一点だけ固める”形で。', balanced: '相談者は「状況を見て柔軟に」タイプ。攻めと守りを両天秤で、判断材料を示して本人が選べる形に。', cautious: '相談者は「リスクは抑えて堅実に」タイプ。まず守り・備えを厚く、攻めは小さく試す形で無理なく。' }[answers.decisionStyle];
    const cap = { slack: '今は新しいことに動ける余力あり。直近の合致窓に向けて踏み込んだ準備も提案してよい。', normal: '', busy: '今はかなり多忙で余力が少ない。推奨行動は負担の軽い順に1〜2個へ厳選し、“やめること・手放すこと”も1つ示す。' }[answers.capacity];
    if (ds) bt.push(ds);
    if (cap) bt.push(cap);
    if (answers.focus) bt.push(`相談者が最も視てほしい分野は「${answers.focus}」。この分野を「これから訪れる転機」と「分野別のリスクと対策」で最優先に、他分野より一段厚く掘り下げる（ただし他分野を無視はしない）。`);
    if (bt.length) instruction += '\n\n【相談者に合わせた出し方（必ず反映）】\n' + bt.map((x) => '・' + x).join('\n');
  }

  // 画像base64など巨大な値はプロンプトに入れない（トークン超過の原因になる）
  const safeAnswers = { ...answers };
  if (safeAnswers.palmImage) safeAnswers.palmImage = '[利き手の写真アップロード済み]';
  if (safeAnswers.palmImage2) safeAnswers.palmImage2 = '[反対の手の写真アップロード済み]';
  for (const k of Object.keys(safeAnswers)) {
    if (typeof safeAnswers[k] === 'string' && safeAnswers[k].length > 500) safeAnswers[k] = safeAnswers[k].slice(0, 500) + '…';
  }

  const user =
    `【占術】${computed.title}\n【相談者の入力】${JSON.stringify(safeAnswers)}\n\n` +
    `【鑑定データ（確定値・この範囲で解釈すること）】\n${computed.material}\n\n` +
    `【依頼】\n${instruction}`;

  return [
    { role: 'system', content: common },
    { role: 'user', content: user },
  ];
}

// 期待される見出し（LLMが稀に漢字を誤変換・欠落させるため、近い見出し行を正規に補正）
const EXPECTED_HEADINGS = {
  astrology: ['あなたという人', '強みと、少し気をつけたいところ', 'この先の見通しと転機', 'その時期をどう活かすか'],
  fourpillars: ['あなたの核', '持ち味と活かし方', 'これからの運気の流れと転機', 'その時期をどう活かすか'],
  tarot: ['カードが教えてくれること', 'これから意識するとよいこと'],
  seimei: ['名前が示すあなた', '強みと気をつけたい面', 'これからどう活かすか'],
  numerology: ['あなたの本質', '持ち味と人生のテーマ', 'これからどう活かすか'],
  palm: ['手に表れたあなた', '線が語る運の流れ', 'これから活かすとよいこと'],
  comprehensive: ['総合的に見たあなた', '相談テーマへの見立て', 'これからの見通しと転機', '分野別のリスクと対策', '推奨行動とラッキー方位'],
};

function bigrams(s) {
  const a = new Set();
  for (let i = 0; i < s.length - 1; i++) a.add(s.slice(i, i + 2));
  return a;
}
function dice(a, b) {
  if (!a.length || !b.length) return 0;
  const A = bigrams(a), B = bigrams(b);
  if (!A.size || !B.size) return a === b ? 1 : 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return (2 * inter) / (A.size + B.size);
}

// 鑑定文の軽い後処理：見出し行を期待見出しにスナップし、他言語文字を除去
export function cleanReading(key, text) {
  if (!text) return text;
  const base = key === 'comprehensive_plus' ? 'comprehensive' : key;
  const heads = EXPECTED_HEADINGS[base] || [];
  const lines = text.replace(/\r/g, '').split('\n').map((line) => {
    // ハングル・キリル等の明らかな他言語文字を除去（日本語・英数・記号は保持）
    let l = line.replace(/[가-힣Ѐ-ӿ฀-๿]/g, '');
    const m = l.match(/^\s*[■●▪・]+\s*(.+?)\s*$/);
    if (m && heads.length) {
      const body = m[1].replace(/[（(].*$/, '').trim();
      let best = '', score = 0;
      for (const h of heads) { const s = dice(body, h); if (s > score) { score = s; best = h; } }
      if (score >= 0.5) return '■ ' + best;
    }
    return l;
  });
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export const DISCLAIMER =
  '※本鑑定は占術に基づく参考情報であり、娯楽・自己理解の目的でご利用ください。重要な判断はご自身の責任で行ってください。';
