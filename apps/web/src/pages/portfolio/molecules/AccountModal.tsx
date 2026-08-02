import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
dayjs.extend(customParseFormat);
import {
  createPortfolioAccount,
  updatePortfolioAccount,
  addAccountEntry,
  type PortfolioAccount,
} from "@taiwan-stock/api-client";
import { Button } from "@/shared/ui/atoms/button";
import { Input } from "@/shared/ui/atoms/input";
import { Select } from "@/shared/ui/atoms/select";

const DATE_FORMAT = "YYYY/MM/DD";

type Props = {
  open: boolean;
  onClose: () => void;
  initial: PortfolioAccount | null; // null = 新增
};

const selectAll = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();

export const AccountModal: React.FC<Props> = ({ open, onClose, initial }) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState(initial?.name ?? "");
  const [kind, setKind] = useState<"asset" | "liability">(initial?.kind ?? "asset");
  const [balance, setBalance] = useState(initial ? String(initial.balance) : "");
  const [rate, setRate] = useState(initial?.rate != null ? String(initial.rate) : "");
  const [dueText, setDueText] = useState(initial?.due_date ? dayjs(initial.due_date).format(DATE_FORMAT) : "");
  const [periods, setPeriods] = useState(initial?.periods != null ? String(initial.periods) : "");
  const [currency, setCurrency] = useState<"TWD" | "USD">(initial?.currency ?? "TWD");
  const [error, setError] = useState<string | null>(null);

  const dueTrimmed = dueText.trim();
  const dueParsed = dueTrimmed === "" ? null : dayjs(dueTrimmed, DATE_FORMAT, true);
  const dueInvalid = dueTrimmed !== "" && !dueParsed?.isValid();

  const mutation = useMutation({
    mutationFn: async () => {
      const rateVal = kind === "liability" && rate !== "" ? Number(rate) : null;
      const dueVal = kind === "liability" && dueParsed?.isValid() ? dueParsed.format("YYYY-MM-DD") : null;
      const periodsVal = kind === "liability" && periods !== "" ? Number(periods) : null;
      if (initial) {
        await updatePortfolioAccount(initial.id, { name: name.trim(), rate: rateVal, due_date: dueVal, periods: periodsVal, currency });
        const target = Number(balance);
        if (!Number.isNaN(target) && target !== initial.balance) {
          await addAccountEntry(initial.id, "adjust", target - initial.balance);
        }
      } else {
        await createPortfolioAccount({
          name: name.trim(),
          kind,
          initial_balance: Number(balance) || 0,
          rate: rateVal,
          due_date: dueVal,
          periods: periodsVal,
          currency,
        });
      }
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
      <div className="bg-card border border-border shadow-xl p-5 space-y-3 w-full rounded-t-2xl sm:w-96 sm:rounded-xl">
        <h3 className="font-semibold text-sm">{initial ? "編輯科目" : "新增科目"}</h3>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            名稱
            <Input value={name} onChange={e => setName(e.target.value)} autoFocus={!initial} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            類型
            {initial ? (
              <span className="h-8 flex items-center text-sm text-foreground">
                {initial.kind === "asset" ? "資產" : "負債"}
              </span>
            ) : (
              <Select
                value={kind}
                onValueChange={v => setKind(v as "asset" | "liability")}
                options={[{ value: "asset", label: "資產" }, { value: "liability", label: "負債" }]}
              />
            )}
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {initial ? "餘額" : "初始金額"}
            <Input
              type="number"
              inputMode="decimal"
              onFocus={selectAll}
              value={balance}
              onChange={e => setBalance(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            幣別
            <Select
              value={currency}
              onValueChange={v => setCurrency(v as "TWD" | "USD")}
              options={[{ value: "TWD", label: "台幣" }, { value: "USD", label: "美元" }]}
            />
          </label>
          {kind === "liability" && (
            <>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                利率 %（選填）
                <Input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  onFocus={selectAll}
                  value={rate}
                  onChange={e => setRate(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                到期日（選填）
                <Input
                  value={dueText}
                  onChange={e => setDueText(e.target.value)}
                  placeholder={DATE_FORMAT}
                  aria-invalid={dueInvalid}
                />
                {dueInvalid && <span className="text-destructive">格式需為 {DATE_FORMAT}</span>}
              </label>
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                期數（選填，分期時填）
                <Input
                  type="number"
                  inputMode="numeric"
                  onFocus={selectAll}
                  value={periods}
                  onChange={e => setPeriods(e.target.value)}
                />
              </label>
            </>
          )}
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending || !name.trim() || dueInvalid}>
            {initial ? "儲存" : "新增"}
          </Button>
        </div>
      </div>
    </div>
  );
};
