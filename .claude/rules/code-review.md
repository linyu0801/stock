# Code Review 規則 — 本專案

> 觸發時機：被要求 code review 時——不論是 `/review`、`/code-review`，或使用者口頭說「幫我 review」。
> 先讀完本檔再開始審。內建指令的功能（inline PR comment、`--fix` 等）照常使用，本檔是疊加在其上的專案標準。
> 調度方式照全域 `~/.claude/rules/dispatch.md`：審 diff 派 `caveman:cavecrew-reviewer`；高風險改動（共用介面、schema、刪除）加派 `general-purpose` model: `opus` 做第二輪。

## 審查範圍與前置動作

- 沒有指明範圍時，預設審「目前的 working diff」（`git diff HEAD`）；使用者給了 PR 編號或 branch 就審指定範圍
- diff 內含 `apps/web` 的 .ts/.tsx → 先跑 `pnpm -C apps/web exec tsc --noEmit`，型別錯誤直接列為 blocker
- 審查是靜態的；需要實跑驗證行為時，建議使用者用 `/verify`，不要在 review 裡起 server

## 回報格式

- 一行一個 finding：`路徑:行號: 嚴重度: 問題。修法。`
- 嚴重度全報，分四級：
  - `blocker`：會出錯——bug、型別錯誤、SQL injection、資料遺失風險
  - `major`：明確違反專案規則（下方 checklist 任一條）
  - `minor`：可讀性、輕微冗餘、命名不一致
  - `nit`：純風格偏好，修不修都行
- 用中文回報；沒有 finding 就明說「無」，不要硬湊
- 每個 finding 都要有具體修法，只指出問題不給修法的 finding 不合格

## 通用 checklist（FE/BE 都適用，出自 root CLAUDE.md）

- 沒有註解噪音（註解只允許解釋不明顯的 WHY）
- 沒有 unused imports、沒有半套實作
- 沒有為不可能發生的情境寫錯誤處理；驗證只出現在系統邊界（使用者輸入、外部 API）
- diff 沒有超出需求範圍的「順手修改」——對不上需求的行就是 finding

## FE checklist（`apps/web/`，細節見 `apps/web/CLAUDE.md`）

- **FSD 分層**：檔案放對層（shared 跨頁／pages 頁內／widgets 區塊內）；import 方向只准由上往下（pages/widgets → features/shared），反向就是 major
- **禁區**：`src/components/ui/` 是 legacy 殘留，新增檔案進去就是 major；該放 `shared/ui/atoms/`
- **API 呼叫**：一律走 `packages/api-client`，元件內直接 `fetch` 是 major
- **Styling**：一律 `className`；`style={{}}` 只允許 Tailwind 表達不了的動態值。漲跌色用 `text-gain`／`text-loss`；出現 `text-[#FF4560]` 這類任意色值或 `style` 裡的 color，就算 hardcode，major
- **Hooks**：不准用 `useEffect` 同步 derived state（直接在 render 推導）；不准用 `useEffect` 做 focus（用 `autoFocus`）；`useCallback` 只允許在「該函式是另一個 hook 的 dependency」時使用，`useMemo` 只允許在計算真正昂貴時使用——兩者以外的使用都是 minor
- **元件語法**：`const` + `React.FC<Props>`，`type Props` 定義在元件上方；`export default` 獨立一行在元件下方。atoms/molecules/organisms 用 named export，pages/widgets 用 default export
- **TanStack Router**：反應式取當前路徑用 `useRouterState().location.pathname`，不是 `useRouter`

## BE checklist（`backend/`，細節見 `backend/CLAUDE.md`）

- **SQL 安全**：一律參數化查詢（`?` 佔位）。「外部輸入」指 request 的 body／query／path 參數，以及外部 API 的回傳值；把這些用 f-string 或字串串接拼進 SQL 就是 blocker
- **連線管理**：資料庫存取一律走 `get_conn()` context manager；把 connection 存起來跨 request 使用是 blocker
- **外部 API**：Yahoo 一律走 `services/fetcher.py` 的既有路徑（urllib v8 API＋`_yahoo_symbol()`）；引入 yfinance 套件是 blocker
- **快取**：新的外部資料呼叫應沿用既有快取模式（`tuple[float, data]`＋TTL 檢查）；每次 request 都打外部 API 而沒有快取是 major
- **API 形狀**：路徑前綴 `/api/<domain>`；delete 回 204、create 回 201；回傳只給 caller 需要的欄位，fat response 是 major
- **分層**：router（`api/`）只做三件事——解析參數、呼叫 `services/` 的函式、組回傳；在 router 裡直接打外部 API、寫多行 SQL、或做資料轉換邏輯，就是 major
- **資料不變量**：`sort_order` 在同一 group 內由 stocks 與 sublabels 共用（統一排序）；任何只重排其中一張表的寫法是 blocker
- **時序陷阱**：TWSE `STOCK_DAY_ALL` 約 16:30 後才有當日資料；假設「今天一定有資料」的邏輯是 major（正確做法參考 `get_movers()` 的回走 7 天）
