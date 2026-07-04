import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getWatchlist, createGroup, renameGroup, deleteGroup,
  addStock, batchAddStocks, removeStock, moveStock,
  updateStockNote, createSublabel, updateSublabel, deleteSublabel,
  reorderGroupItems, type ReorderItem,
} from "@taiwan-stock/api-client";
import type { Group, BatchAddItem } from "@taiwan-stock/api-client";

const QUERY_KEY = ["watchlist"] as const;

export function useGroups() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: QUERY_KEY });

  const { data, isLoading: loading } = useQuery<Group[]>({
    queryKey: QUERY_KEY,
    queryFn: getWatchlist,
  });
  const groups: Group[] = data ?? [];

  return {
    groups,
    loading,
    createGroup: (name: string) => createGroup(name).then(invalidate),
    renameGroup: (id: number, name: string) => renameGroup(id, name).then(invalidate),
    deleteGroup: (id: number) => deleteGroup(id).then(invalidate),
    addStock: (symbol: string, groupId: number) => addStock(symbol, groupId).then(invalidate),
    batchAddStocks: (stocks: BatchAddItem[]) => batchAddStocks(stocks).then(invalidate),
    removeStock: (id: number) => removeStock(id).then(invalidate),
    moveStock: (id: number, groupId: number) => moveStock(id, groupId).then(invalidate),
    updateStockNote: (id: number, note: string | null) => updateStockNote(id, note).then(invalidate),
    createSublabel: (groupId: number, label: string) => createSublabel(groupId, label).then(invalidate),
    updateSublabel: (id: number, label: string) => updateSublabel(id, label).then(invalidate),
    deleteSublabel: (id: number) => deleteSublabel(id).then(invalidate),
    reorderGroupItems: (groupId: number, items: ReorderItem[]) => reorderGroupItems(groupId, items).then(invalidate),
  };
}
