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
  /**
   * 強制從 KV 真正的 list() 調用取得特定範圍內的所有 Key
   */
  scopedKvList(scope: string, options?: { limit?: number; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
  /**
   * 重新整理特定範圍內的 Metadata 索引 (會真正調用 list())
   */
  scopedMetaRefresh(scope: string): Promise<void>;
}

export class KVStore<T = any> implements IStore<T> {
  private readonly SCOPE_PREFIX = '_s:';
  private readonly META_PREFIX = '_m:';

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

    // 自動維護 Metadata 索引
    try {
      const metaKey = `${this.META_PREFIX}${scope}`;
      const metaData = await this.get(metaKey);
      let updatedMeta: string[] = Array.isArray(metaData) ? metaData : [];
      
      if (!updatedMeta.includes(key)) {
        updatedMeta.push(key);
        await this.put(metaKey, updatedMeta as any);
        console.log(`[Store] Updated metadata index for ${scope}, new size: ${updatedMeta.length}`);
      }
    } catch (err) {
      console.error(`[Store Error] Failed to update metadata index for ${scope}:`, err);
    }
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
      .filter((k: any) => (options?.prefix !== undefined) ? true : !k.name.startsWith(this.SCOPE_PREFIX))
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

    const metaKey = `${this.META_PREFIX}${scope}`;
    const metaData = await this.get(metaKey) as string[] | null;

    if (metaData && Array.isArray(metaData)) {
      return {
        keys: metaData.map(name => ({ name })),
        list_complete: true,
      };
    }

    // 如果沒有 Metadata，則退而求其次使用 KV list
    return this.scopedKvList(scope, options);
  }

  async scopedKvList(scope: string, options?: { limit?: number; cursor?: string }): Promise<{
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

  async scopedMetaRefresh(scope: string): Promise<void> {
    if (!this.kv) return;
    const allKeys: string[] = [];
    let cursor: string | undefined;
    let listComplete = false;

    while (!listComplete) {
      const result = await this.scopedKvList(scope, { cursor, limit: 1000 });
      allKeys.push(...result.keys.map(k => k.name));
      cursor = result.cursor;
      listComplete = result.list_complete;
      if (!cursor) break;
    }

    const metaKey = `${this.META_PREFIX}${scope}`;
    await this.put(metaKey, allKeys as any);
  }
}

/**
 * 透過 Cloudflare REST API 存取的 Store，用於 CLI 工具
 */
export class CloudflareKVStore<T = any> implements IStore<T> {
  private readonly SCOPE_PREFIX = '_s:';
  private readonly META_PREFIX = '_m:';

  constructor(
    private accountId: string,
    private namespaceId: string,
    private apiToken: string
  ) {}

  private async fetchKV(path: string, options: RequestInit = {}) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/storage/kv/namespaces/${this.namespaceId}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Cloudflare API Error: ${response.status} ${errorText}`);
    }

    return response;
  }

  async get(key: string): Promise<T | null> {
    try {
      const response = await this.fetchKV(`/values/${encodeURIComponent(key)}`);
      return await response.json() as T;
    } catch (e) {
      return null;
    }
  }

  async put(key: string, value: T): Promise<void> {
    await this.fetchKV(`/values/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify(value),
    });
  }

  async scopedGet(scope: string, key: string): Promise<T | null> {
    const fullKey = `${this.SCOPE_PREFIX}${scope}:${key}`;
    return this.get(fullKey);
  }

  async scopedPut(scope: string, key: string, value: T): Promise<void> {
    const fullKey = `${this.SCOPE_PREFIX}${scope}:${key}`;
    await this.put(fullKey, value);

    // 自動維護 Metadata 索引
    const metaKey = `${this.META_PREFIX}${scope}`;
    const metaData = await this.get(metaKey) as string[] | null;
    const updatedMeta = metaData ? [...metaData] : [];
    if (!updatedMeta.includes(key)) {
      updatedMeta.push(key);
      await this.put(metaKey, updatedMeta as any);
    }
  }

  async list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }> {
    let urlPath = `/keys?`;
    if (options?.prefix) urlPath += `prefix=${encodeURIComponent(options.prefix)}&`;
    if (options?.limit) urlPath += `limit=${options.limit}&`;
    if (options?.cursor) urlPath += `cursor=${options.cursor}&`;

    const response = await this.fetchKV(urlPath);
    const result = await response.json() as any;

    if (!result.success) {
      throw new Error(`Cloudflare API List Error: ${JSON.stringify(result.errors)}`);
    }

    const filteredKeys = result.result
      .filter((k: any) => (options?.prefix !== undefined) ? true : !k.name.startsWith(this.SCOPE_PREFIX))
      .map((k: any) => ({ name: k.name }));

    return {
      keys: filteredKeys,
      list_complete: !result.result_info?.cursor,
      cursor: result.result_info?.cursor,
    };
  }

  async scopedList(scope: string, options?: { limit?: number; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }> {
    const metaKey = `${this.META_PREFIX}${scope}`;
    const metaData = await this.get(metaKey) as string[] | null;

    if (metaData && Array.isArray(metaData)) {
      return {
        keys: metaData.map(name => ({ name })),
        list_complete: true,
      };
    }

    return this.scopedKvList(scope, options);
  }

  async scopedKvList(scope: string, options?: { limit?: number; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }> {
    const prefix = `${this.SCOPE_PREFIX}${scope}:`;
    const result = await this.list({ ...options, prefix });
    
    return {
      keys: result.keys.map((k: any) => ({
        name: k.name.replace(prefix, '')
      })),
      list_complete: result.list_complete,
      cursor: result.cursor,
    };
  }

  async scopedMetaRefresh(scope: string): Promise<void> {
    const allKeys: string[] = [];
    let cursor: string | undefined;
    let listComplete = false;

    while (!listComplete) {
      const result = await this.scopedKvList(scope, { cursor, limit: 1000 });
      allKeys.push(...result.keys.map(k => k.name));
      cursor = result.cursor;
      listComplete = result.list_complete;
      if (!cursor) break;
    }

    const metaKey = `${this.META_PREFIX}${scope}`;
    await this.put(metaKey, allKeys as any);
  }
}





