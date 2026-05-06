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
  console.log(`用法: npm run get

沒什麼好說明的，就只有直接執行的功能，沒有參數可以使用，這是一份陽春的CLI工具，就醬w
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

//   if (args.includes('--recent')) {
//     console.log(`${colors.yellow}正在執行近期上傳模式...${colors.reset}`);
//     // TODO: 實作爬蟲或相關邏輯
//   }

  // 抓取感測器資料
  try {
    console.log(`${colors.green}正在從 SENSORS_CONFIG 抓取資料...${colors.reset}`);
    
    const configStr = process.env.SENSORS_CONFIG || '[]';
    let sensorsConfig = [];
    try {
      sensorsConfig = JSON.parse(configStr);
    } catch (e) {
      throw new Error('無法解析 SENSORS_CONFIG，請確認格式是否為正確的 JSON 陣列。');
    }

    if (sensorsConfig.length === 0) {
      console.log(`${colors.yellow}尚未設定任何感測器。${colors.reset}`);
      return;
    }

    for (const config of sensorsConfig) {
      const s = new SwitchBot(config);
      console.log(`\n${colors.yellow}[${s.name}]${colors.reset} 正在抓取...`);
      
      const data = await s.getAll();
      console.log(`  🌡 溫度: ${data.temperature !== undefined ? data.temperature + " °C" : "無資料"}`);
      console.log(`  💧 濕度: ${data.humidity !== undefined ? data.humidity + " %" : "無資料"}`);
      console.log(`  ☁️ CO2:  ${data.co2 !== undefined ? data.co2 + " ppm" : "無資料"}`);
    }
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
