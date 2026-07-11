from fastapi import APIRouter, Query
from services.etf import get_premiums

router = APIRouter(prefix="/api/etf")


@router.get("/premium")
def premium(symbols: str = Query(...)):
    return get_premiums([s.strip() for s in symbols.split(",") if s.strip()])
