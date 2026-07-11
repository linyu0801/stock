from fastapi import APIRouter, Query
from services.disposition import get_flags

router = APIRouter(prefix="/api/disposition")


@router.get("/flags")
def flags(symbols: str = Query(...)):
    return get_flags([s.strip() for s in symbols.split(",") if s.strip()])
