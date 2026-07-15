from datetime import date
from decimal import Decimal
from typing import Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from auth import get_current_user
from services import portfolio

router = APIRouter(prefix="/api/portfolio")

Side = Literal["buy", "sell", "dividend", "stock_dividend"]


class TransactionCreate(BaseModel):
    symbol: str
    side: Side
    quantity: Decimal = Field(gt=0)
    price: Decimal = Field(ge=0, default=Decimal(0))
    fee: Decimal = Field(ge=0, default=Decimal(0))
    tax: Decimal = Field(ge=0, default=Decimal(0))
    account_id: Optional[int] = None
    traded_at: date
    note: Optional[str] = None


class TransactionUpdate(BaseModel):
    symbol: Optional[str] = None
    side: Optional[Side] = None
    quantity: Optional[Decimal] = Field(gt=0, default=None)
    price: Optional[Decimal] = Field(ge=0, default=None)
    fee: Optional[Decimal] = Field(ge=0, default=None)
    tax: Optional[Decimal] = Field(ge=0, default=None)
    account_id: Optional[int] = None
    traded_at: Optional[date] = None
    note: Optional[str] = None


class AccountCreate(BaseModel):
    name: str
    kind: Literal["asset", "liability"]


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    sort_order: Optional[int] = None


class EntryCreate(BaseModel):
    kind: Literal["deposit", "withdraw", "adjust"]
    amount: Decimal
    note: Optional[str] = None


class LeverageSet(BaseModel):
    factor: Decimal


@router.get("/summary")
def summary(user_id: str = Depends(get_current_user)):
    return portfolio.get_summary(user_id)


@router.get("/positions")
def positions(user_id: str = Depends(get_current_user)):
    return portfolio.get_positions(user_id)


@router.get("/transactions")
def transactions(symbol: Optional[str] = None, user_id: str = Depends(get_current_user)):
    return portfolio.list_transactions(user_id, symbol)


@router.post("/transactions", status_code=201)
def create_transaction(body: TransactionCreate, user_id: str = Depends(get_current_user)):
    return portfolio.create_transaction(user_id, body.model_dump())


@router.patch("/transactions/{tx_id}")
def update_transaction(tx_id: int, body: TransactionUpdate, user_id: str = Depends(get_current_user)):
    return portfolio.update_transaction(user_id, tx_id, body.model_dump(exclude_unset=True))


@router.delete("/transactions/{tx_id}", status_code=204)
def delete_transaction(tx_id: int, user_id: str = Depends(get_current_user)):
    portfolio.delete_transaction(user_id, tx_id)


@router.get("/accounts")
def accounts(user_id: str = Depends(get_current_user)):
    return portfolio.list_accounts(user_id)


@router.post("/accounts", status_code=201)
def create_account(body: AccountCreate, user_id: str = Depends(get_current_user)):
    return portfolio.create_account(user_id, body.name, body.kind)


@router.patch("/accounts/{account_id}")
def update_account(account_id: int, body: AccountUpdate, user_id: str = Depends(get_current_user)):
    return portfolio.update_account(user_id, account_id, body.name, body.sort_order)


@router.delete("/accounts/{account_id}", status_code=204)
def delete_account(account_id: int, user_id: str = Depends(get_current_user)):
    portfolio.delete_account(user_id, account_id)


@router.post("/accounts/{account_id}/entries", status_code=201)
def add_entry(account_id: int, body: EntryCreate, user_id: str = Depends(get_current_user)):
    return portfolio.add_entry(user_id, account_id, body.kind, body.amount, body.note)


@router.put("/leverage/{symbol}")
def set_leverage(symbol: str, body: LeverageSet, user_id: str = Depends(get_current_user)):
    portfolio.set_leverage(user_id, symbol, body.factor)
    return {"symbol": symbol, "factor": body.factor}


@router.delete("/leverage/{symbol}", status_code=204)
def clear_leverage(symbol: str, user_id: str = Depends(get_current_user)):
    portfolio.clear_leverage(user_id, symbol)
