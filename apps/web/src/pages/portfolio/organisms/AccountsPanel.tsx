import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getPortfolioAccounts,
  createPortfolioAccount,
  deletePortfolioAccount,
  addAccountEntry,
  type PortfolioAccount,
} from "@taiwan-stock/api-client";
import { formatPrice } from "@/shared/lib/format";
import { Button } from "@/shared/ui/atoms/button";
import { Input } from "@/shared/ui/atoms/input";
import { Select } from "@/shared/ui/atoms/select";
import { Skeleton } from "@/shared/ui/atoms/skeleton";

const KIND_LABELS = { asset: "資產", liability: "負債" } as const;

export const AccountsPanel: React.FC = () => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["portfolio", "accounts"], queryFn: getPortfolioAccounts });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [balanceInput, setBalanceInput] = useState("");
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<"asset" | "liability">("asset");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["portfolio"] });

  const adjustMutation = useMutation({
    mutationFn: ({ account, newBalance }: { account: PortfolioAccount; newBalance: number }) =>
      addAccountEntry(account.id, "adjust", newBalance - account.balance),
    onSuccess: () => { invalidate(); setEditingId(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePortfolioAccount,
    onSuccess: invalidate,
    onError: (err: unknown) => {
      if (err instanceof Error && err.message.includes("409")) {
        alert("科目有紀錄，先清空交易/事件");
      }
    },
  });

  const createMutation = useMutation({
    mutationFn: () => createPortfolioAccount(newName.trim(), newKind),
    onSuccess: () => { invalidate(); setNewName(""); },
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
        {accounts.map(a => (
          <div key={a.id} className="flex items-center gap-2.5 rounded-lg bg-muted/40 px-3 py-2 text-sm">
            <span className={`w-1 self-stretch rounded-full ${kind === "asset" ? "bg-cat-cash" : "bg-cat-liability"}`} />
            <span className="flex-1 min-w-0 truncate">{a.name}</span>
            {editingId === a.id ? (
              <>
                <Input
                  type="number"
                  autoFocus
                  value={balanceInput}
                  onChange={e => setBalanceInput(e.target.value)}
                  className="w-28 h-7 text-right text-xs"
                />
                <Button
                  size="xs"
                  onClick={() => {
                    const value = Number(balanceInput);
                    if (!Number.isNaN(value)) adjustMutation.mutate({ account: a, newBalance: value });
                  }}
                >
                  確認
                </Button>
                <Button size="xs" variant="ghost" onClick={() => setEditingId(null)}>取消</Button>
              </>
            ) : (
              <button
                onClick={() => { setEditingId(a.id); setBalanceInput(String(a.balance)); }}
                className="tabular-nums hover:underline"
              >
                {formatPrice(a.balance)}
              </button>
            )}
            <Button
              size="xs"
              variant="ghost"
              onClick={() => { if (confirm(`刪除科目「${a.name}」？`)) deleteMutation.mutate(a.id); }}
            >
              刪除
            </Button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4">
      <h2 className="text-sm font-semibold">科目</h2>
      {renderGroup("asset")}
      {renderGroup("liability")}
      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="科目名稱" className="flex-1" />
        <Select
          value={newKind}
          onValueChange={v => setNewKind(v as "asset" | "liability")}
          options={[{ value: "asset", label: "資產" }, { value: "liability", label: "負債" }]}
          className="w-24 shrink-0"
        />
        <Button size="sm" disabled={!newName.trim() || createMutation.isPending} onClick={() => createMutation.mutate()}>
          新增
        </Button>
      </div>
    </div>
  );
};
