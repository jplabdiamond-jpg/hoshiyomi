// GET /api/pro/me → 占い師プランのログイン/購読状態＋ホワイトラベル設定
import { ensureSchema } from '../../_lib/db.js';
import { getProAuth, getProSettings } from '../../_lib/pro.js';

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) return json({ loggedIn: false, isPro: false });
  try {
    await ensureSchema(env.DB);
    const { user, sub, active, isPro, flagged } = await getProAuth(env.DB, request);
    if (!user) return json({ loggedIn: false, isPro: false });
    const settings = isPro ? await getProSettings(env.DB, user.id) : null;
    return json({
      loggedIn: true,
      email: user.email,
      isPro,
      flagged: !!flagged,      // 占い師プランに登録済みだが現在 inactive の場合も true
      active,
      status: sub?.status || null,
      periodEnd: sub?.current_period_end || null,
      settings,
    });
  } catch (e) {
    return json({ loggedIn: false, isPro: false, error: String(e.message || e) }, 200);
  }
}
