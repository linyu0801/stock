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
