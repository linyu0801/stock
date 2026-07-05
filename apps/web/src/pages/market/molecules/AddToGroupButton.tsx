import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { useGroups } from "@/features/manage-groups/use-groups";

type Props = { symbol: string };

export const AddToGroupButton: React.FC<Props> = ({ symbol }) => {
  const { groups, addStock, createGroup } = useGroups();
  const [open, setOpen] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  const handleAdd = (groupId: number) => {
    addStock(symbol, groupId);
    setOpen(false);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  };

  const handleCreateAndAdd = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    const g = await createGroup(name);
    await addStock(symbol, g.id);
    setCreatingGroup(false);
    setNewGroupName("");
    setOpen(false);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  };

  const closePopover = () => {
    setOpen(false);
    setCreatingGroup(false);
    setNewGroupName("");
  };

  return (
    <div className="relative flex justify-end">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={`把 ${symbol} 加入自選股`}
        className={`w-7 h-7 flex items-center justify-center rounded-md cursor-pointer transition-colors ${
          justAdded
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
        }`}
      >
        {justAdded ? <Check size={14} /> : <Plus size={14} />}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={closePopover} />
          <div className="absolute right-0 top-8 z-50 min-w-[10rem] max-h-64 overflow-y-auto bg-popover border border-border rounded-lg shadow-lg py-1">
            {groups.length === 0 && !creatingGroup && (
              <div className="px-3 py-2 text-xs text-muted-foreground">尚無分組</div>
            )}
            {groups.map((g) => {
              const already = g.stocks.some((s) => s.symbol === symbol);
              return (
                <button
                  key={g.id}
                  disabled={already}
                  onClick={() => handleAdd(g.id)}
                  className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between gap-2 ${
                    already
                      ? "text-muted-foreground/60 cursor-default"
                      : "cursor-pointer hover:bg-muted/60"
                  }`}
                >
                  <span className="truncate">{g.name}</span>
                  {already && <Check size={12} className="shrink-0" />}
                </button>
              );
            })}
            <div className="border-t border-border mt-1 pt-1">
              {creatingGroup ? (
                <div className="px-3 py-1.5">
                  <input
                    autoFocus
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateAndAdd();
                      if (e.key === "Escape") { setCreatingGroup(false); setNewGroupName(""); }
                    }}
                    placeholder="分組名稱"
                    className="w-full text-sm bg-input border border-border rounded px-2 py-1 outline-none focus:border-ring/60 text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setCreatingGroup(true); }}
                  className="w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 cursor-pointer hover:bg-muted/60 text-muted-foreground"
                >
                  <Plus size={12} />
                  新增分組
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
