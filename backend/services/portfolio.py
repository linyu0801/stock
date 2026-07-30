import re
from datetime import date, timedelta
from decimal import Decimal
from fastapi import HTTPException

from db import get_conn
from services.fetcher import get_batch_prices, get_usd_twd, is_us_symbol

_LEV_2X = re.compile(r"^\d+L$")
_LEV_INV = re.compile(r"^\d+R$")

# 現金有影響的 side → cash_entries.kind
_CASH_KIND = {"buy": "trade", "sell": "trade", "dividend": "dividend"}


def _monthly_payment(balance: Decimal, rate: Decimal, periods: int) -> Decimal:
    """等額本息月付金。rate 為年利率(%)。"""
    if periods <= 0 or balance <= 0:
        return Decimal(0)
    r = float(rate) / 100 / 12
    n = periods
    if r == 0:
        return balance / n
    factor = (1 + r) ** n
    return balance * Decimal(str(r * factor / (factor - 1)))


def infer_factor(symbol: str) -> Decimal:
    if _LEV_2X.match(symbol):
        return Decimal(2)
    if _LEV_INV.match(symbol):
        return Decimal(-1)
    return Decimal(1)


def _cash_amount(side: str, qty: Decimal, price: Decimal, fee: Decimal, tax: Decimal) -> Decimal | None:
    if side == "buy":
        return -(qty * price + fee)
    if side in ("sell", "dividend"):
        return qty * price - fee - tax
    return None  # stock_dividend 不動現金


def _replay(rows: list[dict]) -> dict[str, dict]:
    """rows 需已按 (traded_at, id) 排序。任一前綴賣超 → 400。"""
    pos: dict[str, dict] = {}
    for t in rows:
        p = pos.setdefault(t["symbol"], {"qty": Decimal(0), "cost": Decimal(0), "realized": Decimal(0)})
        qty, price, fee, tax = t["quantity"], t["price"], t["fee"], t["tax"]
        side = t["side"]
        if side == "buy":
            p["qty"] += qty
            p["cost"] += qty * price + fee
        elif side == "sell":
            if qty > p["qty"]:
                raise HTTPException(400, f"oversell: {t['symbol']} on {t['traded_at']}")
            avg = p["cost"] / p["qty"]
            p["realized"] += qty * price - fee - tax - avg * qty
            p["cost"] -= avg * qty
            p["qty"] -= qty
        elif side == "dividend":
            p["realized"] += qty * price - fee - tax
        else:  # stock_dividend：股數增加、總成本不變 → 均價攤薄
            p["qty"] += qty
    return pos


def _fetch_txs(conn, user_id: str, symbol: str | None = None) -> list[dict]:
    sql = ("SELECT id, symbol, side, quantity, price, fee, tax, account_id, traded_at, note "
           "FROM portfolio_transactions WHERE user_id = %s")
    params: list = [user_id]
    if symbol is not None:
        sql += " AND symbol = %s"
        params.append(symbol)
    return conn.execute(sql + " ORDER BY traded_at, id", params).fetchall()


def _validate_sequence(conn, user_id: str, symbol: str, candidate: dict, exclude_id: int | None) -> None:
    """把 candidate 併入該 symbol 的既有序列重播，賣超即 400。"""
    rows = [r for r in _fetch_txs(conn, user_id, symbol) if r["id"] != exclude_id]
    rows.append({**candidate, "id": 10**12})  # 新紀錄同日排最後
    rows.sort(key=lambda r: (r["traded_at"], r["id"]))
    _replay(rows)


def _require_account(conn, account_id: int, user_id: str) -> None:
    if conn.execute(
        "SELECT 1 FROM portfolio_accounts WHERE id = %s AND user_id = %s", (account_id, user_id)
    ).fetchone() is None:
        raise HTTPException(404, "account not found")


def _insert_linked_entry(conn, user_id: str, tx: dict, tx_id: int) -> None:
    amount = _cash_amount(tx["side"], tx["quantity"], tx["price"], tx["fee"], tx["tax"])
    if tx.get("account_id") is None or amount is None:
        return
    conn.execute(
        "INSERT INTO portfolio_cash_entries (user_id, account_id, kind, amount, transaction_id, entry_date) "
        "VALUES (%s, %s, %s, %s, %s, %s)",
        (user_id, tx["account_id"], _CASH_KIND[tx["side"]], amount, tx_id, tx["traded_at"]),
    )


def create_transaction(user_id: str, data: dict) -> dict:
    with get_conn() as conn:
        if data.get("account_id") is not None:
            _require_account(conn, data["account_id"], user_id)
        _validate_sequence(conn, user_id, data["symbol"], data, exclude_id=None)
        cur = conn.execute(
            "INSERT INTO portfolio_transactions (user_id, symbol, side, quantity, price, fee, tax, account_id, traded_at, note) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (user_id, data["symbol"], data["side"], data["quantity"], data["price"],
             data["fee"], data["tax"], data.get("account_id"), data["traded_at"], data.get("note")),
        )
        tx_id = cur.fetchone()["id"]
        _insert_linked_entry(conn, user_id, data, tx_id)
        return {"id": tx_id}


def update_transaction(user_id: str, tx_id: int, data: dict) -> dict:
    with get_conn() as conn:
        old = conn.execute(
            "SELECT id, symbol, side, quantity, price, fee, tax, account_id, traded_at, note "
            "FROM portfolio_transactions WHERE id = %s AND user_id = %s",
            (tx_id, user_id),
        ).fetchone()
        if old is None:
            raise HTTPException(404, "transaction not found")
        merged = {**old, **data}
        if merged["account_id"] is not None and merged["account_id"] != old["account_id"]:
            _require_account(conn, merged["account_id"], user_id)
        _validate_sequence(conn, user_id, merged["symbol"], merged, exclude_id=tx_id)
        if merged["symbol"] != old["symbol"]:
            # 舊 symbol 少了這筆之後也要仍然合法
            rows = [r for r in _fetch_txs(conn, user_id, old["symbol"]) if r["id"] != tx_id]
            _replay(rows)
        conn.execute(
            "UPDATE portfolio_transactions SET symbol=%s, side=%s, quantity=%s, price=%s, fee=%s, tax=%s, "
            "account_id=%s, traded_at=%s, note=%s WHERE id=%s",
            (merged["symbol"], merged["side"], merged["quantity"], merged["price"], merged["fee"],
             merged["tax"], merged["account_id"], merged["traded_at"], merged["note"], tx_id),
        )
        conn.execute("DELETE FROM portfolio_cash_entries WHERE transaction_id = %s", (tx_id,))
        _insert_linked_entry(conn, user_id, merged, tx_id)
        return dict(merged)


def delete_transaction(user_id: str, tx_id: int) -> None:
    with get_conn() as conn:
        cur = conn.execute(
            "DELETE FROM portfolio_transactions WHERE id = %s AND user_id = %s", (tx_id, user_id)
        )  # cash_entries 靠 ON DELETE CASCADE 一併清
        if cur.rowcount == 0:
            raise HTTPException(404, "transaction not found")


def list_transactions(user_id: str, symbol: str | None) -> list[dict]:
    with get_conn() as conn:
        rows = _fetch_txs(conn, user_id, symbol)
    rows.reverse()  # 新的在前
    return [dict(r) for r in rows]


def _position_state(user_id: str) -> tuple[list[dict], list[str]]:
    with get_conn() as conn:
        txs = _fetch_txs(conn, user_id)
        overrides = {
            r["symbol"]: r["factor"]
            for r in conn.execute(
                "SELECT symbol, factor FROM portfolio_leverage WHERE user_id = %s", (user_id,)
            ).fetchall()
        }
        meta = {
            r["symbol"]: r["name"]
            for r in conn.execute(
                "SELECT symbol, name FROM stocks_meta WHERE symbol = ANY(%s)",
                ([t["symbol"] for t in txs],),
            ).fetchall()
        } if txs else {}
    replayed = _replay(txs)
    held = {s: p for s, p in replayed.items() if p["qty"] > 0}
    prices = {p["symbol"]: p for p in get_batch_prices(list(held))} if held else {}
    missing = sorted(set(held) - set(prices))
    has_us = any(is_us_symbol(s) for s in held)
    rate = get_usd_twd() if has_us else None  # 有美股才打匯率
    fx = Decimal(str(rate)) if rate is not None else None
    positions = []
    for symbol, p in held.items():
        currency = "USD" if is_us_symbol(symbol) else "TWD"
        close = Decimal(str(prices[symbol]["close"])) if symbol in prices else None
        factor = overrides.get(symbol, infer_factor(symbol))
        mv = close * p["qty"] if close is not None else None  # 原幣市值
        if mv is None:
            mv_twd = None
        elif currency == "USD":
            mv_twd = mv * fx if fx is not None else None
            if fx is None and symbol not in missing:
                missing.append(symbol)  # 有價但無匯率：不入總額，標示不完整
        else:
            mv_twd = mv
        positions.append({
            "symbol": symbol,
            "name": meta.get(symbol, symbol),
            "currency": currency,
            "quantity": p["qty"],
            "avg_cost": p["cost"] / p["qty"],
            "close": close,
            "market_value": mv,
            "market_value_twd": mv_twd,
            "unrealized": (mv - p["cost"]) if mv is not None else None,
            "realized": p["realized"],
            "factor": factor,
            "factor_overridden": symbol in overrides,
            "exposure": (mv_twd * factor) if mv_twd is not None else None,
        })
    positions.sort(key=lambda x: x["symbol"])
    gain = Decimal(0)
    loss = Decimal(0)
    for p in positions:
        if p["unrealized"] is None:
            continue
        if p["currency"] == "USD":
            if fx is None:
                continue
            u = p["unrealized"] * fx
        else:
            u = p["unrealized"]
        if u >= 0:
            gain += u
        else:
            loss += u
    stats = {"gain": gain, "loss": loss, "net": gain + loss}
    return positions, sorted(missing), stats


def get_positions(user_id: str) -> dict:
    positions, missing, stats = _position_state(user_id)
    return {"positions": positions, "missing_symbols": missing, "unrealized": stats}


def _account_rows(conn, user_id: str) -> list[dict]:
    return conn.execute(
        "SELECT a.id, a.name, a.kind, a.sort_order, a.rate, a.due_date, a.periods, "
        "COALESCE(SUM(e.amount), 0) AS balance "
        "FROM portfolio_accounts a "
        "LEFT JOIN portfolio_cash_entries e ON e.account_id = a.id "
        "WHERE a.user_id = %s GROUP BY a.id ORDER BY a.sort_order, a.id",
        (user_id,),
    ).fetchall()


def _current_portion(a: dict, horizon: date) -> Decimal:
    """該負債科目未來 12 個月要還的金額。有期數+利率 → 攤銷月付×12（上限為餘額）；否則回退到期日全有全無。"""
    if a["balance"] <= 0:
        return Decimal(0)
    if a["periods"] is not None and a["rate"] is not None:
        monthly = _monthly_payment(a["balance"], a["rate"], a["periods"])
        return min(a["balance"], monthly * 12)
    if a["due_date"] is not None and a["due_date"] <= horizon:
        return a["balance"]
    return Decimal(0)


def get_summary(user_id: str) -> dict:
    positions, missing, _ = _position_state(user_id)
    with get_conn() as conn:
        accounts = _account_rows(conn, user_id)
    assets = sum((a["balance"] for a in accounts if a["kind"] == "asset"), Decimal(0))
    liabilities = sum((a["balance"] for a in accounts if a["kind"] == "liability"), Decimal(0))
    stock_value = sum((p["market_value_twd"] for p in positions if p["market_value_twd"] is not None), Decimal(0))
    net_exposure = sum((p["exposure"] for p in positions if p["exposure"] is not None), Decimal(0))
    gross_exposure = sum((abs(p["exposure"]) for p in positions if p["exposure"] is not None), Decimal(0))
    net_worth = assets + stock_value - liabilities
    total_assets = assets + stock_value
    # 流動負債：優先用期數+利率算攤銷月付×12；沒填期數才回退到期日全有全無
    horizon = date.today() + timedelta(days=365)
    current_liabilities = sum(
        (_current_portion(a, horizon) for a in accounts if a["kind"] == "liability"),
        Decimal(0),
    )
    return {
        "net_worth": net_worth,
        "assets_total": assets,
        "liabilities_total": liabilities,
        "stock_value": stock_value,
        "net_exposure": net_exposure,
        "gross_exposure": gross_exposure,
        "exposure_ratio": (net_exposure / net_worth) if net_worth > 0 else None,
        "debt_ratio": (liabilities / total_assets) if total_assets > 0 else None,
        "current_ratio": (total_assets / current_liabilities) if current_liabilities > 0 else None,
        "incomplete": bool(missing),
        "missing_symbols": missing,
    }


def list_accounts(user_id: str) -> list[dict]:
    with get_conn() as conn:
        rows = _account_rows(conn, user_id)
    return [dict(r) for r in rows]


def create_account(
    user_id: str, name: str, kind: str,
    initial_balance: Decimal, rate: Decimal | None, due_date, periods: int | None = None,
) -> dict:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO portfolio_accounts (user_id, name, kind, sort_order, rate, due_date, periods) "
            "VALUES (%s, %s, %s, (SELECT COALESCE(MAX(sort_order),0)+1 FROM portfolio_accounts WHERE user_id = %s), %s, %s, %s) "
            "RETURNING id",
            (user_id, name, kind, user_id, rate, due_date, periods),
        )
        account_id = cur.fetchone()["id"]
        if initial_balance:
            conn.execute(
                "INSERT INTO portfolio_cash_entries (user_id, account_id, kind, amount, entry_date) "
                "VALUES (%s, %s, 'adjust', %s, CURRENT_DATE)",
                (user_id, account_id, initial_balance),
            )
        return {"id": account_id, "name": name, "kind": kind}


def update_account(
    user_id: str, account_id: int, name: str | None, sort_order: int | None,
    rate: Decimal | None = None, due_date=None, periods: int | None = None,
) -> dict:
    with get_conn() as conn:
        _require_account(conn, account_id, user_id)
        if name is not None:
            conn.execute("UPDATE portfolio_accounts SET name = %s WHERE id = %s AND user_id = %s", (name, account_id, user_id))
        if sort_order is not None:
            conn.execute("UPDATE portfolio_accounts SET sort_order = %s WHERE id = %s AND user_id = %s", (sort_order, account_id, user_id))
        if rate is not None:
            conn.execute("UPDATE portfolio_accounts SET rate = %s WHERE id = %s AND user_id = %s", (rate, account_id, user_id))
        if due_date is not None:
            conn.execute("UPDATE portfolio_accounts SET due_date = %s WHERE id = %s AND user_id = %s", (due_date, account_id, user_id))
        if periods is not None:
            conn.execute("UPDATE portfolio_accounts SET periods = %s WHERE id = %s AND user_id = %s", (periods, account_id, user_id))
        row = conn.execute(
            "SELECT id, name, kind, sort_order, rate, due_date, periods FROM portfolio_accounts WHERE id = %s", (account_id,)
        ).fetchone()
        return dict(row)


def delete_account(user_id: str, account_id: int) -> None:
    with get_conn() as conn:
        _require_account(conn, account_id, user_id)
        # 手動事件隨科目 CASCADE 清掉；被交易連動過的才擋（刪科目會默默毀交易的現金流）
        if conn.execute(
            "SELECT 1 FROM portfolio_cash_entries WHERE account_id = %s AND transaction_id IS NOT NULL LIMIT 1",
            (account_id,),
        ).fetchone() is not None:
            raise HTTPException(409, "account has linked transactions")
        conn.execute("DELETE FROM portfolio_accounts WHERE id = %s AND user_id = %s", (account_id, user_id))


def add_entry(user_id: str, account_id: int, kind: str, amount: Decimal, note: str | None) -> dict:
    with get_conn() as conn:
        _require_account(conn, account_id, user_id)
        cur = conn.execute(
            "INSERT INTO portfolio_cash_entries (user_id, account_id, kind, amount, entry_date, note) "
            "VALUES (%s, %s, %s, %s, CURRENT_DATE, %s) RETURNING id",
            (user_id, account_id, kind, amount, note),
        )
        return {"id": cur.fetchone()["id"]}


def set_leverage(user_id: str, symbol: str, factor: Decimal) -> None:
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO portfolio_leverage (user_id, symbol, factor) VALUES (%s, %s, %s) "
            "ON CONFLICT (user_id, symbol) DO UPDATE SET factor = EXCLUDED.factor",
            (user_id, symbol, factor),
        )


def clear_leverage(user_id: str, symbol: str) -> None:
    with get_conn() as conn:
        cur = conn.execute(
            "DELETE FROM portfolio_leverage WHERE user_id = %s AND symbol = %s", (user_id, symbol)
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "no override")
