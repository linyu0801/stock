import { Link } from "@tanstack/react-router";
import { BacktestPanel } from "@/widgets/backtest-panel";

export default function BacktestPage() {
  return (
    <div className="mx-auto max-w-4xl p-8">
      <div className="mb-6 flex items-center gap-4">
        <Link to="/" className="text-sm text-muted-foreground hover:underline">← 自選股</Link>
        <h1 className="text-2xl font-bold">回測</h1>
      </div>
      <BacktestPanel />
    </div>
  );
}
