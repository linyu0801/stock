import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useGroups } from "@/features/manage-groups/use-groups";
import { getStockPrices, type StockPrice } from "@taiwan-stock/api-client";
import { WatchlistTable } from "@/shared/ui/organisms/watchlist-table";
import { Input } from "@/shared/ui/atoms/input";
import { Button } from "@/shared/ui/atoms/button";

export function WatchlistSection() {
  const { groups, createGroup, renameGroup, deleteGroup, addStock, removeStock } = useGroups();
  const navigate = useNavigate();
  const [newGroupName, setNewGroupName] = useState("");
  const [prices, setPrices] = useState<Record<string, StockPrice>>({});

  const symbolsKey = [...new Set(groups.flatMap((g) => g.stocks.map((s) => s.symbol)))].sort().join(",");

  useEffect(() => {
    if (!symbolsKey) return;
    const symbols = symbolsKey.split(",");
    getStockPrices(symbols)
      .then((data) => {
        const map: Record<string, StockPrice> = {};
        data.forEach((p) => { map[p.symbol] = p; });
        setPrices(map);
      })
      .catch(() => {});
  }, [symbolsKey]);

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
        prices={prices}
        onStockClick={(symbol) => navigate({ to: "/stock/$id", params: { id: symbol } })}
        onRemoveStock={removeStock}
        onRemoveGroup={deleteGroup}
        onAddStock={addStock}
        onRenameGroup={renameGroup}
      />
    </div>
  );
}
