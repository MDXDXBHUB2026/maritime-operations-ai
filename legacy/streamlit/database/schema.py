"""Database table catalogue and schema creation."""

from __future__ import annotations

import sqlite3


# The requested core tables plus runtime tables needed by existing pages.
TABLE_SEEDS = {
    "vessels": "vessels.csv",
    "voyages": "voyages.csv",
    "equipment": "equipment.csv",
    "alerts": "alerts.csv",
    "anomalies": "anomalies.csv",
    "sensor_readings": "sensor_readings.csv",
    "maintenance_assets": "maintenance_assets.csv",
    "maintenance_history": "maintenance_history.csv",
    "work_orders": "work_orders.csv",
    "safety_events": "safety_events.csv",
    "safety_observations": "safety_observations.csv",
    "corrective_actions": "corrective_actions.csv",
    "automation_workflows": "automation_workflows.csv",
    "automation_tasks": "automation_tasks.csv",
    "action_history": "approval_history.csv",
    "voyage_plans": "voyage_plans.csv",
    "fuel_performance": "fuel_performance.csv",
    "weather_routes": "weather_routes.csv",
}

APPLICATION_TABLES = frozenset((*TABLE_SEEDS.keys(), "application_settings"))


def quote_identifier(value: str) -> str:
    """Quote a validated SQLite identifier."""
    if not value or not value.replace("_", "").isalnum():
        raise ValueError(f"Invalid database identifier: {value!r}")
    return f'"{value}"'


def create_schema(connection: sqlite3.Connection) -> None:
    """Create base tables and metadata fields without dropping existing data."""
    for table in TABLE_SEEDS:
        connection.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {quote_identifier(table)} (
                _row_id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS application_settings (
            setting_key TEXT PRIMARY KEY,
            setting_value TEXT,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    connection.commit()


def table_columns(connection: sqlite3.Connection, table: str) -> dict[str, str]:
    if table not in APPLICATION_TABLES:
        raise ValueError(f"Unknown table: {table}")
    rows = connection.execute(f"PRAGMA table_info({quote_identifier(table)})").fetchall()
    return {row["name"]: row["type"] for row in rows}


def ensure_columns(connection: sqlite3.Connection, table: str, columns: dict[str, str]) -> None:
    """Add previously unseen CSV columns without removing existing fields."""
    existing = table_columns(connection, table)
    for name, sqlite_type in columns.items():
        if name not in existing and name not in {"_row_id", "created_at", "updated_at"}:
            connection.execute(
                f"ALTER TABLE {quote_identifier(table)} "
                f"ADD COLUMN {quote_identifier(name)} {sqlite_type}"
            )

