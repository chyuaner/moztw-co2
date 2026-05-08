import { Hono } from 'hono';
import { env } from 'hono/adapter';
import { webhookCallback } from 'grammy';
import { createBot } from './bot.js'; // 注意：使用 .js 結尾以符合 ESM 標準
import { SwitchBot, SensorConfig } from './switchBot.js';
import { IStore } from './store.js';

export type Variables = {
  store: IStore;
};

export type Bindings = {
  TELEGRAM_BOT_TOKEN: string;
  SENSORS_CONFIG: string; // JSON 字串格式
  SENSOR_KV?: any;
};

export const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// 取得感測器實例列表的輔助函式
const getSensors = (c: any) => {
  const bindings = env<Bindings>(c);
  const configStr = bindings.SENSORS_CONFIG || '[]';
  const store = c.get('store');
  
  try {
    const configs: SensorConfig[] = JSON.parse(configStr);
    return configs.map((cfg) => {
      // 預留未來擴充其他廠牌 IoT 設備的彈性
      // if (cfg.vendor === 'other') return new OtherBot(cfg);
      return new SwitchBot(cfg, store);
    });
  } catch (error) {
    console.error('[Config Error] Failed to parse SENSORS_CONFIG:', error);
    return [];
  }
};

// 取得所有感測器資料的輔助函式
const getSpaceApiSensors = async (c: any) => {
  const sensors = getSensors(c);
  const dataList = await Promise.all(
    sensors.map(async (s) => {
      const d = await s.getAll();
      return { sensor: s, data: d };
    })
  );

  // 依照 SpaceAPI Schema 轉換 Sensor 格式
  const now = Math.floor(Date.now() / 1000);

  const temperature = dataList
    .filter(item => typeof item.data.temperature === 'number')
    .map(item => ({
      value: item.data.temperature,
      unit: '°C',
      location: item.sensor.id,
      // name: item.sensor.name,
      lastchange: item.sensor.lastchangeTemperature || now
    }));

  const humidity = dataList
    .filter(item => typeof item.data.humidity === 'number')
    .map(item => ({
      value: item.data.humidity,
      unit: '%',
      location: item.sensor.id,
      // name: item.sensor.name,
      lastchange: item.sensor.lastchangeHumidity || now
    }));

  const carbondioxide = dataList
    .filter(item => typeof item.data.co2 === 'number')
    .map(item => ({
      value: item.data.co2,
      unit: 'ppm',
      location: item.sensor.id,
      // name: item.sensor.name,
      lastchange: item.sensor.lastchangeCo2 || now
    }));

  // 只回傳 sensors 區段的內容
  return {
    temperature,
    humidity,
    carbondioxide
  };
};

// 基本的 HTTP API 路由 (SpaceAPI Sensors 規格)
app.get('/', async (c) => {
  try {
    const data = await getSpaceApiSensors(c);
    return c.json(data);
  } catch (error) {
    console.error(`[Error] GET /:`, error);
    return c.text('無法抓取空間資訊，請稍後再試。', 500);
  }
});

app.get('/sensors', async (c) => {
  try {
    const data = await getSpaceApiSensors(c);
    return c.json(data);
  } catch (error) {
    console.error(`[Error] GET /sensors:`, error);
    return c.text('無法抓取空間資訊，請稍後再試。', 500);
  }
});

// SwitchBot Webhook 接收端點
app.post('/switch-bot', async (c) => {
  try {
    const body = await c.req.json();
    console.log('[Webhook] Received:', JSON.stringify(body));
    
    if (body.eventType === 'changeReport' && body.context && body.context.deviceMac) {
      const mac = body.context.deviceMac;
      const sensors = getSensors(c);
      
      const targetSensor = sensors.find((s: SwitchBot) => {
        const configuredMac = s.deviceId.replace(/:/g, '').toUpperCase();
        return configuredMac === mac.toUpperCase();
      });
      
      if (targetSensor) {
        await targetSensor.updateFromWebhook(body.context);
        return c.text('OK');
      } else {
        console.warn(`[Webhook] No sensor configured for deviceMac: ${mac}`);
        return c.text('Device not configured', 404);
      }
    }
    
    return c.text('Ignored');
  } catch (err) {
    console.error('[Webhook] Error:', err);
    return c.text('Error', 500);
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

  const bot = createBot(TELEGRAM_BOT_TOKEN, sensorsConfig, c.get('store'));
  
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
