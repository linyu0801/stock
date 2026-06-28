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

function ChangeLabel({ value }: { value: number }) {
  const color = value >= 0 ? "#ef4444" : "#22c55e";
  const sign = value >= 0 ? "+" : "";
  return <span style={{ color, fontWeight: 500, fontSize: 13 }}>{sign}{value.toFixed(2)}%</span>;
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

          {/* Group header */}
          <div className="flex items-center gap-2 px-4 py-3">
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
            <Badge variant="secondary">{group.stocks.length}</Badge>
            <Button variant="ghost" size="sm" onClick={() => startRename(group)}>改名</Button>
            <Button variant="ghost" size="sm" onClick={() => onRemoveGroup(group.id)}>刪除</Button>
          </div>

          {/* Expanded stock list */}
          {expanded[group.id] && (
            <div className="border-t">
              {/* Column header */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 72px 84px 56px", gap: "0 8px" }}
                className="px-4 py-1 text-xs text-muted-foreground">
                <span>股票</span>
                <span style={{ textAlign: "right" }}>現價</span>
                <span style={{ textAlign: "right" }}>漲跌幅</span>
                <span />
              </div>

              {group.stocks.map((s) => {
                const p = prices[s.symbol];
                return (
                  <div
                    key={s.id}
                    style={{ display: "grid", gridTemplateColumns: "1fr 72px 84px 56px", gap: "0 8px", alignItems: "center" }}
                    className="px-4 py-2 hover:bg-muted/30"
                  >
                    <button className="text-left" onClick={() => onStockClick(s.symbol)}>
                      <span className="font-mono text-sm font-semibold">{s.symbol}</span>
                      {p && <span className="ml-2 text-xs text-muted-foreground">{p.name}</span>}
                    </button>
                    <span style={{ textAlign: "right", fontFamily: "monospace", fontSize: 13 }}>
                      {p ? p.close.toFixed(2) : "—"}
                    </span>
                    <span style={{ textAlign: "right" }}>
                      {p ? <ChangeLabel value={p.change_pct} /> : <span className="text-muted-foreground">—</span>}
                    </span>
                    <span style={{ textAlign: "right" }}>
                      <Button variant="ghost" size="sm" onClick={() => onRemoveStock(s.id)}>移除</Button>
                    </span>
                  </div>
                );
              })}

              {/* Add stock */}
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
