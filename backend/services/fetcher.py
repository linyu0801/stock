import time
import json
import ssl
import urllib.request
from datetime import datetime
from typing import Any
from db import get_conn

_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "application/json",
}

_price_cache: dict[str, tuple[float, dict]] = {}
_PRICE_TTL = 300

def _yahoo_get(symbol_tw: str, params: str) -> dict:
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol_tw}?{params}"
    req = urllib.request.Request(url, headers=_HEADERS)
    with urllib.request.urlopen(req, timeout=15, context=_SSL_CTX) as r:
        return json.loads(r.read())

def download_history(symbol: str, period: str) -> list[dict[str, Any]]:
    try:
        data = _yahoo_get(f"{symbol}.TW", f"range={period}&interval=1d")
    except Exception as e:
        print(f"[fetcher] {symbol} history failed: {e}")
        return []

    result = data.get("chart", {}).get("result") or []
    if not result:
        return []

    r = result[0]
    timestamps = r.get("timestamp", [])
    quote = (r.get("indicators", {}).get("quote") or [{}])[0]
    opens   = quote.get("open",   [])
    highs   = quote.get("high",   [])
    lows    = quote.get("low",    [])
    closes  = quote.get("close",  [])
    volumes = quote.get("volume", [])

    bars = []
    for i, ts in enumerate(timestamps):
        try:
            if closes[i] is None:
                continue
            bars.append({
                "time":   datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d"),
                "open":   round(float(opens[i]),  2),
                "high":   round(float(highs[i]),  2),
                "low":    round(float(lows[i]),   2),
                "close":  round(float(closes[i]), 2),
                "volume": int(volumes[i]) if volumes[i] else 0,
            })
        except (TypeError, IndexError, ValueError):
            continue

    return bars

def get_stock_info(symbol: str) -> dict[str, Any] | None:
    bars = download_history(symbol, "5d")
    if len(bars) < 2:
        return None
    latest, prev = bars[-1], bars[-2]
    change_pct = (latest["close"] - prev["close"]) / prev["close"] * 100
    with get_conn() as conn:
        row = conn.execute("SELECT name FROM stocks_meta WHERE symbol = ?", (symbol,)).fetchone()
    name = row["name"] if row else symbol
    return {
        "symbol":     symbol,
        "name":       name,
        "close":      latest["close"],
        "change_pct": round(change_pct, 2),
    }

def _fetch_prices_from_yahoo(symbols: list[str]) -> list[dict[str, Any]]:
    with get_conn() as conn:
        rows = conn.execute(
            f"SELECT symbol, name FROM stocks_meta WHERE symbol IN ({','.join('?'*len(symbols))})",
            symbols,
        ).fetchall()
    name_map = {r["symbol"]: r["name"] for r in rows}

    results = []
    for sym in symbols:
        bars = download_history(sym, "5d")
        if len(bars) < 1:
            continue
        latest = bars[-1]
        change_pct = round((latest["close"] - bars[-2]["close"]) / bars[-2]["close"] * 100, 2) if len(bars) >= 2 else 0.0
        results.append({
            "symbol":     sym,
            "name":       name_map.get(sym, sym),
            "close":      latest["close"],
            "change_pct": change_pct,
        })
    return results

def get_batch_prices(symbols: list[str]) -> list[dict[str, Any]]:
    if not symbols:
        return []
    now = time.time()
    stale = [s for s in symbols if s not in _price_cache or now - _price_cache[s][0] >= _PRICE_TTL]

    if stale:
        for p in _fetch_prices_from_yahoo(stale):
            _price_cache[p["symbol"]] = (now, p)

    return [_price_cache[s][1] for s in symbols if s in _price_cache]
