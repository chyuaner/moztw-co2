import { SensorDataRecord } from '../switchBot.js';
import { IStore } from '../store.js';
import { KvJsonDriver } from './kvJson.js';

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
 * 建立資料庫溝通層實例的工廠函式
 */
export function createSensorDB(store: IStore<SensorDataRecord>): ISensorDB {
  return new KvJsonDriver(store);
}
