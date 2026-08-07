"""Safe short-lived SQLite connection and transaction helpers."""

from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
import sqlite3
from typing import Iterator


DATABASE_PATH = Path(__file__).resolve().parents[1] / "data" / "maritime_ai.db"


def connect(database_path: str | Path = DATABASE_PATH) -> sqlite3.Connection:
    """Open a configured connection; callers must close it."""
    path = Path(database_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=15)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA busy_timeout = 15000")
    connection.execute("PRAGMA journal_mode = WAL")
    return connection


@contextmanager
def connection_scope(database_path: str | Path = DATABASE_PATH) -> Iterator[sqlite3.Connection]:
    """Open and always close a read-oriented connection."""
    connection = connect(database_path)
    try:
        yield connection
    finally:
        connection.close()


@contextmanager
def transaction(database_path: str | Path = DATABASE_PATH) -> Iterator[sqlite3.Connection]:
    """Commit a group of writes atomically and roll back failures."""
    connection = connect(database_path)
    try:
        connection.execute("BEGIN IMMEDIATE")
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

