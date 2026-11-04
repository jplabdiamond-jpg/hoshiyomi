// POST /api/auth/request  body: { email }  → マジックリンクを発行してメール送信
import { ensureSchema } from '../../_lib/db.js';
import { createMagicToken, sendMagicEmail } from '../../_lib/account.js';

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: 'D1未接続' }, 503);
  let b;
  try { b = await request.json(); } catch { return json({ error: 'bad json' }, 400); }
  const email = (b?.email || '').trim().toLowerCase();
  try {
    await ensureSchema(env.DB);
    // 既存ユーザーにのみ発行（サブスク登録＝アカウント作成はStripe経由）。存在を漏らさないため常に同じ応答。
    const u = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (u) {
      const token = await createMagicToken(env.DB, email);
      if (token) {
        const origin = new URL(request.url).origin;
        const link = `${origin}/api/auth/verify?token=${token}`;
        await sendMagicEmail(env, email, link);
      }
    }
    // メール送信の可否に関わらず、常に成功応答（アカウント有無を秘匿）
    return json({ ok: true, message: 'ご登録のメールアドレス宛にログインリンクを送信しました（届かない場合は迷惑メールもご確認ください）。' });
  } catch {
    return json({ ok: true, message: 'ご登録のメールアドレス宛にログインリンクを送信しました。' });
  }
}
