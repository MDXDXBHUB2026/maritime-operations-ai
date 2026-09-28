"""Phase 1 repository: reads the existing demo datasets in ``public/data``.

Data is loaded once per process and treated as read-only. Callers receive deep copies
so no caller can mutate the shared cache.
"""

import copy
import json
from pathlib import Path
from threading import Lock
from typing import Any

from app.repositories.base import MaritimeRepository, Record


class JsonFileMaritimeRepository(MaritimeRepository):
    source_name = "json_files"

    def __init__(self, data_dir: Path) -> None:
        self._data_dir = Path(data_dir)
        self._cache: dict[str, list[Record]] = {}
        self._lock = Lock()

    def _load(self, filename: str) -> list[Record]:
        with self._lock:
            if filename not in self._cache:
                path = self._data_dir / filename
                with path.open(encoding="utf-8") as fh:
                    data: Any = json.load(fh)
                if not isinstance(data, list):
                    raise ValueError(f"Dataset {filename} must contain a JSON array")
                self._cache[filename] = data
            return copy.deepcopy(self._cache[filename])

    def list_vessels(self) -> list[Record]:
        return self._load("vessels.json")

    def list_anomalies(self) -> list[Record]:
        return self._load("anomalies.json")

    def list_sensor_readings(self) -> list[Record]:
        return self._load("sensor_readings.json")

    def list_maintenance_assets(self) -> list[Record]:
        return self._load("maintenance_assets.json")

    def list_maintenance_history(self) -> list[Record]:
        return self._load("maintenance_history.json")

    def list_work_orders(self) -> list[Record]:
        return self._load("work_orders.json")

    def list_equipment(self) -> list[Record]:
        return self._load("equipment.json")

    def list_voyages(self) -> list[Record]:
        return self._load("voyages.json")

    def list_voyage_plans(self) -> list[Record]:
        return self._load("voyage_plans.json")

    def list_safety_events(self) -> list[Record]:
        return self._load("safety_events.json")

    def list_alerts(self) -> list[Record]:
        return self._load("alerts.json")

    def list_automation_tasks(self) -> list[Record]:
        return self._load("automation_tasks.json")

    def health(self) -> bool:
        return (self._data_dir / "vessels.json").is_file()
