// D1 の遅延マイグレーション：初回アクセス時にテーブルを用意する（CLI/トークン不要）
//
// 以前は全CREATE文を 1つの DB.batch()（単一トランザクション）で実行していたが、
// その方式だと「どれか1文が失敗すると全体がロールバックし、さらに try/catch で握り潰すため
// 1つもテーブルが作られないのに成功扱いになる」という不具合があった（③④のテーブルが本番で未作成）。
// 対策として各文を個別に実行し、1文が失敗しても他は作成されるようにする。
// すべて成功したときだけ ensured=true にして、以降の無駄な再実行を避ける（部分失敗なら次回再試行）。
let ensured = false;

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS readings (
    id TEXT PRIMARY KEY,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    anon_id TEXT, divination TEXT, input_json TEXT, summary TEXT, model TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    reading_id TEXT, anon_id TEXT, accurate INTEGER, rating INTEGER, comment TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_feedback_reading ON feedback(reading_id)`,
  `CREATE INDEX IF NOT EXISTS idx_readings_anon ON readings(anon_id)`,
  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    anon_id TEXT, divination TEXT, answers_json TEXT,
    stripe_session_id TEXT,
    status TEXT DEFAULT 'pending',
    reading_id TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_orders_session ON orders(stripe_session_id)`,
  `CREATE TABLE IF NOT EXISTS pred_signals (
    id TEXT PRIMARY KEY,
    reading_id TEXT, pattern TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pred_reading ON pred_signals(reading_id)`,
  `CREATE INDEX IF NOT EXISTS idx_pred_pattern ON pred_signals(pattern)`,
  // ── ③ サブスク（継続鑑定＋答え合わせループ） ──
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE,
    stripe_customer_id TEXT,
    answers_json TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
  `CREATE INDEX IF NOT EXISTS idx_users_cust ON users(stripe_customer_id)`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
    user_id TEXT PRIMARY KEY,
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    status TEXT,
    current_period_end INTEGER,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS auth_sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT,
    expires INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS magic_tokens (
    token TEXT PRIMARY KEY,
    email TEXT,
    expires INTEGER,
    used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS sub_readings (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    summary TEXT, data_json TEXT, model TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_subread_user ON sub_readings(user_id)`,
  `CREATE TABLE IF NOT EXISTS predictions (
    id TEXT PRIMARY KEY,
    user_id TEXT, reading_id TEXT,
    window_key TEXT, label TEXT, due_ym TEXT,
    conf INTEGER, level TEXT, domains TEXT, patterns TEXT,
    checked INTEGER DEFAULT 0, outcome TEXT,
    checked_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_pred_user ON predictions(user_id)`,
  `CREATE TABLE IF NOT EXISTS user_calibration (
    user_id TEXT, pattern TEXT,
    hits INTEGER DEFAULT 0, misses INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, pattern)
  )`,
  // ── 占い師プラン（¥2,000/月・使い放題／B2B2C） ──
  `CREATE TABLE IF NOT EXISTS pro_users (
    user_id TEXT PRIMARY KEY,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    pro_user_id TEXT,
    name TEXT, kana TEXT,
    birth_date TEXT, birth_time TEXT, birth_place TEXT,
    gender TEXT, hand TEXT, sei TEXT, mei TEXT,
    memo TEXT,
    answers_json TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_clients_pro ON clients(pro_user_id)`,
  `CREATE TABLE IF NOT EXISTS client_readings (
    id TEXT PRIMARY KEY,
    client_id TEXT, pro_user_id TEXT,
    divination TEXT, title TEXT,
    summary TEXT, data_json TEXT, model TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE INDEX IF NOT EXISTS idx_creadings_client ON client_readings(client_id)`,
  `CREATE INDEX IF NOT EXISTS idx_creadings_pro ON client_readings(pro_user_id)`,
  `CREATE TABLE IF NOT EXISTS pro_settings (
    pro_user_id TEXT PRIMARY KEY,
    shop_name TEXT, operator_name TEXT, tagline TEXT,
    logo_data TEXT,
    theme_color TEXT,
    hide_branding INTEGER DEFAULT 0,
    animate INTEGER DEFAULT 1,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
];

export async function ensureSchema(DB) {
  if (!DB || ensured) return;
  let failed = 0;
  for (const sql of STATEMENTS) {
    try {
      await DB.prepare(sql).run();
    } catch (e) {
      failed++;
      // 1文の失敗で全体を止めない。次の文へ進む（次回アクセスで再試行される）。
      console.error('ensureSchema statement failed:', String((e && e.message) || e));
    }
  }
  if (failed === 0) ensured = true;
}
