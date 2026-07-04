import { useState } from "react";
import { GripVertical, Pencil, Check, Trash2, X } from "lucide-react";
import type { Group } from "@taiwan-stock/api-client";

type Props = {
  group: Group;
  active: boolean;
  onClick: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  isDragOver: boolean;
};

export const GroupTab: React.FC<Props> = ({ group, active, onClick, onRename, onDelete, onDragStart, onDragOver, onDrop, isDragOver }) => {
  const [editing, setEditing] = useState(false);
  const [nameVal, setNameVal] = useState(group.name);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setNameVal(group.name);
    setEditing(true);
  };

  const commitRename = () => {
    const n = nameVal.trim();
    if (n && n !== group.name) onRename(n);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="px-2 py-1.5 rounded-lg bg-accent/50 space-y-1.5">
        <input
          autoFocus
          value={nameVal}
          onChange={e => setNameVal(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-full bg-input border border-ring/50 rounded px-2 py-1 text-xs outline-none text-foreground"
        />
        <div className="flex gap-1">
          <button
            onClick={commitRename}
            className="flex-1 flex items-center justify-center gap-1 text-xs py-1 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
          >
            <Check size={11} /> 確認
          </button>
          <button
            onClick={() => { onDelete(); setEditing(false); }}
            className="flex items-center justify-center gap-1 px-2 py-1 rounded text-xs text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 size={11} />
          </button>
          <button
            onClick={() => setEditing(false)}
            className="flex items-center justify-center px-2 py-1 rounded text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            <X size={11} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={`group flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer transition-colors select-none
        ${active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted/50"}
        ${isDragOver ? "border border-primary/50 bg-accent/30" : "border border-transparent"}`}
      onClick={onClick}
    >
      <GripVertical size={12} className="shrink-0 opacity-30 cursor-grab" />
      <span className={`flex-1 truncate text-sm ${active ? "font-semibold" : ""}`}>{group.name}</span>
      <span className="text-[11px] text-muted-foreground shrink-0">{group.stocks.length}</span>
      <button onClick={startEdit} className="flex items-center justify-center w-4 h-4 text-muted-foreground hover:text-foreground transition-colors shrink-0">
        <Pencil size={11} />
      </button>
    </div>
  );
};
