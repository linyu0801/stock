import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPortfolioPositions, setLeverage, clearLeverage, type Position } from "@taiwan-stock/api-client";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { formatPrice, formatPercent, gainLossClass } from "@/shared/lib/format";
import { Skeleton } from "@/shared/ui/atoms/skeleton";
import { Button } from "@/shared/ui/atoms/button";
import { Input } from "@/shared/ui/atoms/input";

const fmt = (n: number | null) => (n == null ? "—" : formatPrice(n));

const unrealizedPctOf = (p: Position): number | null => {
  const cost = p.avg_cost * p.quantity;
  return p.unrealized != null && cost !== 0 ? (p.unrealized / cost) * 100 : null;
};

type SortKey = "symbol" | "close" | "pct" | "factor";

const sortValOf = (p: Position, key: SortKey): string | number | null => {
  if (key === "symbol") return p.symbol;
  if (key === "close") return p.close;
  if (key === "pct") return unrealizedPctOf(p);
  return p.factor;
};

export const PositionsTable: React.FC = () => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["portfolio", "positions"],
    queryFn: getPortfolioPositions,
  });
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null);
  const [factorInput, setFactorInput] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "symbol", dir: 1 });

  const toggleSort = (key: SortKey) =>
    setSort(s => s.key === key
      ? { key, dir: (s.dir * -1) as 1 | -1 }
      : { key, dir: key === "symbol" ? 1 : -1 });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["portfolio"] });

  const confirmFactor = async (symbol: string) => {
    const value = Number(factorInput);
    if (!Number.isNaN(value)) {
      await setLeverage(symbol, value);
      invalidate();
    }
    setEditingSymbol(null);
  };

  const restoreFactor = async (symbol: string) => {
    await clearLeverage(symbol);
    invalidate();
  };

  if (isLoading || !data) {
    return <Skeleton className="h-40" />;
  }

  if (data.positions.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-sm text-muted-foreground text-center">
        尚無投資部位，先在下方新增交易
      </div>
    );
  }

  const factorCell = (p: Position) =>
    editingSymbol === p.symbol ? (
      <div className="flex items-center justify-end gap-1">
        <Input
          type="number"
          step="0.5"
          autoFocus
          onFocus={e => e.target.select()}
          value={factorInput}
          onChange={e => setFactorInput(e.target.value)}
          className="w-16 h-6 text-right text-xs px-1"
        />
        <Button size="xs" onClick={() => confirmFactor(p.symbol)}>確認</Button>
        <Button size="xs" variant="ghost" onClick={() => setEditingSymbol(null)}>取消</Button>
      </div>
    ) : (
      <div className="flex items-center justify-end gap-1">
        <Button
          size="xs"
          variant="ghost"
          title="槓桿倍數：曝險＝市值×倍數，點擊修改"
          onClick={() => { setEditingSymbol(p.symbol); setFactorInput(String(p.factor)); }}
        >
          {p.factor === 1 && !p.factor_overridden ? "—" : (
            <span className="rounded-full bg-accent text-accent-foreground px-1.5 py-0.5 text-[11px] font-semibold">
              {p.factor}x{p.factor_overridden ? "*" : ""}
            </span>
          )}
        </Button>
        {p.factor_overridden && (
          <Button size="xs" variant="ghost" onClick={() => restoreFactor(p.symbol)}>還原</Button>
        )}
      </div>
    );

  const { gain, loss, net } = data.unrealized;

  const sorted = [...data.positions].sort((a, b) => {
    const va = sortValOf(a, sort.key);
    const vb = sortValOf(b, sort.key);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;   // 無值永遠沉底
    if (vb == null) return -1;
    if (typeof va === "string") return va.localeCompare(vb as string) * sort.dir;
    return (va - (vb as number)) * sort.dir;
  });

  const sortIcon = (key: SortKey) =>
    sort.key !== key
      ? <ChevronsUpDown size={12} className="opacity-40" />
      : sort.dir === 1
        ? <ChevronUp size={12} />
        : <ChevronDown size={12} />;

  const sortableTh = (key: SortKey, label: string, align: "left" | "right") => (
    <th
      className={`px-3 py-2 font-normal ${align === "left" ? "text-left" : "text-right"}`}
      aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
    >
      <button
        onClick={() => toggleSort(key)}
        className={`inline-flex items-center gap-0.5 cursor-pointer hover:text-foreground transition-colors ${sort.key === key ? "text-foreground" : ""}`}
      >
        {align === "right" && sortIcon(key)}
        {label}
        {align === "left" && sortIcon(key)}
      </button>
    </th>
  );

  return (
    <div className="bg-card border border-border rounded-xl">
      <div className="px-4 py-2.5 border-b border-border flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
        <span className="text-muted-foreground">未實現損益</span>
        <span className="tabular-nums">
          <span className="text-muted-foreground">獲利 </span>
          <span className="text-gain">+{formatPrice(gain)}</span>
        </span>
        <span className="tabular-nums">
          <span className="text-muted-foreground">虧損 </span>
          <span className="text-loss">{formatPrice(loss)}</span>
        </span>
        <span className="tabular-nums">
          <span className="text-muted-foreground">合計 </span>
          <span className={`font-medium ${gainLossClass(net)}`}>{net >= 0 ? "+" : ""}{formatPrice(net)}</span>
        </span>
        {data.missing_symbols.length > 0 && (
          <span className="text-muted-foreground">（不含 {data.missing_symbols.join("、")}）</span>
        )}
      </div>
      {/* 桌面：表格 */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground border-b border-border">
              {sortableTh("symbol", "標的", "left")}
              <th className="text-right px-3 py-2 font-normal">數量</th>
              <th className="text-right px-3 py-2 font-normal">均價</th>
              {sortableTh("close", "現價", "right")}
              <th className="text-right px-3 py-2 font-normal">市值</th>
              {sortableTh("pct", "未實現損益", "right")}
              <th className="text-right px-3 py-2 font-normal">已實現</th>
              {sortableTh("factor", "槓桿", "right")}
            </tr>
          </thead>
          <tbody>
            {sorted.map(p => {
              const pct = unrealizedPctOf(p);
              return (
                <tr key={p.symbol} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-semibold">{p.symbol}</span>
                      {p.currency === "USD" && (
                        <span className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">USD</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{p.name}</div>
                  </td>
                  <td className="text-right px-3 py-2 tabular-nums">{p.quantity.toLocaleString("zh-TW")}</td>
                  <td className="text-right px-3 py-2 tabular-nums">{formatPrice(p.avg_cost)}</td>
                  <td className="text-right px-3 py-2 tabular-nums">{fmt(p.close)}</td>
                  <td className="text-right px-3 py-2 tabular-nums">
                    <div>{fmt(p.market_value)}</div>
                    {p.currency === "USD" && p.market_value_twd != null && (
                      <div className="text-xs text-muted-foreground">≈ {formatPrice(p.market_value_twd)}</div>
                    )}
                  </td>
                  <td className={`text-right px-3 py-2 tabular-nums ${p.unrealized != null ? gainLossClass(p.unrealized) : ""}`}>
                    <div>{pct == null ? "—" : formatPercent(pct)}</div>
                    {p.unrealized != null && <div className="text-xs opacity-75">{formatPrice(p.unrealized)}</div>}
                  </td>
                  <td className={`text-right px-3 py-2 tabular-nums ${gainLossClass(p.realized)}`}>{formatPrice(p.realized)}</td>
                  <td className="text-right px-3 py-2 tabular-nums">{factorCell(p)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 手機：卡片列 */}
      <ul className="md:hidden divide-y divide-border list-none m-0 p-0">
        {sorted.map(p => {
          const pct = unrealizedPctOf(p);
          return (
            <li key={p.symbol} className="px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-semibold">{p.symbol}</span>
                  {p.currency === "USD" && (
                    <span className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">USD</span>
                  )}
                  {(p.factor !== 1 || p.factor_overridden) && (
                    <span className="rounded-full bg-accent text-accent-foreground px-1.5 py-0.5 text-[11px] font-semibold">
                      {p.factor}x
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {p.quantity.toLocaleString("zh-TW")} · 均 {formatPrice(p.avg_cost)} · 現 {p.close == null ? "—" : formatPrice(p.close)}
                </div>
              </div>
              <div className={`text-right tabular-nums ${p.unrealized != null ? gainLossClass(p.unrealized) : ""}`}>
                <div className="text-sm font-medium">{pct == null ? "—" : formatPercent(pct)}</div>
                {p.unrealized != null && <div className="text-xs opacity-75">{formatPrice(p.unrealized)}</div>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
