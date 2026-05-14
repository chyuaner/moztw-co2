import { Hono } from 'hono';
import { getSensors } from '../app';
import { Dashboard } from './html';
import { ASSETS } from '../../../gen/assets.gen';

export const app = new Hono();

/* -----------------------------------------------------------------------------
Helper 區
----------------------------------------------------------------------------- */

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

app.get("/style.css", (c) => {
  const asset = serveBase64(ASSETS.style_css, "text/css");
  return c.body(asset.body, 200, asset.headers);
});

app.get("/client.js", (c) => {
  const asset = serveBase64(ASSETS.client_js, "application/javascript");
  return c.body(asset.body, 200, asset.headers);
});


/* -----------------------------------------------------------------------------
前端操作介面區
----------------------------------------------------------------------------- */
app.get('/', async (c) => {
  const sensors = getSensors(c);
  const locations = await Promise.all(sensors.map(async s => {
    const current = await s.getAll();
    return { id: s.id, name: s.name, ...current };
  }));
  return c.html(Dashboard({ locations }) as any);
});