# 台股分析平台 — Project Rules

## Stack
- Monorepo: pnpm workspaces (`apps/*`, `packages/*`)
- Frontend: `apps/web` — React 18, Vite, TanStack Router, Tailwind v4, shadcn/ui。細則在 `apps/web/CLAUDE.md`（該目錄下自動載入）
- Backend: `backend/` — Python FastAPI, SQLite (`stock.db`)。細則在 `backend/CLAUDE.md`
- Shared types/client: `packages/api-client`

## Communication
Terse. Fragments OK. No filler, no pleasantries, no hedging.

## General Coding Rules
- No comments unless the WHY is non-obvious (hidden constraint, workaround, subtle invariant)
- No unused imports
- No half-finished implementations
- No error handling for scenarios that can't happen
- Don't add features beyond what's asked
- Validate only at system boundaries (user input, external APIs)

## Git
Conventional commits (`feat:`, `fix:`, `refactor:` etc.). No `--no-verify`. 未經使用者指示不 commit、不 push。

## 制度檔路由
通用制度（模型調度、交辦範本、判斷 rubrics、harness 診斷）一律走全域 `~/.claude/rules/`（路由表在全域 CLAUDE.md）。
本專案 `.claude/rules/` 只放專案特有內容：

| 時機（符合就讀，不要憑印象跳過） | 讀 |
|---|---|
| 被要求 code review 時（`/review`、`/code-review` 或口頭），開審前 | `code-review.md` |
| 宣稱完成前要驗證時（對應全域 judgment.md §2 的專案指令表） | `verification.md` |
| 除錯開始前，先查本專案的前人坑（Yahoo/TWSE API 等） | `lessons.md` |
| 想修改本專案的制度檔前 | `maintenance.md` |
| 新 session 想了解本制度背景（一次性、歷史文件） | `letter.md` |

## Skill 路由（本專案白名單）
- 常用：`code-review`、`verify`、`run`、commit 類、`superpowers:systematic-debugging`（真的卡住的 bug）
- 一行修改、明確 bug fix、使用者已給完整 spec → 直接做，**不進 brainstorming**
- 財務分析／equity-research／wealth-management／Gmail／lastfm 類 skill 與本專案無關（這是寫程式專案，不是投研），除非使用者點名，否則不用
- 使用者點名的 skill 一律用
