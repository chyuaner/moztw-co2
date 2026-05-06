MozTW Space Info API
================================================================================

這是一個用於抓取與提供 MozTW 摩茲工寮空間 環境資訊的 API 與 Telegram 機器人。基於 Hono 框架開發，可部署於 Cloudflare Workers 或 Node.js 環境。

## 功能用法

### 1. HTTP API
提供簡單的 HTTP 端點供外部整合：
- `GET /`: 回傳所有資訊 (JSON)。
- `GET /temperature`: 僅回傳溫度數值 (Text)。
- `GET /humidity`: 僅回傳濕度數值 (Text)。
- `GET /co2`: 僅回傳 CO2 濃度數值 (Text)。

### 2. Telegram 機器人
機器人支援以下指令：
- `/space`: 顯示完整的空間資訊（溫度、濕度、CO2）。
- `/space_temperature`: 僅顯示目前溫度。
- `/space_humidity`: 僅顯示目前濕度。
- `/space_co2`: 僅顯示目前 CO2 濃度。

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
- `SWITCHBOT_DEVICE_ID`: SwitchBot Meter/Hub 的設備 ID。
- `SWITCHBOT_TOKEN`: SwitchBot API Token。
- `SWITCHBOT_SECRET`: SwitchBot API Secret。

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

## 設定Telegram Bot的模式（Webhook / Long Polling）
### 查狀態
```
https://api.telegram.org/bot<TG_TOKEN>/getWebhookInfo
```

### 綁定Webhook
```
https://api.telegram.org/bot<TG_TOKEN>/setWebhook?url=<YOUR_URL>
```

### 解除綁定Webhook （回歸Long Polling模式）
```
https://api.telegram.org/bot<TG_TOKEN>/deleteWebhook
```

## 📄 授權
[MPL-2.0](LICENSE)
