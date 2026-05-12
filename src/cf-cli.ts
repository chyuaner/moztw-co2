import 'dotenv/config';
import { CloudflareKVStore } from './core/store.js';
import { FileStore } from './core/fileStore.js';

/**
 * CLI 顏色定義
 */
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m"
} as const;

function showHelp(): void {
  console.log(`${colors.cyan}=== Cloudflare KV 管理工具 ===${colors.reset}

用法: npm run <script> -- [選項]

可用腳本 (在 package.json 中):
  npm run kv:export       從 Cloudflare KV 匯出資料到本地 JSON 檔案
  npm run kv:import       將本地 JSON 檔案匯入到 Cloudflare KV
  npm run kv:refresh -- <scope>  重新整理遠端 KV 的 Metadata 索引

環境變數需求:
  CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_KV_NAMESPACE_ID, CLOUDFLARE_API_TOKEN
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.length === 0) {
    showHelp();
    return;
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const namespaceId = process.env.CLOUDFLARE_KV_NAMESPACE_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !namespaceId || !apiToken) {
    console.error(`${colors.red}錯誤: 缺少 Cloudflare 設定。請在 .env 中設定 CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_KV_NAMESPACE_ID, CLOUDFLARE_API_TOKEN${colors.reset}`);
    process.exit(1);
  }

  const remoteStore = new CloudflareKVStore(accountId, namespaceId, apiToken);
  const localStore = new FileStore('./.data');

  if (args.includes('--export')) {
    console.log(`${colors.yellow}正在從 Cloudflare KV 匯出資料到本地...${colors.reset}`);
    try {
      let cursor: string | undefined;
      let listComplete = false;
      let count = 0;

      while (!listComplete) {
        const result = await remoteStore.list({ cursor, limit: 1000, prefix: '' });
        for (const k of result.keys) {
          const val = await remoteStore.get(k.name);
          if (val === null) continue;

          if (k.name.startsWith('_s:')) {
            const parts = k.name.split(':');
            const scope = parts.slice(1, -1).join(':');
            const key = parts[parts.length - 1];
            await localStore.scopedPut(scope, key, val, { skipMeta: true });
          } else {
            await localStore.put(k.name, val);
          }
          count++;
          if (count % 10 === 0) process.stdout.write('.');
        }
        cursor = result.cursor;
        listComplete = result.list_complete;
        if (!cursor) break;
      }
      console.log(`\n${colors.green}匯出完成！共處理 ${count} 筆資料。${colors.reset}`);
    } catch (e) {
      console.error(`\n${colors.red}匯出失敗: ${e instanceof Error ? e.message : String(e)}${colors.reset}`);
    }
  } 
  else if (args.includes('--import')) {
    console.log(`${colors.yellow}正在將本地資料匯入到 Cloudflare KV...${colors.reset}`);
    console.log(`${colors.yellow}匯入功能目前為架構預留，建議使用匯出確認資料一致性。${colors.reset}`);
  }
  else if (args.includes('--refresh-meta')) {
    const scopeIndex = args.indexOf('--refresh-meta') + 1;
    const scope = args[scopeIndex];

    try {
      if (scope) {
        console.log(`${colors.yellow}正在重新整理遠端 Metadata 索引: ${scope}...${colors.reset}`);
        await remoteStore.scopedMetaRefresh(scope);
        console.log(`${colors.green}遠端 Metadata 索引重刷完成！${colors.reset}`);
      } else {
        console.log(`${colors.yellow}正在掃描所有資料並重新整理全部 Metadata 索引...${colors.reset}`);
        let cursor: string | undefined;
        let listComplete = false;
        const scopeGroups: Record<string, string[]> = {};

        // 1. 掃描所有帶有 _s: 前綴的 Key
        while (!listComplete) {
          const result = await remoteStore.list({ prefix: '_s:', cursor, limit: 1000 });
          for (const k of result.keys) {
            const parts = k.name.split(':');
            const s = parts.slice(1, -1).join(':');
            const key = parts[parts.length - 1];
            if (!scopeGroups[s]) scopeGroups[s] = [];
            scopeGroups[s].push(key);
          }
          cursor = result.cursor;
          listComplete = result.list_complete;
          if (!cursor) break;
        }

        // 2. 針對每個 Scope 寫入 Metadata
        const scopes = Object.keys(scopeGroups);
        console.log(`${colors.cyan}找到 ${scopes.length} 個 Scope，開始更新索引...${colors.reset}`);
        for (const s of scopes) {
          await remoteStore.scopedMetaRefresh(s);
          console.log(`  [${s}] 更新完成 (${scopeGroups[s].length} 筆資料)`);
        }
        console.log(`${colors.green}全量 Metadata 索引重刷完成！${colors.reset}`);
      }
    } catch (error) {
      console.error(`${colors.red}重刷失敗: ${error instanceof Error ? error.message : String(error)}${colors.reset}`);
    }
  }
}

main().catch(error => {
  console.error(`${colors.red}未預期的錯誤: ${error}${colors.reset}`);
  process.exit(1);
});
