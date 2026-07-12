# 上雲階段二：Google 登入＋使用者隔離 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google 登入（Supabase Auth）＋watchlist 使用者隔離；行情功能維持公開。

**Architecture:** 後端新增 JWT 驗證 dependency（PyJWT＋Supabase JWKS），watchlist 全 endpoint 以 `user_id` 過濾；前端 supabase-js 登入、api-client 自動帶 token、自選股頁登入 gate。

**Tech Stack:** PyJWT[crypto]（後端）、@supabase/supabase-js（前端）。

**Spec:** `docs/superpowers/specs/2026-07-12-cloud-phase2-google-auth.md`

## Global Constraints

- **不 commit**；不印 `backend/.env`／`apps/web/.env.local` 內容（報告只准出現變數名）
- `backend/.env` 已含 `DATABASE_URL`＋`SUPABASE_URL`
- 行情 endpoints（market/stock/fundamentals/disposition/etf/backtest）**不掛驗證**，行為零改變
- 動不到的資源回 404（不是 403——不洩漏資源存在性）
- Postgres 方言規範照 `backend/CLAUDE.md`（%s、RETURNING、dict_row）
- 前端規範照 `apps/web/CLAUDE.md`（useEffect 限制不適用於外部訂閱——onAuthStateChange 屬合法用法）
- **執行順序 gating**：Task 1-3 隨時可跑；Task 4 的 UI 驗證與 Task 5 需要使用者完成 Google OAuth 前置（`apps/web/.env.local`）

---

### Task 1: 後端 auth.py＋schema＋requirements

**Files:**
- Create: `backend/auth.py`
- Modify: `backend/db.py`（init_db 的 groups 定義）
- Modify: `backend/requirements.txt`

**Interfaces:**
- Produces: `get_current_user`（FastAPI dependency，回 user UUID str，401 on 缺/壞 token）；`groups.user_id UUID` 欄位＋`UNIQUE(user_id, name)`

- [ ] **Step 1: 確認 JWT 簽章制度**

```
curl -s https://sacczlkwdlabkdtqqeri.supabase.co/auth/v1/.well-known/jwks.json
```

Expected：回 `{"keys":[...]}` 且陣列非空（新專案為非對稱金鑰）→ 走下方 JWKS 路徑。若 keys 為空陣列 → 專案是 legacy HS256，改用 `SUPABASE_JWT_SECRET`（dashboard → Project Settings → API → JWT Secret，加進 backend/.env），`jwt.decode(token, secret, algorithms=["HS256"], audience="authenticated")`，並在報告註明走了哪條。

- [ ] **Step 2: 寫 `backend/auth.py`**（JWKS 路徑版本）

```python
import os
from functools import lru_cache
from pathlib import Path

import jwt
from dotenv import load_dotenv
from fastapi import Header, HTTPException

load_dotenv(Path(__file__).parent / ".env")
SUPABASE_URL = os.environ["SUPABASE_URL"]


@lru_cache
def _jwks_client() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")


def get_current_user(authorization: str | None = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "missing bearer token")
    token = authorization.removeprefix("Bearer ")
    try:
        key = _jwks_client().get_signing_key_from_jwt(token)
        claims = jwt.decode(token, key.key, algorithms=["ES256", "RS256"], audience="authenticated")
    except jwt.PyJWTError:
        raise HTTPException(401, "invalid token")
    return claims["sub"]
```

- [ ] **Step 3: schema——live ALTER＋init_db 同步**

live（backend/ 下 python -c 執行）：

```sql
ALTER TABLE groups ADD COLUMN IF NOT EXISTS user_id UUID;
CREATE INDEX IF NOT EXISTS groups_user_id_idx ON groups(user_id);
ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_name_key;
ALTER TABLE groups ADD CONSTRAINT groups_user_name_key UNIQUE (user_id, name);
```

`db.py` 的 `init_db()` groups 定義同步改：

```sql
CREATE TABLE IF NOT EXISTS groups (
    id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name    TEXT    NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    user_id UUID,
    UNIQUE(user_id, name)
);
CREATE INDEX IF NOT EXISTS groups_user_id_idx ON groups(user_id);
```

（`user_id` 維持 nullable：綁定 script 跑完前既有列是 NULL；程式層所有查詢都帶 user_id 過濾，NULL 列對任何登入者不可見。）

- [ ] **Step 4: requirements.txt 加 `PyJWT[crypto]`**

- [ ] **Step 5: 驗證**

```
cd backend && python -m pip install "PyJWT[crypto]"
python -c "from auth import get_current_user, _jwks_client; import fastapi; print('import ok')"
python -c "
from fastapi import HTTPException
from auth import get_current_user
try:
    get_current_user('Bearer not-a-jwt')
except HTTPException as e:
    print('bad token ->', e.status_code)
try:
    get_current_user(None)
except HTTPException as e:
    print('no header ->', e.status_code)
"
```

Expected：`import ok`；兩個 401。另外用 information_schema 確認 groups 有 user_id 欄、`groups_user_name_key` constraint 存在、舊 `groups_name_key` 不存在。

---

### Task 2: watchlist.py 使用者隔離

**Files:**
- Modify: `backend/api/watchlist.py`

**Interfaces:**
- Consumes: Task 1 的 `get_current_user`
- Produces: 全 endpoint 需 Bearer token；回應形狀不變；動不到（不存在或非本人）回 404

- [ ] **Step 1: 全檔改寫**

import 加：`from fastapi import APIRouter, HTTPException, Depends`＋`from auth import get_current_user`。Pydantic models 全部不動。各 endpoint 簽名加 `user_id: str = Depends(get_current_user)`，SQL 改為：

```python
@router.get("")
def get_watchlist(user_id: str = Depends(get_current_user)):
    with get_conn() as conn:
        groups = conn.execute(
            'SELECT id, name, "order" FROM groups WHERE user_id = %s ORDER BY "order", id',
            (user_id,),
        ).fetchall()
        # 迴圈內容不變（stocks/sublabels 以 group_id 查，歸屬已由外層保證）
```

```python
@router.post("/groups", status_code=201)
def create_group(body: GroupCreate, user_id: str = Depends(get_current_user)):
    with get_conn() as conn:
        try:
            cur = conn.execute(
                'INSERT INTO groups (name, "order", user_id) VALUES (%s, (SELECT COALESCE(MAX("order"),0)+1 FROM groups WHERE user_id = %s), %s) RETURNING id',
                (body.name, user_id, user_id),
            )
            return {"id": cur.fetchone()["id"], "name": body.name}
        except Exception:
            raise HTTPException(409, f"Group '{body.name}' already exists")
```

```python
@router.patch("/groups/{group_id}")
def rename_group(group_id: int, body: GroupRename, user_id: str = Depends(get_current_user)):
    with get_conn() as conn:
        cur = conn.execute(
            "UPDATE groups SET name = %s WHERE id = %s AND user_id = %s",
            (body.name, group_id, user_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "group not found")
        return {"id": group_id, "name": body.name}
```

```python
@router.delete("/groups/{group_id}", status_code=204)
def delete_group(group_id: int, user_id: str = Depends(get_current_user)):
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM groups WHERE id = %s AND user_id = %s", (group_id, user_id))
        if cur.rowcount == 0:
            raise HTTPException(404, "group not found")
```

歸屬檢查 helper（放 models 之後、endpoints 之前）：

```python
def _require_group(conn, group_id: int, user_id: str) -> None:
    if conn.execute(
        "SELECT 1 FROM groups WHERE id = %s AND user_id = %s", (group_id, user_id)
    ).fetchone() is None:
        raise HTTPException(404, "group not found")
```

```python
@router.post("/stocks", status_code=201)
def add_stock(body: StockAdd, user_id: str = Depends(get_current_user)):
    with get_conn() as conn:
        _require_group(conn, body.group_id, user_id)
        try:
            cur = conn.execute(
                "INSERT INTO stocks (symbol, group_id, sort_order) VALUES (%s, %s, (SELECT COALESCE(MAX(sort_order),0)+1 FROM stocks WHERE group_id=%s)) RETURNING id",
                (body.symbol, body.group_id, body.group_id),
            )
            return {"id": cur.fetchone()["id"], "symbol": body.symbol, "group_id": body.group_id}
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(409, f"Stock '{body.symbol}' already in group")
```

```python
@router.post("/stocks/batch", status_code=201)
def batch_add_stocks(body: StockBatch, user_id: str = Depends(get_current_user)):
    added = []
    with get_conn() as conn:
        for item in body.stocks:
            row = conn.execute(
                "SELECT id FROM groups WHERE name = %s AND user_id = %s", (item.group, user_id)
            ).fetchone()
            if row is None:
                cur = conn.execute(
                    'INSERT INTO groups (name, "order", user_id) VALUES (%s, (SELECT COALESCE(MAX("order"),0)+1 FROM groups WHERE user_id = %s), %s) RETURNING id',
                    (item.group, user_id, user_id),
                )
                group_id = cur.fetchone()["id"]
            else:
                group_id = row["id"]
            # PG 交易內失敗的 INSERT 會 abort 整個交易（SQLite 不會），不能用 try/except pass 續跑
            cur = conn.execute(
                "INSERT INTO stocks (symbol, group_id, sort_order) VALUES (%s, %s, (SELECT COALESCE(MAX(sort_order),0)+1 FROM stocks WHERE group_id=%s)) ON CONFLICT DO NOTHING RETURNING id",
                (item.symbol, group_id, group_id),
            )
            row2 = cur.fetchone()
            if row2 is not None:
                added.append({"id": row2["id"], "symbol": item.symbol, "group_id": group_id})
    return {"added": added}
```

stocks/sublabels 的 by-id 操作用子查詢限縮歸屬（`_OWNED_STOCK`／`_OWNED_SUBLABEL` 常數放 helper 旁）：

```python
_OWNED = "group_id IN (SELECT id FROM groups WHERE user_id = %s)"
```

```python
@router.delete("/stocks/{stock_id}", status_code=204)
def remove_stock(stock_id: int, user_id: str = Depends(get_current_user)):
    with get_conn() as conn:
        cur = conn.execute(f"DELETE FROM stocks WHERE id = %s AND {_OWNED}", (stock_id, user_id))
        if cur.rowcount == 0:
            raise HTTPException(404, "stock not found")
```

```python
@router.patch("/stocks/{stock_id}")
def update_stock(stock_id: int, body: StockUpdate, user_id: str = Depends(get_current_user)):
    with get_conn() as conn:
        if body.group_id is not None:
            _require_group(conn, body.group_id, user_id)
            cur = conn.execute(
                f"UPDATE stocks SET group_id = %s WHERE id = %s AND {_OWNED}",
                (body.group_id, stock_id, user_id),
            )
            if cur.rowcount == 0:
                raise HTTPException(404, "stock not found")
        if body.note is not None:
            cur = conn.execute(
                f"UPDATE stocks SET note = %s WHERE id = %s AND {_OWNED}",
                (body.note, stock_id, user_id),
            )
            if cur.rowcount == 0:
                raise HTTPException(404, "stock not found")
        row = conn.execute(
            f"SELECT id, group_id, note FROM stocks WHERE id = %s AND {_OWNED}",
            (stock_id, user_id),
        ).fetchone()
        if row is None:
            raise HTTPException(404, "stock not found")
        return dict(row)
```

```python
@router.post("/sublabels", status_code=201)
def create_sublabel(body: SublabelCreate, user_id: str = Depends(get_current_user)):
    with get_conn() as conn:
        _require_group(conn, body.group_id, user_id)
        max_order = conn.execute(
            "SELECT MAX(sort_order) as m FROM ("
            "  SELECT sort_order FROM stocks WHERE group_id=%s"
            "  UNION ALL"
            "  SELECT sort_order FROM sublabels WHERE group_id=%s"
            ")", (body.group_id, body.group_id)
        ).fetchone()["m"] or 0
        cur = conn.execute(
            "INSERT INTO sublabels (group_id, label, sort_order) VALUES (%s, %s, %s) RETURNING id",
            (body.group_id, body.label, max_order + 1),
        )
        return {"id": cur.fetchone()["id"], "group_id": body.group_id, "label": body.label}
```

```python
@router.patch("/sublabels/{sublabel_id}")
def update_sublabel(sublabel_id: int, body: SublabelUpdate, user_id: str = Depends(get_current_user)):
    with get_conn() as conn:
        cur = conn.execute(
            f"UPDATE sublabels SET label = %s WHERE id = %s AND {_OWNED}",
            (body.label, sublabel_id, user_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "sublabel not found")
        return {"id": sublabel_id, "label": body.label}
```

```python
@router.delete("/sublabels/{sublabel_id}", status_code=204)
def delete_sublabel(sublabel_id: int, user_id: str = Depends(get_current_user)):
    with get_conn() as conn:
        cur = conn.execute(f"DELETE FROM sublabels WHERE id = %s AND {_OWNED}", (sublabel_id, user_id))
        if cur.rowcount == 0:
            raise HTTPException(404, "sublabel not found")
```

```python
@router.post("/reorder")
def reorder_items(body: ReorderBody, user_id: str = Depends(get_current_user)):
    with get_conn() as conn:
        _require_group(conn, body.group_id, user_id)
        for i, item in enumerate(body.items):
            if item.type == "stock":
                conn.execute("UPDATE stocks SET sort_order = %s WHERE id = %s AND group_id = %s",
                             (i, item.id, body.group_id))
            elif item.type == "sublabel":
                conn.execute("UPDATE sublabels SET sort_order = %s WHERE id = %s AND group_id = %s",
                             (i, item.id, body.group_id))
    return {"ok": True}
```

- [ ] **Step 2: 驗證（無 token 拒絕＋行情不受影響）**

uvicorn 起服務：

```
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/watchlist            → 401
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8000/api/watchlist/groups -H "Content-Type: application/json" -d "{\"name\":\"x\"}"  → 401
curl -s -o /dev/null -w "%{http_code}" "http://localhost:8000/api/stock/prices?symbols=2330"  → 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/market/movers        → 200
curl -s -o /dev/null -w "%{http_code}" "http://localhost:8000/api/disposition/flags?symbols=2330"  → 200
```

（真 token 的正向流程在 Task 5，需使用者先登入一次。）

---

### Task 3: bind_owner.py（寫好備用，執行留到 Task 5）

**Files:**
- Create: `backend/bind_owner.py`

- [ ] **Step 1: 寫 script**

```python
"""一次性：把 user_id IS NULL 的 groups 綁給指定 email 的使用者。
用法（該 email 需先 Google 登入過一次）：python bind_owner.py you@example.com"""
import sys

from db import get_conn


def main(email: str) -> None:
    with get_conn() as conn:
        row = conn.execute("SELECT id FROM auth.users WHERE email = %s", (email,)).fetchone()
        if row is None:
            raise SystemExit(f"auth.users 沒有 {email}——先用該帳號登入一次")
        cur = conn.execute("UPDATE groups SET user_id = %s WHERE user_id IS NULL", (row["id"],))
        print(f"bound {cur.rowcount} groups to {email}")


if __name__ == "__main__":
    main(sys.argv[1])
```

- [ ] **Step 2: 驗證（不執行綁定）**

`python -c "import bind_owner; print('import ok')"`；對不存在的 email 跑一次確認 SystemExit 訊息正確（不會誤綁）。

---

### Task 4: 前端登入

**Files:**
- Create: `apps/web/src/shared/lib/supabase.ts`
- Create: `apps/web/src/shared/lib/use-session.ts`
- Create: `apps/web/src/pages/home/molecules/LoginCard.tsx`
- Modify: `packages/api-client/src/client.ts`（token 注入）
- Modify: `apps/web/src/app/main.tsx`（註冊 token provider）
- Modify: `apps/web/src/pages/home/index.tsx`（登入 gate＋登出鈕）

**Interfaces:**
- Consumes: Task 2 的 401 行為；`VITE_SUPABASE_URL`／`VITE_SUPABASE_ANON_KEY`（使用者前置）
- Produces: `setAuthTokenProvider(fn)`（api-client 新 export）；`useSession()` hook

- [ ] **Step 1: `pnpm -C apps/web add @supabase/supabase-js`**

- [ ] **Step 2: `shared/lib/supabase.ts`**

```ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
```

（若 tsc 抱怨 `import.meta.env` 型別，於 `apps/web/src/vite-env.d.ts` 補 `interface ImportMetaEnv { readonly VITE_SUPABASE_URL: string; readonly VITE_SUPABASE_ANON_KEY: string }`——先看該檔是否已存在再決定加法。）

- [ ] **Step 3: `shared/lib/use-session.ts`**

```ts
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  return { session, loading };
}
```

- [ ] **Step 4: api-client token 注入**

`client.ts` 頂部（`BASE` 之後）加：

```ts
let authTokenProvider: (() => Promise<string | null>) | null = null;
export const setAuthTokenProvider = (fn: () => Promise<string | null>) => {
  authTokenProvider = fn;
};

async function authHeaders(): Promise<Record<string, string>> {
  const token = authTokenProvider ? await authTokenProvider() : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
```

`apiFetch` 改：

```ts
async function apiFetch<T>(schema: z.ZodType<T>, url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { ...(init?.headers ?? {}), ...(await authHeaders()) } });
  if (!res.ok) throw new Error(`API error ${res.status}: ${url}`);
  return schema.parse(await res.json());
}
```

三個裸 fetch 的 delete 函式（`deleteGroup`／`removeStock`／`deleteSublabel`）同步加 `headers: await authHeaders()`。

- [ ] **Step 5: `main.tsx` 註冊 provider**

```tsx
import { setAuthTokenProvider } from "@taiwan-stock/api-client";
import { supabase } from "@/shared/lib/supabase";

setAuthTokenProvider(async () => (await supabase.auth.getSession()).data.session?.access_token ?? null);
```

（放在 `queryClient` 定義之前，module top-level。）

- [ ] **Step 6: `LoginCard.tsx`＋home gate**

`pages/home/molecules/LoginCard.tsx`：

```tsx
import { supabase } from "@/shared/lib/supabase";

export const LoginCard: React.FC = () => {
  const signIn = () =>
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/watchlist" },
    });
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="bg-card border border-border rounded-xl px-8 py-10 text-center max-w-sm">
        <h2 className="font-display font-bold text-lg mb-2">自選股</h2>
        <p className="text-sm text-muted-foreground mb-6">登入後即可建立與同步你的自選股清單</p>
        <button
          onClick={signIn}
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          使用 Google 登入
        </button>
      </div>
    </div>
  );
};
```

`pages/home/index.tsx`：現有元件內容改名為內部元件 `WatchlistView`（保持所有 hooks 原樣），新的 default export：

```tsx
const HomePage: React.FC = () => {
  const { session, loading } = useSession();
  if (loading) return null;
  if (!session) return <LoginCard />;
  return <WatchlistView />;
};

export default HomePage;
```

（`WatchlistView` 不 export；原本 `export default HomePage` 位置由新 gate 元件取代。這樣未登入時 `useGroups` 等 query hooks 完全不執行，不會打出 401。）

登出鈕：`WatchlistView` 的「自選股」header（`<span>自選股</span>` 與 `+` 鈕那列）加：

```tsx
<button
  onClick={() => supabase.auth.signOut()}
  aria-label="登出"
  className="w-7 h-7 flex items-center justify-center rounded cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
>
  <LogOut size={14} />
</button>
```

（`LogOut` 自 lucide-react import；放在 `+` 鈕旁。）

- [ ] **Step 7: 驗證**

`pnpm -C apps/web exec tsc --noEmit` → exit 0。
`.env.local` 就位後（使用者前置）：dev server＋playwright——`/watchlist` 未登入顯示 LoginCard、市場頁正常、個股頁正常，各截圖。

---

### Task 5: 端到端驗證（需使用者參與）

- [ ] **Step 1: 自動部分**

Task 2 的 401/200 全套 curl 重跑一遍（伺服器為最新 code）；tsc；playwright 未登入三頁截圖。

- [ ] **Step 2: 使用者手動流程（引導使用者做）**

1. 開 http://localhost:5173/watchlist → 點「使用 Google 登入」→ 完成 OAuth → 回到頁面
2. 預期：清單是空的（既有資料還沒綁定）
3. 執行 `python backend/bind_owner.py <使用者的 gmail>` → 重新整理 → 既有 10 分組全部出現
4. 瀏覽器 DevTools 拿 access token（`localStorage` 的 `sb-*-auth-token`），用它 curl `GET /api/watchlist` 帶 `Authorization: Bearer` → 200 且只回本人資料
5. （可選）第二個 Google 帳號登入 → 空清單、新增分組 → 兩帳號互不可見

- [ ] **Step 3: 回報**

彙整驗證輸出與截圖，使用者確認後決定 commit。
