# Taiwan Stock Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Taiwan stock analysis platform with K-line charts, bias ratio indicator, grouped watchlist, and basic backtesting.

**Architecture:** pnpm monorepo with a Python FastAPI backend (yfinance + SQLite) and a React/Vite frontend following FSD + Clean Architecture + Atomic Design. `packages/api-client` is the single source of truth for backend schemas (zod). Frontend layers: `shared → entities → features → widgets → pages`.

**Tech Stack:** Python 3.11+, FastAPI, yfinance, pandas, SQLite · React 18, Vite, TanStack Router, Tailwind CSS, shadcn/ui, lightweight-charts, zod, pnpm workspaces

## Global Constraints

- Taiwan stock symbols always stored without suffix (e.g. `2330`); `.TW` appended only in fetcher
- yfinance period values: `1mo` `3mo` `6mo` `1y` `2y` `5y`
- Bias ratio N values: 5, 10, 20, 60
- FSD import rule: a layer may only import from layers below it (`pages → widgets → features → entities → shared`)
- Same-layer cross-imports are forbidden
- `packages/api-client` is the only place that knows the backend base URL
- Python: `backend/` directory, not inside any pnpm workspace
- All API routes prefixed with `/api`

---

## File Map

```
pnpm-workspace.yaml
packages/
  tsconfig/
    base.json
  api-client/
    package.json
    src/
      index.ts          # re-exports everything
      schemas/
        stock.ts        # StockInfo, OHLCVBar, IndicatorPoint zod schemas
        watchlist.ts    # Group, WatchlistStock, BatchAddPayload schemas
        backtest.ts     # BacktestRequest, BacktestResult schemas
      client.ts         # typed fetch functions (getHistory, getIndicators, ...)
  ui/
    package.json
    src/
      index.ts          # re-exports shadcn primitives (future multi-app use)

apps/web/
  package.json
  vite.config.ts
  tailwind.config.ts
  index.html
  src/
    app/
      router.tsx        # TanStack Router root + routeTree
      main.tsx          # ReactDOM.createRoot, wrap with RouterProvider
    pages/
      home/
        index.tsx       # composes WatchlistSection widget
      stock/
        index.tsx       # composes ChartPanel widget
      backtest/
        index.tsx       # composes BacktestPanel widget
    widgets/
      chart-panel/
        index.tsx       # ChartPanel: CandlestickChart + IndicatorPanel + StockInfoCard
      watchlist-section/
        index.tsx       # WatchlistSection: grouped accordion + add/remove UI
      backtest-panel/
        index.tsx       # BacktestPanel: form + result chart
    features/
      fetch-stock-chart/
        use-stock-chart.ts   # hook: calls api-client, returns { bars, loading, error }
      fetch-indicators/
        use-indicators.ts    # hook: calls api-client, returns { points, loading, error }
      add-to-watchlist/
        use-add-stock.ts     # hook: POST /api/watchlist/stocks
      remove-from-watchlist/
        use-remove-stock.ts  # hook: DELETE /api/watchlist/stocks/{id}
      manage-groups/
        use-groups.ts        # hook: group CRUD + batch add
      run-backtest/
        use-backtest.ts      # hook: POST /api/backtest
    entities/
      stock/
        types.ts        # re-exports from api-client, adds UI-specific derived types
      watchlist/
        types.ts        # Group, WatchlistStock with UI state
      backtest/
        types.ts        # BacktestResult with derived display fields
    shared/
      api/
        base.ts         # base fetch wrapper (handles errors, JSON parse)
      lib/
        format.ts       # formatPrice, formatPercent, formatDate
      ui/
        atoms/
          button.tsx        # shadcn Button re-export + variants
          input.tsx         # shadcn Input re-export
          badge.tsx         # shadcn Badge re-export
          skeleton.tsx      # shadcn Skeleton re-export
        molecules/
          search-input.tsx  # Input + search icon + clear button
          price-tag.tsx     # price + colored change percent
          stat-card.tsx     # label + value card (for stock info)
        organisms/
          candlestick-chart.tsx   # lightweight-charts IChartApi wrapper
          watchlist-table.tsx     # accordion group list with stocks

backend/
  requirements.txt
  main.py               # FastAPI app, CORS, include routers
  db.py                 # SQLite connection + table creation
  api/
    stock.py            # GET /api/stock/{id}/history, /indicators, /info
    watchlist.py        # all /api/watchlist/* routes
    backtest.py         # POST /api/backtest
  services/
    fetcher.py          # download_history(symbol, period) → list[OHLCVBar]
    indicators.py       # calc_bias(df, n) → list[IndicatorPoint]
    backtest.py         # run_backtest(symbol, start, end, params) → BacktestResult
```

---

## Task 1: Monorepo + Backend Foundation

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `packages/tsconfig/base.json`
- Create: `packages/tsconfig/package.json`
- Create: `backend/requirements.txt`
- Create: `backend/main.py`
- Create: `backend/db.py`

**Interfaces:**
- Produces: running FastAPI at `http://localhost:8000`, SQLite at `backend/stock.db`

- [ ] **Step 1: Create pnpm-workspace.yaml**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 2: Create packages/tsconfig/package.json**

```json
{
  "name": "@taiwan-stock/tsconfig",
  "version": "0.0.0",
  "private": true,
  "files": ["base.json"]
}
```

- [ ] **Step 3: Create packages/tsconfig/base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "jsx": "react-jsx"
  }
}
```

- [ ] **Step 4: Create backend/requirements.txt**

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
yfinance==0.2.40
pandas==2.2.2
```

- [ ] **Step 5: Install Python deps**

```bash
cd backend
pip install -r requirements.txt
```

- [ ] **Step 6: Create backend/db.py**

```python
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "stock.db"

def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db() -> None:
    with get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS groups (
                id      INTEGER PRIMARY KEY AUTOINCREMENT,
                name    TEXT    NOT NULL UNIQUE,
                "order" INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS stocks (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol     TEXT    NOT NULL,
                group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
                added_at   TEXT    NOT NULL DEFAULT (datetime('now')),
                UNIQUE(symbol, group_id)
            );
        """)
```

- [ ] **Step 7: Create backend/main.py**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db import init_db

app = FastAPI(title="Taiwan Stock API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()

@app.get("/api/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 8: Verify backend starts**

```bash
cd backend
uvicorn main:app --reload
```

Open `http://localhost:8000/api/health` — expected: `{"status":"ok"}`

- [ ] **Step 9: Commit**

```bash
git add pnpm-workspace.yaml packages/tsconfig backend/
git commit -m "feat: monorepo scaffold + FastAPI backend foundation"
```

---

## Task 2: Backend — Stock Data Service

**Files:**
- Create: `backend/services/fetcher.py`
- Create: `backend/services/indicators.py`
- Create: `backend/api/stock.py`
- Modify: `backend/main.py`

**Interfaces:**
- Produces:
  - `GET /api/stock/{id}/history?period=3mo` → `[{time, open, high, low, close, volume}]`
  - `GET /api/stock/{id}/indicators?type=bias&n=20` → `[{time, value}]`
  - `GET /api/stock/{id}/info` → `{symbol, name, close, change_pct}`

- [ ] **Step 1: Create backend/services/fetcher.py**

```python
import yfinance as yf
import pandas as pd
from typing import Any

def download_history(symbol: str, period: str) -> list[dict[str, Any]]:
    df = yf.download(f"{symbol}.TW", period=period, auto_adjust=True, progress=False)
    if df.empty:
        return []
    df = df.reset_index()
    return [
        {
            "time": row["Date"].strftime("%Y-%m-%d"),
            "open": float(row["Open"]),
            "high": float(row["High"]),
            "low": float(row["Low"]),
            "close": float(row["Close"]),
            "volume": int(row["Volume"]),
        }
        for _, row in df.iterrows()
    ]

def get_stock_info(symbol: str) -> dict[str, Any] | None:
    bars = download_history(symbol, "5d")
    if len(bars) < 2:
        return None
    latest = bars[-1]
    prev_close = bars[-2]["close"]
    change_pct = (latest["close"] - prev_close) / prev_close * 100
    ticker = yf.Ticker(f"{symbol}.TW")
    name = ticker.info.get("longName") or ticker.info.get("shortName") or symbol
    return {
        "symbol": symbol,
        "name": name,
        "close": latest["close"],
        "change_pct": round(change_pct, 2),
    }
```

- [ ] **Step 2: Create backend/services/indicators.py**

```python
import pandas as pd
from typing import Any

def calc_bias(bars: list[dict[str, Any]], n: int) -> list[dict[str, Any]]:
    if not bars:
        return []
    df = pd.DataFrame(bars)
    df["ma"] = df["close"].rolling(window=n).mean()
    df["bias"] = (df["close"] - df["ma"]) / df["ma"] * 100
    df = df.dropna(subset=["bias"])
    return [
        {"time": row["time"], "value": round(row["bias"], 4)}
        for _, row in df.iterrows()
    ]
```

- [ ] **Step 3: Create backend/api/stock.py**

```python
from fastapi import APIRouter, HTTPException, Query
from services.fetcher import download_history, get_stock_info
from services.indicators import calc_bias

router = APIRouter(prefix="/api/stock")

VALID_PERIODS = {"1mo", "3mo", "6mo", "1y", "2y", "5y"}
VALID_N = {5, 10, 20, 60}

@router.get("/{symbol}/history")
def get_history(symbol: str, period: str = Query(default="3mo")):
    if period not in VALID_PERIODS:
        raise HTTPException(400, f"period must be one of {VALID_PERIODS}")
    bars = download_history(symbol, period)
    if not bars:
        raise HTTPException(404, f"No data for {symbol}")
    return bars

@router.get("/{symbol}/indicators")
def get_indicators(
    symbol: str,
    type: str = Query(default="bias"),
    n: int = Query(default=20),
    period: str = Query(default="1y"),
):
    if type != "bias":
        raise HTTPException(400, "Only type=bias is supported")
    if n not in VALID_N:
        raise HTTPException(400, f"n must be one of {VALID_N}")
    bars = download_history(symbol, period)
    if not bars:
        raise HTTPException(404, f"No data for {symbol}")
    return calc_bias(bars, n)

@router.get("/{symbol}/info")
def get_info(symbol: str):
    info = get_stock_info(symbol)
    if not info:
        raise HTTPException(404, f"No data for {symbol}")
    return info
```

- [ ] **Step 4: Register router in backend/main.py**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from db import init_db
from api.stock import router as stock_router

app = FastAPI(title="Taiwan Stock API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    init_db()

app.include_router(stock_router)

@app.get("/api/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 5: Verify endpoints**

```bash
cd backend && uvicorn main:app --reload
curl "http://localhost:8000/api/stock/2330/history?period=1mo"
curl "http://localhost:8000/api/stock/2330/indicators?type=bias&n=20&period=1y"
curl "http://localhost:8000/api/stock/2330/info"
```

Expected: JSON arrays / object with real TSMC data.

- [ ] **Step 6: Commit**

```bash
git add backend/
git commit -m "feat: stock history, indicators, and info API endpoints"
```

---

## Task 3: Backend — Watchlist API

**Files:**
- Create: `backend/api/watchlist.py`
- Modify: `backend/main.py`

**Interfaces:**
- Produces: all `/api/watchlist/*` endpoints per spec

- [ ] **Step 1: Create backend/api/watchlist.py**

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db import get_conn

router = APIRouter(prefix="/api/watchlist")

class GroupCreate(BaseModel):
    name: str

class GroupRename(BaseModel):
    name: str

class StockAdd(BaseModel):
    symbol: str
    group_id: int

class StockBatchItem(BaseModel):
    symbol: str
    group: str

class StockBatch(BaseModel):
    stocks: list[StockBatchItem]

class StockMove(BaseModel):
    group_id: int


@router.get("")
def get_watchlist():
    with get_conn() as conn:
        groups = conn.execute(
            'SELECT id, name, "order" FROM groups ORDER BY "order", id'
        ).fetchall()
        result = []
        for g in groups:
            stocks = conn.execute(
                "SELECT id, symbol, added_at FROM stocks WHERE group_id = ? ORDER BY added_at",
                (g["id"],),
            ).fetchall()
            result.append({
                "id": g["id"],
                "name": g["name"],
                "order": g["order"],
                "stocks": [dict(s) for s in stocks],
            })
        return result


@router.post("/groups", status_code=201)
def create_group(body: GroupCreate):
    with get_conn() as conn:
        try:
            cur = conn.execute(
                'INSERT INTO groups (name, "order") VALUES (?, (SELECT COALESCE(MAX("order"),0)+1 FROM groups))',
                (body.name,),
            )
            return {"id": cur.lastrowid, "name": body.name}
        except Exception:
            raise HTTPException(409, f"Group '{body.name}' already exists")


@router.patch("/groups/{group_id}")
def rename_group(group_id: int, body: GroupRename):
    with get_conn() as conn:
        conn.execute("UPDATE groups SET name = ? WHERE id = ?", (body.name, group_id))
        return {"id": group_id, "name": body.name}


@router.delete("/groups/{group_id}", status_code=204)
def delete_group(group_id: int):
    with get_conn() as conn:
        conn.execute("DELETE FROM groups WHERE id = ?", (group_id,))


@router.post("/stocks", status_code=201)
def add_stock(body: StockAdd):
    with get_conn() as conn:
        try:
            cur = conn.execute(
                "INSERT INTO stocks (symbol, group_id) VALUES (?, ?)",
                (body.symbol, body.group_id),
            )
            return {"id": cur.lastrowid, "symbol": body.symbol, "group_id": body.group_id}
        except Exception:
            raise HTTPException(409, f"Stock '{body.symbol}' already in group")


@router.post("/stocks/batch", status_code=201)
def batch_add_stocks(body: StockBatch):
    added = []
    with get_conn() as conn:
        for item in body.stocks:
            row = conn.execute("SELECT id FROM groups WHERE name = ?", (item.group,)).fetchone()
            if row is None:
                cur = conn.execute(
                    'INSERT INTO groups (name, "order") VALUES (?, (SELECT COALESCE(MAX("order"),0)+1 FROM groups))',
                    (item.group,),
                )
                group_id = cur.lastrowid
            else:
                group_id = row["id"]
            try:
                cur = conn.execute(
                    "INSERT INTO stocks (symbol, group_id) VALUES (?, ?)",
                    (item.symbol, group_id),
                )
                added.append({"id": cur.lastrowid, "symbol": item.symbol, "group_id": group_id})
            except Exception:
                pass  # duplicate — ignore per spec
    return {"added": added}


@router.delete("/stocks/{stock_id}", status_code=204)
def remove_stock(stock_id: int):
    with get_conn() as conn:
        conn.execute("DELETE FROM stocks WHERE id = ?", (stock_id,))


@router.patch("/stocks/{stock_id}")
def move_stock(stock_id: int, body: StockMove):
    with get_conn() as conn:
        conn.execute("UPDATE stocks SET group_id = ? WHERE id = ?", (body.group_id, stock_id))
        return {"id": stock_id, "group_id": body.group_id}
```

- [ ] **Step 2: Register watchlist router in backend/main.py**

Add after `from api.stock import router as stock_router`:
```python
from api.watchlist import router as watchlist_router
```
Add after `app.include_router(stock_router)`:
```python
app.include_router(watchlist_router)
```

- [ ] **Step 3: Verify watchlist endpoints**

```bash
curl -X POST http://localhost:8000/api/watchlist/groups -H "Content-Type: application/json" -d '{"name":"半導體"}'
curl -X POST http://localhost:8000/api/watchlist/stocks/batch -H "Content-Type: application/json" \
  -d '{"stocks":[{"symbol":"2330","group":"半導體"},{"symbol":"2454","group":"半導體"},{"symbol":"2882","group":"金融股"}]}'
curl http://localhost:8000/api/watchlist
```

Expected: GET returns two groups with stocks nested inside.

- [ ] **Step 4: Commit**

```bash
git add backend/
git commit -m "feat: watchlist groups and stocks CRUD + batch add API"
```

---

## Task 4: Backend — Backtest API

**Files:**
- Create: `backend/services/backtest.py`
- Create: `backend/api/backtest.py`
- Modify: `backend/main.py`

**Interfaces:**
- Produces: `POST /api/backtest` → `{trades, total_return_pct, trade_count, equity_curve}`

- [ ] **Step 1: Create backend/services/backtest.py**

```python
from typing import Any
from services.fetcher import download_history
from services.indicators import calc_bias

def run_backtest(
    symbol: str,
    start: str,
    end: str,
    buy_threshold: float,
    sell_threshold: float,
    n: int,
) -> dict[str, Any]:
    bars = download_history(symbol, "5y")
    bars = [b for b in bars if start <= b["time"] <= end]
    bias_points = calc_bias(bars, n)
    bias_map = {p["time"]: p["value"] for p in bias_points}

    position = None
    trades = []
    equity = 1.0
    equity_curve = []

    for bar in bars:
        t = bar["time"]
        bias = bias_map.get(t)
        if bias is None:
            equity_curve.append({"time": t, "value": round(equity, 6)})
            continue

        if position is None and bias <= buy_threshold:
            position = {"buy_price": bar["close"], "buy_time": t}
        elif position is not None and bias >= sell_threshold:
            ret = (bar["close"] - position["buy_price"]) / position["buy_price"]
            equity *= 1 + ret
            trades.append({
                "buy_time": position["buy_time"],
                "buy_price": position["buy_price"],
                "sell_time": t,
                "sell_price": bar["close"],
                "return_pct": round(ret * 100, 2),
            })
            position = None

        equity_curve.append({"time": t, "value": round(equity, 6)})

    total_return_pct = round((equity - 1) * 100, 2)
    return {
        "trades": trades,
        "trade_count": len(trades),
        "total_return_pct": total_return_pct,
        "equity_curve": equity_curve,
    }
```

- [ ] **Step 2: Create backend/api/backtest.py**

```python
from fastapi import APIRouter
from pydantic import BaseModel
from services.backtest import run_backtest

router = APIRouter(prefix="/api")

class BacktestRequest(BaseModel):
    symbol: str
    start: str
    end: str
    buy_threshold: float = -5.0
    sell_threshold: float = 5.0
    n: int = 20

@router.post("/backtest")
def backtest(body: BacktestRequest):
    return run_backtest(
        body.symbol, body.start, body.end,
        body.buy_threshold, body.sell_threshold, body.n,
    )
```

- [ ] **Step 3: Register in backend/main.py**

```python
from api.backtest import router as backtest_router
# ...
app.include_router(backtest_router)
```

- [ ] **Step 4: Verify**

```bash
curl -X POST http://localhost:8000/api/backtest \
  -H "Content-Type: application/json" \
  -d '{"symbol":"2330","start":"2023-01-01","end":"2024-12-31","buy_threshold":-5,"sell_threshold":5,"n":20}'
```

Expected: JSON with `trades`, `trade_count`, `total_return_pct`, `equity_curve`.

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat: bias ratio backtest engine and API"
```

---

## Task 5: packages/api-client — Zod Schemas + Typed Client

**Files:**
- Create: `packages/api-client/package.json`
- Create: `packages/api-client/src/schemas/stock.ts`
- Create: `packages/api-client/src/schemas/watchlist.ts`
- Create: `packages/api-client/src/schemas/backtest.ts`
- Create: `packages/api-client/src/client.ts`
- Create: `packages/api-client/src/index.ts`

**Interfaces:**
- Produces: typed functions `getStockHistory`, `getStockIndicators`, `getStockInfo`, `getWatchlist`, `createGroup`, `renameGroup`, `deleteGroup`, `addStock`, `batchAddStocks`, `removeStock`, `moveStock`, `runBacktest`

- [ ] **Step 1: Create packages/api-client/package.json**

```json
{
  "name": "@taiwan-stock/api-client",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@taiwan-stock/tsconfig": "workspace:*",
    "typescript": "^5.4.5"
  }
}
```

- [ ] **Step 2: Create packages/api-client/src/schemas/stock.ts**

```typescript
import { z } from "zod";

export const OHLCVBarSchema = z.object({
  time: z.string(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
});
export type OHLCVBar = z.infer<typeof OHLCVBarSchema>;

export const IndicatorPointSchema = z.object({
  time: z.string(),
  value: z.number(),
});
export type IndicatorPoint = z.infer<typeof IndicatorPointSchema>;

export const StockInfoSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  close: z.number(),
  change_pct: z.number(),
});
export type StockInfo = z.infer<typeof StockInfoSchema>;
```

- [ ] **Step 3: Create packages/api-client/src/schemas/watchlist.ts**

```typescript
import { z } from "zod";

export const WatchlistStockSchema = z.object({
  id: z.number(),
  symbol: z.string(),
  added_at: z.string(),
});
export type WatchlistStock = z.infer<typeof WatchlistStockSchema>;

export const GroupSchema = z.object({
  id: z.number(),
  name: z.string(),
  order: z.number(),
  stocks: z.array(WatchlistStockSchema),
});
export type Group = z.infer<typeof GroupSchema>;

export const BatchAddItemSchema = z.object({
  symbol: z.string(),
  group: z.string(),
});
export type BatchAddItem = z.infer<typeof BatchAddItemSchema>;
```

- [ ] **Step 4: Create packages/api-client/src/schemas/backtest.ts**

```typescript
import { z } from "zod";

export const TradeSchema = z.object({
  buy_time: z.string(),
  buy_price: z.number(),
  sell_time: z.string(),
  sell_price: z.number(),
  return_pct: z.number(),
});

export const EquityPointSchema = z.object({
  time: z.string(),
  value: z.number(),
});

export const BacktestResultSchema = z.object({
  trades: z.array(TradeSchema),
  trade_count: z.number(),
  total_return_pct: z.number(),
  equity_curve: z.array(EquityPointSchema),
});
export type BacktestResult = z.infer<typeof BacktestResultSchema>;

export const BacktestRequestSchema = z.object({
  symbol: z.string(),
  start: z.string(),
  end: z.string(),
  buy_threshold: z.number().default(-5),
  sell_threshold: z.number().default(5),
  n: z.number().default(20),
});
export type BacktestRequest = z.infer<typeof BacktestRequestSchema>;
```

- [ ] **Step 5: Create packages/api-client/src/client.ts**

```typescript
import { z } from "zod";
import {
  OHLCVBarSchema, OHLCVBar,
  IndicatorPointSchema, IndicatorPoint,
  StockInfoSchema, StockInfo,
} from "./schemas/stock";
import { GroupSchema, Group, BatchAddItem } from "./schemas/watchlist";
import { BacktestRequest, BacktestResult, BacktestResultSchema } from "./schemas/backtest";

const BASE = "http://localhost:8000/api";

async function apiFetch<T>(schema: z.ZodType<T>, url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`API error ${res.status}: ${url}`);
  return schema.parse(await res.json());
}

export const getStockHistory = (symbol: string, period = "3mo"): Promise<OHLCVBar[]> =>
  apiFetch(z.array(OHLCVBarSchema), `${BASE}/stock/${symbol}/history?period=${period}`);

export const getStockIndicators = (symbol: string, n = 20, period = "1y"): Promise<IndicatorPoint[]> =>
  apiFetch(z.array(IndicatorPointSchema), `${BASE}/stock/${symbol}/indicators?type=bias&n=${n}&period=${period}`);

export const getStockInfo = (symbol: string): Promise<StockInfo> =>
  apiFetch(StockInfoSchema, `${BASE}/stock/${symbol}/info`);

export const getWatchlist = (): Promise<Group[]> =>
  apiFetch(z.array(GroupSchema), `${BASE}/watchlist`);

export const createGroup = (name: string): Promise<{ id: number; name: string }> =>
  apiFetch(z.object({ id: z.number(), name: z.string() }), `${BASE}/watchlist/groups`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

export const renameGroup = (groupId: number, name: string) =>
  apiFetch(z.object({ id: z.number(), name: z.string() }), `${BASE}/watchlist/groups/${groupId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

export const deleteGroup = async (groupId: number): Promise<void> => {
  const res = await fetch(`${BASE}/watchlist/groups/${groupId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`API error ${res.status}`);
};

export const addStock = (symbol: string, groupId: number) =>
  apiFetch(z.object({ id: z.number(), symbol: z.string(), group_id: z.number() }),
    `${BASE}/watchlist/stocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, group_id: groupId }),
    });

export const batchAddStocks = (stocks: BatchAddItem[]) =>
  apiFetch(z.object({ added: z.array(z.object({ id: z.number(), symbol: z.string(), group_id: z.number() })) }),
    `${BASE}/watchlist/stocks/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stocks }),
    });

export const removeStock = async (stockId: number): Promise<void> => {
  const res = await fetch(`${BASE}/watchlist/stocks/${stockId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`API error ${res.status}`);
};

export const moveStock = (stockId: number, groupId: number) =>
  apiFetch(z.object({ id: z.number(), group_id: z.number() }),
    `${BASE}/watchlist/stocks/${stockId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_id: groupId }),
    });

export const runBacktest = (req: BacktestRequest): Promise<BacktestResult> =>
  apiFetch(BacktestResultSchema, `${BASE}/backtest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
```

- [ ] **Step 6: Create packages/api-client/src/index.ts**

```typescript
export * from "./schemas/stock";
export * from "./schemas/watchlist";
export * from "./schemas/backtest";
export * from "./client";
```

- [ ] **Step 7: Install pnpm at root and install deps**

```bash
pnpm install
```

- [ ] **Step 8: Commit**

```bash
git add packages/api-client/ pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat: typed API client package with zod schemas"
```

---

## Task 6: apps/web — Vite + TanStack Router + FSD Scaffold

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.js`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/index.html`
- Create: `apps/web/src/app/main.tsx`
- Create: `apps/web/src/app/router.tsx`
- Create: `apps/web/src/pages/home/index.tsx`
- Create: `apps/web/src/pages/stock/index.tsx`
- Create: `apps/web/src/pages/backtest/index.tsx`

**Interfaces:**
- Produces: React app running at `http://localhost:5173` with three routes

- [ ] **Step 1: Create apps/web/package.json**

```json
{
  "name": "@taiwan-stock/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@taiwan-stock/api-client": "workspace:*",
    "@tanstack/react-router": "^1.43.0",
    "lightweight-charts": "^4.2.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@taiwan-stock/tsconfig": "workspace:*",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.4",
    "typescript": "^5.4.5",
    "vite": "^5.3.1"
  }
}
```

- [ ] **Step 2: Create apps/web/tsconfig.json**

```json
{
  "extends": "@taiwan-stock/tsconfig/base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create apps/web/vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
```

- [ ] **Step 4: Create apps/web/postcss.config.js**

```js
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 5: Create apps/web/tailwind.config.ts**

```typescript
import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 6: Create apps/web/index.html**

```html
<!doctype html>
<html lang="zh-TW">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>台股分析平台</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/app/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create apps/web/src/app/router.tsx**

```typescript
import { createRouter, createRoute, createRootRoute, Outlet } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const HomPage = lazy(() => import("@/pages/home"));
const StockPage = lazy(() => import("@/pages/stock"));
const BacktestPage = lazy(() => import("@/pages/backtest"));

const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-background text-foreground">
      <Suspense fallback={<div className="p-8 text-center">載入中…</div>}>
        <Outlet />
      </Suspense>
    </div>
  ),
});

const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: HomPage });
const stockRoute = createRoute({ getParentRoute: () => rootRoute, path: "/stock/$id", component: StockPage });
const backtestRoute = createRoute({ getParentRoute: () => rootRoute, path: "/backtest", component: BacktestPage });

const routeTree = rootRoute.addChildren([homeRoute, stockRoute, backtestRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register { router: typeof router }
}
```

- [ ] **Step 8: Create apps/web/src/app/main.tsx**

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
```

- [ ] **Step 9: Create apps/web/src/app/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 10: Create stub pages**

`apps/web/src/pages/home/index.tsx`:
```typescript
export default function HomePage() {
  return <div className="p-8"><h1 className="text-2xl font-bold">自選股</h1></div>;
}
```

`apps/web/src/pages/stock/index.tsx`:
```typescript
import { useParams } from "@tanstack/react-router";
export default function StockPage() {
  const { id } = useParams({ from: "/stock/$id" });
  return <div className="p-8"><h1 className="text-2xl font-bold">股票：{id}</h1></div>;
}
```

`apps/web/src/pages/backtest/index.tsx`:
```typescript
export default function BacktestPage() {
  return <div className="p-8"><h1 className="text-2xl font-bold">回測</h1></div>;
}
```

- [ ] **Step 11: Install deps and run**

```bash
pnpm install
cd apps/web && pnpm dev
```

Open `http://localhost:5173` — expected: "自選股" heading, no errors in console.

- [ ] **Step 12: Commit**

```bash
git add apps/web/ pnpm-lock.yaml
git commit -m "feat: React app scaffold with Vite, TanStack Router, Tailwind, FSD structure"
```

---

## Task 7: shared/ui — Atoms + Molecules + Organisms

**Files:**
- Create: `apps/web/src/shared/ui/atoms/button.tsx`
- Create: `apps/web/src/shared/ui/atoms/input.tsx`
- Create: `apps/web/src/shared/ui/atoms/badge.tsx`
- Create: `apps/web/src/shared/ui/atoms/skeleton.tsx`
- Create: `apps/web/src/shared/ui/molecules/search-input.tsx`
- Create: `apps/web/src/shared/ui/molecules/price-tag.tsx`
- Create: `apps/web/src/shared/ui/molecules/stat-card.tsx`
- Create: `apps/web/src/shared/ui/organisms/candlestick-chart.tsx`
- Create: `apps/web/src/shared/ui/organisms/watchlist-table.tsx`
- Create: `apps/web/src/shared/lib/format.ts`

**Interfaces:**
- Produces:
  - `<Button>`, `<Input>`, `<Badge>`, `<Skeleton>`
  - `<SearchInput onSearch(q:string)>`, `<PriceTag price close changePct>`, `<StatCard label value>`
  - `<CandlestickChart bars={OHLCVBar[]} biasPoints={IndicatorPoint[]} biasN={number}>`
  - `<WatchlistTable groups={Group[]} onStockClick onRemoveStock onRemoveGroup onAddStock onRenameGroup>`
  - `formatPrice(n: number): string`, `formatPercent(n: number): string`

- [ ] **Step 1: Install shadcn/ui**

```bash
cd apps/web
pnpm dlx shadcn@latest init
```

When prompted: style=default, base color=slate, CSS variables=yes.

Then add components:
```bash
pnpm dlx shadcn@latest add button input badge skeleton
```

- [ ] **Step 2: Create apps/web/src/shared/lib/format.ts**

```typescript
export function formatPrice(n: number): string {
  return n.toLocaleString("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatPercent(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}
```

- [ ] **Step 3: Create atoms (re-export shadcn)**

`apps/web/src/shared/ui/atoms/button.tsx`:
```typescript
export { Button } from "@/components/ui/button";
export type { ButtonProps } from "@/components/ui/button";
```

`apps/web/src/shared/ui/atoms/input.tsx`:
```typescript
export { Input } from "@/components/ui/input";
```

`apps/web/src/shared/ui/atoms/badge.tsx`:
```typescript
export { Badge } from "@/components/ui/badge";
```

`apps/web/src/shared/ui/atoms/skeleton.tsx`:
```typescript
export { Skeleton } from "@/components/ui/skeleton";
```

- [ ] **Step 4: Create apps/web/src/shared/ui/molecules/search-input.tsx**

```typescript
import { useState } from "react";
import { Input } from "../atoms/input";
import { Button } from "../atoms/button";

interface Props {
  placeholder?: string;
  onSearch: (query: string) => void;
}

export function SearchInput({ placeholder = "輸入股票代碼…", onSearch }: Props) {
  const [value, setValue] = useState("");
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && value.trim()) {
      onSearch(value.trim().toUpperCase());
      setValue("");
    }
  }
  return (
    <div className="flex gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
      />
      <Button
        onClick={() => { if (value.trim()) { onSearch(value.trim().toUpperCase()); setValue(""); } }}
      >
        新增
      </Button>
    </div>
  );
}
```

- [ ] **Step 5: Create apps/web/src/shared/ui/molecules/price-tag.tsx**

```typescript
import { formatPrice, formatPercent } from "@/shared/lib/format";

interface Props {
  price: number;
  changePct: number;
}

export function PriceTag({ price, changePct }: Props) {
  const isUp = changePct >= 0;
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-lg font-semibold">{formatPrice(price)}</span>
      <span className={isUp ? "text-red-500 text-sm" : "text-green-500 text-sm"}>
        {formatPercent(changePct)}
      </span>
    </div>
  );
}
```

- [ ] **Step 6: Create apps/web/src/shared/ui/molecules/stat-card.tsx**

```typescript
interface Props {
  label: string;
  value: string | number;
}

export function StatCard({ label, value }: Props) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-medium">{value}</p>
    </div>
  );
}
```

- [ ] **Step 7: Create apps/web/src/shared/ui/organisms/candlestick-chart.tsx**

```typescript
import { useEffect, useRef } from "react";
import {
  createChart,
  IChartApi,
  CandlestickData,
  LineData,
  ColorType,
} from "lightweight-charts";
import type { OHLCVBar, IndicatorPoint } from "@taiwan-stock/api-client";

interface Props {
  bars: OHLCVBar[];
  biasPoints: IndicatorPoint[];
  biasN: number;
}

export function CandlestickChart({ bars, biasPoints, biasN }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: "#09090b" }, textColor: "#e4e4e7" },
      grid: { vertLines: { color: "#27272a" }, horzLines: { color: "#27272a" } },
      width: containerRef.current.clientWidth,
      height: 400,
    });
    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#ef4444",
      downColor: "#22c55e",
      borderUpColor: "#ef4444",
      borderDownColor: "#22c55e",
      wickUpColor: "#ef4444",
      wickDownColor: "#22c55e",
    });
    candleSeries.setData(bars as CandlestickData[]);

    // Bias sub-chart pane
    const biasSeries = chart.addLineSeries({
      color: "#f59e0b",
      lineWidth: 1,
      title: `乖離率 ${biasN}日`,
      pane: 1,
    });
    biasSeries.setData(biasPoints as LineData[]);

    chart.timeScale().fitContent();

    const observer = new ResizeObserver(() => {
      if (containerRef.current) chart.resize(containerRef.current.clientWidth, 400);
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [bars, biasPoints, biasN]);

  return <div ref={containerRef} className="w-full" />;
}
```

- [ ] **Step 8: Create apps/web/src/shared/ui/organisms/watchlist-table.tsx**

```typescript
import { useState } from "react";
import type { Group } from "@taiwan-stock/api-client";
import { Button } from "../atoms/button";
import { Badge } from "../atoms/badge";

interface Props {
  groups: Group[];
  onStockClick: (symbol: string) => void;
  onRemoveStock: (stockId: number) => void;
  onRemoveGroup: (groupId: number) => void;
  onAddStock: (symbol: string, groupId: number) => void;
  onRenameGroup: (groupId: number, name: string) => void;
}

export function WatchlistTable({
  groups, onStockClick, onRemoveStock, onRemoveGroup, onAddStock, onRenameGroup,
}: Props) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const toggle = (id: number) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  return (
    <div className="space-y-2">
      {groups.map((group) => (
        <div key={group.id} className="rounded-lg border">
          <button
            className="flex w-full items-center justify-between px-4 py-3 font-medium hover:bg-muted/50"
            onClick={() => toggle(group.id)}
          >
            <span>{group.name}</span>
            <Badge variant="secondary">{group.stocks.length}</Badge>
          </button>
          {expanded[group.id] && (
            <div className="border-t">
              {group.stocks.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-4 py-2 hover:bg-muted/30">
                  <button className="text-sm font-mono" onClick={() => onStockClick(s.symbol)}>
                    {s.symbol}
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemoveStock(s.id)}
                  >
                    移除
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/shared/
git commit -m "feat: shared/ui atoms, molecules, organisms + format utils"
```

---

## Task 8: Feature Hooks + Entities

**Files:**
- Create: `apps/web/src/entities/stock/types.ts`
- Create: `apps/web/src/entities/watchlist/types.ts`
- Create: `apps/web/src/features/fetch-stock-chart/use-stock-chart.ts`
- Create: `apps/web/src/features/fetch-indicators/use-indicators.ts`
- Create: `apps/web/src/features/add-to-watchlist/use-add-stock.ts`
- Create: `apps/web/src/features/remove-from-watchlist/use-remove-stock.ts`
- Create: `apps/web/src/features/manage-groups/use-groups.ts`

**Interfaces:**
- Produces: hooks that wrap api-client calls with `{ data, loading, error }` pattern

- [ ] **Step 1: Create entities**

`apps/web/src/entities/stock/types.ts`:
```typescript
export type { OHLCVBar, IndicatorPoint, StockInfo } from "@taiwan-stock/api-client";
```

`apps/web/src/entities/watchlist/types.ts`:
```typescript
export type { Group, WatchlistStock } from "@taiwan-stock/api-client";
```

- [ ] **Step 2: Create apps/web/src/features/fetch-stock-chart/use-stock-chart.ts**

```typescript
import { useState, useEffect } from "react";
import { getStockHistory } from "@taiwan-stock/api-client";
import type { OHLCVBar } from "@taiwan-stock/api-client";

export function useStockChart(symbol: string, period: string) {
  const [bars, setBars] = useState<OHLCVBar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    getStockHistory(symbol, period)
      .then(setBars)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [symbol, period]);

  return { bars, loading, error };
}
```

- [ ] **Step 3: Create apps/web/src/features/fetch-indicators/use-indicators.ts**

```typescript
import { useState, useEffect } from "react";
import { getStockIndicators } from "@taiwan-stock/api-client";
import type { IndicatorPoint } from "@taiwan-stock/api-client";

export function useIndicators(symbol: string, n: number, period: string) {
  const [points, setPoints] = useState<IndicatorPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    getStockIndicators(symbol, n, period)
      .then(setPoints)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [symbol, n, period]);

  return { points, loading, error };
}
```

- [ ] **Step 4: Create apps/web/src/features/manage-groups/use-groups.ts**

```typescript
import { useState, useEffect, useCallback } from "react";
import {
  getWatchlist, createGroup, renameGroup, deleteGroup,
  addStock, batchAddStocks, removeStock, moveStock,
} from "@taiwan-stock/api-client";
import type { Group, BatchAddItem } from "@taiwan-stock/api-client";

export function useGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    getWatchlist().then(setGroups).finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return {
    groups,
    loading,
    refresh,
    createGroup: (name: string) => createGroup(name).then(refresh),
    renameGroup: (id: number, name: string) => renameGroup(id, name).then(refresh),
    deleteGroup: (id: number) => deleteGroup(id).then(refresh),
    addStock: (symbol: string, groupId: number) => addStock(symbol, groupId).then(refresh),
    batchAddStocks: (stocks: BatchAddItem[]) => batchAddStocks(stocks).then(refresh),
    removeStock: (id: number) => removeStock(id).then(refresh),
    moveStock: (id: number, groupId: number) => moveStock(id, groupId).then(refresh),
  };
}
```

- [ ] **Step 5: Create remaining feature hooks**

`apps/web/src/features/add-to-watchlist/use-add-stock.ts`:
```typescript
export { useGroups } from "../manage-groups/use-groups";
// add-to-watchlist delegates to useGroups.addStock
```

`apps/web/src/features/remove-from-watchlist/use-remove-stock.ts`:
```typescript
export { useGroups } from "../manage-groups/use-groups";
// remove-from-watchlist delegates to useGroups.removeStock
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/entities/ apps/web/src/features/
git commit -m "feat: entity types and feature hooks (stock chart, indicators, watchlist groups)"
```

---

## Task 9: Widgets + Pages

**Files:**
- Create: `apps/web/src/widgets/chart-panel/index.tsx`
- Create: `apps/web/src/widgets/watchlist-section/index.tsx`
- Modify: `apps/web/src/pages/home/index.tsx`
- Modify: `apps/web/src/pages/stock/index.tsx`

**Interfaces:**
- Consumes: all feature hooks and shared/ui organisms

- [ ] **Step 1: Create apps/web/src/widgets/chart-panel/index.tsx**

```typescript
import { useState } from "react";
import { CandlestickChart } from "@/shared/ui/organisms/candlestick-chart";
import { StatCard } from "@/shared/ui/molecules/stat-card";
import { Button } from "@/shared/ui/atoms/button";
import { useStockChart } from "@/features/fetch-stock-chart/use-stock-chart";
import { useIndicators } from "@/features/fetch-indicators/use-indicators";
import { Skeleton } from "@/shared/ui/atoms/skeleton";
import { formatPrice, formatPercent } from "@/shared/lib/format";

const PERIODS = ["1mo", "3mo", "6mo", "1y", "2y", "5y"] as const;
const BIAS_NS = [5, 10, 20, 60] as const;

interface Props { symbol: string }

export function ChartPanel({ symbol }: Props) {
  const [period, setPeriod] = useState<string>("3mo");
  const [biasN, setBiasN] = useState<number>(20);

  const { bars, loading: barsLoading } = useStockChart(symbol, period);
  const { points, loading: indLoading } = useIndicators(symbol, biasN, period === "1mo" ? "3mo" : period);

  const latest = bars.at(-1);
  const prev = bars.at(-2);
  const changePct = latest && prev ? (latest.close - prev.close) / prev.close * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="最新收盤" value={latest ? formatPrice(latest.close) : "—"} />
        <StatCard label="漲跌幅" value={latest ? formatPercent(changePct) : "—"} />
        <StatCard label="成交量" value={latest ? latest.volume.toLocaleString() : "—"} />
      </div>

      <div className="flex gap-1">
        {PERIODS.map((p) => (
          <Button key={p} size="sm" variant={period === p ? "default" : "outline"} onClick={() => setPeriod(p)}>
            {p}
          </Button>
        ))}
      </div>

      {barsLoading ? (
        <Skeleton className="h-[400px] w-full" />
      ) : (
        <CandlestickChart bars={bars} biasPoints={points} biasN={biasN} />
      )}

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">乖離率 N =</span>
        {BIAS_NS.map((n) => (
          <Button key={n} size="sm" variant={biasN === n ? "default" : "outline"} onClick={() => setBiasN(n)}>
            {n}
          </Button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create apps/web/src/widgets/watchlist-section/index.tsx**

```typescript
import { useState } from "react";
import { useGroups } from "@/features/manage-groups/use-groups";
import { WatchlistTable } from "@/shared/ui/organisms/watchlist-table";
import { SearchInput } from "@/shared/ui/molecules/search-input";
import { Button } from "@/shared/ui/atoms/button";
import { Input } from "@/shared/ui/atoms/input";
import { useRouter } from "@tanstack/react-router";

export function WatchlistSection() {
  const { groups, createGroup, renameGroup, deleteGroup, addStock, removeStock } = useGroups();
  const router = useRouter();
  const [newGroupName, setNewGroupName] = useState("");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="新分組名稱…"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newGroupName.trim()) {
              createGroup(newGroupName.trim());
              setNewGroupName("");
            }
          }}
        />
        <Button
          onClick={() => { if (newGroupName.trim()) { createGroup(newGroupName.trim()); setNewGroupName(""); } }}
        >
          新增分組
        </Button>
      </div>

      <WatchlistTable
        groups={groups}
        onStockClick={(symbol) => router.navigate({ to: "/stock/$id", params: { id: symbol } })}
        onRemoveStock={removeStock}
        onRemoveGroup={deleteGroup}
        onAddStock={addStock}
        onRenameGroup={renameGroup}
      />
    </div>
  );
}
```

- [ ] **Step 3: Update apps/web/src/pages/home/index.tsx**

```typescript
import { WatchlistSection } from "@/widgets/watchlist-section";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-2xl font-bold">自選股</h1>
      <WatchlistSection />
    </div>
  );
}
```

- [ ] **Step 4: Update apps/web/src/pages/stock/index.tsx**

```typescript
import { useParams, Link } from "@tanstack/react-router";
import { ChartPanel } from "@/widgets/chart-panel";

export default function StockPage() {
  const { id } = useParams({ from: "/stock/$id" });
  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-4 flex items-center gap-4">
        <Link to="/" className="text-sm text-muted-foreground hover:underline">← 自選股</Link>
        <h1 className="text-2xl font-bold font-mono">{id}</h1>
      </div>
      <ChartPanel symbol={id} />
    </div>
  );
}
```

- [ ] **Step 5: Verify full flow**

Start both servers:
```bash
# Terminal 1
cd backend && uvicorn main:app --reload

# Terminal 2
cd apps/web && pnpm dev
```

1. Open `http://localhost:5173`
2. Create a group "半導體", add stock "2330"
3. Click 2330 → navigates to `/stock/2330`
4. K-line chart and bias ratio sub-chart load with real data
5. Toggle period (1mo/3mo/etc.) and N (5/10/20/60) — chart updates

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/widgets/ apps/web/src/pages/
git commit -m "feat: ChartPanel and WatchlistSection widgets, home and stock pages"
```

---

## Task 10: Backtest Page

**Files:**
- Create: `apps/web/src/features/run-backtest/use-backtest.ts`
- Create: `apps/web/src/entities/backtest/types.ts`
- Create: `apps/web/src/widgets/backtest-panel/index.tsx`
- Modify: `apps/web/src/pages/backtest/index.tsx`

**Interfaces:**
- Consumes: `runBacktest` from api-client
- Produces: backtest form + equity curve line chart + trades table

- [ ] **Step 1: Create apps/web/src/entities/backtest/types.ts**

```typescript
export type { BacktestResult, BacktestRequest } from "@taiwan-stock/api-client";
```

- [ ] **Step 2: Create apps/web/src/features/run-backtest/use-backtest.ts**

```typescript
import { useState } from "react";
import { runBacktest } from "@taiwan-stock/api-client";
import type { BacktestResult, BacktestRequest } from "@taiwan-stock/api-client";

export function useBacktest() {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = (req: BacktestRequest) => {
    setLoading(true);
    setError(null);
    runBacktest(req)
      .then(setResult)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  return { result, loading, error, execute };
}
```

- [ ] **Step 3: Create apps/web/src/widgets/backtest-panel/index.tsx**

```typescript
import { useState, useEffect, useRef } from "react";
import { createChart, ColorType, LineData } from "lightweight-charts";
import { useBacktest } from "@/features/run-backtest/use-backtest";
import { Input } from "@/shared/ui/atoms/input";
import { Button } from "@/shared/ui/atoms/button";
import { StatCard } from "@/shared/ui/molecules/stat-card";
import { Skeleton } from "@/shared/ui/atoms/skeleton";
import { formatPercent } from "@/shared/lib/format";

export function BacktestPanel() {
  const { result, loading, error, execute } = useBacktest();
  const [form, setForm] = useState({
    symbol: "2330",
    start: "2022-01-01",
    end: "2024-12-31",
    buy_threshold: -5,
    sell_threshold: 5,
    n: 20,
  });
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!result || !chartRef.current) return;
    const chart = createChart(chartRef.current, {
      layout: { background: { type: ColorType.Solid, color: "#09090b" }, textColor: "#e4e4e7" },
      grid: { vertLines: { color: "#27272a" }, horzLines: { color: "#27272a" } },
      width: chartRef.current.clientWidth,
      height: 300,
    });
    const series = chart.addLineSeries({ color: "#6366f1", lineWidth: 2, title: "淨值曲線" });
    series.setData(result.equity_curve as LineData[]);
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [result]);

  const set = (k: string, v: string | number) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div>
          <label className="text-xs text-muted-foreground">股票代碼</label>
          <Input value={form.symbol} onChange={(e) => set("symbol", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">開始日期</label>
          <Input type="date" value={form.start} onChange={(e) => set("start", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">結束日期</label>
          <Input type="date" value={form.end} onChange={(e) => set("end", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">買入乖離率 ≤</label>
          <Input type="number" value={form.buy_threshold} onChange={(e) => set("buy_threshold", Number(e.target.value))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">賣出乖離率 ≥</label>
          <Input type="number" value={form.sell_threshold} onChange={(e) => set("sell_threshold", Number(e.target.value))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">均線 N 日</label>
          <Input type="number" value={form.n} onChange={(e) => set("n", Number(e.target.value))} />
        </div>
      </div>

      <Button onClick={() => execute(form)} disabled={loading}>
        {loading ? "計算中…" : "執行回測"}
      </Button>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatCard label="總報酬率" value={formatPercent(result.total_return_pct)} />
            <StatCard label="交易次數" value={result.trade_count} />
          </div>

          <div ref={chartRef} className="w-full" />

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="pb-2 text-left">買入日</th>
                  <th className="pb-2 text-right">買入價</th>
                  <th className="pb-2 text-left">賣出日</th>
                  <th className="pb-2 text-right">賣出價</th>
                  <th className="pb-2 text-right">報酬</th>
                </tr>
              </thead>
              <tbody>
                {result.trades.map((t, i) => (
                  <tr key={i} className="border-b hover:bg-muted/30">
                    <td className="py-1">{t.buy_time}</td>
                    <td className="py-1 text-right font-mono">{t.buy_price.toFixed(2)}</td>
                    <td className="py-1">{t.sell_time}</td>
                    <td className="py-1 text-right font-mono">{t.sell_price.toFixed(2)}</td>
                    <td className={`py-1 text-right ${t.return_pct >= 0 ? "text-red-500" : "text-green-500"}`}>
                      {formatPercent(t.return_pct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Update apps/web/src/pages/backtest/index.tsx**

```typescript
import { BacktestPanel } from "@/widgets/backtest-panel";
import { Link } from "@tanstack/react-router";

export default function BacktestPage() {
  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link to="/" className="text-sm text-muted-foreground hover:underline">← 自選股</Link>
        <h1 className="text-2xl font-bold">回測</h1>
      </div>
      <BacktestPanel />
    </div>
  );
}
```

- [ ] **Step 5: Add backtest link to nav**

In `apps/web/src/app/router.tsx`, update root component:
```typescript
import { Link, Outlet } from "@tanstack/react-router";

// inside rootRoute component:
component: () => (
  <div className="min-h-screen bg-background text-foreground">
    <nav className="border-b px-8 py-3 flex gap-6 text-sm">
      <Link to="/" className="[&.active]:font-semibold">自選股</Link>
      <Link to="/backtest" className="[&.active]:font-semibold">回測</Link>
    </nav>
    <Suspense fallback={<div className="p-8 text-center">載入中…</div>}>
      <Outlet />
    </Suspense>
  </div>
),
```

- [ ] **Step 6: Verify backtest flow**

1. Navigate to `http://localhost:5173/backtest`
2. Set symbol=2330, start=2022-01-01, end=2024-12-31, buy=-5, sell=5, n=20
3. Click 執行回測
4. Verify equity curve chart renders and trades table populates

- [ ] **Step 7: Final commit**

```bash
git add apps/web/src/
git commit -m "feat: backtest page with equity curve chart and trades table"
```

---

## Self-Review

**Spec coverage:**
- ✅ Monorepo (pnpm workspaces) — Task 1
- ✅ FastAPI + yfinance history/indicators/info — Task 2
- ✅ Watchlist groups CRUD + batch add + SQLite schema — Task 3
- ✅ Backtest engine with bias ratio strategy — Task 4
- ✅ packages/api-client with zod schemas — Task 5
- ✅ Vite + TanStack Router + Tailwind + FSD structure — Task 6
- ✅ Atomic Design (atoms/molecules/organisms) — Task 7
- ✅ Feature hooks + entities layer — Task 8
- ✅ ChartPanel widget (K-line + bias sub-chart, period/N toggles) — Task 9
- ✅ WatchlistSection widget (groups accordion + add/remove) — Task 9
- ✅ Backtest page (form + equity curve + trades table) — Task 10
- ✅ FSD layer dependency rule (pages→widgets→features→entities→shared) — enforced by file structure
- ✅ Taiwan stock colors (red=up, green=down per TW convention) — Task 7

**Placeholder scan:** None found. All steps contain actual code.

**Type consistency:**
- `OHLCVBar`, `IndicatorPoint`, `Group`, `BatchAddItem`, `BacktestResult` defined in Task 5, used consistently in Tasks 7–10
- `useStockChart` returns `bars: OHLCVBar[]` — consumed as such in ChartPanel ✅
- `useIndicators` returns `points: IndicatorPoint[]` — consumed as `biasPoints` in CandlestickChart ✅
- `useGroups` returns `groups: Group[]` — consumed in WatchlistTable ✅
