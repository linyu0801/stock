import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPortfolioTransactions,
  deletePortfolioTransaction,
  type PortfolioTransaction,
  type PortfolioSide,
} from "@taiwan-stock/api-client";
import { Coins, Gift, Minus, Pencil, Plus, Search, Trash2, type LucideIcon } from "lucide-react";
import { formatPrice } from "@/shared/lib/format";
import { Button } from "@/shared/ui/atoms/button";
import { Input } from "@/shared/ui/atoms/input";
import { Skeleton } from "@/shared/ui/atoms/skeleton";
import { TransactionModal } from "../molecules/TransactionModal";

const SIDE_META: Record<PortfolioSide, { label: string; Icon: LucideIcon }> = {
  buy: { label: "買進", Icon: Plus },
  sell: { label: "賣出", Icon: Minus },
  dividend: { label: "配息", Icon: Coins },
  stock_dividend: { label: "配股", Icon: Gift },
};

const FILTERS: { value: PortfolioSide | "all"; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "buy", label: "買進" },
  { value: "sell", label: "賣出" },
  { value: "dividend", label: "配息" },
  { value: "stock_dividend", label: "配股" },
];

const cashImpact = (t: PortfolioTransaction): number | null => {
  if (t.side === "buy") return -(t.quantity * t.price + t.fee);
  if (t.side === "sell" || t.side === "dividend") return t.quantity * t.price - t.fee - t.tax;
  return null;
};

const subText = (t: PortfolioTransaction): string => {
  if (t.side === "stock_dividend") return `配發 ${t.quantity.toLocaleString("zh-TW")} 單位`;
  if (t.side === "dividend") return `${t.quantity.toLocaleString("zh-TW")} × 每單位 ${formatPrice(t.price)}`;
  return `${t.quantity.toLocaleString("zh-TW")} @ ${formatPrice(t.price)}`;
};

export const TransactionsPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["portfolio", "transactions"],
    queryFn: () => getPortfolioTransactions(),
  });
  const [modalTarget, setModalTarget] = useState<PortfolioTransaction | "new" | null>(null);
  const [keyword, setKeyword] = useState("");
  const [filter, setFilter] = useState<PortfolioSide | "all">("all");

  const deleteMutation = useMutation({
    mutationFn: deletePortfolioTransaction,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["portfolio"] }),
  });

  const kw = keyword.trim().toUpperCase();
  const filtered = (data ?? []).filter(t =>
    (filter === "all" || t.side === filter) &&
    (kw === "" || t.symbol.toUpperCase().includes(kw) || (t.note ?? "").toUpperCase().includes(kw))
  );

  return (
    <div className="bg-card border border-border rounded-xl flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">交易紀錄</h2>
        <Button size="xs" onClick={() => setModalTarget("new")}>＋新增交易</Button>
      </div>

      <div className="px-4 py-2.5 border-b border-border flex flex-col gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="搜尋標的或備註"
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map(f => (
            <Button
              key={f.value}
              size="xs"
              variant={filter === f.value ? "secondary" : "ghost"}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading || !data ? (
        <div className="p-4"><Skeleton className="h-24" /></div>
      ) : filtered.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground text-center">
          {data.length === 0 ? "尚無交易紀錄" : "沒有符合條件的紀錄"}
        </div>
      ) : (
        <ul className="divide-y divide-border list-none m-0 p-0 max-h-96 overflow-y-auto">
          {filtered.map(t => {
            const { label, Icon } = SIDE_META[t.side];
            const impact = cashImpact(t);
            return (
              <li key={t.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                <span className="size-8 shrink-0 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <Icon size={14} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono font-semibold">{t.symbol}</span>
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {subText(t)} · {t.traded_at}{t.note ? ` · ${t.note}` : ""}
                  </div>
                </div>
                <span className="text-xs tabular-nums shrink-0">{impact == null ? "—" : formatPrice(impact)}</span>
                <div className="flex shrink-0">
                  <Button size="icon-xs" variant="ghost" aria-label="編輯" onClick={() => setModalTarget(t)}>
                    <Pencil />
                  </Button>
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label="刪除"
                    onClick={() => { if (confirm(`刪除 ${t.symbol} ${t.traded_at} 這筆交易？`)) deleteMutation.mutate(t.id); }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {modalTarget !== null && (
        <TransactionModal
          open
          initial={modalTarget === "new" ? null : modalTarget}
          onClose={() => setModalTarget(null)}
        />
      )}
    </div>
  );
};
