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
  cost_twd: z.number().nullable(),
  unrealized: z.number().nullable(),
  unrealized_twd: z.number().nullable(),
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
  cost_total: z.number(),
  net_exposure: z.number(),
  gross_exposure: z.number(),
  exposure_ratio: z.number().nullable(),
  debt_ratio: z.number().nullable(),
  current_liabilities: z.number().nullish(),
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
  plan_id: z.number().nullable(),
  pending: z.boolean(),
});
export type PortfolioTransaction = z.infer<typeof PortfolioTransactionSchema>;

export const RecurringFeeModeSchema = z.enum(["none", "fixed", "rate"]);
export type RecurringFeeMode = z.infer<typeof RecurringFeeModeSchema>;

export const RecurringPlanSchema = z.object({
  id: z.number(),
  symbol: z.string(),
  name: z.string().optional(), // PATCH 回傳不帶 name（無 join）；list 一定有
  account_id: z.number(),
  amount: z.number(),
  fee_mode: RecurringFeeModeSchema,
  fee_value: z.number(),
  fee_min: z.number(),
  days_of_month: z.array(z.number()),
  next_run_date: z.string(),
  active: z.boolean(),
});
export type RecurringPlan = z.infer<typeof RecurringPlanSchema>;

export type RecurringPlanInput = {
  symbol: string;
  account_id: number;
  amount: number;
  fee_mode?: RecurringFeeMode;
  fee_value?: number;
  fee_min?: number;
  days_of_month: number[];
};

export const PortfolioAccountSchema = z.object({
  id: z.number(),
  name: z.string(),
  kind: z.enum(["asset", "liability"]),
  sort_order: z.number(),
  balance: z.number(),
  balance_twd: z.number().nullable(),
  rate: z.number().nullable(),
  due_date: z.string().nullable(),
  periods: z.number().nullable(),
  currency: z.enum(["TWD", "USD"]),
});
export type PortfolioAccount = z.infer<typeof PortfolioAccountSchema>;

export type AccountInput = {
  name: string;
  kind: "asset" | "liability";
  initial_balance?: number;
  rate?: number | null;
  due_date?: string | null;
  periods?: number | null;
  currency?: "TWD" | "USD";
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
  pending?: boolean;
};

export const RebalanceBucketSchema = z.object({
  value: z.number(),
  cash: z.number(),
  base: z.number(),
  ratio: z.number().nullable(),
  delta: z.number(),
  factor: z.number(),
  exposure_after: z.number(),
  exposure_ratio_after: z.number().nullable(),
});
export type RebalanceBucket = z.infer<typeof RebalanceBucketSchema>;

export const RebalanceSchema = z.object({
  target_pct: z.number(),
  trigger_pct: z.number(),
  upper_pct: z.number(),
  lower_pct: z.number(),
  net_worth: z.number(),
  exposure: z.number(),
  exposure_ratio: z.number().nullable(),
  leveraged: RebalanceBucketSchema.extend({
    implied_move_pct: z.number().nullable(),
    triggered: z.boolean(),
  }),
  all_stocks: RebalanceBucketSchema,
});
export type Rebalance = z.infer<typeof RebalanceSchema>;

export type RebalanceInput = { target_pct: number; trigger_pct: number };
