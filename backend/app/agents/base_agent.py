"""Specialist agent base class.

Agents decide; services and tools execute. An agent receives a read-only
``AgentContext``, applies deterministic domain rules, asks the configured AI provider
only for narrative text, and returns a typed ``AgentRecommendation``. Agents have no
access to the database, repositories or any execution tool.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

from app.ai.provider import AIProvider, AIRequest, ProviderUnavailableError
from app.domain.enums import ActionCategory, AgentKind, Severity
from app.domain.models import AgentContext, AgentRecommendation, Evidence, RecommendedAction

CONFIDENCE_NOT_CALCULATED = (
    "not_calculated: rule-based assessment over dataset values; no calibrated model is "
    "available, so no confidence percentage is reported"
)


@dataclass
class Assessment:
    severity: Severity
    headline: str
    entity_label: str
    rationale: list[str]
    evidence: list[Evidence]
    actions: list[RecommendedAction]
    safety_critical: bool
    confidence: float | None = None
    confidence_basis: str = CONFIDENCE_NOT_CALCULATED
    extra_facts: dict[str, Any] = field(default_factory=dict)


def evidence(
    source: str, record: dict[str, Any], id_field: str, field_name: str, note: str | None = None
) -> Evidence:
    return Evidence(
        source=source,
        record_id=str(record.get(id_field, "")),
        field=field_name,
        value=record.get(field_name),
        note=note,
    )


class BaseAgent(ABC):
    kind: AgentKind
    entity_type: str

    def __init__(self, provider: AIProvider) -> None:
        self._provider = provider

    @abstractmethod
    def assess(self, context: AgentContext) -> Assessment:
        """Deterministic domain analysis. Must not perform side effects."""

    def analyse(self, context: AgentContext) -> AgentRecommendation:
        if context.agent != self.kind:
            raise ValueError(f"{self.kind} agent cannot analyse {context.agent} context")
        assessment = self.assess(context)
        requires_human_approval = assessment.safety_critical or any(
            action.category is not ActionCategory.MONITOR for action in assessment.actions
        )
        summary, provider_name, fallback_used = self._narrate(
            context, assessment, requires_human_approval
        )
        return AgentRecommendation(
            agent=self.kind,
            entity_type=self.entity_type,
            entity_id=context.entity_id,
            severity=assessment.severity,
            summary=summary,
            rationale=assessment.rationale,
            evidence=assessment.evidence,
            recommended_actions=assessment.actions,
            requires_human_approval=requires_human_approval,
            safety_critical=assessment.safety_critical,
            confidence=assessment.confidence,
            confidence_basis=assessment.confidence_basis,
            provider=provider_name,
            provider_fallback_used=fallback_used,
        )

    def _narrate(
        self, context: AgentContext, assessment: Assessment, requires_human_approval: bool
    ) -> tuple[str, str, bool]:
        request = AIRequest(
            task="recommendation_summary",
            facts={
                "agent": self.kind.value,
                "entity_id": context.entity_id,
                "entity_label": assessment.entity_label,
                "severity": assessment.severity.value,
                "headline": assessment.headline,
                "findings": assessment.rationale,
                "actions": [action.action for action in assessment.actions],
                "requires_human_approval": requires_human_approval,
                **assessment.extra_facts,
            },
        )
        try:
            response = self._provider.complete(request)
        except ProviderUnavailableError:
            return assessment.headline, "none", True
        return response.text, response.provider, response.fallback_used
