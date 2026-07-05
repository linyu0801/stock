import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Maximize2 } from "lucide-react";
import { CandlestickChart, BiasChart } from "@/shared/ui/organisms/candlestick-chart";
import { Skeleton } from "@/shared/ui/atoms/skeleton";
import { useStockChart } from "@/features/fetch-stock-chart/use-stock-chart";
import { useIndicators } from "@/features/fetch-indicators/use-indicators";
import { getStockPrices, type StockPrice } from "@taiwan-stock/api-client";
import { formatPrice, formatPercent } from "@/shared/lib/format";
import { useIsDesktop } from "@/shared/lib/use-media";
import { StatBox } from "./atoms/StatBox";

const PERIODS = ["1mo", "3mo", "6mo", "1y", "2y", "5y"] as const;
const BIAS_NS = [5, 10, 20, 60] as const;

type Props = {
  symbol: string;
  /** inline = 嵌在自選股頁右欄；page = 獨立個股頁 */
  variant?: "page" | "inline";
};

const StockDetailPanel: React.FC<Props> = ({ symbol, variant = "page" }) => {
  const [period, setPeriod] = useState<string>("3mo");
  const [biasN, setBiasN] = useState<number>(20);
  const isDesktop = useIsDesktop();

  const { bars, loading: barsLoading } = useStockChart(symbol, period);
  const { points } = useIndicators(symbol, biasN, period === "1mo" ? "3mo" : period);
  const { data: priceInfo } = useQuery<StockPrice[]>({
    queryKey: ["stock-prices", symbol],
    queryFn: () => getStockPrices([symbol]),
    staleTime: 1000 * 60 * 5,
  });
  const name = priceInfo?.[0]?.name;

  const latest = bars.at(-1);
  const prev = bars.at(-2);
  const changePct = latest && prev ? (latest.close - prev.close) / prev.close * 100 : 0;
  const isGain = changePct >= 0;
  const inline = variant === "inline";
  const chartHeight = inline ? 400 : isDesktop ? 480 : 320;

  return (
    <div>
      {/* Header: symbol / name / price */}
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-display text-2xl font-bold tabular-nums leading-none">{symbol}</h2>
        {name && <span className="text-base text-muted-foreground">{name}</span>}
        {latest && (
          <span className="ml-auto flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold tabular-nums leading-none">
              {formatPrice(latest.close)}
            </span>
            <span className={`text-sm font-semibold tabular-nums ${isGain ? "text-gain" : "text-loss"}`}>
              {isGain ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%
            </span>
          </span>
        )}
        {inline && (
          <Link
            to="/stock/$id"
            params={{ id: symbol }}
            aria-label="開啟完整個股頁"
            className="self-center p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Maximize2 size={15} />
          </Link>
        )}
      </div>

      {/* Stat bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
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
      <div className="inline-flex rounded-full bg-muted p-0.5 mb-4">
        {PERIODS.map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
              period === p
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Main chart */}
      {barsLoading
        ? <Skeleton className="w-full" style={{ height: chartHeight }} />
        : <CandlestickChart bars={bars} height={chartHeight} />}

      {/* Bias section */}
      <div className="mt-5">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm text-muted-foreground">乖離率 N =</span>
          <div className="inline-flex rounded-full bg-muted p-0.5">
            {BIAS_NS.map(n => (
              <button
                key={n}
                onClick={() => setBiasN(n)}
                className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors tabular-nums ${
                  biasN === n
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <BiasChart biasPoints={points} biasN={biasN} height={inline ? 140 : 160} />
      </div>
    </div>
  );
};

export default StockDetailPanel;
