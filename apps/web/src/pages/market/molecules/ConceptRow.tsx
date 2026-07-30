import { Link } from "@tanstack/react-router";
import type { ConceptStock } from "@taiwan-stock/api-client";
import { LimitBadge } from "@/shared/ui/atoms/limit-badge";
import { AddToGroupButton } from "./AddToGroupButton";

type Props = { item: ConceptStock };

export const ConceptRow: React.FC<Props> = ({ item }) => {
  const pct = item.change_pct;
  const isGain = (pct ?? 0) >= 0;

  return (
    <div className="grid items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 hover:bg-muted/50 transition-colors grid-cols-[minmax(0,1fr)_64px_68px_36px] sm:grid-cols-[56px_1fr_72px_72px_36px]">
      <Link
        to="/stock/$id"
        params={{ id: item.symbol }}
        className="min-w-0 no-underline text-foreground sm:contents"
      >
        <span className="block sm:inline text-sm font-semibold tabular-nums">{item.symbol}</span>
        <span className="block sm:inline text-xs text-muted-foreground truncate">{item.name}</span>
      </Link>
      <span className="text-sm text-right tabular-nums">
        {item.close != null ? item.close.toFixed(2) : "—"}
      </span>
      {pct != null ? (
        <span className="flex flex-col items-end gap-0.5">
          <span className={`text-sm font-semibold text-right tabular-nums ${isGain ? "text-gain" : "text-loss"}`}>
            {isGain ? "+" : ""}{pct.toFixed(2)}%
          </span>
          <LimitBadge limit={item.limit} />
        </span>
      ) : (
        <span className="text-sm text-right text-muted-foreground">—</span>
      )}
      <AddToGroupButton symbol={item.symbol} />
    </div>
  );
};
