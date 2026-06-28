import { useState, useEffect, useRef } from "react";
import { searchStocks } from "@taiwan-stock/api-client";

interface Props {
  onSelect: (symbol: string) => void;
  placeholder?: string;
}

export function StockSearchCombobox({ onSelect, placeholder = "輸入股票代碼或名稱…" }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ symbol: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const data = await searchStocks(query);
        console.log("[search]", query, data);
        setResults(data);
        setOpen(data.length > 0);
      } catch (err) {
        console.error("[search] error:", err);
        setResults([]);
        setOpen(false);
      }
    }, 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
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
    <div ref={containerRef} style={{ position: "relative", width: "100%" }}>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        style={{
          width: "100%",
          padding: "6px 10px",
          border: "1px solid #e4e4e7",
          borderRadius: "6px",
          fontSize: "14px",
          outline: "none",
          background: "transparent",
        }}
      />
      {open && (
        <ul
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 9999,
            marginTop: "4px",
            background: "white",
            border: "1px solid #e4e4e7",
            borderRadius: "6px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            listStyle: "none",
            padding: 0,
            margin: 0,
          }}
        >
          {results.map((r) => (
            <li key={r.symbol}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); select(r.symbol); }}
                style={{
                  display: "flex",
                  width: "100%",
                  alignItems: "center",
                  gap: "12px",
                  padding: "8px 12px",
                  fontSize: "14px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f4f4f5")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
              >
                <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{r.symbol}</span>
                <span style={{ color: "#71717a" }}>{r.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
