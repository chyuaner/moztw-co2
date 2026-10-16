import { IStore } from '../store.js';
import { SensorDataRecord } from '../switchBot.js';
import { ISensorDB, HistoryQueryOptions, SaveOptions } from './index.js';

/**
 * 【層級 4】KV / JSON 驅動實作
 * 封裝原有 Cloudflare KV (Worker) 與 FileStore (Node.js) 的全部時序存取與快取邏輯
 */
export class KvJsonDriver implements ISensorDB {
  constructor(private store: IStore<SensorDataRecord>) {}

  private getRecordKey(deviceId: string): string {
    return `sensor:${deviceId}`;
  }

  private getScope(deviceId: string, timestampMs: number): string {
    const dateStr = new Date(timestampMs).toISOString().split('T')[0].replace(/-/g, '').substring(0, 6);
    return `deviceId:${deviceId}:${dateStr}`;
  }

  async getCurrent(deviceId: string): Promise<SensorDataRecord | null> {
    const recordKey = this.getRecordKey(deviceId);
    let record = await this.store.get(recordKey);

    // 檢查快照是否落後於最新歷史資料 (歷史修復機制)
    const [latest] = await this.getHistory(deviceId, { limit: 1, offset: 0 });
    if (latest) {
      const currentTs = record?.lastchange ?? 0;
      const latestTs = latest.lastchange ?? 0;
      if (latestTs > currentTs) {
        console.warn(`[KvJsonDriver] ${deviceId} sensor: 快照落後於歷史 (${currentTs} < ${latestTs})，自動修復`);
        await this.saveCurrent(deviceId, latest);
        record = latest;
      }
    }

    return record;
  }

  async saveCurrent(deviceId: string, data: SensorDataRecord): Promise<void> {
    const recordKey = this.getRecordKey(deviceId);
    await this.store.put(recordKey, data);
  }

  async save(deviceId: string, data: SensorDataRecord, options?: SaveOptions): Promise<void> {
    // 1. 寫入當前狀態快照
    await this.saveCurrent(deviceId, data);

    // 2. 寫入歷史單筆資料 (_s: 前綴)
    const timestampMs = data.lastchange ? data.lastchange * 1000 : Date.now();
    const scope = this.getScope(deviceId, timestampMs);
    const timestampStr = `${timestampMs}`;

    try {
      await this.store.scopedPut(scope, timestampStr, data, { skipMeta: true });
    } catch (err) {
      console.error(`[KvJsonDriver Error] ${deviceId} 歷史單筆寫入失敗:`, err);
    }

    // 3. 背景或同步更新 _m: 月份快取索引
    const mergeMeta = async () => {
      try {
        await this.store.scopedMergeMeta(scope, timestampStr, data);
      } catch (err) {
        console.error(`[KvJsonDriver Error] ${deviceId} _m 索引更新失敗:`, err);
      }
    };

    if (options?.defer) {
      options.defer(mergeMeta());
    } else {
      await mergeMeta();
    }
  }

  async getHistory(deviceId: string, options?: HistoryQueryOptions): Promise<SensorDataRecord[]> {
    const { minTimestamp, maxTimestamp, limit, offset = 0 } = options || {};

    // 模式 A：指定時間範圍 (時間戳記過濾)
    if (minTimestamp !== undefined || maxTimestamp !== undefined) {
      const normalize = (ts: number) => (ts > 100000000000 ? Math.floor(ts / 1000) : ts);
      const start = normalize(minTimestamp ?? 0);
      const end = maxTimestamp !== undefined ? normalize(maxTimestamp) : Math.floor(Date.now() / 1000);

      const realStart = Math.min(start, end);
      const realEnd = Math.max(start, end);

      const months = this.getMonthsInRange(realStart, realEnd);
      const results: SensorDataRecord[] = [];

      for (const monthStr of months) {
        const scope = `deviceId:${deviceId}:${monthStr}`;
        const data = await this.store.scopedData(scope);
        if (data) {
          for (const record of Object.values(data)) {
            const ts = record.lastchange || 0;
            if (ts >= realStart && ts <= realEnd) {
              results.push(record);
            }
          }
        }
      }

      results.sort((a, b) => (b.lastchange || 0) - (a.lastchange || 0));
      const finalLimit = limit !== undefined ? limit : results.length;
      return results.slice(offset, offset + finalLimit);
    }

    // 模式 B：分頁查詢 (從最新的月份逐月讀取)
    try {
      const prefix = `_m:deviceId:${deviceId}:`;
      const listResult = await this.store.list({ prefix });
      const sortedMonthKeys = listResult.keys
        .map(k => k.name)
        .sort((a, b) => b.localeCompare(a));

      const results: SensorDataRecord[] = [];
      let skipped = 0;

      for (const key of sortedMonthKeys) {
        const scope = key.replace('_m:', '');
        const data = await this.store.scopedData(scope);
        if (!data) continue;

        const monthRecords = Object.values(data).sort((a, b) => (b.lastchange || 0) - (a.lastchange || 0));

        for (const record of monthRecords) {
          if (skipped < offset) {
            skipped++;
            continue;
          }

          results.push(record);

          if (limit !== undefined && results.length >= limit) {
            return results;
          }
        }
      }

      return results;
    } catch (err) {
      console.error(`[KvJsonDriver Error] getHistory error for ${deviceId}:`, err);
      return [];
    }
  }

  private getMonthsInRange(start: number, end: number): string[] {
    const months: string[] = [];
    let current = new Date(start * 1000);
    const last = new Date(end * 1000);

    current.setDate(1);
    current.setHours(0, 0, 0, 0);

    while (current <= last) {
      const yyyymm = current.toISOString().split('T')[0].replace(/-/g, '').substring(0, 6);
      months.push(yyyymm);
      current.setMonth(current.getMonth() + 1);
    }

    const lastYm = last.toISOString().split('T')[0].replace(/-/g, '').substring(0, 6);
    if (!months.includes(lastYm)) {
      months.push(lastYm);
    }

    return months;
  }
}
