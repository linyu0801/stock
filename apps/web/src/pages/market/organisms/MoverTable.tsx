import { useState } from "react";
import type { Mover } from "@taiwan-stock/api-client";
import { MoverRow } from "../molecules/MoverRow";

type Props = { title: string; items: Mover[]; accentClass: string };

export const MoverTable: React.FC<Props> = ({ title, items, accentClass }) => {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, 10);

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className={`w-0.5 h-4 rounded-full ${accentClass}`} />
          <span className="font-semibold text-[15px]">{title}</span>
          <span className="text-xs text-muted-foreground">({items.length})</span>
        </div>
        <div className="grid gap-3 text-[11px] text-muted-foreground" style={{ gridTemplateColumns: "24px 56px 1fr 72px 72px" }}>
          <span>#</span><span>代號</span><span>名稱</span>
          <span className="text-right">現價</span>
          <span className="text-right">漲跌%</span>
        </div>
      </div>
      <div>
        {shown.map((item, i) => <MoverRow key={item.symbol} item={item} rank={i + 1} />)}
      </div>
      {items.length > 10 && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full py-2.5 text-xs text-primary border-t border-border hover:bg-muted/30 transition-colors"
        >
          {expanded ? "收起 ▲" : `展開全部 ${items.length} 支 ▼`}
        </button>
      )}
    </div>
  );
};
