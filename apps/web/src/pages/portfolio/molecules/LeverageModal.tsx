import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { setLeverage, clearLeverage } from "@taiwan-stock/api-client";
import { Button } from "@/shared/ui/atoms/button";
import { Input } from "@/shared/ui/atoms/input";

type Props = {
  open: boolean;
  symbol: string;
  factor: number;
  overridden: boolean;
  onClose: () => void;
};

const PRESETS = [1, 2, -1];

export const LeverageModal: React.FC<Props> = ({ open, symbol, factor, overridden, onClose }) => {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(String(factor));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["portfolio"] });

  const saveMutation = useMutation({
    mutationFn: (v: number) => setLeverage(symbol, v),
    onSuccess: () => { invalidate(); onClose(); },
  });
  const restoreMutation = useMutation({
    mutationFn: () => clearLeverage(symbol),
    onSuccess: () => { invalidate(); onClose(); },
  });

  if (!open) return null;

  const num = Number(value);
  const valid = value.trim() !== "" && !Number.isNaN(num) && num !== 0;
  const pending = saveMutation.isPending || restoreMutation.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card border border-border rounded-xl shadow-xl p-5 w-80 max-w-[calc(100vw-2rem)] space-y-3">
        <div>
          <h3 className="font-semibold text-sm">調整槓桿 · {symbol}</h3>
          <p className="mt-1 text-xs text-muted-foreground">曝險＝市值 × 倍數。反向 ETF 用負數。</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setValue(String(p))}
              className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                num === p
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {p}x
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          自訂倍數
          <Input
            type="number"
            step="0.5"
            inputMode="decimal"
            onFocus={e => e.target.select()}
            value={value}
            onChange={e => setValue(e.target.value)}
          />
        </label>

        <div className="flex items-center gap-2 justify-end pt-1">
          {overridden && (
            <Button
              variant="ghost"
              size="sm"
              className="mr-auto"
              disabled={pending}
              onClick={() => restoreMutation.mutate()}
            >
              還原自動判定
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" disabled={!valid || pending} onClick={() => saveMutation.mutate(num)}>儲存</Button>
        </div>
      </div>
    </div>
  );
};
