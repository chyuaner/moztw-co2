import fs from 'node:fs/promises';
import path from 'node:path';
import { IStore, SensorDataRecord } from './store.js';

export class FileStore implements IStore {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  private async ensureDir() {
    const dir = path.dirname(this.filePath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (err) {
      // ignore
    }
  }

  async get(key: string): Promise<SensorDataRecord | null> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(data);
      return parsed[key] || null;
    } catch (err) {
      return null;
    }
  }

  async set(key: string, value: SensorDataRecord): Promise<void> {
    await this.ensureDir();
    let parsed: Record<string, SensorDataRecord> = {};
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
