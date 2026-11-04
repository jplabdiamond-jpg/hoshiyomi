// ③ 継続鑑定サブスク：アカウント・セッション・マジックリンクの共通処理
const SESSION_COOKIE = 'sv_session';
const SESSION_DAYS = 60;

export function randomToken(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}
const nowSec = () => Math.floor(Date.now() / 1000);

export function readCookie(request, name) {
  const h = request.headers.get('cookie') || '';
  for (const part of h.split(/;\s*/)) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i) === name) return decodeURIComponent(part.slice(i + 1));
  }
  return null;
}
export function sessionCookie(token, maxAgeSec = SESSION_DAYS * 86400) {
  const attrs = [`${SESSION_COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'Secure', 'SameSite=Lax', `Max-Age=${maxAgeSec}`];
  return attrs.join('; ');
}
export function clearCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function upsertUserByEmail(DB, email, stripeCustomerId) {
  const em = String(email || '').trim().toLowerCase();
  if (!em) return null;
  let u = await DB.prepare('SELECT * FROM users WHERE email = ?').bind(em).first();
  if (!u) {
    const id = crypto.randomUUID();
    await DB.prepare('INSERT INTO users (id, email, stripe_customer_id) VALUES (?, ?, ?)')
      .bind(id, em, stripeCustomerId || null).run();
    u = await DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  } else if (stripeCustomerId && u.stripe_customer_id !== stripeCustomerId) {
    await DB.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').bind(stripeCustomerId, u.id).run();
    u.stripe_customer_id = stripeCustomerId;
  }
  return u;
}

export async function createSession(DB, userId, days = SESSION_DAYS) {
  const token = randomToken(32);
  const expires = nowSec() + days * 86400;
  await DB.prepare('INSERT INTO auth_sessions (token, user_id, expires) VALUES (?, ?, ?)')
    .bind(token, userId, expires).run();
  return token;
}

// リクエストから現在のユーザー＋サブスク状態を解決
export async function getAuth(DB, request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return { user: null, sub: null, active: false };
  const s = await DB.prepare('SELECT * FROM auth_sessions WHERE token = ?').bind(token).first();
  if (!s || (s.expires && s.expires < nowSec())) return { user: null, sub: null, active: false };
  const user = await DB.prepare('SELECT * FROM users WHERE id = ?').bind(s.user_id).first();
  if (!user) return { user: null, sub: null, active: false };
  const sub = await DB.prepare('SELECT * FROM subscriptions WHERE user_id = ?').bind(user.id).first();
  return { user, sub, active: isActive(sub) };
}

export function isActive(sub) {
  if (!sub) return false;
  if (!['active', 'trialing'].includes(sub.status)) return false;
  if (sub.current_period_end && sub.current_period_end < nowSec() - 3 * 86400) return false; // 3日の猶予
  return true;
}

export async function setSubscription(DB, userId, { subId, custId, status, periodEnd }) {
  await DB.prepare(
    `INSERT INTO subscriptions (user_id, stripe_subscription_id, stripe_customer_id, status, current_period_end, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET stripe_subscription_id=excluded.stripe_subscription_id,
       stripe_customer_id=excluded.stripe_customer_id, status=excluded.status,
       current_period_end=excluded.current_period_end, updated_at=CURRENT_TIMESTAMP`
  ).bind(userId, subId || null, custId || null, status || null, periodEnd || null).run();
}

// ── マジックリンク ──
export async function createMagicToken(DB, email) {
  const em = String(email || '').trim().toLowerCase();
  if (!em || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return null;
  const token = randomToken(24);
  const expires = nowSec() + 30 * 60; // 30分
  await DB.prepare('INSERT INTO magic_tokens (token, email, expires) VALUES (?, ?, ?)').bind(token, em, expires).run();
  return token;
}
export async function consumeMagicToken(DB, token) {
  if (!token) return null;
  const row = await DB.prepare('SELECT * FROM magic_tokens WHERE token = ?').bind(token).first();
  if (!row || row.used || (row.expires && row.expires < nowSec())) return null;
  await DB.prepare('UPDATE magic_tokens SET used = 1 WHERE token = ?').bind(token).run();
  return row.email;
}

// メール送信（Resend があれば送信、無ければ送れないことを返す）。失敗しても例外は投げない。
export async function sendMagicEmail(env, email, link) {
  const key = env.RESEND_API_KEY;
  const from = env.MAIL_FROM || 'Sibylla Vision <login@sibylla.vision>';
  if (!key) return { sent: false, reason: 'no_provider' };
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from, to: [email], subject: 'Sibylla Vision ログインリンク',
        html: `<p>下のリンクから30分以内にログインしてください。</p><p><a href="${link}">${link}</a></p><p>心当たりがない場合は無視してください。</p>`,
      }),
    });
    return { sent: r.ok };
  } catch {
    return { sent: false, reason: 'error' };
  }
}
