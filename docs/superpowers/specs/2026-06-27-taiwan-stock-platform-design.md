# 台股分析平台 設計文件

**日期：** 2026-06-27  
**狀態：** 已確認，待實作

---

## 目標

建立一個本機運行的台股分析平台，涵蓋：
- 收盤後看盤（K 線圖、技術指標）
- 技術指標學習（以乖離率為起點）
- 基礎策略回測

---

## 技術棧

### Monorepo 管理
| 項目 | 技術 |
|------|------|
| Workspace | pnpm workspaces |

### 後端
| 項目 | 技術 |
|------|------|
| 語言 | Python 3.11+ |
| 框架 | FastAPI |
| 資料擷取 | yfinance |
| 指標計算 | pandas |
| 資料儲存 | SQLite（自選股清單）|

### 前端
| 項目 | 技術 |
|------|------|
| 框架 | React + Vite |
| 路由 | TanStack Router |
| 樣式 | Tailwind CSS |
| UI 元件 | shadcn/ui |
| 圖表 | lightweight-charts（TradingView 開源）|

### 前端架構原則
- **FSD（Feature-Sliced Design）** — 以功能為單位的分層架構
- **Clean Architecture** — 依賴方向由外到內（UI → Features → Entities → Shared）
- **Atomic Design** — `shared/ui` 內的元件依 atoms / molecules / organisms 分層

---

## 資料來源

使用 **yfinance**，台股代碼格式為 `{股票代碼}.TW`（例：`2330.TW`）。

- 歷史日線資料：支援最長 5 年（`period="5y"`）
- 更新時機：收盤後當日更新（非即時，延遲約 15–20 分鐘）
- 無需 API key，免費使用
- 未來若需即時盤中資料，可替換為 Fugle API

---

## Monorepo 專案結構

```
/  (repo root)
├── apps/
│   └── web/                        # 主 React 應用（Vite + TanStack Router）
│       └── src/
│           ├── app/                # [FSD] App 層：Router、Provider、全局設定
│           ├── pages/              # [FSD] Pages 層：Route-level 頁面元件
│           │   ├── home/
│           │   ├── stock/
│           │   └── backtest/
│           ├── widgets/            # [FSD] Widgets 層：複合 UI 區塊
│           │   ├── chart-panel/    # K 線圖 + 指標副圖整合
│           │   └── watchlist-section/
│           ├── features/           # [FSD] Features 層：使用者操作場景
│           │   ├── add-to-watchlist/
│           │   ├── remove-from-watchlist/
│           │   ├── fetch-stock-chart/
│           │   └── run-backtest/
│           ├── entities/           # [FSD] Entities 層：Domain 型別與 schema
│           │   ├── stock/          # Stock 型別、selectors
│           │   ├── watchlist/      # Watchlist 型別
│           │   └── backtest/       # Backtest 型別、結果 schema
│           └── shared/             # [FSD] Shared 層：跨層共用
│               ├── api/            # API client（呼叫 FastAPI）
│               ├── lib/            # 工具函式
│               └── ui/             # Atomic Design 元件庫
│                   ├── atoms/      # Button、Input、Badge、Skeleton
│                   ├── molecules/  # SearchInput、PriceTag、StatCard
│                   └── organisms/  # CandlestickChart、WatchlistTable
│
├── packages/
│   ├── api-client/                 # 型別安全的 FastAPI client（fetch + zod schema）
│   ├── ui/                         # 可重用 shadcn/ui 元件包裝（未來多 app 共用）
│   └── tsconfig/                   # 共用 TypeScript 設定
│
├── backend/                        # Python FastAPI
│   ├── api/
│   │   ├── stock.py
│   │   ├── watchlist.py
│   │   └── backtest.py
│   ├── services/
│   │   ├── fetcher.py              # yfinance 資料擷取
│   │   ├── indicators.py           # 技術指標計算
│   │   └── backtest.py             # 回測引擎
│   ├── main.py
│   └── requirements.txt
│
├── turbo.json
└── pnpm-workspace.yaml
```

---

## FSD + Clean Architecture 對應關係

```
FSD Layer     Clean Arch Layer    說明
─────────────────────────────────────────────────────
shared/ui     —                   Atomic Design：atoms / molecules / organisms
entities      Domain              Stock、Watchlist、Backtest 型別與商業規則
features      Use Cases           使用者操作（fetch-chart、run-backtest 等）
widgets       Presentation        組合 features + entities 的 UI 區塊
pages         Presentation        Route-level 頁面（薄層，組合 widgets）
app           Infrastructure      Router、全局 Provider
shared/api    Infrastructure      HTTP client，只知道後端 schema
```

**依賴規則（Clean Architecture）：**
- 依賴方向：`pages → widgets → features → entities → shared`
- 同層之間不可互相 import
- `packages/api-client` 是唯一知道後端 URL 和 schema 的地方

---

## API 端點

```
GET  /api/stock/{id}/history?period=3m          # K 線歷史資料（OHLCV）
GET  /api/stock/{id}/indicators?type=bias&n=20  # 技術指標
GET  /api/stock/{id}/info                       # 基本資訊（股名、現價）

GET    /api/watchlist                           # 取得所有分組與股票
POST   /api/watchlist/groups                    # 新增分組
DELETE /api/watchlist/groups/{group_id}         # 刪除分組
PATCH  /api/watchlist/groups/{group_id}         # 重新命名分組

POST   /api/watchlist/stocks                    # 新增單一股票至指定分組
POST   /api/watchlist/stocks/batch              # 批次新增股票（可跨分組）
DELETE /api/watchlist/stocks/{stock_id}         # 刪除股票
PATCH  /api/watchlist/stocks/{stock_id}         # 移動股票至其他分組

POST /api/backtest                              # 執行回測
```

### 批次新增格式（`POST /api/watchlist/stocks/batch`）

```json
{
  "stocks": [
    { "symbol": "2330", "group": "半導體" },
    { "symbol": "2454", "group": "半導體" },
    { "symbol": "2882", "group": "金融股" }
  ]
}
```

- `group` 若不存在則自動建立
- 重複的 symbol 在同一分組內會被忽略（不報錯）

### 資料結構（SQLite）

```
groups
  id        INTEGER PK
  name      TEXT UNIQUE
  order     INTEGER        # 顯示排序

stocks
  id        INTEGER PK
  symbol    TEXT           # 例：2330
  group_id  INTEGER FK → groups.id
  added_at  DATETIME
```

---

## 技術指標：乖離率（Bias Ratio）

```
乖離率 = (當日收盤價 - N 日均線) / N 日均線 × 100%
```

- 支援 N = 5、10、20、60（前端可切換）
- 計算工具：pandas（`rolling().mean()`）
- 前端以副圖（sub-chart）形式顯示在 K 線圖下方

---

## 頁面規劃

### `/` 首頁
- 自選股依分組顯示，每組可展開 / 收合
- 每支股票顯示今日收盤價與漲跌幅
- 可新增 / 刪除分組、新增 / 刪除 / 移動股票

### `/stock/$id` 個股頁面
- 主圖：K 線圖（OHLCV），可選 1M / 3M / 6M / 1Y / 5Y
- 副圖：乖離率線（可切換 5/10/20/60 日）
- 基本資訊卡：股票名稱、最新收盤價、成交量

### `/backtest` 回測頁面
- 輸入：股票代碼、日期區間、策略參數（乖離率閾值）
- 輸出：買賣點標記在 K 線圖、總報酬率、交易次數

---

## 開發階段

### Phase 1 — 基礎看盤
- [ ] Monorepo 初始化（pnpm workspaces）
- [ ] FastAPI 後端起手，接通 yfinance 日線資料
- [ ] `packages/api-client` 建立，定義 zod schema
- [ ] `apps/web` Vite + TanStack Router + FSD 目錄結構
- [ ] `shared/ui` atoms 建立（Button、Input、Badge）
- [ ] K 線圖 organism + 乖離率副圖

### Phase 2 — 自選股管理
- [ ] 自選股 CRUD（SQLite 儲存）
- [ ] 自選股分組 CRUD + 批次新增 API
- [ ] `features/add-to-watchlist`、`features/remove-from-watchlist`、`features/manage-groups`
- [ ] 首頁 `widgets/watchlist-section`（分組可展開 / 收合）

### Phase 3 — 基礎回測
- [ ] 乖離率買賣訊號策略引擎（後端）
- [ ] `features/run-backtest` + 回測結果圖表

---

## 部署規劃

- **現階段：** 本機運行（後端 `uvicorn`，前端 `pnpm dev`）
- **未來：** 後端容器化（Docker）部署至 VPS 或 Railway；`apps/web` 部署至 Vercel

---

## 待決事項

- 若未來需要即時盤中資料，評估替換為 Fugle API
- 後續可擴充的指標：RSI、MACD、布林通道等
