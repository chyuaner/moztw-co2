import { app } from './core/app.js';
import { KVStore } from './core/store.js';
import { ImageResponse } from "@cf-wasm/og";
import { Hono } from 'hono';

const mainApp = new Hono();

mainApp.use('*', async (c, next) => {
  if (!c.get('store') && c.env.SENSOR_KV) {
    c.set('store', new KVStore(c.env.SENSOR_KV));
  }

  c.set('ImageResponse', ImageResponse);

  // 將耗時的 KV 作業延後到回應送出後（例如 _m: 整包合併），避免 webhook 逾時
  const executionCtx = c.executionCtx;
  if (executionCtx?.waitUntil) {
    c.set('defer', (promise: Promise<unknown>) => {
      executionCtx.waitUntil(promise);
    });
  }

  await next();
});

mainApp.route('/', app);

// Cloudflare Workers 的進入點只需要 export 預設的 fetch handler
export default mainApp;
