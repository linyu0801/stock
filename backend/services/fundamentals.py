import json
import ssl
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from db import get_conn

_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

_TWSE_VALUATION_URL = "https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL"
_TPEX_VALUATION_URL = "https://www.tpex.org.tw/openapi/v1/tpex_mainboard_peratio_analysis"
_TWSE_REVENUE_URL = "https://openapi.twse.com.tw/v1/opendata/t187ap05_L"
_TPEX_REVENUE_URL = "https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap05_O"

_valuation_cache: tuple[float, dict] | None = None
_VALUATION_TTL = 3600

_revenue_synced_at: float = 0.0
_REVENUE_SYNC_TTL = 6 * 3600


def _get_json(url: str) -> list:
    req = urllib.request.Request(url, headers=_HEADERS)
    with urllib.request.urlopen(req, timeout=30, context=_SSL_CTX) as r:
        return json.loads(r.read())


def _to_float(s: str) -> float | None:
    try:
        return float(s)
    except (ValueError, TypeError):
        return None


def _roc_ym_to_iso(roc_ym: str) -> str:
    """'11505' → '2026-05'"""
    return f"{int(roc_ym[:3]) + 1911}-{roc_ym[3:]}"


def _prev_ym(ym: str) -> str:
    y, m = int(ym[:4]), int(ym[5:])
    return f"{y - 1}-{m - 1:02d}" if m == 1 else f"{y}-{m - 1:02d}"


# ── 估值（本益比/淨值比/殖利率）──────────────────────────────
def _fetch_valuations() -> dict:
    with ThreadPoolExecutor(max_workers=2) as ex:
        f_twse = ex.submit(_get_json, _TWSE_VALUATION_URL)
        f_tpex = ex.submit(_get_json, _TPEX_VALUATION_URL)
        twse, tpex = f_twse.result(), f_tpex.result()

    result = {}
    for row in twse:
        result[row["Code"]] = {
            "pe": _to_float(row.get("PEratio")),
            "pb": _to_float(row.get("PBratio")),
            "dividend_yield": _to_float(row.get("DividendYield")),
        }
    for row in tpex:
        result[row["SecuritiesCompanyCode"]] = {
            "pe": _to_float(row.get("PriceEarningRatio")),
            "pb": _to_float(row.get("PriceBookRatio")),
            "dividend_yield": _to_float(row.get("YieldRatio")),
        }
    return result


def get_valuations(symbols: list[str]) -> dict:
    global _valuation_cache
    if _valuation_cache is None or time.time() - _valuation_cache[0] >= _VALUATION_TTL:
        try:
            _valuation_cache = (time.time(), _fetch_valuations())
        except Exception as e:
            print(f"[fundamentals] valuation fetch failed: {e}")
            if _valuation_cache is None:
                return {}
    data = _valuation_cache[1]
    return {s: data[s] for s in symbols if s in data}


# ── 月營收（快照累積於 SQLite）──────────────────────────────
def _sync_revenue() -> None:
    global _revenue_synced_at
    if time.time() - _revenue_synced_at < _REVENUE_SYNC_TTL:
        return
    with ThreadPoolExecutor(max_workers=2) as ex:
        f_twse = ex.submit(_get_json, _TWSE_REVENUE_URL)
        f_tpex = ex.submit(_get_json, _TPEX_REVENUE_URL)
        rows = f_twse.result() + f_tpex.result()

    current, derived = [], []
    for row in rows:
        try:
            symbol = row["公司代號"]
            ym = _roc_ym_to_iso(row["資料年月"])
            revenue = int(row["營業收入-當月營收"])
        except (KeyError, ValueError):
            continue
        current.append((
            symbol, ym, revenue,
            _to_float(row.get("營業收入-上月比較增減(%)")),
            _to_float(row.get("營業收入-去年同月增減(%)")),
            _to_float(row.get("累計營業收入-前期比較增減(%)")),
        ))
        # API 只回最新一月；用回覆內含的上月/去年同月數字補歷史點（無增減率）
        prev = _to_float(row.get("營業收入-上月營收"))
        if prev is not None:
            derived.append((symbol, _prev_ym(ym), int(prev)))
        last_year = _to_float(row.get("營業收入-去年當月營收"))
        if last_year is not None:
            derived.append((symbol, f"{int(ym[:4]) - 1}{ym[4:]}", int(last_year)))

    with get_conn() as conn:
        conn.cursor().executemany(
            """INSERT INTO monthly_revenue (symbol, year_month, revenue, mom_pct, yoy_pct, acc_yoy_pct)
               VALUES (%s, %s, %s, %s, %s, %s)
               ON CONFLICT(symbol, year_month) DO UPDATE SET
                 revenue = excluded.revenue, mom_pct = excluded.mom_pct,
                 yoy_pct = excluded.yoy_pct, acc_yoy_pct = excluded.acc_yoy_pct""",
            current,
        )
        conn.cursor().executemany(
            "INSERT INTO monthly_revenue (symbol, year_month, revenue) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
            derived,
        )
    _revenue_synced_at = time.time()
    print(f"[fundamentals] revenue synced: {len(current)} companies")


def get_revenue(symbol: str, months: int = 13) -> list[dict]:
    try:
        _sync_revenue()
    except Exception as e:
        print(f"[fundamentals] revenue sync failed: {e}")
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT year_month, revenue, mom_pct, yoy_pct, acc_yoy_pct
               FROM monthly_revenue WHERE symbol = %s
               ORDER BY year_month DESC LIMIT %s""",
            (symbol, months),
        ).fetchall()
    return [dict(r) for r in reversed(rows)]
