import { useState } from "react";
import { runBacktest } from "@taiwan-stock/api-client";
import type { BacktestResult, BacktestRequest } from "@taiwan-stock/api-client";

export function useBacktest() {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = (req: BacktestRequest) => {
    setLoading(true);
    setError(null);
    runBacktest(req)
      .then(setResult)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  return { result, loading, error, execute };
}
