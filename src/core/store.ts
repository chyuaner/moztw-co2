export interface IStore<T = any> {
  get(key: string): Promise<T | null>;
  put(key: string, value: T): Promise<void>;
  /**
   * 取得特定範圍內的資料 (對應 Node 模式的獨立檔案或 KV 的 Prefix)
   */
  scopedGet(scope: string, key: string): Promise<T | null>;
  /**
   * 儲存資料到特定範圍 (對應 Node 模式的獨立檔案或 KV 的 Prefix)
   */
  scopedPut(scope: string, key: string, value: T): Promise<void>;
  /**
   * 列出所有符合前綴的 Key (對齊 Cloudflare KV 介面)
   */
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

export class KVStore<T = any> implements IStore<T> {
  constructor(private kv: any) {}

  async get(key: string): Promise<T | null> {
    if (!this.kv) return null;
    const data = await this.kv.get(key, 'json');
    return data as T | null;
  }

  async put(key: string, value: T): Promise<void> {
    if (!this.kv) return;
    await this.kv.put(key, JSON.stringify(value));
  }

  async scopedGet(scope: string, key: string): Promise<T | null> {
    if (!this.kv) return null;
    const fullKey = `${scope}:${key}`;
    const data = await this.kv.get(fullKey, 'json');
    return data as T | null;
  }

  async scopedPut(scope: string, key: string, value: T): Promise<void> {
    if (!this.kv) return;
    const fullKey = `${scope}:${key}`;
    await this.kv.put(fullKey, JSON.stringify(value));
  }

  async list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }> {
    if (!this.kv) return { keys: [], list_complete: true };
    const result = await this.kv.list(options);
    return {
      keys: result.keys.map((k: any) => ({ name: k.name })),
      list_complete: result.list_complete,
      cursor: result.cursor,
    };
  }
}




