import { useQuery } from "@tanstack/react-query";
import { getSectorIndices, type SectorIndex } from "@taiwan-stock/api-client";
import { Skeleton } from "@/shared/ui/atoms/skeleton";

const BAR_W = 12;
const BAR_GAP = 16;
const SLOT = BAR_W + BAR_GAP;
const SIDE_PAD = 16;
const CHART_H = 130;
const TOP_PAD = 30;
const BOT_PAD = 96;
const SVG_H = CHART_H + TOP_PAD + BOT_PAD;

type ChartProps = { data: SectorIndex[] };

const SectorBarChart: React.FC<ChartProps> = ({ data }) => {
  const validPcts = data.map((d) => d.change_pct ?? 0);
  const maxPct = Math.max(0, ...validPcts);
  const minPct = Math.min(0, ...validPcts);
  const range = maxPct - minPct || 1;
  const baselineY = TOP_PAD + (maxPct / range) * CHART_H;
  const svgW = data.length * SLOT + SIDE_PAD * 2;

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
        const x = SIDE_PAD + i * SLOT;
        const isGain = (pct ?? 0) >= 0;
        const colorClass =
          pct == null ? "text-muted-foreground" : isGain ? "text-gain" : "text-loss";

        let barY = baselineY;
        let barH = 0;
        if (pct != null) {
          if (pct > 0) {
            barH = Math.max((pct / range) * CHART_H, 3);
            barY = baselineY - barH;
          } else if (pct < 0) {
            barH = Math.max((-pct / range) * CHART_H, 3);
            barY = baselineY;
          } else {
            barH = 3;
            barY = baselineY - 1.5;
          }
        }

        const pctText =
          pct != null ? `${isGain ? "+" : ""}${pct.toFixed(2)}%` : "—";
        // 窄欄下相鄰標籤會重疊，奇偶交錯兩層高度
        const lift = i % 2 === 1 ? 10 : 0;
        const pctLabelY =
          pct != null && pct >= 0
            ? barY - 4 - lift
            : Math.min(baselineY + barH + 10, TOP_PAD + CHART_H + 8) + lift;

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
              fontSize={8}
              fill="currentColor"
              className={`${colorClass} tabular-nums`}
            >
              {pctText}
            </text>
            {/* 直排類股名；加權指數用前景色加粗以便辨識 */}
            <text
              x={x + SLOT / 2}
              y={TOP_PAD + CHART_H + 28}
              fontSize={11}
              fill="currentColor"
              fontWeight={s.symbol === "^TWII" ? 700 : 400}
              className={`[writing-mode:vertical-rl] ${s.symbol === "^TWII" ? "text-foreground" : "text-muted-foreground"}`}
              textAnchor="start"
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

  const twii = data?.find((s) => s.symbol === "^TWII");
  const twiiGain = (twii?.change_pct ?? 0) >= 0;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <h2 className="font-display font-semibold text-[15px]">類股走勢（今日）</h2>
        {twii && (
          <span className="flex items-baseline gap-2 px-3 py-1 rounded-full bg-card border border-border text-xs">
            <span className="text-muted-foreground">加權指數</span>
            {twii.close != null && (
              <span className="font-semibold tabular-nums">
                {twii.close.toLocaleString("zh-TW", { maximumFractionDigits: 2 })}
              </span>
            )}
            {twii.change_pct != null && (
              <span className={`font-semibold tabular-nums ${twiiGain ? "text-gain" : "text-loss"}`}>
                {twiiGain ? "▲" : "▼"} {Math.abs(twii.change_pct).toFixed(2)}%
              </span>
            )}
          </span>
        )}
      </div>
      {isLoading ? (
        <Skeleton className="h-56 w-full rounded-xl" />
      ) : (
        <div className="overflow-x-auto pb-1 [scrollbar-width:thin]">
          <SectorBarChart data={data!} />
        </div>
      )}
    </div>
  );
};
