from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from db import get_conn

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


@router.get("")
def get_watchlist():
    with get_conn() as conn:
        groups = conn.execute(
            'SELECT id, name, "order" FROM groups ORDER BY "order", id'
        ).fetchall()
        result = []
        for g in groups:
            stocks = conn.execute(
                """SELECT s.id, s.symbol, s.added_at, s.note, s.sort_order,
                          COALESCE(m.name, s.symbol) as name
                   FROM stocks s
                   LEFT JOIN stocks_meta m ON s.symbol = m.symbol
                   WHERE s.group_id = ?""",
                (g["id"],),
            ).fetchall()
            sublabels = conn.execute(
                "SELECT id, label, sort_order FROM sublabels WHERE group_id = ?",
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
                "INSERT INTO stocks (symbol, group_id, sort_order) VALUES (?, ?, (SELECT COALESCE(MAX(sort_order),0)+1 FROM stocks WHERE group_id=?))",
                (body.symbol, body.group_id, body.group_id),
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
                    "INSERT INTO stocks (symbol, group_id, sort_order) VALUES (?, ?, (SELECT COALESCE(MAX(sort_order),0)+1 FROM stocks WHERE group_id=?))",
                    (item.symbol, group_id, group_id),
                )
                added.append({"id": cur.lastrowid, "symbol": item.symbol, "group_id": group_id})
            except Exception:
                pass
    return {"added": added}


@router.delete("/stocks/{stock_id}", status_code=204)
def remove_stock(stock_id: int):
    with get_conn() as conn:
        conn.execute("DELETE FROM stocks WHERE id = ?", (stock_id,))


@router.patch("/stocks/{stock_id}")
def update_stock(stock_id: int, body: StockUpdate):
    with get_conn() as conn:
        if body.group_id is not None:
            conn.execute("UPDATE stocks SET group_id = ? WHERE id = ?", (body.group_id, stock_id))
        if body.note is not None:
            conn.execute("UPDATE stocks SET note = ? WHERE id = ?", (body.note, stock_id))
        row = conn.execute("SELECT id, group_id, note FROM stocks WHERE id = ?", (stock_id,)).fetchone()
        return dict(row)


@router.post("/sublabels", status_code=201)
def create_sublabel(body: SublabelCreate):
    with get_conn() as conn:
        # place at end of group items
        max_order = conn.execute(
            "SELECT MAX(sort_order) as m FROM ("
            "  SELECT sort_order FROM stocks WHERE group_id=?"
            "  UNION ALL"
            "  SELECT sort_order FROM sublabels WHERE group_id=?"
            ")", (body.group_id, body.group_id)
        ).fetchone()["m"] or 0
        cur = conn.execute(
            "INSERT INTO sublabels (group_id, label, sort_order) VALUES (?, ?, ?)",
            (body.group_id, body.label, max_order + 1),
        )
        return {"id": cur.lastrowid, "group_id": body.group_id, "label": body.label}


@router.patch("/sublabels/{sublabel_id}")
def update_sublabel(sublabel_id: int, body: SublabelUpdate):
    with get_conn() as conn:
        conn.execute("UPDATE sublabels SET label = ? WHERE id = ?", (body.label, sublabel_id))
        return {"id": sublabel_id, "label": body.label}


@router.delete("/sublabels/{sublabel_id}", status_code=204)
def delete_sublabel(sublabel_id: int):
    with get_conn() as conn:
        conn.execute("DELETE FROM sublabels WHERE id = ?", (sublabel_id,))


@router.post("/reorder")
def reorder_items(body: ReorderBody):
    with get_conn() as conn:
        for i, item in enumerate(body.items):
            if item.type == "stock":
                conn.execute("UPDATE stocks SET sort_order = ? WHERE id = ? AND group_id = ?",
                             (i, item.id, body.group_id))
            elif item.type == "sublabel":
                conn.execute("UPDATE sublabels SET sort_order = ? WHERE id = ? AND group_id = ?",
                             (i, item.id, body.group_id))
    return {"ok": True}
