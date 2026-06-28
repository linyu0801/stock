import time
import urllib3
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.exceptions import InsecureRequestWarning

# Disable SSL verification globally for all requests (yfinance uses requests internally)
urllib3.disable_warnings(InsecureRequestWarning)
_orig_send = HTTPAdapter.send
def _no_ssl_send(self, request, **kwargs):
    kwargs["verify"] = False
    return _orig_send(self, request, **kwargs)
HTTPAdapter.send = _no_ssl_send

import yfinance as yf
from typing import Any
from db import get_conn

_price_cache: dict[str, tuple[float, dict]] = {}
_PRICE_TTL = 300  # 5 minutes

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

def _fetch_prices_from_yfinance(symbols: list[str]) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            f"SELECT symbol, name FROM stocks_meta WHERE symbol IN ({','.join('?' * len(symbols))})",
            symbols,
        ).fetchall()
    name_map = {r["symbol"]: r["name"] for r in rows}

    tw_syms = [f"{s}.TW" for s in symbols]
    try:
        df = yf.download(tw_syms, period="5d", auto_adjust=True, progress=False)
    except Exception:
        return []

    if df.empty:
        return []

    results: list[dict[str, Any]] = []

    if len(symbols) == 1:
        closes = df["Close"].dropna()
        if closes.empty:
            return []
        close = round(float(closes.iloc[-1]), 2)
        change_pct = round((float(closes.iloc[-1]) - float(closes.iloc[-2])) / float(closes.iloc[-2]) * 100, 2) if len(closes) >= 2 else 0.0
        results.append({"symbol": symbols[0], "name": name_map.get(symbols[0], symbols[0]), "close": close, "change_pct": change_pct})
    else:
        close_df = df["Close"]
        for sym, tw_sym in zip(symbols, tw_syms):
            try:
                closes = close_df[tw_sym].dropna()
                if closes.empty:
                    continue
                close = round(float(closes.iloc[-1]), 2)
                change_pct = round((float(closes.iloc[-1]) - float(closes.iloc[-2])) / float(closes.iloc[-2]) * 100, 2) if len(closes) >= 2 else 0.0
                results.append({"symbol": sym, "name": name_map.get(sym, sym), "close": close, "change_pct": change_pct})
            except Exception:
                continue

    return results

def get_batch_prices(symbols: list[str]) -> list[dict[str, Any]]:
    if not symbols:
        return []
    now = time.time()
    stale = [s for s in symbols if s not in _price_cache or now - _price_cache[s][0] >= _PRICE_TTL]

    if stale:
        fresh = _fetch_prices_from_yfinance(stale)
        for p in fresh:
            _price_cache[p["symbol"]] = (now, p)

    return [_price_cache[s][1] for s in symbols if s in _price_cache]
