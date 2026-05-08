export interface SensorConfig {
  id: string;
  name: string;
  vendor?: string;
  deviceId?: string;
  token?: string;
  secret?: string;
}

export interface SensorDataRecord {
  temperature?: number;
  humidity?: number;
  co2?: number;
  lastchangeTemperature?: number;
  lastchangeHumidity?: number;
  lastchangeCo2?: number;
  lastchange?: number;
}

export interface SwitchBotData {
  temperature?: number;
  humidity?: number;
  co2?: number;
}

export class SwitchBot {
  public id: string;
  public name: string;
  public deviceId: string;
  private token: string;
  private secret: string;
  private store?: import('./store.js').IStore<SensorDataRecord>;

  // 在類別頂部定義過期時間變數，單位秒 (預設 1小時 = 3600秒)
  public staleThresholdSeconds: number = 3600;

  // 內部變數，只要 fetch 過一次就會一直存著
  private data: SwitchBotData | null = null;
  public lastchangeTemperature?: number;
  public lastchangeHumidity?: number;
  public lastchangeCo2?: number;
  public lastchange?: number;
  
  // 避免同時間併發觸發多次 fetch
  private fetchPromise: Promise<SwitchBotData> | null = null;

  constructor(config: SensorConfig, store?: import('./store.js').IStore<SensorDataRecord>) {
    this.id = config.id;
    this.name = config.name;
    this.deviceId = config.deviceId || '';
    this.token = config.token || '';
    this.secret = config.secret || '';
    this.store = store;
  }

  private get apiUrl() {
    return `https://api.switch-bot.com/v1.1/devices/${this.deviceId}/status`;
  }

  /**
   * 共用的儲存邏輯
   * 無論是主動詢問(fetch)還是被動接收(webhook)，最後儲存時都走一樣的邏輯
   */
  private async saveToStore(newData: Partial<SwitchBotData>, updateTime?: number) {
    const now = Math.floor(Date.now() / 1000);
    const time = updateTime || now;
    
    if (!this.store) {
       this.lastchangeTemperature = (this.data?.temperature === newData.temperature) ? (this.lastchangeTemperature || now) : now;
       this.lastchangeHumidity = (this.data?.humidity === newData.humidity) ? (this.lastchangeHumidity || now) : now;
       this.lastchangeCo2 = (this.data?.co2 === newData.co2) ? (this.lastchangeCo2 || now) : now;
       this.lastchange = time;
       return;
    }

    const recordKey = `sensor:${this.id}`;
    const prev = await this.store.get(recordKey);

    const updatedTemperature = newData.temperature !== undefined ? newData.temperature : prev?.temperature;
    const updatedHumidity = newData.humidity !== undefined ? newData.humidity : prev?.humidity;
    const updatedCo2 = newData.co2 !== undefined ? newData.co2 : prev?.co2;

    this.lastchangeTemperature = (prev?.temperature === updatedTemperature) ? (prev?.lastchangeTemperature || now) : now;
    this.lastchangeHumidity = (prev?.humidity === updatedHumidity) ? (prev?.lastchangeHumidity || now) : now;
    this.lastchangeCo2 = (prev?.co2 === updatedCo2) ? (prev?.lastchangeCo2 || now) : now;
    this.lastchange = time;

    try {
      await this.store.set(recordKey, {
        temperature: updatedTemperature,
        humidity: updatedHumidity,
        co2: updatedCo2,
        lastchangeTemperature: this.lastchangeTemperature,
        lastchangeHumidity: this.lastchangeHumidity,
        lastchangeCo2: this.lastchangeCo2,
        lastchange: this.lastchange,
      });
    } catch (err) {
      console.error('[Store Error] Failed to update record:', err);
    }
  }

  /**
   * 提供給 webhook 接收資料使用的 function
   */
  public async updateFromWebhook(context: any) {
    const newData: Partial<SwitchBotData> = {};
    if (context.temperature !== undefined) newData.temperature = context.temperature;
    if (context.humidity !== undefined) newData.humidity = context.humidity;
    if (context.CO2 !== undefined) newData.co2 = context.CO2;
    else if (context.co2 !== undefined) newData.co2 = context.co2;

    let updateTime: number | undefined;
    if (context.timeOfSample) {
      updateTime = Math.floor(context.timeOfSample / 1000);
    }

    await this.saveToStore(newData, updateTime);

    // 更新記憶體資料
    if (this.data) {
      if (newData.temperature !== undefined) this.data.temperature = newData.temperature;
      if (newData.humidity !== undefined) this.data.humidity = newData.humidity;
      if (newData.co2 !== undefined) this.data.co2 = newData.co2;
    } else {
      this.data = {
        temperature: newData.temperature,
        humidity: newData.humidity,
        co2: newData.co2,
      };
    }
  }

  /**
   * 手動重新抓取資料，並更新內部變數
   * 外部若需要強制更新，可以直接呼叫此方法
   */
  public async fetch(): Promise<SwitchBotData> {
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

    const newData: Partial<SwitchBotData> = {
      temperature: json.body.temperature,
      humidity: json.body.humidity,
      co2: json.body.CO2 !== undefined ? json.body.CO2 : json.body.co2,
    };

    await this.saveToStore(newData);

    this.data = newData;
    return this.data;
  }

  /**
   * 確保資料已載入，優先從已儲存的資訊輸出，若沒資料或過期才自動 fetch
   */
  private async ensureData(): Promise<SwitchBotData> {
    const now = Math.floor(Date.now() / 1000);
    let isStale = true;

    if (this.store) {
      const recordKey = `sensor:${this.id}`;
      const record = await this.store.get(recordKey);
      
      if (record) {
        this.data = {
          temperature: record.temperature !== undefined ? record.temperature : this.data?.temperature,
          humidity: record.humidity !== undefined ? record.humidity : this.data?.humidity,
          co2: record.co2 !== undefined ? record.co2 : this.data?.co2,
        };
        this.lastchangeTemperature = record.lastchangeTemperature;
        this.lastchangeHumidity = record.lastchangeHumidity;
        this.lastchangeCo2 = record.lastchangeCo2;
        this.lastchange = record.lastchange;

        const checkStale = (ts?: number) => !ts || (now - ts > this.staleThresholdSeconds);
        
        const tsStale = checkStale(this.lastchangeTemperature);
        const humStale = checkStale(this.lastchangeHumidity);
        const coStale = record.co2 !== undefined ? checkStale(this.lastchangeCo2) : false;
        
        isStale = tsStale || humStale || coStale;
      }
    } else if (this.data) {
       const checkStale = (ts?: number) => !ts || (now - ts > this.staleThresholdSeconds);
       isStale = checkStale(this.lastchangeTemperature) || checkStale(this.lastchangeHumidity) || (this.data.co2 !== undefined && checkStale(this.lastchangeCo2));
    }

    if (!isStale && this.data) {
      return this.data;
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

  public async getAll(): Promise<SwitchBotData> {
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
