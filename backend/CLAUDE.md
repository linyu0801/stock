# Backend Rules — backend/

## Stack
FastAPI + Supabase Postgres（psycopg3 + connection pool，走 Transaction pooler）. No ORM — raw SQL via `get_conn()` from `db.py`.
連線字串在 `backend/.env` 的 `DATABASE_URL`（gitignored，缺失即啟動失敗）。`stock.db` 是遷移前的 SQLite 備份，唯讀不刪。

## Structure
```
api/        ← FastAPI routers (one file per domain)
services/   ← business logic, external API calls
main.py     ← app init, router registration
db.py       ← connection helper
```

## Yahoo Finance
- Use `services/fetcher.py` → `_yahoo_symbol(symbol)`: returns symbol as-is if starts with `^` (index), else appends `.TW`
- SSL bypass: `ssl.CERT_NONE` (self-signed cert issue with Yahoo)
- Direct urllib v8 API — do NOT use yfinance package

## Caching (in-memory)
- Price cache: 5 min TTL (`_price_cache`)
- Market movers cache: 30 min TTL (`_movers_cache`)
- Pattern: `tuple[float, data] | None` — check `time.time() - ts < TTL`

## TWSE Market Data
- `STOCK_DAY_ALL` only available after market close ~16:30 Taiwan time
- `get_movers()` walks back 7 days to find latest available data
- Returns `{ gainers, losers, date: "YYYY/MM/DD" }`

## DB Conventions
- Groups: `id, name, order`
- Stocks: `id, symbol, group_id, note, sort_order, added_at`
- Sublabels: `id, group_id, label, sort_order`
- `sort_order` shared between stocks and sublabels within a group (unified ordering)
- Always use `get_conn()` context manager; never hold connection across requests
- Postgres 方言：佔位符 `%s`（不是 `?`）；取自增 id 用 `INSERT ... RETURNING id`（沒有 lastrowid）；upsert 用 `ON CONFLICT`
- Row 是 `dict_row`：一律 `r["col"]`，禁止位置索引；`COUNT(*)` 要 `AS n`
- `executemany` 要走 cursor：`conn.cursor().executemany(...)`（connection 沒有這方法）
- 連線參數 `prepare_threshold=None` 不可拿掉（pgbouncer transaction mode 不支援 prepared statements）
- ThreadPoolExecutor worker 內不要呼叫 `get_conn()`（pool max_size=5）；DB 存取放在平行抓取區塊外
- `concepts`/`concept_stocks` 的 `position` 欄保留 Yahoo 來源順序，讀取 `ORDER BY position`

## API Conventions
- Prefix: `/api/<domain>` (e.g., `/api/watchlist`, `/api/market`, `/api/stock`)
- 204 for deletes, 201 for creates
- Return only what the caller needs — no fat responses
