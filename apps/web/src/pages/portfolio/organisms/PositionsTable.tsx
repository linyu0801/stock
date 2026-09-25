import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getPortfolioPositions, type Position, type PortfolioSide } from "@taiwan-stock/api-client";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { formatPrice, formatPercent, gainLossClass } from "@/shared/lib/format";
import { Skeleton } from "@/shared/ui/atoms/skeleton";
import { Button } from "@/shared/ui/atoms/button";
import { LeverageModal } from "../molecules/LeverageModal";
import { TransactionModal } from "../molecules/TransactionModal";

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

type ActionsProps = {
  onTrade: (side: PortfolioSide) => void;
  onLeverage: () => void;
};

const RowActions: React.FC<ActionsProps> = ({ onTrade, onLeverage }) => (
  <div className="flex flex-wrap gap-2">
    <Button size="xs" onClick={() => onTrade("sell")}>賣出</Button>
    <Button size="xs" variant="secondary" onClick={() => onTrade("buy")}>買進</Button>
    <Button size="xs" variant="ghost" onClick={onLeverage}>調整槓桿</Button>
  </div>
);

type FactorProps = { p: Position };

const FactorChip: React.FC<FactorProps> = ({ p }) =>
  p.factor === 1 && !p.factor_overridden ? (
    <span className="text-muted-foreground">—</span>
  ) : (
    <span
      className="rounded-full bg-accent text-accent-foreground px-1.5 py-0.5 text-[11px] font-semibold"
      title={p.factor_overridden ? "手動設定的倍數" : "由代號自動判定"}
    >
      {p.factor}x{p.factor_overridden ? "*" : ""}
    </span>
  );

type SymbolProps = { symbol: string };

const SymbolLink: React.FC<SymbolProps> = ({ symbol }) => (
  <Link
    to="/stock/$id"
    params={{ id: symbol }}
    onClick={e => e.stopPropagation()}   // 列本身是展開觸發器，點代號只導頁
    className="font-mono font-semibold no-underline text-foreground hover:text-primary"
  >
    {symbol}
  </Link>
);

export const PositionsTable: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["portfolio", "positions"],
    queryFn: getPortfolioPositions,
  });
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tradeTarget, setTradeTarget] = useState<{ symbol: string; side: PortfolioSide } | null>(null);
  const [leverageTarget, setLeverageTarget] = useState<Position | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "symbol", dir: 1 });
  const [collapsed, setCollapsed] = useState(false);

  const toggleSort = (key: SortKey) =>
    setSort(s => s.key === key
      ? { key, dir: (s.dir * -1) as 1 | -1 }
      : { key, dir: key === "symbol" ? 1 : -1 });

  const toggleExpand = (symbol: string) => setExpanded(s => (s === symbol ? null : symbol));

  const rowKeyDown = (e: React.KeyboardEvent, symbol: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleExpand(symbol);
    }
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
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        aria-expanded={!collapsed}
        aria-controls="positions-body"
        className={`w-full px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-left cursor-pointer hover:bg-accent/40 transition-colors rounded-t-xl ${collapsed ? "rounded-b-xl" : "border-b border-border"}`}
      >
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <ChevronDown size={14} className={`transition-transform duration-200 motion-reduce:transition-none ${collapsed ? "-rotate-90" : ""}`} />
          庫存
        </span>
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
      </button>
      <div id="positions-body">
        {!collapsed && (
          <>
      {/* 桌面：表格 */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground border-b border-border">
              {sortableTh("symbol", "標的", "left")}
              <th className="text-right px-3 py-2 font-normal">數量</th>
              <th className="text-right px-3 py-2 font-normal">均價</th>
              {sortableTh("close", "現價", "right")}
              <th className="text-right px-3 py-2 font-normal">成本</th>
              <th className="text-right px-3 py-2 font-normal">市值</th>
              {sortableTh("pct", "未實現損益", "right")}
              <th className="text-right px-3 py-2 font-normal">已實現</th>
              {sortableTh("factor", "槓桿", "right")}
            </tr>
          </thead>
          <tbody>
            {sorted.map(p => {
              const pct = unrealizedPctOf(p);
              const open = expanded === p.symbol;
              return (
                <Fragment key={p.symbol}>
                  <tr
                    role="button"
                    tabIndex={0}
                    aria-expanded={open}
                    onClick={() => toggleExpand(p.symbol)}
                    onKeyDown={e => rowKeyDown(e, p.symbol)}
                    className={`border-b border-border cursor-pointer transition-colors hover:bg-muted/40 ${open ? "bg-muted/40" : ""}`}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <ChevronDown
                          size={12}
                          className={`shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none ${open ? "" : "-rotate-90"}`}
                        />
                        <SymbolLink symbol={p.symbol} />
                        {p.currency === "USD" && (
                          <span className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">USD</span>
                        )}
                      </div>
                      <div className="pl-[18px] text-xs text-muted-foreground">{p.name}</div>
                    </td>
                    <td className="text-right px-3 py-2 tabular-nums">{p.quantity.toLocaleString("zh-TW")}</td>
                    <td className="text-right px-3 py-2 tabular-nums">{formatPrice(p.avg_cost)}</td>
                    <td className="text-right px-3 py-2 tabular-nums">{fmt(p.close)}</td>
                    <td className="text-right px-3 py-2 tabular-nums">
                      <div>{fmt(p.avg_cost * p.quantity)}</div>
                      {p.currency === "USD" && p.cost_twd != null && (
                        <div className="text-xs text-muted-foreground">≈ {formatPrice(p.cost_twd)}</div>
                      )}
                    </td>
                    <td className="text-right px-3 py-2 tabular-nums">
                      <div>{fmt(p.market_value)}</div>
                      {p.currency === "USD" && p.market_value_twd != null && (
                        <div className="text-xs text-muted-foreground">≈ {formatPrice(p.market_value_twd)}</div>
                      )}
                    </td>
                    <td className={`text-right px-3 py-2 tabular-nums ${p.unrealized != null ? gainLossClass(p.unrealized) : ""}`}>
                      <div>{pct == null ? "—" : formatPercent(pct)}</div>
                      {p.unrealized != null && <div className="text-xs opacity-75">{formatPrice(p.unrealized)}</div>}
                      {p.currency === "USD" && p.unrealized_twd != null && (
                        <div className="text-xs opacity-60">≈ {formatPrice(p.unrealized_twd)}</div>
                      )}
                    </td>
                    <td className={`text-right px-3 py-2 tabular-nums ${gainLossClass(p.realized)}`}>{formatPrice(p.realized)}</td>
                    <td className="text-right px-3 py-2 tabular-nums"><FactorChip p={p} /></td>
                  </tr>
                  {open && (
                    <tr className="border-b border-border bg-muted/40">
                      <td colSpan={9} className="px-5 pb-3 pt-1">
                        <RowActions
                          onTrade={side => setTradeTarget({ symbol: p.symbol, side })}
                          onLeverage={() => setLeverageTarget(p)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 手機：卡片列 */}
      <ul className="md:hidden divide-y divide-border list-none m-0 p-0">
        {sorted.map(p => {
          const pct = unrealizedPctOf(p);
          const open = expanded === p.symbol;
          return (
            <li key={p.symbol}>
              <div
                role="button"
                tabIndex={0}
                aria-expanded={open}
                onClick={() => toggleExpand(p.symbol)}
                onKeyDown={e => rowKeyDown(e, p.symbol)}
                className={`px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors ${open ? "bg-muted/40" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <ChevronDown
                      size={12}
                      className={`shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none ${open ? "" : "-rotate-90"}`}
                    />
                    <SymbolLink symbol={p.symbol} />
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
                    {p.quantity.toLocaleString("zh-TW")} · 均 {formatPrice(p.avg_cost)} · 現 {p.close == null ? "—" : formatPrice(p.close)} · 成本 {formatPrice(p.avg_cost * p.quantity)}
                  </div>
                </div>
                <div className={`text-right tabular-nums ${p.unrealized != null ? gainLossClass(p.unrealized) : ""}`}>
                  <div className="text-sm font-medium">{pct == null ? "—" : formatPercent(pct)}</div>
                  {p.unrealized != null && <div className="text-xs opacity-75">{formatPrice(p.unrealized)}</div>}
                  {p.currency === "USD" && p.unrealized_twd != null && (
                    <div className="text-xs opacity-60">≈ {formatPrice(p.unrealized_twd)}</div>
                  )}
                </div>
              </div>
              {open && (
                <div className="px-6 pb-3 bg-muted/40">
                  <RowActions
                    onTrade={side => setTradeTarget({ symbol: p.symbol, side })}
                    onLeverage={() => setLeverageTarget(p)}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
          </>
        )}
      </div>

      {tradeTarget && (
        <TransactionModal open initial={null} prefill={tradeTarget} onClose={() => setTradeTarget(null)} />
      )}
      {leverageTarget && (
        <LeverageModal
          open
          symbol={leverageTarget.symbol}
          factor={leverageTarget.factor}
          overridden={leverageTarget.factor_overridden}
          onClose={() => setLeverageTarget(null)}
        />
      )}
    </div>
  );
};
