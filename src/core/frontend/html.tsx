import { html } from 'hono/html';
import type { FC, PropsWithChildren } from 'hono/jsx';
import { SwaggerUI } from '@hono/swagger-ui';

/* ----------------------------------------------------
共用圖示區
---------------------------------------------------- */
export const ROOM_ICONS = [
  `<svg viewBox="0 0 24 24" class="w-12 h-12 stroke-[1.5] stroke-current fill-none text-slate-600"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
  `<svg viewBox="0 0 24 24" class="w-12 h-12 stroke-[1.5] stroke-current fill-none text-slate-600"><path d="M3 9h18v10H3V9zm0 0V5a2 2 0 012-2h14a2 2 0 012 2v4M8 12v-3m8 3v-3"/></svg>`,
  `<svg viewBox="0 0 24 24" class="w-12 h-12 stroke-[1.5] stroke-current fill-none text-slate-600"><path d="M20 12V8H6a2 2 0 01-2-2c0-1.1.9-2 2-2h12v4M4 10v10h16V14"/></svg>`
];

/* ----------------------------------------------------
Helper區
---------------------------------------------------- */
export const JsonRender: FC<{ value: unknown }> = ({ value }) => {
  const renderValue = (v: unknown) => {
    if (
      typeof v === 'string' ||
      typeof v === 'number' ||
      typeof v === 'boolean' ||
      v === null
    ) {
      return <span>{String(v)}</span>
    }

    if (Array.isArray(v)) {
      return (
        <ul>
          {v.map((item, idx) => (
            <li key={idx}>{renderValue(item)}</li>
          ))}
        </ul>
      )
    }

    if (typeof v === 'object') {
      return (
        <ul>
          {Object.entries(v as Record<string, unknown>).map(
            ([k, val]) => (
              <li key={k}>
                <strong>{k}:</strong> {renderValue(val)}
              </li>
            )
          )}
        </ul>
      )
    }

    return <span>Unsupported</span>
  }

  return renderValue(value)
}

/* ----------------------------------------------------
Component 區
---------------------------------------------------- */
const RoomCard: FC<{ location: any, index: number }> = ({ location, index }) => {
  const hasCo2 = location.co2 !== undefined;
  const leftBgColors = ['bg-sky-50', 'bg-green-50', 'bg-orange-50'];
  const leftBgClass = leftBgColors[index % 3];

  return (
    <div id={`room-card-${location.id}`} className="bg-white border border-gray-200 rounded-xl mb-5 flex overflow-hidden shadow-sm h-[280px]">
      <div className={`w-[120px] flex flex-col items-center justify-center p-5 border-r border-gray-200 shrink-0 ${leftBgClass}`}>
        {html(ROOM_ICONS[index % 3])}
        <h2 className="mt-3 mb-1 text-lg text-slate-800 font-bold">{location.name}</h2>
        {hasCo2 && <div className="text-xs text-violet-500 bg-violet-100 px-2 py-0.5 rounded mt-2">有 CO2 監測</div>}
      </div>
      
      <div className="grow p-2.5 relative min-w-0 flex items-center justify-center">
        {/* JS enabled chart container */}
        <div id={`chart-container-${location.id}`} data-location={`${location.id}`} data-has-co2={`${hasCo2}`} className="w-full h-full absolute inset-0 z-10"></div>
        {/* Fallback image when JS is disabled */}
        <noscript>
          <img src={`/og/locations/${location.id}/temperature`} alt="Chart Fallback" className="w-full h-full object-contain max-h-[260px] opacity-80" />
        </noscript>
      </div>
      
      <div className="w-[180px] border-l border-gray-200 p-5 flex flex-col justify-center gap-3 shrink-0 bg-neutral-50 z-20">
        <div className="text-xs text-gray-500 mb-1 text-center">目前數值 <span className="current-time"></span></div>
        <div className="rounded-lg p-3 text-center bg-red-50 text-red-500">
          <div>
            <span className="val-temp text-2xl font-bold">{location.temperature?.toFixed(1) || '--'}</span>
            <span className="text-xs ml-0.5">°C</span>
          </div>
          <div className="text-xs mt-1 opacity-80">溫度</div>
        </div>
        <div className="rounded-lg p-3 text-center bg-blue-50 text-blue-500">
          <div>
            <span className="val-hum text-2xl font-bold">{location.humidity?.toFixed(0) || '--'}</span>
            <span className="text-xs ml-0.5">%</span>
          </div>
          <div className="text-xs mt-1 opacity-80">濕度</div>
        </div>
        {hasCo2 && (
          <div className="rounded-lg p-3 text-center bg-violet-50 text-violet-500">
            <div>
              <span className="val-co2 text-2xl font-bold">{location.co2 || '--'}</span>
              <span className="text-xs ml-0.5">ppm</span>
            </div>
            <div className="text-xs mt-1 opacity-80">CO2</div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ----------------------------------------------------
Layout區
---------------------------------------------------- */
export interface BaseData {
  baseUrl?: string;
  [key: string]: any;
}

export const Base: FC<PropsWithChildren<{ title?: string, baseData?: BaseData }>> = (props) => {
  const site_title = 'Moztw Space 摩茲工寮環境狀態';
  const description = '';
  const keywords = '';

  const { baseUrl } = props.baseData || {};
  const PUBLIC_BASE_URL = baseUrl || '';

  return (
    <html lang="zh-tw">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      <title>{props.title ?? site_title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta property="og:title" content={site_title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      {PUBLIC_BASE_URL && <meta property="og:url" content={PUBLIC_BASE_URL} />}
      <meta property="og:site_name" content={site_title} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={site_title} />
      <meta name="twitter:description" content={description} />
      <link rel="stylesheet" href="/style.css" />
    </head>
    <body className="bg-gray-50 text-gray-900 m-0 p-5 font-sans min-h-screen">
      <main id="app-content">
        {props.children}
      </main>
      <script type="module" src="/client.js"></script>
    </body>
    </html>
  )
}

/* ----------------------------------------------------
Page 區
---------------------------------------------------- */
export const IndexPage: FC<{}> = (props) => {
  return (
    <Base>
      <h1>歡迎來到摩茲工寮環境資訊 API</h1>
      <p>
      此服務提供摩茲工寮的環境感測器數據。
      目前前端頁面正在建構中，您可以透過以下 API 端點取得資料：
      </p>
      <ul>
      <li><a href="/doc"><code>/doc</code></a> - API 互動文件 (Swagger UI)。</li>
      <li><a href="/sensors"><code>/sensors</code></a> - 依據 <a href="https://spaceapi.io/docs">SpaceAPI</a> 規格提供所有感測器的數據。</li>
      <li><a href="/sensors/:id"><code>/sensors/:id</code></a> - 取得特定感測器（SpaceAPI 格式）的數據。</li>
      <li><a href="/locations"><code>/locations</code></a> - 提供所有裝置的原始格式數據。</li>
      <li><a href="/locations/:id"><code>/locations/:id</code></a> - 取得特定裝置的原始格式數據。</li>
      <li><a href="/locations/:id/history"><code>/locations/:id/history</code></a> - 取得特定裝置的歷史數據。</li>
      </ul>
      <p>
      您也可以透過 Telegram Bot 查詢即時資訊。請在 Telegram 搜尋您的 Bot 名稱。
      </p>
    </Base>
  )
}

export const Dashboard: FC<{ locations: any[] }> = ({ locations }) => {
  const timeLabels = { '6h': '6 小時', '24h': '24 小時', '7d': '7 天', '30d': '30 天' };

  return (
    <Base title="三個房間 環境監測">
      <div className="max-w-[1200px] mx-auto">
        <div className="flex justify-between items-end mb-6 pb-3 border-b-2 border-gray-200">
          <div className="flex items-center">
            <h1 className="m-0 text-2xl flex items-center gap-3">三個房間 環境監測</h1>
            <div className="flex gap-4 text-sm text-gray-500 ml-5">
              <div className="flex items-center gap-1.5"><div className="w-5 h-0.5 bg-red-500"></div> 溫度 (°C)</div>
              <div className="flex items-center gap-1.5"><div className="w-5 h-0 border-t-2 border-dashed border-blue-500"></div> 濕度 (%)</div>
              <div className="flex items-center gap-1.5"><div className="w-5 h-0.5 bg-violet-500"></div> CO2 (ppm)</div>
            </div>
          </div>
          <div className="flex gap-2 bg-gray-100 p-1 rounded-lg">
            {Object.entries(timeLabels).map(([key, label]) => (
              <button 
                key={key} 
                data-timeframe={key}
                className={`timeframe-btn px-3 py-1.5 rounded-md text-sm transition-all duration-200 ${key === '6h' ? 'bg-white text-gray-900 shadow font-semibold' : 'text-gray-500 hover:text-gray-900'}`}
              >{label}</button>
            ))}
          </div>
        </div>

        <div className="flex flex-col">
          {locations.map((loc, i) => (
            <RoomCard key={loc.id} location={loc} index={i} />
          ))}
        </div>
        
        <div className="flex items-center gap-4 mt-4 text-xs text-gray-500 border-t border-gray-200 pt-3">
          <span>💡 說明：CO2 背景色帶代表空氣品質狀態，建議依需要適時通風以維持良好空氣品質。</span>
          <div className="flex-1"></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#dcfce7]"></div> 良好 &lt; 800 ppm</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#fef08a]"></div> 普通 800-1200 ppm</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#fed7aa]"></div> 不佳 1200-2000 ppm</div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#fecaca]"></div> 很差 &gt; 2000 ppm</div>
        </div>
      </div>
    </Base>
  );
};

export const ApiDocPage: FC = () => {
  return (
    <Base title="API Documentation">
      <link rel="stylesheet" href="/swagger-ui.css" />
      {/* <style dangerouslySetInnerHTML={{ __html: `
        .swagger-ui .topbar { display: none !important; }
      ` }} /> */}
      <div className="max-w-[1200px] mx-auto bg-white rounded-xl shadow-sm overflow-hidden p-2">
        <div id="swagger-ui"></div>
      </div>
      <script src="/swagger-ui-bundle.js"></script>
      <script src="/swagger-ui-standalone-preset.js"></script>
      <script dangerouslySetInnerHTML={{ __html: `
        window.onload = () => {
          window.ui = SwaggerUIBundle({
            url: '/openapi.json',
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
              SwaggerUIBundle.presets.apis,
              SwaggerUIStandalonePreset
            ],
            layout: "BaseLayout",
          });
        };
      ` }} />
    </Base>
  );
};
