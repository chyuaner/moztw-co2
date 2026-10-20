import { ISensorDB } from './index.js';
import { D1SqliteDriver } from './d1Sqlite.js';
import { KvJsonDriver } from './kvJson.js';
import { FileStore } from '../fileStore.js';
import { NodeSqliteClient } from './nodeSqlite.js';

export { NodeSqliteClient } from './nodeSqlite.js';

/**
 * 本地 Node.js / CLI 專用資料庫工廠函式
 * 支援環境變數 SENSOR_STORAGE:
 * - "file": 使用本機 .data/*.json 檔案
 * - "sqlite" (預設): 使用本機 .data/moztw.db SQLite
 */
export function getNodeSensorDB(): ISensorDB {
  const storageMode = (process.env.SENSOR_STORAGE || '').toLowerCase();

  if (storageMode === 'file') {
    const store = new FileStore('./.data');
    return new KvJsonDriver(store);
  }

  return new D1SqliteDriver(new NodeSqliteClient('./.data/moztw.db'));
}

export const getSensorDB = getNodeSensorDB;
