import { useQuery } from "@tanstack/react-query";
import { getStockHistory } from "@taiwan-stock/api-client";
import type { OHLCVBar } from "@taiwan-stock/api-client";

export function useStockChart(symbol: string, period: string) {
  const { data: bars = [], isLoading: loading, error } = useQuery<OHLCVBar[]>({
    queryKey: ["stock-history", symbol, period],
    queryFn: () => getStockHistory(symbol, period),
    enabled: !!symbol,
    staleTime: 1000 * 60 * 5,
  });
  return { bars, loading, error: error?.message ?? null };
}
