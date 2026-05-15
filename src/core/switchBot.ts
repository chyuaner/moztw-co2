export interface SensorConfig {
  id: string;
  name: string;
  vendor?: string;
  deviceId?: string;
  token?: string;
  secret?: string;
  only_webhook?: boolean;
  thingspeak?: Record<string, string>;
}

export interface SensorDataRecord {
  temperature?: number;
  temperature_lastchange?: number;
  temperature_iswebhook?: boolean;
  humidity?: number;
  humidity_lastchange?: number;
  humidity_iswebhook?: boolean;
  co2?: number;
  co2_lastchange?: number;
  co2_iswebhook?: boolean;
  lastchange?: number;
  isWebhook?: boolean; // 新增：標記本次數據來源是否為 webhook
}

export class SwitchBot {
  public id: string;
  public name: string;
  public deviceId: string;
  public only_webhook: boolean = false;
  private token: string;
  private secret: string;
  private thingspeak?: Record<string, string>;
  private store?: import('./store.js').IStore<SensorDataRecord>;

  // 在類別頂部定義過期時間變數，單位秒 (預設 1小時 = 3600秒)
  public staleThresholdSeconds: number = 600;

  // 內部變數，只要 fetch 過一次就會一直存著
  private data: SensorDataRecord | null = null;
  public lastchange?: number;
  
  // 避免同時間併發觸發多次 fetch
  private fetchPromise: Promise<SensorDataRecord> | null = null;

  constructor(config: SensorConfig, store?: import('./store.js').IStore<SensorDataRecord>) {
    this.id = config.id;
    this.name = config.name;
    this.deviceId = config.deviceId || '';
    this.token = config.token || '';
    this.secret = config.secret || '';
    this.only_webhook = config.only_webhook || false;
    this.thingspeak = config.thingspeak;
    this.store = store;
  }

  /**
   * 檢查 Token 是否吻合 (用於 Webhook 安全驗證)
   */
  public checkToken(token: string): boolean {
    return !!this.token && this.token === token;
  }

  private get apiUrl() {
    return `https://api.switch-bot.com/v1.1/devices/${this.deviceId}/status`;
  }

  private async consolidate(newData: Partial<SensorDataRecord>): Promise<SensorDataRecord> {
    const now = Math.floor(Date.now() / 1000);
    const isWebhook = newData.isWebhook || false;
    const time = newData.lastchange || now;
    
    // 如果是 fetch 且設定了 only_webhook，則不更新整體的 lastchange
    const shouldUpdateOverallLastchange = !(this.only_webhook && !isWebhook);

    const recordKey = `sensor:${this.deviceId}`;
    // 優先從 store 取得前一次紀錄，若無則回退至記憶體中的 data
    const prev = this.store ? await this.store.get(recordKey) : (this.data || undefined);

    // Helper function to consolidate property updates
    const getConsolidatedProperty = <K extends 'temperature' | 'humidity' | 'co2'>(
      key: K
    ) => {
      const valueKey = key;
      const lastchangeKey = `${key}_lastchange` as const;
      const isWebhookKey = `${key}_iswebhook` as const;

      const newValue = newData[valueKey];
      const prevValue = prev?.[valueKey];

      if (newValue !== undefined) {
        // 確保數值比較準確 (轉換為 Number 避免字串/數字混合比較問題)
        const isChanged = prevValue === undefined || Number(newValue) !== Number(prevValue);

        if (isChanged) {
          // Value changed or first record
          return {
            value: newValue,
            lastchange: time, // 使用數據產生的時間戳記
            iswebhook: isWebhook,
          };
        } else {
          // Value unchanged, keep previous metadata
          return {
            value: newValue,
            lastchange: prev?.[lastchangeKey] || time,
            iswebhook: prev?.[isWebhookKey] ?? isWebhook,
          };
        }
      } else {
        return {
          value: prevValue,
          lastchange: prev?.[lastchangeKey],
          iswebhook: prev?.[isWebhookKey],
        };
      }
    };

    const tempProps = getConsolidatedProperty('temperature');
    const humProps = getConsolidatedProperty('humidity');
    const co2Props = getConsolidatedProperty('co2');

    return {
      temperature: tempProps.value,
      temperature_lastchange: tempProps.lastchange,
      temperature_iswebhook: tempProps.iswebhook,
      
      humidity: humProps.value,
      humidity_lastchange: humProps.lastchange,
      humidity_iswebhook: humProps.iswebhook,
      
      co2: co2Props.value,
      co2_lastchange: co2Props.lastchange,
      co2_iswebhook: co2Props.iswebhook,
      
      lastchange: shouldUpdateOverallLastchange ? time : prev?.lastchange,
      isWebhook: isWebhook,
    };
  }

  private async saveToStore(savedata: SensorDataRecord) {
    // 提早更新記憶體快取，確保實例狀態即時同步
    this.data = savedata;
    this.lastchange = savedata.lastchange;

    if (!this.store) return;

    const recordKey = `sensor:${this.deviceId}`;
    const isWebhook = savedata.isWebhook || false;

    console.log(`[SwitchBot] ${this.name} 執行儲存 (來源: ${isWebhook ? 'Webhook' : 'Fetch'})`);

    // 1. 優先寫入當前狀態（Bot/API 依賴此 key）
    // scopedPut 會讀寫整包 _m: 索引，隨歷史增長變慢；若放前面，Worker 可能在完成前逾時而永遠跳過此步
    try {
      await this.store.put(recordKey, savedata);
      console.log(`[Store] ${this.name} 當前狀態寫入成功: ${recordKey}, lastchange=${savedata.lastchange}`);
    } catch (err) {
      console.error(`[Store Error] ${this.name} 當前狀態寫入失敗:`, err);
      throw err;
    }

    // 2. 寫入歷史紀錄 (Raw Ingestion)
    try {
      const timestampMs = savedata.lastchange ? savedata.lastchange * 1000 : Date.now();
      const dateStr = new Date(timestampMs).toISOString().split('T')[0].replace(/-/g, '').substring(0, 6);
      const scope = `deviceId:${this.deviceId}:${dateStr}`;
      const timestampStr = `${timestampMs}`;

      await this.store.scopedPut(scope, timestampStr, savedata);
      console.log(`[Store] ${this.name} 歷史紀錄寫入成功, lastchange=${savedata.lastchange}`);
    } catch (err) {
      console.error(`[Store Error] ${this.name} 歷史紀錄寫入失敗:`, err);
    }
  }

  /**
   * 若 sensor: 落後於 _m: 內最新一筆，從歷史修復當前快照（處理過去先寫歷史、逾時未寫 sensor 的情況）
   */
  private async repairCurrentIfBehind(): Promise<SensorDataRecord | null> {
    if (!this.store) return null;

    const recordKey = `sensor:${this.deviceId}`;
    const current = await this.store.get(recordKey);
    const currentTs = current?.lastchange ?? 0;

    const [latest] = await this.getHistory(1, 0);
    if (!latest) return null;

    const latestTs = latest.lastchange ?? 0;
    if (latestTs <= currentTs) return null;

    console.warn(
      `[SwitchBot] ${this.name} sensor: 落後於歷史 (${currentTs} < ${latestTs})，自動修復`
    );
    await this.store.put(recordKey, latest);
    this.data = latest;
    this.lastchange = latest.lastchange;
    return latest;
  }

  public async syncToThingSpeak(data: SensorDataRecord) {
    if (!this.thingspeak) return;

    for (const [key, url] of Object.entries(this.thingspeak)) {
      const value = (data as any)[key];
      if (value !== undefined && value !== null) {
        // 將 %d 替換為欄位值
        const finalUrl = url.replace('%d', String(value));
        console.log(`[ThingSpeak] ${this.name} 同步 ${key} 到: ${finalUrl}`);
        
        try {
          const resp = await fetch(finalUrl);
          if (!resp.ok) {
            console.error(`[ThingSpeak] ${this.name} 同步 ${key} 失敗: ${resp.status} ${resp.statusText}`);
          }
        } catch (err) {
          console.error(`[ThingSpeak] ${this.name} 同步 ${key} 時發生錯誤:`, err);
        }
      }
    }
  }

  /**
   * 提供給 webhook 接收資料使用的 function
   */
  public async updateFromWebhook(context: any) {
    const newData: Partial<SensorDataRecord> = {};
    if (context.temperature !== undefined) newData.temperature = context.temperature;
    if (context.humidity !== undefined) newData.humidity = context.humidity;
    if (context.CO2 !== undefined) newData.co2 = context.CO2;
    else if (context.co2 !== undefined) newData.co2 = context.co2;

    if (context.timeOfSample) {
      newData.lastchange = Math.floor(context.timeOfSample / 1000);
    }
    newData.isWebhook = true;

    const consolidated = await this.consolidate(newData);
    await this.saveToStore(consolidated);

    // 同步到 ThingSpeak
    await this.syncToThingSpeak(consolidated);
  }

  /**
   * 手動重新抓取資料，並更新內部變數
   * 外部若需要強制更新，可以直接呼叫此方法
   */
  public async fetch(): Promise<SensorDataRecord> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = this.token;
    }

    const response = await fetch(this.apiUrl, {
      method: 'GET',
      headers: headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch device status: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    
    if (json.statusCode !== 100) {
      throw new Error(`SwitchBot API Error: ${json.message}`);
    }

    const newData: Partial<SensorDataRecord> = {
      temperature: json.body.temperature,
      humidity: json.body.humidity,
      co2: json.body.CO2 !== undefined ? json.body.CO2 : json.body.co2,
    };

    newData.isWebhook = false;
    const consolidated = await this.consolidate(newData);
    await this.saveToStore(consolidated);

    // 同步到 ThingSpeak
    await this.syncToThingSpeak(consolidated);

    return consolidated;
  }

  /**
   * 確保資料已載入，優先從已儲存的資訊輸出，若沒資料或過期才自動 fetch
   */
  private async ensureData(): Promise<SensorDataRecord> {
    const now = Math.floor(Date.now() / 1000);
    let isStale = true;

    if (this.store) {
      const recordKey = `sensor:${this.deviceId}`;
      let record = await this.store.get(recordKey);

      const checkStale = (ts?: number) => !ts || (now - ts > this.staleThresholdSeconds);

      if (record) {
        this.data = record;
        this.lastchange = record.lastchange;
        isStale = checkStale(this.lastchange);
      }

      // 僅在當前快照可能過期時才比對歷史（避免每次讀取都掃 _m:）
      if (isStale) {
        const repaired = await this.repairCurrentIfBehind();
        if (repaired) {
          record = repaired;
          isStale = checkStale(this.lastchange);
        }
      }
    } else if (this.data) {
       const checkStale = (ts?: number) => !ts || (now - ts > this.staleThresholdSeconds);
       isStale = checkStale(this.lastchange);
    }

    if (!isStale && this.data) {
      return this.data;
    }

    // 如果設定了 only_webhook，則不進行主動 fetch，直接回傳目前有的資料 (不論是否過期)
    if (this.only_webhook) {
      return this.data || {};
    }

    if (!this.fetchPromise) {
      this.fetchPromise = this.fetch().finally(() => {
        this.fetchPromise = null;
      });
    }

    try {
      return await this.fetchPromise;
    } catch (err) {
      console.error(`[SwitchBot] Fetch error for ${this.name}, using stale data if available.`, err);
      if (this.data) return this.data;
      throw err;
    }
  }

  public async getAll(): Promise<SensorDataRecord> {
    return await this.ensureData();
  }

  // ---------------------------------------------------------------------------

  public async getTemperature(): Promise<number | undefined> {
    const data = await this.ensureData();
    return data.temperature;
  }

  public async getHumidity(): Promise<number | undefined> {
    const data = await this.ensureData();
    return data.humidity;
  }

  public async getCo2(): Promise<number | undefined> {
    const data = await this.ensureData();
    return data.co2;
  }

  // ---------------------------------------------------------------------------

  public async getHistory(limit: number, offset: number = 0): Promise<SensorDataRecord[]> {
    if (!this.store) return [];

    try {
      // 1. 找出所有已知的月份索引，並由新到舊排序 (YYYYMM 字典序即時間序)
      const prefix = `_m:deviceId:${this.deviceId}:`;
      const listResult = await this.store.list({ prefix });
      const sortedMonthKeys = listResult.keys
        .map(k => k.name)
        .sort((a, b) => b.localeCompare(a)); 
      
      const results: SensorDataRecord[] = [];
      let skipped = 0;

      // 2. 逐月讀取，直到達到 limit 筆數即停止，節省 KV GET
      for (const key of sortedMonthKeys) {
        const scope = key.replace('_m:', '');
        const data = await this.store.scopedData(scope);
        if (!data) continue;

        // 將該月資料按時間由新到舊排序
        const monthRecords = Object.values(data).sort((a, b) => (b.lastchange || 0) - (a.lastchange || 0));

        for (const record of monthRecords) {
          // 處理偏移量 (offset)
          if (skipped < offset) {
            skipped++;
            continue;
          }

          results.push(record);

          // 達到筆數上限，立即回傳
          if (results.length >= limit) {
            return results;
          }
        }
      }

      return results;
    } catch (err) {
      console.error(`[SwitchBot] getHistory error for ${this.name}:`, err);
      return [];
    }
  }

  public async getHistoryAll(): Promise<SensorDataRecord[]> {
    if (!this.store) return [];

    try {
      // 1. 找出所有已知的月份索引 (利用 _m: 前綴)
      const prefix = `_m:deviceId:${this.deviceId}:`;
      const listResult = await this.store.list({ prefix });
      
      const results: SensorDataRecord[] = [];
      // 2. 對每個月份呼叫一次 scopedData 取得整個月的資料 (有效減少 KV GET 次數)
      for (const key of listResult.keys) {
        const scope = key.name.replace('_m:', '');
        const data = await this.store.scopedData(scope);
        if (data) {
          results.push(...Object.values(data));
        }
      }
      
      // 按時間排序 (由新到舊)
      return results.sort((a, b) => (b.lastchange || 0) - (a.lastchange || 0));
    } catch (err) {
      console.error(`[SwitchBot] getHistoryAll error for ${this.name}:`, err);
      return [];
    }
  }

  public async getHistoryByTimestamp(min: number, max?: number): Promise<SensorDataRecord[]> {
    if (!this.store) return [];

    try {
      // 正規化為秒數，並確保範圍正確
      const normalize = (ts: number) => (ts > 100000000000 ? Math.floor(ts / 1000) : ts);
      const start = normalize(min);
      const end = max !== undefined ? normalize(max) : Math.floor(Date.now() / 1000);

      const realStart = Math.min(start, end);
      const realEnd = Math.max(start, end);

      // 1. 計算範圍內涵蓋的月份
      const months = this.getMonthsInRange(realStart, realEnd);
      
      const results: SensorDataRecord[] = [];
      // 2. 只抓取相關月份的資料
      for (const monthStr of months) {
        const scope = `deviceId:${this.deviceId}:${monthStr}`;
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

      return results.sort((a, b) => (b.lastchange || 0) - (a.lastchange || 0));
    } catch (err) {
      console.error(`[SwitchBot] getHistoryByTimestamp error for ${this.name}:`, err);
      return [];
    }
  }

  public async getHistoryByHours(limit_hours: number, offset_hours: number = 0): Promise<SensorDataRecord[]> {
    const now = Math.floor(Date.now() / 1000);
    const max = now - (offset_hours * 3600);
    const min = max - (limit_hours * 3600);
    return this.getHistoryByTimestamp(min, max);
  }

  public async getHistoryByDays(limit_days: number, offset_days: number = 0): Promise<SensorDataRecord[]> {
    const now = Math.floor(Date.now() / 1000);
    const max = now - (offset_days * 86400);
    const min = max - (limit_days * 86400);
    return this.getHistoryByTimestamp(min, max);
  }

  public async getHistoryByMonths(limit_months: number, offset_months: number = 0): Promise<SensorDataRecord[]> {
    const now = new Date();
    
    // 計算結束時間 (offset 個月前)
    const maxDate = new Date(now);
    maxDate.setMonth(now.getMonth() - offset_months);
    
    // 計算開始時間 (offset + limit 個月前)
    const minDate = new Date(maxDate);
    minDate.setMonth(maxDate.getMonth() - limit_months);
    
    return this.getHistoryByTimestamp(
      Math.floor(minDate.getTime() / 1000),
      Math.floor(maxDate.getTime() / 1000)
    );
  }

  private getMonthsInRange(start: number, end: number): string[] {
    const months: string[] = [];
    let current = new Date(start * 1000);
    const last = new Date(end * 1000);

    // 調整到月初，避免月份加減時因為日期(如31日)產生的跳越問題
    current.setDate(1);
    current.setHours(0, 0, 0, 0);

    while (current <= last) {
      const yyyymm = current.toISOString().split('T')[0].replace(/-/g, '').substring(0, 6);
      months.push(yyyymm);
      current.setMonth(current.getMonth() + 1);
    }

    // 確保最後一個月份有被包含 (雖然 loop 通常已處理，但防呆)
    const lastYm = last.toISOString().split('T')[0].replace(/-/g, '').substring(0, 6);
    if (!months.includes(lastYm)) {
      months.push(lastYm);
    }

    return months;
  }

}
