import { useQuery } from "@tanstack/react-query";
import { getPortfolioSummary } from "@taiwan-stock/api-client";
import { formatPrice } from "@/shared/lib/format";
import { Skeleton } from "@/shared/ui/atoms/skeleton";

type Segment = { key: string; label: string; value: number; colorClass: string; suffix?: string };

type BarProps = { title: string; aside?: string; total: number; segments: Segment[] };

const StackBar: React.FC<BarProps> = ({ title, aside, total, segments }) => {
  const shown = segments.filter(s => s.value > 0);
  if (total <= 0 || shown.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
        <p className="text-xs text-muted-foreground">{title}</p>
        {aside && <p className="text-xs text-muted-foreground tabular-nums">{aside}</p>}
      </div>
      <div className="flex h-4 gap-[2px]">
        {shown.map((s, i) => (
          <div
            key={s.key}
            className={`${s.colorClass} ${i === 0 ? "rounded-l" : ""} ${i === shown.length - 1 ? "rounded-r" : ""} transition-[width] duration-500 ease-out motion-reduce:transition-none`}
            style={{ width: `${(s.value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {shown.map(s => (
          <div key={s.key} className="flex items-center gap-1.5 text-xs">
            <span className={`w-2 h-2 rounded-full ${s.colorClass}`} />
            <span className="text-muted-foreground">{s.label}</span>
            <span className="tabular-nums">{formatPrice(s.value)}</span>
            <span className="text-muted-foreground tabular-nums">{((s.value / total) * 100).toFixed(1)}%</span>
            {s.suffix && <span className="text-muted-foreground tabular-nums">{s.suffix}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

type RatioProps = { label: string; value: string; formula: string; calc: string; title?: string };

const Ratio: React.FC<RatioProps> = ({ label, value, formula, calc, title }) => (
  <div>
    <p className="text-xs text-muted-foreground" title={title}>{label}</p>
    <p className="mt-0.5 text-sm font-medium tabular-nums">{value}</p>
    <p className="text-xs text-muted-foreground">{formula}</p>
    <p className="text-xs text-muted-foreground tabular-nums">{calc}</p>
  </div>
);

const pct = (n: number | null, digits = 0): string => (n == null ? "—" : `${(n * 100).toFixed(digits)}%`);

export const SummaryCards: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["portfolio", "summary"],
    queryFn: getPortfolioSummary,
  });

  if (isLoading || !data) {
    return <Skeleton className="h-56 rounded-2xl" />;
  }

  const totalAssets = data.assets_total + data.stock_value;

  const allocation: Segment[] = [
    { key: "cash", label: "現金與其他", value: data.assets_total, colorClass: "bg-cat-cash" },
    { key: "stock", label: "投資部位", value: data.stock_value, colorClass: "bg-cat-stock", suffix: `（成本 ${formatPrice(data.cost_total)}）` },
  ];
  // 資本結構＝資產的融資來源；資產 = 負債 + 淨值，與資產配置共用同一分母（總資產），兩條 bar 等寬
  const capital: Segment[] = [
    { key: "liability", label: "負債", value: data.liabilities_total, colorClass: "bg-cat-liability" },
    { key: "equity", label: "淨值", value: data.net_worth, colorClass: "bg-foreground" },
  ];
  const showCapital = data.liabilities_total > 0 && data.net_worth > 0;

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

      <StackBar
        title="資產配置（現金 vs 投資）"
        aside={`總資產 ${formatPrice(totalAssets)}`}
        total={totalAssets}
        segments={allocation}
      />

      {showCapital && (
        <StackBar
          title="資本結構（負債 vs 淨值）"
          aside={`負債 ${formatPrice(data.liabilities_total)}`}
          total={totalAssets}
          segments={capital}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-border">
        <Ratio
          label="資產負債比"
          value={pct(data.debt_ratio, 1)}
          formula="負債 / 總資產"
          calc={totalAssets > 0 ? `${formatPrice(data.liabilities_total)} / ${formatPrice(totalAssets)}` : "—"}
        />
        <Ratio
          label="流動比率"
          title="流動比率＝流動資產 ÷ 流動負債；流動負債為未來 12 個月應還本息，非負債全額"
          value={pct(data.current_ratio)}
          formula="流動資產 / 流動負債（12個月內應還）"
          calc={data.current_ratio == null || data.current_liabilities == null ? "—" : `${formatPrice(totalAssets)} / ${formatPrice(data.current_liabilities)}`}
        />
        <Ratio
          label="曝險比"
          title="曝險比＝淨曝險 ÷ 淨值；槓桿 ETF 以市值×倍數計"
          value={pct(data.exposure_ratio)}
          formula="淨曝險 / 淨值"
          calc={`${formatPrice(data.net_exposure)} / ${formatPrice(data.net_worth)}`}
        />
      </div>
    </div>
  );
};
