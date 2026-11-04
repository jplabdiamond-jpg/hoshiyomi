// POST /api/sub/refresh  → 今月の継続鑑定を生成（約1ヶ月に1回）。初回も生成。
import { ensureSchema } from '../../_lib/db.js';
import { getAuth } from '../../_lib/account.js';
import { generateSubReading } from '../../_lib/subscription.js';

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: 'D1未接続' }, 503);
  try {
    await ensureSchema(env.DB);
    const { user, active } = await getAuth(env.DB, request);
    if (!user) return json({ error: 'not_logged_in' }, 401);
    if (!active) return json({ error: 'no_active_subscription' }, 402);
    if (!user.answers_json) return json({ error: 'no_profile', message: '鑑定の入力情報が見つかりません' }, 400);

    // 連続生成の抑制：直近の生成が27日以内ならそれを返す（無駄な課金・生成を防ぐ）
    const last = await env.DB.prepare('SELECT created_at FROM sub_readings WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').bind(user.id).first();
    const force = (() => { try { return !!(request.url && new URL(request.url).searchParams.get('force')); } catch { return false; } })();
    if (last && !force) {
      const age = Date.now() - new Date(String(last.created_at).replace(' ', 'T') + 'Z').getTime();
      if (age < 27 * 86400000) {
        const row = await env.DB.prepare('SELECT id, summary, data_json, created_at FROM sub_readings WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').bind(user.id).first();
        return json({ ok: true, fresh: false, reading: row.summary, createdAt: row.created_at, data: safeParse(row.data_json) });
      }
    }

    const res = await generateSubReading(env, user);
    return json({ ok: true, fresh: true, reading: res.reading, disclaimer: res.disclaimer, diff: res.diff, calibratedN: res.calibratedN, createdAt: res.createdAt });
  } catch (e) {
    return json({ error: String(e.message || e) }, 500);
  }
}
function safeParse(s) { try { return JSON.parse(s); } catch { return null; } }
