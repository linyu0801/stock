import { useState } from "react";
import type { Group } from "@taiwan-stock/api-client";
import { Button } from "../atoms/button";
import { Badge } from "../atoms/badge";
import { StockSearchCombobox } from "../molecules/stock-search-combobox";

interface Props {
  groups: Group[];
  onStockClick: (symbol: string) => void;
  onRemoveStock: (stockId: number) => void;
  onRemoveGroup: (groupId: number) => void;
  onAddStock: (symbol: string, groupId: number) => void;
  onRenameGroup: (groupId: number, name: string) => void;
}

export function WatchlistTable({
  groups, onStockClick, onRemoveStock, onRemoveGroup, onAddStock, onRenameGroup,
}: Props) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [renaming, setRenaming] = useState<Record<number, string>>({});

  const toggle = (id: number) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const startRename = (group: Group) =>
    setRenaming((p) => ({ ...p, [group.id]: group.name }));

  const commitRename = (id: number) => {
    const name = renaming[id]?.trim();
    if (name) onRenameGroup(id, name);
    setRenaming((p) => { const n = { ...p }; delete n[id]; return n; });
  };

  return (
    <div className="space-y-2">
      {groups.map((group) => (
        <div key={group.id} className="rounded-lg border">
          <div className="flex w-full items-center justify-between px-4 py-3">
            {renaming[group.id] !== undefined ? (
              <input
                className="flex-1 bg-transparent text-sm font-medium outline-none"
                value={renaming[group.id]}
                autoFocus
                onChange={(e) => setRenaming((p) => ({ ...p, [group.id]: e.target.value }))}
                onBlur={() => commitRename(group.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename(group.id);
                  if (e.key === "Escape") setRenaming((p) => { const n = { ...p }; delete n[group.id]; return n; });
                }}
              />
            ) : (
              <button className="flex-1 text-left font-medium" onClick={() => toggle(group.id)}>
                {group.name}
              </button>
            )}
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{group.stocks.length}</Badge>
              <Button variant="ghost" size="sm" onClick={() => startRename(group)}>改名</Button>
              <Button variant="ghost" size="sm" onClick={() => onRemoveGroup(group.id)}>刪除</Button>
            </div>
          </div>

          {expanded[group.id] && (
            <div className="border-t">
              {group.stocks.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-4 py-2 hover:bg-muted/30">
                  <button className="text-sm font-mono" onClick={() => onStockClick(s.symbol)}>
                    {s.symbol}
                  </button>
                  <Button variant="ghost" size="sm" onClick={() => onRemoveStock(s.id)}>
                    移除
                  </Button>
                </div>
              ))}
              <div className="px-3 py-2">
                <StockSearchCombobox
                  placeholder="搜尋股票加入…"
                  onSelect={(symbol) => onAddStock(symbol, group.id)}
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
