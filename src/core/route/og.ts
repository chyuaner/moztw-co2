import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { getSensors, generalOgOptions, getFontData, Bindings, Variables } from '../app.js';
import { SwitchBot } from '../switchBot.js';
import { SensorOg, ChartOg, TemperatureChartOg, Co2ChartOg, HumidityChartOg, TemperatureHumidityChartOg, ErrorElement } from '../og.js';

const api = new OpenAPIHono<{ Bindings: Bindings; Variables: Variables }>();

// 輔助函式：產出 OG 錯誤圖片
const renderOgError = (c: any, statusCode: number, title: string) => {
  const ImageResponse = c.get('ImageResponse');
  if (!ImageResponse) {
    return c.text('ImageResponse錯誤，無法產生圖片。', 500);
  }

  try {
    const res = new ImageResponse(ErrorElement({ statusCode, title }), generalOgOptions);
    return new Response(res.body, {
      status: statusCode,
      headers: res.headers,
    });
  } catch (error) {
    console.error('[OG Error Render Fallback]', error);
    return c.text('無法產生圖片，以及 '+statusCode+': '+title, 500);
  }
};

api.onError((err, c) => {
  console.error('[OG Router Error]', err);
  return renderOgError(c, 500, err.message || '產圖過程中發生錯誤');
});

const renderSensorChartResponse = async (c: any, type: 'temperature' | 'humidity' | 'co2' | 'temperature_humidity') => {
  const ImageResponse = c.get('ImageResponse');
  if (!ImageResponse) {
    return c.text('ImageResponse not found in context', 500);
  }

  try {
    const id = c.req.valid('param').id;
    const sensors = getSensors(c);
    const sensor = sensors.find((s: SwitchBot) => s.id === id);
    if (!sensor) {
      return renderOgError(c, 404, `找不到感測器裝置 (${id})`);
    }

    let chartComp: any;
    let typeLabel = '';

    if (type === 'temperature_humidity') {
      chartComp = TemperatureHumidityChartOg;
      typeLabel = '溫濕度';
    } else if (type === 'temperature') {
      chartComp = TemperatureChartOg;
      typeLabel = '溫度';
    } else if (type === 'humidity') {
      chartComp = HumidityChartOg;
      typeLabel = '濕度';
    } else {
      chartComp = Co2ChartOg;
      typeLabel = 'CO2';
    }

    const title = `🏠摩茲工寮 ${sensor.name} 最近 6 小時內的${typeLabel}`;
    const historyData = await sensor.getHistoryByHours(6, 0);

    return new ImageResponse(chartComp({ datas: historyData, title }), generalOgOptions);
  } catch (error) {
    throw error;
  }
};

const ogParams = z.object({
  id: z.string().openapi({ description: '感測器設備 ID', example: 'sensor-1' })
});

const ogImageResponse = {
  200: {
    content: { 'image/png': { schema: z.string().openapi({ format: 'binary' }) } },
    description: '成功產生 OG 圖片'
  },
  404: {
    content: { 'image/png': { schema: z.string().openapi({ format: 'binary' }) } },
    description: '產生錯誤提示圖片'
  },
  500: {
    content: { 'text/plain': { schema: z.string() } },
    description: '伺服器發生錯誤'
  }
};

const getOgLocationRoute = createRoute({
  method: 'get',
  path: '/locations/{id}',
  summary: '取得位置的溫濕度圖表圖片',
  request: { params: ogParams },
  responses: ogImageResponse
});

api.openapi(getOgLocationRoute, (c) => renderSensorChartResponse(c, 'temperature_humidity'));

const getOgTemperatureRoute = createRoute({
  method: 'get',
  path: '/locations/{id}/temperature',
  summary: '取得位置的溫度圖表圖片',
  request: { params: ogParams },
  responses: ogImageResponse
});

api.openapi(getOgTemperatureRoute, (c) => renderSensorChartResponse(c, 'temperature'));

const getOgHumidityRoute = createRoute({
  method: 'get',
  path: '/locations/{id}/humidity',
  summary: '取得位置的濕度圖表圖片',
  request: { params: ogParams },
  responses: ogImageResponse
});

api.openapi(getOgHumidityRoute, (c) => renderSensorChartResponse(c, 'humidity'));

const getOgTempHumRoute = createRoute({
  method: 'get',
  path: '/locations/{id}/temperature_humidity',
  summary: '取得位置的溫濕度圖表圖片',
  request: { params: ogParams },
  responses: ogImageResponse
});

api.openapi(getOgTempHumRoute, (c) => renderSensorChartResponse(c, 'temperature_humidity'));

const getOgCo2Route = createRoute({
  method: 'get',
  path: '/locations/{id}/co2',
  summary: '取得位置的 CO2 圖表圖片',
  request: { params: ogParams },
  responses: ogImageResponse
});

api.openapi(getOgCo2Route, (c) => renderSensorChartResponse(c, 'co2'));


const getChartTestRoute = createRoute({
  method: 'get',
  path: '/chart-test',
  summary: '圖表測試圖片',
  responses: ogImageResponse
});

api.openapi(getChartTestRoute, async (c) => {
  const ImageResponse = c.get('ImageResponse');
  if (!ImageResponse) {
    return c.text('ImageResponse not found in context', 500);
  }

  try {
    return new ImageResponse(ChartOg(), 
      {
        width: 1200,
        height: 630,
        fonts: [{
          name: 'sans-serif',
          data: getFontData(),
          style: 'normal',
          weight: 400,
        }],
      });
  } catch (error) {
    throw error;
  }
});

// 萬能匹配 (OpenAPI 不適合註冊 catch-all，這段直接用 Hono 原生)
api.all('*', (c) => renderOgError(c, 404, '找不到此圖片路徑'));

export default api;
