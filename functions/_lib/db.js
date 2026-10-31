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
    ]);
    ensured = true;
  } catch {
    // 失敗しても本体処理は続行（保存は諦める）
  }
}
