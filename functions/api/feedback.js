// POST /api/feedback
// body: { reading_id, anon_id, accurate(bool), rating?, comment? }
// 鑑定の「当たり/外れ」フィードバックを D1 に保存する。
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status, headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ ok: false, error: 'フィードバック保存は未設定です（D1未接続）' }, 200);

  let b;
  try { b = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  const { reading_id, anon_id, accurate, rating, comment } = b || {};
  if (!reading_id) return json({ error: 'reading_id は必須です' }, 400);

  try {
    const id = crypto.randomUUID();
    await env.DB.prepare(
      'INSERT INTO feedback (id, reading_id, anon_id, accurate, rating, comment) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      id, reading_id, anon_id || null,
      accurate === true ? 1 : accurate === false ? 0 : null,
      Number.isInteger(rating) ? rating : null,
      (comment || '').slice(0, 1000) || null
    ).run();
    return json({ ok: true, id });
  } catch (e) {
    return json({ ok: false, error: String(e.message || e) }, 200);
  }
}

// GET /api/feedback?reading_id=... は集計（将来の重み調整用の素材）
export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) return json({ ok: false, error: 'D1未接続' }, 200);
  const url = new URL(request.url);
  const rid = url.searchParams.get('reading_id');
  try {
    if (rid) {
      const r = await env.DB.prepare('SELECT accurate, rating, comment, created_at FROM feedback WHERE reading_id = ?').bind(rid).all();
      return json({ ok: true, rows: r.results });
    }
    const agg = await env.DB.prepare(
      'SELECT divination, COUNT(*) n, AVG(accurate) acc FROM feedback f JOIN readings r ON f.reading_id = r.id GROUP BY divination'
    ).all();
    return json({ ok: true, aggregate: agg.results });
  } catch (e) {
    return json({ ok: false, error: String(e.message || e) }, 200);
  }
}
