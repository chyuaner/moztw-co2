export interface SensorConfig {
  id: string;
  name: string;
  vendor?: string;
  deviceId?: string;
  token?: string;
  secret?: string;
}

export interface SwitchBotData {
  temperature: number;
  humidity: number;
  co2: number;
}

export class SwitchBot {
  public id: string;
  public name: string;
  private deviceId: string;
  private token: string;
  private secret: string;
  private store?: import('./store.js').IStore;

  // 內部變數，只要 fetch 過一次就會一直存著
  private data: SwitchBotData | null = null;
  public lastchangeTemperature?: number;
  public lastchangeHumidity?: number;
  public lastchangeCo2?: number;
  
  // 避免同時間併發觸發多次 fetch
  private fetchPromise: Promise<SwitchBotData> | null = null;

  constructor(config: SensorConfig, store?: import('./store.js').IStore) {
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

    // 將資料永久存在內部變數中
    this.data = {
      temperature: json.body.temperature,
      humidity: json.body.humidity,
      co2: json.body.CO2 || json.body.co2,
    };

    if (this.store) {
      const recordKey = `sensor:${this.id}`;
      const now = Math.floor(Date.now() / 1000);
      const prev = await this.store.get(recordKey);

      this.lastchangeTemperature = (prev?.temperature === this.data.temperature) ? (prev?.lastchangeTemperature || now) : now;
      this.lastchangeHumidity = (prev?.humidity === this.data.humidity) ? (prev?.lastchangeHumidity || now) : now;
      this.lastchangeCo2 = (prev?.co2 === this.data.co2) ? (prev?.lastchangeCo2 || now) : now;

      try {
        await this.store.set(recordKey, {
          temperature: this.data.temperature,
          humidity: this.data.humidity,
          co2: this.data.co2,
          lastchangeTemperature: this.lastchangeTemperature,
          lastchangeHumidity: this.lastchangeHumidity,
          lastchangeCo2: this.lastchangeCo2,
        });
      } catch (err) {
        console.error('[Store Error] Failed to update record:', err);
      }
    }

    return this.data;
  }

  /**
   * 確保資料已載入，如果內部變數有值就直接回傳，否則自動 fetch 一次
   */
  private async ensureData(): Promise<SwitchBotData> {
    if (this.data) {
      return this.data;
    }

    if (!this.fetchPromise) {
      this.fetchPromise = this.fetch().finally(() => {
        this.fetchPromise = null;
      });
    }

    return this.fetchPromise;
  }

  public async getAll(): Promise<SwitchBotData> {
    return await this.ensureData();
  }

  public async getTemperature(): Promise<number> {
    const data = await this.ensureData();
    return data.temperature;
  }

  public async getHumidity(): Promise<number> {
    const data = await this.ensureData();
    return data.humidity;
  }

  public async getCo2(): Promise<number> {
    const data = await this.ensureData();
    return data.co2;
  }
}
