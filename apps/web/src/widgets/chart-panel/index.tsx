import { useState } from "react";
import { CandlestickChart, BiasChart } from "@/shared/ui/organisms/candlestick-chart";
import { StatCard } from "@/shared/ui/molecules/stat-card";
import { Button } from "@/shared/ui/atoms/button";
import { Skeleton } from "@/shared/ui/atoms/skeleton";
import { useStockChart } from "@/features/fetch-stock-chart/use-stock-chart";
import { useIndicators } from "@/features/fetch-indicators/use-indicators";
import { formatPrice, formatPercent } from "@/shared/lib/format";

const PERIODS = ["1mo", "3mo", "6mo", "1y", "2y", "5y"] as const;
const BIAS_NS = [5, 10, 20, 60] as const;

interface Props { symbol: string }

export function ChartPanel({ symbol }: Props) {
  const [period, setPeriod] = useState<string>("3mo");
  const [biasN, setBiasN] = useState<number>(20);

  const { bars, loading: barsLoading } = useStockChart(symbol, period);
  const { points } = useIndicators(symbol, biasN, period === "1mo" ? "3mo" : period);

  const latest = bars.at(-1);
  const prev = bars.at(-2);
  const changePct = latest && prev ? (latest.close - prev.close) / prev.close * 100 : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="最新收盤" value={latest ? formatPrice(latest.close) : "—"} />
        <StatCard label="漲跌幅" value={latest ? formatPercent(changePct) : "—"} />
        <StatCard label="成交量" value={latest ? latest.volume.toLocaleString() : "—"} />
      </div>

      <div className="flex gap-1">
        {PERIODS.map((p) => (
          <Button key={p} size="sm" variant={period === p ? "default" : "outline"} onClick={() => setPeriod(p)}>
            {p}
          </Button>
        ))}
      </div>

      {barsLoading ? (
        <Skeleton className="h-[480px] w-full" />
      ) : (
        <CandlestickChart bars={bars} />
      )}

      <BiasChart biasPoints={points} biasN={biasN} />

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">乖離率 N =</span>
        {BIAS_NS.map((n) => (
          <Button key={n} size="sm" variant={biasN === n ? "default" : "outline"} onClick={() => setBiasN(n)}>
            {n}
          </Button>
        ))}
      </div>
    </div>
  );
}
