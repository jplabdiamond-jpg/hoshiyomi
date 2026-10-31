// タロット 計算モジュール（78枚・正逆・スプレッド）
// 暗号学的乱数でシャッフル・ドローする。

const MAJOR = [
  ['愚者', 'The Fool', ['自由', '冒険', '無邪気', '可能性'], ['無計画', '軽率', '優柔不断']],
  ['魔術師', 'The Magician', ['創造', '才能', '意志', '始まり'], ['停滞', '準備不足', '欺き']],
  ['女教皇', 'The High Priestess', ['直感', '知性', '神秘', '潔白'], ['感情的', '秘密', '無知']],
  ['女帝', 'The Empress', ['豊かさ', '母性', '愛情', '実り'], ['浪費', '依存', '停滞']],
  ['皇帝', 'The Emperor', ['支配', '責任', '安定', '父性'], ['独善', '傲慢', '未熟']],
  ['教皇', 'The Hierophant', ['信頼', '慈悲', '規律', '助言'], ['束縛', '偏見', 'おせっかい']],
  ['恋人', 'The Lovers', ['愛', '選択', '調和', '結びつき'], ['不和', '誘惑', '軽率な選択']],
  ['戦車', 'The Chariot', ['勝利', '前進', '意志', '行動力'], ['暴走', '焦り', '方向喪失']],
  ['力', 'Strength', ['勇気', '忍耐', '理性', '克己'], ['弱気', '疑念', '感情的']],
  ['隠者', 'The Hermit', ['探求', '内省', '慎重', '賢明'], ['孤立', '偏屈', '猜疑']],
  ['運命の輪', 'Wheel of Fortune', ['転機', '幸運', 'チャンス', '変化'], ['不運', '停滞', 'タイミングずれ']],
  ['正義', 'Justice', ['公正', '均衡', '誠実', '決断'], ['不正', '偏り', '優柔不断']],
  ['吊るされた男', 'The Hanged Man', ['試練', '忍耐', '視点転換', '献身'], ['徒労', 'self犠牲', '停滞']],
  ['死神', 'Death', ['終わりと再生', '変容', '清算'], ['停滞', '執着', '緩やかな変化']],
  ['節制', 'Temperance', ['調和', '節度', '循環', '自己統御'], ['浪費', '不均衡', '消耗']],
  ['悪魔', 'The Devil', ['欲望', '束縛', '執着', '快楽'], ['解放', '脱却', '欲からの自由']],
  ['塔', 'The Tower', ['崩壊', '激変', '衝撃', '解放'], ['延命した危機', '回避', '内的動揺']],
  ['星', 'The Star', ['希望', '理想', '癒し', 'ひらめき'], ['失望', '理想喪失', '停滞']],
  ['月', 'The Moon', ['不安', '幻想', '直感', '曖昧'], ['不安の解消', '真実の露呈', '回復']],
  ['太陽', 'The Sun', ['成功', '生命力', '祝福', '喜び'], ['停滞', '気力低下', '延期']],
  ['審判', 'Judgement', ['復活', '決断', '覚醒', '再生'], ['後悔', '停滞', 'ためらい']],
  ['世界', 'The World', ['完成', '達成', '統合', '成功'], ['未完', '停滞', 'マンネリ']],
];

const SUITS = [
  { ja: 'ワンド', en: 'Wands', element: '火', theme: '情熱・行動・直感' },
  { ja: 'カップ', en: 'Cups', element: '水', theme: '感情・愛・関係' },
  { ja: 'ソード', en: 'Swords', element: '風', theme: '思考・対立・判断' },
  { ja: 'ペンタクル', en: 'Pentacles', element: '地', theme: '物質・金銭・仕事' },
];
const RANKS = [
  ['エース', 'Ace'], ['2', 'Two'], ['3', 'Three'], ['4', 'Four'], ['5', 'Five'],
  ['6', 'Six'], ['7', 'Seven'], ['8', 'Eight'], ['9', 'Nine'], ['10', 'Ten'],
  ['ペイジ', 'Page'], ['ナイト', 'Knight'], ['クイーン', 'Queen'], ['キング', 'King'],
];

function buildDeck() {
  const deck = [];
  MAJOR.forEach((m, i) => {
    deck.push({
      id: `major-${i}`,
      arcana: '大アルカナ',
      number: i,
      name: m[0],
      en: m[1],
      upright: m[2],
      reversed: m[3],
    });
  });
  SUITS.forEach((s) => {
    RANKS.forEach((r, ri) => {
      deck.push({
        id: `${s.en.toLowerCase()}-${ri}`,
        arcana: '小アルカナ',
        suit: s.ja,
        element: s.element,
        number: ri + 1,
        name: `${s.ja}の${r[0]}`,
        en: `${r[1]} of ${s.en}`,
        theme: s.theme,
      });
    });
  });
  return deck;
}

export const SPREADS = {
  one: { key: 'one', ja: 'ワンオラクル', count: 1, positions: ['あなたへのメッセージ'] },
  three: {
    key: 'three',
    ja: 'スリーカード',
    count: 3,
    positions: ['過去', '現在', '未来'],
  },
  celtic: {
    key: 'celtic',
    ja: 'ケルト十字',
    count: 10,
    positions: [
      '現状',
      '障害・課題',
      '目標・理想',
      '原因（過去の根）',
      '顕在意識',
      '近い未来',
      '本音・自分',
      '周囲の環境',
      '希望と不安',
      '最終結果',
    ],
  },
};

// 暗号学的乱数（Workers / Node 両対応）
function randomInt(max) {
  const g =
    (typeof globalThis !== 'undefined' && globalThis.crypto) || null;
  if (g && g.getRandomValues) {
    const buf = new Uint32Array(1);
    g.getRandomValues(buf);
    return buf[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function shuffle(deck) {
  const a = deck.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * タロットを引く。
 * @param {string} spreadKey 'one' | 'three' | 'celtic'
 * @param {string} [question] 相談内容
 */
export function drawTarot(spreadKey = 'one', question = '') {
  const spread = SPREADS[spreadKey] || SPREADS.one;
  const deck = shuffle(buildDeck());
  const drawn = deck.slice(0, spread.count).map((card, i) => {
    const reversed = randomInt(2) === 1;
    const keywords =
      card.arcana === '大アルカナ'
        ? reversed
          ? card.reversed
          : card.upright
        : [card.theme];
    return {
      position: spread.positions[i],
      name: card.name,
      en: card.en,
      arcana: card.arcana,
      number: card.number, // 大アルカナ=0〜21 / 小アルカナ=ランク1〜14
      suit: card.suit || null,
      element: card.element || null,
      orientation: reversed ? '逆位置' : '正位置',
      keywords,
    };
  });
  return { spread: spread.ja, question, cards: drawn };
}

export function summarizeTarot(result) {
  const lines = [`スプレッド: ${result.spread}`];
  if (result.question) lines.push(`相談内容: ${result.question}`);
  result.cards.forEach((c, i) => {
    lines.push(
      `${i + 1}. [${c.position}] ${c.name}（${c.orientation}）… ${c.keywords.join('・')}`
    );
  });
  return lines.join('\n');
}
