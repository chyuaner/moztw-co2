import { Hono } from 'hono';
import { env } from 'hono/adapter';
import { webhookCallback } from 'grammy';
import { createBot } from './bot.js'; // 注意：使用 .js 結尾以符合 ESM 標準

export const app = new Hono();

// 基本的 HTTP API 路由
app.get('/', (c) => {
  return c.json({
    status: 'ok',
    message: 'Space API is running!',
  });
});

app.get('/api/info', (c) => {
  return c.json({
    name: 'Space Info API',
    version: '1.0.0'
  });
});

// Telegram Bot Webhook 接收端點
app.post('/bot', async (c) => {
  // hono/adapter 的 env 會自動處理 Node.js (process.env) 與 Cloudflare Workers (c.env) 的環境變數差異
  const { 
    TELEGRAM_BOT_TOKEN, 
    SWITCHBOT_DEVICE_ID, 
    SWITCHBOT_TOKEN, 
    SWITCHBOT_SECRET 
  } = env<{ 
    TELEGRAM_BOT_TOKEN: string,
    SWITCHBOT_DEVICE_ID: string,
    SWITCHBOT_TOKEN: string,
    SWITCHBOT_SECRET: string
  }>(c);
  
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
