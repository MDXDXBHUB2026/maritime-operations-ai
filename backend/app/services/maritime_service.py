"""Read access to operational data and construction of agent contexts."""

from typing import Any

from app.domain.enums import AgentKind
from app.domain.models import AgentContext
from app.errors import NotFoundError
from app.repositories.base import MaritimeRepository, Record


def _find(records: list[Record], key: str, value: str, label: str) -> Record:
    for record in records:
        if str(record.get(key)) == value:
            return record
    raise NotFoundError(f"{label} '{value}' not found")


def _filter(records: list[Record], **criteria: Any) -> list[Record]:
    active = {k: v for k, v in criteria.items() if v is not None}
    if not active:
        return records
    return [
        r
        for r in records
        if all(str(r.get(k, "")).lower() == str(v).lower() for k, v in active.items())
    ]


class MaritimeService:
    def __init__(self, repository: MaritimeRepository) -> None:
        self._repo = repository

    @property
    def source_name(self) -> str:
        return self._repo.source_name

    def repository_healthy(self) -> bool:
        return self._repo.health()

    # Vessels -----------------------------------------------------------------------
    def list_vessels(self, operational_status: str | None = None) -> list[Record]:
        return _filter(self._repo.list_vessels(), operational_status=operational_status)

    def get_vessel(self, vessel_id: str) -> Record:
        return _find(self._repo.list_vessels(), "vessel_id", vessel_id, "Vessel")

    # Anomalies ---------------------------------------------------------------------
    def list_anomalies(
        self, severity: str | None = None, status: str | None = None, vessel: str | None = None
    ) -> list[Record]:
        return _filter(
            self._repo.list_anomalies(), severity=severity, status=status, vessel_or_terminal=vessel
        )

    def get_anomaly(self, anomaly_id: str) -> Record:
        return _find(self._repo.list_anomalies(), "anomaly_id", anomaly_id, "Anomaly")

    def list_sensor_readings(self, anomaly_id: str | None = None) -> list[Record]:
        return _filter(self._repo.list_sensor_readings(), anomaly_id=anomaly_id)

    # Maintenance -------------------------------------------------------------------
    def list_maintenance_assets(
        self, criticality: str | None = None, vessel: str | None = None
    ) -> list[Record]:
        return _filter(
            self._repo.list_maintenance_assets(), criticality=criticality, vessel_or_terminal=vessel
        )

    def get_maintenance_asset(self, asset_id: str) -> Record:
        return _find(
            self._repo.list_maintenance_assets(), "asset_id", asset_id, "Maintenance asset"
        )

    def list_maintenance_history(self, asset_id: str | None = None) -> list[Record]:
        return _filter(self._repo.list_maintenance_history(), asset_id=asset_id)

    def list_work_orders(self, asset_id: str | None = None) -> list[Record]:
        return _filter(self._repo.list_work_orders(), asset_id=asset_id)

    def list_equipment(self) -> list[Record]:
        return self._repo.list_equipment()

    # Voyages -----------------------------------------------------------------------
    def list_voyages(self) -> list[Record]:
        return self._repo.list_voyages()

    def list_voyage_plans(self, vessel_id: str | None = None) -> list[Record]:
        return _filter(self._repo.list_voyage_plans(), vessel_id=vessel_id)

    def get_voyage_plan(self, voyage_id: str) -> Record:
        return _find(self._repo.list_voyage_plans(), "voyage_id", voyage_id, "Voyage plan")

    # Safety ------------------------------------------------------------------------
    def list_safety_events(
        self, severity: str | None = None, status: str | None = None
    ) -> list[Record]:
        return _filter(self._repo.list_safety_events(), severity=severity, status=status)

    def get_safety_event(self, event_id: str) -> Record:
        return _find(self._repo.list_safety_events(), "event_id", event_id, "Safety event")

    # Operations --------------------------------------------------------------------
    def list_alerts(self) -> list[Record]:
        return self._repo.list_alerts()

    def list_automation_tasks(self) -> list[Record]:
        return self._repo.list_automation_tasks()

    # Agent context -----------------------------------------------------------------
    def build_context(self, kind: AgentKind, entity_id: str) -> AgentContext:
        related: dict[str, list[Record]] = {}
        if kind is AgentKind.ANOMALY:
            record, entity_type = self.get_anomaly(entity_id), "anomaly"
            related["sensor_readings"] = self.list_sensor_readings(anomaly_id=entity_id)
        elif kind is AgentKind.MAINTENANCE:
            record, entity_type = self.get_maintenance_asset(entity_id), "maintenance_asset"
            related["work_orders"] = self.list_work_orders(asset_id=entity_id)
            related["maintenance_history"] = self.list_maintenance_history(asset_id=entity_id)
        elif kind is AgentKind.VOYAGE:
            record, entity_type = self.get_voyage_plan(entity_id), "voyage_plan"
        else:
            record, entity_type = self.get_safety_event(entity_id), "safety_event"
        return AgentContext(
            agent=kind, entity_type=entity_type, entity_id=entity_id, record=record, related=related
        )
