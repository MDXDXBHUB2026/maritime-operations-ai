"""Specialist agent contract.

Agents Decide; Services and Tools Execute. An agent receives an immutable
structured context, applies deterministic domain rules, optionally asks the
configured AIProvider for narrative text, and returns a typed recommendation.
Agents hold no database session or repository and cannot change operational state.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional

from app.ai.provider import AIProvider, NarrativeRequest
from app.domain.enums import AgentName, ConfidenceBasis, EntityType, Severity
from app.domain.models import AgentContext, AgentRecommendation, Evidence, RecommendedAction


@dataclass
class Assessment:
    severity: Severity
    headline: str
    facts: list[str]
    evidence: list[Evidence]
    actions: list[RecommendedAction]
    confidence: Optional[float] = None
    confidence_basis: ConfidenceBasis = ConfidenceBasis.NOT_COMPUTED
    extra: dict[str, Any] = field(default_factory=dict)


class SpecialistAgent(ABC):
    name: AgentName
    entity_type: EntityType
    source: str  # dataset name used for evidence references

    @abstractmethod
    def assess(self, context: AgentContext) -> Assessment:
        """Deterministic domain analysis. Must not perform I/O or mutate the context."""

    def evidence(self, context: AgentContext, fld: str, note: Optional[str] = None) -> Evidence:
        return Evidence(
            source=self.source,
            reference=context.entity_id,
            field=fld,
            value=context.record.get(fld),
            note=note,
        )

    def analyse(self, context: AgentContext, provider: AIProvider) -> AgentRecommendation:
        if context.agent != self.name:
            raise ValueError(f"{self.name.value} agent cannot analyse {context.agent.value} context")
        assessment = self.assess(context.model_copy(deep=True))
        narrative = provider.generate_narrative(
            NarrativeRequest(
                agent=self.name.value,
                entity_id=context.entity_id,
                severity=assessment.severity.value,
                headline=assessment.headline,
                facts=assessment.facts,
                actions=[a.action for a in assessment.actions],
                extra=assessment.extra,
            )
        )
        return AgentRecommendation(
            agent=self.name,
            entity_type=self.entity_type,
            entity_id=context.entity_id,
            severity=assessment.severity,
            summary=narrative.summary,
            rationale=narrative.rationale,
            evidence=assessment.evidence,
            recommended_actions=assessment.actions,
            confidence=assessment.confidence,
            confidence_basis=assessment.confidence_basis,
            # Phase 1 policy: every recommendation is decision support and needs a human decision.
            requires_human_approval=True,
            safety_critical=any(a.safety_critical for a in assessment.actions),
            provider=narrative.provider,
        )


def num(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def escalate(severity: Severity) -> Severity:
    order = [Severity.LOW, Severity.MEDIUM, Severity.HIGH, Severity.CRITICAL]
    return order[min(order.index(severity) + 1, len(order) - 1)]
