import json
import ssl
import time
import urllib.request
from urllib.parse import urlencode
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta

_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

_ETFORTUNE_URL = "https://www.twse.com.tw/zh/ETFortune/ajaxEtfInfoChart"

_premium_cache: dict[str, tuple[float, dict | None]] = {}
_PREMIUM_TTL = 3600


def _fetch_premium(symbol: str) -> dict | None:
    end = date.today()
    start = end - timedelta(days=14)
    body = urlencode({
        "id": symbol,
        "startDate": start.strftime("%Y/%m/%d"),
        "endDate": end.strftime("%Y/%m/%d"),
        "type": "fundPric",
    }).encode()
    req = urllib.request.Request(_ETFORTUNE_URL, data=body, headers={
        **_HEADERS,
        "Referer": f"https://www.twse.com.tw/zh/ETFortune/etfInfo/{symbol}",
        "Content-Type": "application/x-www-form-urlencoded",
    })
    with urllib.request.urlopen(req, timeout=15, context=_SSL_CTX) as r:
        data = json.loads(r.read())

    def valid_rows(rows: list) -> dict[str, float]:
        out = {}
        for row in rows:
            try:
                d = datetime.strptime(row["date"], "%Y/%m/%d").date()
            except (KeyError, ValueError):
                continue
            # 該站有 "2036/01/04" 這類髒日期，只收查詢窗內的
            if not (start <= d <= end) or row.get("count") is None:
                continue
            out[d.isoformat()] = float(row["count"])
        return out

    navs = valid_rows(data.get("netPrice") or [])
    premiums = valid_rows(data.get("atmps") or [])
    common = sorted(set(navs) & set(premiums))
    if not common:
        return None
    latest = common[-1]
    return {"nav": navs[latest], "premium_pct": premiums[latest], "date": latest}


def get_premiums(symbols: list[str]) -> dict:
    targets = [s for s in symbols if s.startswith("00")]
    now = time.time()
    stale = [s for s in targets if s not in _premium_cache or now - _premium_cache[s][0] >= _PREMIUM_TTL]
    if stale:
        with ThreadPoolExecutor(max_workers=4) as ex:
            futures = {s: ex.submit(_fetch_premium, s) for s in stale}
            for s, f in futures.items():
                try:
                    _premium_cache[s] = (now, f.result())
                except Exception as e:
                    print(f"[etf] {s} premium failed: {e}")
                    _premium_cache[s] = (now, None)
    return {s: _premium_cache[s][1] for s in targets if _premium_cache.get(s) and _premium_cache[s][1]}
