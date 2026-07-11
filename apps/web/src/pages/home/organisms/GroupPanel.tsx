import { useState, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import type { Group, StockPrice, Valuation, ReorderItem, DispositionFlag, EtfPremium } from "@taiwan-stock/api-client";
import { StockSearchCombobox } from "@/shared/ui/molecules/stock-search-combobox";
import { StockRow } from "../molecules/StockRow";
import { SublabelRow } from "../molecules/SublabelRow";
import { SublabelModal } from "../molecules/SublabelModal";
import { ROW_GRID } from "../row-grid";

type Props = {
  group: Group;
  prices: Record<string, StockPrice>;
  valuations: Record<string, Valuation>;
  flags: Record<string, DispositionFlag>;
  premiums: Record<string, EtfPremium>;
  selectedSymbol?: string;
  onStockClick: (symbol: string) => void;
  onRemoveStock: (id: number) => void;
  onAddStock: (symbol: string) => void;
  onNoteChange: (stockId: number, note: string | null) => void;
  onCreateSublabel: (label: string) => void;
  onRenameSublabel: (id: number, label: string) => void;
  onDeleteSublabel: (id: number) => void;
  onReorder: (items: ReorderItem[]) => void;
};

type LocalItem = { key: string; type: "stock" | "sublabel"; id: number };

export const GroupPanel: React.FC<Props> = ({
  group, prices, valuations, flags, premiums, selectedSymbol,
  onStockClick, onRemoveStock, onAddStock, onNoteChange,
  onCreateSublabel, onRenameSublabel, onDeleteSublabel, onReorder,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [localItems, setLocalItems] = useState<LocalItem[]>([]);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const dragSrc = useRef<string | null>(null);

  useEffect(() => {
    setLocalItems(
      group.items.map(item => ({
        key: `${item._type}-${item.id}`,
        type: item._type,
        id: item.id,
      }))
    );
  }, [group.items]);

  const handleDrop = (e: React.DragEvent, targetKey: string) => {
    e.preventDefault();
    const srcKey = dragSrc.current;
    if (!srcKey || srcKey === targetKey) { setDragOverKey(null); return; }
    const next = [...localItems];
    const si = next.findIndex(x => x.key === srcKey);
    const ti = next.findIndex(x => x.key === targetKey);
    const [moved] = next.splice(si, 1);
    next.splice(ti, 0, moved);
    setLocalItems(next);
    onReorder(next.map(x => ({ type: x.type, id: x.id })));
    setDragOverKey(null);
    dragSrc.current = null;
  };

  const itemMap = Object.fromEntries(group.items.map(i => [`${i._type}-${i.id}`, i]));
  const stockMap = Object.fromEntries(group.stocks.map(s => [s.id, s]));

  return (
    <div className="@container flex-1 flex flex-col h-full overflow-hidden relative">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold">{group.name}</h2>
          <span className="text-xs text-muted-foreground">{group.stocks.length} 支</span>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-1 transition-colors flex items-center gap-1"
        >
          <Plus size={11} /> 次標
        </button>
      </div>

      {(() => {
        const priced = group.stocks.filter(s => prices[s.symbol]);
        const gainers = priced.filter(s => prices[s.symbol].change_pct > 0).length;
        const losers  = priced.filter(s => prices[s.symbol].change_pct < 0).length;
        const flat    = priced.filter(s => prices[s.symbol].change_pct === 0).length;
        if (priced.length === 0) return null;
        return (
          <div className="px-5 py-2 border-b border-border shrink-0 flex items-center gap-3 text-xs">
            <span className="text-gain font-medium">{gainers} 漲</span>
            <span className="text-loss font-medium">{losers} 跌</span>
            {flat > 0 && <span className="text-muted-foreground">{flat} 平</span>}
          </div>
        );
      })()}
      <div className={`grid gap-3 px-4 @lg:px-5 py-2 border-b border-border shrink-0 text-[11px] text-muted-foreground ${ROW_GRID}`}>
        <span className="hidden @lg:block" />
        <span>股票</span>
        <span className="text-right">現價</span>
        <span className="hidden @lg:block text-right">漲跌</span>
        <span className="text-right">漲跌%</span>
        <span className="hidden @lg:block text-right">成交量</span>
        <span className="hidden @3xl:block text-right">本益比</span>
        <span className="hidden @3xl:block text-right">殖利率</span>
        <span className="hidden @lg:block" />
      </div>

      <div className="flex-1 overflow-y-auto">
        {localItems.length === 0 && (
          <div className="px-5 py-10 text-sm text-muted-foreground text-center">尚無股票，從下方搜尋加入</div>
        )}
        {localItems.map(li => {
          const raw = itemMap[li.key];
          if (!raw) return null;

          const dragProps = {
            onDragStart: (e: React.DragEvent) => { e.dataTransfer.effectAllowed = "move"; dragSrc.current = li.key; },
            onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragOverKey(li.key); },
            onDrop: (e: React.DragEvent) => handleDrop(e, li.key),
            isDragOver: dragOverKey === li.key,
          };

          if (raw._type === "sublabel") {
            return (
              <SublabelRow
                key={li.key}
                item={raw}
                onRename={label => onRenameSublabel(raw.id, label)}
                onDelete={() => onDeleteSublabel(raw.id)}
                {...dragProps}
              />
            );
          }

          const s = stockMap[raw.id];
          if (!s) return null;
          return (
            <StockRow
              key={li.key}
              s={s}
              price={prices[s.symbol]}
              valuation={valuations[s.symbol]}
              flag={flags[s.symbol]}
              premium={premiums[s.symbol]}
              selected={s.symbol === selectedSymbol}
              onClick={() => onStockClick(s.symbol)}
              onRemove={() => onRemoveStock(s.id)}
              onNoteChange={note => onNoteChange(s.id, note)}
              {...dragProps}
            />
          );
        })}
      </div>

      <div className="px-4 py-3 border-t border-border shrink-0">
        <StockSearchCombobox placeholder="搜尋股票加入…" onSelect={onAddStock} />
      </div>

      {showModal && (
        <SublabelModal onConfirm={onCreateSublabel} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
};
