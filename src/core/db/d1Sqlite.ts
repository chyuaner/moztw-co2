import { SensorDataRecord } from '../switchBot.js';
import { ISensorDB, HistoryQueryOptions, SaveOptions } from './index.js';

/**
 * 感測器結構化欄位定義 (用於 D1 / SQLite 存取與物件映射)
 * 後續有新感測器欄位時，僅需在此陣列加入一筆定義即可自動同步 save() 與 getHistory()
 */
export interface SensorFieldDefinition {
  /** 資料庫欄位名稱 (SQL column, snake_case) */
  column: string;
  /** SensorDataRecord 中的屬性名稱 (camelCase) */
  property: keyof SensorDataRecord;
  /** 型別轉換方式 */
  type: 'number' | 'string' | 'boolean';
}

export const SENSOR_FIELDS: readonly SensorFieldDefinition[] = [
  { column: 'temperature', property: 'temperature', type: 'number' },
  { column: 'humidity', property: 'humidity', type: 'number' },
  { column: 'co2', property: 'co2', type: 'number' },
  { column: 'move_detected', property: 'moveDetected', type: 'boolean' },
  { column: 'brightness', property: 'brightness', type: 'string' },
  { column: 'open_state', property: 'openState', type: 'string' },
  { column: 'is_open', property: 'isOpen', type: 'boolean' },
  { column: 'lastchange', property: 'lastchange', type: 'number' },
  { column: 'is_webhook', property: 'isWebhook', type: 'boolean' },
] as const;

/** 預先拼裝好的查詢欄位字串 (例如 "timestamp, temperature, humidity, ...") */
const SENSOR_QUERY_COLUMNS = ['timestamp', ...SENSOR_FIELDS.map(f => f.column)].join(', ');

/** 預先拼裝好的 INSERT 欄位與問號佔位符 */
const SENSOR_INSERT_COLUMNS = ['device_id', 'timestamp', ...SENSOR_FIELDS.map(f => f.column), 'raw_json'].join(', ');
const SENSOR_INSERT_PLACEHOLDERS = ['device_id', 'timestamp', ...SENSOR_FIELDS.map(() => '?'), 'raw_json']
  .map(() => '?')
  .join(', ');
const SENSOR_INSERT_SQL = `INSERT OR REPLACE INTO sensor_records (${SENSOR_INSERT_COLUMNS}) VALUES (${SENSOR_INSERT_PLACEHOLDERS})`;

/**
 * 通用 SQL 客戶端介面
 * 抹平 Cloudflare D1 與 Node 原生 SQLite 的 API 差異
 */
export interface ISqlClient {
  all<T = any>(query: string, params?: any[]): Promise<T[]>;
  run(query: string, params?: any[]): Promise<void>;
  exec(sql: string): Promise<void>;
}

/**
 * Cloudflare D1 客戶端實作
 */
export class D1Client implements ISqlClient {
  constructor(private d1: any) {}

  async all<T = any>(query: string, params: any[] = []): Promise<T[]> {
    const stmt = this.d1.prepare(query).bind(...params);
    const res = await stmt.all();
    return (res.results || []) as T[];
  }

  async run(query: string, params: any[] = []): Promise<void> {
    await this.d1.prepare(query).bind(...params).run();
  }

  async exec(sql: string): Promise<void> {
    await this.d1.exec(sql);
  }
}

/**
 * 【層級 3】D1 / SQLite 驅動實作 (SQL 體系)
 * 同時適用於 Cloudflare D1 與 本地 SQLite
 */
export class D1SqliteDriver implements ISensorDB {
  private static schemaReady: boolean = false;

  constructor(private client: ISqlClient) {}

  /**
   * 自動初始化資料庫 Schema (確保資料表與索引就緒)
   */
  private async ensureSchema(): Promise<void> {
    if (D1SqliteDriver.schemaReady) return;

    try {
      await this.client.run(`
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
        )
      `);

      await this.client.run(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_records_device_ts 
        ON sensor_records (device_id, timestamp DESC)
      `);

      await this.client.run(`
        CREATE TABLE IF NOT EXISTS sensor_current (
          device_id TEXT PRIMARY KEY,
          data_json TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);
    } catch (err) {
      console.warn('[D1SqliteDriver] ensureSchema warning:', err);
    }

    D1SqliteDriver.schemaReady = true;
  }

  async getCurrent(deviceId: string): Promise<SensorDataRecord | null> {
    const rows = await this.client.all<{ data_json: string }>(
      'SELECT data_json FROM sensor_current WHERE device_id = ?',
      [deviceId]
    );

    if (!rows || rows.length === 0) return null;

    try {
      return JSON.parse(rows[0].data_json) as SensorDataRecord;
    } catch {
      return null;
    }
  }

  async saveCurrent(deviceId: string, data: SensorDataRecord): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const dataJson = JSON.stringify(data);

    await this.client.run(
      `INSERT INTO sensor_current (device_id, data_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(device_id) DO UPDATE SET
         data_json = excluded.data_json,
         updated_at = excluded.updated_at`,
      [deviceId, dataJson, now]
    );
  }

  async save(deviceId: string, data: SensorDataRecord, _options?: SaveOptions): Promise<void> {
    // 1. 寫入最新快照表
    await this.saveCurrent(deviceId, data);

    // 2. 寫入歷史紀錄表 (時序資料)
    const timestamp = data.lastchange || Math.floor(Date.now() / 1000);
    const rawJson = JSON.stringify(data);

    const values: any[] = [
      deviceId,
      timestamp,
      ...SENSOR_FIELDS.map((f) => {
        const val = (data as any)[f.property];
        if (val === undefined || val === null) {
          if (f.column === 'lastchange') return timestamp;
          if (f.column === 'is_webhook') return 0;
          return null;
        }
        if (f.type === 'boolean') return val ? 1 : 0;
        return val;
      }),
      rawJson,
    ];

    await this.client.run(SENSOR_INSERT_SQL, values);
  }

  async getHistory(deviceId: string, options?: HistoryQueryOptions): Promise<SensorDataRecord[]> {
    const { minTimestamp, maxTimestamp, limit, offset = 0 } = options || {};

    const normalize = (ts: number) => (ts > 100000000000 ? Math.floor(ts / 1000) : ts);

    let query: string;
    const params: any[] = [deviceId];

    // 時間範圍查詢
    if (minTimestamp !== undefined || maxTimestamp !== undefined) {
      const start = normalize(minTimestamp ?? 0);
      const end = maxTimestamp !== undefined ? normalize(maxTimestamp) : Math.floor(Date.now() / 1000);
      const realStart = Math.min(start, end);
      const realEnd = Math.max(start, end);

      query = `SELECT ${SENSOR_QUERY_COLUMNS} FROM sensor_records 
               WHERE device_id = ? AND timestamp >= ? AND timestamp <= ? 
               ORDER BY timestamp DESC`;
      params.push(realStart, realEnd);
    } else {
      query = `SELECT ${SENSOR_QUERY_COLUMNS} FROM sensor_records 
               WHERE device_id = ? 
               ORDER BY timestamp DESC`;
    }

    // 分頁限制
    if (limit !== undefined) {
      query += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);
    } else if (offset > 0) {
      query += ` LIMIT -1 OFFSET ?`;
      params.push(offset);
    }

    const rows = await this.client.all<Record<string, any>>(query, params);

    return rows.map((r) => {
      const record: SensorDataRecord = {
        lastchange: r.lastchange ?? r.timestamp,
      };
      for (const field of SENSOR_FIELDS) {
        const val = r[field.column];
        if (val !== null && val !== undefined) {
          if (field.type === 'boolean') {
            (record as any)[field.property] = Boolean(val);
          } else {
            (record as any)[field.property] = val;
          }
        }
      }
      return record;
    });
  }
}
