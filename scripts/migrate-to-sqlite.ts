import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * 舊資料遷移腳本：將 .data/ 中的 JSON / JSONL 資料匯入至 SQLite (.data/moztw.db)
 * 並同步輸出 migrations/seed_for_d1.sql 供遠端 Cloudflare D1 匯入使用
 */
async function main() {
  const dataDir = path.resolve(process.cwd(), '.data');
  const dbPath = path.join(dataDir, 'moztw.db');
  const dumpSqlPath = path.resolve(process.cwd(), 'migrations', 'seed_for_d1.sql');

  console.log('🚀 開始執行舊資料遷移...');
  console.log(`📁 來源目錄: ${dataDir}`);
  console.log(`🗄 目標 SQLite: ${dbPath}`);

  // 1. 初始化 SQLite 資料庫與 Schema
  const db = new DatabaseSync(dbPath);

  const schemaSql = `
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

    CREATE INDEX IF NOT EXISTS idx_records_device_ts 
    ON sensor_records (device_id, timestamp DESC);

    CREATE TABLE IF NOT EXISTS sensor_current (
      device_id TEXT PRIMARY KEY,
      data_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `;

  db.exec(schemaSql);
  console.log('✅ SQLite 資料表與索引初始化完成');

  const dumpSqlStatements: string[] = [schemaSql.trim()];

  // 2. 遷移最新狀態 (來自 data.json 中的 sensor:* 鍵)
  const dataJsonPath = path.join(dataDir, 'data.json');
  let currentCount = 0;

  const insertCurrentStmt = db.prepare(`
    INSERT INTO sensor_current (device_id, data_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(device_id) DO UPDATE SET
      data_json = excluded.data_json,
      updated_at = excluded.updated_at
  `);

  if (fs.existsSync(dataJsonPath)) {
    try {
      const dataJsonContent = fs.readFileSync(dataJsonPath, 'utf-8');
      const parsedData = JSON.parse(dataJsonContent);

      for (const [key, val] of Object.entries(parsedData)) {
        if (key.startsWith('sensor:')) {
          const deviceId = key.replace('sensor:', '');
          const record = typeof val === 'string' ? JSON.parse(val) : (val as any);
          const updatedAt = record.lastchange || Math.floor(Date.now() / 1000);
          const jsonStr = JSON.stringify(record);

          insertCurrentStmt.run(deviceId, jsonStr, updatedAt);
          dumpSqlStatements.push(
            `INSERT INTO sensor_current (device_id, data_json, updated_at) VALUES (${escapeSql(deviceId)}, ${escapeSql(jsonStr)}, ${updatedAt}) ON CONFLICT(device_id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at;`
          );
          currentCount++;
        }
      }
      console.log(`✅ 已遷移 ${currentCount} 個感測器的當前快照狀態`);
    } catch (err) {
      console.warn('⚠️ 讀取 data.json 時發生警示:', err);
    }
  }

  // 3. 遷移歷史時序資料 (來自 deviceId:*.jsonl 檔案)
  let historyCount = 0;
  const files = fs.readdirSync(dataDir);
  const jsonlFiles = files.filter(f => f.startsWith('deviceId:') && f.endsWith('.jsonl'));

  const insertRecordStmt = db.prepare(`
    INSERT INTO sensor_records (
      device_id, timestamp, temperature, humidity, co2,
      move_detected, brightness, open_state, is_open,
      lastchange, is_webhook, raw_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const file of jsonlFiles) {
    const fullPath = path.join(dataDir, file);
    // 檔名格式: deviceId:MAC:YYYYMM.jsonl
    const parts = file.replace('.jsonl', '').split(':');
    const deviceId = parts[1];

    if (!deviceId) continue;

    const content = fs.readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const entry = JSON.parse(trimmed);
        const data = typeof entry.v === 'string' ? JSON.parse(entry.v) : entry.v;
        const timestampMs = parseInt(entry.k, 10);
        const timestamp = data.lastchange || Math.floor(timestampMs / 1000);
        const rawJson = JSON.stringify(data);

        insertRecordStmt.run(
          deviceId,
          timestamp,
          data.temperature ?? null,
          data.humidity ?? null,
          data.co2 ?? null,
          data.moveDetected !== undefined ? (data.moveDetected ? 1 : 0) : null,
          data.brightness ?? null,
          data.openState ?? null,
          data.isOpen !== undefined ? (data.isOpen ? 1 : 0) : null,
          data.lastchange ?? timestamp,
          data.isWebhook ? 1 : 0,
          rawJson
        );

        dumpSqlStatements.push(
          `INSERT INTO sensor_records (device_id, timestamp, temperature, humidity, co2, move_detected, brightness, open_state, is_open, lastchange, is_webhook, raw_json) VALUES (${escapeSql(deviceId)}, ${timestamp}, ${data.temperature ?? 'NULL'}, ${data.humidity ?? 'NULL'}, ${data.co2 ?? 'NULL'}, ${data.moveDetected !== undefined ? (data.moveDetected ? 1 : 0) : 'NULL'}, ${escapeSqlNullable(data.brightness)}, ${escapeSqlNullable(data.openState)}, ${data.isOpen !== undefined ? (data.isOpen ? 1 : 0) : 'NULL'}, ${data.lastchange ?? timestamp}, ${data.isWebhook ? 1 : 0}, ${escapeSql(rawJson)});`
        );

        historyCount++;
      } catch (e) {
        // 略過錯誤行
      }
    }
  }

  console.log(`✅ 已遷移 ${historyCount} 筆歷史時序數據到 SQLite`);

  // 4. 產出給 D1 使用的 SQL 匯入檔
  fs.writeFileSync(dumpSqlPath, dumpSqlStatements.join('\n'), 'utf-8');
  console.log(`📄 已生成 D1 匯入種子檔案: ${dumpSqlPath}`);
  console.log('🎉 遷移工作圓滿完成！');
}

function escapeSql(str: string): string {
  return `'${str.replace(/'/g, "''")}'`;
}

function escapeSqlNullable(val?: string | null): string {
  if (val === undefined || val === null) return 'NULL';
  return escapeSql(val);
}

main().catch(err => {
  console.error('❌ 遷移失敗:', err);
  process.exit(1);
});
