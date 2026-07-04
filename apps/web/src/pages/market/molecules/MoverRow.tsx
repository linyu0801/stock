import { useNavigate } from "@tanstack/react-router";
import type { Mover } from "@taiwan-stock/api-client";

type Props = { item: Mover; rank: number };

export const MoverRow: React.FC<Props> = ({ item, rank }) => {
  const nav = useNavigate();
  const isGain = item.change_pct >= 0;

  return (
    <div
      onClick={() => nav({ to: "/stock/$id", params: { id: item.symbol } })}
      className="grid items-center gap-3 px-4 py-2.5 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
      style={{ gridTemplateColumns: "24px 56px 1fr 72px 72px" }}
    >
      <span className="text-xs text-muted-foreground tabular-nums">{rank}</span>
      <span className="text-sm font-semibold tabular-nums">{item.symbol}</span>
      <span className="text-xs text-muted-foreground truncate">{item.name}</span>
      <span className="text-sm text-right tabular-nums">{item.close.toFixed(2)}</span>
      <span className={`text-sm font-semibold text-right tabular-nums ${isGain ? "text-gain" : "text-loss"}`}>
        {isGain ? "+" : ""}{item.change_pct.toFixed(2)}%
      </span>
    </div>
  );
};
