// 占い師プラン（¥2,000/月・使い放題）共通処理
import { getAuth } from './account.js';

// 占い師プランかどうかを解決。pro_users に登録があり、かつサブスクが active
export async function getProAuth(DB, request) {
  const base = await getAuth(DB, request); // { user, sub, active }
  if (!base.user) return { ...base, isPro: false };
  let flagged = false;
  try {
    const row = await DB.prepare('SELECT user_id FROM pro_users WHERE user_id = ?').bind(base.user.id).first();
    flagged = !!row;
  } catch { flagged = false; }
  return { ...base, isPro: flagged && base.active, flagged };
}

export async function markPro(DB, userId) {
  try {
    await DB.prepare('INSERT OR IGNORE INTO pro_users (user_id) VALUES (?)').bind(userId).run();
  } catch { /* 無視 */ }
}

// ホワイトラベル設定の取得（無ければ既定値）
export async function getProSettings(DB, userId) {
  let row = null;
  try { row = await DB.prepare('SELECT * FROM pro_settings WHERE pro_user_id = ?').bind(userId).first(); } catch { row = null; }
  return {
    shopName: row?.shop_name || '',
    operatorName: row?.operator_name || '',
    tagline: row?.tagline || '',
    logoData: row?.logo_data || '',
    themeColor: row?.theme_color || '#c9a24b',
    hideBranding: row ? !!row.hide_branding : false,
    animate: row ? !!row.animate : true,
  };
}

export async function saveProSettings(DB, userId, s) {
  const themeColor = /^#[0-9a-fA-F]{6}$/.test(String(s.themeColor || '')) ? s.themeColor : '#c9a24b';
  // ロゴは大きすぎる場合は保存しない（D1行サイズ保護・data URLで~200KBまで）
  let logo = typeof s.logoData === 'string' ? s.logoData : '';
  if (logo && logo.length > 280000) logo = '';
  await DB.prepare(
    `INSERT INTO pro_settings (pro_user_id, shop_name, operator_name, tagline, logo_data, theme_color, hide_branding, animate, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(pro_user_id) DO UPDATE SET shop_name=excluded.shop_name, operator_name=excluded.operator_name,
       tagline=excluded.tagline, logo_data=excluded.logo_data, theme_color=excluded.theme_color,
       hide_branding=excluded.hide_branding, animate=excluded.animate, updated_at=CURRENT_TIMESTAMP`
  ).bind(
    userId,
    String(s.shopName || '').slice(0, 120),
    String(s.operatorName || '').slice(0, 120),
    String(s.tagline || '').slice(0, 200),
    logo,
    themeColor,
    s.hideBranding ? 1 : 0,
    s.animate === false ? 0 : 1,
  ).run();
  return getProSettings(DB, userId);
}
