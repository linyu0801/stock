import { useParams, Link } from "@tanstack/react-router";
import { ChartPanel } from "@/widgets/chart-panel";

export default function StockPage() {
  const { id } = useParams({ from: "/stock/$id" });
  return (
    <div className="mx-auto max-w-5xl p-8">
      <div className="mb-4 flex items-center gap-4">
        <Link to="/" className="text-sm text-muted-foreground hover:underline">← 自選股</Link>
        <h1 className="text-2xl font-bold font-mono">{id}</h1>
      </div>
      <ChartPanel symbol={id} />
    </div>
  );
}
