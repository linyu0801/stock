import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useGroups } from "@/features/manage-groups/use-groups";
import { WatchlistTable } from "@/shared/ui/organisms/watchlist-table";
import { Input } from "@/shared/ui/atoms/input";
import { Button } from "@/shared/ui/atoms/button";

export function WatchlistSection() {
  const { groups, createGroup, renameGroup, deleteGroup, addStock, removeStock } = useGroups();
  const navigate = useNavigate();
  const [newGroupName, setNewGroupName] = useState("");

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="新分組名稱…"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newGroupName.trim()) {
              createGroup(newGroupName.trim());
              setNewGroupName("");
            }
          }}
        />
        <Button
          onClick={() => {
            if (newGroupName.trim()) {
              createGroup(newGroupName.trim());
              setNewGroupName("");
            }
          }}
        >
          新增分組
        </Button>
      </div>

      <WatchlistTable
        groups={groups}
        onStockClick={(symbol) => navigate({ to: "/stock/$id", params: { id: symbol } })}
        onRemoveStock={removeStock}
        onRemoveGroup={deleteGroup}
        onAddStock={addStock}
        onRenameGroup={renameGroup}
      />
    </div>
  );
}
