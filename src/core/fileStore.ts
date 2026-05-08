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

  async set(key: string, value: T): Promise<void> {
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
}
