import re
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

# 純字母開頭代號（AAPL、VTI、BTC-USD）→ 美股/國際，Yahoo 直接吃，不加台股後綴
_US_SYMBOL = re.compile(r"[A-Z][A-Z0-9.\-]{0,9}")


def is_us_symbol(symbol: str) -> bool:
    return _US_SYMBOL.fullmatch(symbol) is not None


def _resolve_yahoo_symbol(symbol: str) -> str | None:
    """Return cached suffix, or probe candidates, cache winner."""
    if symbol.startswith("^"):
        return symbol
    if symbol in _suffix_cache:
        suffix = _suffix_cache[symbol]
        return symbol if suffix == "" else f"{symbol}{suffix}"
    # 美股/國際代號直接吃；裸代號的加密貨幣/穩定幣（USDT、BTC…）Yahoo 需要 -USD 後綴
    candidates = (symbol, f"{symbol}-USD") if is_us_symbol(symbol) else (f"{symbol}.TW", f"{symbol}.TWO")
    for candidate in candidates:
        try:
            _yahoo_get(candidate, "range=1d&interval=1d")
            _suffix_cache[symbol] = candidate[len(symbol):]
            return candidate
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

    # 休市日 Yahoo 會多一根複製前日收盤的幽靈日 K（量 0、價與前日相同），砍尾避免漲跌被算成 0
    if not intraday:
        while len(bars) >= 2 and bars[-1]["volume"] == 0 and bars[-1]["close"] == bars[-2]["close"]:
            bars.pop()

    return bars

def get_stock_info(symbol: str) -> dict[str, Any] | None:
    bars = download_history(symbol, "5d")
    if len(bars) < 2:
        return None
    latest, prev = bars[-1], bars[-2]
    change_pct = (latest["close"] - prev["close"]) / prev["close"] * 100
    with get_conn() as conn:
        row = conn.execute("SELECT name FROM stocks_meta WHERE symbol = %s", (symbol,)).fetchone()
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
            f"SELECT symbol, name FROM stocks_meta WHERE symbol IN ({','.join(['%s']*len(symbols))})",
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

_fx_cache: tuple[float, float] | None = None  # (ts, usd_twd)


def get_usd_twd() -> float | None:
    """USD→TWD 匯率，沿用 5min TTL 快取；抓不到時回上次成功值。"""
    global _fx_cache
    now = time.time()
    if _fx_cache and now - _fx_cache[0] < _PRICE_TTL:
        return _fx_cache[1]
    try:
        data = _yahoo_get("TWD=X", "range=1d&interval=1d")
        rate = float(data["chart"]["result"][0]["meta"]["regularMarketPrice"])
        _fx_cache = (now, rate)
        return rate
    except Exception as e:
        print(f"[fetcher] USD/TWD fx failed: {e}")
        return _fx_cache[1] if _fx_cache else None


def get_batch_prices(symbols: list[str]) -> list[dict[str, Any]]:
    if not symbols:
        return []
    now = time.time()
    stale = [s for s in symbols if s not in _price_cache or now - _price_cache[s][0] >= _PRICE_TTL]

    if stale:
        for p in _fetch_prices_from_yahoo(stale):
            _price_cache[p["symbol"]] = (now, p)

    return [_price_cache[s][1] for s in symbols if s in _price_cache]
