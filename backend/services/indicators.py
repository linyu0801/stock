import pandas as pd
from typing import Any

def calc_bias(bars: list[dict[str, Any]], n: int) -> list[dict[str, Any]]:
    if not bars:
        return []
    df = pd.DataFrame(bars)
    df["ma"] = df["close"].rolling(window=n).mean()
    df["bias"] = (df["close"] - df["ma"]) / df["ma"] * 100
    df = df.dropna(subset=["bias"])
    return [
        {"time": row["time"], "value": round(row["bias"], 4)}
        for _, row in df.iterrows()
    ]
