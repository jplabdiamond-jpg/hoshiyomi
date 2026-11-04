// GET /api/me  → 現在のログイン状態・サブスク・答え合わせ待ち・最新の継続鑑定
import { ensureSchema } from '../_lib/db.js';
import { getAuth } from '../_lib/account.js';
import { pendingChecks } from '../_lib/subscription.js';

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) return json({ loggedIn: false });
  try {
    await ensureSchema(env.DB);
    const { user, sub, active } = await getAuth(env.DB, request);
    if (!user) return json({ loggedIn: false });

    const pending = active ? await pendingChecks(env.DB, user.id) : [];
    // 最新の継続鑑定
    let latest = null, dueThisMonth = false;
    const row = await env.DB.prepare('SELECT id, summary, data_json, created_at FROM sub_readings WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').bind(user.id).first();
    if (row) {
      latest = { id: row.id, createdAt: row.created_at, summary: row.summary, data: safeParse(row.data_json) };
      const d = new Date(String(row.created_at).replace(' ', 'T') + 'Z');
      dueThisMonth = (Date.now() - d.getTime()) > 27 * 86400000; // 約1ヶ月で更新可
    } else {
      dueThisMonth = true; // まだ1度も生成していない
    }

    return json({
      loggedIn: true,
      email: user.email,
      active,
      periodEnd: sub?.current_period_end || null,
      status: sub?.status || null,
      pending,
      latest,
      dueThisMonth: active ? dueThisMonth : false,
    });
  } catch (e) {
    return json({ loggedIn: false, error: String(e.message || e) }, 200);
  }
}

function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }
