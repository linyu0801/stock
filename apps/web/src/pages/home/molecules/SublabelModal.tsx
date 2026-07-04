import { useState } from "react";
import { Button } from "@/shared/ui/atoms/button";

type Props = {
  onConfirm: (label: string) => void;
  onClose: () => void;
};

export const SublabelModal: React.FC<Props> = ({ onConfirm, onClose }) => {
  const [input, setInput] = useState("");

  const confirm = () => {
    const label = input.trim();
    if (label) onConfirm(label);
    onClose();
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card border border-border rounded-xl shadow-xl p-5 w-72 space-y-4">
        <h3 className="font-semibold text-sm">新增次標</h3>
        <input
          autoFocus
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") confirm(); if (e.key === "Escape") onClose(); }}
          placeholder="例如：TGV、CoWoS…"
          className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-ring"
        />
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={onClose}>取消</Button>
          <Button size="sm" onClick={confirm}>新增</Button>
        </div>
      </div>
    </div>
  );
};
