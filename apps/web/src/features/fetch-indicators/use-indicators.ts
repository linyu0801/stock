import { useState, useEffect } from "react";
import { getStockIndicators } from "@taiwan-stock/api-client";
import type { IndicatorPoint } from "@taiwan-stock/api-client";

export function useIndicators(symbol: string, n: number, period: string) {
  const [points, setPoints] = useState<IndicatorPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    getStockIndicators(symbol, n, period)
      .then(setPoints)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [symbol, n, period]);

  return { points, loading, error };
}
