import { useState } from "react";
import { GripVertical, Pencil, Check, X } from "lucide-react";
import type { GroupItem } from "@taiwan-stock/api-client";

type Props = {
  item: Extract<GroupItem, { _type: "sublabel" }>;
  onRename: (label: string) => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragOver: boolean;
};

export const SublabelRow: React.FC<Props> = ({ item, onRename, onDelete, onDragStart, onDragOver, onDrop, isDragOver }) => {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(item.label);

  const commit = () => { if (val.trim()) onRename(val.trim()); setEditing(false); };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`group flex items-center gap-2 px-5 py-1.5 transition-colors
        ${isDragOver ? "bg-accent/20" : "hover:bg-muted/20"}`}
    >
      <GripVertical size={12} className="text-muted-foreground/30 cursor-grab shrink-0" />
      {editing ? (
        <>
          <input
            autoFocus
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
            className="flex-1 text-xs bg-input border border-ring/50 rounded px-2 py-0.5 outline-none"
          />
          <button onClick={commit}><Check size={11} className="text-primary" /></button>
          <button onClick={() => setEditing(false)}><X size={11} className="text-muted-foreground" /></button>
        </>
      ) : (
        <>
          <div className="flex-1 flex items-center gap-2">
            <span className="text-[11px] font-semibold text-accent-foreground bg-accent px-2 py-0.5 rounded">{item.label}</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
            <button onClick={() => { setVal(item.label); setEditing(true); }} className="text-muted-foreground hover:text-foreground">
              <Pencil size={11} />
            </button>
            <button onClick={onDelete} className="text-muted-foreground hover:text-destructive">
              <X size={11} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
