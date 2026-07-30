import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/shared/ui/atoms/button";
import { Input } from "@/shared/ui/atoms/input";

type Props = {
  title: string;
  fieldLabel: string;
  initialValue: string;
  placeholder?: string;
  onSave: (value: string) => Promise<unknown>;
  onDelete?: () => void;
  onClose: () => void;
};

export const EditModal: React.FC<Props> = ({
  title, fieldLabel, initialValue, placeholder, onSave, onDelete, onClose,
}) => {
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const v = value.trim();
    if (v === initialValue.trim()) { onClose(); return; }
    setBusy(true);
    setError(null);
    try {
      await onSave(v);
      onClose();
    } catch {
      setError("儲存失敗，請重試");
      setBusy(false);
    }
  };

  const remove = () => {
    onDelete?.();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card border border-border shadow-xl p-5 space-y-3 w-full rounded-t-2xl sm:w-80 sm:rounded-xl">
        <h3 className="font-semibold text-sm">{title}</h3>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {fieldLabel}
          <Input
            autoFocus
            value={value}
            placeholder={placeholder}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") onClose(); }}
          />
        </label>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <div className="flex items-center justify-between gap-2 pt-1">
          {onDelete ? (
            <Button variant="ghost" size="sm" onClick={remove} disabled={busy} className="text-destructive hover:bg-destructive/10">
              <Trash2 size={12} /> 刪除
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>取消</Button>
            <Button size="sm" onClick={save} disabled={busy}>儲存</Button>
          </div>
        </div>
      </div>
    </div>
  );
};
