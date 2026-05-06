import 'dotenv/config';
import { SwitchBot } from './core/switchBot.js';

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

/**
 * 顯示說明訊息
 */
function showHelp(): void {
  console.log(`用法: npm run get [選項]

選項:
  --recent                爬取模式：近期上傳 (全局)
  --help                  顯示此幫助訊息
`);
}

/**
 * 主要執行邏輯
 */
async function main(): Promise<void> {
  // 取得命令列參數
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    showHelp();
    return;
  }

  console.log(`${colors.cyan}=== MozTW Space Info CLI ===${colors.reset}\n`);

  if (args.includes('--recent')) {
    console.log(`${colors.yellow}正在執行近期上傳模式...${colors.reset}`);
    // TODO: 實作爬蟲或相關邏輯
  }

  // 範例：呼叫你剛才設計的 SwitchBot 物件
  try {
    console.log(`${colors.green}正在從 SwitchBot API 抓取資料...${colors.reset}`);
    const bot = new SwitchBot();
    const data = await bot.getAll();

    console.log(`${colors.green}目前空間資訊：${colors.reset}`);
    console.log(`  溫度: ${data.temperature} °C`);
    console.log(`  濕度: ${data.humidity} %`);
    console.log(`  CO2:  ${data.co2} ppm`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${colors.red}發生錯誤: ${message}${colors.reset}`);
  }

  console.log(`\n${colors.cyan}執行完畢${colors.reset}`);
}

// 執行程式
main().catch((error) => {
  console.error(`${colors.red}未預期的程式中斷: ${error}${colors.reset}`);
  process.exit(1);
});
