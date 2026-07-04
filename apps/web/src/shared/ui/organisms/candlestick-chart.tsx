import { useEffect, useRef } from "react";
import { createChart, CandlestickData, LineData, ColorType } from "lightweight-charts";
import type { OHLCVBar, IndicatorPoint } from "@taiwan-stock/api-client";

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

interface CandlestickChartProps {
  bars: OHLCVBar[];
}

export function CandlestickChart({ bars }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !bars.length) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      height: 480,
      layout: { background: { type: ColorType.Solid, color: "#09090b" }, textColor: "#e4e4e7" },
      grid: { vertLines: { color: "#27272a" }, horzLines: { color: "#27272a" } },
      timeScale: { barSpacing: 8, minBarSpacing: 3 },
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
      upColor: "#ef4444",
      downColor: "#22c55e",
      borderUpColor: "#ef4444",
      borderDownColor: "#22c55e",
      wickUpColor: "#ef4444",
      wickDownColor: "#22c55e",
    });
    candleSeries.setData(bars as CandlestickData[]);

    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [bars]);

  if (!bars.length) {
    return <div className="flex h-[480px] items-center justify-center text-sm text-muted-foreground">載入中…</div>;
  }

  return (
    <div>
      <div ref={containerRef} className="w-full" style={{ height: 480 }} />
      <div className="mt-1 flex gap-3 px-1">
        {MA_CONFIGS.map(({ n, color, label }) => (
          <span key={n} className="flex items-center gap-1 text-xs text-muted-foreground">
            <span style={{ display: "inline-block", width: 16, height: 2, background: color, borderRadius: 1 }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

interface BiasChartProps {
  biasPoints: IndicatorPoint[];
  biasN: number;
}

export function BiasChart({ biasPoints, biasN }: BiasChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !biasPoints.length) return;

    const chart = createChart(containerRef.current, {
      autoSize: true,
      height: 160,
      layout: { background: { type: ColorType.Solid, color: "#09090b" }, textColor: "#e4e4e7" },
      grid: { vertLines: { color: "#27272a" }, horzLines: { color: "#27272a" } },
      timeScale: { barSpacing: 8, minBarSpacing: 3 },
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

    // zero line
    series.createPriceLine({ price: 0, color: "#52525b", lineWidth: 1, lineStyle: 2, axisLabelVisible: false, title: "" });

    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [biasPoints, biasN]);

  if (!biasPoints.length) return null;

  return (
    <div>
      <div className="px-1 py-1 text-xs text-muted-foreground">乖離率 {biasN} 日</div>
      <div ref={containerRef} className="w-full" style={{ height: 160 }} />
    </div>
  );
}
