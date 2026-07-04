import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "@tanstack/react-router";
import { CandlestickChart, BiasChart } from "@/shared/ui/organisms/candlestick-chart";
import { Skeleton } from "@/shared/ui/atoms/skeleton";
import { Button } from "@/shared/ui/atoms/button";
import { useStockChart } from "@/features/fetch-stock-chart/use-stock-chart";
import { useIndicators } from "@/features/fetch-indicators/use-indicators";
import { getStockPrices, type StockPrice } from "@taiwan-stock/api-client";
import { formatPrice, formatPercent } from "@/shared/lib/format";
import { StatBox } from "./atoms/StatBox";

const PERIODS = ["1mo", "3mo", "6mo", "1y", "2y", "5y"] as const;
const BIAS_NS = [5, 10, 20, 60] as const;

const StockPage: React.FC = () => {
  const { id } = useParams({ from: "/stock/$id" });
  const router = useRouter();
  const [period, setPeriod] = useState<string>("3mo");
  const [biasN, setBiasN] = useState<number>(20);

  const { bars, loading: barsLoading } = useStockChart(id, period);
  const { points } = useIndicators(id, biasN, period === "1mo" ? "3mo" : period);
  const { data: priceInfo } = useQuery<StockPrice[]>({
    queryKey: ["stock-prices", id],
    queryFn: () => getStockPrices([id]),
    staleTime: 1000 * 60 * 5,
  });
  const name = priceInfo?.[0]?.name;

  const latest = bars.at(-1);
  const prev = bars.at(-2);
  const changePct = latest && prev ? (latest.close - prev.close) / prev.close * 100 : 0;
  const isGain = changePct >= 0;

  return (
    <div className="px-8 py-6 max-w-5xl">
      {/* Back + title */}
      <div className="mb-5 flex items-center gap-4">
        <button
          onClick={() => window.history.length > 1 ? router.history.back() : router.navigate({ to: "/" })}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← 返回
        </button>
        <h1 className="text-2xl font-bold tabular-nums">{id}</h1>
        {name && <span className="text-base text-muted-foreground">{name}</span>}
      </div>

      {/* Stat bar */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatBox label="最新收盤" value={latest ? formatPrice(latest.close) : "—"} />
        <StatBox
          label="今日漲跌"
          value={latest ? formatPercent(changePct) : "—"}
          valueClassName={isGain ? "text-gain" : "text-loss"}
          sub={latest && prev ? `${isGain ? "▲" : "▼"} ${formatPrice(Math.abs(latest.close - prev.close))}` : undefined}
        />
        <StatBox label="最高" value={latest ? formatPrice(latest.high) : "—"} />
        <StatBox label="最低" value={latest ? formatPrice(latest.low) : "—"} />
      </div>

      {/* Period selector */}
      <div className="flex gap-1.5 mb-4">
        {PERIODS.map(p => (
          <Button key={p} size="sm" variant={period === p ? "default" : "outline"} onClick={() => setPeriod(p)}>
            {p}
          </Button>
        ))}
      </div>

      {/* Main chart */}
      {barsLoading ? <Skeleton className="h-[480px] w-full" /> : <CandlestickChart bars={bars} />}

      {/* Bias section */}
      <div className="mt-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm text-muted-foreground">乖離率 N =</span>
          {BIAS_NS.map(n => (
            <Button key={n} size="sm" variant={biasN === n ? "default" : "outline"} onClick={() => setBiasN(n)}>
              {n}
            </Button>
          ))}
        </div>
        <BiasChart biasPoints={points} biasN={biasN} />
      </div>
    </div>
  );
};

export default StockPage;
