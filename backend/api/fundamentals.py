from fastapi import APIRouter, Query
from services.fundamentals import get_revenue, get_valuations

router = APIRouter(prefix="/api/fundamentals")


@router.get("/valuations")
def valuations(symbols: str = Query(...)):
    vals = get_valuations([s.strip() for s in symbols.split(",") if s.strip()])
    return [{"symbol": s, **v} for s, v in vals.items()]


@router.get("/{symbol}")
def fundamentals(symbol: str):
    valuation = get_valuations([symbol]).get(symbol)
    return {"valuation": valuation, "revenue": get_revenue(symbol)}
