import urllib.request
import json
import ssl
from db import get_conn

TWSE_URL = "https://openapi.twse.com.tw/v1/opendata/t187ap03_L"
TPEx_URL = "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes"

_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

def _fetch_json(url: str) -> list:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15, context=_SSL_CTX) as r:
        return json.loads(r.read())

def sync_stock_list() -> int:
    rows: list[tuple[str, str]] = []

    try:
        data = _fetch_json(TWSE_URL)
        for item in data:
            symbol = str(item.get("公司代號", "")).strip()
            name = str(item.get("公司簡稱", "")).strip()
            if symbol and name:
                rows.append((symbol, name))
        print(f"[stock_meta] TWSE: {len(rows)} stocks")
    except Exception as e:
        print(f"[stock_meta] TWSE fetch failed: {e}")

    tpex_before = len(rows)
    try:
        data = _fetch_json(TPEx_URL)
        for item in data:
            symbol = str(item.get("SecuritiesCompanyCode", "")).strip()
            name = str(item.get("CompanyName", "")).strip()
            if symbol and name:
                rows.append((symbol, name))
        print(f"[stock_meta] TPEx: {len(rows) - tpex_before} stocks")
    except Exception as e:
        print(f"[stock_meta] TPEx fetch failed: {e}")

    if not rows:
        print("[stock_meta] sync failed: no data from either source")
        return 0

    with get_conn() as conn:
        conn.cursor().executemany(
            """INSERT INTO stocks_meta (symbol, name) VALUES (%s, %s)
               ON CONFLICT (symbol) DO UPDATE SET name = excluded.name""",
            rows,
        )
    print(f"[stock_meta] saved {len(rows)} stocks total")
    return len(rows)

def count_stocks() -> int:
    with get_conn() as conn:
        return conn.execute("SELECT COUNT(*) AS n FROM stocks_meta").fetchone()["n"]

def search_stocks(q: str, limit: int = 10) -> list[dict]:
    q = q.strip()
    if not q:
        return []
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT symbol, name FROM stocks_meta
            WHERE symbol LIKE %s OR name LIKE %s
            ORDER BY
                CASE WHEN symbol = %s THEN 0
                     WHEN symbol LIKE %s THEN 1
                     ELSE 2 END,
                symbol
            LIMIT %s
            """,
            (f"{q}%", f"%{q}%", q, f"{q}%", limit),
        ).fetchall()
    return [{"symbol": r["symbol"], "name": r["name"]} for r in rows]
