export interface SensorConfig {
  id: string;
  name: string;
  vendor?: string;
  deviceId?: string;
  token?: string;
  secret?: string;
  only_webhook?: boolean;
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
}

export class SwitchBot {
  public id: string;
  public name: string;
  public deviceId: string;
  public only_webhook: boolean = false;
  private token: string;
  private secret: string;
  private store?: import('./store.js').IStore<SensorDataRecord>;

  // 在類別頂部定義過期時間變數，單位秒 (預設 1小時 = 3600秒)
  public staleThresholdSeconds: number = 300;

  // 內部變數，只要 fetch 過一次就會一直存著
  private data: SensorDataRecord | null = null;
  public temperature_lastchange?: number;
  public temperature_iswebhook?: boolean;
  public humidity_lastchange?: number;
  public humidity_iswebhook?: boolean;
  public co2_lastchange?: number;
  public co2_iswebhook?: boolean;
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
    this.store = store;
  }

  private get apiUrl() {
    return `https://api.switch-bot.com/v1.1/devices/${this.deviceId}/status`;
  }

  /**
   * 共用的儲存邏輯
   * 無論是主動詢問(fetch)還是被動接收(webhook)，最後儲存時都走一樣的邏輯
   */
  private async saveToStore(newData: Partial<SensorDataRecord>, updateTime?: number, isWebhook: boolean = false) {
    const now = Math.floor(Date.now() / 1000);
    const time = updateTime || now;
    
    // 如果是 fetch 且設定了 only_webhook，則不更新整體的 lastchange
    const shouldUpdateOverallLastchange = !(this.only_webhook && !isWebhook);

    if (!this.store) {
       if (newData.temperature !== undefined) {
         this.temperature_lastchange = (this.data?.temperature === newData.temperature) ? (this.temperature_lastchange || now) : now;
         this.temperature_iswebhook = isWebhook;
       }
       if (newData.humidity !== undefined) {
         this.humidity_lastchange = (this.data?.humidity === newData.humidity) ? (this.humidity_lastchange || now) : now;
         this.humidity_iswebhook = isWebhook;
       }
       if (newData.co2 !== undefined) {
         this.co2_lastchange = (this.data?.co2 === newData.co2) ? (this.co2_lastchange || now) : now;
         this.co2_iswebhook = isWebhook;
       }
       if (shouldUpdateOverallLastchange) {
         this.lastchange = time;
       }
       return;
    }

    const recordKey = `sensor:${this.deviceId}`;
    const prev = await this.store.get(recordKey);

    const updatedTemperature = newData.temperature !== undefined ? newData.temperature : prev?.temperature;
    const updatedHumidity = newData.humidity !== undefined ? newData.humidity : prev?.humidity;
    const updatedCo2 = newData.co2 !== undefined ? newData.co2 : prev?.co2;

    if (newData.temperature !== undefined) {
      this.temperature_lastchange = (prev?.temperature === updatedTemperature) ? (prev?.temperature_lastchange || now) : now;
      this.temperature_iswebhook = isWebhook;
    } else {
      this.temperature_lastchange = prev?.temperature_lastchange;
      this.temperature_iswebhook = prev?.temperature_iswebhook;
    }

    if (newData.humidity !== undefined) {
      this.humidity_lastchange = (prev?.humidity === updatedHumidity) ? (prev?.humidity_lastchange || now) : now;
      this.humidity_iswebhook = isWebhook;
    } else {
      this.humidity_lastchange = prev?.humidity_lastchange;
      this.humidity_iswebhook = prev?.humidity_iswebhook;
    }

    if (newData.co2 !== undefined) {
      this.co2_lastchange = (prev?.co2 === updatedCo2) ? (prev?.co2_lastchange || now) : now;
      this.co2_iswebhook = isWebhook;
    } else {
      this.co2_lastchange = prev?.co2_lastchange;
      this.co2_iswebhook = prev?.co2_iswebhook;
    }

    if (shouldUpdateOverallLastchange) {
      this.lastchange = time;
    } else {
      this.lastchange = prev?.lastchange;
    }

    const savedata: SensorDataRecord = {
      temperature: updatedTemperature,
      temperature_lastchange: this.temperature_lastchange,
      temperature_iswebhook: this.temperature_iswebhook,
      humidity: updatedHumidity,
      humidity_lastchange: this.humidity_lastchange,
      humidity_iswebhook: this.humidity_iswebhook,
      co2: updatedCo2,
      co2_lastchange: this.co2_lastchange,
      co2_iswebhook: this.co2_iswebhook,
      lastchange: this.lastchange,
    };

    // 1. 更新當前狀態 (用於 API/Bot 快速查詢)
    // 只有在數值有變動，或者距離上次同步超過一定時間（例如一小時）才強制寫入 KV 節省次數
    const isDataChanged = 
      (newData.temperature !== undefined && prev?.temperature !== updatedTemperature) ||
      (newData.humidity !== undefined && prev?.humidity !== updatedHumidity) ||
      (newData.co2 !== undefined && prev?.co2 !== updatedCo2);

    try {
      await this.store.put(recordKey, savedata);
      this.data = savedata; // 更新記憶體緩存
    } catch (err) {
      console.error('[Store Error] Failed to update current record:', err);
    }

    // 2. 寫入原始資料 (Raw Ingestion)
    // 如果數值完全沒變，就跳過歷史紀錄寫入，節省 KV PUT 額度
    if (!isDataChanged) {
      return;
    }

    try {
      const timestampMs = this.lastchange ? this.lastchange * 1000 : Date.now();
      const dateStr = new Date(timestampMs).toISOString().split('T')[0].replace(/-/g, '').substring(0, 6); // YYYYMM (按月分桶)
      const scope = `deviceId:${this.deviceId}:${dateStr}`;
      const timestampStr = `${timestampMs}`;
      
      if (this.store) {
        await this.store.scopedPut(scope, timestampStr, savedata);
      }
    } catch (err) {
      console.error('[Store Error] Failed to write raw ingestion record:', err);
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

    let updateTime: number | undefined;
    if (context.timeOfSample) {
      updateTime = Math.floor(context.timeOfSample / 1000);
    }

    await this.saveToStore(newData, updateTime, true);
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

    await this.saveToStore(newData, undefined, false);

    return this.data || {};
  }

  /**
   * 確保資料已載入，優先從已儲存的資訊輸出，若沒資料或過期才自動 fetch
   */
  private async ensureData(): Promise<SensorDataRecord> {
    const now = Math.floor(Date.now() / 1000);
    let isStale = true;

    if (this.store) {
      const recordKey = `sensor:${this.deviceId}`;
      const record = await this.store.get(recordKey);
      
      if (record) {
        this.data = record;
        this.temperature_lastchange = record.temperature_lastchange;
        this.temperature_iswebhook = record.temperature_iswebhook;
        this.humidity_lastchange = record.humidity_lastchange;
        this.humidity_iswebhook = record.humidity_iswebhook;
        this.co2_lastchange = record.co2_lastchange;
        this.co2_iswebhook = record.co2_iswebhook;
        this.lastchange = record.lastchange;

        const checkStale = (ts?: number) => !ts || (now - ts > this.staleThresholdSeconds);
        
        // 改用整體的 lastchange (最後同步時間) 來判斷是否過期
        // 這樣即使數值沒變，只要剛同步過，就不會重複 fetch
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
}

