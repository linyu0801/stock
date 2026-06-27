import { useState } from "react";
import type { Group } from "@taiwan-stock/api-client";
import { Button } from "../atoms/button";
import { Badge } from "../atoms/badge";

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
  const toggle = (id: number) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  return (
    <div className="space-y-2">
      {groups.map((group) => (
        <div key={group.id} className="rounded-lg border">
          <button
            className="flex w-full items-center justify-between px-4 py-3 font-medium hover:bg-muted/50"
            onClick={() => toggle(group.id)}
          >
            <span>{group.name}</span>
            <Badge variant="secondary">{group.stocks.length}</Badge>
          </button>
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
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
