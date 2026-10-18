import { SensorDataRecord } from '../switchBot.js';
import { IStore, KVStore } from '../store.js';
import { FileStore } from '../fileStore.js';
import { KvJsonDriver } from './kvJson.js';
import { D1SqliteDriver, D1Client, NodeSqliteClient } from './d1Sqlite.js';

export interface HistoryQueryOptions {
  minTimestamp?: number;
  maxTimestamp?: number;
  limit?: number;
  offset?: number;
}

export interface SaveOptions {
  defer?: (promise: Promise<unknown>) => void;
}

/**
 * 資料庫溝通層抽象介面 (ISensorDB)
 * 統一定義感測器資料庫的操作方法，屏蔽底層實作細節
 */
export interface ISensorDB {
  /** 取得設備當前快照 */
  getCurrent(deviceId: string): Promise<SensorDataRecord | null>;

  /** 儲存設備當前快照 */
  saveCurrent(deviceId: string, data: SensorDataRecord): Promise<void>;

  /** 儲存單筆數據 (包含即時快照與歷史記錄) */
  save(deviceId: string, data: SensorDataRecord, options?: SaveOptions): Promise<void>;

  /** 查詢歷史紀錄 (依時間由新到舊倒序) */
  getHistory(deviceId: string, options?: HistoryQueryOptions): Promise<SensorDataRecord[]>;
}

/**
 * 工廠函式：建立特定 Store 的 KvJsonDriver
 */
export function createSensorDB(store: IStore<SensorDataRecord>): ISensorDB {
  return new KvJsonDriver(store);
}

/**
 * 智慧切換工廠：根據環境變數與綁定自動選擇最佳驅動
 *
 * 支援環境變數 SENSOR_STORAGE:
 * - "d1" 或 "sqlite" (預設): 走 D1 / SQLite SQL 驅動
 * - "kv" 或 "file": 走 KV / FileStore 驅動
 */
export function getSensorDB(c?: any): ISensorDB {
  const envObj = c?.env || (typeof process !== 'undefined' ? process.env : {}) || {};
  const storageMode = (envObj.SENSOR_STORAGE || '').toLowerCase();

  const isWorker = !!(c?.env && (c.env.DB || c.env.SENSOR_KV));

  if (isWorker) {
    // Cloudflare Workers 環境
    if (storageMode === 'kv') {
      const store = c.get?.('store') || (c.env.SENSOR_KV ? new KVStore(c.env.SENSOR_KV) : null);
      if (store) return new KvJsonDriver(store);
    }

    if (c.env?.DB) {
      return new D1SqliteDriver(new D1Client(c.env.DB));
    }

    // 若未綁定 D1 則回退至 KV
    if (c.env?.SENSOR_KV) {
      const store = c.get?.('store') || new KVStore(c.env.SENSOR_KV);
      return new KvJsonDriver(store);
    }
  }

  // 本地 Node.js / CLI / Standalone 環境
  if (storageMode === 'file') {
    const store = new FileStore('./.data');
    return new KvJsonDriver(store);
  }

  // 本地預設使用 SQLite
  return new D1SqliteDriver(new NodeSqliteClient('./.data/moztw.db'));
}
