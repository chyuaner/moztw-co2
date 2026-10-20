import { ISqlClient } from './d1Sqlite.js';

/**
 * 本地 Node.js SQLite 客戶端實作 (使用 Node 24+ 內建 node:sqlite)
 * 僅供本機離線與開發工具使用，不進入 Cloudflare Workers 打包路徑
 */
export class NodeSqliteClient implements ISqlClient {
  private db: any = null;
  private dbPath: string;

  constructor(dbPath: string = './.data/moztw.db') {
    this.dbPath = dbPath;
  }

  private async getDb(): Promise<any> {
    if (!this.db) {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const { DatabaseSync } = await import('node:sqlite');
      this.db = new DatabaseSync(this.dbPath);
    }
    return this.db;
  }

  async all<T = any>(query: string, params: any[] = []): Promise<T[]> {
    const db = await this.getDb();
    return db.prepare(query).all(...params) as T[];
  }

  async run(query: string, params: any[] = []): Promise<void> {
    const db = await this.getDb();
    db.prepare(query).run(...params);
  }

  async exec(sql: string): Promise<void> {
    const db = await this.getDb();
    db.exec(sql);
  }
}
