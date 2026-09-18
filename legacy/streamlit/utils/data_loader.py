"""Pandas-facing SQLite loaders used by Streamlit pages."""

from __future__ import annotations

import pandas as pd

from database.repositories import get_all_records


def load_table(table: str, required: set[str], dates: list[str] | None = None) -> pd.DataFrame:
    """Load one database table, validate fields and parse requested dates."""
    records = get_all_records(table)
    frame = pd.DataFrame(records)
    missing = required.difference(frame.columns)
    if missing:
        raise ValueError(f"Database table {table} is missing fields: {', '.join(sorted(missing))}")
    for column in dates or []:
        frame[column] = pd.to_datetime(frame[column], errors="coerce")
    # Internal storage metadata is not part of page-level data contracts.
    return frame.drop(columns=["_row_id", "created_at", "updated_at"], errors="ignore")

