# 驗證指令表 — 本專案專用

> 通用判準（何時算真的完成、何時問使用者、換路訊號、升降級）見全域 `~/.claude/rules/judgment.md`。
> 本表對應全域 judgment.md §2 的第 1 順位來源「專案已有指令表」：照著用，不要即興發明新指令。
> 指令實測失效時：修正指令並更新本表，不要繞過。

## 固定驗證指令表

| 改了什麼 | 驗證指令 | 通過標準 |
|---|---|---|
| 前端任何 .ts/.tsx | `pnpm -C apps/web exec tsc --noEmit` | exit 0，無錯誤輸出 |
| 前端 UI 行為/外觀 | 背景啟動 dev server（`pnpm -C apps/web run dev`），用 playwright 開頁截圖 | 截圖經肉眼確認為目標狀態 |
| 後端任何 .py | 於 `backend/` 背景啟動 `uvicorn main:app --port 8000`，再 `curl -s http://localhost:8000/api/health` | health 回 200 |
| 後端 endpoint 邏輯 | 上一行，加上用 `curl` 打受影響的 endpoint | response 符合驗收條件描述的形狀 |
| DB schema/查詢 | 打會觸發該查詢的 endpoint，確認資料正確 | 同上 |

## 專案特有品質檢查（宣稱完成前，接在全域 judgment.md §5 之後逐項打勾）

- 前端：檔案放對 FSD 層（`apps/web/CLAUDE.md` 的 placement rules）；沒有新增 `useEffect` 做 derived state 同步；styling 全走 `className`
- 後端：資料庫存取走 `get_conn()`；沒有引入 yfinance；API 回傳沒有 fat response
