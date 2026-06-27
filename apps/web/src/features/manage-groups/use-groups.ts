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
