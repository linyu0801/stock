import { z } from "zod";
import {
  OHLCVBarSchema, OHLCVBar,
  IndicatorPointSchema, IndicatorPoint,
  StockInfoSchema, StockInfo,
} from "./schemas/stock";
import { GroupSchema, Group, BatchAddItem } from "./schemas/watchlist";
import { BacktestRequest, BacktestResult, BacktestResultSchema } from "./schemas/backtest";
import {
  PortfolioSummarySchema, PortfolioSummary,
  PositionsResponseSchema, PositionsResponse,
  PortfolioTransactionSchema, PortfolioTransaction,
  PortfolioAccountSchema, PortfolioAccount,
  RecurringPlanSchema, RecurringPlan,
  RebalanceSchema, Rebalance,
  TransactionInput,
  AccountInput,
  RecurringPlanInput,
  RebalanceInput,
} from "./schemas/portfolio";

const BASE = `${import.meta.env.VITE_API_BASE ?? "http://localhost:8000"}/api`;

let authTokenProvider: (() => Promise<string | null>) | null = null;
export const setAuthTokenProvider = (fn: () => Promise<string | null>) => {
  authTokenProvider = fn;
};

async function authHeaders(): Promise<Record<string, string>> {
  const token = authTokenProvider ? await authTokenProvider() : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(schema: z.ZodType<T>, url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { ...(init?.headers ?? {}), ...(await authHeaders()) } });
  if (!res.ok) throw new Error(`API error ${res.status}: ${url}`);
  return schema.parse(await res.json());
}

export const searchStocks = (q: string): Promise<{ symbol: string; name: string }[]> =>
  apiFetch(z.array(z.object({ symbol: z.string(), name: z.string() })), `${BASE}/stock/search?q=${encodeURIComponent(q)}`);

const StockPriceSchema = z.object({ symbol: z.string(), name: z.string(), close: z.number(), change: z.number(), change_pct: z.number(), volume: z.number(), limit: z.enum(["up", "down"]).nullable() });
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
  const res = await fetch(`${BASE}/watchlist/groups/${groupId}`, { method: "DELETE", headers: await authHeaders() });
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
  const res = await fetch(`${BASE}/watchlist/stocks/${stockId}`, { method: "DELETE", headers: await authHeaders() });
  if (!res.ok) throw new Error(`API error ${res.status}`);
};

export const moveStock = (stockId: number, groupId: number) =>
  apiFetch(z.object({ id: z.number(), group_id: z.number() }),
    `${BASE}/watchlist/stocks/${stockId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_id: groupId }),
    });

export const updateStockNote = (stockId: number, note: string | null) =>
  apiFetch(z.object({ id: z.number(), note: z.string().nullable() }),
    `${BASE}/watchlist/stocks/${stockId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });

export const createSublabel = (groupId: number, label: string) =>
  apiFetch(z.object({ id: z.number(), group_id: z.number(), label: z.string() }),
    `${BASE}/watchlist/sublabels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_id: groupId, label }),
    });

export const updateSublabel = (sublabelId: number, label: string) =>
  apiFetch(z.object({ id: z.number(), label: z.string() }),
    `${BASE}/watchlist/sublabels/${sublabelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });

export const deleteSublabel = async (sublabelId: number): Promise<void> => {
  const res = await fetch(`${BASE}/watchlist/sublabels/${sublabelId}`, { method: "DELETE", headers: await authHeaders() });
  if (!res.ok) throw new Error(`API error ${res.status}`);
};

export type ReorderItem = { type: "stock" | "sublabel"; id: number };
export const reorderGroupItems = (groupId: number, items: ReorderItem[]): Promise<{ ok: boolean }> =>
  apiFetch(z.object({ ok: z.boolean() }), `${BASE}/watchlist/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ group_id: groupId, items }),
  });

const MoverSchema = z.object({ symbol: z.string(), name: z.string(), close: z.number(), change_pct: z.number(), volume: z.number(), limit: z.enum(["up", "down"]).nullable() });
export type Mover = z.infer<typeof MoverSchema>;
export type MoversResponse = { gainers: Mover[]; losers: Mover[]; volume: Mover[]; date: string | null };
export const getMarketMovers = (): Promise<MoversResponse> =>
  apiFetch(
    z.object({
      gainers: z.array(MoverSchema),
      losers: z.array(MoverSchema),
      volume: z.array(MoverSchema),
      date: z.string().nullable(),
    }),
    `${BASE}/market/movers`,
  );

const ConceptSchema = z.object({ category: z.string(), name: z.string() });
export type Concept = z.infer<typeof ConceptSchema>;
export const getConcepts = (): Promise<Concept[]> =>
  apiFetch(z.array(ConceptSchema), `${BASE}/market/concepts`);

const ConceptStockSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  close: z.number().nullable(),
  change_pct: z.number().nullable(),
  limit: z.enum(["up", "down"]).nullable(),
});
export type ConceptStock = z.infer<typeof ConceptStockSchema>;
export const getConceptStocks = (category: string): Promise<ConceptStock[]> =>
  apiFetch(
    z.object({ stocks: z.array(ConceptStockSchema) }),
    `${BASE}/market/concepts/${encodeURIComponent(category)}`,
  ).then((r) => r.stocks);

const SectorIndexSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  close: z.number().nullable(),
  change_pct: z.number().nullable(),
  spark: z.array(z.number()),
});
export type SectorIndex = z.infer<typeof SectorIndexSchema>;
export const getSectorIndices = (): Promise<SectorIndex[]> =>
  apiFetch(z.array(SectorIndexSchema), `${BASE}/market/sectors`);

const ValuationSchema = z.object({
  pe: z.number().nullable(),
  pb: z.number().nullable(),
  dividend_yield: z.number().nullable(),
});
export type Valuation = z.infer<typeof ValuationSchema>;
const StockValuationSchema = ValuationSchema.extend({ symbol: z.string() });
export type StockValuation = z.infer<typeof StockValuationSchema>;
export const getValuations = (symbols: string[]): Promise<StockValuation[]> =>
  apiFetch(z.array(StockValuationSchema), `${BASE}/fundamentals/valuations?symbols=${encodeURIComponent(symbols.join(","))}`);

const DispositionFlagSchema = z.object({
  level: z.enum(["disposal", "warning"]),
  reason: z.string(),
  measures: z.string().nullable(),
  start: z.string().nullable(),
  end: z.string().nullable(),
});
export type DispositionFlag = z.infer<typeof DispositionFlagSchema>;
export const getDispositionFlags = (symbols: string[]): Promise<Record<string, DispositionFlag>> =>
  apiFetch(z.record(z.string(), DispositionFlagSchema), `${BASE}/disposition/flags?symbols=${encodeURIComponent(symbols.join(","))}`);

const EtfPremiumSchema = z.object({ nav: z.number(), premium_pct: z.number(), date: z.string() });
export type EtfPremium = z.infer<typeof EtfPremiumSchema>;
export const getEtfPremium = (symbols: string[]): Promise<Record<string, EtfPremium>> =>
  apiFetch(z.record(z.string(), EtfPremiumSchema), `${BASE}/etf/premium?symbols=${encodeURIComponent(symbols.join(","))}`);

const RevenuePointSchema = z.object({
  year_month: z.string(),
  revenue: z.number(),
  mom_pct: z.number().nullable(),
  yoy_pct: z.number().nullable(),
  acc_yoy_pct: z.number().nullable(),
});
export type RevenuePoint = z.infer<typeof RevenuePointSchema>;
const FundamentalsSchema = z.object({
  valuation: ValuationSchema.nullable(),
  revenue: z.array(RevenuePointSchema),
});
export type Fundamentals = z.infer<typeof FundamentalsSchema>;
export const getFundamentals = (symbol: string): Promise<Fundamentals> =>
  apiFetch(FundamentalsSchema, `${BASE}/fundamentals/${symbol}`);

export const runBacktest = (req: BacktestRequest): Promise<BacktestResult> =>
  apiFetch(BacktestResultSchema, `${BASE}/backtest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

export const getPortfolioSummary = (): Promise<PortfolioSummary> =>
  apiFetch(PortfolioSummarySchema, `${BASE}/portfolio/summary`);

export const getPortfolioPositions = (): Promise<PositionsResponse> =>
  apiFetch(PositionsResponseSchema, `${BASE}/portfolio/positions`);

export const getPortfolioTransactions = (symbol?: string): Promise<PortfolioTransaction[]> =>
  apiFetch(z.array(PortfolioTransactionSchema),
    `${BASE}/portfolio/transactions${symbol ? `?symbol=${encodeURIComponent(symbol)}` : ""}`);

export const createPortfolioTransaction = (input: TransactionInput): Promise<{ id: number }> =>
  apiFetch(z.object({ id: z.number() }), `${BASE}/portfolio/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

export const updatePortfolioTransaction = (id: number, input: Partial<TransactionInput>): Promise<PortfolioTransaction> =>
  apiFetch(PortfolioTransactionSchema, `${BASE}/portfolio/transactions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

export const deletePortfolioTransaction = async (id: number): Promise<void> => {
  const res = await fetch(`${BASE}/portfolio/transactions/${id}`, { method: "DELETE", headers: await authHeaders() });
  if (!res.ok) throw new Error(`API error ${res.status}`);
};

export const getPortfolioAccounts = (): Promise<PortfolioAccount[]> =>
  apiFetch(z.array(PortfolioAccountSchema), `${BASE}/portfolio/accounts`);

export const createPortfolioAccount = (input: AccountInput): Promise<{ id: number }> =>
  apiFetch(z.object({ id: z.number() }), `${BASE}/portfolio/accounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

export const updatePortfolioAccount = (
  id: number,
  patch: { name?: string; sort_order?: number; rate?: number | null; due_date?: string | null; periods?: number | null; currency?: "TWD" | "USD" },
) =>
  apiFetch(
    z.object({
      id: z.number(),
      name: z.string(),
      kind: z.string(),
      sort_order: z.number(),
      rate: z.number().nullable(),
      due_date: z.string().nullable(),
      periods: z.number().nullable(),
      currency: z.enum(["TWD", "USD"]),
    }),
    `${BASE}/portfolio/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

export const deletePortfolioAccount = async (id: number): Promise<void> => {
  const res = await fetch(`${BASE}/portfolio/accounts/${id}`, { method: "DELETE", headers: await authHeaders() });
  if (!res.ok) throw new Error(`API error ${res.status}`);
};

export const addAccountEntry = (accountId: number, kind: "deposit" | "withdraw" | "adjust", amount: number, note?: string): Promise<{ id: number }> =>
  apiFetch(z.object({ id: z.number() }), `${BASE}/portfolio/accounts/${accountId}/entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, amount, note }),
  });

export const getRecurringPlans = (): Promise<RecurringPlan[]> =>
  apiFetch(z.array(RecurringPlanSchema), `${BASE}/portfolio/plans`);

export const createRecurringPlan = (input: RecurringPlanInput): Promise<{ id: number }> =>
  apiFetch(z.object({ id: z.number() }), `${BASE}/portfolio/plans`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

export const updateRecurringPlan = (
  id: number,
  patch: Partial<RecurringPlanInput> & { active?: boolean },
): Promise<RecurringPlan> =>
  apiFetch(RecurringPlanSchema, `${BASE}/portfolio/plans/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });

export const deleteRecurringPlan = async (id: number): Promise<void> => {
  const res = await fetch(`${BASE}/portfolio/plans/${id}`, { method: "DELETE", headers: await authHeaders() });
  if (!res.ok) throw new Error(`API error ${res.status}`);
};

export const setLeverage = (symbol: string, factor: number) =>
  apiFetch(z.object({ symbol: z.string(), factor: z.number() }), `${BASE}/portfolio/leverage/${symbol}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ factor }),
  });

export const clearLeverage = async (symbol: string): Promise<void> => {
  const res = await fetch(`${BASE}/portfolio/leverage/${symbol}`, { method: "DELETE", headers: await authHeaders() });
  if (!res.ok) throw new Error(`API error ${res.status}`);
};

export const getPortfolioRebalance = (): Promise<Rebalance | null> =>
  apiFetch(RebalanceSchema.nullable(), `${BASE}/portfolio/rebalance`);

export const setPortfolioRebalance = (input: RebalanceInput): Promise<Rebalance> =>
  apiFetch(RebalanceSchema, `${BASE}/portfolio/rebalance`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
