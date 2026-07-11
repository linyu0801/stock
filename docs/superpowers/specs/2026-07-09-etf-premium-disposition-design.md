# ETF 折溢價＋處置/注意標示 — 設計文件

日期：2026-07-09。狀態：設計已口頭核可，待使用者審閱本文件。

## 目標

1. **ETF 溢價/折價**：自選清單中的 ETF 顯示前一交易日收盤折溢價（日頻）。
2. **處置/注意標示**：自選清單中的股票若為處置或注意股，標示等級、處分措施、起訖日期。

顯示位置：首頁列表 row（精簡標示）＋個股詳情頁（完整資訊）。範圍：只標示自選股，不做全市場清單。

## 資料來源（實測紀錄：`.claude/tmp/premium-disposition-sources.md`）

### 處置/注意（官方 openapi，信心高）

| 來源 | Endpoint | 內容 |
|---|---|---|
| TWSE | `GET https://openapi.twse.com.tw/v1/announcement/punish` | 上市處置股 |
| TWSE | `GET https://openapi.twse.com.tw/v1/announcement/notice` | 上市注意股 |
| TPEX | `GET https://www.tpex.org.tw/openapi/v1/tpex_disposal_information` | 上櫃處置股 |
| TPEX | `GET https://www.tpex.org.tw/openapi/v1/tpex_trading_warning_information` | 上櫃注意股 |

已知陷阱：
- 處置期間欄位（`DispositionPeriod`）分隔符不同：TWSE 用「至」、TPEX 用「~」，且為民國年 → 需分開解析、轉 ISO。
- 分盤秒數／預收款券等措施細節混在長文字欄位（`Detail`／`DisposalCondition`），不做結構化解析，原樣傳給前端顯示。

### ETF 淨值/折溢價（未文件化 API，信心中）

- `POST https://www.twse.com.tw/zh/ETFortune/ajaxEtfInfoChart`，參數 `id`／`startDate`／`endDate`／`type`。
- 回傳每日淨值＋折溢價序列；**只有日頻**（前一交易日收盤），實測 0050、00940 可用。
- 已知陷阱：回傳含髒資料（觀察到 "2036/01/04" 這類未來日期）→ 消費端必須防禦性過濾。
- 官方 openapi 無 NAV endpoint（已全文搜尋 TWSE 144＋TPEX 225 個 path 確認）；即時估計淨值需逐一串各投信，本期不做。

## 後端設計

### disposition domain（新檔 ×2）

`backend/services/disposition.py`
- 打上表 4 支 API，正規化成統一 entry：`{level, reason, measures, start, end}`，`level` 為 `"disposal"` 或 `"warning"`。
- 全市場 map 快取：`_cache: tuple[float, dict]`，TTL 3600 秒（公告日更）。
- 同一檔同時處置＋注意 → 取處置（嚴重者優先）。
- 處置已過期（`end` < today）→ 濾掉。
- HTTP 呼叫沿用 `services/fetcher.py` 的 urllib 模式。

`backend/api/disposition.py`
- `GET /api/disposition/flags?symbols=2330,0050`
- 回應：`{"2330": {"level": "disposal", "reason": "...", "measures": "...", "start": "2026-07-01", "end": "2026-07-14"}}`
- 沒中的 symbol 不出現在回應。router 只做解析參數→呼叫 service→回傳。

### etf domain（新檔 ×2）

`backend/services/etf.py`
- ETFortune API 逐檔抓；只處理 `00` 開頭 symbol，其餘直接跳過。
- 每檔快取：`_cache: dict[str, tuple[float, dict]]`，TTL 3600 秒。
- 防禦：日期 > today 或欄位缺漏的 row 丟棄，取最新有效交易日。

`backend/api/etf.py`
- `GET /api/etf/premium?symbols=0050,00940`
- 回應：`{"0050": {"nav": 43.21, "close": 43.55, "premium_pct": 0.79, "date": "2026-07-08"}}`

### 錯誤處理

外部 API 失敗：有舊快取用舊快取，否則該來源回空 dict。不對 caller 拋錯，前端視同無資料。

## api-client

`packages/api-client/src/client.ts` 加：
- `getDispositionFlags(symbols: string[])` → `Record<string, DispositionFlag>`
- `getEtfPremium(symbols: string[])` → `Record<string, EtfPremium>`
- 對應 type 定義，命名沿用既有 `get*` 模式。

## 前端設計

### 首頁列表

- `pages/home/index.tsx`：對可見自選股 symbols 批次呼叫兩支 API（premium 只送 `00` 開頭），結果 map 經 GroupPanel 傳入 StockRow。
- `StockRow.tsx`：
  - 名稱旁小 chip：「處」（紫）／「注」（琥珀）。不用紅綠——避免與漲跌色衝突；具體色值走現有 token 體系。
  - ETF 折溢價 %：顯示於本益比欄位置（ETF 該欄本為空白）；正溢價 `text-gain`、折價 `text-loss`。

### 個股詳情頁

- 新 organism：`widgets/stock-detail/organisms/DispositionNotice.tsx`——有處置/注意才渲染。內容：等級色框、期間（起訖日＋剩餘天數）、措施全文、原因。
- ETF：StatBox 區加「淨值」「折溢價」兩格，附資料日期小字。

### 無資料行為

查無處置/注意、非 ETF、或 API 失敗 → chip 與區塊皆不渲染，版面不變。

## 驗證方式（照 `.claude/rules/verification.md`）

- 後端：uvicorn 起服務，curl 打 `/api/disposition/flags`（用當日實際處置股代號）與 `/api/etf/premium?symbols=0050`，確認回應形狀。
- 前端：`pnpm -C apps/web exec tsc --noEmit` exit 0；dev server＋playwright 截圖確認列表 chip 與詳情頁區塊。

## 明確不做（YAGNI）

- 全市場處置/注意清單頁面
- 盤中即時估計淨值（需逐一串各投信）
- 折溢價歷史走勢圖
- 措施長文字的結構化解析（分盤秒數等）
