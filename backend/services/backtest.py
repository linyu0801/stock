from typing import Any
from services.fetcher import download_history
from services.indicators import calc_bias

def run_backtest(
    symbol: str,
    start: str,
    end: str,
    buy_threshold: float,
    sell_threshold: float,
    n: int,
) -> dict[str, Any]:
    bars = download_history(symbol, "5y")
    bars = [b for b in bars if start <= b["time"] <= end]
    bias_points = calc_bias(bars, n)
    bias_map = {p["time"]: p["value"] for p in bias_points}

    position = None
    trades = []
    equity = 1.0
    equity_curve = []

    for bar in bars:
        t = bar["time"]
        bias = bias_map.get(t)
        if bias is None:
            equity_curve.append({"time": t, "value": round(equity, 6)})
            continue

        if position is None and bias <= buy_threshold:
            position = {"buy_price": bar["close"], "buy_time": t}
        elif position is not None and bias >= sell_threshold:
            ret = (bar["close"] - position["buy_price"]) / position["buy_price"]
            equity *= 1 + ret
            trades.append({
                "buy_time": position["buy_time"],
                "buy_price": position["buy_price"],
                "sell_time": t,
                "sell_price": bar["close"],
                "return_pct": round(ret * 100, 2),
            })
            position = None

        equity_curve.append({"time": t, "value": round(equity, 6)})

    total_return_pct = round((equity - 1) * 100, 2)
    return {
        "trades": trades,
        "trade_count": len(trades),
        "total_return_pct": total_return_pct,
        "equity_curve": equity_curve,
    }
