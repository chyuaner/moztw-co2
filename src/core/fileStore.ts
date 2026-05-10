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

  async scopedPut(scope: string, key: string, value: T): Promise<void> {
    await this.ensureDir();
    const scopePath = path.join(this.folderPath, `${scope}.jsonl`);
    const entry = { k: key, v: value };
    // 使用 appendFile 進行原子追加，避免同時寫入衝突
    await fs.appendFile(scopePath, JSON.stringify(entry) + '\n', 'utf-8');
  }

  async list(options: { prefix?: string; limit?: number; cursor?: string } = {}): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }> {
    const { prefix = '', limit = 1000, cursor } = options;
    const allKeyNames: string[] = [];

    // 1. 彙整所有 Key (與之前邏輯相同)
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(data);
      for (const k in parsed) {
        if (k.startsWith(prefix)) allKeyNames.push(k);
      }
    } catch (e) {}

    try {
      const files = await fs.readdir(this.folderPath);
      for (const file of files) {
        if (file.endsWith('.jsonl')) {
          const scope = file.replace('.jsonl', '');
          if (scope.startsWith(prefix) || prefix.startsWith(scope)) {
            const scopePath = path.join(this.folderPath, file);
            const content = await fs.readFile(scopePath, 'utf-8');
            const lines = content.split('\n');
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              try {
                const entry = JSON.parse(trimmed);
                const fullKey = `${scope}:${entry.k}`;
                if (fullKey.startsWith(prefix)) {
                  allKeyNames.push(fullKey);
                }
              } catch (e) { continue; }
            }
          }
        }
      }
    } catch (e) {}

    // 2. 排序 (KV 預設是排序過的，Node 模式也應比照辦理)
    allKeyNames.sort();

    // 3. 處理分頁 (Cursor)
    let startIndex = 0;
    if (cursor) {
      try {
        // 解碼 Cursor (我們儲存的是起始索引)
        startIndex = parseInt(Buffer.from(cursor, 'base64').toString('utf-8'), 10);
      } catch (e) {
        startIndex = 0;
      }
    }

    const paginatedKeys = allKeyNames.slice(startIndex, startIndex + limit);
    const nextIndex = startIndex + limit;
    const list_complete = nextIndex >= allKeyNames.length;

    // 4. 回傳與 Cloudflare 一致的結構
    return {
      keys: paginatedKeys.map(name => ({ name })),
      list_complete,
      cursor: list_complete ? undefined : Buffer.from(nextIndex.toString()).toString('base64'),
    };
  }
}






