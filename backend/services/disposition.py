import json
import ssl
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date

_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

_TWSE_PUNISH_URL = "https://openapi.twse.com.tw/v1/announcement/punish"
_TWSE_NOTICE_URL = "https://openapi.twse.com.tw/v1/announcement/notice"
_TPEX_DISPOSAL_URL = "https://www.tpex.org.tw/openapi/v1/tpex_disposal_information"
_TPEX_WARNING_URL = "https://www.tpex.org.tw/openapi/v1/tpex_trading_warning_information"

_flags_cache: tuple[float, dict] | None = None
_FLAGS_TTL = 3600


def _get_json(url: str) -> list:
    req = urllib.request.Request(url, headers=_HEADERS)
    with urllib.request.urlopen(req, timeout=30, context=_SSL_CTX) as r:
        return json.loads(r.read())


def _parse_date(raw: str) -> str | None:
    """民國（'115/07/03'、'1150703'）或西元（'20260709'）→ ISO；解不出回 None。"""
    digits = raw.replace("/", "").strip()
    if not digits.isdigit():
        return None
    if len(digits) == 7:
        return f"{int(digits[:3]) + 1911}-{digits[3:5]}-{digits[5:7]}"
    if len(digits) == 8:
        return f"{digits[:4]}-{digits[4:6]}-{digits[6:8]}"
    return None


_PERIOD_SEPS = ("至", "～", "~")


def _parse_period(raw: str) -> tuple[str | None, str | None]:
    for sep in _PERIOD_SEPS:
        parts = raw.split(sep)
        if len(parts) == 2:
            return _parse_date(parts[0]), _parse_date(parts[1])
    if raw.strip():
        print(f"[disposition] unparsed DispositionPeriod: {raw!r}")
    return None, None


def _fetch_all() -> tuple[dict, bool]:
    """回 (全市場 flags map, 是否至少一個來源成功)。"""
    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = {
            "twse_punish": ex.submit(_get_json, _TWSE_PUNISH_URL),
            "twse_notice": ex.submit(_get_json, _TWSE_NOTICE_URL),
            "tpex_disposal": ex.submit(_get_json, _TPEX_DISPOSAL_URL),
            "tpex_warning": ex.submit(_get_json, _TPEX_WARNING_URL),
        }
        results = {}
        ok = False
        for name, f in futures.items():
            try:
                results[name] = f.result()
                ok = True
            except Exception as e:
                print(f"[disposition] {name} failed: {e}")
                results[name] = []

    flags: dict[str, dict] = {}
    today = date.today().isoformat()

    # 注意股先寫入，處置股後寫入覆蓋——同檔並存時取較嚴重的處置
    for row in results["twse_notice"]:
        code = (row.get("Code") or "").strip()
        if not code:  # TWSE 無資料時回一筆全空白 placeholder
            continue
        flags[code] = {
            "level": "warning",
            "reason": row.get("TradingInfoForAttention", ""),
            "measures": None,
            "start": _parse_date(row.get("Date", "")),
            "end": None,
        }
    for row in results["tpex_warning"]:
        code = (row.get("SecuritiesCompanyCode") or "").strip()
        if not code:
            continue
        flags[code] = {
            "level": "warning",
            "reason": row.get("TradingInformation", ""),
            "measures": None,
            "start": _parse_date(row.get("Date", "")),
            "end": None,
        }
    for row in results["twse_punish"]:
        code = (row.get("Code") or "").strip()
        start, end = _parse_period(row.get("DispositionPeriod", ""))
        if not code or (end and end < today):
            continue
        flags[code] = {
            "level": "disposal",
            "reason": row.get("ReasonsOfDisposition", ""),
            "measures": row.get("Detail", ""),
            "start": start,
            "end": end,
        }
    for row in results["tpex_disposal"]:
        code = (row.get("SecuritiesCompanyCode") or "").strip()
        start, end = _parse_period(row.get("DispositionPeriod", ""))
        if not code or (end and end < today):
            continue
        flags[code] = {
            "level": "disposal",
            "reason": row.get("DispositionReasons", ""),
            "measures": row.get("DisposalCondition", ""),
            "start": start,
            "end": end,
        }
    return flags, ok


def get_flags(symbols: list[str]) -> dict:
    global _flags_cache
    now = time.time()
    if _flags_cache is None or now - _flags_cache[0] >= _FLAGS_TTL:
        flags, ok = _fetch_all()
        if ok or _flags_cache is None:
            _flags_cache = (now, flags)
        else:
            _flags_cache = (now, _flags_cache[1])  # 全來源失敗 → 沿用舊資料，TTL 後再試
    all_flags = _flags_cache[1]
    return {s: all_flags[s] for s in symbols if s in all_flags}
