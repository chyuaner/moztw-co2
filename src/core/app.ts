import { Hono } from 'hono';
import { env } from 'hono/adapter';
import { webhookCallback } from 'grammy';
import { createBot } from './bot.js'; // 注意：使用 .js 結尾以符合 ESM 標準
import { SwitchBot, SensorConfig } from './switchBot.js';

export const app = new Hono();
// 環境變數型別定義
type Bindings = {
  TELEGRAM_BOT_TOKEN: string;
  SENSORS_CONFIG: string; // JSON 字串格式
};

// 取得感測器實例列表的輔助函式
const getSensors = (c: any) => {
  const bindings = env<Bindings>(c);
  const configStr = bindings.SENSORS_CONFIG || '[]';
  
  try {
    const configs: SensorConfig[] = JSON.parse(configStr);
    return configs.map((cfg) => {
      // 預留未來擴充其他廠牌 IoT 設備的彈性
      // if (cfg.vendor === 'other') return new OtherBot(cfg);
      return new SwitchBot(cfg);
    });
  } catch (error) {
    console.error('[Config Error] Failed to parse SENSORS_CONFIG:', error);
    return [];
  }
};

// 基本的 HTTP API 路由
app.get('/', async (c) => {
  try {
    const sensors = getSensors(c);
    const data = await Promise.all(
      sensors.map(async (s) => {
        const d = await s.getAll();
        return { id: s.id, name: s.name, ...d };
      })
    );
  
    return c.json(data);
  } catch (error) {
    console.error(`[Error] GET /:`, error);
    return c.text('無法抓取空間資訊，請稍後再試。', 500);
  }
});

app.get('/temperature', async (c) => {
  try {
    const sensors = getSensors(c);
    const data = await Promise.all(
      sensors.map(async (s) => ({ id: s.id, name: s.name, temperature: await s.getTemperature() }))
    );
  
    return c.json(data);
  } catch (error) {
    console.error(`[Error] GET /temperature:`, error);
    return c.text('無法抓取溫度資訊，請稍後再試。', 500);
  }
});

app.get('/humidity', async (c) => {
  try {
    const sensors = getSensors(c);
    const data = await Promise.all(
      sensors.map(async (s) => ({ id: s.id, name: s.name, humidity: await s.getHumidity() }))
    );
  
    return c.json(data);
  } catch (error) {
    console.error(`[Error] GET /humidity:`, error);
    return c.text('無法抓取濕度資訊，請稍後再試。', 500);
  }
});

app.get('/co2', async (c) => {
  try {
    const sensors = getSensors(c);
    const data = await Promise.all(
      sensors.map(async (s) => ({ id: s.id, name: s.name, co2: await s.getCo2() }))
    );
  
    return c.json(data);
  } catch (error) {
    console.error(`[Error] GET /co2:`, error);
    return c.text('無法抓取 CO2 資訊，請稍後再試。', 500);
  }
});

// Telegram Bot Webhook 接收端點
app.post('/bot/:token', async (c) => {
  const tokenFromPath = c.req.param('token');
  const { TELEGRAM_BOT_TOKEN, SENSORS_CONFIG } = env<Bindings>(c);
  
  if (!TELEGRAM_BOT_TOKEN || tokenFromPath !== TELEGRAM_BOT_TOKEN) {
    return c.json({ error: 'Unauthorized or Bot token not configured' }, 401);
  }

  let sensorsConfig: SensorConfig[] = [];
  try {
    sensorsConfig = JSON.parse(SENSORS_CONFIG || '[]');
  } catch (e) {
    console.error('[Config Error] Failed to parse SENSORS_CONFIG for Bot:', e);
  }

  const bot = createBot(TELEGRAM_BOT_TOKEN, sensorsConfig);
  
  // 使用 grammY 內建的 webhookCallback，並指定 adapter 為 'hono'
  const handleUpdate = webhookCallback(bot, 'hono');
  return handleUpdate(c);
});

app.notFound((c) => c.text('Not Found', 404));

// 全域錯誤處理
app.onError((err, c) => {
  console.error(`[Global Error] ${c.req.method} ${c.req.url}:`, err);
  return c.text('伺服器發生錯誤，請稍後再試。', 500);
});
