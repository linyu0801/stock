from datetime import date
from decimal import Decimal
from typing import Annotated, Literal, Optional

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
    pending: Optional[bool] = None


class AccountCreate(BaseModel):
    name: str
    kind: Literal["asset", "liability"]
    initial_balance: Decimal = Decimal(0)
    rate: Optional[Decimal] = None
    due_date: Optional[date] = None
    periods: Optional[int] = None
    currency: Literal["TWD", "USD"] = "TWD"


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    sort_order: Optional[int] = None
    rate: Optional[Decimal] = None
    due_date: Optional[date] = None
    periods: Optional[int] = None
    currency: Optional[Literal["TWD", "USD"]] = None


class EntryCreate(BaseModel):
    kind: Literal["deposit", "withdraw", "adjust"]
    amount: Decimal
    note: Optional[str] = None


class LeverageSet(BaseModel):
    factor: Decimal


FeeMode = Literal["none", "fixed", "rate"]
Day = Annotated[int, Field(ge=1, le=31)]


class PlanCreate(BaseModel):
    symbol: str
    account_id: int
    amount: Decimal = Field(gt=0)
    fee_mode: FeeMode = "none"
    fee_value: Decimal = Field(ge=0, default=Decimal(0))
    fee_min: Decimal = Field(ge=0, default=Decimal(0))
    days_of_month: list[Day] = Field(min_length=1)


class PlanUpdate(BaseModel):
    symbol: Optional[str] = None
    account_id: Optional[int] = None
    amount: Optional[Decimal] = Field(gt=0, default=None)
    fee_mode: Optional[FeeMode] = None
    fee_value: Optional[Decimal] = Field(ge=0, default=None)
    fee_min: Optional[Decimal] = Field(ge=0, default=None)
    days_of_month: Optional[list[Day]] = Field(min_length=1, default=None)
    active: Optional[bool] = None


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
    return portfolio.create_account(
        user_id, body.name, body.kind, body.initial_balance, body.rate, body.due_date, body.periods, body.currency
    )


@router.patch("/accounts/{account_id}")
def update_account(account_id: int, body: AccountUpdate, user_id: str = Depends(get_current_user)):
    return portfolio.update_account(
        user_id, account_id, body.name, body.sort_order, body.rate, body.due_date, body.periods, body.currency
    )


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


@router.get("/plans")
def list_plans(user_id: str = Depends(get_current_user)):
    return portfolio.list_plans(user_id)


@router.post("/plans", status_code=201)
def create_plan(body: PlanCreate, user_id: str = Depends(get_current_user)):
    return portfolio.create_plan(
        user_id, body.symbol, body.account_id, body.amount,
        body.fee_mode, body.fee_value, body.fee_min, body.days_of_month,
    )


@router.patch("/plans/{plan_id}")
def update_plan(plan_id: int, body: PlanUpdate, user_id: str = Depends(get_current_user)):
    return portfolio.update_plan(user_id, plan_id, **body.model_dump(exclude_unset=True))


@router.delete("/plans/{plan_id}", status_code=204)
def delete_plan(plan_id: int, user_id: str = Depends(get_current_user)):
    portfolio.delete_plan(user_id, plan_id)
