import { useState } from "react";
import { GripVertical, Tag, X } from "lucide-react";
import type { StockPrice, Valuation, DispositionFlag, EtfPremium } from "@taiwan-stock/api-client";
import { ChangeLabel } from "../atoms/ChangeLabel";
import { ROW_GRID } from "../row-grid";
import { formatVolume } from "@/shared/lib/format";
import { EditModal } from "./EditModal";

type DragProps = {
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragOver: boolean;
};

type Props = {
  s: { id: number; symbol: string; name: string; note: string | null };
  price?: StockPrice;
  valuation?: Valuation;
  flag?: DispositionFlag;
  premium?: EtfPremium;
  selected?: boolean;
  onClick: () => void;
  onRemove: () => void;
  onNoteChange: (note: string | null) => void;
} & DragProps;

export const StockRow: React.FC<Props> = ({ s, price, valuation, flag, premium, selected, onClick, onRemove, onNoteChange, onDragStart, onDragOver, onDrop, isDragOver }) => {
  const [editingNote, setEditingNote] = useState(false);

  const openNote = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNote(true);
  };

  return (
    <>
      {editingNote && (
        <EditModal
          title={`編輯標籤 · ${s.symbol}`}
          fieldLabel="標籤"
          initialValue={s.note ?? ""}
          placeholder="例如：定期定額、觀察中…"
          onSave={async v => onNoteChange(v || null)}
          onDelete={s.note ? () => onNoteChange(null) : undefined}
          onClose={() => setEditingNote(false)}
        />
      )}
      <div
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`group transition-colors border-b border-transparent
          ${isDragOver ? "border-b-primary/50 bg-accent/20" : selected ? "bg-accent/40" : "hover:bg-muted/40"}`}
      >
        <div className={`grid items-center gap-3 px-4 @lg:px-5 py-2.5 @lg:py-2 ${ROW_GRID}`}>
          <GripVertical size={12} className="hidden @lg:block text-muted-foreground/30 cursor-grab shrink-0" />
          <button className="text-left min-w-0" onClick={onClick}>
            <span className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-semibold tabular-nums shrink-0">{s.symbol}</span>
              {flag && (
                <span className={`text-[10px] font-medium px-1 py-px rounded-sm border shrink-0 ${
                  flag.level === "disposal" ? "border-violet-500/60 text-violet-400" : "border-amber-500/60 text-amber-400"
                }`}>
                  {flag.level === "disposal" ? "處" : "注"}
                </span>
              )}
              {s.note && (
                <span className="text-[11px] text-sky-300 bg-sky-500/15 px-1.5 py-0.5 rounded truncate">{s.note}</span>
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
            {price ? <ChangeLabel value={price.change_pct} limit={price.limit} /> : <span className="text-muted-foreground">—</span>}
          </span>
          <span className="hidden @lg:block text-right text-xs text-muted-foreground tabular-nums cursor-pointer" onClick={onClick}>
            {price ? formatVolume(price.volume) : "—"}
          </span>
          <span className="hidden @3xl:block text-right text-xs text-muted-foreground tabular-nums cursor-pointer" onClick={onClick}>
            {premium ? (
              <span title="折溢價" className={premium.premium_pct >= 0 ? "text-gain" : "text-loss"}>
                {premium.premium_pct >= 0 ? "+" : ""}{premium.premium_pct.toFixed(2)}%
              </span>
            ) : valuation?.pe != null ? valuation.pe.toFixed(1) : "—"}
          </span>
          <span className="hidden @3xl:block text-right text-xs text-muted-foreground tabular-nums cursor-pointer" onClick={onClick}>
            {valuation?.dividend_yield != null ? `${valuation.dividend_yield.toFixed(1)}%` : "—"}
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
      </div>
    </>
  );
};
