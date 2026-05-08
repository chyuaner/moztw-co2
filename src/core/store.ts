export interface IStore<T = any> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T): Promise<void>;
}

export class KVStore<T = any> implements IStore<T> {
  constructor(private kv: any) {}

  async get(key: string): Promise<T | null> {
    if (!this.kv) return null;
    const data = await this.kv.get(key, 'json');
    return data as T | null;
  }

  async set(key: string, value: T): Promise<void> {
    if (!this.kv) return;
    await this.kv.put(key, JSON.stringify(value));
  }
}
