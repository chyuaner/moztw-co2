import { z } from '@hono/zod-openapi';
import { env } from 'hono/adapter';
import { SwitchBot, SensorConfig } from './switchBot.js';
import { IStore } from './store.js';
import { ASSETS } from '../../gen/assets.gen.js';

// --- 型別定義 ---
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

// --- 全站通用的 Schema ---
export const SensorIdSchema = z.enum(['inside', 'balcony', 'corridor']).openapi({
  description: '感測器設備 (位置)\n\n- `inside`: 室內空間\n- `balcony`: 陽台\n- `corridor`: 走廊',
  param: { 
    description: '感測器設備 (位置)\n\n- `inside`: 室內空間\n- `balcony`: 陽台\n- `corridor`: 走廊' 
  },
  example: 'inside',
});

// --- 輔助函式 ---

/** 取得感測器實例列表 */
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

/** 取得字型資料 */
export const getFontData = () => {
  const binary = atob(ASSETS.font_ttf);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

/** 通用的 OG 圖片設定 */
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
