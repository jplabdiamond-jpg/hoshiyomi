// 数秘術 計算モジュール（生年月日ベース：ライフパス・誕生数）
const MEANINGS = {
  1: ['リーダー', '独立心が強く、自分で道を切り拓く開拓者。'],
  2: ['協調', '人と人をつなぐ調整役。繊細で思いやりがある。'],
  3: ['表現', '明るく創造的。楽しませる才能と発信力。'],
  4: ['安定', '堅実で努力家。基盤をコツコツ築く職人気質。'],
  5: ['自由', '好奇心旺盛で変化を好む。行動力と適応力。'],
  6: ['愛と責任', '面倒見がよく家庭的。人を支え育てる役割。'],
  7: ['探究', '内省的で分析好き。専門性を深める研究者肌。'],
  8: ['実現', '野心と現実力。組織や経済で成果を出す力。'],
  9: ['博愛', '広い視野と奉仕精神。理想を掲げる完成者。'],
  11: ['直感（マスター）', '感受性と直感が鋭い。人を導くひらめきの人。'],
  22: ['実現力（マスター）', '大きな理想を現実の形にする構築者。'],
  33: ['無償の愛（マスター）', '深い慈愛で多くの人を包む稀有な数。'],
};

function reduce(n, keepMaster = true) {
  while (n > 9 && !(keepMaster && (n === 11 || n === 22 || n === 33))) {
    n = String(n).split('').reduce((a, d) => a + +d, 0);
  }
  return n;
}

/**
 * 数秘術（生年月日ベース）を計算。
 * @param {number} year @param {number} month @param {number} day
 */
export function computeNumerology(year, month, day) {
  const digitSum = (String(year) + String(month) + String(day))
    .split('').reduce((a, d) => a + +d, 0);
  const lifePath = reduce(digitSum);
  const birthDay = reduce(day);
  return {
    lifePath: { number: lifePath, title: MEANINGS[lifePath][0], desc: MEANINGS[lifePath][1] },
    birthDay: { number: birthDay, title: MEANINGS[birthDay][0], desc: MEANINGS[birthDay][1] },
  };
}

export function summarizeNumerology(n) {
  return [
    `ライフパスナンバー: ${n.lifePath.number}（${n.lifePath.title}）… ${n.lifePath.desc}`,
    `誕生数: ${n.birthDay.number}（${n.birthDay.title}）… ${n.birthDay.desc}`,
  ].join('\n');
}
