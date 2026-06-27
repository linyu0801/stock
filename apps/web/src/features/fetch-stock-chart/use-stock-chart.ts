import { useState, useEffect } from "react";
import { getStockHistory } from "@taiwan-stock/api-client";
import type { OHLCVBar } from "@taiwan-stock/api-client";

export function useStockChart(symbol: string, period: string) {
  const [bars, setBars] = useState<OHLCVBar[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    getStockHistory(symbol, period)
      .then(setBars)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [symbol, period]);

  return { bars, loading, error };
}
