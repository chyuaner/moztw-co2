-- 1. 歷史紀錄表 (時序資料)
CREATE TABLE IF NOT EXISTS sensor_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  temperature REAL,
  humidity REAL,
  co2 INTEGER,
  move_detected INTEGER,
  brightness TEXT,
  open_state TEXT,
  is_open INTEGER,
  lastchange INTEGER,
  is_webhook INTEGER DEFAULT 0,
  raw_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 建立依裝置與時間倒序的唯一複合索引 (防止重試或重複匯入)
CREATE UNIQUE INDEX IF NOT EXISTS idx_records_device_ts 
ON sensor_records (device_id, timestamp DESC);

-- 2. 最新狀態快照表 (加速即時 API 與 Telegram Bot 查詢)
CREATE TABLE IF NOT EXISTS sensor_current (
  device_id TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
