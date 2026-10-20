import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * 舊資料遷移與 D1 種子檔產生腳本
 * 
 * 功能：
 * 1. 本地遷移 (預設開啟)：將 .data/ 中的資料完整轉移至 SQLite (.data/moztw.db)，供本地開發與測試。
 * 2. 分月產出 D1 匯入 SQL (預設開啟)：產出 migrations/seeds/ 目錄，包含：
 *    - seed_00_snapshot.sql (結構與最新快照)
 *    - seed_records_YYYYMM.sql (各月份時序歷史，採 50 筆多值合併插入 + Transaction + INSERT OR IGNORE)
 * 
 * CLI 選項控制：
 *   --no-db               只生成 SQL 檔，不寫入本地 moztw.db
 *   --no-sql              只寫入本地 moztw.db，不生成 SQL 檔
 *   --month=<YYYYMM>      只產出指定月份的 SQL 檔 (例如 --month=202610)
 *   --batch-size=<N>      自訂多值合併插入每批筆數 (預設: 50)
 *   --all-in-one          額外輸出舊版的單一完整 migrations/seed_for_d1.sql
 */
async function main() {
  const args = process.argv.slice(2);
  const skipDb = args.includes('--no-db');
  const skipSql = args.includes('--no-sql');
  const allInOne = args.includes('--all-in-one');

  let targetMonth: string | null = null;
  const monthArg = args.find(a => a.startsWith('--month='));
  if (monthArg) {
    targetMonth = monthArg.split('=')[1].trim();
  }

  let batchSize = 50;
  const batchArg = args.find(a => a.startsWith('--batch-size='));
  if (batchArg) {
    batchSize = parseInt(batchArg.split('=')[1], 10) || 50;
  }

  const dataDir = path.resolve(process.cwd(), '.data');
  const dbPath = path.join(dataDir, 'moztw.db');
  const seedsDir = path.resolve(process.cwd(), 'migrations', 'seeds');

  console.log('🚀 開始執行舊資料遷移與種子檔產生...');
  console.log(`📁 來源目錄: ${dataDir}`);
  if (!skipDb) console.log(`🗄 目標 SQLite: ${dbPath}`);
  if (!skipSql) console.log(`📄 SQL 輸出目錄: ${seedsDir} (每批 ${batchSize} 筆合併)`);
  if (targetMonth) console.log(`🎯 指定過濾月份: ${targetMonth}`);

  // 確保輸出目錄存在
  if (!skipSql && !fs.existsSync(seedsDir)) {
    fs.mkdirSync(seedsDir, { recursive: true });
  }

  // Schema 定義 (包含 UNIQUE 索引防重複寫入)
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_records_device_ts 
ON sensor_records (device_id, timestamp DESC);

CREATE TABLE IF NOT EXISTS sensor_current (
  device_id TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`.trim();

  // 1. 初始化本地 SQLite (若未指定 --no-db)
  let db: DatabaseSync | null = null;
  let insertCurrentStmt: any = null;
  let insertRecordStmt: any = null;

  if (!skipDb) {
    db = new DatabaseSync(dbPath);
    db.exec(schemaSql);
    db.exec('PRAGMA synchronous = OFF;');
    db.exec('PRAGMA journal_mode = MEMORY;');

    insertCurrentStmt = db.prepare(`
      INSERT INTO sensor_current (device_id, data_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(device_id) DO UPDATE SET
        data_json = excluded.data_json,
        updated_at = excluded.updated_at
    `);

    insertRecordStmt = db.prepare(`
      INSERT OR IGNORE INTO sensor_records (
        device_id, timestamp, temperature, humidity, co2,
        move_detected, brightness, open_state, is_open,
        lastchange, is_webhook, raw_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    console.log('✅ 本地 SQLite 資料表與唯一索引初始化完成');
  }

  // 2. 處理最新快照 (data.json 中的 sensor:* 鍵)
  const snapshotSqlStatements: string[] = [schemaSql];
  const dataJsonPath = path.join(dataDir, 'data.json');
  let currentCount = 0;

  if (fs.existsSync(dataJsonPath)) {
    try {
      const dataJsonContent = fs.readFileSync(dataJsonPath, 'utf-8');
      const parsedData = JSON.parse(dataJsonContent);

      if (db) db.exec('BEGIN TRANSACTION;');

      for (const [key, val] of Object.entries(parsedData)) {
        if (key.startsWith('sensor:')) {
          const deviceId = key.replace('sensor:', '');
          const record = typeof val === 'string' ? JSON.parse(val) : (val as any);
          const updatedAt = record.lastchange || Math.floor(Date.now() / 1000);
          const jsonStr = JSON.stringify(record);

          if (insertCurrentStmt) {
            insertCurrentStmt.run(deviceId, jsonStr, updatedAt);
          }

          snapshotSqlStatements.push(
            `INSERT INTO sensor_current (device_id, data_json, updated_at) VALUES (${escapeSql(deviceId)}, ${escapeSql(jsonStr)}, ${updatedAt}) ON CONFLICT(device_id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at;`
          );
          currentCount++;
        }
      }

      if (db) db.exec('COMMIT;');
      console.log(`✅ 已遷移 ${currentCount} 個感測器的當前快照狀態`);
    } catch (err) {
      if (db) db.exec('ROLLBACK;');
      console.warn('⚠️ 讀取 data.json 時發生警示:', err);
    }
  }

  // 產出快照 SQL
  if (!skipSql) {
    const snapshotPath = path.join(seedsDir, 'seed_00_snapshot.sql');
    fs.writeFileSync(snapshotPath, snapshotSqlStatements.join('\n\n') + '\n', 'utf-8');
    console.log(`📄 已產出快照種子檔: ${snapshotPath} (${currentCount} 筆快照)`);
  }

  // 3. 讀取並分類時序歷史資料 (按月份聚合)
  const files = fs.readdirSync(dataDir);
  const jsonlFiles = files.filter(f => f.startsWith('deviceId:') && f.endsWith('.jsonl'));

  // recordsByMonth: Map<月份, Array<RowData>>
  const recordsByMonth = new Map<string, Array<{
    deviceId: string;
    timestamp: number;
    data: any;
    rawJson: string;
  }>>();

  let totalHistoryParsed = 0;

  for (const file of jsonlFiles) {
    const parts = file.replace('.jsonl', '').split(':');
    const deviceId = parts[1];
    const month = parts[2]; // YYYYMM

    if (!deviceId || !month) continue;
    if (targetMonth && month !== targetMonth) continue;

    const fullPath = path.join(dataDir, file);
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

        if (!recordsByMonth.has(month)) {
          recordsByMonth.set(month, []);
        }

        recordsByMonth.get(month)!.push({
          deviceId,
          timestamp,
          data,
          rawJson
        });

        totalHistoryParsed++;
      } catch {
        // 略過異常行
      }
    }
  }

  console.log(`📦 共解析 ${totalHistoryParsed} 筆歷史資料，涵蓋 ${recordsByMonth.size} 個月份`);

  // 4. 寫入本地 SQLite
  if (db && insertRecordStmt) {
    console.log('⏳ 正在高速匯入本地 SQLite (moztw.db)...');
    db.exec('BEGIN TRANSACTION;');
    let localInserted = 0;

    for (const [, records] of recordsByMonth.entries()) {
      for (const r of records) {
        insertRecordStmt.run(
          r.deviceId,
          r.timestamp,
          r.data.temperature ?? null,
          r.data.humidity ?? null,
          r.data.co2 ?? null,
          r.data.moveDetected !== undefined ? (r.data.moveDetected ? 1 : 0) : null,
          r.data.brightness ?? null,
          r.data.openState ?? null,
          r.data.isOpen !== undefined ? (r.data.isOpen ? 1 : 0) : null,
          r.data.lastchange ?? r.timestamp,
          r.data.isWebhook ? 1 : 0,
          r.rawJson
        );
        localInserted++;
      }
    }

    db.exec('COMMIT;');
    console.log(`✅ 本地 SQLite 匯入完成，共計 ${localInserted} 筆記錄`);
  }

  // 5. 按月份產出 Multi-row INSERT 的分批 SQL 檔案
  const allMonthlySqlStatements: string[] = [];

  if (!skipSql) {
    const sortedMonths = Array.from(recordsByMonth.keys()).sort((a, b) => b.localeCompare(a)); // 倒序由新到舊

    for (const month of sortedMonths) {
      const records = recordsByMonth.get(month)!;
      // 依 timestamp 由新到舊排序
      records.sort((a, b) => b.timestamp - a.timestamp);

      const sqlLines: string[] = [
        `-- MoztW CO2 歷史時序資料種子: ${month} (共 ${records.length} 筆)`
      ];

      for (let i = 0; i < records.length; i += batchSize) {
        const chunk = records.slice(i, i + batchSize);
        const valueClauses = chunk.map(r => formatSqlValue(r.deviceId, r.timestamp, r.data, r.rawJson));

        sqlLines.push(
          `INSERT OR IGNORE INTO sensor_records (\n  device_id, timestamp, temperature, humidity, co2,\n  move_detected, brightness, open_state, is_open,\n  lastchange, is_webhook, raw_json\n) VALUES\n${valueClauses.join(',\n')};`
        );
      }

      const monthFilePath = path.join(seedsDir, `seed_records_${month}.sql`);
      const fileContent = sqlLines.join('\n\n') + '\n';
      fs.writeFileSync(monthFilePath, fileContent, 'utf-8');

      const statementsCount = Math.ceil(records.length / batchSize);
      console.log(`📄 已產出月份種子檔: ${monthFilePath} (${records.length} 筆資料 ➔ 濃縮為 ${statementsCount} 條語句)`);

      if (allInOne) {
        allMonthlySqlStatements.push(fileContent);
      }
    }

    if (allInOne) {
      const legacyPath = path.resolve(process.cwd(), 'migrations', 'seed_for_d1.sql');
      fs.writeFileSync(legacyPath, [snapshotSqlStatements.join('\n\n'), ...allMonthlySqlStatements].join('\n\n'), 'utf-8');
      console.log(`📄 已同步生成全量整合檔案: ${legacyPath}`);
    }
  }

  console.log('\n🎉 資料遷移與種子檔生成作業圓滿完成！');
}

function formatSqlValue(
  deviceId: string,
  timestamp: number,
  data: any,
  rawJson: string
): string {
  const dev = escapeSql(deviceId);
  const ts = timestamp;
  const temp = data.temperature !== undefined && data.temperature !== null ? data.temperature : 'NULL';
  const hum = data.humidity !== undefined && data.humidity !== null ? data.humidity : 'NULL';
  const co2 = data.co2 !== undefined && data.co2 !== null ? data.co2 : 'NULL';
  const move = data.moveDetected !== undefined ? (data.moveDetected ? 1 : 0) : 'NULL';
  const bright = escapeSqlNullable(data.brightness);
  const openState = escapeSqlNullable(data.openState);
  const isOpen = data.isOpen !== undefined ? (data.isOpen ? 1 : 0) : 'NULL';
  const lastchange = data.lastchange ?? timestamp;
  const isWebhook = data.isWebhook ? 1 : 0;
  const jsonStr = escapeSql(rawJson);

  return `  (${dev}, ${ts}, ${temp}, ${hum}, ${co2}, ${move}, ${bright}, ${openState}, ${isOpen}, ${lastchange}, ${isWebhook}, ${jsonStr})`;
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
