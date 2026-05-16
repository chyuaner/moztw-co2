import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors'
import { env } from 'hono/adapter';
import locationsApi from './route/locations.js';
import sensorsApi from './route/sensors.js';
import ogApi from './route/og.js';
import { app as fe } from './frontend/route.js';
import { webhookCallback } from 'grammy';
import { createBot } from './route/bot.js'; 
import { Bindings, Variables, getSensors } from './appHelper.js';
import { BUILD_INFO } from '../../gen/assets.gen.js';

export const app = new OpenAPIHono<{ Bindings: Bindings; Variables: Variables }>();

/* -----------------------------------------------------------------------------
前置處理
----------------------------------------------------------------------------- */
app.use('/*', cors());

/* -----------------------------------------------------------------------------
自動生成 OpenAPI Spec 的路由
----------------------------------------------------------------------------- */
app.get('/openapi.json', (c) => {
  const doc = app.getOpenAPIDocument({
    openapi: '3.1.0',
    info: {
      title: 'Moztw Space API',
      version: BUILD_INFO.version,
      description: '提供摩茲工寮即時空間感測數據',
    },
    tags: [
      {
        name: '與 SpaceAPI 介接用的相容格式',
        description: '提供符合 SpaceAPI 規範的感測器數據（包含溫度、濕度、CO2資料）。',
      },
      {
        name: '取得感測器的溫度、濕度、CO2資料',
        description: '提供各感測器的即時與歷史數據，輸出格式為本站專用。',
      },
      {
        name: '產生即時圖表的 Open Graph .png 圖片',
        description: '動態生成圖片服務，包含感測器數據圖表。',
      }
    ]
  });

  const token = c.req.query('token') || '';
  const bindings = env<Bindings>(c);
  const sensors = getSensors(c);
  
  // 驗證 token：相符於 TELEGRAM_BOT_TOKEN，或是任一感測器的設定
  const isValidToken = 
    (bindings.TELEGRAM_BOT_TOKEN && token === bindings.TELEGRAM_BOT_TOKEN) || 
    sensors.some(s => s.checkToken(token));

  // 如果 token 不正確，過濾掉含有「內部人員專用 (Internal)」的 API
  if (!isValidToken) {
    for (const path in doc.paths) {
      const methods = doc.paths[path] as Record<string, any>;
      for (const method in methods) {
        if (methods[method].tags?.includes('內部人員專用 (Internal)')) {
          delete methods[method];
        }
      }
      if (Object.keys(methods).length === 0) {
        delete doc.paths[path];
      }
    }
  }

  return c.json(doc);
});

/* -----------------------------------------------------------------------------
主要 Router 掛載區
----------------------------------------------------------------------------- */
app.route('/locations', locationsApi);
app.route('/sensors', sensorsApi);
app.route('/og', ogApi);

/* =============================================================================
前端區 (已經移到 ./frontend/route.ts)
============================================================================= */
app.route('/', fe);

/* =============================================================================
接入整合外部服務區
============================================================================= */

import { z, createRoute } from '@hono/zod-openapi';

// 處理來自 SwitchBot 的 Webhook 數據更新
app.openapi(
  createRoute({
    method: 'post',
    path: '/switch-bot/{token}',
    summary: 'SwitchBot Webhook 接收端',
    tags: ['內部人員專用 (Internal)'],
    description: '接收來自 SwitchBot 的資料更新',
    request: {
      params: z.object({
        token: z.string().openapi({ description: 'Webhook Token', param: { description: 'Webhook Token' } })
      }),
      body: {
        content: {
          'application/json': {
            schema: z.object({
              eventType: z.string().openapi({ example: 'changeReport' }),
              eventVersion: z.string().openapi({ example: '1' }),
              context: z.object({
                deviceMac: z.string().openapi({ example: 'B0E9FEF087CD' }),
                deviceType: z.string().openapi({ example: 'MeterPro(CO2)' }),
                temperature: z.number().openapi({ example: 25.3 }),
                humidity: z.number().openapi({ example: 70 }),
                CO2: z.number().optional().openapi({ example: 413 }),
                battery: z.number().optional().openapi({ example: 100 }),
                scale: z.string().optional().openapi({ example: 'CELSIUS' }),
                timeOfSample: z.number().optional().openapi({ example: 1778721288070 })
              }).openapi({ description: '裝置資料' })
            }).openapi('SwitchBotWebhookPayload')
          }
        }
      }
    },
    responses: {
      200: { description: 'OK', content: { 'text/plain': { schema: z.string() } } },
      401: { description: 'Unauthorized', content: { 'text/plain': { schema: z.string() } } },
      404: { description: 'Device not configured', content: { 'text/plain': { schema: z.string() } } },
      500: { description: 'Error', content: { 'text/plain': { schema: z.string() } } }
    }
  }),
  async (c) => {
    const tokenFromPath = c.req.valid('param').token;
    const sensors = getSensors(c);
    
    try {
      const body = await c.req.json();
      console.log('[Webhook] Received:', JSON.stringify(body));
      
      if (body.eventType === 'changeReport' && body.context && body.context.deviceMac) {
        const mac = body.context.deviceMac;
        const targetSensor = sensors.find((s) => {
          const configuredMac = s.deviceId.replace(/:/g, '').toUpperCase();
          return configuredMac === mac.toUpperCase();
        });

        if (targetSensor) {
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
    } catch (error) {
      console.error('[Webhook Error]', error);
      return c.text('Error', 500);
    }
  }
);

// Telegram Bot Webhook 進入點
app.openapi(
  createRoute({
    method: 'post',
    path: '/bot/{token}',
    summary: 'Telegram Bot Webhook 接收端',
    tags: ['內部人員專用 (Internal)'],
    description: '接收來自 Telegram Bot 的指令',
    request: {
      params: z.object({
        token: z.string().openapi({ description: 'Telegram Bot Token', param: { description: 'Telegram Bot Token' } })
      })
    },
    responses: {
      200: { description: 'OK', content: { 'application/json': { schema: z.any() } } },
      401: { description: 'Unauthorized', content: { 'application/json': { schema: z.any() } } }
    }
  }),
  async (c) => {
    const tokenFromPath = c.req.valid('param').token;
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
  }
);

// 全域錯誤處理與 404
app.notFound((c) => c.text('Not Found', 404));

app.onError((err, c) => {
  console.error(`[Global Error] ${c.req.method} ${c.req.url}:`, err);
  return c.text('伺服器發生錯誤，請稍後再試。', 500);
});

export default app;
