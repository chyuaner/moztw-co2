import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
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

匯出選項 (kv:export):
  --concurrency, -c <n>   設定並發請求數量 (預設: 10)
  --batch-size, -b <n>    設定每批批量獲取數量 (預設: 100, 最大: 100)
  --prefix <str>          只匯出特定前綴的 Key
  --clean                 匯出前先清理本地舊的備份檔案，避免重複追加
  --no-bulk               強制禁用 Bulk API，改用多並發單筆模式

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
    const concurrencyArgIndex = args.indexOf('--concurrency') !== -1 ? args.indexOf('--concurrency') : args.indexOf('-c');
    const concurrency = concurrencyArgIndex !== -1 && args[concurrencyArgIndex + 1] ? Math.max(1, parseInt(args[concurrencyArgIndex + 1], 10) || 10) : 10;

    const batchSizeArgIndex = args.indexOf('--batch-size') !== -1 ? args.indexOf('--batch-size') : args.indexOf('-b');
    const batchSize = batchSizeArgIndex !== -1 && args[batchSizeArgIndex + 1] ? Math.max(1, Math.min(100, parseInt(args[batchSizeArgIndex + 1], 10) || 100)) : 100;

    const prefixArgIndex = args.indexOf('--prefix') !== -1 ? args.indexOf('--prefix') : -1;
    const prefix = prefixArgIndex !== -1 && args[prefixArgIndex + 1] ? args[prefixArgIndex + 1] : '';

    const forceNoBulk = args.includes('--no-bulk');
    const shouldClean = args.includes('--clean');

    if (shouldClean) {
      console.log(`${colors.yellow}偵測到 --clean 參數，正在清理本地舊資料...${colors.reset}`);
      const dataDir = path.resolve('./.data');
      try {
        const files = await fs.readdir(dataDir);
        for (const file of files) {
          if (file.endsWith('.jsonl') || file === 'data.json') {
            await fs.unlink(path.join(dataDir, file));
          }
        }
        console.log(`${colors.green}舊資料清理完成。${colors.reset}`);
      } catch (err: any) {
        if (err.code !== 'ENOENT') {
          console.warn(`${colors.yellow}清理舊資料時警示: ${err.message}${colors.reset}`);
        }
      }
    } else {
      // 若沒有 --clean，但偵測到先前的 data.json 含有錯誤的 "values" 鍵，主動清除該錯誤結構
      const dataJsonPath = path.resolve('./.data/data.json');
      try {
        const raw = await fs.readFile(dataJsonPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && 'values' in parsed) {
          console.log(`${colors.yellow}偵測到先前匯出失敗遺留的異常 data.json，正在自動重置...${colors.reset}`);
          await fs.unlink(dataJsonPath);
        }
      } catch {}
    }

    console.log(`${colors.yellow}正在從 Cloudflare KV 匯出資料到本地...${colors.reset}`);
    console.log(`${colors.cyan}設定: 並發數=${concurrency}, 每批數量=${batchSize}${forceNoBulk ? ' (已禁用 bulk API)' : ''}${prefix ? `, 前綴="${prefix}"` : ''}${colors.reset}`);

    try {
      process.stdout.write(`${colors.yellow}正在掃描遠端 KV Keys 清單... ${colors.reset}`);
      let cursor: string | undefined;
      let listComplete = false;
      const allKeys: string[] = [];

      while (!listComplete) {
        const result = await remoteStore.list({ cursor, limit: 1000, prefix });
        for (const k of result.keys) {
          allKeys.push(k.name);
        }
        cursor = result.cursor;
        listComplete = result.list_complete;
        if (!cursor) break;
      }
      console.log(`${colors.green}完成！找到 ${allKeys.length} 筆 Key。${colors.reset}`);

      if (allKeys.length === 0) {
        console.log(`${colors.yellow}沒有找到任何符合的 Key，結束匯出。${colors.reset}`);
        return;
      }

      const chunks: string[][] = [];
      for (let i = 0; i < allKeys.length; i += batchSize) {
        chunks.push(allKeys.slice(i, i + batchSize));
      }

      console.log(`${colors.yellow}開始多線程/並發匯出... (共 ${allKeys.length} 筆 Key, ${chunks.length} 個批次, 並發連線: ${concurrency})${colors.reset}`);

      let chunkIndex = 0;
      let bulkSupported = !forceNoBulk;
      let processedCount = 0;
      let successCount = 0;
      const startTime = Date.now();

      const mainDataMap: Record<string, any> = {};
      const scopedBuffers: Map<string, Array<{ key: string; value: any }>> = new Map();

      let isFlushing = false;
      const flushScoped = async () => {
        while (isFlushing) {
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        isFlushing = true;
        try {
          for (const [scope, entries] of scopedBuffers.entries()) {
            if (entries.length > 0) {
              const toWrite = entries.splice(0, entries.length);
              await localStore.scopedPutBatch(scope, toWrite);
            }
          }
        } finally {
          isFlushing = false;
        }
      };

      const updateProgress = () => {
        const elapsedSec = (Date.now() - startTime) / 1000;
        const rate = elapsedSec > 0 ? (processedCount / elapsedSec).toFixed(1) : '0';
        const percent = ((processedCount / allKeys.length) * 100).toFixed(1);
        const etaSec = elapsedSec > 0 && processedCount > 0 ? Math.max(0, Math.round((allKeys.length - processedCount) / (processedCount / elapsedSec))) : 0;
        process.stdout.write(`\r${colors.cyan}[進度] ${processedCount}/${allKeys.length} (${percent}%) | 速度: ${rate} 筆/秒 | 預估剩餘: ${etaSec}秒${colors.reset}   `);
      };

      const worker = async () => {
        while (true) {
          const currentIndex = chunkIndex++;
          if (currentIndex >= chunks.length) break;

          const chunk = chunks[currentIndex];
          let values: Record<string, any> = {};

          if (bulkSupported) {
            try {
              values = await remoteStore.getBulk(chunk);
            } catch (err: any) {
              if (err?.status === 404 || err?.status === 405 || String(err).includes('404')) {
                bulkSupported = false;
                console.warn(`\n${colors.yellow}提示: Cloudflare KV Bulk API 不可用，自動切換為多並發單筆讀取模式。${colors.reset}`);
              } else {
                throw err;
              }
            }
          }

          if (!bulkSupported) {
            await Promise.all(
              chunk.map(async (key) => {
                const val = await remoteStore.get(key);
                if (val !== null) {
                  values[key] = val;
                }
              })
            );
          }

          for (const [keyName, val] of Object.entries(values)) {
            if (val === null || val === undefined) continue;

            if (keyName.startsWith('_s:')) {
              const parts = keyName.split(':');
              const scope = parts.slice(1, -1).join(':');
              const key = parts[parts.length - 1];
              if (!scopedBuffers.has(scope)) {
                scopedBuffers.set(scope, []);
              }
              scopedBuffers.get(scope)!.push({ key, value: val });
            } else {
              mainDataMap[keyName] = val;
            }
            successCount++;
          }

          processedCount += chunk.length;
          updateProgress();

          let bufferedScopedCount = 0;
          for (const list of scopedBuffers.values()) {
            bufferedScopedCount += list.length;
          }
          if (bufferedScopedCount >= 1000) {
            await flushScoped();
          }
        }
      };

      const workers = Array.from({ length: Math.min(concurrency, chunks.length) }, () => worker());
      await Promise.all(workers);

      await flushScoped();
      if (Object.keys(mainDataMap).length > 0) {
        await localStore.putMany(mainDataMap);
      }

      updateProgress();
      const totalSec = ((Date.now() - startTime) / 1000).toFixed(2);
      const avgRate = totalSec !== '0.00' ? (successCount / parseFloat(totalSec)).toFixed(1) : successCount;
      console.log(`\n${colors.green}匯出完成！共處理 ${successCount} 筆資料，耗時 ${totalSec} 秒 (平均 ${avgRate} 筆/秒)。${colors.reset}`);
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
