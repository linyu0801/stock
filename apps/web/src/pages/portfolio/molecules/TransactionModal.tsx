import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPortfolioTransaction,
  updatePortfolioTransaction,
  getPortfolioAccounts,
  type PortfolioTransaction,
  type PortfolioSide,
  type TransactionInput,
} from "@taiwan-stock/api-client";
import { Button } from "@/shared/ui/atoms/button";
import { Input } from "@/shared/ui/atoms/input";
import { Select } from "@/shared/ui/atoms/select";

type Props = {
  open: boolean;
  onClose: () => void;
  initial: PortfolioTransaction | null; // null = 新增
};

const SIDE_OPTIONS: { value: PortfolioSide; label: string }[] = [
  { value: "buy", label: "買進" },
  { value: "sell", label: "賣出" },
  { value: "dividend", label: "配息" },
  { value: "stock_dividend", label: "配股" },
];

const todayStr = () => new Date().toISOString().slice(0, 10);

// 台股代號才自動帶台股費率；其他標的（加密貨幣、美股…）費用自填
const isTwSymbol = (s: string) => /^\d{4,6}[A-Z]?$/.test(s.trim().toUpperCase());

export const TransactionModal: React.FC<Props> = ({ open, onClose, initial }) => {
  const queryClient = useQueryClient();
  const { data: accounts } = useQuery({ queryKey: ["portfolio", "accounts"], queryFn: getPortfolioAccounts });

  const [symbol, setSymbol] = useState(initial?.symbol ?? "");
  const [side, setSide] = useState<PortfolioSide>(initial?.side ?? "buy");
  const [tradedAt, setTradedAt] = useState(initial?.traded_at ?? todayStr());
  const [quantity, setQuantity] = useState(initial ? String(initial.quantity) : "");
  const [price, setPrice] = useState(initial ? String(initial.price) : "");
  const [feeDirty, setFeeDirty] = useState(initial != null);
  const [taxDirty, setTaxDirty] = useState(initial != null);
  const [feeRaw, setFeeRaw] = useState(initial ? String(initial.fee) : "");
  const [taxRaw, setTaxRaw] = useState(initial ? String(initial.tax) : "");
  const [accountId, setAccountId] = useState<number | null>(initial?.account_id ?? null);
  const [note, setNote] = useState(initial?.note ?? "");
  const [error, setError] = useState<string | null>(null);

  const qtyNum = Number(quantity) || 0;
  const priceNum = Number(price) || 0;
  const autoFee = isTwSymbol(symbol) && side !== "dividend" && side !== "stock_dividend";
  const feeDefault = autoFee ? Math.round(qtyNum * priceNum * 0.001425) : 0;
  const taxDefault = isTwSymbol(symbol) && side === "sell" ? Math.round(qtyNum * priceNum * 0.003) : 0;
  const fee = feeDirty ? Number(feeRaw) || 0 : feeDefault;
  const tax = taxDirty ? Number(taxRaw) || 0 : taxDefault;
  const showTax = side === "sell" || side === "dividend";

  const mutation = useMutation({
    mutationFn: () => {
      const payload: TransactionInput = {
        symbol: symbol.trim().toUpperCase(),
        side,
        quantity: qtyNum,
        price: priceNum,
        fee,
        tax,
        account_id: accountId,
        traded_at: tradedAt,
        note: note.trim() || null,
      };
      return initial ? updatePortfolioTransaction(initial.id, payload) : createPortfolioTransaction(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      onClose();
    },
    onError: (err: unknown) => {
      const message = err instanceof Error && err.message.includes("400") ? "賣出超過持有數量" : "送出失敗，請重試";
      setError(message);
    },
  });

  if (!open) return null;

  const accountOptions = [
    { value: "", label: "不連動" },
    ...(accounts ?? []).map(a => ({ value: String(a.id), label: a.name })),
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card border border-border shadow-xl p-5 space-y-3 w-full rounded-t-2xl sm:w-96 sm:rounded-xl max-h-[90dvh] overflow-y-auto">
        <h3 className="font-semibold text-sm">{initial ? "編輯交易" : "新增交易"}</h3>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            標的
            <Input value={symbol} onChange={e => setSymbol(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            類型
            <Select
              value={side}
              onValueChange={v => setSide(v as PortfolioSide)}
              options={SIDE_OPTIONS}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            日期
            <Input type="date" value={tradedAt} onChange={e => setTradedAt(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            數量
            <Input type="number" inputMode="decimal" value={quantity} onChange={e => setQuantity(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {side === "dividend" ? "每單位配息" : "價格"}
            <Input type="number" inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            手續費
            <Input
              type="number"
              inputMode="decimal"
              value={feeDirty ? feeRaw : String(feeDefault)}
              onChange={e => { setFeeDirty(true); setFeeRaw(e.target.value); }}
            />
          </label>
          {showTax && (
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              交易稅
              <Input
                type="number"
                inputMode="decimal"
                value={taxDirty ? taxRaw : String(taxDefault)}
                onChange={e => { setTaxDirty(true); setTaxRaw(e.target.value); }}
              />
            </label>
          )}
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            扣款科目
            <Select
              value={accountId == null ? "" : String(accountId)}
              onValueChange={v => setAccountId(v ? Number(v) : null)}
              options={accountOptions}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          備註
          <Input value={note} onChange={e => setNote(e.target.value)} />
        </label>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="ghost" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending || !symbol.trim() || qtyNum <= 0}>
            {initial ? "儲存" : "新增"}
          </Button>
        </div>
      </div>
    </div>
  );
};
