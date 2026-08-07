"""Database inspection and backup helpers."""

from __future__ import annotations

from pathlib import Path
import pandas as pd

from database.repositories import get_all_records


def export_table_to_csv(table: str, output_path: str | Path) -> Path:
    """Export a database table to CSV for backup or inspection."""
    target = Path(output_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    frame = pd.DataFrame(get_all_records(table))
    frame.to_csv(target, index=False)
    return target

