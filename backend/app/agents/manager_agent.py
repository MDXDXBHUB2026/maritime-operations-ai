"""Manager agent: routes a structured context to the matching specialist.

The manager adds a final guardrail: whatever a specialist returns, a recommendation
that is safety-critical is always marked as requiring human approval.
"""

from app.agents.anomaly_agent import AnomalyAgent
from app.agents.base_agent import BaseAgent
from app.agents.maintenance_agent import MaintenanceAgent
from app.agents.safety_agent import SafetyAgent
from app.agents.voyage_agent import VoyageAgent
from app.ai.provider import AIProvider
from app.domain.enums import AgentKind
from app.domain.models import AgentContext, AgentRecommendation
from app.errors import UnknownAgentError


class ManagerAgent:
    def __init__(self, provider: AIProvider) -> None:
        self._specialists: dict[AgentKind, BaseAgent] = {
            agent.kind: agent
            for agent in (
                AnomalyAgent(provider),
                MaintenanceAgent(provider),
                VoyageAgent(provider),
                SafetyAgent(provider),
            )
        }

    @property
    def specialists(self) -> dict[AgentKind, BaseAgent]:
        return dict(self._specialists)

    def route(self, context: AgentContext) -> BaseAgent:
        agent = self._specialists.get(context.agent)
        if agent is None:
            raise UnknownAgentError(f"No specialist agent registered for '{context.agent}'")
        return agent

    def recommend(self, context: AgentContext) -> AgentRecommendation:
        recommendation = self.route(context).analyse(context)
        if recommendation.safety_critical and not recommendation.requires_human_approval:
            recommendation = recommendation.model_copy(update={"requires_human_approval": True})
        return recommendation
