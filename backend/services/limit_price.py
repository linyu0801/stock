import math

# TWSE/TPEX 升降單位級距（2020-10-26 修訂）
_TICK_BANDS: list[tuple[float, float]] = [
    (10, 0.01),
    (50, 0.05),
    (100, 0.1),
    (500, 0.5),
    (1000, 1.0),
    (float("inf"), 5.0),
]

_EPS = 1e-9


def _tick_size(price: float) -> float:
    for threshold, tick in _TICK_BANDS:
        if price < threshold:
            return tick
    return 5.0


def limit_up_price(prev_close: float) -> float:
    """漲停價：前收 * 1.1，無條件捨去至檔位（確保不超過 +10%）"""
    raw = prev_close * 1.1
    tick = _tick_size(raw)
    return round(math.floor(raw / tick + _EPS) * tick, 2)


def limit_down_price(prev_close: float) -> float:
    """跌停價：前收 * 0.9，無條件進位至檔位（確保不低於 -10%）"""
    raw = prev_close * 0.9
    tick = _tick_size(raw)
    return round(math.ceil(raw / tick - _EPS) * tick, 2)


def limit_status(close: float | None, prev_close: float | None) -> str | None:
    """回傳 'up' / 'down' / None。prev_close 需為正值才有意義（新股掛牌無前收）"""
    if close is None or not prev_close or prev_close <= 0:
        return None
    close = round(close, 2)
    if close >= limit_up_price(prev_close):
        return "up"
    if close <= limit_down_price(prev_close):
        return "down"
    return None
