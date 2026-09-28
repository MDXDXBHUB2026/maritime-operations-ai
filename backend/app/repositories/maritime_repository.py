"""Phase 1 repository: reads the existing frontend datasets in public/data (no duplication)."""

from __future__ import annotations

import copy
import json
import threading
from pathlib import Path

from app.repositories.base import MaritimeRepository, Record

# Explicit allow-list: only these files can ever be served (prevents path traversal).
DATASETS: dict[str, str] = {
    "vessels": "vessels.json",
    "voyages": "voyages.json",
    "voyage_plans": "voyage_plans.json",
    "equipment": "equipment.json",
    "alerts": "alerts.json",
    "anomalies": "anomalies.json",
    "sensor_readings": "sensor_readings.json",
    "maintenance_assets": "maintenance_assets.json",
    "maintenance_history": "maintenance_history.json",
    "work_orders": "work_orders.json",
    "safety_events": "safety_events.json",
    "safety_observations": "safety_observations.json",
    "corrective_actions": "corrective_actions.json",
    "automation_tasks": "automation_tasks.json",
    "automation_workflows": "automation_workflows.json",
    "approval_history": "approval_history.json",
    "fuel_performance": "fuel_performance.json",
    "weather_routes": "weather_routes.json",
}


class JsonFileMaritimeRepository(MaritimeRepository):
    source_name = "static-json"

    def __init__(self, data_dir: Path) -> None:
        self._data_dir = Path(data_dir)
        self._cache: dict[str, list[Record]] = {}
        self._lock = threading.Lock()

    def available_datasets(self) -> list[str]:
        return sorted(DATASETS)

    def list_dataset(self, name: str) -> list[Record]:
        if name not in DATASETS:
            raise KeyError(name)
        with self._lock:
            if name not in self._cache:
                path = self._data_dir / DATASETS[name]
                with path.open(encoding="utf-8") as fh:
                    data = json.load(fh)
                if not isinstance(data, list):
                    raise ValueError(f"Dataset {name} is not a JSON array")
                self._cache[name] = data
        # Deep copy so callers can never mutate the cached source of truth.
        return copy.deepcopy(self._cache[name])

    def is_available(self) -> bool:
        return (self._data_dir / DATASETS["vessels"]).is_file()
