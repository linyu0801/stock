import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { getConcepts, getConceptStocks, type Concept, type ConceptStock } from "@taiwan-stock/api-client";
import { Skeleton } from "@/shared/ui/atoms/skeleton";
import { ConceptRow } from "../molecules/ConceptRow";

type Props = {
  selected?: string;
  onSelect: (category?: string) => void;
};

export const ConceptSection: React.FC<Props> = ({ selected, onSelect }) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const { data: concepts } = useQuery<Concept[]>({
    queryKey: ["concepts"],
    queryFn: getConcepts,
    staleTime: 1000 * 60 * 60 * 24,
  });

  const { data: stocks, isLoading: stocksLoading } = useQuery<ConceptStock[]>({
    queryKey: ["concept-stocks", selected],
    queryFn: () => getConceptStocks(selected!),
    enabled: !!selected,
    staleTime: 1000 * 60 * 30,
  });

  const filtered = (concepts ?? []).filter((c) =>
    c.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const sorted = [...(stocks ?? [])].sort(
    (a, b) => (b.change_pct ?? -Infinity) - (a.change_pct ?? -Infinity),
  );

  return (
    <div className="bg-card rounded-xl border border-border">
      <div className="px-3 sm:px-4 pt-3 pb-3 flex flex-wrap items-center gap-3">
        <span className="font-display font-semibold text-[15px]">概念股</span>

        {selected && (
          <span className="flex items-center gap-1 pl-3 pr-1.5 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium">
            {selected}
            <button
              onClick={() => onSelect(undefined)}
              aria-label="清除選擇的族群"
              className="w-4 h-4 flex items-center justify-center rounded-full cursor-pointer hover:bg-background/40"
            >
              <X size={11} />
            </button>
          </span>
        )}

        <div className="relative ml-auto w-full sm:w-64">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="搜尋族群（AI、5G、低軌衛星…）"
            className="w-full text-sm bg-input border border-border rounded-lg pl-8 pr-3 py-1.5 outline-none focus:border-ring/60 text-foreground placeholder:text-muted-foreground"
          />
          {open && filtered.length > 0 && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
              <div className="absolute left-0 right-0 top-9 z-50 max-h-72 overflow-y-auto bg-popover border border-border rounded-lg shadow-lg py-1">
                {filtered.map((c) => (
                  <button
                    key={c.category}
                    onClick={() => {
                      onSelect(c.category);
                      setQuery("");
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-sm cursor-pointer hover:bg-muted/60"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {!selected && (
        <div className="px-4 py-10 text-center text-sm text-muted-foreground border-t border-border">
          搜尋並選擇族群，查看成分股與今日表現
        </div>
      )}

      {selected && (
        <>
          <div className="grid gap-2 sm:gap-3 px-3 sm:px-4 py-2 border-y border-border text-[11px] text-muted-foreground grid-cols-[minmax(0,1fr)_64px_68px_36px] sm:grid-cols-[56px_1fr_72px_72px_36px]">
            <span className="sm:hidden">股票</span>
            <span className="hidden sm:block">代號</span>
            <span className="hidden sm:block">名稱</span>
            <span className="text-right">現價</span>
            <span className="text-right">漲跌%</span>
            <span />
          </div>
          {stocksLoading ? (
            <div className="p-4 space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <div className="overflow-hidden rounded-b-xl">
              {sorted.map((s) => <ConceptRow key={s.symbol} item={s} />)}
              {sorted.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">此族群目前沒有成分股資料</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
