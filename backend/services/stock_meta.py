import urllib.request
import json
from db import get_conn

TWSE_URL = "https://openapi.twse.com.tw/v1/opendata/t187ap03_L"
TPEx_URL = "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes"

def _fetch_json(url: str) -> list:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())

def sync_stock_list() -> int:
    rows: list[tuple[str, str]] = []

    try:
        for item in _fetch_json(TWSE_URL):
            symbol = str(item.get("公司代號", "")).strip()
            name = str(item.get("公司簡稱", "")).strip()
            if symbol and name:
                rows.append((symbol, name))
    except Exception:
        pass

    try:
        for item in _fetch_json(TPEx_URL):
            symbol = str(item.get("SecuritiesCompanyCode", "")).strip()
            name = str(item.get("CompanyAbbreviation", "")).strip()
            if symbol and name:
                rows.append((symbol, name))
    except Exception:
        pass

    if not rows:
        return 0

    with get_conn() as conn:
        conn.executemany(
            "INSERT OR REPLACE INTO stocks_meta (symbol, name) VALUES (?, ?)",
            rows,
        )
    return len(rows)

def search_stocks(q: str, limit: int = 10) -> list[dict]:
    q = q.strip()
    if not q:
        return []
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT symbol, name FROM stocks_meta
            WHERE symbol LIKE ? OR name LIKE ?
            ORDER BY
                CASE WHEN symbol = ? THEN 0
                     WHEN symbol LIKE ? THEN 1
                     ELSE 2 END,
                symbol
            LIMIT ?
            """,
            (f"{q}%", f"%{q}%", q, f"{q}%", limit),
        ).fetchall()
    return [{"symbol": r["symbol"], "name": r["name"]} for r in rows]
