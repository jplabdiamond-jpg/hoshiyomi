// GET /api/auth/verify?token=...  → マジックトークンを消費してログイン（Cookie発行）
import { ensureSchema } from '../../_lib/db.js';
import { consumeMagicToken, upsertUserByEmail, createSession, sessionCookie } from '../../_lib/account.js';

function redirect(location, cookie) {
  const h = { Location: location };
  if (cookie) h['Set-Cookie'] = cookie;
  return new Response(null, { status: 302, headers: h });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const origin = url.origin;
  const token = url.searchParams.get('token');
  if (!env.DB || !token) return redirect(`${origin}/?login_error=1`);
  try {
    await ensureSchema(env.DB);
    const email = await consumeMagicToken(env.DB, token);
    if (!email) return redirect(`${origin}/?login_error=2`); // 期限切れ/使用済み
    const user = await upsertUserByEmail(env.DB, email);
    const sess = await createSession(env.DB, user.id);
    return redirect(`${origin}/?loggedin=1`, sessionCookie(sess));
  } catch {
    return redirect(`${origin}/?login_error=9`);
  }
}
