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

### 後端
| 項目 | 技術 |
|------|------|
| 語言 | Python 3.11+ |
| 框架 | FastAPI |
| 資料擷取 | yfinance |
| 指標計算 | pandas |
| 資料儲存 | 本機 JSON / SQLite（自選股清單）|

### 前端
| 項目 | 技術 |
|------|------|
| 框架 | React + Vite |
| 路由 | TanStack Router |
| 樣式 | Tailwind CSS |
| UI 元件 | shadcn/ui |
| 圖表 | lightweight-charts（TradingView 開源）|

---

## 資料來源

使用 **yfinance**，台股代碼格式為 `{股票代碼}.TW`（例：`2330.TW`）。

- 歷史日線資料：支援最長 5 年（`period="5y"`）
- 更新時機：收盤後當日更新（非即時，延遲約 15–20 分鐘）
- 無需 API key，免費使用
- 未來若需即時盤中資料，可替換為 Fugle API

---

## 專案結構

```
台股分析平台/
├── backend/
│   ├── api/
│   │   ├── stock.py       # 股票資料、指標端點
│   │   ├── watchlist.py   # 自選股 CRUD
│   │   └── backtest.py    # 回測端點
│   ├── services/
│   │   ├── fetcher.py     # yfinance 資料擷取
│   │   ├── indicators.py  # 技術指標計算
│   │   └── backtest.py    # 回測引擎
│   ├── main.py
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── routes/
    │   │   ├── index.tsx        # 首頁 / 自選股總覽
    │   │   ├── stock.$id.tsx    # 個股頁面
    │   │   └── backtest.tsx     # 回測頁面
    │   ├── components/
    │   │   ├── CandlestickChart.tsx   # K 線圖（lightweight-charts）
    │   │   ├── IndicatorPanel.tsx     # 指標疊加（乖離率等）
    │   │   └── WatchlistCard.tsx      # 自選股卡片
    │   └── api/
    │       └── client.ts        # 後端 API 呼叫
    ├── vite.config.ts
    └── package.json
```

---

## API 端點

```
GET  /api/stock/{id}/history?period=3m     # K 線歷史資料（OHLCV）
GET  /api/stock/{id}/indicators?type=bias&n=20  # 技術指標
GET  /api/stock/{id}/info                  # 基本資訊（股名、現價）
GET  /api/watchlist                        # 取得自選股清單
POST /api/watchlist                        # 新增自選股
DELETE /api/watchlist/{id}                 # 刪除自選股
POST /api/backtest                         # 執行回測
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
- 自選股清單，顯示每支股票的今日收盤價與漲跌幅
- 可新增 / 刪除自選股（輸入股票代碼）

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
- [ ] FastAPI 後端起手，接通 yfinance 日線資料
- [ ] React + Vite + TanStack Router 專案初始化
- [ ] lightweight-charts K 線圖渲染
- [ ] 乖離率計算與副圖顯示

### Phase 2 — 自選股管理
- [ ] 自選股 CRUD（SQLite 儲存）
- [ ] 首頁自選股清單

### Phase 3 — 基礎回測
- [ ] 乖離率買賣訊號策略引擎
- [ ] 回測結果圖表與統計

---

## 部署規劃

- **現階段：** 本機運行（後端 `uvicorn`，前端 `vite dev`）
- **未來：** 後端可容器化（Docker）部署至 VPS 或 Railway；前端部署至 Vercel

---

## 待決事項

- 若未來需要即時盤中資料，評估替換為 Fugle API
- 後續可擴充的指標：RSI、MACD、布林通道等
