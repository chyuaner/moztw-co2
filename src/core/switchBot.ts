import { ISensorDB, createSensorDB } from './db/index.js';

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

/** Cloudflare Workers：用 executionCtx.waitUntil 延後執行背景任務 */
export type DeferTask = (promise: Promise<unknown>) => void;

export interface SaveToStoreOptions {
  defer?: DeferTask;
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
  moveDetected?: boolean;
  moveDetected_lastchange?: number;
  moveDetected_iswebhook?: boolean;
  brightness?: string;
  brightness_lastchange?: number;
  brightness_iswebhook?: boolean;
  openState?: string;
  openState_lastchange?: number;
  openState_iswebhook?: boolean;
  isOpen?: boolean;
  isOpen_lastchange?: number;
  isOpen_iswebhook?: boolean;
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
  private db?: ISensorDB;

  // 在類別頂部定義過期時間變數，單位秒 (預設 1小時 = 3600秒)
  public staleThresholdSeconds: number = 600;

  // 內部變數，只要 fetch 過一次就會一直存著
  private data: SensorDataRecord | null = null;
  public lastchange?: number;
  
  // 避免同時間併發觸發多次 fetch
  private fetchPromise: Promise<SensorDataRecord> | null = null;

  /** 由 getSensors(c) 注入；Cloudflare 上為 waitUntil，本機則為 undefined */
  private defer?: DeferTask;

  constructor(config: SensorConfig, dbOrStore?: ISensorDB | import('./store.js').IStore<SensorDataRecord>) {
    this.id = config.id;
    this.name = config.name;
    this.deviceId = config.deviceId || '';
    this.token = config.token || '';
    this.secret = config.secret || '';
    this.only_webhook = config.only_webhook || false;
    this.thingspeak = config.thingspeak;
    if (dbOrStore) {
      if ('getCurrent' in dbOrStore && 'save' in dbOrStore) {
        this.db = dbOrStore as ISensorDB;
      } else {
        this.db = createSensorDB(dbOrStore as any);
      }
    }
  }

  public setDefer(defer: DeferTask): void {
    this.defer = defer;
  }

  private resolveSaveOptions(options?: SaveToStoreOptions): SaveToStoreOptions | undefined {
    const defer = options?.defer ?? this.defer;
    if (!defer) return options;
    return { ...options, defer };
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

    // 優先從 db 取得前一次紀錄，若無則回退至記憶體中的 data
    const prev = this.db ? await this.db.getCurrent(this.deviceId) : (this.data || undefined);

    // Helper function to consolidate property updates
    const getConsolidatedProperty = <
      K extends 'temperature' | 'humidity' | 'co2' | 'moveDetected' | 'brightness' | 'openState' | 'isOpen'
    >(
      key: K
    ): {
      value: SensorDataRecord[K];
      lastchange: number | undefined;
      iswebhook: boolean | undefined;
    } => {
      const valueKey = key;
      const lastchangeKey = `${key}_lastchange` as keyof SensorDataRecord;
      const isWebhookKey = `${key}_iswebhook` as keyof SensorDataRecord;

      const newValue = newData[valueKey];
      const prevValue = prev?.[valueKey];

      if (newValue !== undefined) {
        let isChanged = false;
        if (prevValue === undefined) {
          isChanged = true;
        } else if (typeof newValue === 'number' || typeof prevValue === 'number') {
          isChanged = Number(newValue) !== Number(prevValue);
        } else {
          isChanged = newValue !== prevValue;
        }

        if (isChanged) {
          // Value changed or first record
          return {
            value: newValue as SensorDataRecord[K],
            lastchange: time, // 使用數據產生的時間戳記
            iswebhook: isWebhook,
          };
        } else {
          // Value unchanged, keep previous metadata
          return {
            value: newValue as SensorDataRecord[K],
            lastchange: (prev?.[lastchangeKey] as number | undefined) || time,
            iswebhook: (prev?.[isWebhookKey] as boolean | undefined) ?? isWebhook,
          };
        }
      } else {
        return {
          value: prevValue as SensorDataRecord[K],
          lastchange: prev?.[lastchangeKey] as number | undefined,
          iswebhook: prev?.[isWebhookKey] as boolean | undefined,
        };
      }
    };

    const tempProps = getConsolidatedProperty('temperature');
    const humProps = getConsolidatedProperty('humidity');
    const co2Props = getConsolidatedProperty('co2');
    const moveDetectedProps = getConsolidatedProperty('moveDetected');
    const brightnessProps = getConsolidatedProperty('brightness');
    const openStateProps = getConsolidatedProperty('openState');
    const isOpenProps = getConsolidatedProperty('isOpen');

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

      moveDetected: moveDetectedProps.value,
      moveDetected_lastchange: moveDetectedProps.lastchange,
      moveDetected_iswebhook: moveDetectedProps.iswebhook,

      brightness: brightnessProps.value,
      brightness_lastchange: brightnessProps.lastchange,
      brightness_iswebhook: brightnessProps.iswebhook,

      openState: openStateProps.value,
      openState_lastchange: openStateProps.lastchange,
      openState_iswebhook: openStateProps.iswebhook,

      isOpen: isOpenProps.value,
      isOpen_lastchange: isOpenProps.lastchange,
      isOpen_iswebhook: isOpenProps.iswebhook,
      
      lastchange: shouldUpdateOverallLastchange ? time : prev?.lastchange,
      isWebhook: isWebhook,
    };
  }

  private async saveToStore(savedata: SensorDataRecord, options?: SaveToStoreOptions) {
    // 提早更新記憶體快取，確保實例狀態即時同步
    this.data = savedata;
    this.lastchange = savedata.lastchange;

    if (!this.db) {
      console.warn(`[SwitchBot] ${this.name} 未綁定資料庫實例，略過持久化儲存`);
      return;
    }

    const isWebhook = savedata.isWebhook || false;
    console.log(`[SwitchBot] ${this.name} 執行儲存 (來源: ${isWebhook ? 'Webhook' : 'Fetch'})`);

    try {
      await this.db.save(this.deviceId, savedata, this.resolveSaveOptions(options));
      console.log(`[Store] ${this.name} 儲存成功, lastchange=${savedata.lastchange}`);
    } catch (err) {
      console.error(`[Store Error] ${this.name} 儲存失敗:`, err);
      throw err;
    }
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
          await resp.text().catch(() => {});
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
  public async updateFromWebhook(context: any, options?: SaveToStoreOptions) {
    const newData: Partial<SensorDataRecord> = {};
    if (context.temperature !== undefined) newData.temperature = context.temperature;
    if (context.humidity !== undefined) newData.humidity = context.humidity;
    if (context.CO2 !== undefined) newData.co2 = context.CO2;
    else if (context.co2 !== undefined) newData.co2 = context.co2;
    if (context.moveDetected !== undefined) newData.moveDetected = context.moveDetected;
    if (context.detectionState !== undefined) {
      newData.moveDetected = context.detectionState === 'DETECTED';
    }
    if (context.brightness !== undefined) newData.brightness = context.brightness;
    if (context.openState !== undefined) {
      newData.openState = context.openState;
      newData.isOpen = (context.openState === 'open' || context.openState === 'timeOutNotClose');
    }

    if (context.timeOfSample) {
      newData.lastchange = context.timeOfSample > 100000000000
        ? Math.floor(context.timeOfSample / 1000)
        : context.timeOfSample;
    }
    newData.isWebhook = true;

    const consolidated = await this.consolidate(newData);
    await this.saveToStore(consolidated, this.resolveSaveOptions(options));

    // 同步到 ThingSpeak (若有 defer 則非同步背景執行，避免阻塞 Webhook 回應)
    if (this.defer) {
      this.defer(this.syncToThingSpeak(consolidated));
    } else {
      await this.syncToThingSpeak(consolidated);
    }
  }

  /**
   * 手動重新抓取資料，並更新內部變數
   * 外部若需要強制更新，可以直接呼叫此方法
   */
  public async fetch(options?: SaveToStoreOptions): Promise<SensorDataRecord> {
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

    const json = (await response.json()) as any;
    
    if (json.statusCode !== 100) {
      throw new Error(`SwitchBot API Error: ${json.message}`);
    }

    const body = json.body || {};
    const newData: Partial<SensorDataRecord> = {
      temperature: body.temperature,
      humidity: body.humidity,
      co2: body.CO2 !== undefined ? body.CO2 : body.co2,
      moveDetected: body.moveDetected,
      brightness: body.brightness,
      openState: body.openState,
    };

    if (body.openState !== undefined) {
      newData.isOpen = (body.openState === 'open' || body.openState === 'timeOutNotClose');
    }

    newData.isWebhook = false;
    const consolidated = await this.consolidate(newData);
    await this.saveToStore(consolidated, this.resolveSaveOptions(options));

    // 同步到 ThingSpeak
    if (this.defer) {
      this.defer(this.syncToThingSpeak(consolidated));
    } else {
      await this.syncToThingSpeak(consolidated);
    }

    return consolidated;
  }

  /**
   * 確保資料已載入，優先從已儲存的資訊輸出，若沒資料或過期才自動 fetch
   */
  private async ensureData(options?: SaveToStoreOptions): Promise<SensorDataRecord> {
    const now = Math.floor(Date.now() / 1000);
    let isStale = true;

    if (this.db) {
      let record = await this.db.getCurrent(this.deviceId);

      const checkStale = (ts?: number) => !ts || (now - ts > this.staleThresholdSeconds);

      if (record) {
        this.data = record;
        this.lastchange = record.lastchange;
        isStale = checkStale(this.lastchange);
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
      const saveOpts = this.resolveSaveOptions(options);
      this.fetchPromise = this.fetch(saveOpts).finally(() => {
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

  public async getAll(options?: SaveToStoreOptions): Promise<SensorDataRecord> {
    return await this.ensureData(options);
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
    if (!this.db) return [];
    return this.db.getHistory(this.deviceId, { limit, offset });
  }

  public async getHistoryAll(): Promise<SensorDataRecord[]> {
    if (!this.db) return [];
    return this.db.getHistory(this.deviceId);
  }

  public async getHistoryByTimestamp(min: number, max?: number): Promise<SensorDataRecord[]> {
    if (!this.db) return [];
    return this.db.getHistory(this.deviceId, { minTimestamp: min, maxTimestamp: max });
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
}
