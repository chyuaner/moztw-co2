import { OpenAPIHono } from '@hono/zod-openapi';
import { env } from 'hono/adapter';
import locationsApi from './route/locations.js';
import sensorsApi from './route/sensors.js';
import ogApi from './route/og.js';
import { app as fe } from './frontend/route.js';
import { webhookCallback } from 'grammy';
import { createBot } from './route/bot.js'; // 注意：使用 .js 結尾以符合 ESM 標準
import { SwitchBot, SensorConfig } from './switchBot.js';
import { IStore } from './store.js';
import { ASSETS, BUILD_INFO } from '../../gen/assets.gen.js';

export type Variables = {
  store: IStore;
  ImageResponse: any;
  /** Cloudflare Workers：將 Promise 延後至回應送出後執行 (waitUntil) */
  defer?: (promise: Promise<unknown>) => void;
};

export type Bindings = {
  TELEGRAM_BOT_TOKEN: string;
  SENSORS_CONFIG: string; // JSON 字串格式
  SENSOR_KV?: any;
};

export const app = new OpenAPIHono<{ Bindings: Bindings; Variables: Variables }>();

// 自動生成 OpenAPI Spec 的路由
app.doc('/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'Moztw Space API',
    version: BUILD_INFO.version,
    description: '提供摩茲工寮即時空間感測數據',
  },
});

/* =============================================================================
Helper 區
============================================================================= */

// 取得感測器實例列表的輔助函式
export const getSensors = (c: any) => {
  const bindings = env<Bindings>(c);
  const configStr = bindings.SENSORS_CONFIG || '[]';
  const store = c.get('store');
  
  try {
    const configs: SensorConfig[] = JSON.parse(configStr);
    const defer = c.get('defer') as Variables['defer'];
    return configs.map((cfg) => {
      const sensor = new SwitchBot(cfg, store);
      if (defer) sensor.setDefer(defer);
      return sensor;
    });
  } catch (error) {
    console.error('[Config Error] Failed to parse SENSORS_CONFIG:', error);
    return [];
  }
};

// 取得字型資料的輔助函式
export const getFontData = () => {
  const binary = atob(ASSETS.font_ttf);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

// 通用的 OG 圖片設定
export const generalOgOptions = {
  width: 1200,
  height: 630,
  fonts: [{
    name: 'sans-serif',
    data: getFontData(),
    style: 'normal',
    weight: 400,
  }],
};

/* -----------------------------------------------------------------------------
主要 Router 掛載區
----------------------------------------------------------------------------- */
app.route('/locations', locationsApi);
app.route('/og', ogApi);
app.route('/sensors', sensorsApi);

/* =============================================================================
前端區 (已經移到 ./frontend/route.ts)
============================================================================= */
app.route('/', fe);

/* =============================================================================
接入整合外部服務區
============================================================================= */

// 處理來自 SwitchBot 的 Webhook 數據更新
app.post('/switch-bot/:token', async (c) => {
  const tokenFromPath = c.req.param('token');
  const sensors = getSensors(c);
  
  try {
    const body = await c.req.json();
    console.log('[Webhook] Received:', JSON.stringify(body));
    
    if (body.eventType === 'changeReport' && body.context && body.context.deviceMac) {
      const mac = body.context.deviceMac;
      
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

        // 維持原有的 updateFromWebhook 呼叫與參數
        await targetSensor.updateFromWebhook(body.context);
        return c.text('OK');
      } else {
        console.warn(`[Webhook] No sensor configured for deviceMac: ${mac}`);
        return c.text('Device not configured', 404);
      }
    }
    return c.text('Ignored');
  } catch (error) {
    console.error('[Webhook Error]', error);
    return c.text('Error', 500);
  }
});

// Telegram Bot Webhook 進入點
app.post('/bot/:token', async (c) => {
  const tokenFromPath = c.req.param('token');
  const bindings = env<Bindings>(c);
  
  if (!bindings.TELEGRAM_BOT_TOKEN || tokenFromPath !== bindings.TELEGRAM_BOT_TOKEN) {
    return c.json({ error: 'Unauthorized or Bot token not configured' }, 401);
  }

  const store = c.get('store');
  const configStr = bindings.SENSORS_CONFIG || '[]';
  const sensorsConfigs = JSON.parse(configStr);
  
  const bot = createBot(
    bindings.TELEGRAM_BOT_TOKEN, 
    sensorsConfigs, 
    store, 
    new URL(c.req.url).origin,
    c.get('ImageResponse')
  );
  
  const handleUpdate = webhookCallback(bot, 'hono');
  return handleUpdate(c);
});

// 全域錯誤處理與 404
app.notFound((c) => c.text('Not Found', 404));

app.onError((err, c) => {
  console.error(`[Global Error] ${c.req.method} ${c.req.url}:`, err);
  return c.text('伺服器發生錯誤，請稍後再試。', 500);
});

export default app;
