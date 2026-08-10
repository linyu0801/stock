import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createRecurringPlan,
  updateRecurringPlan,
  getPortfolioAccounts,
  type RecurringPlan,
  type RecurringFeeMode,
  type RecurringPlanInput,
} from "@taiwan-stock/api-client";
import { Button } from "@/shared/ui/atoms/button";
import { Input } from "@/shared/ui/atoms/input";
import { Select } from "@/shared/ui/atoms/select";
import { StockSearchCombobox } from "@/shared/ui/molecules/stock-search-combobox";

type Props = {
  open: boolean;
  onClose: () => void;
  initial: RecurringPlan | null; // null = 新增
};

const selectAll = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();

// 字母開頭（AAPL…）為美股 → USD；純數字為台股 → TWD。金額以標的幣別計，跨幣別扣款由後端換算
const symbolCurrency = (s: string): "TWD" | "USD" => (/^[A-Za-z]/.test(s.trim()) ? "USD" : "TWD");

const FEE_OPTIONS: { value: RecurringFeeMode; label: string }[] = [
  { value: "none", label: "無" },
  { value: "fixed", label: "固定金額" },
  { value: "rate", label: "成交比例 %" },
];

const ALL_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export const PlanModal: React.FC<Props> = ({ open, onClose, initial }) => {
  const queryClient = useQueryClient();
  const { data: accounts } = useQuery({ queryKey: ["portfolio", "accounts"], queryFn: getPortfolioAccounts });

  const [symbol, setSymbol] = useState(initial?.symbol ?? "");
  const [accountId, setAccountId] = useState<number | null>(initial?.account_id ?? null);
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [days, setDays] = useState<number[]>(initial?.days_of_month ?? [1]);
  const [feeMode, setFeeMode] = useState<RecurringFeeMode>(initial?.fee_mode ?? "none");
  const [feeValue, setFeeValue] = useState(initial ? String(initial.fee_value) : "");
  const [feeMin, setFeeMin] = useState(initial ? String(initial.fee_min) : "");
  const [error, setError] = useState<string | null>(null);

  const assetAccounts = (accounts ?? []).filter(a => a.kind === "asset");
  const amountNum = Number(amount) || 0;
  const selectedAccount = assetAccounts.find(a => a.id === accountId) ?? null;

  const toggleDay = (d: number) =>
    setDays(prev => (prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]));

  const mutation = useMutation({
    mutationFn: () => {
      const payload: RecurringPlanInput = {
        symbol: symbol.trim().toUpperCase(),
        account_id: accountId as number,
        amount: amountNum,
        fee_mode: feeMode,
        fee_value: feeMode === "none" ? 0 : Number(feeValue) || 0,
        fee_min: feeMode === "rate" ? Number(feeMin) || 0 : 0,
        days_of_month: [...days].sort((a, b) => a - b),
      };
      return initial ? updateRecurringPlan(initial.id, payload) : createRecurringPlan(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      onClose();
    },
    onError: () => setError("送出失敗，請重試"),
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card border border-border shadow-xl p-5 space-y-3 w-full rounded-t-2xl sm:w-96 sm:rounded-xl max-h-[90dvh] overflow-y-auto">
        <h3 className="font-semibold text-sm">{initial ? "編輯定期定額" : "新增定期定額"}</h3>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          標的
          <StockSearchCombobox value={symbol} onChange={setSymbol} onSelect={setSymbol} placeholder="代碼或名稱…" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          每期投入金額{symbol.trim() ? `（${symbolCurrency(symbol)}）` : ""}
          <Input type="number" inputMode="decimal" onFocus={selectAll} value={amount} onChange={e => setAmount(e.target.value)} />
        </label>

        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          每月扣款日（可多選）
          <div className="grid grid-cols-7 gap-1">
            {ALL_DAYS.map(d => {
              const on = days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  title={d >= 29 ? `${d} 號（遇小月以當月最後一天扣款）` : `${d} 號`}
                  onClick={() => toggleDay(d)}
                  className={`h-7 rounded-md text-xs tabular-nums border transition-colors ${
                    on
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
          {days.some(d => d >= 29) && <span>29–31 遇小月以當月最後一天扣款</span>}
        </div>

        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          扣款帳戶
          <div className="flex flex-wrap gap-1.5">
            {assetAccounts.length === 0 && <span className="text-muted-foreground">請先建立資產科目</span>}
            {assetAccounts.map(a => {
              const active = accountId === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAccountId(a.id)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {a.name}<span className="opacity-60 ml-1">{a.currency}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            手續費
            <Select value={feeMode} onValueChange={v => setFeeMode(v as RecurringFeeMode)} options={FEE_OPTIONS} />
          </label>
          {feeMode !== "none" && (
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              {feeMode === "fixed" ? "每期手續費" : "費率 %"}
              <Input type="number" inputMode="decimal" onFocus={selectAll} value={feeValue} onChange={e => setFeeValue(e.target.value)} />
            </label>
          )}
          {feeMode === "rate" && (
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              最低手續費
              <Input type="number" inputMode="decimal" onFocus={selectAll} value={feeMin} onChange={e => setFeeMin(e.target.value)} />
            </label>
          )}
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>取消</Button>
          <Button
            size="sm"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !symbol.trim() || amountNum <= 0 || selectedAccount == null || days.length === 0}
          >
            {initial ? "儲存" : "新增"}
          </Button>
        </div>
      </div>
    </div>
  );
};
