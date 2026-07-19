import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPortfolioAccounts,
  deletePortfolioAccount,
  type PortfolioAccount,
} from "@taiwan-stock/api-client";
import { Pencil, Trash2 } from "lucide-react";
import { formatPrice } from "@/shared/lib/format";
import { Button } from "@/shared/ui/atoms/button";
import { Skeleton } from "@/shared/ui/atoms/skeleton";
import { AccountModal } from "../molecules/AccountModal";
import { ConfirmDialog } from "../molecules/ConfirmDialog";

const KIND_LABELS = { asset: "資產", liability: "負債" } as const;

const accountSub = (a: PortfolioAccount): string | null => {
  const parts: string[] = [];
  if (a.rate != null) parts.push(`利率 ${a.rate}%`);
  if (a.due_date != null) parts.push(`${a.due_date} 到期`);
  return parts.length ? parts.join(" · ") : null;
};

export const AccountsPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["portfolio", "accounts"], queryFn: getPortfolioAccounts });
  const [modalTarget, setModalTarget] = useState<PortfolioAccount | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PortfolioAccount | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: deletePortfolioAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      setDeleteTarget(null);
      setDeleteError(null);
    },
    onError: (err: unknown) => {
      setDeleteError(
        err instanceof Error && err.message.includes("409")
          ? "科目有交易連動紀錄，先刪相關交易"
          : "刪除失敗，請重試"
      );
    },
  });

  if (isLoading || !data) {
    return <div className="bg-card border border-border rounded-xl p-4"><Skeleton className="h-24" /></div>;
  }

  const renderGroup = (kind: "asset" | "liability") => {
    const accounts = data.filter(a => a.kind === kind);
    return (
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-medium text-muted-foreground">{KIND_LABELS[kind]}</h3>
        {accounts.length === 0 && <p className="text-xs text-muted-foreground">尚無科目</p>}
        {accounts.map(a => {
          const sub = accountSub(a);
          return (
            <div key={a.id} className="flex items-center gap-2.5 rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <span className={`w-1 self-stretch rounded-full ${kind === "asset" ? "bg-cat-cash" : "bg-cat-liability"}`} />
              <div className="flex-1 min-w-0">
                <div className="truncate">{a.name}</div>
                {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
              </div>
              <span className="tabular-nums">{formatPrice(a.balance)}</span>
              <div className="flex shrink-0">
                <Button size="icon-xs" variant="ghost" aria-label="編輯" onClick={() => setModalTarget(a)}>
                  <Pencil />
                </Button>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="刪除"
                  onClick={() => { setDeleteTarget(a); setDeleteError(null); }}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">科目</h2>
        <Button size="xs" onClick={() => setModalTarget("new")}>＋新增科目</Button>
      </div>
      {renderGroup("asset")}
      {renderGroup("liability")}

      {modalTarget !== null && (
        <AccountModal
          open
          initial={modalTarget === "new" ? null : modalTarget}
          onClose={() => setModalTarget(null)}
        />
      )}
      <ConfirmDialog
        open={deleteTarget !== null}
        title={`刪除科目「${deleteTarget?.name ?? ""}」？`}
        description="手動增減紀錄會一併刪除"
        error={deleteError}
        pending={deleteMutation.isPending}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget.id); }}
        onClose={() => { setDeleteTarget(null); setDeleteError(null); }}
      />
    </div>
  );
};
