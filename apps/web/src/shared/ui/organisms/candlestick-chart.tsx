import { useEffect, useRef } from "react";
import {
  createChart,
  IChartApi,
  CandlestickData,
  LineData,
  ColorType,
} from "lightweight-charts";
import type { OHLCVBar, IndicatorPoint } from "@taiwan-stock/api-client";

interface Props {
  bars: OHLCVBar[];
  biasPoints: IndicatorPoint[];
  biasN: number;
}

export function CandlestickChart({ bars, biasPoints, biasN }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: "#09090b" }, textColor: "#e4e4e7" },
      grid: { vertLines: { color: "#27272a" }, horzLines: { color: "#27272a" } },
      width: containerRef.current.clientWidth,
      height: 400,
    });
    chartRef.current = chart;

    const candleSeries = chart.addCandlestickSeries({
      upColor: "#ef4444",
      downColor: "#22c55e",
      borderUpColor: "#ef4444",
      borderDownColor: "#22c55e",
      wickUpColor: "#ef4444",
      wickDownColor: "#22c55e",
    });
    candleSeries.setData(bars as CandlestickData[]);

    const biasSeries = chart.addLineSeries({
      color: "#f59e0b",
      lineWidth: 1,
      title: `乖離率 ${biasN}日`,
      pane: 1,
    });
    biasSeries.setData(biasPoints as LineData[]);

    chart.timeScale().fitContent();

    const observer = new ResizeObserver(() => {
      if (containerRef.current) chart.resize(containerRef.current.clientWidth, 400);
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [bars, biasPoints, biasN]);

  return <div ref={containerRef} className="w-full" />;
}
