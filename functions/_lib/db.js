// D1 の遅延マイグレーション：初回アクセス時にテーブルを用意する（CLI/トークン不要）
let ensured = false;

export async function ensureSchema(DB) {
  if (!DB || ensured) return;
  try {
    await DB.batch([
      DB.prepare(`CREATE TABLE IF NOT EXISTS readings (
        id TEXT PRIMARY KEY,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        anon_id TEXT, divination TEXT, input_json TEXT, summary TEXT, model TEXT
      )`),
      DB.prepare(`CREATE TABLE IF NOT EXISTS feedback (
        id TEXT PRIMARY KEY,
        reading_id TEXT, anon_id TEXT, accurate INTEGER, rating INTEGER, comment TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`),
      DB.prepare(`CREATE INDEX IF NOT EXISTS idx_feedback_reading ON feedback(reading_id)`),
      DB.prepare(`CREATE INDEX IF NOT EXISTS idx_readings_anon ON readings(anon_id)`),
      DB.prepare(`CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        anon_id TEXT, divination TEXT, answers_json TEXT,
        stripe_session_id TEXT,
        status TEXT DEFAULT 'pending',   -- pending / paid / consumed
        reading_id TEXT
      )`),
      DB.prepare(`CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(stripe_session_id)`),
      // ④ 予測較正用：鑑定ごとに確度へ寄与した「パターン」を記録する
      DB.prepare(`CREATE TABLE IF NOT EXISTS pred_signals (
        id TEXT PRIMARY KEY,
        reading_id TEXT, pattern TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`),
      DB.prepare(`CREATE INDEX IF NOT EXISTS idx_pred_reading ON pred_signals(reading_id)`),
      DB.prepare(`CREATE INDEX IF NOT EXISTS idx_pred_pattern ON pred_signals(pattern)`),
      // ── ③ サブスク（継続鑑定＋答え合わせループ） ──
      DB.prepare(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        stripe_customer_id TEXT,
        answers_json TEXT,            -- 継続鑑定の入力（毎月の再計算に使う／手相画像は含めない）
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`),
      DB.prepare(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`),
      DB.prepare(`CREATE INDEX IF NOT EXISTS idx_users_cust ON users(stripe_customer_id)`),
      DB.prepare(`CREATE TABLE IF NOT EXISTS subscriptions (
        user_id TEXT PRIMARY KEY,
        stripe_subscription_id TEXT,
        stripe_customer_id TEXT,
        status TEXT,                  -- active / trialing / past_due / canceled
        current_period_end INTEGER,   -- unix秒
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`),
      DB.prepare(`CREATE TABLE IF NOT EXISTS auth_sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT,
        expires INTEGER,              -- unix秒
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`),
      DB.prepare(`CREATE TABLE IF NOT EXISTS magic_tokens (
        token TEXT PRIMARY KEY,
        email TEXT,
        expires INTEGER,
        used INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`),
      // 継続鑑定の各回（毎月更新）。summaryは本文、data_jsonはwindows/timing等の構造化
      DB.prepare(`CREATE TABLE IF NOT EXISTS sub_readings (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        summary TEXT, data_json TEXT, model TEXT
      )`),
      DB.prepare(`CREATE INDEX IF NOT EXISTS idx_subread_user ON sub_readings(user_id)`),
      // 予測の答え合わせ：各回の主要な「合致窓」を1件=1予測として記録
      DB.prepare(`CREATE TABLE IF NOT EXISTS predictions (
        id TEXT PRIMARY KEY,
        user_id TEXT, reading_id TEXT,
        window_key TEXT, label TEXT, due_ym TEXT,   -- 予測が“過ぎた”判定に使うYYYY-MM
        conf INTEGER, level TEXT, domains TEXT, patterns TEXT,
        checked INTEGER DEFAULT 0, outcome TEXT,     -- hit / partial / miss
        checked_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )`),
      DB.prepare(`CREATE INDEX IF NOT EXISTS idx_pred_user ON predictions(user_id)`),
      // 本人別キャリブレーション：答え合わせの実績（パターン別の的中/外れ）
      DB.prepare(`CREATE TABLE IF NOT EXISTS user_calibration (
        user_id TEXT, pattern TEXT,
        hits INTEGER DEFAULT 0, misses INTEGER DEFAULT 0,
        PRIMARY KEY (user_id, pattern)
      )`),
    ]);
    ensured = true;
  } catch {
    // 失敗しても本体処理は続行（保存は諦める）
  }
}
