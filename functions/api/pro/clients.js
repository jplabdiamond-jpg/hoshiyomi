// GET  /api/pro/clients          → 顧客カルテ一覧
// POST /api/pro/clients          → 作成・更新・削除（body.action = create|update|delete）
import { ensureSchema } from '../../_lib/db.js';
import { getProAuth } from '../../_lib/pro.js';

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });

async function requirePro(env, request) {
  await ensureSchema(env.DB);
  const auth = await getProAuth(env.DB, request);
  if (!auth.user) return { err: json({ error: 'not_logged_in' }, 401) };
  if (!auth.isPro) return { err: json({ error: 'not_pro' }, 402) };
  return { user: auth.user };
}

function clean(c) {
  const g = (v) => (typeof v === 'string' ? v.trim() : '');
  return {
    name: g(c.name).slice(0, 80),
    kana: g(c.kana).slice(0, 80),
    birthDate: g(c.birthDate).slice(0, 20),
    birthTime: g(c.birthTime).slice(0, 10),
    birthPlace: g(c.birthPlace).slice(0, 80),
    gender: g(c.gender).slice(0, 10),
    hand: g(c.hand).slice(0, 10),
    sei: g(c.sei).slice(0, 40),
    mei: g(c.mei).slice(0, 40),
    memo: g(c.memo).slice(0, 4000),
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: 'D1未接続' }, 503);
  const gate = await requirePro(env, request);
  if (gate.err) return gate.err;
  try {
    const rs = await env.DB.prepare(
      `SELECT c.id, c.name, c.kana, c.birth_date, c.birth_time, c.birth_place, c.gender, c.hand, c.sei, c.mei, c.memo, c.updated_at,
        (SELECT COUNT(*) FROM client_readings r WHERE r.client_id = c.id) AS reading_count,
        (SELECT MAX(created_at) FROM client_readings r WHERE r.client_id = c.id) AS last_reading_at
       FROM clients c WHERE c.pro_user_id = ? ORDER BY c.updated_at DESC`
    ).bind(gate.user.id).all();
    return json({ ok: true, clients: (rs.results || []).map(mapClient) });
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: 'D1未接続' }, 503);
  const gate = await requirePro(env, request);
  if (gate.err) return gate.err;
  const userId = gate.user.id;

  let b;
  try { b = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  const action = b?.action || 'create';

  try {
    if (action === 'delete') {
      const id = String(b.id || '');
      if (!id) return json({ error: 'id必須' }, 400);
      // 所有確認してから削除（鑑定履歴も）
      const own = await env.DB.prepare('SELECT id FROM clients WHERE id = ? AND pro_user_id = ?').bind(id, userId).first();
      if (!own) return json({ error: 'not_found' }, 404);
      await env.DB.batch([
        env.DB.prepare('DELETE FROM client_readings WHERE client_id = ? AND pro_user_id = ?').bind(id, userId),
        env.DB.prepare('DELETE FROM clients WHERE id = ? AND pro_user_id = ?').bind(id, userId),
      ]);
      return json({ ok: true, deleted: id });
    }

    const c = clean(b || {});
    if (!c.name && !c.kana) return json({ error: '名前（またはカナ）は必須です' }, 400);

    if (action === 'update') {
      const id = String(b.id || '');
      const own = await env.DB.prepare('SELECT id FROM clients WHERE id = ? AND pro_user_id = ?').bind(id, userId).first();
      if (!own) return json({ error: 'not_found' }, 404);
      await env.DB.prepare(
        `UPDATE clients SET name=?, kana=?, birth_date=?, birth_time=?, birth_place=?, gender=?, hand=?, sei=?, mei=?, memo=?, updated_at=CURRENT_TIMESTAMP
         WHERE id=? AND pro_user_id=?`
      ).bind(c.name, c.kana, c.birthDate, c.birthTime, c.birthPlace, c.gender, c.hand, c.sei, c.mei, c.memo, id, userId).run();
      return json({ ok: true, id });
    }

    // create
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO clients (id, pro_user_id, name, kana, birth_date, birth_time, birth_place, gender, hand, sei, mei, memo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, userId, c.name, c.kana, c.birthDate, c.birthTime, c.birthPlace, c.gender, c.hand, c.sei, c.mei, c.memo).run();
    return json({ ok: true, id });
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}

function mapClient(r) {
  return {
    id: r.id, name: r.name, kana: r.kana,
    birthDate: r.birth_date, birthTime: r.birth_time, birthPlace: r.birth_place,
    gender: r.gender, hand: r.hand, sei: r.sei, mei: r.mei, memo: r.memo,
    updatedAt: r.updated_at, readingCount: r.reading_count || 0, lastReadingAt: r.last_reading_at || null,
  };
}
