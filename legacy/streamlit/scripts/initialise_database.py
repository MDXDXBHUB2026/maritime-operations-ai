"""Manual database initialisation command."""

from __future__ import annotations

import logging
from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from database.connection import DATABASE_PATH
from database.seed_database import initialise_database


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    try:
        imported = initialise_database()
        if imported:
            print(f"Initialised {DATABASE_PATH}")
            for table, count in imported.items():
                print(f"  {table}: {count} records imported")
        else:
            print(f"Database already initialised: {DATABASE_PATH}")
    except Exception as exc:
        print(f"Database initialisation failed: {exc}", file=sys.stderr)
        raise SystemExit(1)
