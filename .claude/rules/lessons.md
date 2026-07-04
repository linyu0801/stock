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

## 2026-07-04 專案 rules 精簡：通用制度移交全域，letter.md 的檔案引用已過時
- 症狀：專案 `.claude/rules/` 與全域 `~/.claude/rules/` 內容高度重疊，雙倍常駐成本
- 錯路：無（依使用者指示重構）
- 正解：刪除專案的 `dispatch.md`／`templates.md`／`judgment.md`／`00-diagnosis.md`（全域版已完整覆蓋；原檔備份在本目錄 `_backup-*`）；專案特有的驗證指令表與品質檢查抽出成 `verification.md`。`letter.md` 是歷史文件不改——其中提到的專案 `judgment.md`／`dispatch.md`／`templates.md`，現在請對應到全域 `~/.claude/rules/` 的同名檔，驗證指令表對應本目錄 `verification.md`
- 制度修正：root `CLAUDE.md` 路由表與 `maintenance.md` 權限表已同步更新
