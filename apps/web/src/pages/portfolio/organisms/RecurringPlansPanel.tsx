import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getRecurringPlans,
  getPortfolioAccounts,
  updateRecurringPlan,
  deleteRecurringPlan,
  type RecurringPlan,
} from "@taiwan-stock/api-client";
import { Pause, Pencil, Play, Trash2 } from "lucide-react";
import { formatPrice } from "@/shared/lib/format";
import { Button } from "@/shared/ui/atoms/button";
import { Skeleton } from "@/shared/ui/atoms/skeleton";
import { PlanModal } from "../molecules/PlanModal";

const feeText = (p: RecurringPlan): string => {
  if (p.fee_mode === "fixed") return `手續費 ${formatPrice(p.fee_value)}`;
  if (p.fee_mode === "rate") return `手續費 ${p.fee_value}%${p.fee_min ? `（低 ${formatPrice(p.fee_min)}）` : ""}`;
  return "免手續費";
};

export const RecurringPlansPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["portfolio", "plans"], queryFn: getRecurringPlans });
  const { data: accounts } = useQuery({ queryKey: ["portfolio", "accounts"], queryFn: getPortfolioAccounts });
  const [modalTarget, setModalTarget] = useState<RecurringPlan | "new" | null>(null);

  const accountName = (id: number): string => accounts?.find(a => a.id === id)?.name ?? "—";

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["portfolio"] });
  const toggleMutation = useMutation({
    mutationFn: (p: RecurringPlan) => updateRecurringPlan(p.id, { active: !p.active }),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({ mutationFn: deleteRecurringPlan, onSuccess: invalidate });

  return (
    <div className="bg-card border border-border rounded-xl flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold">定期定額</h2>
          <span className="text-xs text-muted-foreground">扣款日以當日收盤價估算，待你確認</span>
        </div>
        <Button size="xs" title="新增定期定額計劃" onClick={() => setModalTarget("new")}>＋新增計劃</Button>
      </div>

      {isLoading || !data ? (
        <div className="p-4"><Skeleton className="h-24" /></div>
      ) : data.length === 0 ? (
        <div className="p-6 text-sm text-muted-foreground text-center">尚無定期定額計劃</div>
      ) : (
        <ul className="divide-y divide-border list-none m-0 p-0">
          {data.map(p => (
            <li key={p.id} className={`px-4 py-2.5 flex items-center gap-3 text-sm ${p.active ? "" : "opacity-55"}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-mono font-semibold">{p.symbol}</span>
                  <span className="text-xs text-muted-foreground truncate">{p.name ?? ""}</span>
                  {!p.active && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">已暫停</span>}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  每月 {p.days_of_month.join("、")} 號 · {formatPrice(p.amount)} · {accountName(p.account_id)} · {feeText(p)}
                </div>
                <div className="text-xs text-muted-foreground">下次 {p.next_run_date}</div>
              </div>
              <div className="flex shrink-0">
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={p.active ? "暫停" : "啟用"}
                  title={p.active ? "暫停此計劃（停止扣款）" : "啟用此計劃"}
                  onClick={() => toggleMutation.mutate(p)}
                >
                  {p.active ? <Pause /> : <Play />}
                </Button>
                <Button size="icon-xs" variant="ghost" aria-label="編輯" title="編輯計劃" onClick={() => setModalTarget(p)}>
                  <Pencil />
                </Button>
                <Button size="icon-xs" variant="ghost" aria-label="刪除" title="刪除計劃" onClick={() => deleteMutation.mutate(p.id)}>
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {modalTarget !== null && (
        <PlanModal open initial={modalTarget === "new" ? null : modalTarget} onClose={() => setModalTarget(null)} />
      )}
    </div>
  );
};
