import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "stock.db"

def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db() -> None:
    with get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS groups (
                id      INTEGER PRIMARY KEY AUTOINCREMENT,
                name    TEXT    NOT NULL UNIQUE,
                "order" INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS stocks (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                symbol     TEXT    NOT NULL,
                group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
                added_at   TEXT    NOT NULL DEFAULT (datetime('now')),
                UNIQUE(symbol, group_id)
            );
        """)
