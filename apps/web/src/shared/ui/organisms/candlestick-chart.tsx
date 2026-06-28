import { useEffect, useRef } from "react";
import { createChart, CandlestickData, LineData, ColorType } from "lightweight-charts";
import type { OHLCVBar, IndicatorPoint } from "@taiwan-stock/api-client";

const MA_CONFIGS = [
  { n: 5,  color: "#3b82f6" },
  { n: 10, color: "#f59e0b" },
  { n: 20, color: "#a855f7" },
  { n: 60, color: "#ec4899" },
] as const;

function calcMA(bars: OHLCVBar[], n: number): LineData[] {
  return bars.flatMap((bar, i) => {
    if (i < n - 1) return [];
    const avg = bars.slice(i - n + 1, i + 1).reduce((s, b) => s + b.close, 0) / n;
    return [{ time: bar.time as LineData["time"], value: Math.round(avg * 100) / 100 }];
  });
}

interface Props {
  bars: OHLCVBar[];
  biasPoints: IndicatorPoint[];
  biasN: number;
}

export function CandlestickChart({ bars, biasPoints, biasN }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !bars.length) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      height: 420,
      layout: { background: { type: ColorType.Solid, color: "#09090b" }, textColor: "#e4e4e7" },
      grid: { vertLines: { color: "#27272a" }, horzLines: { color: "#27272a" } },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#ef4444",
      downColor: "#22c55e",
      borderUpColor: "#ef4444",
      borderDownColor: "#22c55e",
      wickUpColor: "#ef4444",
      wickDownColor: "#22c55e",
    });
    candleSeries.setData(bars as CandlestickData[]);

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

    if (biasPoints.length) {
      const biasSeries = chart.addLineSeries({
        color: "#f59e0b",
        lineWidth: 1,
        title: `乖離率 ${biasN}日`,
        pane: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      biasSeries.setData(biasPoints as LineData[]);
    }

    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [bars, biasPoints, biasN]);

  if (!bars.length) {
    return <div className="flex h-[420px] items-center justify-center text-sm text-muted-foreground">載入中…</div>;
  }

  return (
    <div>
      <div ref={containerRef} className="w-full" style={{ height: 420 }} />
      <div className="mt-1 flex gap-3 px-1">
        {MA_CONFIGS.map(({ n, color }) => (
          <span key={n} className="flex items-center gap-1 text-xs">
            <span style={{ display: "inline-block", width: 16, height: 2, background: color, borderRadius: 1 }} />
            MA{n}
          </span>
        ))}
      </div>
    </div>
  );
}
