# Backend Rules — backend/

## Stack
FastAPI + SQLite (`stock.db`). No ORM — raw SQL via `get_conn()` from `db.py`.

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

## API Conventions
- Prefix: `/api/<domain>` (e.g., `/api/watchlist`, `/api/market`, `/api/stock`)
- 204 for deletes, 201 for creates
- Return only what the caller needs — no fat responses
