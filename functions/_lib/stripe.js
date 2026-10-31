// Stripe REST ヘルパー（Workers から fetch で直接呼ぶ。SDK不要）
const API = 'https://api.stripe.com/v1';

export const PRICE_JPY = 500; // 総合鑑定 1回の価格（円・ゼロ小数通貨なのでそのまま円）

function auth(key) {
  return { Authorization: `Bearer ${key}`, 'content-type': 'application/x-www-form-urlencoded' };
}

// Checkout セッションを作成し、支払いURLを返す
export async function createCheckoutSession(key, { orderId, successUrl, cancelUrl, amount = PRICE_JPY }) {
  const body = new URLSearchParams();
  body.append('mode', 'payment');
  body.append('line_items[0][price_data][currency]', 'jpy');
  body.append('line_items[0][price_data][product_data][name]', 'Sibylla Vision 総合鑑定');
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

// セッションを取得して支払い状態を確認
export async function getCheckoutSession(key, sessionId) {
  const r = await fetch(`${API}/checkout/sessions/${encodeURIComponent(sessionId)}`, { headers: { Authorization: `Bearer ${key}` } });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || 'Stripe セッション取得に失敗しました');
  return data; // data.payment_status === 'paid', data.metadata.order_id
}
