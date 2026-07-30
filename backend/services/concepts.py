import json
import re
import ssl
import time
import urllib.request
from urllib.parse import quote

from db import get_conn
from services.limit_price import limit_status

_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
_TTL = 86400  # 1 day

_concept_list_cache: tuple[float, list] | None = None
_concept_stocks_cache: dict[str, tuple[float, list]] = {}


def _extract(val) -> float | None:
    if isinstance(val, dict):
        val = val.get("raw")
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def get_concept_list() -> list[dict]:
    global _concept_list_cache
    now = time.time()

    if _concept_list_cache:
        ts, cached = _concept_list_cache
        if now - ts < _TTL:
            return cached

    # Try SQLite cache
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT category, name FROM concepts"
            " WHERE updated_at > to_char(now() AT TIME ZONE 'utc' - interval '1 day', 'YYYY-MM-DD HH24:MI:SS')"
            " ORDER BY position"
        ).fetchall()
    if rows:
        result = [{"category": r["category"], "name": r["name"]} for r in rows]
        _concept_list_cache = (now, result)
        return result

    # Fetch from Yahoo /class/ HTML
    req = urllib.request.Request("https://tw.stock.yahoo.com/class/", headers=_HEADERS)
    with urllib.request.urlopen(req, timeout=15, context=_SSL_CTX) as r:
        html = r.read().decode("utf-8")

    match = re.search(r'"CONCEPT_STOCK":\{"list":(\[.*?\])\}', html, re.DOTALL)
    if not match:
        return []

    categories = json.loads(match.group(1))  # [{"label":"概念股","name":"5G"}, ...]
    result = [{"category": c["name"], "name": c["name"]} for c in categories]

    with get_conn() as conn:
        conn.execute("DELETE FROM concepts")
        conn.cursor().executemany(
            "INSERT INTO concepts (category, name, position) VALUES (%s, %s, %s)",
            [(c["name"], c["name"], i) for i, c in enumerate(categories)],
        )

    _concept_list_cache = (now, result)
    return result


def _fetch_concept_stocks_from_yahoo(category: str) -> list[dict]:
    encoded_name = quote(category)
    encoded_label = quote("概念股")
    base_url = (
        "https://tw.stock.yahoo.com/_td-stock/api/resource/"
        f"StockServices.getClassQuotes"
        f";category={encoded_name}"
        f";categoryLabel={encoded_label}"
        f";categoryName={encoded_name}"
        ";offset={offset}"
        "?bkt=&device=desktop&ecma=modern&intl=tw&lang=zh-Hant-TW"
        "&partner=none&region=TW&site=finance&tz=Asia%2FTaipei"
        "&ver=1.4.893&returnMeta=true"
    )
    referer = (
        f"https://tw.stock.yahoo.com/class-quote"
        f"?category={encoded_name}&categoryLabel={encoded_label}"
    )
    headers = {
        **_HEADERS,
        "x-requested-with": "XMLHttpRequest",
        "Referer": referer,
    }

    all_items: list[dict] = []
    offset = 0
    while True:
        url = base_url.format(offset=offset)
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15, context=_SSL_CTX) as r:
            data = json.loads(r.read())

        lst = data.get("data", {}).get("list", [])
        all_items.extend(lst)
        pagination = data.get("data", {}).get("pagination", {})
        next_offset = pagination.get("nextOffset")
        total = int(pagination.get("resultsTotal", 0))
        if not next_offset or len(all_items) >= total:
            break
        offset = int(next_offset)

    result = []
    for s in all_items:
        symbol_raw = s.get("symbol", "")
        # 順序重要：先去 .TWO 再去 .TW（反過來 "5490.TWO" 會變成 "5490O"）
        symbol = symbol_raw.removesuffix(".TWO").removesuffix(".TW")
        # top-level fields: price = {"raw": "14.1", ...}, changePercent = "-2.42%"
        pct_str = (s.get("changePercent") or "").rstrip("%")
        try:
            pct = round(float(pct_str), 2)
        except ValueError:
            pct = None
        close = _extract(s.get("price"))
        prev_close = close / (1 + pct / 100) if close is not None and pct not in (None, -100) else None
        result.append({
            "symbol": symbol,
            "name": s.get("symbolName", symbol),
            "close": close,
            "change_pct": pct,
            "limit": limit_status(close, prev_close),
        })
    return result


def get_concept_stocks(category: str) -> list[dict]:
    now = time.time()

    if category in _concept_stocks_cache:
        ts, cached = _concept_stocks_cache[category]
        if now - ts < _TTL:
            return cached

    # Try to fetch from Yahoo (source of truth with prices)
    try:
        result = _fetch_concept_stocks_from_yahoo(category)
        with get_conn() as conn:
            conn.execute("DELETE FROM concept_stocks WHERE category = %s", (category,))
            conn.cursor().executemany(
                "INSERT INTO concept_stocks (category, symbol, name, position) VALUES (%s, %s, %s, %s)",
                [(category, r["symbol"], r["name"], i) for i, r in enumerate(result)],
            )
        _concept_stocks_cache[category] = (now, result)
        return result
    except Exception as e:
        print(f"[concepts] Yahoo fetch failed for {category}: {e}")

    # Fall back to SQLite (no live prices — returns None for close/change_pct)
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT symbol, name FROM concept_stocks WHERE category = %s ORDER BY position",
            (category,),
        ).fetchall()
    return [
        {"symbol": r["symbol"], "name": r["name"], "close": None, "change_pct": None, "limit": None}
        for r in rows
    ]
