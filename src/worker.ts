import { app } from './core/app.js';
import { KVStore } from './core/store.js';
import { ImageResponse } from "@cf-wasm/og";
import { Hono } from 'hono';

const mainApp = new Hono();

mainApp.use('*', async (c, next) => {
  if (!c.get('store') && c.env.SENSOR_KV) {
    c.set('store', new KVStore(c.env.SENSOR_KV));
  }

  c.set("ImageResponse", ImageResponse);
  await next();
});

mainApp.route('/', app);

// Cloudflare Workers 的進入點只需要 export 預設的 fetch handler
export default mainApp;
