import type { FC, PropsWithChildren } from 'hono/jsx'

/* ----------------------------------------------------
Helper區
---------------------------------------------------- */
const JsonRender: FC<{ value: unknown }> = ({ value }) => {
  // 內部仍然使用同一個遞迴函式（名稱改為 renderValue）
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
Layout區
---------------------------------------------------- */
export interface BaseData {
  baseUrl?: string;
  [key: string]: any;
}

const Base: FC<PropsWithChildren<{ title?: string, baseData?: BaseData }>> = (props) => {
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
      {/* <meta name="color-scheme" content="light dark" />
      <meta name="theme-color" content="#cfe9f8" media="(prefers-color-scheme: light)" />
      <meta name="theme-color" content="#293955" media="(prefers-color-scheme: dark)" /> */}
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta property="og:title" content={site_title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      {PUBLIC_BASE_URL && <meta property="og:url" content={PUBLIC_BASE_URL} />}
      {/* <meta property="og:image" content={PUBLIC_BASE_URL ? `${PUBLIC_BASE_URL}/ip.png` : '/ip.png'} /> */}
      <meta property="og:site_name" content={site_title} />
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={site_title} />
      <meta name="twitter:description" content={description} />
      {/* <meta name="twitter:image" content={PUBLIC_BASE_URL ? `${PUBLIC_BASE_URL}/ip.png` : '/ip.png'} /> */}
    </head>
    <body>
      <main id="app-content">
        {props.children}
      </main>
    </body>
    </html>
  )
}

/* ----------------------------------------------------
Page 區
---------------------------------------------------- */
const IndexPage: FC<{}> = (props) => {
  return (
    <Base>
      <h1>歡迎來到摩茲工寮環境資訊 API</h1>
      <p>
      此服務提供摩茲工寮的環境感測器數據。
      目前前端頁面正在建構中，您可以透過以下 API 端點取得資料：
      </p>
      <ul>
      <li><a href="/sensors"><code>/sensors</code></a> - 依據 <a href="https://spaceapi.io/docs">SpaceAPI</a> 規格提供所有感測器的數據。</li>
      <li><a href="/sensors/:id"><code>/sensors/:id</code></a> - 取得特定感測器（SpaceAPI 格式）的數據。</li>
      <li><a href="/devices"><code>/devices</code></a> - 提供所有裝置的原始格式數據。</li>
      <li><a href="/devices/:id"><code>/devices/:id</code></a> - 取得特定裝置的原始格式數據。</li>
      <li><a href="/devices/:id/history"><code>/devices/:id/history</code></a> - 取得特定裝置的歷史數據。</li>
      </ul>
      <p>
      您也可以透過 Telegram Bot 查詢即時資訊。請在 Telegram 搜尋您的 Bot 名稱 (由 `TELEGRAM_BOT_TOKEN` 環境變數設定)。
      </p>
    </Base>
  )
}

/* ----------------------------------------------------
設定哪些組件要開放
---------------------------------------------------- */
export {IndexPage, Base};