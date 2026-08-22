import urllib.request
import json
import ssl
import time
from typing import Any
from urllib.parse import quote
from db import get_conn

TWSE_URL = "https://openapi.twse.com.tw/v1/opendata/t187ap03_L"
TPEx_URL = "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes"
# t187ap03_L 只有「公司」，上市 ETF 不在其中；用全證券日行情補齊代號與名稱
TWSE_ALL_URL = "https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL"
YAHOO_SEARCH_URL = "https://query1.finance.yahoo.com/v1/finance/search"

_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

def _fetch_json(url: str) -> Any:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15, context=_SSL_CTX) as r:
        return json.loads(r.read())

def sync_stock_list() -> int:
    # dict 去重：同批 executemany 對同一 key upsert 兩次會被 PG 拒絕；
    # 先鋪全證券（含 ETF），公司來源的簡稱後蓋（較乾淨）
    merged: dict[str, str] = {}

    try:
        data = _fetch_json(TWSE_ALL_URL)
        n = 0
        for item in data:
            symbol = str(item.get("Code", "")).strip()
            name = str(item.get("Name", "")).strip()
            if symbol and name:
                merged[symbol] = name
                n += 1
        print(f"[stock_meta] TWSE all-securities: {n}")
    except Exception as e:
        print(f"[stock_meta] TWSE all-securities fetch failed: {e}")

    try:
        data = _fetch_json(TWSE_URL)
        n = 0
        for item in data:
            symbol = str(item.get("公司代號", "")).strip()
            name = str(item.get("公司簡稱", "")).strip()
            if symbol and name:
                merged[symbol] = name
                n += 1
        print(f"[stock_meta] TWSE companies: {n}")
    except Exception as e:
        print(f"[stock_meta] TWSE fetch failed: {e}")

    try:
        data = _fetch_json(TPEx_URL)
        n = 0
        for item in data:
            symbol = str(item.get("SecuritiesCompanyCode", "")).strip()
            name = str(item.get("CompanyName", "")).strip()
            if symbol and name:
                merged[symbol] = name
                n += 1
        print(f"[stock_meta] TPEx: {n}")
    except Exception as e:
        print(f"[stock_meta] TPEx fetch failed: {e}")

    if not merged:
        print("[stock_meta] sync failed: no data from any source")
        return 0

    with get_conn() as conn:
        conn.cursor().executemany(
            """INSERT INTO stocks_meta (symbol, name) VALUES (%s, %s)
               ON CONFLICT (symbol) DO UPDATE SET name = excluded.name""",
            list(merged.items()),
        )
    print(f"[stock_meta] saved {len(merged)} securities total")
    return len(merged)

def count_stocks() -> int:
    with get_conn() as conn:
        return conn.execute("SELECT COUNT(*) AS n FROM stocks_meta").fetchone()["n"]

_QUOTE_TYPES = {"EQUITY", "ETF"}
# 只收美國掛牌：同名標的的墨西哥/深圳/代幣化版本（NBISN.MX、NBISB-USD）也吃得下 is_us_symbol()
# 的正則，一旦入庫就會被當成 USD 計價，用錯的匯率算進淨值
_US_EXCHANGES = {"NMS", "NYQ", "NGM", "NCM", "PCX", "ASE", "BTS"}
_search_cache: dict[str, tuple[float, list[dict]]] = {}
_SEARCH_TTL = 3600


def _search_local(q: str, limit: int) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT symbol, name FROM stocks_meta
            WHERE symbol ILIKE %s OR name ILIKE %s
            ORDER BY
                CASE WHEN symbol ILIKE %s THEN 0
                     WHEN symbol ILIKE %s THEN 1
                     ELSE 2 END,
                symbol
            LIMIT %s
            """,
            (f"{q}%", f"%{q}%", q, f"{q}%", limit),
        ).fetchall()
    return [{"symbol": r["symbol"], "name": r["name"]} for r in rows]


def _search_yahoo(q: str, limit: int) -> list[dict]:
    now = time.time()
    hit = _search_cache.get(q)
    if hit and now - hit[0] < _SEARCH_TTL:
        return hit[1]
    try:
        data = _fetch_json(f"{YAHOO_SEARCH_URL}?q={quote(q)}&quotesCount=20&newsCount=0")
    except Exception as e:
        print(f"[stock_meta] yahoo search failed for {q!r}: {e}")
        return []  # 不快取失敗，下次重試
    out = []
    for item in data.get("quotes", []):
        if item.get("quoteType") not in _QUOTE_TYPES or item.get("exchange") not in _US_EXCHANGES:
            continue
        symbol = item.get("symbol")
        if not symbol:
            continue
        out.append({"symbol": symbol, "name": item.get("shortname") or item.get("longname") or symbol})
        if len(out) >= limit:
            break
    _search_cache[q] = (now, out)
    return out


def _cache_meta(rows: list[dict]) -> None:
    """線上查到的美股寫回 stocks_meta：下次搜尋直接本地命中，庫存表也才有名稱可顯示。"""
    merged = {r["symbol"]: r["name"] for r in rows}
    with get_conn() as conn:
        conn.cursor().executemany(
            """INSERT INTO stocks_meta (symbol, name) VALUES (%s, %s)
               ON CONFLICT (symbol) DO UPDATE SET name = excluded.name""",
            list(merged.items()),
        )


def search_stocks(q: str, limit: int = 10) -> list[dict]:
    q = q.strip()
    if not q:
        return []
    rows = _search_local(q, limit)
    if rows or not q.isascii():  # 中文查詢不可能是美股，不打 Yahoo
        return rows
    remote = _search_yahoo(q, limit)
    if remote:
        _cache_meta(remote)
    return remote
