"""Manager agent: routes structured context to the correct specialist. It never executes actions."""

from __future__ import annotations

from app.agents.anomaly_agent import AnomalyAgent
from app.agents.base_agent import SpecialistAgent
from app.agents.maintenance_agent import MaintenanceAgent
from app.agents.safety_agent import SafetyAgent
from app.agents.voyage_agent import VoyageAgent
from app.ai.provider import AIProvider
from app.domain.enums import AgentName
from app.domain.models import AgentContext, AgentRecommendation


class ManagerAgent:
    name = AgentName.MANAGER

    def __init__(self, provider: AIProvider, specialists: list[SpecialistAgent] | None = None) -> None:
        self.provider = provider
        agents = specialists or [AnomalyAgent(), MaintenanceAgent(), VoyageAgent(), SafetyAgent()]
        self._specialists: dict[AgentName, SpecialistAgent] = {a.name: a for a in agents}

    @property
    def routes(self) -> list[AgentName]:
        return sorted(self._specialists, key=lambda a: a.value)

    def route(self, agent: AgentName) -> SpecialistAgent:
        try:
            return self._specialists[agent]
        except KeyError as exc:
            raise ValueError(f"No specialist registered for '{agent.value}'") from exc

    def recommend(self, context: AgentContext) -> AgentRecommendation:
        return self.route(context.agent).analyse(context, self.provider)
