"""Create and seed the SQLite database from preserved CSV files."""

from __future__ import annotations

import logging
from pathlib import Path
import sqlite3
from typing import Any

import pandas as pd

from database.connection import DATABASE_PATH, connect
from database.schema import TABLE_SEEDS, create_schema, ensure_columns, quote_identifier

LOGGER = logging.getLogger(__name__)
DATA_DIR = Path(__file__).resolve().parents[1] / "data"
SEED_KEY = "csv_seed_version"
SEED_VERSION = "2026-07-23-v1"


def _sqlite_type(series: pd.Series) -> str:
    if pd.api.types.is_bool_dtype(series) or pd.api.types.is_integer_dtype(series):
        return "INTEGER"
    if pd.api.types.is_float_dtype(series):
        return "REAL"
    return "TEXT"


def _normalise_value(value: Any) -> Any:
    if pd.isna(value):
        return None
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if hasattr(value, "item"):
        value = value.item()
    if isinstance(value, bool):
        return int(value)
    return value


def _seed_status(connection: sqlite3.Connection) -> str | None:
    row = connection.execute(
        "SELECT setting_value FROM application_settings WHERE setting_key = ?", (SEED_KEY,)
    ).fetchone()
    return row["setting_value"] if row else None


def initialise_database(database_path: str | Path = DATABASE_PATH, force_seed: bool = False) -> dict[str, int]:
    """Create tables and import each CSV once in a single transaction."""
    connection = connect(database_path)
    imported: dict[str, int] = {}
    try:
        create_schema(connection)
        if _seed_status(connection) == SEED_VERSION and not force_seed:
            LOGGER.info("Database already seeded with %s; no CSV import required.", SEED_VERSION)
            return imported

        connection.execute("BEGIN IMMEDIATE")
        for table, filename in TABLE_SEEDS.items():
            path = DATA_DIR / filename
            if not path.exists():
                LOGGER.warning("Seed file missing; skipped: %s", path)
                imported[table] = 0
                continue
            try:
                frame = pd.read_csv(path)
            except Exception as exc:
                LOGGER.warning("Could not read %s; skipped: %s", path.name, exc)
                imported[table] = 0
                continue
            column_types = {column: _sqlite_type(frame[column]) for column in frame.columns}
            ensure_columns(connection, table, column_types)
            if force_seed:
                connection.execute(f"DELETE FROM {quote_identifier(table)}")
            if frame.empty:
                imported[table] = 0
                LOGGER.info("Imported 0 records from %s into %s.", filename, table)
                continue
            columns = list(frame.columns)
            sql = (
                f"INSERT INTO {quote_identifier(table)} "
                f"({','.join(quote_identifier(column) for column in columns)}) "
                f"VALUES ({','.join('?' for _ in columns)})"
            )
            rows = [
                tuple(_normalise_value(value) for value in row)
                for row in frame.itertuples(index=False, name=None)
            ]
            connection.executemany(sql, rows)
            imported[table] = len(rows)
            LOGGER.info("Imported %s records from %s into %s.", len(rows), filename, table)
        connection.execute(
            """
            INSERT INTO application_settings(setting_key, setting_value)
            VALUES (?, ?)
            ON CONFLICT(setting_key) DO UPDATE SET
                setting_value = excluded.setting_value,
                updated_at = CURRENT_TIMESTAMP
            """,
            (SEED_KEY, SEED_VERSION),
        )
        connection.commit()
        return imported
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()

