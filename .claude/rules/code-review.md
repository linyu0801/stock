# Code Review 規則 — 本專案（2026-07-13 對齊全域版）

> 觸發時機：被要求 code review 時——`/review`、`/code-review` 或口頭。
> **先讀全域 `~/.claude/rules-ondemand/code-review.md`**：流程（git range 解析）、嚴重度四級（Critical/High/Medium/Low）、報告檔輸出格式、產出後自檢（自我否定句清除）全依全域版。
> 本檔只疊加專案特有的前置動作與 checklist。調度照全域 dispatch.md（審 diff 派 `caveman:cavecrew-reviewer`；共用介面／schema／刪除／auth 加派 opus 第二輪）。

## 前置動作（專案特有）

- diff 內含 `apps/web` 的 .ts/.tsx → 先跑 `pnpm -C apps/web exec tsc --noEmit`，型別錯誤直接列 **Critical**
- 審查是靜態的；需要實跑驗證行為時，建議使用者用 `/verify`，不要在 review 裡起 server

## 通用 checklist（FE/BE 都適用，出自 root CLAUDE.md；違反預設 **High**）

- 沒有註解噪音（註解只允許解釋不明顯的 WHY）
- 沒有 unused imports、沒有半套實作
- 沒有為不可能發生的情境寫錯誤處理；驗證只出現在系統邊界（使用者輸入、外部 API）
- diff 沒有超出需求範圍的「順手修改」——對不上需求的行就是 finding

## FE checklist（`apps/web/`，細節見 `apps/web/CLAUDE.md`）

- **FSD 分層**（High）：檔案放對層（shared 跨頁／pages 頁內／widgets 區塊內）；import 方向只准由上往下（pages/widgets → features/shared），反向就是 finding
- **禁區**（High）：`src/components/ui/` 是 legacy 殘留，新增檔案進去就是 finding；該放 `shared/ui/atoms/`
- **API 呼叫**（High）：一律走 `packages/api-client`，元件內直接 `fetch` 是 finding
- **Styling**（High）：一律 `className`；`style={{}}` 只允許 Tailwind 表達不了的動態值。漲跌色用 `text-gain`／`text-loss`；出現 `text-[#FF4560]` 這類任意色值或 `style` 裡的 color 就算 hardcode
- **Hooks**（Medium）：不准用 `useEffect` 同步 derived state（直接在 render 推導）；不准用 `useEffect` 做 focus（用 `autoFocus`）；外部訂閱（如 auth listener）屬合法用途。`useCallback` 只允許在「該函式是另一個 hook 的 dependency」時使用，`useMemo` 只允許在計算真正昂貴時使用
- **元件語法**（Medium）：`const` + `React.FC<Props>`，`type Props` 定義在元件上方；`export default` 獨立一行在元件下方。atoms/molecules/organisms 用 named export，pages/widgets 用 default export
- **TanStack Router**（Medium）：反應式取當前路徑用 `useRouterState().location.pathname`，不是 `useRouter`

## BE checklist（`backend/`，細節見 `backend/CLAUDE.md`；已遷移 Supabase Postgres）

- **SQL 安全**（Critical）：一律參數化查詢（`%s` 佔位）。「外部輸入」指 request 的 body／query／path 參數，以及外部 API 的回傳值；把這些用 f-string 或字串串接拼進 SQL 就是 Critical。SQL 片段常數（如 `_OWNED`）插值可接受，但常數本身不得含外部輸入
- **連線管理**（Critical）：資料庫存取一律走 `get_conn()` context manager（psycopg pool 借還）；把 connection 存起來跨 request 使用是 Critical
- **Postgres 方言**（High）：dict_row 下禁止對 DB row 位置索引；取自增 id 用 `RETURNING id`；`executemany` 走 cursor；交易內失敗的 INSERT 會 abort 整個交易——迴圈續跑要用 `ON CONFLICT ... RETURNING` 不是 try/except pass
- **使用者隔離**（Critical）：watchlist 資源的每個 mutation 都要以 `user_id` 過濾（直接 WHERE 或 `_OWNED` 子查詢或 `_require_group`）；動不到回 404 不是 403；新查詢不得 `WHERE user_id IS NULL`
- **外部 API**（Critical）：Yahoo 一律走 `services/fetcher.py` 的既有路徑（urllib v8 API）；引入 yfinance 套件是 Critical
- **快取**（High）：新的外部資料呼叫應沿用既有快取模式（`tuple[float, data]`＋TTL 檢查）；每次 request 都打外部 API 而沒有快取是 finding；ThreadPoolExecutor worker 內不得呼叫 `get_conn()`
- **API 形狀**（High）：路徑前綴 `/api/<domain>`；delete 回 204、create 回 201；回傳只給 caller 需要的欄位，fat response 是 finding
- **分層**（High）：router（`api/`）只做三件事——解析參數、呼叫 `services/` 的函式、組回傳；在 router 裡直接打外部 API、寫多行 SQL、或做資料轉換邏輯就是 finding
- **資料不變量**（Critical）：`sort_order` 在同一 group 內由 stocks 與 sublabels 共用（統一排序）；任何只重排其中一張表的寫法是 Critical
- **時序陷阱**（High）：TWSE `STOCK_DAY_ALL` 約 16:30 後才有當日資料；假設「今天一定有資料」的邏輯是 finding（正確做法參考 `get_movers()` 的回走 7 天）。Yahoo 休市日有幽靈日 K（見 lessons.md 2026-07-12）
