import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useGroups } from '@/features/manage-groups/use-groups';
import {
  getStockPrices,
  getValuations,
  getDispositionFlags,
  getEtfPremium,
  type StockPrice,
  type StockValuation,
  type Valuation,
  type Group,
  type DispositionFlag,
  type EtfPremium,
} from '@taiwan-stock/api-client';
import { useMediaQuery } from '@/shared/lib/use-media';
import StockDetailPanel from '@/widgets/stock-detail';
import { GroupTab } from './molecules/GroupTab';
import { NewGroupInput } from './molecules/NewGroupInput';
import { GroupPanel } from './organisms/GroupPanel';

const HomePage: React.FC = () => {
  const {
    groups,
    createGroup,
    renameGroup,
    deleteGroup,
    addStock,
    removeStock,
    updateStockNote,
    createSublabel,
    updateSublabel,
    deleteSublabel,
    reorderGroupItems,
  } = useGroups();
  const navigate = useNavigate();
  const { group: groupFromUrl, symbol: symbolFromUrl } = useSearch({ from: '/watchlist' });
  const [activeId, setActiveId] = useState<number | null>(groupFromUrl ?? null);
  const [addingNew, setAddingNew] = useState(false);
  const [groupOrder, setGroupOrder] = useState<number[]>([]);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const dragSrc = useRef<number | null>(null);
  const inlineDetail = useMediaQuery('(min-width: 1280px)');

  // keep local DnD order in sync with server (preserves drag order, appends new groups)
  useEffect(() => {
    setGroupOrder((prev) => {
      const ids = groups.map((g) => g.id);
      const kept = prev.filter((id) => ids.includes(id));
      const added = ids.filter((id) => !kept.includes(id));
      const next = [...kept, ...added];
      return next.length === prev.length && next.every((id, i) => id === prev[i])
        ? prev
        : next;
    });
  }, [groups]);

  const symbols = [
    ...new Set(groups.flatMap((g) => g.stocks.map((s) => s.symbol))),
  ].sort();
  const symbolsKey = symbols.join(',');

  const { data: priceListData } = useQuery<StockPrice[]>({
    queryKey: ['stock-prices', symbolsKey],
    queryFn: () => getStockPrices(symbols),
    enabled: symbols.length > 0,
    staleTime: 1000 * 60,
  });
  const priceList: StockPrice[] = priceListData ?? [];
  const prices: Record<string, StockPrice> = Object.fromEntries(
    priceList.map((p) => [p.symbol, p]),
  );

  const { data: valuationList } = useQuery<StockValuation[]>({
    queryKey: ['valuations', symbolsKey],
    queryFn: () => getValuations(symbols),
    enabled: symbols.length > 0,
    staleTime: 1000 * 60 * 60,
  });
  const valuations: Record<string, Valuation> = Object.fromEntries(
    (valuationList ?? []).map((v) => [v.symbol, v]),
  );

  const etfSymbols = symbols.filter((s) => s.startsWith('00'));

  const { data: flagsData } = useQuery<Record<string, DispositionFlag>>({
    queryKey: ['disposition-flags', symbolsKey],
    queryFn: () => getDispositionFlags(symbols),
    enabled: symbols.length > 0,
    staleTime: 1000 * 60 * 60,
  });
  const flags = flagsData ?? {};

  const { data: premiumsData } = useQuery<Record<string, EtfPremium>>({
    queryKey: ['etf-premiums', etfSymbols.join(',')],
    queryFn: () => getEtfPremium(etfSymbols),
    enabled: etfSymbols.length > 0,
    staleTime: 1000 * 60 * 60,
  });
  const premiums = premiumsData ?? {};

  const sortedGroups = groupOrder
    .map((id) => groups.find((g) => g.id === id))
    .filter((g): g is Group => g !== undefined);

  // auto-select first; fall back gracefully when active group is deleted
  const resolvedActiveId = activeId ?? sortedGroups[0]?.id ?? null;
  const activeGroup =
    sortedGroups.find((g) => g.id === resolvedActiveId) ?? sortedGroups[0];

  // detail 面板顯示的股票：網址指定優先，否則群組第一支
  const detailSymbol = symbolFromUrl ?? activeGroup?.stocks[0]?.symbol;

  const handleStockClick = (symbol: string) => {
    if (inlineDetail) {
      navigate({
        to: '/watchlist',
        search: { group: resolvedActiveId ?? undefined, symbol },
        replace: true,
      });
    } else {
      navigate({ to: '/stock/$id', params: { id: symbol } });
    }
  };

  const handleGroupDrop = (e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    const srcId = dragSrc.current;
    if (srcId === null || srcId === targetId) {
      setDragOverId(null);
      return;
    }
    setGroupOrder((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(arr.indexOf(srcId), 1);
      arr.splice(arr.indexOf(targetId), 0, moved);
      return arr;
    });
    setDragOverId(null);
    dragSrc.current = null;
  };

  return (
    <div className="flex flex-col md:flex-row h-full bg-background">
      {/* 群組欄：手機橫向捲動列，桌機直向側欄 */}
      <div className="shrink-0 border-b md:border-b-0 md:border-r border-border md:w-60 xl:w-52 flex flex-col">
        <div className="px-4 py-3 md:py-4 md:border-b border-border shrink-0 flex items-center justify-between">
          <span className="font-display font-bold text-[15px]">自選股</span>
          <button
            onClick={() => setAddingNew(true)}
            aria-label="新增分組"
            className="w-7 h-7 flex items-center justify-center rounded cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Plus size={15} />
          </button>
        </div>

        <div className="flex md:flex-col md:flex-1 gap-1 md:gap-0.5 md:space-y-0 overflow-x-auto md:overflow-x-visible md:overflow-y-auto px-2 pb-2 md:p-2 [scrollbar-width:none]">
          {addingNew && (
            <div className="shrink-0 min-w-[11rem] md:min-w-0">
              <NewGroupInput
                onConfirm={(name) => {
                  createGroup(name);
                  setAddingNew(false);
                }}
                onCancel={() => setAddingNew(false)}
              />
            </div>
          )}
          {sortedGroups.map((g) => (
            <div key={g.id} className="shrink-0 min-w-[10rem] md:min-w-0">
              <GroupTab
                group={g}
                active={g.id === resolvedActiveId}
                onClick={() => {
                  setActiveId(g.id);
                  navigate({
                    to: '/watchlist',
                    search: { group: g.id, symbol: undefined },
                    replace: true,
                  });
                }}
                onRename={(name) => renameGroup(g.id, name)}
                onDelete={() => {
                  deleteGroup(g.id);
                  if (activeId === g.id) setActiveId(null);
                }}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  dragSrc.current = g.id;
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverId(g.id);
                }}
                onDrop={(e) => handleGroupDrop(e, g.id)}
                isDragOver={dragOverId === g.id}
              />
            </div>
          ))}
        </div>
      </div>

      {activeGroup ? (
        <>
          <div className="flex-1 min-w-0 min-h-0 xl:flex-none xl:w-[520px] 2xl:w-[560px] xl:border-r border-border flex">
            <GroupPanel
              key={activeGroup.id}
              group={activeGroup}
              prices={prices}
              valuations={valuations}
              flags={flags}
              premiums={premiums}
              selectedSymbol={inlineDetail ? detailSymbol : undefined}
              onStockClick={handleStockClick}
              onRemoveStock={removeStock}
              onAddStock={(symbol) => addStock(symbol, activeGroup.id)}
              onNoteChange={(stockId, note) => updateStockNote(stockId, note)}
              onCreateSublabel={(label) => createSublabel(activeGroup.id, label)}
              onRenameSublabel={(id, label) => updateSublabel(id, label)}
              onDeleteSublabel={(id) => deleteSublabel(id)}
              onReorder={(items) => reorderGroupItems(activeGroup.id, items)}
            />
          </div>

          {/* 桌機 inline 個股詳情 */}
          {inlineDetail && (
            <div className="hidden xl:block flex-1 min-w-0 overflow-y-auto px-6 py-5">
              {detailSymbol ? (
                <StockDetailPanel key={detailSymbol} symbol={detailSymbol} variant="inline" />
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  點選左側股票查看走勢
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          點擊左上角 <Plus size={12} className="mx-1" /> 新增分組
        </div>
      )}
    </div>
  );
};

export default HomePage;
