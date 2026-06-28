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

export const searchStocks = (q: string): Promise<{ symbol: string; name: string }[]> =>
  apiFetch(z.array(z.object({ symbol: z.string(), name: z.string() })), `${BASE}/stock/search?q=${encodeURIComponent(q)}`);

const StockPriceSchema = z.object({ symbol: z.string(), name: z.string(), close: z.number(), change_pct: z.number() });
export type StockPrice = z.infer<typeof StockPriceSchema>;
export const getStockPrices = (symbols: string[]): Promise<StockPrice[]> =>
  apiFetch(z.array(StockPriceSchema), `${BASE}/stock/prices?symbols=${symbols.join(",")}`);

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
