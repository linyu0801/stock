# Lessons — 踩雷紀錄

> 格式與寫入規則見 `maintenance.md`。只准 append。除錯開始前先掃過標題。

## 2026-07-04 Yahoo Finance 要用 urllib 直打 v8 API，不用 yfinance
- 症狀：yfinance 抓不到／不穩（詳見 git log ab7a5c2）
- 錯路：yfinance 套件
- 正解：urllib 直打 v8 API＋`ssl.CERT_NONE`（Yahoo 憑證問題）；已固化在 `backend/CLAUDE.md`
- 制度修正：無（已入 backend/CLAUDE.md，此條僅示範格式）

## 2026-07-04 TWSE STOCK_DAY_ALL 收盤後 ~16:30 才有當日資料
- 症狀：盤中打 API 拿不到當天資料
- 錯路：以為 API 掛了
- 正解：`get_movers()` 往回走 7 天找最近可用日；已固化在 `backend/CLAUDE.md`
- 制度修正：無（示範格式）

## 2026-07-05 Yahoo _td-stock getClassQuotes API 的三個坑
- 症狀：概念股報價解析出 null；或無 Referer 時請求失敗
- 錯路：以為欄位包在 `price.regularMarket*` 底下、changePercent 是小數
- 正解：(1) 必帶 `Referer: https://tw.stock.yahoo.com/class-quote?...` header；(2) 欄位在 item 頂層：`price={"raw":"14.1",...}`（raw 是字串要轉 float）、`changePercent="-2.42%"`（含 % 的字串）、`symbol="2314.TW"`；(3) 分頁每次 30 筆，迴圈到 `pagination.resultsTotal`。實測紀錄在 `.claude/tmp/concept-stock-sources.md`，實作在 `services/concepts.py`
- 制度修正：建議 backend/CLAUDE.md 加 concepts 一節（待使用者同意）

## 2026-07-05 Yahoo symbol 去後綴要先 .TWO 再 .TW（或用 removesuffix）
- 症狀：概念股清單出現 `5490O` 這種壞代號，個股頁查無資料
- 錯路：`symbol.replace(".TW","").replace(".TWO","")`——第一個 replace 會把 `.TWO` 裡的 `.TW` 吃掉留下 `O`
- 正解：`removesuffix(".TWO")` 再 `removesuffix(".TW")`；快取表有髒資料要一併清（concept_stocks）
- 制度修正：無

## 2026-07-04 專案 rules 精簡：通用制度移交全域，letter.md 的檔案引用已過時
- 症狀：專案 `.claude/rules/` 與全域 `~/.claude/rules/` 內容高度重疊，雙倍常駐成本
- 錯路：無（依使用者指示重構）
- 正解：刪除專案的 `dispatch.md`／`templates.md`／`judgment.md`／`00-diagnosis.md`（全域版已完整覆蓋；原檔備份在本目錄 `_backup-*`）；專案特有的驗證指令表與品質檢查抽出成 `verification.md`。`letter.md` 是歷史文件不改——其中提到的專案 `judgment.md`／`dispatch.md`／`templates.md`，現在請對應到全域 `~/.claude/rules/` 的同名檔，驗證指令表對應本目錄 `verification.md`
- 制度修正：root `CLAUDE.md` 路由表與 `maintenance.md` 權限表已同步更新

## 2026-07-11 ETF 淨值/折溢價：TWSE openapi 沒有，用 ETFortune 內部 API（日頻）
- 症狀：找不到官方彙整的 ETF NAV/折溢價 endpoint（TWSE 144＋TPEX 225 個 path 全查過）
- 錯路：以為「ETF 申贖及即時淨值揭露專區」是 TWSE 的 API——其實是分散式規格，各投信自架 URL，TWSE 不彙整
- 正解：`POST https://www.twse.com.tw/zh/ETFortune/ajaxEtfInfoChart`（body: `id`/`startDate`/`endDate`/`type=fundPric`，帶 Referer `.../ETFortune/etfInfo/<code>`）→ 回 `{"netPrice":[{date,count}],"atmps":[{date,count}]}`，atmps.count 即折溢價 %。僅日頻；**有髒日期**（如 2036/01/04）務必過濾查詢窗外資料。實作在 `services/etf.py`
- 制度修正：無

## 2026-07-11 處置/注意股期間欄位：兩市格式不同且會變
- 症狀：TWSE punish 的 `DispositionPeriod` 分隔符，調查時實測「至」，隔日實測變全形「～」；TPEX 用半形「~」；日期為民國年（TWSE 帶斜線、TPEX 不帶），TPEX warning 的 Date 卻是西元
- 錯路：寫死單一分隔符／單一日期格式
- 正解：多分隔符 fallback（"至"、"～"、"~"）＋以位數區分民國(7)/西元(8)，解析失敗記 log 不靜默；TWSE notice 無資料時回一筆全空白 placeholder 要濾掉。實作在 `services/disposition.py`
- 制度修正：無
