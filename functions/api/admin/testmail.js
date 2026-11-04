// GET /api/admin/testmail?k=<token>&to=jp.lab.diamond@gmail.com
// 【一時的なメール送信テスト用】Resend経由で1通だけ送り、結果を返す。
// 安全対策: トークン必須＋送信先は固定の1アドレスのみ。確認後にこのファイルは削除する。
const TOKEN = '2da01397a38606c7188543e13c2bbcd9';
const ALLOWED_TO = 'jp.lab.diamond@gmail.com';

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  if (url.searchParams.get('k') !== TOKEN) return json({ error: 'forbidden' }, 403);
  const to = url.searchParams.get('to');
  if (to !== ALLOWED_TO) return json({ error: 'to_not_allowed' }, 403);
  if (!env.RESEND_API_KEY) return json({ error: 'no_resend_key', hasFrom: env.MAIL_FROM || null }, 503);

  const from = env.MAIL_FROM || 'Sibylla Vision <noreply@sibylla-vision.com>';
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from, to: [to], subject: 'Sibylla Vision 送信テスト',
        html: '<p>これは Sibylla Vision の送信テストです。この文面が届いていれば、継続鑑定のログインメールも正しく送信されます。</p>',
      }),
    });
    const data = await r.json().catch(() => ({}));
    return json({ ok: r.ok, status: r.status, from, id: data?.id || null, resend: data }, r.ok ? 200 : 502);
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
