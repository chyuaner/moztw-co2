import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { Bindings, Variables, getSensors, getFontData, generalOgOptions, SensorIdSchema } from '../appHelper.js';
import { SensorOg, ChartOg, TemperatureChartOg, Co2ChartOg, HumidityChartOg, TemperatureHumidityChartOg, ErrorElement } from '../og.js';

const BASE_TAG_NAME = '產生即時圖表的 Open Graph .png 圖片';

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
    const sensor = sensors.find((s) => s.id === id);
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

// 使用共用的 SensorIdSchema 作為參數
const ogParams = z.object({
  id: SensorIdSchema
});

// 專為 CO2 圖表設計的參數，因為只有 'inside' 提供 CO2 資料
const co2OgParams = z.object({
  id: z.enum(['inside']).openapi({
    description: '感測器設備 (位置) - 僅限室內空間提供 CO2 資料',
    param: { description: '感測器設備 (位置) - 僅限室內空間提供 CO2 資料' },
    example: 'inside',
  }),
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

// 採用內聯 (Inline) 寫法
api.openapi(
  createRoute({
    method: 'get',
    path: '/locations/{id}',
    summary: '取得感測器的溫濕度圖表圖片',
    tags: [BASE_TAG_NAME],
    request: { params: ogParams },
    deprecated: true,
    description: '目前還不確定此Path用途，要介接整合的話建議改用 /og/locations/{id}/temperature_humidity',
    responses: ogImageResponse
  }),
  (c) => renderSensorChartResponse(c, 'temperature_humidity')
);

api.openapi(
  createRoute({
    method: 'get',
    path: '/locations/{id}/temperature',
    summary: '取得感測器的溫度圖表圖片',
    tags: [BASE_TAG_NAME],
    request: { params: ogParams },
    responses: ogImageResponse
  }),
  (c) => renderSensorChartResponse(c, 'temperature')
);

api.openapi(
  createRoute({
    method: 'get',
    path: '/locations/{id}/humidity',
    summary: '取得感測器的濕度圖表圖片',
    tags: [BASE_TAG_NAME],
    request: { params: ogParams },
    responses: ogImageResponse
  }),
  (c) => renderSensorChartResponse(c, 'humidity')
);

api.openapi(
  createRoute({
    method: 'get',
    path: '/locations/{id}/temperature_humidity',
    summary: '取得感測器的溫濕度圖表圖片',
    tags: [BASE_TAG_NAME],
    request: { params: ogParams },
    responses: ogImageResponse
  }),
  (c) => renderSensorChartResponse(c, 'temperature_humidity')
);

api.openapi(
  createRoute({
    method: 'get',
    path: '/locations/{id}/co2',
    summary: '取得感測器的 CO2 圖表圖片',
    tags: [BASE_TAG_NAME], // 這裡的 BASE_TAG_NAME 應該是 'Open Grapht產生圖表的png圖片'
    request: { params: co2OgParams }, // 使用專為 CO2 設計的參數
    responses: ogImageResponse
  }),
  (c) => renderSensorChartResponse(c, 'co2')
);

api.openapi(
  createRoute({
    method: 'get',
    path: '/chart-test',
    summary: '圖表測試圖片',
    tags: ['內部人員專用 (Internal)'],
    responses: ogImageResponse
  }),
  async (c) => {
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
  }
);

api.all('*', (c) => renderOgError(c, 404, '找不到此圖片路徑'));

export default api;
