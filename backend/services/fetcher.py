import time
import json
import ssl
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
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
_suffix_cache: dict[str, str] = {}

def _yahoo_get(yahoo_sym: str, params: str) -> dict:
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_sym}?{params}"
    req = urllib.request.Request(url, headers=_HEADERS)
    with urllib.request.urlopen(req, timeout=15, context=_SSL_CTX) as r:
        return json.loads(r.read())

def _resolve_yahoo_symbol(symbol: str) -> str | None:
    """Return cached suffix, or probe .TW then .TWO, cache winner."""
    if symbol.startswith("^"):
        return symbol
    if symbol in _suffix_cache:
        return f"{symbol}{_suffix_cache[symbol]}"
    for suffix in (".TW", ".TWO"):
        try:
            _yahoo_get(f"{symbol}{suffix}", "range=1d&interval=1d")
            _suffix_cache[symbol] = suffix
            return f"{symbol}{suffix}"
        except Exception:
            continue
    return None

def download_history(symbol: str, period: str) -> list[dict[str, Any]]:
    yahoo_sym = _resolve_yahoo_symbol(symbol)
    if not yahoo_sym:
        print(f"[fetcher] {symbol} not found on Yahoo (.TW / .TWO both failed)")
        return []
    intraday = period in ("1d", "3d")
    # Yahoo 沒有 3d range：抓 5d 再裁掉多的交易日
    yahoo_range = "5d" if period == "3d" else period
    try:
        data = _yahoo_get(yahoo_sym, f"range={yahoo_range}&interval={'5m' if intraday else '1d'}")
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
                # 盤中回 epoch 秒並平移 +8h，lightweight-charts 以 UTC 顯示時剛好是台灣時間
                "time":   ts + 8 * 3600 if intraday else datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d"),
                "open":   round(float(opens[i]),  2),
                "high":   round(float(highs[i]),  2),
                "low":    round(float(lows[i]),   2),
                "close":  round(float(closes[i]), 2),
                "volume": int(volumes[i]) if volumes[i] else 0,
            })
        except (TypeError, IndexError, ValueError):
            continue

    if period == "3d":
        last_dates = sorted({datetime.utcfromtimestamp(b["time"]).date() for b in bars})[-3:]
        keep = set(last_dates)
        bars = [b for b in bars if datetime.utcfromtimestamp(b["time"]).date() in keep]

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

    def _fetch_one(sym: str) -> dict[str, Any] | None:
        bars = download_history(sym, "5d")
        if not bars:
            return None
        latest = bars[-1]
        prev_close = bars[-2]["close"] if len(bars) >= 2 else latest["close"]
        change_abs = round(latest["close"] - prev_close, 2)
        change_pct = round(change_abs / prev_close * 100, 2) if prev_close != 0 else 0.0
        return {
            "symbol":     sym,
            "name":       name_map.get(sym, sym),
            "close":      latest["close"],
            "change":     change_abs,
            "change_pct": change_pct,
            "volume":     latest["volume"],
        }

    results = []
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {executor.submit(_fetch_one, sym): sym for sym in symbols}
        for future in as_completed(futures):
            result = future.result()
            if result:
                results.append(result)
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
