"""SQLite migration, repository and page-source regression checks."""

from pathlib import Path
import sys

PROJECT_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT_ROOT))

from database.connection import DATABASE_PATH
from database.repositories import (
    delete_record,
    filtered_query,
    get_all_records,
    get_record_by_id,
    insert_record,
    update_record,
)
from database.schema import APPLICATION_TABLES
from database.seed_database import initialise_database
from utils.database_helpers import export_table_to_csv


EXPECTED_COUNTS = {
    "vessels": 10,
    "voyages": 6,
    "equipment": 40,
    "alerts": 8,
    "anomalies": 32,
    "sensor_readings": 800,
    "maintenance_assets": 48,
    "maintenance_history": 80,
    "work_orders": 12,
    "safety_events": 48,
    "safety_observations": 48,
    "corrective_actions": 24,
    "automation_workflows": 12,
    "automation_tasks": 30,
    "action_history": 0,
    "voyage_plans": 8,
    "fuel_performance": 8,
    "weather_routes": 8,
}


def test_database_seed_is_complete_and_idempotent() -> None:
    assert DATABASE_PATH.exists()
    assert initialise_database() == {}
    assert {table: len(get_all_records(table)) for table in EXPECTED_COUNTS} == EXPECTED_COUNTS
    assert {"action_history", "application_settings"}.issubset(APPLICATION_TABLES)


def test_repository_crud_and_filtered_queries() -> None:
    underway = filtered_query("vessels", {"operational_status": "Underway"})
    assert underway and all(row["operational_status"] == "Underway" for row in underway)
    row_id = insert_record("application_settings", {"setting_key": "migration_test", "setting_value": "created"})
    record = get_record_by_id("application_settings", "migration_test", "setting_key")
    assert record and record["setting_value"] == "created"
    assert update_record("application_settings", "migration_test", {"setting_value": "updated"}, "setting_key") == 1
    assert delete_record("application_settings", "migration_test", "setting_key") == 1
    assert row_id > 0


def test_pages_do_not_read_csv_at_runtime_and_export_works() -> None:
    for path in (PROJECT_ROOT / "pages").glob("*.py"):
        assert "read_csv(" not in path.read_text(encoding="utf-8")
    export = export_table_to_csv("vessels", PROJECT_ROOT / "data" / "exports" / "vessels_database_export.csv")
    assert export.exists() and export.stat().st_size > 0


if __name__ == "__main__":
    test_database_seed_is_complete_and_idempotent()
    test_repository_crud_and_filtered_queries()
    test_pages_do_not_read_csv_at_runtime_and_export_works()
    print("DATABASE_MIGRATION_TESTS_PASS")
