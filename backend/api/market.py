from fastapi import APIRouter
from services.market import get_movers

router = APIRouter(prefix="/api/market")

@router.get("/movers")
def movers():
    return get_movers()
