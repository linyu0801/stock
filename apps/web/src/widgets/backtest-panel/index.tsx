import { useState, useEffect, useRef } from "react";
import { createChart, ColorType, LineData } from "lightweight-charts";
import { useBacktest } from "@/features/run-backtest/use-backtest";
import { Input } from "@/shared/ui/atoms/input";
import { Button } from "@/shared/ui/atoms/button";
import { StatCard } from "@/shared/ui/molecules/stat-card";
import { Skeleton } from "@/shared/ui/atoms/skeleton";
import { formatPercent } from "@/shared/lib/format";

export const BacktestPanel: React.FC = () => {
  const { result, loading, error, execute } = useBacktest();
  const [form, setForm] = useState({
    symbol: "2330",
    start: "2022-01-01",
    end: "2024-12-31",
    buy_threshold: -5,
    sell_threshold: 5,
    n: 20,
  });
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!result || !chartRef.current) return;
    const chart = createChart(chartRef.current, {
      layout: { background: { type: ColorType.Solid, color: "#09090b" }, textColor: "#e4e4e7" },
      grid: { vertLines: { color: "#27272a" }, horzLines: { color: "#27272a" } },
      width: chartRef.current.clientWidth,
      height: 300,
    });
    const series = chart.addLineSeries({ color: "#6366f1", lineWidth: 2, title: "淨值曲線" });
    series.setData(result.equity_curve as LineData[]);
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [result]);

  const set = (k: string, v: string | number) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div>
          <label className="text-xs text-muted-foreground">股票代碼</label>
          <Input value={form.symbol} onChange={(e) => set("symbol", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">開始日期</label>
          <Input type="date" value={form.start} onChange={(e) => set("start", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">結束日期</label>
          <Input type="date" value={form.end} onChange={(e) => set("end", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">買入乖離率 ≤</label>
          <Input type="number" value={form.buy_threshold} onChange={(e) => set("buy_threshold", Number(e.target.value))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">賣出乖離率 ≥</label>
          <Input type="number" value={form.sell_threshold} onChange={(e) => set("sell_threshold", Number(e.target.value))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">均線 N 日</label>
          <Input type="number" value={form.n} onChange={(e) => set("n", Number(e.target.value))} />
        </div>
      </div>

      <Button onClick={() => execute(form)} disabled={loading}>
        {loading ? "計算中…" : "執行回測"}
      </Button>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading && <Skeleton className="h-[300px] w-full" />}

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatCard label="總報酬率" value={formatPercent(result.total_return_pct)} />
            <StatCard label="交易次數" value={result.trade_count} />
          </div>

          <div ref={chartRef} className="w-full" />

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="pb-2 text-left">買入日</th>
                  <th className="pb-2 text-right">買入價</th>
                  <th className="pb-2 text-left">賣出日</th>
                  <th className="pb-2 text-right">賣出價</th>
                  <th className="pb-2 text-right">報酬</th>
                </tr>
              </thead>
              <tbody>
                {result.trades.map((t, i) => (
                  <tr key={i} className="border-b hover:bg-muted/30">
                    <td className="py-1">{t.buy_time}</td>
                    <td className="py-1 text-right font-mono">{t.buy_price.toFixed(2)}</td>
                    <td className="py-1">{t.sell_time}</td>
                    <td className="py-1 text-right font-mono">{t.sell_price.toFixed(2)}</td>
                    <td className={`py-1 text-right ${t.return_pct >= 0 ? "text-gain" : "text-loss"}`}>
                      {formatPercent(t.return_pct)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
