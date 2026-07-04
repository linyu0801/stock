import { useState } from "react";
import { Check, X } from "lucide-react";

type Props = {
  onConfirm: (name: string) => void;
  onCancel: () => void;
};

export const NewGroupInput: React.FC<Props> = ({ onConfirm, onCancel }) => {
  const [name, setName] = useState("");

  const confirm = () => { if (name.trim()) onConfirm(name.trim()); else onCancel(); };

  return (
    <div className="px-2 py-1.5 rounded-lg border border-primary/40 bg-accent/30 space-y-1.5 mb-0.5">
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") confirm(); if (e.key === "Escape") onCancel(); }}
        placeholder="分組名稱…"
        className="w-full bg-input border border-ring/50 rounded px-2 py-1 text-xs outline-none text-foreground"
      />
      <div className="flex gap-1">
        <button
          onClick={confirm}
          className="flex-1 flex items-center justify-center gap-1 text-xs py-1 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
        >
          <Check size={11} /> 新增
        </button>
        <button onClick={onCancel} className="px-2 py-1 rounded text-xs text-muted-foreground hover:bg-muted/50 transition-colors">
          <X size={11} />
        </button>
      </div>
    </div>
  );
};
