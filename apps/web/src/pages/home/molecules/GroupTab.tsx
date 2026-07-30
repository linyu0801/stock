import { useState } from "react";
import { GripVertical, Pencil } from "lucide-react";
import type { Group } from "@taiwan-stock/api-client";
import { EditModal } from "./EditModal";

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

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
  };

  return (
    <>
      {editing && (
        <EditModal
          title="編輯分組"
          fieldLabel="名稱"
          initialValue={group.name}
          onSave={async name => onRename(name)}
          onDelete={onDelete}
          onClose={() => setEditing(false)}
        />
      )}
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
    </>
  );
};
