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
# 若使用 Cloudflare Workers 模式 (wrangler dev)，請同時複製一份為 .dev.vars
cp .env .dev.vars
```
- `TELEGRAM_BOT_TOKEN`: 你的 Telegram Bot Token。
- `SENSORS_CONFIG`: 所有IoT設備的相關資訊，結構範例請看 `.env.sample` 檔案 （目前支援SwitchBot Meter/Hub 的設備）

### 3. 啟動本地伺服器測試
專案支援三種本地測試模式，啟動時皆會自動建置前端與靜態資源（`npm run build:assets`）：

#### 模式 A：Node.js 伺服器模式（推薦，快速離線開發）
使用本機 Node.js 與 `@hono/node-server` 執行，讀取 `.env`。資料庫會使用本機檔案系統（`.data/` 目錄）模擬，完全獨立於 Cloudflare 遠端環境，適合離線開發、修改 API 或調整前端儀表板：
```bash
npm run dev:node
```
- **預設網址**：`http://localhost:3000`（可透過環境變數 `PORT` 調整）
- **儀表板頁面**：開啟瀏覽器造訪 `http://localhost:3000/` 查看即時空間狀態
- **API 文件 (Swagger UI)**：造訪 `http://localhost:3000/doc` 即可線上測試 API

#### 模式 B：Cloudflare Workers 模式（模擬線上環境）
使用 `wrangler dev` 模擬 Cloudflare Workers Runtime，讀取 `.dev.vars`：
```bash
npm run dev
# 或若需開放同區域網路的其他設備測試（監聽 0.0.0.0）：
npm run dev:worker-host
```
- **預設網址**：`http://localhost:8787`
- **儀表板頁面**：`http://localhost:8787/`
- **API 文件 (Swagger UI)**：`http://localhost:8787/doc`

#### 模式 C：Telegram 機器人本機測試（Long Polling 模式）
本機測試 Telegram Bot 指令時，無需對外暴露 Webhook 或架設 ngrok，直接由本機主動向 Telegram 伺服器長輪詢：
```bash
npm run dev:tg
```
> ⚠️ **注意**：在此模式下，必須確保該 Bot Token 目前**沒有綁定 Webhook**（否則 Telegram 會拒絕連線）。若需清除 Webhook，可至瀏覽器造訪：  
> `https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/deleteWebhook`

### 4. 本地常用測試與指令
- **終端機快速查看感測器數值**：
  ```bash
  npm run get
  ```
- **手動重新編譯前端與靜態資源**：
  ```bash
  npm run build:assets
  ```
- **常用驗證端點**：
  - `GET /`：前端儀表板 (Dashboard)
  - `GET /doc`：內建 Swagger UI 互動式文件
  - `GET /openapi.json`：OpenAPI 3.1 規範
  - `GET /sensors/data`：感測器詳細數值


## 部署

### 1. 設定 Cloudflare KV (儲存感測器最後狀態)

本專案使用 Cloudflare KV 來暫存感測器資料與最後更新時間 (`lastchange`)。部署前請先建立對應的 KV Namespace：

```bash
npx wrangler kv:namespace create "SENSOR_KV"
```

執行後，終端機會回傳一段包含 `id` 的 JSON 設定。請開啟 `wrangler.jsonc`，將其中的 `id` 欄位替換為您剛剛獲得的真實 ID：

```jsonc
  "kv_namespaces": [
    {
      "binding": "SENSOR_KV",
      "id": "把剛剛指令回傳的 id 貼到這裡",
      "preview_id": "如果有需要本地 dev 測試，可以依終端機提示建立並填入"
    }
  ]
```
*(注意：程式碼固定使用 `"SENSOR_KV"` 作為 `binding` 名稱，請勿更改此欄位。*

### 2. 設定重要環境變數 (Secrets)

請將機器人 Token 與感測器設定存入 Cloudflare Workers 內部：

`npx wrangler secret put TELEGRAM_BOT_TOKEN`

`npx wrangler secret put SENSORS_CONFIG`

*(⚠️ 小提醒：在終端機貼上給 Cloudflare 的值時，不需要頭尾的單引號，直接貼上 `[{...}]` 即可)*

### 3. 部署到 Cloudflare Workers

```bash
npm run deploy
```

> **注意**：部署到 Cloudflare 時請使用 Webhook 模式（`/bot` 端點），本地測試可使用 Long Polling (`npm run dev:tg`)。

### 設定Telegram Bot的模式（Webhook / Long Polling）
#### 查狀態
```
https://api.telegram.org/bot<TG_TOKEN>/getWebhookInfo
```

#### 綁定Webhook
```
https://api.telegram.org/bot<TG_TOKEN>/setWebhook?url=<YOUR_URL>/bot/<TG_TOKEN>
```

#### 解除綁定Webhook （回歸Long Polling模式）
```
https://api.telegram.org/bot<TG_TOKEN>/deleteWebhook
```

## API Doc 文件
本站已內建 Swagger UI，並提供標準 `/openapi.json` 規範：
- **內建 Swagger UI**：伺服器啟動後直接在瀏覽器開啟 `/doc`（例如：`http://localhost:3000/doc` 或 `http://localhost:8787/doc`）即可線上瀏覽與測試。
- **OpenAPI 規範**：可將 `/openapi.json` 匯入相容 OpenAPI 的客戶端（如：Insomnia、Postman）。
- **獨立 Docker Swagger UI**：若想使用官方 Swagger 容器預覽，可執行：
```sh
docker run -p 9000:8080 -e SWAGGER_JSON_URL=http://localhost:8787/openapi.json docker.swagger.io/swaggerapi/swagger-ui
```


## lastchange 判定原則

### 1. `lastchange` (連線/確認時間)
*   只要 `fetch` 成功或收到 `webhook`，且該裝置不是 `only_webhook` 的主動查詢，`lastchange` 就會更新為當前時間。
*   這代表了「系統最後一次與該設備取得聯繫」的時間，與數值是否有變無關。
*   **快取保護**：系統會以 `lastchange` 結合 `staleThresholdSeconds` (預設 600s) 判定資料是否過期。若未過期，主動查詢時會直接回傳快取內容，不發起 API 請求與 KV 寫入。

### 2. `temperature_lastchange` (數值變動時間)
*   只有當新取得的數值（如溫度）與資料庫中現有的數值**不同**時，才會更新這個項目的 `lastchange`。
*   如果數值相同，則保留舊的變動時間。
*   **寫入優化**：若所有感測數值均未變動，系統將**跳過歷史紀錄 (Raw Ingestion)** 的寫入，僅更新目前的狀態以節省 Cloudflare KV PUT 額度。

### 3. `only_webhook` 裝置保護
*   如果裝置設定為 `only_webhook: true`，則主動的 `fetch` 行為不會更新整體的 `lastchange`。
*   該裝置的 `lastchange` 只有在真正收到 Webhook 通知時才會變動，符合您「記錄上次被通知時間」的需求。

## 📄 授權
[MPL-2.0](LICENSE)
