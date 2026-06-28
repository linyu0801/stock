import { useEffect, useRef } from "react";
import { createChart, CandlestickData, LineData, ColorType } from "lightweight-charts";
import type { OHLCVBar, IndicatorPoint } from "@taiwan-stock/api-client";

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

    if (biasPoints.length) {
      const biasSeries = chart.addLineSeries({
        color: "#f59e0b",
        lineWidth: 1,
        title: `乖離率 ${biasN}日`,
        pane: 1,
      });
      biasSeries.setData(biasPoints as LineData[]);
    }

    chart.timeScale().fitContent();

    return () => chart.remove();
  }, [bars, biasPoints, biasN]);

  if (!bars.length) {
    return <div className="flex h-[420px] items-center justify-center text-sm text-muted-foreground">載入中…</div>;
  }

  return <div ref={containerRef} className="w-full" style={{ height: 420 }} />;
}
