// POST /api/tarot-draw  body: { seed?: number, question?: string, spread?: string }
// 総合鑑定ジャーニー用の軽量なタロット抽選（AI・DBを使わず、カードだけ返す）。
// seed を保存しておけば、決済後の最終鑑定で同じ札を再現できる。
import { drawTarot } from '../_lib/tarot.js';

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

export async function onRequestPost(context) {
  let b;
  try { b = await context.request.json(); } catch { b = {}; }
  const seed = Number.isFinite(b.seed) ? b.seed : null;
  const spread = (b.spread === 'one' || b.spread === 'three') ? b.spread : 'celtic';
  const res = drawTarot(spread, String(b.question || '').slice(0, 200), seed);
  return json({ spread: res.spread, cards: res.cards });
}

export async function onRequestGet() {
  return json({ ok: true, usage: 'POST { seed?, question?, spread? }' });
}
