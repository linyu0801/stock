import { useEffect, useRef } from "react";
import { createChart, CandlestickData, LineData, ColorType } from "lightweight-charts";
import type { OHLCVBar, IndicatorPoint } from "@taiwan-stock/api-client";
import { useTheme, type Theme } from "@/shared/lib/theme";

const CHART_PALETTE: Record<Theme, {
  text: string; grid: string; zero: string; up: string; down: string;
}> = {
  dark:  { text: "#6B6B85", grid: "#1E1E30", zero: "#3F3F55", up: "#FF4560", down: "#00C896" },
  light: { text: "#6A6688", grid: "#E3E0EF", zero: "#B9B5CC", up: "#DB2745", down: "#008A6C" },
};

const MA_CONFIGS = [
  { n: 5,  color: "#3b82f6", label: "MA5 週線"  },
  { n: 10, color: "#f59e0b", label: "MA10"       },
  { n: 20, color: "#a855f7", label: "MA20 月線"  },
  { n: 60, color: "#ec4899", label: "MA60 季線"  },
] as const;

function calcMA(bars: OHLCVBar[], n: number): LineData[] {
  return bars.flatMap((bar, i) => {
    if (i < n - 1) return [];
    const avg = bars.slice(i - n + 1, i + 1).reduce((s, b) => s + b.close, 0) / n;
    return [{ time: bar.time as LineData["time"], value: Math.round(avg * 100) / 100 }];
  });
}

type CandlestickChartProps = {
  bars: OHLCVBar[];
  height?: number;
};

export const CandlestickChart: React.FC<CandlestickChartProps> = ({ bars, height = 480 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  const intraday = typeof bars[0]?.time === "number";

  useEffect(() => {
    if (!containerRef.current || !bars.length) return;
    const palette = CHART_PALETTE[theme];

    const chart = createChart(containerRef.current, {
      autoSize: true,
      height,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: palette.text },
      grid: { vertLines: { color: palette.grid }, horzLines: { color: palette.grid } },
      // minBarSpacing 太大會夾住 fitContent，長區間（5y ~1250 根）只顯示得下尾段
      timeScale: { barSpacing: 8, minBarSpacing: 0.5, timeVisible: intraday, secondsVisible: false },
      rightPriceScale: { scaleMargins: { top: 0.08, bottom: 0.08 } },
    });

    for (const { n, color } of MA_CONFIGS) {
      const maData = calcMA(bars, n);
      if (!maData.length) continue;
      const maSeries = chart.addLineSeries({
        color,
        lineWidth: 1,
        title: `MA${n}`,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      maSeries.setData(maData);
    }

    const candleSeries = chart.addCandlestickSeries({
      upColor: palette.up,
      downColor: palette.down,
      borderUpColor: palette.up,
      borderDownColor: palette.down,
      wickUpColor: palette.up,
      wickDownColor: palette.down,
    });
    candleSeries.setData(bars as CandlestickData[]);

    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [bars, theme, height, intraday]);

  if (!bars.length) {
    return <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>載入中…</div>;
  }

  const maLatest: Record<number, number | undefined> = Object.fromEntries(
    MA_CONFIGS.map(({ n }) => [n, calcMA(bars, n).at(-1)?.value]),
  );

  return (
    <div>
      <div ref={containerRef} className="w-full" style={{ height }} />
      <div className="mt-1 flex flex-wrap gap-3 px-1">
        {MA_CONFIGS.filter(({ n }) => maLatest[n] != null).map(({ n, color, label }) => (
          <span key={n} className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
            <span style={{ display: "inline-block", width: 16, height: 2, background: color, borderRadius: 1 }} />
            {/* 盤中是 5 分 K，週線/月線的稱呼不適用 */}
            {intraday ? `MA${n}` : label}
            {` (${maLatest[n]!.toFixed(2)})`}
          </span>
        ))}
      </div>
    </div>
  );
};

type BiasChartProps = {
  biasPoints: IndicatorPoint[];
  biasN: number;
  height?: number;
};

export const BiasChart: React.FC<BiasChartProps> = ({ biasPoints, biasN, height = 160 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();

  useEffect(() => {
    if (!containerRef.current || !biasPoints.length) return;
    const palette = CHART_PALETTE[theme];

    const chart = createChart(containerRef.current, {
      autoSize: true,
      height,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: palette.text },
      grid: { vertLines: { color: palette.grid }, horzLines: { color: palette.grid } },
      timeScale: { barSpacing: 8, minBarSpacing: 0.5 },
      rightPriceScale: { scaleMargins: { top: 0.1, bottom: 0.1 } },
    });

    const series = chart.addLineSeries({
      color: "#f59e0b",
      lineWidth: 1,
      title: `乖離率 ${biasN}日`,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    series.setData(biasPoints as LineData[]);

    series.createPriceLine({ price: 0, color: palette.zero, lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: "" });

    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [biasPoints, biasN, theme, height]);

  if (!biasPoints.length) return null;

  return (
    <div>
      <div className="px-1 py-1 text-xs text-muted-foreground">乖離率 {biasN} 日</div>
      <div ref={containerRef} className="w-full" style={{ height }} />
    </div>
  );
};
