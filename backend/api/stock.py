from fastapi import APIRouter, HTTPException, Query
from services.fetcher import download_history, get_stock_info
from services.indicators import calc_bias

router = APIRouter(prefix="/api/stock")

VALID_PERIODS = {"1mo", "3mo", "6mo", "1y", "2y", "5y"}
VALID_N = {5, 10, 20, 60}

@router.get("/{symbol}/history")
def get_history(symbol: str, period: str = Query(default="3mo")):
    if period not in VALID_PERIODS:
        raise HTTPException(400, f"period must be one of {VALID_PERIODS}")
    bars = download_history(symbol, period)
    if not bars:
        raise HTTPException(404, f"No data for {symbol}")
    return bars

@router.get("/{symbol}/indicators")
def get_indicators(
    symbol: str,
    type: str = Query(default="bias"),
    n: int = Query(default=20),
    period: str = Query(default="1y"),
):
    if type != "bias":
        raise HTTPException(400, "Only type=bias is supported")
    if n not in VALID_N:
        raise HTTPException(400, f"n must be one of {VALID_N}")
    bars = download_history(symbol, period)
    if not bars:
        raise HTTPException(404, f"No data for {symbol}")
    return calc_bias(bars, n)

@router.get("/{symbol}/info")
def get_info(symbol: str):
    info = get_stock_info(symbol)
    if not info:
        raise HTTPException(404, f"No data for {symbol}")
    return info
