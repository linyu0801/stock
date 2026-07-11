"""一次性：stock.db → Supabase Postgres。跑完即棄，保留檔案供 prod 種子重跑。"""
import sqlite3
from pathlib import Path

from db import get_conn

SQLITE = Path(__file__).parent / "stock.db"

TABLES = {  # 依 FK 順序；identity 欄位需 OVERRIDING SYSTEM VALUE 保留原 id
    "groups":          ("id, name, \"order\"", True),
    "stocks":          ("id, symbol, group_id, added_at, sort_order, note", True),
    "sublabels":       ("id, group_id, label, sort_order", True),
    "stocks_meta":     ("symbol, name", False),
    "concepts":        ("category, name, updated_at, position", False),   # sqlite 端 SELECT 用 rowid AS position
    "concept_stocks":  ("category, symbol, name, updated_at, position", False),  # 同上
    "monthly_revenue": ("symbol, year_month, revenue, mom_pct, yoy_pct, acc_yoy_pct", False),
}


def main() -> None:
    src = sqlite3.connect(SQLITE)
    src.row_factory = sqlite3.Row
    with get_conn() as conn:
        for table, (cols, has_identity) in TABLES.items():
            src_cols = cols.replace(", position", ", rowid AS position")
            rows = src.execute(f"SELECT {src_cols} FROM {table}").fetchall()
            if not rows:
                print(f"{table}: source empty, skipped")
                continue
            ph = ", ".join(["%s"] * len(rows[0]))
            override = " OVERRIDING SYSTEM VALUE" if has_identity else ""
            conn.cursor().executemany(
                f"INSERT INTO {table} ({cols}){override} VALUES ({ph}) ON CONFLICT DO NOTHING",
                [tuple(r) for r in rows],
            )
            n = conn.execute(f"SELECT COUNT(*) AS n FROM {table}").fetchone()["n"]
            print(f"{table}: sqlite={len(rows)} pg={n} {'OK' if n >= len(rows) else 'MISMATCH'}")
        for t in ("groups", "stocks", "sublabels"):
            conn.execute(
                f"SELECT setval(pg_get_serial_sequence('{t}', 'id'), (SELECT COALESCE(MAX(id), 1) FROM {t}))"
            )
    print("done")


if __name__ == "__main__":
    main()
