import { useState } from "react";
import type { Group, StockPrice } from "@taiwan-stock/api-client";
import { Button } from "../atoms/button";
import { Badge } from "../atoms/badge";
import { StockSearchCombobox } from "../molecules/stock-search-combobox";

interface Props {
  groups: Group[];
  prices: Record<string, StockPrice>;
  onStockClick: (symbol: string) => void;
  onRemoveStock: (stockId: number) => void;
  onRemoveGroup: (groupId: number) => void;
  onAddStock: (symbol: string, groupId: number) => void;
  onRenameGroup: (groupId: number, name: string) => void;
}

export function WatchlistTable({
  groups, prices, onStockClick, onRemoveStock, onRemoveGroup, onAddStock, onRenameGroup,
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
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-4 py-1 text-xs text-muted-foreground">
                <span>股票</span>
                <span className="text-right">現價</span>
                <span className="text-right">漲跌幅</span>
                <span />
              </div>
              {group.stocks.map((s) => {
                const p = prices[s.symbol];
                return (
                  <div
                    key={s.id}
                    className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 px-4 py-2 hover:bg-muted/30"
                  >
                    <button className="text-left" onClick={() => onStockClick(s.symbol)}>
                      <span className="font-mono text-sm font-medium">{s.symbol}</span>
                      {p && <span className="ml-2 text-xs text-muted-foreground">{p.name}</span>}
                    </button>
                    <span className="font-mono text-sm">
                      {p ? p.close.toFixed(2) : "—"}
                    </span>
                    <span
                      className="text-sm font-medium"
                      style={{ color: !p ? undefined : p.change_pct >= 0 ? "#ef4444" : "#22c55e" }}
                    >
                      {p ? `${p.change_pct >= 0 ? "+" : ""}${p.change_pct.toFixed(2)}%` : "—"}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => onRemoveStock(s.id)}>
                      移除
                    </Button>
                  </div>
                );
              })}
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
