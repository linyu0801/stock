import { useState } from "react";
import { GripVertical, Tag, Check, X } from "lucide-react";
import type { StockPrice } from "@taiwan-stock/api-client";
import { ChangeLabel } from "../atoms/ChangeLabel";

function fmtVolume(shares: number): string {
  if (shares === 0) return "—";
  const lots = Math.round(shares / 1000);
  if (lots >= 10000) return `${(lots / 10000).toFixed(1)}萬`;
  if (lots >= 1000)  return `${(lots / 1000).toFixed(1)}K`;
  return String(lots);
}

type DragProps = {
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragOver: boolean;
};

type Props = {
  s: { id: number; symbol: string; name: string; note: string | null };
  price?: StockPrice;
  selected?: boolean;
  onClick: () => void;
  onRemove: () => void;
  onNoteChange: (note: string | null) => void;
} & DragProps;

export const StockRow: React.FC<Props> = ({ s, price, selected, onClick, onRemove, onNoteChange, onDragStart, onDragOver, onDrop, isDragOver }) => {
  const [editingNote, setEditingNote] = useState(false);
  const [noteVal, setNoteVal] = useState("");

  const openNote = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNoteVal(s.note ?? "");
    setEditingNote(true);
  };

  const commitNote = () => {
    const n = noteVal.trim() || null;
    if (n !== s.note) onNoteChange(n);
    setEditingNote(false);
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`group transition-colors border-b border-transparent
        ${isDragOver ? "border-b-primary/50 bg-accent/20" : selected ? "bg-accent/40" : "hover:bg-muted/40"}`}
    >
      <div className="grid items-center gap-3 px-4 @lg:px-5 py-2.5 @lg:py-2 grid-cols-[minmax(0,1fr)_72px_76px] @lg:grid-cols-[16px_1fr_72px_64px_80px_72px_40px]">
        <GripVertical size={12} className="hidden @lg:block text-muted-foreground/30 cursor-grab shrink-0" />
        <button className="text-left min-w-0" onClick={onClick}>
          <span className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold tabular-nums shrink-0">{s.symbol}</span>
            {s.note && (
              <span className="text-[11px] text-accent-foreground bg-accent px-1.5 py-0.5 rounded truncate">{s.note}</span>
            )}
          </span>
          <span className="block text-xs text-muted-foreground truncate">{s.name}</span>
        </button>
        <span className="text-sm text-right tabular-nums cursor-pointer" onClick={onClick}>
          {price ? price.close.toFixed(2) : "—"}
        </span>
        <span className="hidden @lg:block text-right tabular-nums text-xs cursor-pointer" onClick={onClick}>
          {price ? (
            <span className={price.change >= 0 ? "text-gain" : "text-loss"}>
              {price.change >= 0 ? "+" : ""}{price.change.toFixed(2)}
            </span>
          ) : <span className="text-muted-foreground">—</span>}
        </span>
        <span className="text-right cursor-pointer" onClick={onClick}>
          {price ? <ChangeLabel value={price.change_pct} /> : <span className="text-muted-foreground">—</span>}
        </span>
        <span className="hidden @lg:block text-right text-xs text-muted-foreground tabular-nums cursor-pointer" onClick={onClick}>
          {price ? fmtVolume(price.volume) : "—"}
        </span>
        <div className="hidden @lg:flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100">
          <button onClick={openNote} className="text-muted-foreground hover:text-foreground transition-colors">
            <Tag size={12} />
          </button>
          <button onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors">
            <X size={12} />
          </button>
        </div>
      </div>
      {editingNote && (
        <div className="flex items-center gap-2 px-5 pb-2">
          <input
            autoFocus
            value={noteVal}
            onChange={e => setNoteVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") commitNote(); if (e.key === "Escape") setEditingNote(false); }}
            placeholder="tag…"
            className="flex-1 text-xs bg-input border border-ring/50 rounded px-2 py-1 outline-none text-foreground"
          />
          <button onClick={commitNote} className="text-primary"><Check size={12} /></button>
          <button onClick={() => setEditingNote(false)} className="text-muted-foreground"><X size={12} /></button>
        </div>
      )}
    </div>
  );
};
