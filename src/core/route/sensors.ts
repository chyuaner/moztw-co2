import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { Bindings, Variables, getSensors, SensorIdSchema } from '../appHelper.js';
import { formatSpaceApi } from '../format.js';

const BASE_TAG_NAME = '與 SpaceAPI 介接用的相容格式';

export const SpaceApiValueSchema = z.object({
  value: z.union([z.number(), z.boolean()]).openapi({ example: 25.5 }),
  unit: z.string().optional().openapi({ example: '°C' }),
  location: SensorIdSchema,
  name: z.string().openapi({ example: '室內' }),
  lastchange: z.number().openapi({ description: '最後更新時間戳記' })
}).openapi('SpaceApiValue');

export const SpaceApiSchema = z.object({
  temperature: z.array(SpaceApiValueSchema).optional(),
  humidity: z.array(SpaceApiValueSchema).optional(),
  carbondioxide: z.array(SpaceApiValueSchema).optional(),
  door_locked: z.array(SpaceApiValueSchema).optional(),
}).openapi('SpaceApi');

export const ErrorSchema = z.object({
  error: z.string().openapi({ example: 'Sensor not found', description: '錯誤訊息' })
}).openapi('Error');

const api = new OpenAPIHono<{ Bindings: Bindings; Variables: Variables }>();

// GET /sensors
api.openapi(
  createRoute({
    method: 'get',
    path: '/',
    summary: '取得所有感測器 (與 SpaceAPI 介接用的相容格式)',
    tags: [BASE_TAG_NAME],
    description: '回傳相容於 SpaceAPI Sensors 格式的空間資訊，適合對外開放與各平台整合使用。',
    responses: {
      200: { 
        content: { 'application/json': { schema: SpaceApiSchema } }, 
        description: '成功取得空間數據' 
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
      const result: any = { temperature: [], humidity: [], carbondioxide: [], door_locked: [] };
      for (const s of sensors) {
        const data = await s.getAll();
        const formatted = formatSpaceApi(s.id, s.name, data);
        if (formatted.temperature) result.temperature.push(formatted.temperature);
        if (formatted.humidity) result.humidity.push(formatted.humidity);
        if (formatted.carbondioxide) result.carbondioxide.push(formatted.carbondioxide);
        if (formatted.door_locked) result.door_locked.push(formatted.door_locked);
      }
      return c.json(result);
    } catch (error) {
      console.error(`[Error] GET /sensors:`, error);
      return c.text('無法抓取空間資訊，請稍後再試。', 500);
    }
  }
);

// GET /sensors/:id
api.openapi(
  createRoute({
    method: 'get',
    path: '/{id}',
    summary: '取得特定感測器 (與 SpaceAPI 介接用的相容格式)',
    tags: [BASE_TAG_NAME],
    description: '回傳相容於 SpaceAPI Sensors 格式的單一感測器資訊。',
    request: {
      params: z.object({
        id: SensorIdSchema
      })
    },
    responses: {
      200: { 
        content: { 'application/json': { schema: SpaceApiSchema } }, 
        description: '成功取得空間數據' 
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
      if (!sensor) return c.json({ error: 'Sensor not found' }, 404);
      const data = await sensor.getAll();
      const formatted = formatSpaceApi(sensor.id, sensor.name, data);
      const result: any = { temperature: [], humidity: [], carbondioxide: [], door_locked: [] };
      if (formatted.temperature) result.temperature.push(formatted.temperature);
      if (formatted.humidity) result.humidity.push(formatted.humidity);
      if (formatted.carbondioxide) result.carbondioxide.push(formatted.carbondioxide);
      if (formatted.door_locked) result.door_locked.push(formatted.door_locked);
      return c.json(result);
    } catch (error) {
      console.error(`[Error] GET /sensors/${c.req.param('id')}:`, error);
      return c.text('無法抓取空間資訊，請稍後再試。', 500);
    }
  }
);

export default api;
