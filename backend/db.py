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
            CREATE TABLE IF NOT EXISTS stocks_meta (
                symbol TEXT PRIMARY KEY,
                name   TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS concepts (
                category   TEXT PRIMARY KEY,
                name       TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE IF NOT EXISTS concept_stocks (
                category   TEXT NOT NULL,
                symbol     TEXT NOT NULL,
                name       TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                PRIMARY KEY (category, symbol)
            );
        """)
