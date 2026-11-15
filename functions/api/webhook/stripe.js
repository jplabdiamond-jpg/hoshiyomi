// POST /api/webhook/stripe  — Stripe Webhook 受信口
// サブスクの状態変化（更新・解約・支払い失敗で past_due 等）を D1 に同期する。
// これにより、顧客が Stripe 側（請求ポータル等）で解約しても自サイトの購読状態が追従する。
//
// 署名検証に STRIPE_WEBHOOK_SECRET（whsec_...）を使う。未設定なら 503 を返す（検証なしでは受け付けない）。
import { ensureSchema } from '../../_lib/db.js';
import { updateSubscriptionBySubId } from '../../_lib/account.js';
import { subPeriodEnd } from '../../_lib/stripe.js';

const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8' } });

// Stripe-Signature ヘッダ（t=...,v1=...,v1=...）を検証する。
async function verifySignature(payload, sigHeader, secret) {
  if (!sigHeader) return false;
  let t = null;
  const v1s = [];
  for (const part of sigHeader.split(',')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i), v = part.slice(i + 1);
    if (k === 't') t = v;
    else if (k === 'v1') v1s.push(v);
  }
  if (!t || v1s.length === 0) return false;
  // タイムスタンプの許容（リプレイ対策・±5分）
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(t));
  if (!Number.isFinite(age) || age > 300) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${payload}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');

  // 署名ローテーション中は v1 が複数来るので、いずれか一致でOK（定数時間比較）
  for (const v1 of v1s) {
    if (v1.length !== expected.length) continue;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
    if (diff === 0) return true;
  }
  return false;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.STRIPE_WEBHOOK_SECRET) return json({ error: 'webhook_secret_unset' }, 503);
  if (!env.DB) return json({ error: 'no_db' }, 503);

  const payload = await request.text();
  const sig = request.headers.get('stripe-signature');
  const ok = await verifySignature(payload, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return json({ error: 'invalid_signature' }, 400);

  let event;
  try { event = JSON.parse(payload); } catch { return json({ error: 'bad_json' }, 400); }

  try {
    await ensureSchema(env.DB);
    const type = event.type || '';
    const obj = event.data && event.data.object;

    if (type.startsWith('customer.subscription.')) {
      // obj はサブスクオブジェクト（id / status / current_period_end or items）
      const subId = obj && obj.id;
      let status = obj && obj.status;
      if (type === 'customer.subscription.deleted') status = status || 'canceled';
      const periodEnd = subPeriodEnd(obj);
      const matched = await updateSubscriptionBySubId(env.DB, subId, { status, periodEnd });
      return json({ received: true, matched: matched || 'none' });
    }

    // それ以外のイベントは受理だけして無視（200を返さないと Stripe が再送し続ける）
    return json({ received: true, ignored: type });
  } catch (e) {
    // 500 を返すと Stripe が再送してくれる
    return json({ error: String(e.message || e) }, 500);
  }
}
