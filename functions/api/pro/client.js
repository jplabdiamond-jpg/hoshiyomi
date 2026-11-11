// GET /api/pro/client?id=...  → 1件の顧客カルテ＋鑑定履歴（本文つき）
import { ensureSchema } from '../../_lib/db.js';
import { getProAuth } from '../../_lib/pro.js';

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });
const safeParse = (s) => { try { return JSON.parse(s); } catch { return null; } };

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: 'D1未接続' }, 503);
  await ensureSchema(env.DB);
  const { user, isPro } = await getProAuth(env.DB, request);
  if (!user) return json({ error: 'not_logged_in' }, 401);
  if (!isPro) return json({ error: 'not_pro' }, 402);

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return json({ error: 'id必須' }, 400);
  try {
    const c = await env.DB.prepare('SELECT * FROM clients WHERE id = ? AND pro_user_id = ?').bind(id, user.id).first();
    if (!c) return json({ error: 'not_found' }, 404);
    const rs = await env.DB.prepare(
      'SELECT id, divination, title, summary, data_json, created_at FROM client_readings WHERE client_id = ? AND pro_user_id = ? ORDER BY created_at DESC LIMIT 50'
    ).bind(id, user.id).all();
    const readings = (rs.results || []).map((r) => ({
      id: r.id, divination: r.divination, title: r.title, summary: r.summary,
      data: safeParse(r.data_json), createdAt: r.created_at,
    }));
    return json({
      ok: true,
      client: {
        id: c.id, name: c.name, kana: c.kana,
        birthDate: c.birth_date, birthTime: c.birth_time, birthPlace: c.birth_place,
        gender: c.gender, hand: c.hand, sei: c.sei, mei: c.mei, memo: c.memo,
        updatedAt: c.updated_at,
      },
      readings,
    });
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
