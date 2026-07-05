import { Link } from "@tanstack/react-router";
import type { Mover } from "@taiwan-stock/api-client";
import { formatVolume } from "@/shared/lib/format";
import { AddToGroupButton } from "./AddToGroupButton";

type Props = { item: Mover; rank: number };

export const MoverRow: React.FC<Props> = ({ item, rank }) => {
  const isGain = item.change_pct >= 0;

  return (
    <div className="grid items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 hover:bg-muted/50 transition-colors grid-cols-[16px_minmax(0,1fr)_64px_68px_36px] sm:grid-cols-[24px_56px_1fr_72px_72px_72px_36px]">
      <span className="text-xs text-muted-foreground tabular-nums">{rank}</span>
      <Link
        to="/stock/$id"
        params={{ id: item.symbol }}
        className="min-w-0 no-underline text-foreground sm:contents"
      >
        <span className="block sm:inline text-sm font-semibold tabular-nums">{item.symbol}</span>
        <span className="block sm:inline text-xs text-muted-foreground truncate">{item.name}</span>
      </Link>
      <span className="text-sm text-right tabular-nums">{item.close.toFixed(2)}</span>
      <span className={`text-sm font-semibold text-right tabular-nums ${isGain ? "text-gain" : "text-loss"}`}>
        {isGain ? "+" : ""}{item.change_pct.toFixed(2)}%
      </span>
      <span className="hidden sm:block text-xs text-right text-muted-foreground tabular-nums">
        {formatVolume(item.volume)}
      </span>
      <AddToGroupButton symbol={item.symbol} />
    </div>
  );
};
