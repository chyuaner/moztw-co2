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
}




