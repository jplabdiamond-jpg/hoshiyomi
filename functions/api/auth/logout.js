// POST /api/auth/logout → セッション破棄
import { ensureSchema } from '../../_lib/db.js';
import { readCookie, clearCookie } from '../../_lib/account.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const headers = { 'content-type': 'application/json; charset=utf-8', 'Set-Cookie': clearCookie() };
  try {
    if (env.DB) {
      await ensureSchema(env.DB);
      const t = readCookie(request, 'sv_session');
      if (t) await env.DB.prepare('DELETE FROM auth_sessions WHERE token = ?').bind(t).run();
    }
  } catch { /* */ }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}
