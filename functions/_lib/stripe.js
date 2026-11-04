// Stripe REST ヘルパー（Workers から fetch で直接呼ぶ。SDK不要）
const API = 'https://api.stripe.com/v1';

export const PRICE_JPY = 2000; // 総合鑑定 1回の価格（円・ゼロ小数通貨なのでそのまま円）
export const SUB_PRICE_JPY = 980; // 継続鑑定サブスク（円・月額）

function auth(key) {
  return { Authorization: `Bearer ${key}`, 'content-type': 'application/x-www-form-urlencoded' };
}

// Checkout セッションを作成し、支払いURLを返す
export async function createCheckoutSession(key, { orderId, successUrl, cancelUrl, amount = PRICE_JPY, name = 'Sibylla Vision 総合鑑定' }) {
  const body = new URLSearchParams();
  body.append('mode', 'payment');
  body.append('line_items[0][price_data][currency]', 'jpy');
  body.append('line_items[0][price_data][product_data][name]', name);
  body.append('line_items[0][price_data][unit_amount]', String(amount));
  body.append('line_items[0][quantity]', '1');
  body.append('success_url', successUrl);
  body.append('cancel_url', cancelUrl);
  body.append('metadata[order_id]', orderId);
  body.append('client_reference_id', orderId);

  const r = await fetch(`${API}/checkout/sessions`, { method: 'POST', headers: auth(key), body });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || 'Stripe checkout 作成に失敗しました');
  return { id: data.id, url: data.url };
}

// 継続鑑定サブスクの Checkout セッション（月額・インライン価格でProduct作成不要）
export async function createSubscriptionCheckout(key, { successUrl, cancelUrl, clientRef, amount = SUB_PRICE_JPY, name = 'Sibylla Vision 継続鑑定（月額）' }) {
  const body = new URLSearchParams();
  body.append('mode', 'subscription');
  body.append('line_items[0][price_data][currency]', 'jpy');
  body.append('line_items[0][price_data][product_data][name]', name);
  body.append('line_items[0][price_data][unit_amount]', String(amount));
  body.append('line_items[0][price_data][recurring][interval]', 'month');
  body.append('line_items[0][quantity]', '1');
  body.append('success_url', successUrl);
  body.append('cancel_url', cancelUrl);
  body.append('allow_promotion_codes', 'true');
  if (clientRef) body.append('client_reference_id', clientRef);
  const r = await fetch(`${API}/checkout/sessions`, { method: 'POST', headers: auth(key), body });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || 'Stripe サブスク作成に失敗しました');
  return { id: data.id, url: data.url };
}

// サブスクリプションの状態を取得（status / current_period_end / customer）
export async function getSubscription(key, subId) {
  const r = await fetch(`${API}/subscriptions/${encodeURIComponent(subId)}`, { headers: { Authorization: `Bearer ${key}` } });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || 'Stripe サブスク取得に失敗しました');
  return data; // data.status, data.current_period_end, data.customer
}

// Stripe顧客のカスタマーポータル（解約・支払い方法変更）URLを作る
export async function createBillingPortal(key, { customerId, returnUrl }) {
  const body = new URLSearchParams();
  body.append('customer', customerId);
  body.append('return_url', returnUrl);
  const r = await fetch(`${API}/billing_portal/sessions`, { method: 'POST', headers: auth(key), body });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || 'Stripe ポータル作成に失敗しました');
  return { url: data.url };
}

// セッションを取得して支払い状態を確認
export async function getCheckoutSession(key, sessionId) {
  const r = await fetch(`${API}/checkout/sessions/${encodeURIComponent(sessionId)}`, { headers: { Authorization: `Bearer ${key}` } });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || 'Stripe セッション取得に失敗しました');
  return data; // data.payment_status === 'paid', data.metadata.order_id
}
