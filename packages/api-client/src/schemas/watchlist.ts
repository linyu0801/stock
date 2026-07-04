import { z } from "zod";

export const WatchlistStockSchema = z.object({
  id: z.number(),
  symbol: z.string(),
  name: z.string(),
  note: z.string().nullable(),
  sort_order: z.number(),
  added_at: z.string(),
});
export type WatchlistStock = z.infer<typeof WatchlistStockSchema>;

export const SublabelSchema = z.object({
  id: z.number(),
  label: z.string(),
  sort_order: z.number(),
});
export type Sublabel = z.infer<typeof SublabelSchema>;

const StockItemSchema = WatchlistStockSchema.extend({ _type: z.literal("stock") });
const SublabelItemSchema = SublabelSchema.extend({ _type: z.literal("sublabel") });
export const GroupItemSchema = z.discriminatedUnion("_type", [StockItemSchema, SublabelItemSchema]);
export type GroupItem = z.infer<typeof GroupItemSchema>;

export const GroupSchema = z.object({
  id: z.number(),
  name: z.string(),
  order: z.number(),
  stocks: z.array(WatchlistStockSchema),
  items: z.array(GroupItemSchema),
});
export type Group = z.infer<typeof GroupSchema>;

export const BatchAddItemSchema = z.object({
  symbol: z.string(),
  group: z.string(),
});
export type BatchAddItem = z.infer<typeof BatchAddItemSchema>;
