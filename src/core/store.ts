export interface IStore<T = any> {
  get(key: string): Promise<T | null>;
  put(key: string, value: T): Promise<void>;
  /**
   * 取得特定範圍內的資料 (對應 Node 模式的獨立檔案或 KV 的 Prefix)
   */
  scopedGet(scope: string, key: string): Promise<T | null>;
  /**
   * 儲存資料到特定範圍 (對應 Node 模式的獨立檔案或 KV 的 Prefix)
  /**
   * 儲存資料到特定範圍 (對應 Node 模式的獨立檔案或 KV 的 Prefix)
   */
  scopedPut(scope: string, key: string, value: T): Promise<void>;
  /**
   * 列出所有符合前綴的 Key (僅限非 Scoped 的主資料)
   */
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
  /**
   * 列出特定範圍內的所有 Key
   */
  scopedList(scope: string, options?: { limit?: number; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

export class KVStore<T = any> implements IStore<T> {
  private readonly SCOPE_PREFIX = '_s:';

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
    const fullKey = `${this.SCOPE_PREFIX}${scope}:${key}`;
    const data = await this.kv.get(fullKey, 'json');
    return data as T | null;
  }

  async scopedPut(scope: string, key: string, value: T): Promise<void> {
    if (!this.kv) return;
    const fullKey = `${this.SCOPE_PREFIX}${scope}:${key}`;
    await this.kv.put(fullKey, JSON.stringify(value));
  }

  async list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }> {
    if (!this.kv) return { keys: [], list_complete: true };
    
    // KV 的 list 無法直接排除前綴，所以我們需要抓取後過濾
    // 但如果使用者有指定 prefix，且該 prefix 不是 _s:，通常就自然排除了
    const result = await this.kv.list(options);
    const filteredKeys = result.keys
      .filter((k: any) => !k.name.startsWith(this.SCOPE_PREFIX))
      .map((k: any) => ({ name: k.name }));

    return {
      keys: filteredKeys,
      list_complete: result.list_complete,
      cursor: result.cursor,
    };
  }

  async scopedList(scope: string, options?: { limit?: number; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }> {
    if (!this.kv) return { keys: [], list_complete: true };
    
    const prefix = `${this.SCOPE_PREFIX}${scope}:`;
    const result = await this.kv.list({ ...options, prefix });
    
    return {
      keys: result.keys.map((k: any) => ({
        // 把內部的 _s:scope: 前綴修剪掉，對齊 Node 模式只回傳原始 Key 的行為
        name: k.name.replace(prefix, '')
      })),
      list_complete: result.list_complete,
      cursor: result.cursor,
    };
  }
}





