import os
from contextlib import contextmanager
from pathlib import Path

from dotenv import load_dotenv
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

load_dotenv(Path(__file__).parent / ".env")
DATABASE_URL = os.environ["DATABASE_URL"]

pool = ConnectionPool(
    DATABASE_URL,
    min_size=1,
    max_size=5,
    open=False,
    # pgbouncer transaction mode 不支援 prepared statements
    kwargs={"row_factory": dict_row, "prepare_threshold": None},
)


@contextmanager
def get_conn():
    if pool.closed:
        pool.open()
    with pool.connection() as conn:
        yield conn


def init_db() -> None:
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS groups (
                id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                name    TEXT    NOT NULL UNIQUE,
                "order" INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS stocks (
                id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                symbol     TEXT    NOT NULL,
                group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
                added_at   TEXT    NOT NULL DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'),
                sort_order INTEGER DEFAULT 0,
                note       TEXT    DEFAULT NULL,
                UNIQUE(symbol, group_id)
            );
            CREATE TABLE IF NOT EXISTS sublabels (
                id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
                label      TEXT    NOT NULL,
                sort_order INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS stocks_meta (
                symbol TEXT PRIMARY KEY,
                name   TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS concepts (
                category   TEXT PRIMARY KEY,
                name       TEXT NOT NULL,
                position   INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')
            );
            CREATE TABLE IF NOT EXISTS concept_stocks (
                category   TEXT NOT NULL,
                symbol     TEXT NOT NULL,
                name       TEXT NOT NULL,
                position   INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS'),
                PRIMARY KEY (category, symbol)
            );
            CREATE TABLE IF NOT EXISTS monthly_revenue (
                symbol      TEXT NOT NULL,
                year_month  TEXT NOT NULL,
                revenue     BIGINT NOT NULL,
                mom_pct     DOUBLE PRECISION,
                yoy_pct     DOUBLE PRECISION,
                acc_yoy_pct DOUBLE PRECISION,
                PRIMARY KEY (symbol, year_month)
            );
        """)
