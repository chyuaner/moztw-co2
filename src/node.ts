import { serve } from '@hono/node-server';
import { app } from './core/app.js';
import 'dotenv/config';

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

console.log(`Starting Node.js server on http://localhost:${port}`);

// 在 Node 模式下啟動 Hono 伺服器
serve({
  fetch: app.fetch,
  port
});
