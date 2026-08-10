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
                name    TEXT    NOT NULL,
                "order" INTEGER NOT NULL DEFAULT 0,
                user_id UUID,
                UNIQUE(user_id, name)
            );
            CREATE INDEX IF NOT EXISTS groups_user_id_idx ON groups(user_id);
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
            CREATE TABLE IF NOT EXISTS portfolio_accounts (
                id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                user_id    UUID    NOT NULL,
                name       TEXT    NOT NULL,
                kind       TEXT    NOT NULL CHECK (kind IN ('asset','liability')),
                sort_order INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS portfolio_accounts_user_idx ON portfolio_accounts(user_id);
            CREATE TABLE IF NOT EXISTS portfolio_transactions (
                id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                user_id    UUID    NOT NULL,
                symbol     TEXT    NOT NULL,
                side       TEXT    NOT NULL CHECK (side IN ('buy','sell','dividend','stock_dividend')),
                quantity   NUMERIC NOT NULL,
                price      NUMERIC NOT NULL DEFAULT 0,
                fee        NUMERIC NOT NULL DEFAULT 0,
                tax        NUMERIC NOT NULL DEFAULT 0,
                account_id INTEGER REFERENCES portfolio_accounts(id) ON DELETE SET NULL,
                traded_at  DATE    NOT NULL,
                note       TEXT
            );
            CREATE INDEX IF NOT EXISTS portfolio_tx_user_idx ON portfolio_transactions(user_id);
            CREATE TABLE IF NOT EXISTS portfolio_cash_entries (
                id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                user_id        UUID    NOT NULL,
                account_id     INTEGER NOT NULL REFERENCES portfolio_accounts(id) ON DELETE CASCADE,
                kind           TEXT    NOT NULL CHECK (kind IN ('deposit','withdraw','adjust','trade','dividend')),
                amount         NUMERIC NOT NULL,
                transaction_id INTEGER REFERENCES portfolio_transactions(id) ON DELETE CASCADE,
                entry_date     DATE    NOT NULL,
                note           TEXT
            );
            CREATE INDEX IF NOT EXISTS portfolio_cash_account_idx ON portfolio_cash_entries(account_id);
            ALTER TABLE portfolio_accounts ADD COLUMN IF NOT EXISTS rate NUMERIC;
            ALTER TABLE portfolio_accounts ADD COLUMN IF NOT EXISTS due_date DATE;
            ALTER TABLE portfolio_accounts ADD COLUMN IF NOT EXISTS periods INTEGER;
            ALTER TABLE portfolio_accounts ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'TWD';
            CREATE TABLE IF NOT EXISTS portfolio_leverage (
                user_id UUID    NOT NULL,
                symbol  TEXT    NOT NULL,
                factor  NUMERIC NOT NULL,
                PRIMARY KEY (user_id, symbol)
            );
            CREATE TABLE IF NOT EXISTS portfolio_recurring_plans (
                id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                user_id       UUID    NOT NULL,
                symbol        TEXT    NOT NULL,
                account_id    INTEGER NOT NULL REFERENCES portfolio_accounts(id) ON DELETE CASCADE,
                amount        NUMERIC   NOT NULL,
                fee_mode      TEXT      NOT NULL DEFAULT 'none' CHECK (fee_mode IN ('none','fixed','rate')),
                fee_value     NUMERIC   NOT NULL DEFAULT 0,
                fee_min       NUMERIC   NOT NULL DEFAULT 0,
                days_of_month INTEGER[] NOT NULL,
                next_run_date DATE      NOT NULL,
                active        BOOLEAN   NOT NULL DEFAULT TRUE
            );
            CREATE INDEX IF NOT EXISTS portfolio_plans_user_idx ON portfolio_recurring_plans(user_id);
            DO $$
            BEGIN
              IF EXISTS (SELECT 1 FROM information_schema.columns
                         WHERE table_name = 'portfolio_recurring_plans' AND column_name = 'day_of_month') THEN
                ALTER TABLE portfolio_recurring_plans ADD COLUMN IF NOT EXISTS days_of_month INTEGER[];
                UPDATE portfolio_recurring_plans SET days_of_month = ARRAY[day_of_month] WHERE days_of_month IS NULL;
                ALTER TABLE portfolio_recurring_plans ALTER COLUMN days_of_month SET NOT NULL;
                ALTER TABLE portfolio_recurring_plans DROP COLUMN day_of_month;
              END IF;
            END $$;
            ALTER TABLE portfolio_transactions ADD COLUMN IF NOT EXISTS plan_id INTEGER REFERENCES portfolio_recurring_plans(id) ON DELETE SET NULL;
            ALTER TABLE portfolio_transactions ADD COLUMN IF NOT EXISTS pending BOOLEAN NOT NULL DEFAULT FALSE;
        """)
