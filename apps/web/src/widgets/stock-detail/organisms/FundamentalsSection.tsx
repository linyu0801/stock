import { useQuery } from "@tanstack/react-query";
import { getFundamentals, type Fundamentals, type RevenuePoint } from "@taiwan-stock/api-client";
import { Skeleton } from "@/shared/ui/atoms/skeleton";
import { formatPercent, formatRevenueYi, gainLossClass } from "@/shared/lib/format";
import { StatBox } from "../atoms/StatBox";

type Props = { symbol: string };

type RevenueBarsProps = { points: RevenuePoint[] };

const RevenueBars: React.FC<RevenueBarsProps> = ({ points }) => {
  const max = Math.max(...points.map((p) => p.revenue));
  return (
    <div className="flex items-end gap-1.5">
      {points.map((p) => (
        <div key={p.year_month} className="flex-1 min-w-0 max-w-16 flex flex-col items-center gap-1">
          <div className="w-full h-24 flex items-end">
            <div
              className="w-full rounded-t bg-primary/70"
              style={{ height: `${Math.max((p.revenue / max) * 100, 2)}%` }}
              title={`${p.year_month}：${formatRevenueYi(p.revenue)} 億${p.yoy_pct != null ? `（年增 ${formatPercent(p.yoy_pct)}）` : ""}`}
            />
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {p.year_month.slice(2).replace("-", "/")}
          </span>
        </div>
      ))}
    </div>
  );
};

export const FundamentalsSection: React.FC<Props> = ({ symbol }) => {
  const { data, isLoading } = useQuery<Fundamentals>({
    queryKey: ["fundamentals", symbol],
    queryFn: () => getFundamentals(symbol),
    staleTime: 1000 * 60 * 60,
  });

  if (isLoading) {
    return (
      <div className="mt-6">
        <h3 className="text-sm font-bold mb-3">基本面</h3>
        <Skeleton className="w-full h-40" />
      </div>
    );
  }

  const valuation = data?.valuation;
  const revenue = data?.revenue ?? [];
  const latest = revenue.at(-1);
  if (!valuation && revenue.length === 0) return null;

  return (
    <div className="mt-6">
      <h3 className="text-sm font-bold mb-3">基本面</h3>
      <div className="grid grid-cols-2 @lg:grid-cols-4 gap-3 mb-4">
        <StatBox label="本益比" value={valuation?.pe != null ? valuation.pe.toFixed(2) : "—"} />
        <StatBox label="股價淨值比" value={valuation?.pb != null ? valuation.pb.toFixed(2) : "—"} />
        <StatBox
          label="殖利率"
          value={valuation?.dividend_yield != null ? `${valuation.dividend_yield.toFixed(2)}%` : "—"}
        />
        <StatBox
          label="月營收年增"
          value={latest?.yoy_pct != null ? formatPercent(latest.yoy_pct) : "—"}
          valueClassName={latest?.yoy_pct != null ? gainLossClass(latest.yoy_pct) : undefined}
        />
      </div>

      {latest && (
        <>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-2 text-xs text-muted-foreground">
            <span className="text-sm font-semibold text-foreground tabular-nums">
              {latest.year_month} 營收 {formatRevenueYi(latest.revenue)} 億
            </span>
            {latest.mom_pct != null && (
              <span>月增 <span className={`font-medium tabular-nums ${gainLossClass(latest.mom_pct)}`}>{formatPercent(latest.mom_pct)}</span></span>
            )}
            {latest.yoy_pct != null && (
              <span>年增 <span className={`font-medium tabular-nums ${gainLossClass(latest.yoy_pct)}`}>{formatPercent(latest.yoy_pct)}</span></span>
            )}
            {latest.acc_yoy_pct != null && (
              <span>累計年增 <span className={`font-medium tabular-nums ${gainLossClass(latest.acc_yoy_pct)}`}>{formatPercent(latest.acc_yoy_pct)}</span></span>
            )}
          </div>
          <RevenueBars points={revenue} />
        </>
      )}
    </div>
  );
};
