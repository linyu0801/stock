from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from db import get_conn
from auth import get_current_user

router = APIRouter(prefix="/api/watchlist")

class GroupCreate(BaseModel):
    name: str

class GroupRename(BaseModel):
    name: str

class StockAdd(BaseModel):
    symbol: str
    group_id: int

class StockUpdate(BaseModel):
    group_id: Optional[int] = None
    note: Optional[str] = None

class StockBatchItem(BaseModel):
    symbol: str
    group: str

class StockBatch(BaseModel):
    stocks: list[StockBatchItem]

class SublabelCreate(BaseModel):
    group_id: int
    label: str

class SublabelUpdate(BaseModel):
    label: str

class ReorderItem(BaseModel):
    type: str   # "stock" | "sublabel"
    id: int

class ReorderBody(BaseModel):
    group_id: int
    items: list[ReorderItem]


def _require_group(conn, group_id: int, user_id: str) -> None:
    if conn.execute(
        "SELECT 1 FROM groups WHERE id = %s AND user_id = %s", (group_id, user_id)
    ).fetchone() is None:
        raise HTTPException(404, "group not found")


_OWNED = "group_id IN (SELECT id FROM groups WHERE user_id = %s)"


@router.get("")
def get_watchlist(user_id: str = Depends(get_current_user)):
    with get_conn() as conn:
        groups = conn.execute(
            'SELECT id, name, "order" FROM groups WHERE user_id = %s ORDER BY "order", id',
            (user_id,),
        ).fetchall()
        result = []
        for g in groups:
            stocks = conn.execute(
                """SELECT s.id, s.symbol, s.added_at, s.note, s.sort_order,
                          COALESCE(m.name, s.symbol) as name
                   FROM stocks s
                   LEFT JOIN stocks_meta m ON s.symbol = m.symbol
                   WHERE s.group_id = %s""",
                (g["id"],),
            ).fetchall()
            sublabels = conn.execute(
                "SELECT id, label, sort_order FROM sublabels WHERE group_id = %s",
                (g["id"],),
            ).fetchall()
            # merge and sort by sort_order
            items = (
                [{"_type": "stock",    **dict(s)} for s in stocks] +
                [{"_type": "sublabel", **dict(sl)} for sl in sublabels]
            )
            items.sort(key=lambda x: (x["sort_order"], x["id"]))
            result.append({
                "id": g["id"],
                "name": g["name"],
                "order": g["order"],
                "stocks": [dict(s) for s in stocks],  # kept for price fetching
                "items": items,
            })
        return result


@router.post("/groups", status_code=201)
def create_group(body: GroupCreate, user_id: str = Depends(get_current_user)):
    with get_conn() as conn:
        try:
            cur = conn.execute(
                'INSERT INTO groups (name, "order", user_id) VALUES (%s, (SELECT COALESCE(MAX("order"),0)+1 FROM groups WHERE user_id = %s), %s) RETURNING id',
                (body.name, user_id, user_id),
            )
            return {"id": cur.fetchone()["id"], "name": body.name}
        except Exception:
            raise HTTPException(409, f"Group '{body.name}' already exists")


@router.patch("/groups/{group_id}")
def rename_group(group_id: int, body: GroupRename, user_id: str = Depends(get_current_user)):
    with get_conn() as conn:
        cur = conn.execute(
            "UPDATE groups SET name = %s WHERE id = %s AND user_id = %s",
            (body.name, group_id, user_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "group not found")
        return {"id": group_id, "name": body.name}


@router.delete("/groups/{group_id}", status_code=204)
def delete_group(group_id: int, user_id: str = Depends(get_current_user)):
    with get_conn() as conn:
        cur = conn.execute("DELETE FROM groups WHERE id = %s AND user_id = %s", (group_id, user_id))
        if cur.rowcount == 0:
            raise HTTPException(404, "group not found")


@router.post("/stocks", status_code=201)
def add_stock(body: StockAdd, user_id: str = Depends(get_current_user)):
    with get_conn() as conn:
        _require_group(conn, body.group_id, user_id)
        try:
            cur = conn.execute(
                "INSERT INTO stocks (symbol, group_id, sort_order) VALUES (%s, %s, (SELECT COALESCE(MAX(sort_order),0)+1 FROM stocks WHERE group_id=%s)) RETURNING id",
                (body.symbol, body.group_id, body.group_id),
            )
            return {"id": cur.fetchone()["id"], "symbol": body.symbol, "group_id": body.group_id}
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(409, f"Stock '{body.symbol}' already in group")


@router.post("/stocks/batch", status_code=201)
def batch_add_stocks(body: StockBatch, user_id: str = Depends(get_current_user)):
    added = []
    with get_conn() as conn:
        for item in body.stocks:
            row = conn.execute(
                "SELECT id FROM groups WHERE name = %s AND user_id = %s", (item.group, user_id)
            ).fetchone()
            if row is None:
                cur = conn.execute(
                    'INSERT INTO groups (name, "order", user_id) VALUES (%s, (SELECT COALESCE(MAX("order"),0)+1 FROM groups WHERE user_id = %s), %s) RETURNING id',
                    (item.group, user_id, user_id),
                )
                group_id = cur.fetchone()["id"]
            else:
                group_id = row["id"]
            # PG 交易內失敗的 INSERT 會 abort 整個交易（SQLite 不會），不能用 try/except pass 續跑
            cur = conn.execute(
                "INSERT INTO stocks (symbol, group_id, sort_order) VALUES (%s, %s, (SELECT COALESCE(MAX(sort_order),0)+1 FROM stocks WHERE group_id=%s)) ON CONFLICT DO NOTHING RETURNING id",
                (item.symbol, group_id, group_id),
            )
            row2 = cur.fetchone()
            if row2 is not None:
                added.append({"id": row2["id"], "symbol": item.symbol, "group_id": group_id})
    return {"added": added}


@router.delete("/stocks/{stock_id}", status_code=204)
def remove_stock(stock_id: int, user_id: str = Depends(get_current_user)):
    with get_conn() as conn:
        cur = conn.execute(f"DELETE FROM stocks WHERE id = %s AND {_OWNED}", (stock_id, user_id))
        if cur.rowcount == 0:
            raise HTTPException(404, "stock not found")


@router.patch("/stocks/{stock_id}")
def update_stock(stock_id: int, body: StockUpdate, user_id: str = Depends(get_current_user)):
    with get_conn() as conn:
        if body.group_id is not None:
            _require_group(conn, body.group_id, user_id)
            cur = conn.execute(
                f"UPDATE stocks SET group_id = %s WHERE id = %s AND {_OWNED}",
                (body.group_id, stock_id, user_id),
            )
            if cur.rowcount == 0:
                raise HTTPException(404, "stock not found")
        if "note" in body.model_fields_set:
            cur = conn.execute(
                f"UPDATE stocks SET note = %s WHERE id = %s AND {_OWNED}",
                (body.note, stock_id, user_id),
            )
            if cur.rowcount == 0:
                raise HTTPException(404, "stock not found")
        row = conn.execute(
            f"SELECT id, group_id, note FROM stocks WHERE id = %s AND {_OWNED}",
            (stock_id, user_id),
        ).fetchone()
        if row is None:
            raise HTTPException(404, "stock not found")
        return dict(row)


@router.post("/sublabels", status_code=201)
def create_sublabel(body: SublabelCreate, user_id: str = Depends(get_current_user)):
    with get_conn() as conn:
        _require_group(conn, body.group_id, user_id)
        max_order = conn.execute(
            "SELECT MAX(sort_order) as m FROM ("
            "  SELECT sort_order FROM stocks WHERE group_id=%s"
            "  UNION ALL"
            "  SELECT sort_order FROM sublabels WHERE group_id=%s"
            ")", (body.group_id, body.group_id)
        ).fetchone()["m"] or 0
        cur = conn.execute(
            "INSERT INTO sublabels (group_id, label, sort_order) VALUES (%s, %s, %s) RETURNING id",
            (body.group_id, body.label, max_order + 1),
        )
        return {"id": cur.fetchone()["id"], "group_id": body.group_id, "label": body.label}


@router.patch("/sublabels/{sublabel_id}")
def update_sublabel(sublabel_id: int, body: SublabelUpdate, user_id: str = Depends(get_current_user)):
    with get_conn() as conn:
        cur = conn.execute(
            f"UPDATE sublabels SET label = %s WHERE id = %s AND {_OWNED}",
            (body.label, sublabel_id, user_id),
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "sublabel not found")
        return {"id": sublabel_id, "label": body.label}


@router.delete("/sublabels/{sublabel_id}", status_code=204)
def delete_sublabel(sublabel_id: int, user_id: str = Depends(get_current_user)):
    with get_conn() as conn:
        cur = conn.execute(f"DELETE FROM sublabels WHERE id = %s AND {_OWNED}", (sublabel_id, user_id))
        if cur.rowcount == 0:
            raise HTTPException(404, "sublabel not found")


@router.post("/reorder")
def reorder_items(body: ReorderBody, user_id: str = Depends(get_current_user)):
    with get_conn() as conn:
        _require_group(conn, body.group_id, user_id)
        for i, item in enumerate(body.items):
            if item.type == "stock":
                conn.execute("UPDATE stocks SET sort_order = %s WHERE id = %s AND group_id = %s",
                             (i, item.id, body.group_id))
            elif item.type == "sublabel":
                conn.execute("UPDATE sublabels SET sort_order = %s WHERE id = %s AND group_id = %s",
                             (i, item.id, body.group_id))
    return {"ok": True}
