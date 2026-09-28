"""Repository abstraction for operational data.

Agents and services depend only on this interface. Phase 1 reads the existing
static datasets; later implementations can read PostgreSQL, telemetry, AIS,
ERP/fleet-management systems or event streams without touching agents or UI.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Optional

Record = dict[str, Any]


class MaritimeRepository(ABC):
    """Read-only access to operational data. Mutations belong to services, never agents."""

    source_name: str = "abstract"

    @abstractmethod
    def list_dataset(self, name: str) -> list[Record]:
        """Return every record of a named dataset (raises KeyError for unknown datasets)."""

    @abstractmethod
    def available_datasets(self) -> list[str]: ...

    # Typed conveniences - implemented once in terms of list_dataset.
    def _find(self, dataset: str, key: str, value: str) -> Optional[Record]:
        return next((r for r in self.list_dataset(dataset) if str(r.get(key)) == value), None)

    def list_vessels(self) -> list[Record]:
        return self.list_dataset("vessels")

    def get_vessel(self, vessel_id: str) -> Optional[Record]:
        return self._find("vessels", "vessel_id", vessel_id)

    def list_anomalies(self) -> list[Record]:
        return self.list_dataset("anomalies")

    def get_anomaly(self, anomaly_id: str) -> Optional[Record]:
        return self._find("anomalies", "anomaly_id", anomaly_id)

    def sensor_readings_for_anomaly(self, anomaly_id: str) -> list[Record]:
        return [r for r in self.list_dataset("sensor_readings") if r.get("anomaly_id") == anomaly_id]

    def list_maintenance_assets(self) -> list[Record]:
        return self.list_dataset("maintenance_assets")

    def get_maintenance_asset(self, asset_id: str) -> Optional[Record]:
        return self._find("maintenance_assets", "asset_id", asset_id)

    def maintenance_history_for_asset(self, asset_id: str) -> list[Record]:
        return [r for r in self.list_dataset("maintenance_history") if r.get("asset_id") == asset_id]

    def list_voyage_plans(self) -> list[Record]:
        return self.list_dataset("voyage_plans")

    def get_voyage_plan(self, voyage_id: str) -> Optional[Record]:
        return self._find("voyage_plans", "voyage_id", voyage_id)

    def list_safety_events(self) -> list[Record]:
        return self.list_dataset("safety_events")

    def get_safety_event(self, event_id: str) -> Optional[Record]:
        return self._find("safety_events", "event_id", event_id)
