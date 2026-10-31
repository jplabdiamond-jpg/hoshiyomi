// Sibylla Vision — タロット絵柄（ゴールド線画SVG・外部画像なし）
// 小アルカナ: スート記号のピップ配置 / 大アルカナ: 22枚それぞれ固有の象徴
(() => {
  const f = (v) => Math.round(v * 10) / 10;
  const pt = (cx, cy, r, deg) => {
    const a = (deg * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };
  function starPath(cx, cy, rO, rI, n, rot = -90) {
    let d = '';
    for (let i = 0; i < n; i++) {
      const [ox, oy] = pt(cx, cy, rO, rot + (i * 360) / n);
      const [ix, iy] = pt(cx, cy, rI, rot + ((i + 0.5) * 360) / n);
      d += (i ? 'L' : 'M') + f(ox) + ' ' + f(oy) + 'L' + f(ix) + ' ' + f(iy);
    }
    return d + 'Z';
  }
  function rays(cx, cy, rI, rO, n, rot = 0) {
    let d = '';
    for (let i = 0; i < n; i++) {
      const [x1, y1] = pt(cx, cy, rI, rot + (i * 360) / n);
      const [x2, y2] = pt(cx, cy, rO, rot + (i * 360) / n);
      d += 'M' + f(x1) + ' ' + f(y1) + 'L' + f(x2) + ' ' + f(y2);
    }
    return d;
  }

  const SUIT_KEY = { 'ワンド': 'wand', 'カップ': 'cup', 'ソード': 'sword', 'ペンタクル': 'pentacle' };

  function suit(key, cx, cy, s) {
    const g = (d) => `<g transform="translate(${f(cx)} ${f(cy)}) scale(${s})">${d}</g>`;
    if (key === 'sword') return g('<path d="M0 6.4 V-5 l1.6 1.7 M0 -5 l-1.6 1.7"/><path d="M-2.8 3.4 H2.8"/><path d="M0 3.4 V6.6"/>');
    if (key === 'cup') return g('<path d="M-3.4 -4 H3.4 A3.4 3.4 0 0 1 -3.4 -4 Z"/><path d="M0 -0.6 V3.6"/><path d="M-2.7 4.8 H2.7"/>');
    if (key === 'wand') return g('<path d="M0 6.4 V-2"/><path d="M0 -2 C1.3 -3.6 1.7 -5.2 1.5 -6.6 C0.2 -5.8 -0.4 -4.1 0 -2"/><path d="M0 -2 C-1.3 -3.6 -1.7 -5.2 -1.5 -6.6 C-0.2 -5.8 0.4 -4.1 0 -2"/>');
    if (key === 'pentacle') return g(`<circle r="4.4"/><path d="${starPath(0, 0, 3, 1.25, 5)}"/>`);
    return g('<circle r="3"/>');
  }

  const PIPS = {
    2: [[.5, .3], [.5, .72]],
    3: [[.5, .22], [.5, .5], [.5, .78]],
    4: [[.33, .3], [.67, .3], [.33, .72], [.67, .72]],
    5: [[.3, .28], [.7, .28], [.5, .5], [.3, .74], [.7, .74]],
    6: [[.33, .26], [.67, .26], [.33, .5], [.67, .5], [.33, .76], [.67, .76]],
    7: [[.33, .22], [.67, .22], [.5, .37], [.33, .54], [.67, .54], [.33, .8], [.67, .8]],
    8: [[.33, .2], [.67, .2], [.33, .4], [.67, .4], [.33, .62], [.67, .62], [.33, .82], [.67, .82]],
    9: [[.3, .22], [.5, .22], [.7, .22], [.3, .5], [.5, .5], [.7, .5], [.3, .78], [.5, .78], [.7, .78]],
    10: [[.33, .18], [.67, .18], [.5, .3], [.33, .42], [.67, .42], [.33, .62], [.67, .62], [.5, .74], [.33, .86], [.67, .86]],
  };

  function crownPointed(cx, cy, w) {
    const l = cx - w, r = cx + w, b = cy + 5, t = cy - 7;
    return `<path d="M${l} ${b} L${l} ${t - 1} L${cx - w / 2} ${cy - 1} L${cx} ${t - 3} L${cx + w / 2} ${cy - 1} L${r} ${t - 1} L${r} ${b} Z"/><path d="M${l} ${b} H${r}"/><circle cx="${l}" cy="${t - 1}" r="1"/><circle cx="${cx}" cy="${t - 3}" r="1.1"/><circle cx="${r}" cy="${t - 1}" r="1"/>`;
  }
  function crownRounded(cx, cy, w) {
    const l = cx - w, r = cx + w, b = cy + 5, t = cy - 4;
    return `<path d="M${l} ${b} L${l} ${t} Q${cx - w / 2} ${t - 5} ${cx - w / 2} ${t} Q${cx} ${t - 6} ${cx} ${t} Q${cx + w / 2} ${t - 5} ${cx + w / 2} ${t} Q${r} ${t - 5} ${r} ${t} L${r} ${b} Z"/><path d="M${l} ${b} H${r}"/>`;
  }

  function court(key, rank) {
    const s = suit(key, 30, 58, 1.2);
    const cx = 30, cy = 34;
    let top = '';
    if (rank === 11) top = `<circle cx="${cx}" cy="${cy - 6}" r="3.6"/><path d="M${cx - 6.5} ${cy + 9} Q${cx} ${cy - 2.5} ${cx + 6.5} ${cy + 9} Z"/>`;
    else if (rank === 12) top = `<path d="M${cx - 6} ${cy + 7} Q${cx - 7.5} ${cy - 8} ${cx} ${cy - 8} Q${cx + 7.5} ${cy - 8} ${cx + 6} ${cy + 7} Z"/><path d="M${cx - 4} ${cy - 2} H${cx + 5}"/><path d="M${cx - 4} ${cy + 2.5} H${cx + 3}"/>`;
    else if (rank === 13) top = crownRounded(cx, cy, 8);
    else top = crownPointed(cx, cy, 8);
    return top + s;
  }

  function minor(key, rank) {
    if (rank >= 11) return court(key, rank);
    const pos = PIPS[rank] || [[.5, .5]];
    const sc = rank <= 1 ? 1.5 : rank <= 3 ? 1.15 : rank <= 6 ? 0.92 : rank <= 8 ? 0.78 : 0.64;
    let g = '';
    if (rank === 1) g += `<g opacity=".45"><path d="${rays(30, 42, 8.5, 13.5, 16)}"/></g>`;
    for (const [fx, fy] of pos) g += suit(key, 14 + fx * 32, 16 + fy * 52, sc);
    return g;
  }

  // ---- 大アルカナ 22枚 ----
  const C = 30, M = 42; // 画面中心
  const heart = (cx, cy, s) => `<path d="M${cx} ${cy + 4 * s} C${cx - 5 * s} ${cy} ${cx - 4 * s} ${cy - 4 * s} ${cx} ${cy - 1.5 * s} C${cx + 4 * s} ${cy - 4 * s} ${cx + 5 * s} ${cy} ${cx} ${cy + 4 * s} Z"/>`;
  const moon = (cx, cy, r) => `<path d="M${cx + r * 0.3} ${cy - r} A${r} ${r} 0 1 0 ${cx + r * 0.3} ${cy + r} A${r * 0.78} ${r * 0.78} 0 1 1 ${cx + r * 0.3} ${cy - r} Z"/>`;

  const MAJOR = {
    0: `<circle cx="42" cy="24" r="3"/><path d="${rays(42, 24, 3.6, 5.8, 10)}"/><path d="M19 62 L41 31"/><path d="M41 31 l5.5 -2.5 l0.5 5.5 l-5.5 1.5 z"/><circle cx="22" cy="59" r="2.3"/>`, // 愚者: 太陽と旅の荷
    1: `<path d="M24 26 a3 3 0 1 0 0.1 0 M30 26 a3 3 0 1 1 -0.1 0" /><path d="M30 34 V58"/><path d="M27 38 l6 -6"/><circle cx="30" cy="58" r="1.4"/>`, // 魔術師: 無限とワンド
    2: `<path d="M20 26 V60 M40 26 V60"/>${moon(30, 40, 7)}`, // 女教皇: 二柱と月
    3: `${crownRounded(30, 30, 7)}<path d="M30 40 V58 M24 50 H36 M30 58 a4 4 0 1 0 0.1 0" />`, // 女帝: 冠と♀
    4: `${crownPointed(30, 28, 8)}<path d="M22 40 H38 V60 H22 Z M22 48 H38"/>`, // 皇帝: 冠と玉座
    5: `<path d="M30 24 V60 M23 32 H37 M25 40 H35"/><path d="M24 54 a2.4 2.4 0 1 0 0.1 0 M36 54 a2.4 2.4 0 1 1 -0.1 0"/>`, // 教皇: 三重十字と鍵
    6: `<circle cx="42" cy="24" r="2.4"/><path d="${rays(42, 24, 3, 5, 8)}"/>${heart(24, 48, 1.5)}${heart(37, 50, 1.5)}`, // 恋人: 太陽と二つの心
    7: `<path d="M20 40 H40 L37 54 H23 Z"/><circle cx="25" cy="58" r="3"/><circle cx="35" cy="58" r="3"/><path d="M22 40 Q30 30 38 40"/><path d="${starPath(30, 34, 2.4, 1, 5)}"/>`, // 戦車
    8: `<path d="M24 30 a3 3 0 1 0 0.1 0 M30 30 a3 3 0 1 1 -0.1 0"/><circle cx="30" cy="46" r="8"/><path d="${rays(30, 46, 8, 11, 12)}"/><circle cx="27" cy="45" r="0.8"/><circle cx="33" cy="45" r="0.8"/><path d="M27 50 Q30 52 33 50"/>`, // 力: 獅子と無限
    9: `<path d="M30 24 L38 40 V54 H22 V40 Z" transform="translate(0 0)"/><path d="M26 42 H34 V52 H26 Z"/><path d="${starPath(30, 47, 2, 0.9, 5)}"/><path d="M38 30 V58"/>`, // 隠者: ランタンと杖
    10: `<circle cx="30" cy="42" r="12"/><circle cx="30" cy="42" r="4"/><path d="${rays(30, 42, 4, 12, 8)}"/>`, // 運命の輪
    11: `<path d="M30 24 V40 M20 30 H40"/><path d="M20 30 L16 38 H24 Z M40 30 L36 38 H44 Z"/><path d="M30 40 V58 M25 58 H35"/>`, // 正義: 天秤と剣
    12: `<path d="M20 26 H40"/><path d="M30 26 V34"/><circle cx="30" cy="38" r="3.4"/><path d="M30 41 V54 M30 54 l-5 6 M30 54 l5 6"/>`, // 吊るされた男
    13: `<path d="M22 60 Q22 44 38 40"/><path d="M38 40 l4 -3 M38 40 l-1 5"/><circle cx="26" cy="34" r="4"/><circle cx="24.5" cy="33.5" r="0.7"/><circle cx="27.5" cy="33.5" r="0.7"/><path d="M24 37 H28"/>`, // 死神: 大鎌と頭蓋
    14: `<path d="M20 34 H28 A4 4 0 0 1 20 34 Z M20 34 V42"/><path d="M40 50 H32 A4 4 0 0 1 40 50 Z M40 50 V58"/><path d="M26 42 Q30 46 34 50"/>`, // 節制: 二杯と水の流れ
    15: `<path d="M22 30 Q20 24 24 24 M38 30 Q40 24 36 24"/><circle cx="30" cy="38" r="7"/><circle cx="27" cy="37" r="0.8"/><circle cx="33" cy="37" r="0.8"/><path d="${starPath(30, 52, 3, 1.2, 5, 90)}"/>`, // 悪魔: 角と逆五芒星
    16: `<path d="M22 60 V36 H38 V60"/><path d="M22 36 L30 28 L38 36"/><path d="M31 30 l-4 8 h5 l-4 8"/><circle cx="24" cy="30" r="1"/><circle cx="40" cy="32" r="1"/>`, // 塔: 雷
    17: `<path d="${starPath(30, 38, 7, 3, 8)}"/><path d="${starPath(20, 30, 2.4, 1, 5)}"/><path d="${starPath(41, 31, 2.4, 1, 5)}"/><path d="M20 56 Q25 53 30 56 T40 56"/>`, // 星
    18: `${moon(30, 34, 7)}<path d="M18 30 V58 M42 30 V58"/><path d="M18 58 Q30 48 42 58"/><path d="M28 56 L30 46 L32 56"/>`, // 月: 二塔と小径
    19: `<circle cx="30" cy="40" r="8"/><path d="${rays(30, 40, 8, 13, 12)}"/><circle cx="27" cy="39" r="0.8"/><circle cx="33" cy="39" r="0.8"/><path d="M27 43 Q30 45 33 43"/>`, // 太陽
    20: `<path d="M20 36 L34 30 V42 Z"/><path d="M34 33 H42 M34 36 H44 M34 39 H42"/><path d="M24 50 h4 v8 h-4 z M30 52 h4 v6 h-4 z"/>`, // 審判: ラッパ
    21: `<ellipse cx="30" cy="42" rx="10" ry="15"/><path d="${starPath(30, 42, 4, 1.7, 5)}"/><path d="M20 30 l-2 -2 M40 30 l2 -2 M20 54 l-2 2 M40 54 l2 2"/>`, // 世界: 月桂環と星
  };

  function cardArt(card) {
    let inner;
    if (card.arcana === '大アルカナ') {
      const idx = typeof card.number === 'number' ? card.number : 0;
      inner = MAJOR[idx] || `<path d="${starPath(30, 42, 9, 4, 8)}"/>`;
    } else {
      const key = SUIT_KEY[card.suit] || 'pentacle';
      const rank = typeof card.number === 'number' ? card.number : 1;
      inner = minor(key, rank);
    }
    return `<svg class="tz-art-svg" viewBox="0 0 60 84" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  }

  window.SVTarotArt = { cardArt };
})();
