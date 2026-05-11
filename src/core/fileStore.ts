import fs from 'node:fs/promises';
import path from 'node:path';
import { IStore, SensorDataRecord } from './store.js';

export class FileStore<T = any> implements IStore<T> {
  private fileName = 'data.json';
  private folderPath: string;
  private filePath: string;

  constructor(folderPath: string) {
    this.folderPath = folderPath;
    this.filePath = path.join(folderPath, this.fileName);
  }

  private async ensureDir() {
    const dir = path.dirname(this.filePath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (err) {
      // ignore
    }
  }

  async get(key: string): Promise<T | null> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(data);
      return parsed[key] || null;
    } catch (err) {
      return null;
    }
  }

  async put(key: string, value: T): Promise<void> {
    await this.ensureDir();
    let parsed: Record<string, T> = {};
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      parsed = JSON.parse(data);
    } catch (err) {
      // ignore
    }
    parsed[key] = value;
    await fs.writeFile(this.filePath, JSON.stringify(parsed, null, 2), 'utf-8');
  }

  async scopedGet(scope: string, key: string): Promise<T | null> {
    const scopePath = path.join(this.folderPath, `${scope}.jsonl`);
    try {
      const data = await fs.readFile(scopePath, 'utf-8');
      const lines = data.split('\n');
      // 從後往前找，以取得最新的紀錄 (如果有重複 key)
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
          const entry = JSON.parse(line);
          if (entry.k === key) return entry.v;
        } catch (e) {
          continue;
        }
      }
    } catch (err) {
      return null;
    }
    return null;
  }

  async scopedPut(scope: string, key: string, value: T, options?: { skipMeta?: boolean }): Promise<void> {
    await this.ensureDir();
    const scopePath = path.join(this.folderPath, `${scope}.jsonl`);
    const entry = { k: key, v: value };
    // 使用 appendFile 進行原子追加，避免同時寫入衝突
    await fs.appendFile(scopePath, JSON.stringify(entry) + '\n', 'utf-8');

    if (options?.skipMeta) return;

    // 自動維護 Metadata 索引 (儲存於主資料檔案 data.json 中)
    const metaKey = `_m:${scope}`;
    const metaData = await this.get(metaKey);
    let updatedMeta: string[] = Array.isArray(metaData) ? metaData : [];
    if (!updatedMeta.includes(key)) {
      updatedMeta.push(key);
      await this.put(metaKey, updatedMeta as any);
    }
  }

  async list(options: { prefix?: string; limit?: number; cursor?: string } = {}): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }> {
    const { prefix = '', limit = 1000, cursor } = options;
    const allKeyNames: string[] = [];

    // 只從主資料檔案 (data.json) 尋找符合的 Key
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(data);
      for (const k in parsed) {
        if (k.startsWith(prefix)) allKeyNames.push(k);
      }
    } catch (e) {}

    allKeyNames.sort();

    let startIndex = 0;
    if (cursor) {
      try {
        startIndex = parseInt(Buffer.from(cursor, 'base64').toString('utf-8'), 10);
      } catch (e) {
        startIndex = 0;
      }
    }

    const paginatedKeys = allKeyNames.slice(startIndex, startIndex + limit);
    const nextIndex = startIndex + limit;
    const list_complete = nextIndex >= allKeyNames.length;

    return {
      keys: paginatedKeys.map(name => ({ name })),
      list_complete,
      cursor: list_complete ? undefined : Buffer.from(nextIndex.toString()).toString('base64'),
    };
  }

  async scopedList(scope: string, options: { limit?: number; cursor?: string } = {}): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }> {
    const metaKey = `_m:${scope}`;
    const metaData = await this.get(metaKey) as string[] | null;

    if (metaData && Array.isArray(metaData)) {
      return {
        keys: metaData.map(name => ({ name })),
        list_complete: true,
      };
    }

    // 如果沒有 Metadata，則使用原本的掃描邏輯
    return this.scopedKvList(scope, options);
  }

  async scopedKvList(scope: string, options: { limit?: number; cursor?: string } = {}): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }> {
    const { limit = 1000, cursor } = options;
    const allKeyNames: string[] = [];

    // 只掃描對應的 .jsonl 檔案
    const scopePath = path.join(this.folderPath, `${scope}.jsonl`);
    try {
      const content = await fs.readFile(scopePath, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const entry = JSON.parse(trimmed);
          allKeyNames.push(entry.k);
        } catch (e) { continue; }
      }
    } catch (e) {}

    allKeyNames.sort();

    let startIndex = 0;
    if (cursor) {
      try {
        startIndex = parseInt(Buffer.from(cursor, 'base64').toString('utf-8'), 10);
      } catch (e) {
        startIndex = 0;
      }
    }

    const paginatedKeys = allKeyNames.slice(startIndex, startIndex + limit);
    const nextIndex = startIndex + limit;
    const list_complete = nextIndex >= allKeyNames.length;

    return {
      keys: paginatedKeys.map(name => ({ name })),
      list_complete,
      cursor: list_complete ? undefined : Buffer.from(nextIndex.toString()).toString('base64'),
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

    const metaKey = `_m:${scope}`;
    await this.put(metaKey, allKeys as any);
  }
}







