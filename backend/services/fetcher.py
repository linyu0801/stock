import yfinance as yf
import pandas as pd
from typing import Any

def download_history(symbol: str, period: str) -> list[dict[str, Any]]:
    df = yf.download(f"{symbol}.TW", period=period, auto_adjust=True, progress=False)
    if df.empty:
        return []
    df = df.reset_index()
    return [
        {
            "time": row["Date"].strftime("%Y-%m-%d"),
            "open": float(row["Open"]),
            "high": float(row["High"]),
            "low": float(row["Low"]),
            "close": float(row["Close"]),
            "volume": int(row["Volume"]),
        }
        for _, row in df.iterrows()
    ]

def get_stock_info(symbol: str) -> dict[str, Any] | None:
    bars = download_history(symbol, "5d")
    if len(bars) < 2:
        return None
    latest = bars[-1]
    prev_close = bars[-2]["close"]
    change_pct = (latest["close"] - prev_close) / prev_close * 100
    ticker = yf.Ticker(f"{symbol}.TW")
    name = ticker.info.get("longName") or ticker.info.get("shortName") or symbol
    return {
        "symbol": symbol,
        "name": name,
        "close": latest["close"],
        "change_pct": round(change_pct, 2),
    }
