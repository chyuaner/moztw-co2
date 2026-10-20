import { SensorDataRecord } from '../switchBot.js';
import { IStore, KVStore } from '../store.js';
import { KvJsonDriver } from './kvJson.js';
import { D1SqliteDriver, D1Client } from './d1Sqlite.js';

export * from './d1Sqlite.js';
export * from './kvJson.js';

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
 * Cloudflare Workers 原生環境工廠：根據環境變數與綁定自動選擇最佳驅動
 *
 * 支援環境變數 SENSOR_STORAGE:
 * - "d1" (預設): 走 Cloudflare D1 SQL 驅動
 * - "kv": 走 Cloudflare KV 驅動
 */
export function getSensorDB(c: any): ISensorDB {
  const envObj = c?.env || {};
  const storageMode = (envObj.SENSOR_STORAGE || '').toLowerCase();

  // 1. 若指定為 KV 模式
  if (storageMode === 'kv') {
    const store = c.get?.('store') || (c.env?.SENSOR_KV ? new KVStore(c.env.SENSOR_KV) : null);
    if (store) return new KvJsonDriver(store);
  }

  // 2. 預設使用 Cloudflare D1
  if (c.env?.DB) {
    return new D1SqliteDriver(new D1Client(c.env.DB));
  }

  // 3. 若未綁定 D1 則回退至 KV
  if (c.env?.SENSOR_KV) {
    const store = c.get?.('store') || new KVStore(c.env.SENSOR_KV);
    return new KvJsonDriver(store);
  }

  throw new Error('[DB] Cloudflare Workers 環境中找不到 DB (D1) 或 SENSOR_KV 綁定。本地 Node 請使用 getNodeSensorDB()');
}
