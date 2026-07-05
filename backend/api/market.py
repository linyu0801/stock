from fastapi import APIRouter, HTTPException
from services.market import get_movers
from services.concepts import get_concept_list, get_concept_stocks
from services.sectors import get_sector_indices

router = APIRouter(prefix="/api/market")


@router.get("/sectors")
def sectors():
    return get_sector_indices()


@router.get("/movers")
def movers():
    return get_movers()


@router.get("/concepts")
def concepts():
    return get_concept_list()


@router.get("/concepts/{category}")
def concept_stocks(category: str):
    stocks = get_concept_stocks(category)
    if stocks is None:
        raise HTTPException(status_code=404, detail="concept not found")
    return {"stocks": stocks}
