import { useQuery } from "@tanstack/react-query";
import { getPortfolioSummary } from "@taiwan-stock/api-client";
import { formatPrice } from "@/shared/lib/format";
import { Skeleton } from "@/shared/ui/atoms/skeleton";

type Segment = { key: string; label: string; value: number; colorClass: string };

export const SummaryCards: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["portfolio", "summary"],
    queryFn: getPortfolioSummary,
  });

  if (isLoading || !data) {
    return <Skeleton className="h-56 rounded-2xl" />;
  }

  const exposureRatioText = data.exposure_ratio == null ? "—" : `${(data.exposure_ratio * 100).toFixed(0)}%`;
  const segments: Segment[] = [
    { key: "cash", label: "現金與其他", value: data.assets_total, colorClass: "bg-cat-cash" },
    { key: "stock", label: "投資部位", value: data.stock_value, colorClass: "bg-cat-stock" },
    { key: "liability", label: "負債", value: data.liabilities_total, colorClass: "bg-cat-liability" },
  ].filter(s => s.value > 0);
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 flex flex-col gap-5">
      <div>
        <p className="text-xs text-muted-foreground">淨值</p>
        <p className="mt-1 text-4xl sm:text-5xl font-semibold tracking-tight [font-feature-settings:normal]">
          {formatPrice(data.net_worth)}
        </p>
        {data.incomplete && (
          <p className="mt-2 text-xs text-muted-foreground">
            ⚠ 缺 {data.missing_symbols.join("、")} 報價，總額不含這些部位
          </p>
        )}
      </div>

      {total > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex h-4 gap-[2px]">
            {segments.map((s, i) => (
              <div
                key={s.key}
                className={`${s.colorClass} ${i === 0 ? "rounded-l" : ""} ${i === segments.length - 1 ? "rounded-r" : ""}`}
                style={{ width: `${(s.value / total) * 100}%` }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {segments.map(s => (
              <div key={s.key} className="flex items-center gap-1.5 text-xs">
                <span className={`w-2 h-2 rounded-full ${s.colorClass}`} />
                <span className="text-muted-foreground">{s.label}</span>
                <span className="tabular-nums">{formatPrice(s.value)}</span>
                <span className="text-muted-foreground tabular-nums">
                  {((s.value / total) * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-border">
        <div>
          <p className="text-xs text-muted-foreground">資產</p>
          <p className="mt-0.5 text-sm font-medium tabular-nums">
            {formatPrice(data.assets_total + data.stock_value)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">負債</p>
          <p className="mt-0.5 text-sm font-medium tabular-nums">{formatPrice(data.liabilities_total)}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            資產負債比 {data.debt_ratio == null ? "—" : `${(data.debt_ratio * 100).toFixed(1)}%`}
            {" · "}流動比率 {data.current_ratio == null ? "—" : `${(data.current_ratio * 100).toFixed(0)}%`}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground" title="曝險比＝淨曝險 ÷ 淨值；槓桿 ETF 以市值×倍數計">曝險比</p>
          <p className="mt-0.5 text-sm font-medium tabular-nums">{exposureRatioText}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            淨曝險 {formatPrice(data.net_exposure)} · 總曝險 {formatPrice(data.gross_exposure)}
          </p>
        </div>
      </div>
    </div>
  );
};
