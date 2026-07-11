# 上雲階段一：SQLite → Supabase Postgres Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 後端資料層由本地 SQLite 換成 Supabase Postgres（Transaction pooler），對外 API 行為零改變。

**Architecture:** `db.py` 換 psycopg3＋ConnectionPool（`get_conn()` 介面不變）；34 個 SQL 呼叫點做方言轉換；一次性 script 搬遷 `stock.db` 全部資料並對帳。

**Tech Stack:** psycopg[binary] 3.x、psycopg-pool、python-dotenv（已安裝於系統 Python）。

**Spec:** `docs/superpowers/specs/2026-07-11-cloud-phase1-supabase-db.md`

## Global Constraints

- **不 commit**：每 task 以驗證取代 commit，完成後使用者決定
- `backend/.env` 已存在（`DATABASE_URL`＝Transaction pooler URI）且已被 .gitignore 蓋住——**絕不印出其內容**（含密碼），log/報告裡只准出現 host 與 port
- 連線參數必帶 `prepare_threshold=None`（pgbouncer transaction mode 不支援 prepared statements）
- `row_factory=dict_row`；禁止對 DB row 做位置索引
- 對外行為零改變：API 回應形狀、欄位、時間字串格式（`YYYY-MM-DD HH:MM:SS`）全部與現況一致
- `stock.db` 檔案不刪不改，留作備份
- 註解只寫不明顯的 WHY；無 unused imports

## 方言轉換規則（Task 2 全程適用）

| SQLite | Postgres |
|---|---|
| `?` | `%s` |
| `INSERT OR IGNORE INTO t ...` | `INSERT INTO t ... ON CONFLICT DO NOTHING` |
| `ON CONFLICT(col) DO UPDATE SET x = excluded.x` | 同語法不改 |
| `cur.lastrowid` | SQL 尾加 ` RETURNING id`，改 `cur.fetchone()["id"]` |
| `SELECT COUNT(*) FROM ...` ＋ `fetchone()[0]` | `SELECT COUNT(*) AS n FROM ...` ＋ `fetchone()["n"]` |
| `datetime('now')`（SQL 內）| `to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')`（維持字串格式一致） |

---

### Task 1: db.py 改 psycopg pool＋Postgres schema＋requirements.txt

**Files:**
- Modify: `backend/db.py`（全檔重寫）
- Create: `backend/requirements.txt`

**Interfaces:**
- Consumes: `backend/.env` 的 `DATABASE_URL`
- Produces: `get_conn()` context manager（`with get_conn() as conn:` 用法不變、正常離開 commit、例外 rollback）；`init_db()`；後續 task 依賴此介面

- [ ] **Step 1: 重寫 `backend/db.py`**

```python
import os
from contextlib import contextmanager
from pathlib import Path

from dotenv import load_dotenv
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

load_dotenv(Path(__file__).parent / ".env")
DATABASE_URL = os.environ["DATABASE_URL"]

pool = ConnectionPool(
    DATABASE_URL,
    min_size=1,
    max_size=5,
    open=False,
    # pgbouncer transaction mode 不支援 prepared statements
    kwargs={"row_factory": dict_row, "prepare_threshold": None},
)


@contextmanager
def get_conn():
    if pool.closed:
        pool.open()
    with pool.connection() as conn:
        yield conn


def init_db() -> None:
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS groups (
                id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                name    TEXT    NOT NULL UNIQUE,
                "order" INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS stocks (
                id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                symbol     TEXT    NOT NULL,
                group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
                added_at   TEXT    NOT NULL DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'),
                sort_order INTEGER DEFAULT 0,
                note       TEXT    DEFAULT NULL,
                UNIQUE(symbol, group_id)
            );
            CREATE TABLE IF NOT EXISTS sublabels (
                id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
                label      TEXT    NOT NULL,
                sort_order INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS stocks_meta (
                symbol TEXT PRIMARY KEY,
                name   TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS concepts (
                category   TEXT PRIMARY KEY,
                name       TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
            );
            CREATE TABLE IF NOT EXISTS concept_stocks (
                category   TEXT NOT NULL,
                symbol     TEXT NOT NULL,
                name       TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'),
                PRIMARY KEY (category, symbol)
            );
            CREATE TABLE IF NOT EXISTS monthly_revenue (
                symbol      TEXT NOT NULL,
                year_month  TEXT NOT NULL,
                revenue     BIGINT NOT NULL,
                mom_pct     DOUBLE PRECISION,
                yoy_pct     DOUBLE PRECISION,
                acc_yoy_pct DOUBLE PRECISION,
                PRIMARY KEY (symbol, year_month)
            );
        """)
```

注意：`DB_PATH` 常數刪除；schema 以 spec 記載的 live schema 為準（含 `note`/`sort_order`/`sublabels`，舊 `init_db` 沒有它們）；`revenue` 升 BIGINT（營收以元計會超 int4）。

- [ ] **Step 2: 建 `backend/requirements.txt`**

```
fastapi
uvicorn[standard]
psycopg[binary]
psycopg-pool
python-dotenv
```

- [ ] **Step 3: 驗證**

```
cd backend && python -c "from db import init_db, get_conn; init_db(); print(get_conn.__name__)"
```

Expected：無例外。再跑：

```
python -c "
from db import get_conn
with get_conn() as conn:
    rows = conn.execute(\"SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name\").fetchall()
    print([r['table_name'] for r in rows])
"
```

Expected：七張表名全列出（concept_stocks, concepts, groups, monthly_revenue, stocks, stocks_meta, sublabels）。

---

### Task 2: 方言轉換 5 檔（34 個呼叫點）

**Files:**
- Modify: `backend/api/watchlist.py`（20 處，含 5 處 `lastrowid`）
- Modify: `backend/services/concepts.py`(6)、`backend/services/fundamentals.py`(3)、`backend/services/fetcher.py`(2)、`backend/services/stock_meta.py`(3)

**Interfaces:**
- Consumes: Task 1 的 `get_conn()`（用法不變）
- Produces: 全部 SQL 為 Postgres 方言；對外回應形狀不變

- [ ] **Step 1: 逐檔套用「方言轉換規則」表**

具體點名的非機械處：
- `api/watchlist.py:89,115,131,139,177`：`lastrowid` → SQL 加 ` RETURNING id`＋`cur.fetchone()["id"]`
- `services/stock_meta.py:58`：`SELECT COUNT(*) AS n ...`＋`fetchone()["n"]`
- 所有 `INSERT OR IGNORE` → `ON CONFLICT DO NOTHING`（fundamentals.py 的 derived 營收、stock_meta、concepts 都有）
- **`conn.executemany(...)` → `conn.cursor().executemany(...)`**：psycopg 的 connection 物件沒有 `executemany`（sqlite3 有），所有出現處都要改（fundamentals.py、stock_meta.py、concepts.py 可能都有）
- SQL 內出現的 `datetime('now')` → `to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')`
- 其餘 `?` → `%s` 全替換；`ON CONFLICT ... DO UPDATE SET ... excluded.*` 語法不動

- [ ] **Step 2: 驗證（靜態）**

```
cd backend && python -c "import api.watchlist, services.concepts, services.fundamentals, services.fetcher, services.stock_meta; print('imports ok')"
grep -rn '?"' api/ services/ ; grep -rn "lastrowid" api/ services/
```

Expected：imports ok；兩個 grep 都無輸出（無殘留 `?` 佔位符與 `lastrowid`）。

- [ ] **Step 3: 驗證（動態，空庫冒煙）**

於 backend/ 起 `uvicorn main:app --port 8000`：
```
curl -s http://localhost:8000/api/health
curl -s http://localhost:8000/api/watchlist
curl -s -X POST http://localhost:8000/api/watchlist/groups -H "Content-Type: application/json" -d "{\"name\":\"__smoke__\"}"
curl -s http://localhost:8000/api/watchlist
```
Expected：health ok；watchlist 先回 `[]`；create 回 `{"id":1,"name":"__smoke__"}`（201）；再查看得到該 group。最後刪掉：`curl -s -X DELETE http://localhost:8000/api/watchlist/groups/<id>`（204）。

---

### Task 3: 資料搬遷 script＋執行＋對帳

**Files:**
- Create: `backend/migrate_sqlite_to_pg.py`

**Interfaces:**
- Consumes: `backend/stock.db`（唯讀）、Task 1 的 `get_conn()`
- Produces: Supabase 七張表載入既有資料；identity sequence 校正

- [ ] **Step 1: 寫 script**

```python
"""一次性：stock.db → Supabase Postgres。跑完即棄，保留檔案供 prod 種子重跑。"""
import sqlite3
from pathlib import Path

from db import get_conn

SQLITE = Path(__file__).parent / "stock.db"

TABLES = {  # 依 FK 順序；identity 欄位需 OVERRIDING SYSTEM VALUE 保留原 id
    "groups":          ("id, name, \"order\"", True),
    "stocks":          ("id, symbol, group_id, added_at, sort_order, note", True),
    "sublabels":       ("id, group_id, label, sort_order", True),
    "stocks_meta":     ("symbol, name", False),
    "concepts":        ("category, name, updated_at, position", False),   # sqlite 端 SELECT 用 rowid AS position
    "concept_stocks":  ("category, symbol, name, updated_at, position", False),  # 同上
    "monthly_revenue": ("symbol, year_month, revenue, mom_pct, yoy_pct, acc_yoy_pct", False),
}


def main() -> None:
    src = sqlite3.connect(SQLITE)
    src.row_factory = sqlite3.Row
    with get_conn() as conn:
        for table, (cols, has_identity) in TABLES.items():
            src_cols = cols.replace(", position", ", rowid AS position")
            rows = src.execute(f"SELECT {src_cols} FROM {table}").fetchall()
            if not rows:
                print(f"{table}: source empty, skipped")
                continue
            ph = ", ".join(["%s"] * len(rows[0]))
            override = " OVERRIDING SYSTEM VALUE" if has_identity else ""
            conn.cursor().executemany(
                f"INSERT INTO {table} ({cols}){override} VALUES ({ph}) ON CONFLICT DO NOTHING",
                [tuple(r) for r in rows],
            )
            n = conn.execute(f"SELECT COUNT(*) AS n FROM {table}").fetchone()["n"]
            print(f"{table}: sqlite={len(rows)} pg={n} {'OK' if n >= len(rows) else 'MISMATCH'}")
        for t in ("groups", "stocks", "sublabels"):
            conn.execute(
                f"SELECT setval(pg_get_serial_sequence('{t}', 'id'), (SELECT COALESCE(MAX(id), 1) FROM {t}))"
            )
    print("done")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: 先清掉 Task 2 冒煙測試殘留再跑**

```
cd backend && python -c "
from db import get_conn
with get_conn() as conn:
    conn.execute('TRUNCATE groups, stocks, sublabels RESTART IDENTITY CASCADE')
"
python migrate_sqlite_to_pg.py
```

Expected：每張表印 `sqlite=N pg=N OK`（stocks_meta 等大表 N 數千屬正常），最後 `done`。任何 MISMATCH 即失敗。

- [ ] **Step 3: setval 驗證**

```
python -c "
from db import get_conn
with get_conn() as conn:
    r = conn.execute(\"INSERT INTO groups (name) VALUES ('__seq_test__') RETURNING id\").fetchone()
    print('new id:', r['id'])
    conn.execute('DELETE FROM groups WHERE id = %s', (r['id'],))
"
```

Expected：new id ＞ 遷移前 groups 最大 id（證明 sequence 校正成功），且該筆已刪。

---

### Task 4: 端到端驗證（遷移後全功能）

**Files:** 無新改動（驗證 task）

- [ ] **Step 1: 後端**

於 backend/ 起 uvicorn，依序：
```
curl -s http://localhost:8000/api/health
curl -s http://localhost:8000/api/watchlist
curl -s "http://localhost:8000/api/fundamentals/2330"
curl -s -X POST http://localhost:8000/api/watchlist/stocks -H "Content-Type: application/json" -d "{\"symbol\":\"2330\",\"group_id\":<既有group id>}"
curl -s -X DELETE http://localhost:8000/api/watchlist/stocks/<上一步回的id>
```
Expected：watchlist 回遷移前的完整自選股（groups/stocks/sublabels/note/排序都在）；fundamentals 有 valuation＋revenue 陣列；新增回 201＋id、刪除 204。

- [ ] **Step 2: 前端肉眼驗證**

`pnpm -C apps/web run dev`＋playwright 開 http://localhost:5173 截圖：自選股清單與遷移前一致（分組、股票、備註 tag、次標、排序）。

- [ ] **Step 3: 回報**

彙整全部 curl 輸出與截圖給使用者，由使用者確認後決定 commit。
