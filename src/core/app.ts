import { OpenAPIHono } from '@hono/zod-openapi';
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

// 自動生成 OpenAPI Spec 的路由
app.doc('/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'Moztw Space API',
    version: BUILD_INFO.version,
    description: '提供摩茲工寮即時空間感測數據',
  },
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

// 處理來自 SwitchBot 的 Webhook 數據更新
app.post('/switch-bot/:token', async (c) => {
  const tokenFromPath = c.req.param('token');
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
