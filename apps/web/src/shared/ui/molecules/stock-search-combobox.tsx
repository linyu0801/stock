import { useState, useEffect, useRef } from "react";
import { searchStocks } from "@taiwan-stock/api-client";

type Props = {
  onSelect: (symbol: string) => void;
  placeholder?: string;
  /** 受控模式：提供 value+onChange 時，輸入框顯示目前值、選擇後不清空（適合編輯既有欄位，如新增交易的標的）。
   *  不提供則維持原本「選完清空」模式（適合自選股那種選了就加入清單的用法）。 */
  value?: string;
  onChange?: (value: string) => void;
};

export const StockSearchCombobox: React.FC<Props> = ({ onSelect, placeholder = "輸入股票代碼或名稱…", value, onChange }) => {
  const controlled = value !== undefined;
  const [query, setQuery] = useState("");
  const text = controlled ? value : query;
  const setText = controlled ? onChange! : setQuery;

  const [results, setResults] = useState<{ symbol: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!text.trim()) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      try {
        const data = await searchStocks(text);
        setResults(data);
        setOpen(true);  // 0 筆也開，顯示「查無結果」而不是靜默沒反應
      } catch {
        setResults([]); setOpen(false);
      }
    }, 300);  // 本地查無時會 fallback 打 Yahoo，debounce 拉長避免逐字觸發外呼
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [text]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Detect if dropdown would overflow bottom of viewport → flip upward
  const handleFocus = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setDropUp(spaceBelow < 200);
    }
  };

  const select = (symbol: string) => {
    onSelect(symbol);
    setResults([]);
    setOpen(false);
    if (!controlled) setQuery("");
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <input
        ref={inputRef}
        value={text}
        onChange={e => setText(e.target.value)}
        onFocus={handleFocus}
        onKeyDown={e => { if (e.key === "Escape") setOpen(false); }}
        placeholder={placeholder}
        className="w-full px-2.5 py-1.5 rounded-md border border-border bg-input text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-ring transition-colors"
      />
      {open && (
        <ul className={`absolute left-0 right-0 z-50 rounded-lg border border-border bg-popover shadow-lg overflow-hidden list-none p-0 m-0
          ${dropUp ? "bottom-full mb-1" : "top-full mt-1"}`}
        >
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">查無結果</li>
          ) : (
            results.map(r => (
              <li key={r.symbol}>
                <button
                  type="button"
                  onMouseDown={e => { e.preventDefault(); select(r.symbol); }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-sm text-left hover:bg-accent transition-colors"
                >
                  <span className="font-mono font-semibold text-foreground">{r.symbol}</span>
                  <span className="text-muted-foreground">{r.name}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};
