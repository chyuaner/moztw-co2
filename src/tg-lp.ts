import { createBot } from './core/bot.js';
import { SensorConfig } from './core/switchBot.js';
import 'dotenv/config';

const token = process.env.TELEGRAM_BOT_TOKEN;

if (!token) {
  console.error('❌ 錯誤：找不到 TELEGRAM_BOT_TOKEN 環境變數。請確認已在 .env 檔案中設定。');
  process.exit(1);
}

let sensorsConfig: SensorConfig[] = [];
try {
  sensorsConfig = JSON.parse(process.env.SENSORS_CONFIG || '[]');
} catch (e) {
  console.error('[Config Error] Failed to parse SENSORS_CONFIG:', e);
}

const bot = createBot(token, sensorsConfig);

console.log('🚀 正在啟動 Telegram Bot (Long Polling 模式)...');

// 處理錯誤，避免 Long Polling 因為某些意外錯誤而中斷
bot.catch((err) => {
  console.error(`Error for ${err.ctx.update.update_id}:`, err.error);
});

// 開始主動連線取得訊息
bot.start({
  onStart: (botInfo) => {
    console.log(`✅ 機器人 @${botInfo.username} 已成功啟動！`);
    console.log('💡 提示：在此模式下，請確保沒有設定 Webhook，否則 Telegram 會拒絕連線。');
    console.log('如需刪除 Webhook，請在瀏覽器造訪：');
    console.log(`https://api.telegram.org/bot${token}/deleteWebhook`);
    console.log('--------------------------------------------------');
  }
});
