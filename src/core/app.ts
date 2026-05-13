import { Hono } from 'hono';
import { env } from 'hono/adapter';
import { webhookCallback } from 'grammy';
import { createBot } from './bot.js'; // 注意：使用 .js 結尾以符合 ESM 標準
import { SwitchBot, SensorConfig, SensorDataRecord } from './switchBot.js';
import { formatSpaceApi } from './format.js';
import { IStore } from './store.js';
import { Base, IndexPage } from './html.js';
import { SensorOg, ChartOg, TemperatureChartOg } from './og.js';
import { ASSETS } from "./assets.gen.js";
import { ImageResponse } from '@cf-wasm/og';

export type Variables = {
  store: IStore;
  ImageResponse: any;
};

export type Bindings = {
  TELEGRAM_BOT_TOKEN: string;
  SENSORS_CONFIG: string; // JSON 字串格式
  SENSOR_KV?: any;
};

export const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/* -----------------------------------------------------------------------------
Helper 區
----------------------------------------------------------------------------- */

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

// Helper to serve base64 assets
const serveBase64 = (base64: string, contentType: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return {
    body: bytes.buffer,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=604800, immutable",
    },
  };
};

// Helper to get font buffer
const getFontData = () => {
  const binary = atob(ASSETS.font_ttf);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

/* -----------------------------------------------------------------------------
資源檔案路由區
----------------------------------------------------------------------------- */

app.get("/favicon.png", (c) => {
  const asset = serveBase64(ASSETS.favicon_png, "image/png");
  return c.body(asset.body, 200, asset.headers);
});

app.get("/favicon.ico", (c) => {
  const asset = serveBase64(ASSETS.favicon_ico, "image/x-icon");
  return c.body(asset.body, 200, asset.headers);
});

app.get("/font.woff2", (c) => {
  const asset = serveBase64(ASSETS.font_woff2, "font/woff2");
  return c.body(asset.body, 200, asset.headers);
});

/* -----------------------------------------------------------------------------
主要 Router 邏輯區
----------------------------------------------------------------------------- */

// 基本的 HTTP API 路由 (SpaceAPI Sensors 規格)
app.get('/', async (c) => {
  return c.html(IndexPage().toString());
});

app.get('/sensors', async (c) => {
  try {
    const sensors = getSensors(c);
    const result: any = {
      temperature: [],
      humidity: [],
      carbondioxide: [],
    };

    for (const s of sensors) {
      const data = await s.getAll();
      const formatted = formatSpaceApi(s.id, s.name, data);

      if (formatted.temperature) result.temperature.push(formatted.temperature);
      if (formatted.humidity) result.humidity.push(formatted.humidity);
      if (formatted.carbondioxide) result.carbondioxide.push(formatted.carbondioxide);
    }

    return c.json(result);
  } catch (error) {
    console.error(`[Error] GET /sensors:`, error);
    return c.text('無法抓取空間資訊，請稍後再試。', 500);
  }
});

app.get('/sensors/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const sensors = getSensors(c);
    const sensor = sensors.find((s: SwitchBot) => s.id === id);
    if (!sensor) {
      return c.json({ error: 'Sensor not found' }, 404);
    }
    const data = await sensor.getAll();
    const formatted = formatSpaceApi(sensor.id, sensor.name, data);
    const result: any = {
      temperature: [],
      humidity: [],
      carbondioxide: [],
    };
    if (formatted.temperature) result.temperature.push(formatted.temperature);
    if (formatted.humidity) result.humidity.push(formatted.humidity);
    if (formatted.carbondioxide) result.carbondioxide.push(formatted.carbondioxide);

    return c.json(result);
  } catch (error) {
    console.error(`[Error] GET /sensors/${c.req.param('id')}:`, error);
    return c.text('無法抓取空間資訊，請稍後再試。', 500);
  }
});

// 本站原始格式 API 路由 (SensorDataRecord 規格)
app.get('/locations', async (c) => {
  try {
    const sensors = getSensors(c);
    const result: any[] = [];

    for (const s of sensors) {
      const data = await s.getAll();
      result.push({
        id: s.id,
        name: s.name,
        ...data,
      });
    }

    return c.json(result);
  } catch (error) {
    console.error(`[Error] GET /devices:`, error);
    return c.text('無法抓取裝置資訊，請稍後再試。', 500);
  }
});

app.get('/locations/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const sensors = getSensors(c);
    const sensor = sensors.find((s: SwitchBot) => s.id === id);
    if (!sensor) {
      return c.json({ error: 'Device not found' }, 404);
    }
    const data = await sensor.getAll();
    return c.json({
      id: sensor.id,
      name: sensor.name,
      ...data,
    });
  } catch (error) {
    console.error(`[Error] GET /devices/${c.req.param('id')}:`, error);
    return c.text('無法抓取裝置資訊，請稍後再試。', 500);
  }
});

app.get('/locations/:id/history', async (c) => {
  try {
    const id = c.req.param('id');
    const sensors = getSensors(c);
    const sensor = sensors.find((s: SwitchBot) => s.id === id);
    if (!sensor) return c.json({ error: 'Device not found' }, 404);

    const query = c.req.query();
    let results: SensorDataRecord[] = [];
    
    // 1. Timestamp 優先 (min_ts, max_ts)
    if (query.min_ts) {
      const min = parseInt(query.min_ts);
      const max = query.max_ts ? parseInt(query.max_ts) : undefined;
      results = await sensor.getHistoryByTimestamp(min, max);
    }
    // 2. 相對時間 (Days: limit_days, offset_days)
    else if (query.limit_days) {
      const limit = parseInt(query.limit_days);
      const offset = query.offset_days ? parseInt(query.offset_days) : 0;
      results = await sensor.getHistoryByDays(limit, offset);
    }
    // 3. 相對時間 (Months: limit_months, offset_months)
    else if (query.limit_months) {
      const limit = parseInt(query.limit_months);
      const offset = query.offset_months ? parseInt(query.offset_months) : 0;
      results = await sensor.getHistoryByMonths(limit, offset);
    }
    // 4. 相對時間 (Hours: limit_hours, offset_hours)
    else if (query.limit_hours) {
      const limit = parseInt(query.limit_hours);
      const offset = query.offset_hours ? parseInt(query.offset_hours) : 0;
      results = await sensor.getHistoryByHours(limit, offset);
    }
    // 預設回傳最近的歷史紀錄 (按 limit/offset 優化讀取)
    else {
      const limit = query.limit ? parseInt(query.limit) : 100;
      const offset = query.offset ? parseInt(query.offset) : 0;
      results = await sensor.getHistory(limit, offset);
      return c.json(results); // 已在內部優化，直接回傳
    }

    // 基礎分頁支援 (針對有時間範圍篩選後的結果進行切片)
    if (query.limit || query.offset) {
      const limit = query.limit ? parseInt(query.limit) : results.length;
      const offset = query.offset ? parseInt(query.offset) : 0;
      results = results.slice(offset, offset + limit);
    }

    return c.json(results);
  } catch (error) {
    console.error(`[Error] GET /devices/${c.req.param('id')}/history:`, error);
    return c.text('無法抓取歷史資訊，請稍後再試。', 500);
  }
});

// OG即時產圖區
const og = new Hono<{ Bindings: Bindings; Variables: Variables }>();

og.get('/locations/:id', async (c) => {
  const ImageResponse = c.get('ImageResponse');

  if (!ImageResponse) {
    return c.text('ImageResponse not found in context', 500);
  }

  try {
    const id = c.req.param('id');
    const sensors = getSensors(c);
    const sensor = sensors.find((s: SwitchBot) => s.id === id);
    if (!sensor) {
      return c.text('Device not found', 404);
    }
    const data = await sensor.getAll();
    const deviceId = sensor.id;
    const name = sensor.name;
    const temperature = data.temperature;
    const humidity = data.humidity;
    const co2 = data.co2;

    return new ImageResponse(SensorOg({id, name, temperature, humidity, co2}), 
      {
        width: 1200,
        height: 630,
        fonts: [{
          name: 'sans-serif',
          data: getFontData(),
          style: 'normal',
          weight: 400,
        }],
      });
  } catch (error) {
    console.error('[OG Error]', error);
    return c.text('無法產出 OG 圖片，請稍後再試。', 500);
  }
});

og.get('/locations/:id/temperature', async (c) => {
  const ImageResponse = c.get('ImageResponse');

  if (!ImageResponse) {
    return c.text('ImageResponse not found in context', 500);
  }

  try {
    const id = c.req.param('id');
    const sensors = getSensors(c);
    const sensor = sensors.find((s: SwitchBot) => s.id === id);
    if (!sensor) {
      return c.text('Device not found', 404);
    }

    // 撈出一小時內的資料
    const title = '🏠摩茲工寮 ' + sensor.name + ' 最近 3 小時內的溫度';
    const historyData = await sensor.getHistoryByHours(3, 0);

    return new ImageResponse(TemperatureChartOg({ datas: historyData, title }), 
      {
        width: 1200,
        height: 630,
        fonts: [{
          name: 'sans-serif',
          data: getFontData(),
          style: 'normal',
          weight: 400,
        }],
      });
  } catch (error) {
    console.error('[OG Temperature Chart Error]', error);
    return c.text('無法產出 OG 溫度圖表，請稍後再試。', 500);
  }
});

og.get('/chart-test', async (c) => {
  const ImageResponse = c.get('ImageResponse');
  if (!ImageResponse) {
    return c.text('ImageResponse not found in context', 500);
  }

  try {
    return new ImageResponse(ChartOg(), 
      {
        width: 1200,
        height: 630,
        fonts: [{
          name: 'sans-serif',
          data: getFontData(),
          style: 'normal',
          weight: 400,
        }],
      });
  } catch (error) {
    console.error('[OG Chart Error]', error);
    return c.text('無法產出 OG 圖表，請稍後再試。', 500);
  }
});

app.route('/og', og);

/* -----------------------------------------------------------------------------
接入整合外部服務區
----------------------------------------------------------------------------- */

// SwitchBot Webhook 接收端點
app.post('/switch-bot/:token', async (c) => {
  const tokenFromPath = c.req.param('token');
  
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
        // 安全檢查：驗證 URL 中的 token 是否與該感測器配置的 token 吻合
        if (!targetSensor.checkToken(tokenFromPath)) {
          console.warn(`[Webhook] Unauthorized access attempt for deviceMac: ${mac} with token: ${tokenFromPath}`);
          return c.text('Unauthorized', 401);
        }

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

  const bot = createBot(TELEGRAM_BOT_TOKEN, sensorsConfig, c.get('store'), new URL(c.req.url).origin, c.get('ImageResponse'));
  
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
