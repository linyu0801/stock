import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { useGroups } from '@/features/manage-groups/use-groups';
import {
  getStockPrices,
  type StockPrice,
  type Group,
} from '@taiwan-stock/api-client';
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
  const { group: groupFromUrl } = useSearch({ from: '/watchlist' });
  const [activeId, setActiveId] = useState<number | null>(groupFromUrl ?? null);
  const [addingNew, setAddingNew] = useState(false);
  const [groupOrder, setGroupOrder] = useState<number[]>([]);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const dragSrc = useRef<number | null>(null);

  // keep local DnD order in sync with server (preserves drag order, appends new groups)
  useEffect(() => {
    setGroupOrder((prev) => {
      const ids = groups.map((g) => g.id);
      const kept = prev.filter((id) => ids.includes(id));
      const added = ids.filter((id) => !kept.includes(id));
      return [...kept, ...added];
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

  const sortedGroups = groupOrder
    .map((id) => groups.find((g) => g.id === id))
    .filter((g): g is Group => g !== undefined);

  // auto-select first; fall back gracefully when active group is deleted
  const resolvedActiveId = activeId ?? sortedGroups[0]?.id ?? null;
  const activeGroup =
    sortedGroups.find((g) => g.id === resolvedActiveId) ?? sortedGroups[0];

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
    <div className="flex h-full bg-background">
      <div className="w-full max-w-[20rem] shrink-0 border-r border-border flex flex-col">
        <div className="px-4 py-4 border-b border-border shrink-0 flex items-center justify-between">
          <span className="font-bold text-[15px]">自選股</span>
          <button
            onClick={() => setAddingNew(true)}
            className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <Plus size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {addingNew && (
            <NewGroupInput
              onConfirm={(name) => {
                createGroup(name);
                setAddingNew(false);
              }}
              onCancel={() => setAddingNew(false)}
            />
          )}
          {sortedGroups.map((g) => (
            <GroupTab
              key={g.id}
              group={g}
              active={g.id === resolvedActiveId}
              onClick={() => {
                setActiveId(g.id);
                navigate({
                  to: '/watchlist',
                  search: { group: g.id },
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
          ))}
        </div>
      </div>

      {activeGroup ? (
        <GroupPanel
          key={activeGroup.id}
          group={activeGroup}
          prices={prices}
          onStockClick={(symbol) =>
            navigate({ to: '/stock/$id', params: { id: symbol } })
          }
          onRemoveStock={removeStock}
          onAddStock={(symbol) => addStock(symbol, activeGroup.id)}
          onNoteChange={(stockId, note) => updateStockNote(stockId, note)}
          onCreateSublabel={(label) => createSublabel(activeGroup.id, label)}
          onRenameSublabel={(id, label) => updateSublabel(id, label)}
          onDeleteSublabel={(id) => deleteSublabel(id)}
          onReorder={(items) => reorderGroupItems(activeGroup.id, items)}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
          點擊左上角 <Plus size={12} className="mx-1" /> 新增分組
        </div>
      )}
    </div>
  );
};

export default HomePage;
