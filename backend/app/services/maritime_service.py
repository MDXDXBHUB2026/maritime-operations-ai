"""Read-side operational service and agent-context assembly. No state is modified here."""

from __future__ import annotations

import re
from typing import Optional

from app.domain.enums import AgentName, EntityType, SiteType
from app.domain.errors import NotFoundError
from app.domain.models import AgentContext, Site
from app.repositories.base import MaritimeRepository, Record


class MaritimeService:
    def __init__(self, repository: MaritimeRepository) -> None:
        self.repo = repository

    @staticmethod
    def _require(record: Record | None, kind: str, entity_id: str) -> Record:
        if record is None:
            raise NotFoundError(f"{kind} '{entity_id}' not found")
        return record

    def list_vessels(self) -> list[Record]:
        return self.repo.list_vessels()

    def get_vessel(self, vessel_id: str) -> Record:
        return self._require(self.repo.get_vessel(vessel_id), "Vessel", vessel_id)

    def list_anomalies(self) -> list[Record]:
        return self.repo.list_anomalies()

    def get_anomaly(self, anomaly_id: str) -> Record:
        return self._require(self.repo.get_anomaly(anomaly_id), "Anomaly", anomaly_id)

    def list_maintenance_assets(self) -> list[Record]:
        return self.repo.list_maintenance_assets()

    def list_voyage_plans(self) -> list[Record]:
        return self.repo.list_voyage_plans()

    def list_safety_events(self) -> list[Record]:
        return self.repo.list_safety_events()

    def list_dataset(self, name: str) -> list[Record]:
        try:
            return self.repo.list_dataset(name)
        except KeyError as exc:
            raise NotFoundError(f"Dataset '{name}' is not available") from exc

    # -- sites -------------------------------------------------------------
    @staticmethod
    def terminal_site_id(name: str) -> str:
        return "TRM-" + re.sub(r"[^A-Z0-9]+", "-", name.upper()).strip("-")

    def list_sites(self) -> list[Site]:
        """Vessels from the fleet register plus terminals referenced by operational records."""
        vessels = [Site(site_id=v["vessel_id"], name=v["vessel_name"], site_type=SiteType.VESSEL)
                   for v in self.repo.list_vessels()]
        vessel_names = {s.name for s in vessels}
        terminal_names: set[str] = set()
        for dataset in ("anomalies", "maintenance_assets", "safety_events"):
            for r in self.repo.list_dataset(dataset):
                name = r.get("vessel_or_terminal")
                if name and name not in vessel_names:
                    terminal_names.add(name)
        terminals = [Site(site_id=self.terminal_site_id(n), name=n, site_type=SiteType.TERMINAL)
                     for n in sorted(terminal_names)]
        return vessels + terminals

    def site_by_id(self) -> dict[str, Site]:
        return {s.site_id: s for s in self.list_sites()}

    def site_for_context(self, context: AgentContext) -> Optional[Site]:
        """Resolve which vessel/terminal a decision belongs to. None if it cannot be resolved."""
        record = context.record
        sites = self.list_sites()
        if record.get("vessel_id"):
            return next((s for s in sites if s.site_id == record["vessel_id"]), None)
        name = record.get("vessel_or_terminal") or record.get("vessel_name")
        return next((s for s in sites if s.name == name), None) if name else None

    def build_context(self, agent: AgentName, entity_id: str) -> AgentContext:
        if agent == AgentName.ANOMALY:
            record = self.get_anomaly(entity_id)
            return AgentContext(agent=agent, entity_type=EntityType.ANOMALY, entity_id=entity_id, record=record,
                                related={"sensor_readings": self.repo.sensor_readings_for_anomaly(entity_id)})
        if agent == AgentName.MAINTENANCE:
            record = self._require(self.repo.get_maintenance_asset(entity_id), "Maintenance asset", entity_id)
            return AgentContext(agent=agent, entity_type=EntityType.MAINTENANCE_ASSET, entity_id=entity_id, record=record,
                                related={"maintenance_history": self.repo.maintenance_history_for_asset(entity_id)})
        if agent == AgentName.VOYAGE:
            record = self._require(self.repo.get_voyage_plan(entity_id), "Voyage plan", entity_id)
            return AgentContext(agent=agent, entity_type=EntityType.VOYAGE_PLAN, entity_id=entity_id, record=record)
        if agent == AgentName.SAFETY:
            record = self._require(self.repo.get_safety_event(entity_id), "Safety event", entity_id)
            return AgentContext(agent=agent, entity_type=EntityType.SAFETY_EVENT, entity_id=entity_id, record=record)
        raise NotFoundError(f"No decision domain '{agent.value}'")
