import { z } from "zod";

export const OHLCVBarSchema = z.object({
  // 日線為 "YYYY-MM-DD" 字串；盤中（1d）為 epoch 秒
  time: z.union([z.string(), z.number()]),
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
