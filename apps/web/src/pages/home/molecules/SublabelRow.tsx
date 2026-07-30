import { useState } from "react";
import { GripVertical, Pencil } from "lucide-react";
import type { GroupItem } from "@taiwan-stock/api-client";
import { EditModal } from "./EditModal";

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

  return (
    <>
      {editing && (
        <EditModal
          title="編輯次標"
          fieldLabel="名稱"
          initialValue={item.label}
          onSave={async label => onRename(label)}
          onDelete={onDelete}
          onClose={() => setEditing(false)}
        />
      )}
      <div
        draggable
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`group flex items-center gap-2 px-5 py-1.5 transition-colors
          ${isDragOver ? "bg-accent/20" : "hover:bg-muted/20"}`}
      >
        <GripVertical size={12} className="text-muted-foreground/30 cursor-grab shrink-0" />
        <div className="flex-1 flex items-center gap-2">
          <span className="text-[11px] font-semibold text-accent-foreground bg-accent px-2 py-0.5 rounded">{item.label}</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <button
          onClick={() => setEditing(true)}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Pencil size={11} />
        </button>
      </div>
    </>
  );
};
