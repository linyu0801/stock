import csv
import io
import json
import ssl
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta

_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

_movers_cache: tuple[float, dict] | None = None
_MOVERS_TTL = 1800

def _get(url: str) -> bytes:
    req = urllib.request.Request(url, headers=_HEADERS)
    with urllib.request.urlopen(req, timeout=15, context=_SSL_CTX) as r:
        return r.read()

def _roc_to_date(roc: str) -> str:
    """'1150626' or '115/06/26' → '2026/06/26'"""
    roc = roc.replace("/", "")
    try:
        year = int(roc[:3]) + 1911
        return f"{year}/{roc[3:5]}/{roc[5:7]}"
    except Exception:
        return roc

# ── TWSE (上市) ──────────────────────────────────────────────
def _fetch_twse(date_param: str | None) -> tuple[list[dict], str] | None:
    url = "https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY_ALL?response=json"
    if date_param:
        url += f"&date={date_param}"
    body = _get(url).decode("utf-8")
    rows = list(csv.reader(io.StringIO(body)))
    data = rows[1:] if rows else []
    if not data:
        return None
    date = _roc_to_date(data[0][0]) if data[0][0] else ""
    result = []
    for row in data:
        try:
            symbol  = row[1].strip()
            name    = row[2].strip()
            close   = float(row[8].replace(",", ""))
            diff    = float(row[9].replace(",", ""))
            prev    = close - diff
            pct     = round(diff / prev * 100, 2) if prev != 0 else 0.0
            try:
                volume = int(row[3].replace(",", ""))
            except (ValueError, IndexError):
                volume = 0
            result.append({"symbol": symbol, "name": name, "close": close, "change_pct": pct, "volume": volume})
        except (ValueError, IndexError):
            continue
    return result, date

# ── TPEX (上櫃) ──────────────────────────────────────────────
def _fetch_tpex(date_param: str | None) -> tuple[list[dict], str] | None:
    url = "https://www.tpex.org.tw/web/stock/aftertrading/otc_quotes_no1430/stk_wn1430_result.php?l=zh-tw&o=json&se=AL"
    if date_param:
        # TPEX uses ROC date: 20260626 → 115/06/26
        try:
            y, m, d = int(date_param[:4]) - 1911, date_param[4:6], date_param[6:8]
            url += f"&d={y}/{m}/{d}"
        except Exception:
            pass
    data = json.loads(_get(url))
    tables = data.get("tables", [])
    if not tables or not tables[0].get("data"):
        return None
    t = tables[0]
    date = _roc_to_date(t.get("date", "").replace("/", ""))
    result = []
    for row in t["data"]:
        try:
            symbol = row[0].strip()
            name   = row[1].strip()
            close  = float(row[2].replace(",", ""))
            diff_s = row[3].replace(",", "").strip()
            diff   = float(diff_s)
            prev   = close - diff
            pct    = round(diff / prev * 100, 2) if prev != 0 else 0.0
            try:
                volume = int(row[8].replace(",", ""))
            except (ValueError, IndexError):
                volume = 0
            result.append({"symbol": symbol, "name": name, "close": close, "change_pct": pct, "volume": volume})
        except (ValueError, IndexError):
            continue
    return result, date

def get_movers(top_n: int = 30) -> dict:
    global _movers_cache
    if _movers_cache:
        ts, cached = _movers_cache
        if time.time() - ts < _MOVERS_TTL:
            return cached

    candidates = [None] + [
        (datetime.now() - timedelta(days=i)).strftime("%Y%m%d")
        for i in range(1, 4)
    ]

    for date_param in candidates:
        try:
            with ThreadPoolExecutor(max_workers=2) as ex:
                f_twse = ex.submit(_fetch_twse, date_param)
                f_tpex = ex.submit(_fetch_tpex, date_param)
                twse = f_twse.result()
                tpex = f_tpex.result()

            if not twse and not tpex:
                continue

            def _is_regular_stock(symbol: str) -> bool:
                s = symbol.strip()
                # keep 4-digit codes (上市/上櫃 一般股)
                # exclude: warrants (6-digit starting with 7), ETF (starts with 00), others
                if not s.isdigit():
                    return False
                return len(s) == 4

            all_stocks = []
            date = ""
            if twse:
                all_stocks.extend(r for r in twse[0] if _is_regular_stock(r["symbol"]))
                date = twse[1]
            if tpex:
                all_stocks.extend(r for r in tpex[0] if _is_regular_stock(r["symbol"]))
                if not date:
                    date = tpex[1]

            print(f"[market] date={date_param or 'latest'} twse={len(twse[0]) if twse else 0} tpex={len(tpex[0]) if tpex else 0}")
            gainers = sorted([r for r in all_stocks if r["change_pct"] > 0], key=lambda x: x["change_pct"], reverse=True)
            losers  = sorted([r for r in all_stocks if r["change_pct"] < 0], key=lambda x: x["change_pct"])
            volume  = sorted(all_stocks, key=lambda x: x.get("volume", 0), reverse=True)
            result  = {"gainers": gainers[:top_n], "losers": losers[:top_n], "volume": volume[:top_n], "date": date}
            _movers_cache = (time.time(), result)
            return result
        except Exception as e:
            print(f"[market] fetch failed for {date_param}: {e}")

    return {"gainers": [], "losers": [], "volume": [], "date": None}
