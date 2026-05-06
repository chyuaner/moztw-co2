export interface SwitchBotData {
  temperature: number;
  humidity: number;
  co2: number;
}

export class SwitchBot {
  private deviceId: string;
  private token: string;
  private secret: string;

  // 內部變數，只要 fetch 過一次就會一直存著
  private data: SwitchBotData | null = null;
  
  // 避免同時間併發觸發多次 fetch
  private fetchPromise: Promise<SwitchBotData> | null = null;

  constructor(
    deviceId: string = process.env.SWITCHBOT_DEVICE_ID || 'YOUR_DEVICE_ID',
    token: string = process.env.SWITCHBOT_TOKEN || '',
    secret: string = process.env.SWITCHBOT_SECRET || ''
  ) {
    this.deviceId = deviceId;
    this.token = token;
    this.secret = secret;
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
