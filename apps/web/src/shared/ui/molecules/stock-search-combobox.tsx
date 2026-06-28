import { useState, useEffect, useRef } from "react";
import { searchStocks } from "@taiwan-stock/api-client";
import { Input } from "../atoms/input";

interface Props {
  onSelect: (symbol: string) => void;
  placeholder?: string;
}

export function StockSearchCombobox({ onSelect, placeholder = "輸入股票代碼或名稱…" }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ symbol: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!query.trim()) { setResults([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      try {
        const data = await searchStocks(query);
        setResults(data);
        setOpen(data.length > 0);
      } catch {
        setResults([]);
        setOpen(false);
      }
    }, 200);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (symbol: string) => {
    onSelect(symbol);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results.length > 0) select(results[0].symbol);
          if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          {results.map((r) => (
            <li key={r.symbol}>
              <button
                className="flex w-full items-center gap-3 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                onMouseDown={(e) => { e.preventDefault(); select(r.symbol); }}
              >
                <span className="font-mono font-medium">{r.symbol}</span>
                <span className="text-muted-foreground">{r.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
