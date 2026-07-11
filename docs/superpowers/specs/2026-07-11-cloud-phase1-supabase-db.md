# 上雲階段一：SQLite → Supabase Postgres — 設計文件

日期：2026-07-11。前情：整體拓撲已定案（Vercel FE＋Supabase Postgres/Auth＋Railway/Fly FastAPI；Google OAuth 於階段二）。本文件只涵蓋階段一。

## 目標

後端資料層從本地 SQLite（`backend/stock.db`）換成 Supabase 託管 Postgres。**對外行為完全不變**：所有 API endpoint 的路徑、參數、回應形狀不動；前端零改動。本地開發從此直連雲端 DB。

## 不做（本階段明確排除）

- user_id／RLS／Auth（階段二）
- 部署 FastAPI／FE（階段三）
- CORS 與 api-client BASE 環境變數化（階段三）
- 營收歷史回補（另案，已暫緩）

## 技術決策

| 項目 | 決策 | 理由 |
|---|---|---|
| Driver | psycopg 3（`psycopg[binary]`）＋`psycopg_pool` | 現行後端全同步，psycopg 3 同步模式直換；pool 避免每 request 跨洋建連線 |
| 連線目標 | Supabase **Transaction pooler** URI（IPv4 相容） | free tier 直連 5432 走 IPv6，本地 Windows 與多數托管不保證有；pooler 沒這問題 |
| Prepared statements | 連線參數 `prepare_threshold=None` | pgbouncer transaction mode 不支援 prepared statements，psycopg 預設會在第 5 次執行後 prepare，會炸 |
| Pool 大小 | `min_size=1, max_size=5` | 單人～小群使用足夠，且不吃滿 Supabase free tier 連線數 |
| Row 存取 | `row_factory=dict_row` | 對應現行 `sqlite3.Row`；`dict(r)`／`r["col"]` 寫法不變（**positional `r[0]` 會壞，遷移時全查**） |
| 設定 | `backend/.env` 放 `DATABASE_URL`，python-dotenv 載入；`.gitignore` 加 `backend/.env` | 密碼不進版控 |
| SQLite fallback | **不留**。`DATABASE_URL` 缺失 → 啟動時明確報錯 | 單一資料路徑，開發=生產，不維護兩套 SQL 方言。`stock.db` 檔案保留當備份，不刪 |

## SQL 方言轉換表（34 個呼叫點，5 檔：api/watchlist.py、services/concepts.py、fundamentals.py、fetcher.py、stock_meta.py）

| SQLite | Postgres |
|---|---|
| `?` 佔位符 | `%s` |
| `INSERT OR IGNORE` | `INSERT ... ON CONFLICT DO NOTHING` |
| `ON CONFLICT(...) DO UPDATE SET x = excluded.x` | 同語法，不用改 |
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY` |
| `datetime('now')` | `now()` |
| `executescript(...)` | `execute(...)`（psycopg 支援多語句字串） |
| `lastrowid` | `INSERT ... RETURNING id`（有用到的呼叫點逐一改） |

## Schema（Postgres 版，以**實際** live schema 為準，非過時的 init_db）

七張表：`groups`（id, name unique, "order"）、`stocks`（id, symbol, group_id FK CASCADE, added_at, sort_order, note, UNIQUE(symbol, group_id)）、`sublabels`（id, group_id FK CASCADE, label, sort_order）、`stocks_meta`（symbol PK, name）、`concepts`（category PK, name, updated_at）、`concept_stocks`（category+symbol PK, name, updated_at）、`monthly_revenue`（symbol+year_month PK, revenue, mom_pct, yoy_pct, acc_yoy_pct）。

`db.py` 的 `init_db()` 同步改成 Postgres 版完整 schema（含 note/sort_order/sublabels），`CREATE TABLE IF NOT EXISTS` 語意保留。

## 資料搬遷

一次性 script（`backend/migrate_sqlite_to_pg.py`，用完即棄不進 git？→ 進 git 留紀錄，跑完不再用）：
1. 讀 `stock.db` 全部七張表
2. 依 FK 順序寫入 Postgres（groups → stocks/sublabels → 其餘）
3. `setval` 重設三個 identity sequence（groups/stocks/sublabels 的 id）
4. 驗證：兩邊逐表 `COUNT(*)` 相同

## `db.py` 新形狀

```python
import os
from contextlib import contextmanager
from psycopg_pool import ConnectionPool
from psycopg.rows import dict_row
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.environ["DATABASE_URL"]  # 缺失即 KeyError，fail fast

pool = ConnectionPool(
    DATABASE_URL, min_size=1, max_size=5, open=False,
    kwargs={"row_factory": dict_row, "prepare_threshold": None},
)

@contextmanager
def get_conn():
    if pool.closed:
        pool.open()
    with pool.connection() as conn:  # 正常離開自動 commit，例外自動 rollback
        yield conn
```

`get_conn()` 呼叫介面（`with get_conn() as conn`）完全不變，34 個呼叫點只改 SQL 字串不改結構。

## 驗證方式

1. 遷移 script 的逐表 COUNT 對帳輸出
2. uvicorn 起服務（連 Supabase）→ `curl /api/health`、`/api/watchlist`（自選股資料與遷移前一致）、`/api/fundamentals/2330`（觸發 monthly_revenue 讀寫）、新增＋刪除一筆自選股（觸發 INSERT/DELETE/RETURNING 路徑）
3. 前端 dev server 開首頁：自選股清單、備註、排序全部如舊

## 需要使用者做的（前置，一次性）

1. 註冊 supabase.com → New project（region 選 Tokyo，設 DB 密碼並記住）
2. 專案頁上方「Connect」→ 選 **Transaction pooler** 的 URI 複製
3. 建 `backend/.env`，內容一行：`DATABASE_URL=<貼上的 URI>`（密碼放檔案，不要貼進對話）

## 風險

- Supabase free tier 閒置一週暫停：個人使用期會遇到，dashboard 一鍵 resume；上線後有流量就不會
- 本地開發從此需要網路；斷網時後端起不來（可接受，行情功能本來就要網路）
