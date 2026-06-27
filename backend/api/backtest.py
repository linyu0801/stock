from fastapi import APIRouter
from pydantic import BaseModel
from services.backtest import run_backtest

router = APIRouter(prefix="/api")

class BacktestRequest(BaseModel):
    symbol: str
    start: str
    end: str
    buy_threshold: float = -5.0
    sell_threshold: float = 5.0
    n: int = 20

@router.post("/backtest")
def backtest(body: BacktestRequest):
    return run_backtest(
        body.symbol, body.start, body.end,
        body.buy_threshold, body.sell_threshold, body.n,
    )
