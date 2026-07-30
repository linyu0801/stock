import { z } from "zod";

export const PortfolioSideSchema = z.enum(["buy", "sell", "dividend", "stock_dividend"]);
export type PortfolioSide = z.infer<typeof PortfolioSideSchema>;

export const PositionSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  currency: z.enum(["TWD", "USD"]),
  quantity: z.number(),
  avg_cost: z.number(),
  close: z.number().nullable(),
  market_value: z.number().nullable(),
  market_value_twd: z.number().nullable(),
  unrealized: z.number().nullable(),
  realized: z.number(),
  factor: z.number(),
  factor_overridden: z.boolean(),
  exposure: z.number().nullable(),
});
export type Position = z.infer<typeof PositionSchema>;

export const PositionsResponseSchema = z.object({
  positions: z.array(PositionSchema),
  missing_symbols: z.array(z.string()),
  unrealized: z.object({ gain: z.number(), loss: z.number(), net: z.number() }),
});
export type PositionsResponse = z.infer<typeof PositionsResponseSchema>;

export const PortfolioSummarySchema = z.object({
  net_worth: z.number(),
  assets_total: z.number(),
  liabilities_total: z.number(),
  stock_value: z.number(),
  net_exposure: z.number(),
  gross_exposure: z.number(),
  exposure_ratio: z.number().nullable(),
  debt_ratio: z.number().nullable(),
  current_ratio: z.number().nullable(),
  incomplete: z.boolean(),
  missing_symbols: z.array(z.string()),
});
export type PortfolioSummary = z.infer<typeof PortfolioSummarySchema>;

export const PortfolioTransactionSchema = z.object({
  id: z.number(),
  symbol: z.string(),
  side: PortfolioSideSchema,
  quantity: z.number(),
  price: z.number(),
  fee: z.number(),
  tax: z.number(),
  account_id: z.number().nullable(),
  traded_at: z.string(),
  note: z.string().nullable(),
});
export type PortfolioTransaction = z.infer<typeof PortfolioTransactionSchema>;

export const PortfolioAccountSchema = z.object({
  id: z.number(),
  name: z.string(),
  kind: z.enum(["asset", "liability"]),
  sort_order: z.number(),
  balance: z.number(),
  rate: z.number().nullable(),
  due_date: z.string().nullable(),
  periods: z.number().nullable(),
});
export type PortfolioAccount = z.infer<typeof PortfolioAccountSchema>;

export type AccountInput = {
  name: string;
  kind: "asset" | "liability";
  initial_balance?: number;
  rate?: number | null;
  due_date?: string | null;
  periods?: number | null;
};

export type TransactionInput = {
  symbol: string;
  side: PortfolioSide;
  quantity: number;
  price: number;
  fee: number;
  tax: number;
  account_id: number | null;
  traded_at: string;
  note?: string | null;
};
