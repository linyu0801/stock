import { useQuery } from "@tanstack/react-query";
import { getStockIndicators } from "@taiwan-stock/api-client";
import type { IndicatorPoint } from "@taiwan-stock/api-client";

export function useIndicators(symbol: string, n: number, period: string) {
  const { data: points = [], isLoading: loading, error } = useQuery<IndicatorPoint[]>({
    queryKey: ["indicators", symbol, n, period],
    queryFn: () => getStockIndicators(symbol, n, period),
    enabled: !!symbol,
    staleTime: 1000 * 60 * 5,
  });
  return { points, loading, error: error?.message ?? null };
}
