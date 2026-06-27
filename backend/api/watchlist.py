from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from db import get_conn

router = APIRouter(prefix="/api/watchlist")

class GroupCreate(BaseModel):
    name: str

class GroupRename(BaseModel):
    name: str

class StockAdd(BaseModel):
    symbol: str
    group_id: int

class StockBatchItem(BaseModel):
    symbol: str
    group: str

class StockBatch(BaseModel):
    stocks: list[StockBatchItem]

class StockMove(BaseModel):
    group_id: int


@router.get("")
def get_watchlist():
    with get_conn() as conn:
        groups = conn.execute(
            'SELECT id, name, "order" FROM groups ORDER BY "order", id'
        ).fetchall()
        result = []
        for g in groups:
            stocks = conn.execute(
                "SELECT id, symbol, added_at FROM stocks WHERE group_id = ? ORDER BY added_at",
                (g["id"],),
            ).fetchall()
            result.append({
                "id": g["id"],
                "name": g["name"],
                "order": g["order"],
                "stocks": [dict(s) for s in stocks],
            })
        return result


@router.post("/groups", status_code=201)
def create_group(body: GroupCreate):
    with get_conn() as conn:
        try:
            cur = conn.execute(
                'INSERT INTO groups (name, "order") VALUES (?, (SELECT COALESCE(MAX("order"),0)+1 FROM groups))',
                (body.name,),
            )
            return {"id": cur.lastrowid, "name": body.name}
        except Exception:
            raise HTTPException(409, f"Group '{body.name}' already exists")


@router.patch("/groups/{group_id}")
def rename_group(group_id: int, body: GroupRename):
    with get_conn() as conn:
        conn.execute("UPDATE groups SET name = ? WHERE id = ?", (body.name, group_id))
        return {"id": group_id, "name": body.name}


@router.delete("/groups/{group_id}", status_code=204)
def delete_group(group_id: int):
    with get_conn() as conn:
        conn.execute("DELETE FROM groups WHERE id = ?", (group_id,))


@router.post("/stocks", status_code=201)
def add_stock(body: StockAdd):
    with get_conn() as conn:
        try:
            cur = conn.execute(
                "INSERT INTO stocks (symbol, group_id) VALUES (?, ?)",
                (body.symbol, body.group_id),
            )
            return {"id": cur.lastrowid, "symbol": body.symbol, "group_id": body.group_id}
        except Exception:
            raise HTTPException(409, f"Stock '{body.symbol}' already in group")


@router.post("/stocks/batch", status_code=201)
def batch_add_stocks(body: StockBatch):
    added = []
    with get_conn() as conn:
        for item in body.stocks:
            row = conn.execute("SELECT id FROM groups WHERE name = ?", (item.group,)).fetchone()
            if row is None:
                cur = conn.execute(
                    'INSERT INTO groups (name, "order") VALUES (?, (SELECT COALESCE(MAX("order"),0)+1 FROM groups))',
                    (item.group,),
                )
                group_id = cur.lastrowid
            else:
                group_id = row["id"]
            try:
                cur = conn.execute(
                    "INSERT INTO stocks (symbol, group_id) VALUES (?, ?)",
                    (item.symbol, group_id),
                )
                added.append({"id": cur.lastrowid, "symbol": item.symbol, "group_id": group_id})
            except Exception:
                pass  # duplicate — ignore per spec
    return {"added": added}


@router.delete("/stocks/{stock_id}", status_code=204)
def remove_stock(stock_id: int):
    with get_conn() as conn:
        conn.execute("DELETE FROM stocks WHERE id = ?", (stock_id,))


@router.patch("/stocks/{stock_id}")
def move_stock(stock_id: int, body: StockMove):
    with get_conn() as conn:
        conn.execute("UPDATE stocks SET group_id = ? WHERE id = ?", (body.group_id, stock_id))
        return {"id": stock_id, "group_id": body.group_id}
