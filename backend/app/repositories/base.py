"""Repository contract for operational maritime data.

Agents and services depend on this interface only. Phase 1 implements it over the
static JSON datasets; later implementations can read PostgreSQL, telemetry, AIS,
ERP/fleet-management APIs or event streams without changing agents or the UI.
"""

from abc import ABC, abstractmethod
from typing import Any

Record = dict[str, Any]


class MaritimeRepository(ABC):
    source_name: str = "abstract"

    @abstractmethod
    def list_vessels(self) -> list[Record]: ...

    @abstractmethod
    def list_anomalies(self) -> list[Record]: ...

    @abstractmethod
    def list_sensor_readings(self) -> list[Record]: ...

    @abstractmethod
    def list_maintenance_assets(self) -> list[Record]: ...

    @abstractmethod
    def list_maintenance_history(self) -> list[Record]: ...

    @abstractmethod
    def list_work_orders(self) -> list[Record]: ...

    @abstractmethod
    def list_equipment(self) -> list[Record]: ...

    @abstractmethod
    def list_voyages(self) -> list[Record]: ...

    @abstractmethod
    def list_voyage_plans(self) -> list[Record]: ...

    @abstractmethod
    def list_safety_events(self) -> list[Record]: ...

    @abstractmethod
    def list_alerts(self) -> list[Record]: ...

    @abstractmethod
    def list_automation_tasks(self) -> list[Record]: ...

    def health(self) -> bool:
        return True
