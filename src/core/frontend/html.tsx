import { html } from 'hono/html';
import type { FC, PropsWithChildren } from 'hono/jsx';
import { SwaggerUI } from '@hono/swagger-ui';

/* ----------------------------------------------------
共用圖示區
---------------------------------------------------- */
export const ROOM_ICONS = [
  `<svg viewBox="0 0 24 24" class="w-12 h-12 stroke-[1.5] stroke-current fill-none text-base-content/60"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
  `<svg viewBox="0 0 24 24" class="w-12 h-12 stroke-[1.5] stroke-current fill-none text-base-content/60"><path d="M3 9h18v10H3V9zm0 0V5a2 2 0 012-2h14a2 2 0 012 2v4M8 12v-3m8 3v-3"/></svg>`,
  `<svg viewBox="0 0 24 24" class="w-12 h-12 stroke-[1.5] stroke-current fill-none text-base-content/60"><path d="M20 12V8H6a2 2 0 01-2-2c0-1.1.9-2 2-2h12v4M4 10v10h16V14"/></svg>`
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
        <ul className="list-disc list-inside">
          {v.map((item, idx) => (
            <li key={idx}>{renderValue(item)}</li>
          ))}
        </ul>
      )
    }

    if (typeof v === 'object') {
      return (
        <ul className="list-none">
          {Object.entries(v as Record<string, unknown>).map(
            ([k, val]) => (
              <li key={k}>
                <strong className="text-primary">{k}:</strong> {renderValue(val)}
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
  const leftBgColors = ['bg-info/10', 'bg-success/10', 'bg-warning/10'];
  const leftBgClass = leftBgColors[index % 3];

  return (
    <div id={`room-card-${location.id}`} className="card lg:card-side bg-base-100 shadow-xl mb-6 overflow-hidden h-auto lg:h-[280px] border border-base-200">
      <div className={`w-full lg:w-[120px] flex flex-row lg:flex-col items-center justify-center p-5 border-b lg:border-b-0 lg:border-r border-base-200 shrink-0 ${leftBgClass}`}>
        {html(ROOM_ICONS[index % 3])}
        <h2 className="ml-4 lg:ml-0 lg:mt-3 mb-1 text-lg font-bold text-base-content">{location.name}</h2>
        {hasCo2 && <div className="badge badge-primary badge-outline ml-auto lg:ml-0 lg:mt-2 text-xs font-semibold">有 CO2 監測</div>}
      </div>
      
      <div className="grow p-2.5 relative min-w-0 flex items-center justify-center min-h-[200px]">
        {/* JS enabled chart container */}
        <div id={`chart-container-${location.id}`} data-location={`${location.id}`} data-has-co2={`${hasCo2}`} className="w-full h-full absolute inset-0 z-10"></div>
        {/* Fallback image when JS is disabled */}
        <noscript>
          <img src={`/og/locations/${location.id}/temperature`} alt="Chart Fallback" className="w-full h-full object-contain max-h-[260px] opacity-80" />
        </noscript>
      </div>
      
      <div className="w-full lg:w-[180px] border-t lg:border-t-0 lg:border-l border-base-200 p-5 flex flex-row lg:flex-col justify-center gap-3 shrink-0 bg-base-200/50 z-20">
        <div className="hidden lg:block text-xs text-base-content/60 mb-1 text-center font-medium">目前數值 <span className="current-time"></span></div>
        <div className="stat bg-error/10 text-error rounded-box p-3 shadow-sm">
          <div className="stat-title text-error/80 text-xs font-bold">溫度</div>
          <div className="stat-value text-2xl flex items-baseline justify-center">
            <span className="val-temp">{location.temperature?.toFixed(1) || '--'}</span>
            <span className="text-sm ml-1 font-normal">°C</span>
          </div>
        </div>
        <div className="stat bg-info/10 text-info rounded-box p-3 shadow-sm">
          <div className="stat-title text-info/80 text-xs font-bold">濕度</div>
          <div className="stat-value text-2xl flex items-baseline justify-center">
            <span className="val-hum">{location.humidity?.toFixed(0) || '--'}</span>
            <span className="text-sm ml-1 font-normal">%</span>
          </div>
        </div>
        {hasCo2 && (
          <div className="stat bg-secondary/10 text-secondary rounded-box p-3 shadow-sm">
            <div className="stat-title text-secondary/80 text-xs font-bold">CO2</div>
            <div className="stat-value text-2xl flex items-baseline justify-center">
              <span className="val-co2">{location.co2 || '--'}</span>
              <span className="text-sm ml-1 font-normal">ppm</span>
            </div>
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
    <html lang="zh-tw" data-theme="light">
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
    <body className="bg-base-200 text-base-content m-0 font-sans min-h-screen">
      <div className="p-4 md:p-6 lg:p-8">
        <main id="app-content">
          {props.children}
        </main>
      </div>
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
      <div className="hero min-h-[80vh] bg-base-100 rounded-3xl shadow-xl border border-base-200 overflow-hidden">
        <div className="hero-content text-center py-12">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-extrabold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">摩茲工寮環境資訊 API</h1>
            <p className="py-2 text-lg text-base-content/80 mb-8">
              此服務提供摩茲工寮的環境感測器數據。<br/>目前前端頁面正在建構中，您可以透過以下 API 端點取得資料：
            </p>
            <div className="flex flex-col gap-3 text-left bg-base-200/50 p-6 md:p-8 rounded-2xl border border-base-200 mb-8">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-center">
                <a className="btn btn-primary btn-sm w-full sm:w-auto sm:min-w-[140px] font-mono" href="/doc">/doc</a>
                <span className="text-sm font-medium">API 互動文件 (Swagger UI)</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-center mt-2">
                <a className="btn btn-outline btn-sm w-full sm:w-auto sm:min-w-[140px] font-mono" href="/sensors">/sensors</a>
                <span className="text-sm text-base-content/80">依據 SpaceAPI 規格提供所有感測器的數據</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-center">
                <a className="btn btn-outline btn-sm w-full sm:w-auto sm:min-w-[140px] font-mono" href="/sensors/:id">/sensors/:id</a>
                <span className="text-sm text-base-content/80">取得特定感測器數據</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-center mt-2">
                <a className="btn btn-outline btn-sm w-full sm:w-auto sm:min-w-[140px] font-mono" href="/locations">/locations</a>
                <span className="text-sm text-base-content/80">提供所有裝置的原始格式數據</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-center">
                <a className="btn btn-outline btn-sm w-full sm:w-auto sm:min-w-[140px] font-mono" href="/locations/:id">/locations/:id</a>
                <span className="text-sm text-base-content/80">取得特定裝置的原始格式數據</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-center">
                <a className="btn btn-outline btn-sm w-full sm:w-auto sm:min-w-[140px] font-mono" href="/locations/:id/history">/locations/:id/history</a>
                <span className="text-sm text-base-content/80">取得特定裝置的歷史數據</span>
              </div>
            </div>
            <div className="alert alert-info bg-info/10 text-info-content border-info/20 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="stroke-info shrink-0 w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <span>您也可以透過 Telegram Bot 查詢即時資訊。請在 Telegram 搜尋您的 Bot 名稱。</span>
            </div>
          </div>
        </div>
      </div>
    </Base>
  )
}

export const Dashboard: FC<{ locations: any[] }> = ({ locations }) => {
  const timeLabels = { '6h': '6 小時', '24h': '24 小時', '7d': '7 天', '30d': '30 天' };

  return (
    <Base title="三個房間 環境監測">
      <div className="max-w-[1200px] mx-auto">
        <div className="navbar bg-base-100 shadow-sm rounded-box mb-6 px-4 md:px-6 border border-base-200">
          <div className="flex-1 flex-col md:flex-row items-start md:items-center gap-2 md:gap-0 py-3 md:py-0">
            <h1 className="text-2xl font-bold m-0 text-base-content">三個房間 環境監測</h1>
            <div className="flex gap-4 text-sm text-base-content/60 md:ml-6 font-medium">
              <div className="flex items-center gap-1.5"><div className="w-5 h-1 rounded-full bg-error"></div> 溫度</div>
              <div className="flex items-center gap-1.5"><div className="w-5 h-0 border-t-2 border-dashed border-info"></div> 濕度</div>
              <div className="flex items-center gap-1.5"><div className="w-5 h-1 rounded-full bg-secondary"></div> CO2</div>
            </div>
          </div>
          <div className="flex-none hidden sm:flex">
            <div className="join bg-base-200 p-1 rounded-lg">
              {Object.entries(timeLabels).map(([key, label]) => (
                <button 
                  key={key} 
                  data-timeframe={key}
                  className={`timeframe-btn join-item btn btn-sm border-none shadow-none ${key === '6h' ? 'btn-active bg-base-100 hover:bg-base-100 text-base-content shadow-sm' : 'bg-transparent text-base-content/60 hover:bg-base-200/50'}`}
                >{label}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex sm:hidden mb-4">
          <div className="join bg-base-200 p-1 rounded-lg w-full">
            {Object.entries(timeLabels).map(([key, label]) => (
              <button 
                key={key} 
                data-timeframe={key}
                className={`timeframe-btn join-item btn btn-sm border-none shadow-none flex-1 ${key === '6h' ? 'btn-active bg-base-100 hover:bg-base-100 text-base-content shadow-sm' : 'bg-transparent text-base-content/60 hover:bg-base-200/50'}`}
              >{label}</button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {locations.map((loc, i) => (
            <RoomCard key={loc.id} location={loc} index={i} />
          ))}
        </div>
        
        <div className="alert bg-base-100 border border-base-200 mt-4 shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="flex items-center gap-3">
            <div className="avatar placeholder">
              <div className="bg-info text-info-content rounded-full w-8">
                <span className="text-lg">💡</span>
              </div>
            </div>
            <div>
              <h3 className="font-bold text-sm text-base-content">說明：</h3>
              <div className="text-xs text-base-content/70">CO2 背景色帶代表空氣品質狀態，建議適時通風。</div>
            </div>
          </div>
          <div className="flex-1"></div>
          <div className="flex flex-wrap gap-2 text-xs">
            <div className="badge badge-success badge-outline gap-1.5 p-3"><div className="w-2 h-2 rounded-full bg-success"></div>良好 &lt; 800 ppm</div>
            <div className="badge badge-warning badge-outline gap-1.5 p-3"><div className="w-2 h-2 rounded-full bg-warning"></div>普通 800-1200</div>
            <div className="badge badge-error badge-outline gap-1.5 p-3 opacity-80"><div className="w-2 h-2 rounded-full bg-error"></div>不佳 1200-2000</div>
            <div className="badge badge-error badge-outline gap-1.5 p-3"><div className="w-2 h-2 rounded-full bg-error"></div>很差 &gt; 2000</div>
          </div>
        </div>
      </div>
    </Base>
  );
};

export const ApiDocPage: FC = () => {
  return (
    <Base title="API Documentation">
      <link rel="stylesheet" href="/swagger-ui.css" />
      <div className="max-w-[1200px] mx-auto bg-base-100 rounded-box shadow-xl border border-base-200 overflow-hidden p-4">
        <div id="swagger-ui"></div>
      </div>
      <script src="/swagger-ui-bundle.js"></script>
      <script src="/swagger-ui-standalone-preset.js"></script>
      <script dangerouslySetInnerHTML={{ __html: `
        window.onload = () => {
          window.ui = SwaggerUIBundle({
            url: '/openapi.json' + window.location.search,
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
