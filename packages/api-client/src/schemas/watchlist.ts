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
