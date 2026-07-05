import { useState } from "react";
import type { MoversResponse } from "@taiwan-stock/api-client";
import { MoverRow } from "../molecules/MoverRow";

type TabKey = "gainers" | "losers" | "volume";

const TABS: { key: TabKey; label: string }[] = [
  { key: "gainers", label: "漲幅" },
  { key: "losers", label: "跌幅" },
  { key: "volume", label: "成交量" },
];

type Props = { data: MoversResponse };

export const MoverTable: React.FC<Props> = ({ data }) => {
  const [tab, setTab] = useState<TabKey>("gainers");
  const [expanded, setExpanded] = useState(false);
  const items = data[tab];
  const shown = expanded ? items : items.slice(0, 10);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-3 sm:px-4 pt-3 pb-3 flex items-center justify-between gap-3">
        <span className="font-display font-semibold text-[15px]">排行</span>
        <div className="inline-flex rounded-full bg-muted p-0.5">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setTab(key); setExpanded(false); }}
              className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                tab === key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-2 sm:gap-3 px-3 sm:px-4 py-2 border-b border-border text-[11px] text-muted-foreground grid-cols-[16px_minmax(0,1fr)_64px_68px_36px] sm:grid-cols-[24px_56px_1fr_72px_72px_72px_36px]">
        <span>#</span>
        <span className="sm:hidden">股票</span>
        <span className="hidden sm:block">代號</span>
        <span className="hidden sm:block">名稱</span>
        <span className="text-right">現價</span>
        <span className="text-right">漲跌%</span>
        <span className="hidden sm:block text-right">成交量</span>
        <span />
      </div>
      <div>
        {shown.map((item, i) => <MoverRow key={item.symbol} item={item} rank={i + 1} />)}
        {items.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">目前無資料</div>
        )}
      </div>
      {items.length > 10 && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full py-2.5 text-xs text-primary border-t border-border cursor-pointer hover:bg-muted/30 transition-colors"
        >
          {expanded ? "收起 ▲" : `展開全部 ${items.length} 支 ▼`}
        </button>
      )}
    </div>
  );
};
