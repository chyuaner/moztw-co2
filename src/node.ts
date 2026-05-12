import { serve } from '@hono/node-server';
import { app } from './core/app.js';
import { FileStore } from './core/fileStore.js';
import { ImageResponse } from "@cf-wasm/og";
import { Hono } from 'hono';
import path from 'node:path';
import 'dotenv/config';

const mainApp = new Hono();

mainApp.use('*', async (c, next) => {
  if (!c.get('store')) {
    c.set('store', new FileStore(path.resolve(process.cwd(), '.data/')));
  }
  c.set("ImageResponse", ImageResponse);
  await next();
});

mainApp.route('/', app);

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

console.log(`Starting Node.js server on http://localhost:${port}`);

// 在 Node 模式下啟動 Hono 伺服器
serve({
  fetch: mainApp.fetch,
  port
});
