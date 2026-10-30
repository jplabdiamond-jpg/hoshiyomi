-- Sibylla Vision — D1 スキーマ（鑑定履歴＋フィードバック）
CREATE TABLE IF NOT EXISTS readings (
  id         TEXT PRIMARY KEY,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  anon_id    TEXT,
  divination TEXT,
  input_json TEXT,
  summary    TEXT,
  model      TEXT
);

CREATE TABLE IF NOT EXISTS feedback (
  id         TEXT PRIMARY KEY,
  reading_id TEXT,
  anon_id    TEXT,
  accurate   INTEGER,        -- 1=当たっていた / 0=外れていた
  rating     INTEGER,        -- 任意（1〜5）
  comment    TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feedback_reading ON feedback(reading_id);
CREATE INDEX IF NOT EXISTS idx_readings_anon ON readings(anon_id);
