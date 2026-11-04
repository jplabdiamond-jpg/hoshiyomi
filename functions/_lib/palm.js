// 手相のビジョン処理（分類・特徴抽出・両手まとめ）。reading / checkout の両方から使う。
const DEFAULT_VISION_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';

export const PALM_VISION_PROMPT =
  'これは手相鑑定用の手のひらの写真です。実際に画像から見える特徴だけを、できるだけ細かく具体的に日本語の箇条書きで報告してください（推測で線を作らない。見えない/不明瞭な項目は「不明瞭」と書く）。各項目をこの形式で:\n' +
  '【手の形】手のひらは四角形/長方形のどちらに近いか。指は長い/短い。手の厚み・硬さ・血色の印象。\n' +
  '【指先・親指】指先の形（尖る/円錐/四角/先広がり）。人差し指と薬指どちらが長いか。親指は大きい/小さい、よく開くか、硬いか。\n' +
  '【生命線】見えるか。親指の付け根をどの程度大きく囲むか（大きく張り出す/小さい）、濃さ、長さ、二重線の有無。途切れ・島・鎖・向上線（上向きの細い支線）があれば、線の上の方/中ほど/手首寄りの下の方のどこにあるか（流年＝時期の判断に使う）。\n' +
  '【知能線（頭脳線）】見えるか。真横に直線か下（月丘）へカーブか。長さ（中指下/薬指下/小指下）。起点が生命線とくっつくか離れるか。先端の枝分かれ（二又）の有無。手を横断して小指側へ抜けていないか。\n' +
  '【感情線】見えるか。終点（人差し指の下/人差し指と中指の間/中指の下）。直線的かカーブか。鎖状・枝分かれの有無。知能線との間隔は広い/狭い。\n' +
  '【運命線】中指へ向かう縦線が見えるか。濃さ、起点（手首中央/小指側の下＝月丘側/生命線上/知能線あたり）、途切れ・ずれ・支線合流の有無とその高さ（手首寄り/中ほど/感情線付近）。見えなければ「見えない」。\n' +
  '【太陽線・財運線】薬指の下（太陽線）／小指の下（財運線）に縦線が見えるか。長さ・本数。\n' +
  '【結婚線】小指の付け根と感情線の間の短い横線。本数、上向き/下向き、二又や島の有無。\n' +
  '【金星帯】人差し指〜小指の付け根を弧で結ぶ線が見えるか。\n' +
  '【丘のふくらみ】金星丘(親指付け根)/木星丘(人差し指下)/土星丘(中指下)/太陽丘(薬指下)/水星丘(小指下)/月丘(小指側の下)のうち、特に発達して見えるもの。\n' +
  '【特殊な印】星(★)・十字・三角・四角・格子・島・魚の形などの印、仏眼(親指第一関節)、マスカケ線(知能線と感情線が一本に繋がり手を横断)が見えるか。\n' +
  'もし手のひらが写っていない/手の甲だけ/不鮮明で線が読めない場合は、必ず先頭行に「[NOT_PALM]」とだけ書くこと。';

// Llama 3.2 Vision（ライセンス同意済み・高品質）を優先、不調時は非ゲートの llava にフォールバック。
// kind: 'messages'=image_url(dataURL)形式 / 'llava'=バイト配列+prompt形式。
const VISION_CANDIDATES = [
  { model: '@cf/meta/llama-3.2-11b-vision-instruct', kind: 'messages' },
  { model: '@cf/llava-hf/llava-1.5-7b-hf', kind: 'llava' },
];

export function isDataImage(s) {
  return typeof s === 'string' && /^data:image\/(png|jpe?g|webp);base64,/i.test(s);
}

function dataUrlToBytes(u) {
  const b64 = (u.split(',')[1] || '');
  const bin = atob(b64);
  const a = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return [...a];
}

// 画像＋プロンプトでビジョンモデルを呼ぶ（候補を順に試す）
async function runVision(env, dataUrl, promptText, maxTokens = 768) {
  const kindOf = (m) => (m.includes('llava') || m.includes('uform') ? 'llava' : 'messages');
  const pref = env.PALM_VISION_MODEL
    ? [{ model: env.PALM_VISION_MODEL, kind: kindOf(env.PALM_VISION_MODEL) }]
    : [];
  const list = [...pref, ...VISION_CANDIDATES.filter((c) => !pref.some((p) => p.model === c.model))];
  let lastErr = null;
  for (const c of list) {
    try {
      let text = '';
      if (c.kind === 'messages') {
        const r = await env.AI.run(c.model, {
          messages: [{ role: 'user', content: [
            { type: 'text', text: promptText },
            { type: 'image_url', image_url: { url: dataUrl } },
          ] }],
          max_tokens: maxTokens, temperature: 0.1,
        });
        text = (r && (r.response || r.result || '')).trim();
      } else {
        const r = await env.AI.run(c.model, { image: dataUrlToBytes(dataUrl), prompt: promptText, max_tokens: maxTokens });
        text = (r && (r.description || r.response || r.result || '')).trim();
      }
      if (text) return { model: c.model, text };
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('利用可能なビジョンモデルがありません');
}

// 厳格判定：写っている主被写体を一語で答えさせる（「手のひらか？」はモデルが"はい"に偏るため不可）。
const PALM_CLASSIFY_PROMPT =
  'この写真に写っている主な被写体は何ですか。最も当てはまるものを、短い日本語の名詞ひとつだけで答えてください。' +
  '例: 手のひら / 手の甲 / 風景 / 空 / 文字 / 人の顔 / 料理 / 動物 / 建物 / 画面 / 物。' +
  '説明や文章は書かず、名詞ひとつだけを答えること。';

// 手のひらか判定（true=手のひらのみ）。手の甲・それ以外・曖昧はすべて false（＝弾く）。
export async function classifyPalm(env, dataUrl) {
  const { text } = await runVision(env, dataUrl, PALM_CLASSIFY_PROMPT, 24);
  const t = (text || '').toLowerCase();
  const backOrOther = /甲|背|back/.test(t);
  const isPalm = !backOrOther && (/手のひら|掌|手相|ての?ひら|palm/.test(t) || (/(^|[^の])手|hand/.test(t) && !/甲|背/.test(t)));
  return { isPalm, raw: text };
}

// 写真から手相の特徴を抽出
export async function extractPalmFeatures(env, dataUrl) {
  return runVision(env, dataUrl, PALM_VISION_PROMPT, 1000);
}

// 1枚を「手のひら判定→特徴抽出」。手でなければ palm:false
async function readOneHand(env, image) {
  try { const cls = await classifyPalm(env, image); if (!cls.isPalm) return { palm: false }; } catch { /* 判定失敗は抽出の[NOT_PALM]に委ねる */ }
  const v = await extractPalmFeatures(env, image);
  if (/^\s*\[NOT_PALM\]/.test(v.text)) return { palm: false };
  return { palm: true, text: v.text, model: v.model };
}

export const PALM_RETAKE = '手のひらの写真として読み取れませんでした。手のひら全体（指先まで）がはっきり写るように、明るい場所で手を少し広げて撮った写真をアップロードしてください。';

/**
 * 利き手(palmImage・必須)＋反対の手(palmImage2・必須)を処理して特徴を返す。
 * 返り値: { ok:true, features, features2, model } / { error } / { retake } のいずれか。
 */
export async function processPalmHands(env, answers) {
  if (!env || !env.AI) return { error: '画像の解析が利用できません（AI未設定）' };
  const img = answers && answers.palmImage;
  const img2 = answers && answers.palmImage2;
  if (!isDataImage(img)) return { error: '利き手の手のひらの写真（JPEG/PNG）をアップロードしてください' };
  if (!isDataImage(img2)) return { error: '反対の手の手のひらの写真（JPEG/PNG）をアップロードしてください' };
  let dom, oth;
  try { dom = await readOneHand(env, img); } catch (e) { return { error: '利き手の画像の解析に失敗しました。明るい場所で撮り直してお試しください。', detail: String(e.message || e) }; }
  if (!dom.palm) return { retake: '利き手の写真が手のひらとして読み取れませんでした。' + PALM_RETAKE };
  try { oth = await readOneHand(env, img2); } catch (e) { return { error: '反対の手の画像の解析に失敗しました。明るい場所で撮り直してお試しください。', detail: String(e.message || e) }; }
  if (!oth.palm) return { retake: '反対の手の写真が手のひらとして読み取れませんでした。' + PALM_RETAKE };
  return { ok: true, features: dom.text, features2: oth.text, model: dom.model };
}
