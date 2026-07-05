import { useQuery } from "@tanstack/react-query";
import { getSectorIndices, type SectorIndex } from "@taiwan-stock/api-client";
import { Skeleton } from "@/shared/ui/atoms/skeleton";

const BAR_W = 44;
const BAR_GAP = 8;
const SLOT = 56;
const CHART_H = 130;
const TOP_PAD = 24;
const BOT_PAD = 56;
const SVG_H = CHART_H + TOP_PAD + BOT_PAD;

type ChartProps = { data: SectorIndex[] };

const SectorBarChart: React.FC<ChartProps> = ({ data }) => {
  const validPcts = data.map((d) => d.change_pct ?? 0);
  const maxPct = Math.max(0, ...validPcts);
  const minPct = Math.min(0, ...validPcts);
  const range = maxPct - minPct || 1;
  const baselineY = TOP_PAD + (maxPct / range) * CHART_H;
  const svgW = data.length * SLOT;

  return (
    <svg
      width={svgW}
      height={SVG_H}
      viewBox={`0 0 ${svgW} ${SVG_H}`}
      className="block"
      aria-label="類股今日漲跌幅"
    >
      <line
        x1={0}
        y1={baselineY}
        x2={svgW}
        y2={baselineY}
        stroke="currentColor"
        strokeWidth={0.5}
        className="text-muted-foreground"
        opacity={0.4}
      />

      {data.map((s, i) => {
        const pct = s.change_pct;
        const x = i * SLOT;
        const isGain = (pct ?? 0) >= 0;
        const colorClass =
          pct == null ? "text-muted-foreground" : isGain ? "text-gain" : "text-loss";

        let barY = baselineY;
        let barH = 0;
        if (pct != null) {
          if (pct > 0) {
            barH = Math.max((pct / range) * CHART_H, 2);
            barY = baselineY - barH;
          } else if (pct < 0) {
            barH = Math.max((-pct / range) * CHART_H, 2);
            barY = baselineY;
          } else {
            barH = 2;
            barY = baselineY - 1;
          }
        }

        const pctText =
          pct != null ? `${isGain ? "+" : ""}${pct.toFixed(2)}%` : "—";
        const pctLabelY =
          pct != null && pct >= 0
            ? barY - 4
            : Math.min(baselineY + barH + 12, TOP_PAD + CHART_H + 14);

        return (
          <g key={s.symbol}>
            <rect
              x={x + (SLOT - BAR_W) / 2}
              y={barY}
              width={BAR_W}
              height={barH}
              rx={2}
              fill="currentColor"
              className={colorClass}
            />
            <text
              x={x + SLOT / 2}
              y={pctLabelY}
              textAnchor="middle"
              fontSize={10}
              fill="currentColor"
              className={colorClass}
            >
              {pctText}
            </text>
            <text
              x={x + SLOT / 2}
              y={TOP_PAD + CHART_H + 40}
              textAnchor="middle"
              fontSize={10}
              fill="currentColor"
              className="text-muted-foreground"
            >
              {s.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export const SectorStrip: React.FC = () => {
  const { data, isLoading } = useQuery<SectorIndex[]>({
    queryKey: ["sector-indices"],
    queryFn: getSectorIndices,
    staleTime: 1000 * 60 * 30,
  });

  if (!isLoading && (!data || data.length === 0)) return null;

  return (
    <div>
      <h2 className="font-display font-semibold text-[15px] mb-3">類股走勢（今日）</h2>
      {isLoading ? (
        <Skeleton className="h-48 w-full rounded-xl" />
      ) : (
        <div className="overflow-x-auto [scrollbar-width:none]">
          <SectorBarChart data={data!} />
        </div>
      )}
    </div>
  );
};
