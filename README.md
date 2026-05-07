MozTW Space Info API
================================================================================

這是一個用於抓取與提供 MozTW 摩茲工寮空間 環境資訊的 API 與 Telegram 機器人。基於 Hono 框架開發，可部署於 Cloudflare Workers 或 Node.js 環境。

## 功能用法

### 1. HTTP API
提供簡單的 HTTP 端點供外部整合：
- `GET /`: 回傳所有資訊 (JSON)。

### 2. Telegram 機器人
機器人支援以下指令：
- `/space`: 顯示完整的空間資訊（溫度、濕度、CO2）。

### 3. CLI 工具
如果你只想在終端機快速查看資訊，可以使用：
```bash
npm run get
```

## 搭建開發環境

### 1. 安裝依賴
```bash
npm install
```

### 2. 設定環境變數
將 `.env.sample` 複製為 `.env` 並填入相關資訊：
```bash
cp .env.sample .env
```
- `TELEGRAM_BOT_TOKEN`: 你的 Telegram Bot Token。
- `SENSORS_CONFIG`: 所有IoT設備的相關資訊，結構範例請看 `.env.sample` 檔案 （目前支援SwitchBot Meter/Hub 的設備）

### 3. 啟動本地伺服器
- **Cloudflare Workers 模式**: `npm run dev`
- **Node.js 伺服器模式**: `npm run dev:node`
- **Telegram Bot (Long Polling)**: `npm run dev:tg`


## 部署

### 部署到 Cloudflare Workers
```bash
npm run deploy
```

> **注意**：部署到 Cloudflare 時請使用 Webhook 模式（`/bot` 端點），本地測試可使用 Long Polling (`npm run dev:tg`)。

### 設定重要參數

`npx wrangler secret put TELEGRAM_BOT_TOKEN`

`npx wrangler secret put SENSORS_CONFIG`

(⚠️ 小提醒：在終端機貼上給 Cloudflare 的值時，不需要頭尾的單引號，直接貼上 [{...}] 即可)

### 設定Telegram Bot的模式（Webhook / Long Polling）
#### 查狀態
```
https://api.telegram.org/bot<TG_TOKEN>/getWebhookInfo
```

#### 綁定Webhook
```
https://api.telegram.org/bot<TG_TOKEN>/setWebhook?url=<YOUR_URL>
```

#### 解除綁定Webhook （回歸Long Polling模式）
```
https://api.telegram.org/bot<TG_TOKEN>/deleteWebhook
```

## 📄 授權
[MPL-2.0](LICENSE)
