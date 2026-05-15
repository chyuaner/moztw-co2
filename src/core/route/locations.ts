import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { SensorIdSchema, Bindings, Variables, getSensors } from '../appHelper.js';
import { SwitchBot, SensorDataRecord } from '../switchBot.js';

export const SensorDataSchema = z.object({
  temperature: z.number().optional().openapi({ example: 25.5, description: '目前攝氏溫度' }),
  temperature_lastchange: z.number().optional().openapi({ description: '溫度最後更新時間' }),
  temperature_iswebhook: z.boolean().optional().openapi({ description: '溫度資料是否來自 webhook' }),
  humidity: z.number().optional().openapi({ example: 60, description: '目前相對濕度 (%)' }),
  humidity_lastchange: z.number().optional().openapi({ description: '濕度最後更新時間' }),
  humidity_iswebhook: z.boolean().optional().openapi({ description: '濕度資料是否來自 webhook' }),
  co2: z.number().optional().openapi({ example: 450, description: 'CO2 濃度 (ppm)' }),
  co2_lastchange: z.number().optional().openapi({ description: 'CO2最後更新時間' }),
  co2_iswebhook: z.boolean().optional().openapi({ description: 'CO2資料是否來自 webhook' }),
  lastchange: z.number().optional().openapi({ description: '最後更新時間戳記 (Unix Timestamp)' }),
  isWebhook: z.boolean().optional().openapi({ description: '標記本次數據來源是否為 webhook' }),
}).openapi('SensorData');

export const LocationSchema = SensorDataSchema.extend({
  id: SensorIdSchema,
  name: z.string().openapi({ example: '室內', description: '感測器顯示名稱' }),
}).openapi('Location');

export const ErrorSchema = z.object({
  error: z.string().openapi({ example: 'Not found', description: '錯誤訊息' })
}).openapi('Error');

export const HistoryQuerySchema = z.object({
  limit: z.string().optional().openapi({ description: '回傳筆數限制', example: '100' }),
  offset: z.string().optional().openapi({ description: '跳過的筆數', example: '0' }),
  min_ts: z.string().optional().openapi({ description: '起始時間戳記' }),
  max_ts: z.string().optional().openapi({ description: '結束時間戳記' }),
  limit_days: z.string().optional().openapi({ description: '過去幾天內的資料' }),
  offset_days: z.string().optional().openapi({ description: '往前回溯的天數' }),
  limit_months: z.string().optional().openapi({ description: '過去幾個月的資料' }),
  offset_months: z.string().optional().openapi({ description: '往前回溯的月數' }),
  limit_hours: z.string().optional().openapi({ description: '過去幾小時的資料' }),
  offset_hours: z.string().optional().openapi({ description: '往前回溯的小時數' })
});

const api = new OpenAPIHono<{ Bindings: Bindings; Variables: Variables }>();

// GET /locations
api.openapi(
  createRoute({
    method: 'get',
    path: '/',
    summary: '取得所有位置',
    description: '回傳摩茲工寮內所有感測器的即時狀態，包含溫度、濕度與 CO2。',
    responses: {
      200: { 
        content: { 'application/json': { schema: z.array(LocationSchema) } }, 
        description: '成功取得所有感測器數據' 
      },
      500: { 
        content: { 'text/plain': { schema: z.string() } },
        description: '伺服器發生錯誤' 
      }
    }
  }),
  async (c) => {
    try {
      const sensors = getSensors(c);
      const result: any[] = [];
      for (const s of sensors) {
        const data = await s.getAll();
        result.push({ id: s.id, name: s.name, ...data });
      }
      return c.json(result);
    } catch (error) {
      console.error(`[Error] GET /devices:`, error);
      return c.text('無法抓取裝置資訊，請稍後再試。', 500);
    }
  }
);

// GET /locations/:id
api.openapi(
  createRoute({
    method: 'get',
    path: '/{id}',
    summary: '取得特定位置的即時數據',
    description: '根據感測器 ID 回傳該感測器的即時狀態',
    request: {
      params: z.object({
        id: SensorIdSchema
      })
    },
    responses: {
      200: { 
        content: { 'application/json': { schema: LocationSchema } }, 
        description: '成功取得感測器數據' 
      },
      404: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: '找不到指定的感測器'
      },
      500: { 
        content: { 'text/plain': { schema: z.string() } },
        description: '伺服器發生錯誤' 
      }
    }
  }),
  async (c) => {
    try {
      const id = c.req.valid('param').id;
      const sensors = getSensors(c);
      const sensor = sensors.find((s) => s.id === id);
      if (!sensor) return c.json({ error: 'Device not found' }, 404);
      const data = await sensor.getAll();
      return c.json({ id: sensor.id, name: sensor.name, ...data });
    } catch (error) {
      console.error(`[Error] GET /devices/${c.req.param('id')}:`, error);
      return c.text('無法抓取裝置資訊，請稍後再試。', 500);
    }
  }
);

// GET /locations/:id/history
api.openapi(
  createRoute({
    method: 'get',
    path: '/{id}/history',
    summary: '取得特定位置的歷史數據',
    description: '根據感測器 ID 及時間範圍條件回傳歷史數據',
    request: {
      params: z.object({
        id: SensorIdSchema
      }),
      query: HistoryQuerySchema
    },
    responses: {
      200: { 
        content: { 'application/json': { schema: z.array(SensorDataSchema) } }, 
        description: '成功取得歷史數據' 
      },
      404: {
        content: { 'application/json': { schema: ErrorSchema } },
        description: '找不到指定的感測器'
      },
      500: { 
        content: { 'text/plain': { schema: z.string() } },
        description: '伺服器發生錯誤' 
      }
    }
  }),
  async (c) => {
    try {
      const id = c.req.valid('param').id;
      const query = c.req.valid('query');
      const sensors = getSensors(c);
      const sensor = sensors.find((s) => s.id === id);
      if (!sensor) return c.json({ error: 'Device not found' }, 404);

      let results: SensorDataRecord[] = [];
      
      if (query.min_ts) {
        const min = parseInt(query.min_ts);
        const max = query.max_ts ? parseInt(query.max_ts) : undefined;
        results = await sensor.getHistoryByTimestamp(min, max);
      } else if (query.limit_days) {
        const limit = parseInt(query.limit_days);
        const offset = query.offset_days ? parseInt(query.offset_days) : 0;
        results = await sensor.getHistoryByDays(limit, offset);
      } else if (query.limit_months) {
        const limit = parseInt(query.limit_months);
        const offset = query.offset_months ? parseInt(query.offset_months) : 0;
        results = await sensor.getHistoryByMonths(limit, offset);
      } else if (query.limit_hours) {
        const limit = parseInt(query.limit_hours);
        const offset = query.offset_hours ? parseInt(query.offset_hours) : 0;
        results = await sensor.getHistoryByHours(limit, offset);
      } else {
        const limit = query.limit ? parseInt(query.limit) : 100;
        const offset = query.offset ? parseInt(query.offset) : 0;
        results = await sensor.getHistory(limit, offset);
        return c.json(results); 
      }

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
  }
);

export default api;
