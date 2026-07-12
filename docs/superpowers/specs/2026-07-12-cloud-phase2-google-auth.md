# 上雲階段二：Google 登入＋使用者隔離 — 設計文件

日期：2026-07-12。前情：階段一已完成（Supabase Postgres，commit e1e5d2c）。整體拓撲與 Google OAuth 已定案（見 `2026-07-11-cloud-phase1-supabase-db.md` 前情）。

## 目標

1. Google 登入（Supabase Auth，`signInWithOAuth({provider:"google"})`）
2. 自選股使用者隔離：每人只看得到、動得到自己的 groups/stocks/sublabels
3. 行情功能（市場頁、個股頁、基本面、處置、ETF 折溢價）維持公開免登入
4. 既有 10 個分組綁定到擁有者（使用者本人）的帳號

## 不做（本階段排除）

- RLS 政策（讀寫全走 FastAPI，資料庫層 RLS 是 FE 直連才需要；anon key 不開放資料表存取）
- 部署／CORS／BASE 環境變數化（階段三）
- 使用者管理介面、邀請制、權限分級

## 使用者一次性前置（執行前完成）

1. Google Cloud Console → 建 OAuth 2.0 用戶端（Web application）：
   - Authorized redirect URI 填 Supabase 提供的 callback（`https://<project-ref>.supabase.co/auth/v1/callback`）
   - 取得 Client ID＋Client Secret
2. Supabase dashboard → Authentication → Providers → Google：啟用，貼上 Client ID/Secret
3. Supabase dashboard → Authentication → URL Configuration：Site URL 填 `http://localhost:5173`（部署時再加正式網域）
4. 提供前端環境變數：Project Settings → API 的 Project URL 與 anon public key，放 `apps/web/.env.local`（`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`；anon key 設計上可公開，但仍不進版控）

## 後端設計

### auth.py（新檔）

- `get_current_user(authorization: Header) -> str`：FastAPI dependency
  - 解析 `Authorization: Bearer <jwt>`；缺 header 或格式錯 → 401
  - PyJWT `PyJWKClient` 對 `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json` 驗簽（JWKS client 模組層單例，內建金鑰快取）；驗 `aud == "authenticated"`、過期
  - 回傳 `sub`（user UUID 字串）
  - Supabase 專案若仍用 legacy HS256（JWKS 端點無金鑰）→ 實作時檢查，改用 JWT secret 驗證（env `SUPABASE_JWT_SECRET`）。二擇一，以實測為準
- `SUPABASE_URL` 進 `backend/.env`（JWKS 端點由它拼出）
- 相依：`PyJWT[crypto]` 加進 requirements.txt

### watchlist 隔離

- `groups` 加欄：`user_id UUID`＋`CREATE INDEX ON groups(user_id)`（live ALTER＋init_db 同步）
- `api/watchlist.py` 全 endpoint 掛 `user_id: str = Depends(get_current_user)`：
  - `GET /api/watchlist`：`WHERE g.user_id = %s`
  - create group：INSERT 帶 user_id
  - group 的 rename/delete：`WHERE id = %s AND user_id = %s`，動不到就 404
  - stocks/sublabels 的增刪改與 reorder：一律 JOIN／子查詢驗 group 歸屬（`group_id IN (SELECT id FROM groups WHERE user_id = %s)`），不新增欄位
- `groups.name` 的 UNIQUE 約束改為 `UNIQUE(user_id, name)`（不同使用者可有同名分組）——live ALTER：drop 舊 constraint、建新的

### 既有資料綁定（一次性）

`backend/bind_owner.py` script：參數收 email，從 Supabase `auth.users` 查該 email 的 uuid（用 DATABASE_URL 直查——pooler 連線是 postgres role，讀得到 `auth.users`），`UPDATE groups SET user_id = %s WHERE user_id IS NULL`。使用者首次 Google 登入後執行。

## 前端設計

### supabase client 與登入狀態

- 新檔 `apps/web/src/shared/lib/supabase.ts`：`createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)`
- 新檔 `apps/web/src/shared/lib/use-session.ts`：hook 包 `supabase.auth.getSession()`＋`onAuthStateChange`，回 `{ session, loading }`
- 相依：`@supabase/supabase-js` 加進 apps/web

### api-client 帶 token

- `apiFetch` 增加可選的 Authorization 注入：`client.ts` export `setAuthTokenProvider(fn: () => Promise<string | null>)`；`apiFetch` 呼叫時取 token，有就帶 `Authorization: Bearer`
- `apps/web` 啟動時（main.tsx 或 app 層）註冊 provider：`() => supabase.auth.getSession().then(s => s.data.session?.access_token ?? null)`（supabase-js 自動 refresh，過期自理）
- 401 回應：react-query 正常拋錯，自選股頁的未登入狀態由 session 判斷，不靠 401

### 自選股頁 gate

- `pages/home/index.tsx`：`useSession()`——loading 顯示 skeleton；無 session 顯示登入卡片（置中卡片：說明文字＋「使用 Google 登入」按鈕 → `signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + "/watchlist" } })`）；有 session 照現行 UI
- 登出：自選股頁 header 區加小按鈕（`signOut()` 後回登入卡片）
- 市場頁、個股頁：零改動

## 驗證方式

- 後端：無 token 打 `GET /api/watchlist` → 401；偽造 token → 401；真 token（登入後從瀏覽器取）→ 200 且只回該 user 資料；行情 endpoints 無 token 200
- 綁定：跑 bind_owner.py 後，擁有者登入看得到既有 10 分組；第二個 Google 帳號登入是空清單、新增分組互不可見
- 前端：playwright 截圖——未登入自選股頁（登入卡片）、市場頁未登入正常；OAuth 全流程涉及 Google 帳號互動，由使用者手動點一次驗證
- `pnpm -C apps/web exec tsc --noEmit` exit 0

## 風險

- Supabase JWT 簽章制度（非對稱 JWKS vs legacy HS256）依專案建立時間而異——實作時實測決定路徑，spec 兩案並列
- OAuth redirect 在本地（localhost:5173）與部署網域不同——階段三部署時要回 Supabase 補 Site URL/Redirect URLs
