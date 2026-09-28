"""Deterministic, rule-based narrative provider. No network, no keys, identical output for identical input."""

from __future__ import annotations

from app.ai.provider import AIProvider, NarrativeRequest, NarrativeResponse


class DeterministicProvider(AIProvider):
    name = "deterministic"

    def generate_narrative(self, request: NarrativeRequest) -> NarrativeResponse:
        summary = f"[{request.severity}] {request.headline}"
        facts = "; ".join(request.facts) if request.facts else "no supporting facts recorded"
        first_action = request.actions[0] if request.actions else "no action proposed"
        rationale = (
            f"Rule-based assessment by the {request.agent} agent for {request.entity_id}. "
            f"Evidence: {facts}. Proposed first step: {first_action}. "
            "This is a recommendation only and requires human review before any execution."
        )
        return NarrativeResponse(summary=summary, rationale=rationale, provider=self.name)

    def is_available(self) -> bool:
        return True
