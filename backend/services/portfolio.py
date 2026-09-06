import calendar
import re
import time
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from fastapi import HTTPException

from db import get_conn
from services.fetcher import download_history, get_batch_prices, get_usd_twd, is_us_symbol

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
    sql = ("SELECT id, symbol, side, quantity, price, fee, tax, account_id, traded_at, note, plan_id, pending "
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
            "SELECT id, symbol, side, quantity, price, fee, tax, account_id, traded_at, note, plan_id, pending "
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
            "account_id=%s, traded_at=%s, note=%s, pending=%s WHERE id=%s",
            (merged["symbol"], merged["side"], merged["quantity"], merged["price"], merged["fee"],
             merged["tax"], merged["account_id"], merged["traded_at"], merged["note"], merged["pending"], tx_id),
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
        cost_twd = p["cost"] * fx if currency == "USD" and fx is not None else (p["cost"] if currency == "TWD" else None)
        positions.append({
            "symbol": symbol,
            "name": meta.get(symbol, symbol),
            "currency": currency,
            "quantity": p["qty"],
            "avg_cost": p["cost"] / p["qty"],
            "close": close,
            "market_value": mv,
            "market_value_twd": mv_twd,
            "cost_twd": cost_twd,
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
        "SELECT a.id, a.name, a.kind, a.sort_order, a.rate, a.due_date, a.periods, a.currency, "
        "COALESCE(SUM(e.amount), 0) AS balance "
        "FROM portfolio_accounts a "
        "LEFT JOIN portfolio_cash_entries e ON e.account_id = a.id "
        "WHERE a.user_id = %s GROUP BY a.id ORDER BY a.sort_order, a.id",
        (user_id,),
    ).fetchall()


def _current_portion(a: dict, horizon: date) -> Decimal:
    """該負債科目未來 12 個月要還的金額（原幣）。有期數+利率 → 攤銷月付×12（上限為餘額）；否則回退到期日全有全無。"""
    if a["balance"] <= 0:
        return Decimal(0)
    if a["periods"] is not None and a["rate"] is not None:
        monthly = _monthly_payment(a["balance"], a["rate"], a["periods"])
        return min(a["balance"], monthly * 12)
    if a["due_date"] is not None and a["due_date"] <= horizon:
        return a["balance"]
    return Decimal(0)


def _to_twd(amount: Decimal, currency: str, fx: Decimal | None) -> Decimal | None:
    if currency == "USD":
        return amount * fx if fx is not None else None
    return amount


def get_summary(user_id: str) -> dict:
    run_due_plans(user_id)  # 惰性補算：portfolio 頁必打 summary，於此補齊到期的定期定額
    positions, missing, _ = _position_state(user_id)
    with get_conn() as conn:
        accounts = _account_rows(conn, user_id)
    has_us_accounts = any(a["currency"] == "USD" for a in accounts)
    fx = Decimal(str(get_usd_twd())) if has_us_accounts else None
    for a in accounts:
        if a["currency"] == "USD" and fx is None and a["balance"] != 0:
            missing.append(a["name"])  # 有餘額但無匯率：不入總額，標示不完整
    assets = sum(
        (v for a in accounts if a["kind"] == "asset"
         for v in [_to_twd(a["balance"], a["currency"], fx)] if v is not None),
        Decimal(0),
    )
    liabilities = sum(
        (v for a in accounts if a["kind"] == "liability"
         for v in [_to_twd(a["balance"], a["currency"], fx)] if v is not None),
        Decimal(0),
    )
    stock_value = sum((p["market_value_twd"] for p in positions if p["market_value_twd"] is not None), Decimal(0))
    cost_total = sum((p["cost_twd"] for p in positions if p["cost_twd"] is not None), Decimal(0))
    net_exposure = sum((p["exposure"] for p in positions if p["exposure"] is not None), Decimal(0))
    gross_exposure = sum((abs(p["exposure"]) for p in positions if p["exposure"] is not None), Decimal(0))
    net_worth = assets + stock_value - liabilities
    total_assets = assets + stock_value
    # 流動負債：優先用期數+利率算攤銷月付×12；沒填期數才回退到期日全有全無
    horizon = date.today() + timedelta(days=365)
    current_liabilities = sum(
        (v for a in accounts if a["kind"] == "liability"
         for v in [_to_twd(_current_portion(a, horizon), a["currency"], fx)] if v is not None),
        Decimal(0),
    )
    return {
        "net_worth": net_worth,
        "assets_total": assets,
        "liabilities_total": liabilities,
        "stock_value": stock_value,
        "cost_total": cost_total,
        "net_exposure": net_exposure,
        "gross_exposure": gross_exposure,
        "exposure_ratio": (net_exposure / net_worth) if net_worth > 0 else None,
        "debt_ratio": (liabilities / total_assets) if total_assets > 0 else None,
        "current_liabilities": current_liabilities,
        "current_ratio": (total_assets / current_liabilities) if current_liabilities > 0 else None,
        "incomplete": bool(missing),
        "missing_symbols": missing,
    }


# ── 再平衡 ────────────────────────────────────────────────


def _band(target: Decimal, move: Decimal) -> Decimal:
    """標的漲跌 move（如 +0.5）後，原本站在 target 的比例會變成多少。

    只有風險資產隨價格變動、現金不動，故 t(1+m) / [t(1+m) + (1-t)]。
    價格門檻與比例門檻由此一對一對應，不必記錄上次再平衡的基準價。
    """
    grown = target * (1 + move)
    return grown / (grown + (1 - target))


def _weighted_factor(rows: list[dict]) -> Decimal:
    mv = sum((r["market_value_twd"] for r in rows), Decimal(0))
    return sum((r["exposure"] for r in rows), Decimal(0)) / mv if mv > 0 else Decimal(1)


def _bucket(rows: list[dict], value: Decimal, cash: Decimal, target: Decimal,
            exposure: Decimal, net_worth: Decimal) -> dict:
    base = value + cash
    delta = value - base * target  # 正=該賣、負=該買（沿用試算表的符號）
    factor = _weighted_factor(rows)
    # 現金與股票等額對調，淨值不變；曝險只隨買賣金額×倍數移動
    after = exposure - delta * factor
    return {
        "value": value,
        "cash": cash,
        "base": base,
        "ratio": value / base if base > 0 else None,
        "delta": delta,
        "factor": factor,
        "exposure_after": after,
        "exposure_ratio_after": after / net_worth if net_worth > 0 else None,
    }


def get_rebalance(user_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT target_pct, trigger_pct FROM portfolio_rebalance WHERE user_id = %s", (user_id,)
        ).fetchone()
    if row is None:
        return None
    target = row["target_pct"] / 100
    trigger = row["trigger_pct"] / 100
    positions, _, _ = _position_state(user_id)
    with get_conn() as conn:
        accounts = _account_rows(conn, user_id)
    fx = Decimal(str(get_usd_twd())) if any(a["currency"] == "USD" for a in accounts) else None
    cash = sum(
        (v for a in accounts if a["kind"] == "asset"
         for v in [_to_twd(a["balance"], a["currency"], fx)] if v is not None),
        Decimal(0),
    )
    liabilities = sum(
        (v for a in accounts if a["kind"] == "liability"
         for v in [_to_twd(a["balance"], a["currency"], fx)] if v is not None),
        Decimal(0),
    )
    priced = [p for p in positions if p["market_value_twd"] is not None and p["exposure"] is not None]
    lev_rows = [p for p in priced if p["factor"] > 1]
    stock_value = sum((p["market_value_twd"] for p in priced), Decimal(0))
    exposure = sum((p["exposure"] for p in priced), Decimal(0))
    net_worth = cash + stock_value - liabilities
    lev = _bucket(lev_rows, sum((p["market_value_twd"] for p in lev_rows), Decimal(0)),
                  cash, target, exposure, net_worth)
    upper, lower = _band(target, trigger), _band(target, -trigger)
    r = lev["ratio"]
    # 由現在的比例反推「自上次再平衡以來標的漲跌幅」，是 _band 的反函數
    implied = (r * (1 - target)) / (target * (1 - r)) - 1 if r is not None and 0 < r < 1 else None
    return {
        "target_pct": row["target_pct"],
        "trigger_pct": row["trigger_pct"],
        "upper_pct": upper * 100,
        "lower_pct": lower * 100,
        "net_worth": net_worth,
        "exposure": exposure,
        "exposure_ratio": exposure / net_worth if net_worth > 0 else None,
        "leveraged": {**lev, "implied_move_pct": implied * 100 if implied is not None else None,
                      "triggered": r is not None and (r >= upper or r <= lower)},
        "all_stocks": _bucket(priced, stock_value, cash, target, exposure, net_worth),
    }


def set_rebalance(user_id: str, target_pct: Decimal, trigger_pct: Decimal) -> None:
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO portfolio_rebalance (user_id, target_pct, trigger_pct) VALUES (%s, %s, %s) "
            "ON CONFLICT (user_id) DO UPDATE SET target_pct = EXCLUDED.target_pct, trigger_pct = EXCLUDED.trigger_pct",
            (user_id, target_pct, trigger_pct),
        )


def list_accounts(user_id: str) -> list[dict]:
    with get_conn() as conn:
        rows = _account_rows(conn, user_id)
    fx = Decimal(str(get_usd_twd())) if any(r["currency"] == "USD" for r in rows) else None
    return [{**dict(r), "balance_twd": _to_twd(r["balance"], r["currency"], fx)} for r in rows]


def create_account(
    user_id: str, name: str, kind: str,
    initial_balance: Decimal, rate: Decimal | None, due_date, periods: int | None = None,
    currency: str = "TWD",
) -> dict:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO portfolio_accounts (user_id, name, kind, sort_order, rate, due_date, periods, currency) "
            "VALUES (%s, %s, %s, (SELECT COALESCE(MAX(sort_order),0)+1 FROM portfolio_accounts WHERE user_id = %s), %s, %s, %s, %s) "
            "RETURNING id",
            (user_id, name, kind, user_id, rate, due_date, periods, currency),
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
    currency: str | None = None,
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
        if currency is not None:
            conn.execute("UPDATE portfolio_accounts SET currency = %s WHERE id = %s AND user_id = %s", (currency, account_id, user_id))
        row = conn.execute(
            "SELECT id, name, kind, sort_order, rate, due_date, periods, currency FROM portfolio_accounts WHERE id = %s", (account_id,)
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


# ── 定期定額 ──────────────────────────────────────────────

_TPE = timezone(timedelta(hours=8))  # 台灣恆 UTC+8、無日光節約 → 固定偏移，免 tzdata


def _today() -> date:
    return datetime.now(_TPE).date()


def _clamp_day(year: int, month: int, day: int) -> date:
    last = calendar.monthrange(year, month)[1]
    return date(year, month, min(day, last))  # 小月無此日（如 2 月的 31）→ 當月最後一天


def _next_on_or_after(days: list[int], ref: date) -> date:
    """days（每月扣款日 1–31）內、日期 ≥ ref 的最早一天；當月排完取下月最小日；缺日以月底代替。"""
    for d in sorted(set(days)):
        cand = _clamp_day(ref.year, ref.month, d)
        if cand >= ref:
            return cand
    nm_year = ref.year + (1 if ref.month == 12 else 0)
    nm_month = 1 if ref.month == 12 else ref.month + 1
    return _clamp_day(nm_year, nm_month, min(days))


def _first_run(days: list[int], today: date) -> date:
    return _next_on_or_after(days, today)


def _advance(days: list[int], current: date) -> date:
    return _next_on_or_after(days, current + timedelta(days=1))


def _plan_fee(mode: str, value: Decimal, fee_min: Decimal, gross: Decimal) -> Decimal:
    if mode == "fixed":
        fee = value
    elif mode == "rate":
        fee = gross * value / 100
    else:
        fee = Decimal(0)
    return max(fee, fee_min)


_closes_cache: dict[str, tuple[float, list[tuple[date, Decimal]]]] = {}
_CLOSES_TTL = 1800  # 30min：下市/壞代號補算失敗時，避免每次 summary 重打未快取的 Yahoo


def _closes_by_date(symbol: str) -> list[tuple[date, Decimal]]:
    now = time.time()
    hit = _closes_cache.get(symbol)
    if hit and now - hit[0] < _CLOSES_TTL:
        return hit[1]
    out = []
    for b in download_history(symbol, "1y"):
        try:
            d = datetime.strptime(b["time"], "%Y-%m-%d").date()
        except (ValueError, TypeError):
            continue
        out.append((d, Decimal(str(b["close"]))))
    _closes_cache[symbol] = (now, out)  # download_history 回傳已按日期升冪
    return out


def _close_on_or_before(closes: list[tuple[date, Decimal]], target: date) -> Decimal | None:
    pick = None
    for d, c in closes:
        if d <= target:
            pick = c
        else:
            break
    if pick is None and closes:
        pick = closes[0][1]  # target 早於全部歷史 → 取最早一筆估算
    return pick


def run_due_plans(user_id: str) -> None:
    """惰性補算：把 active 且 next_run_date≤today 的計劃補齊為 pending 買進交易。冪等、併發安全。"""
    today = _today()
    with get_conn() as conn:  # 先無鎖讀出到期 symbol，供鎖外抓價
        symbols = {
            r["symbol"] for r in conn.execute(
                "SELECT symbol FROM portfolio_recurring_plans WHERE user_id = %s AND active = TRUE AND next_run_date <= %s",
                (user_id, today),
            ).fetchall()
        }
    if not symbols:
        return
    closes_map = {s: _closes_by_date(s) for s in symbols}  # 抓價在 conn/鎖之外
    fx_rate = get_usd_twd()  # 供跨幣別扣款換算；快取，鎖外取
    fx = Decimal(str(fx_rate)) if fx_rate is not None else None
    with get_conn() as conn:
        # FOR UPDATE OF p 只鎖計劃列：併發的第二個 summary 會等本交易 commit 後才讀到已前進的
        # next_run_date，避免同一期被兩個請求各插一筆。抓價已在鎖外完成。
        plans = conn.execute(
            "SELECT p.id, p.symbol, p.account_id, p.amount, p.fee_mode, p.fee_value, p.fee_min, "
            "p.days_of_month, p.next_run_date, a.currency AS account_currency "
            "FROM portfolio_recurring_plans p JOIN portfolio_accounts a ON a.id = p.account_id "
            "WHERE p.user_id = %s AND p.active = TRUE AND p.next_run_date <= %s "
            "ORDER BY p.id FOR UPDATE OF p",
            (user_id, today),
        ).fetchall()
        for plan in plans:
            closes = closes_map.get(plan["symbol"])
            if closes is None:
                continue  # 兩次讀之間新出現的計劃：本輪略過，下次 summary 補
            sym_ccy = "USD" if is_us_symbol(plan["symbol"]) else "TWD"
            acc_ccy = plan["account_currency"]
            days = plan["days_of_month"]
            run_date = plan["next_run_date"]
            while run_date <= today:
                price = _close_on_or_before(closes, run_date)
                if price is None or price <= 0:
                    break  # 抓不到價：這期不建，next_run_date 不前進，下次 summary 再補
                fee = _plan_fee(plan["fee_mode"], plan["fee_value"], plan["fee_min"], plan["amount"])
                qty = plan["amount"] / price
                gross = qty * price + fee  # 標的幣別的成交總額（含手續費）
                # 扣款帳戶幣別 ≠ 標的幣別 → 換算成帳戶幣別後扣款（如 USD 標的、TWD 帳戶）
                if sym_ccy == acc_ccy:
                    cash = -gross
                elif fx is None:
                    break  # 跨幣別但拿不到匯率：這期不建，下次再補
                elif sym_ccy == "USD":
                    cash = -(gross * fx)
                else:
                    cash = -(gross / fx)
                cur = conn.execute(
                    "INSERT INTO portfolio_transactions "
                    "(user_id, symbol, side, quantity, price, fee, tax, account_id, traded_at, note, plan_id, pending) "
                    "VALUES (%s, %s, 'buy', %s, %s, %s, 0, %s, %s, %s, %s, TRUE) RETURNING id",
                    (user_id, plan["symbol"], qty, price, fee, plan["account_id"], run_date, "定期定額（估算）", plan["id"]),
                )
                tx_id = cur.fetchone()["id"]
                conn.execute(
                    "INSERT INTO portfolio_cash_entries (user_id, account_id, kind, amount, transaction_id, entry_date) "
                    "VALUES (%s, %s, 'trade', %s, %s, %s)",
                    (user_id, plan["account_id"], cash, tx_id, run_date),
                )
                run_date = _advance(days, run_date)
            if run_date != plan["next_run_date"]:
                conn.execute(
                    "UPDATE portfolio_recurring_plans SET next_run_date = %s WHERE id = %s",
                    (run_date, plan["id"]),
                )


def list_plans(user_id: str) -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT p.id, p.symbol, m.name, p.account_id, p.amount, p.fee_mode, p.fee_value, p.fee_min, "
            "p.days_of_month, p.next_run_date, p.active "
            "FROM portfolio_recurring_plans p LEFT JOIN stocks_meta m ON m.symbol = p.symbol "
            "WHERE p.user_id = %s ORDER BY p.id",
            (user_id,),
        ).fetchall()
    return [{**dict(r), "name": r["name"] or r["symbol"]} for r in rows]


def create_plan(
    user_id: str, symbol: str, account_id: int, amount: Decimal,
    fee_mode: str, fee_value: Decimal, fee_min: Decimal, days_of_month: list[int],
) -> dict:
    with get_conn() as conn:
        _require_account(conn, account_id, user_id)
        next_run = _first_run(days_of_month, _today())
        cur = conn.execute(
            "INSERT INTO portfolio_recurring_plans "
            "(user_id, symbol, account_id, amount, fee_mode, fee_value, fee_min, days_of_month, next_run_date) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (user_id, symbol, account_id, amount, fee_mode, fee_value, fee_min, sorted(set(days_of_month)), next_run),
        )
        return {"id": cur.fetchone()["id"]}


def update_plan(
    user_id: str, plan_id: int, *, symbol=None, account_id=None, amount=None,
    fee_mode=None, fee_value=None, fee_min=None, days_of_month=None, active=None,
) -> dict:
    if days_of_month is not None:
        days_of_month = sorted(set(days_of_month))
    with get_conn() as conn:
        old = conn.execute(
            "SELECT days_of_month, active "
            "FROM portfolio_recurring_plans WHERE id = %s AND user_id = %s", (plan_id, user_id),
        ).fetchone()
        if old is None:
            raise HTTPException(404, "plan not found")
        if account_id is not None:
            _require_account(conn, account_id, user_id)
        sets, params = [], []
        for col, val in (
            ("symbol", symbol), ("account_id", account_id), ("amount", amount),
            ("fee_mode", fee_mode), ("fee_value", fee_value), ("fee_min", fee_min),
            ("days_of_month", days_of_month), ("active", active),
        ):
            if val is not None:
                sets.append(f"{col} = %s")  # col 為常數欄名，非外部輸入
                params.append(val)
        # 改扣款日、或由暫停重新啟用 → 重設下次執行日為今起最近的該日，避免回補整段暫停期
        reactivated = active is True and old["active"] is False
        if days_of_month is not None or reactivated:
            eff_days = days_of_month if days_of_month is not None else old["days_of_month"]
            sets.append("next_run_date = %s")
            params.append(_first_run(eff_days, _today()))
        if sets:
            params.extend([plan_id, user_id])
            conn.execute(
                f"UPDATE portfolio_recurring_plans SET {', '.join(sets)} WHERE id = %s AND user_id = %s", params
            )
        row = conn.execute(
            "SELECT id, symbol, account_id, amount, fee_mode, fee_value, fee_min, days_of_month, next_run_date, active "
            "FROM portfolio_recurring_plans WHERE id = %s AND user_id = %s", (plan_id, user_id),
        ).fetchone()
        return dict(row)


def delete_plan(user_id: str, plan_id: int) -> None:
    with get_conn() as conn:
        cur = conn.execute(
            "DELETE FROM portfolio_recurring_plans WHERE id = %s AND user_id = %s", (plan_id, user_id)
        )  # 已建的 pending 交易靠 plan_id ON DELETE SET NULL 保留，仍可確認
        if cur.rowcount == 0:
            raise HTTPException(404, "plan not found")
