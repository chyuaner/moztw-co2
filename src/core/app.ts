import { Hono } from 'hono';
import { env } from 'hono/adapter';
import { webhookCallback } from 'grammy';
import { createBot } from './bot.js'; // 注意：使用 .js 結尾以符合 ESM 標準
import { SwitchBot } from './switchBot.js';

export const app = new Hono();
// 環境變數型別定義
type Bindings = {
  TELEGRAM_BOT_TOKEN: string;
  SWITCHBOT_DEVICE_ID: string;
  SWITCHBOT_TOKEN: string;
  SWITCHBOT_SECRET: string;
};

// 取得 SwitchBot 實例的輔助函式
const getSwitchBot = (c: any) => {
  const { SWITCHBOT_DEVICE_ID, SWITCHBOT_TOKEN, SWITCHBOT_SECRET } = env<Bindings>(c);
  return new SwitchBot(SWITCHBOT_DEVICE_ID || '', SWITCHBOT_TOKEN || '', SWITCHBOT_SECRET || '');
};

// 基本的 HTTP API 路由
app.get('/', async (c) => {
  try {
    const sb = getSwitchBot(c);
    const data = await sb.getAll();
  
    return c.json(data);
  } catch (error) {
    return c.text('無法抓取空間資訊，請稍後再試。', 500);
  }
});

app.get('/temperature', async (c) => {
  try {
    const sb = getSwitchBot(c);
    const data = await sb.getTemperature();
  
    return c.text(data.toString());
  } catch (error) {
    return c.text('無法抓取溫度資訊，請稍後再試。', 500);
  }
});

app.get('/humidity', async (c) => {
  try {
    const sb = getSwitchBot(c);
    const data = await sb.getHumidity();
  
    return c.text(data.toString());
  } catch (error) {
    return c.text('無法抓取濕度資訊，請稍後再試。', 500);
  }
});

app.get('/co2', async (c) => {
  try {
    const sb = getSwitchBot(c);
    const data = await sb.getCo2();
  
    return c.text(data.toString());
  } catch (error) {
    return c.text('無法抓取 CO2 資訊，請稍後再試。', 500);
  }
});

// Telegram Bot Webhook 接收端點
app.post('/bot', async (c) => {
  // hono/adapter 的 env 會自動處理 Node.js (process.env) 與 Cloudflare Workers (c.env) 的環境變數差異
  const { 
    TELEGRAM_BOT_TOKEN, 
    SWITCHBOT_DEVICE_ID, 
    SWITCHBOT_TOKEN, 
    SWITCHBOT_SECRET 
  } = env<Bindings>(c);
  
  if (!TELEGRAM_BOT_TOKEN) {
    return c.json({ error: 'Bot token not configured' }, 500);
  }

  const bot = createBot(TELEGRAM_BOT_TOKEN, {
    deviceId: SWITCHBOT_DEVICE_ID || '',
    token: SWITCHBOT_TOKEN || '',
    secret: SWITCHBOT_SECRET || '',
  });
  
  // 使用 grammY 內建的 webhookCallback，並指定 adapter 為 'hono'
  const handleUpdate = webhookCallback(bot, 'hono');
  return handleUpdate(c);
});

app.notFound((c) => c.text('Not Found', 404));
