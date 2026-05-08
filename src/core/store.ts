export interface SensorDataRecord {
  temperature?: number;
  humidity?: number;
  co2?: number;
  lastchangeTemperature?: number;
  lastchangeHumidity?: number;
  lastchangeCo2?: number;
}

export interface IStore {
  get(key: string): Promise<SensorDataRecord | null>;
  set(key: string, value: SensorDataRecord): Promise<void>;
}

export class KVStore implements IStore {
  constructor(private kv: any) {}

  async get(key: string): Promise<SensorDataRecord | null> {
    if (!this.kv) return null;
    const data = await this.kv.get(key, 'json');
    return data as SensorDataRecord | null;
  }

  async set(key: string, value: SensorDataRecord): Promise<void> {
    if (!this.kv) return;
    await this.kv.put(key, JSON.stringify(value));
  }
}
