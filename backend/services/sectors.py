import json
import ssl
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

# Composite indices (複合指數) — priority; appear first in results
_COMPOSITE_SECTORS: list[tuple[str, str]] = [
    ("^TWII", "加權指數"),
    ("^TELI",  "電子"),
    ("SEC.TW",  "半導體"),
    ("^TFNI",  "金融"),
    ("^TPII",  "塑膠化工"),
    ("^TCII",  "水泥窯製"),
    ("^TEII",  "機電"),
    ("^TCHI",  "化生"),
    ("BIM.TW", "生技醫療"),
    ("CHI.TW", "化學"),
    ("^TCMI",  "水泥"),
]

_sectors_cache: tuple[float, list] | None = None
_SECTORS_TTL = 1800  # 30 minutes

_classes_cache: tuple[float, list[tuple[str, str]]] | None = None
_CLASSES_TTL = 86400  # 1 day


def _fetch_classes() -> list[tuple[str, str]]:
    """Fetch full TWSE sector list from Yahoo StockServices.getClasses; cache 1 day."""
    global _classes_cache
    now = time.time()
    if _classes_cache:
        ts, cached = _classes_cache
        if now - ts < _CLASSES_TTL:
            return cached

    url = (
        "https://tw.stock.yahoo.com/_td-stock/api/resource/"
        "StockServices.getClasses;id=sectors;exchange=TAI"
        "?bkt=&device=desktop&ecma=modern&intl=tw&lang=zh-Hant-TW"
        "&partner=none&region=TW&site=finance&tz=Asia%2FTaipei"
        "&ver=1.4.893&returnMeta=true"
    )
    headers = {
        **_HEADERS,
        "x-requested-with": "XMLHttpRequest",
        "Referer": "https://tw.stock.yahoo.com/sector-index",
    }
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15, context=_SSL_CTX) as r:
            data = json.loads(r.read())
        raw = data.get("data", {}).get("list", [])
        result = [
            (item["canonicalId"], item["name"])
            for item in raw
            if item.get("canonicalId") and item["canonicalId"] not in ("", "174")
        ]
        _classes_cache = (now, result)
        return result
    except Exception as e:
        print(f"[sectors] getClasses fetch failed: {e}")
        return []


def _build_sectors() -> list[tuple[str, str]]:
    """Composite indices first, then Yahoo getClasses additions (deduplicated by canonicalId)."""
    composite_ids = {sym for sym, _ in _COMPOSITE_SECTORS}
    extra = _fetch_classes()
    result = list(_COMPOSITE_SECTORS)
    for sym, name in extra:
        if sym not in composite_ids:
            result.append((sym, name))
    return result


def _fetch_one(symbol: str, name: str) -> dict | None:
    encoded = symbol.replace("^", "%5E")
    # 1mo/1d 對部分指數只回 1 點；盤中 1d/5m 全指數皆有完整序列（實測 55 點）
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{encoded}?range=1d&interval=5m"
    req = urllib.request.Request(url, headers=_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=10, context=_SSL_CTX) as r:
            data = json.loads(r.read())
    except Exception as e:
        print(f"[sectors] fetch failed for {symbol}: {e}")
        return None

    try:
        result = data["chart"]["result"][0]
        meta = result["meta"]
        price = meta.get("regularMarketPrice")
        prev = meta.get("chartPreviousClose") or meta.get("previousClose")

        if price is None:
            return None

        change_pct = None
        if prev and prev != 0:
            change_pct = round((price - prev) / prev * 100, 2)

        closes_raw = (
            result.get("indicators", {}).get("quote", [{}])[0].get("close", []) or []
        )
        spark = [round(c, 2) for c in closes_raw if c is not None][-60:]

        return {
            "symbol": symbol,
            "name": name,
            "close": price,
            "change_pct": change_pct,
            "spark": spark,
        }
    except (KeyError, IndexError, TypeError) as e:
        print(f"[sectors] parse failed for {symbol}: {e}")
        return None


def get_sector_indices() -> list[dict]:
    global _sectors_cache
    now = time.time()

    if _sectors_cache:
        ts, cached = _sectors_cache
        if now - ts < _SECTORS_TTL:
            return cached

    sectors = _build_sectors()

    fetched: dict[str, dict] = {}
    with ThreadPoolExecutor(max_workers=8) as ex:
        futures = {ex.submit(_fetch_one, sym, name): sym for sym, name in sectors}
        for fut in as_completed(futures):
            sym = futures[fut]
            result = fut.result()
            if result is not None:
                fetched[sym] = result

    # Preserve original ordering; skip symbols that failed
    results = [fetched[sym] for sym, _ in sectors if sym in fetched]

    _sectors_cache = (now, results)
    return results
