"""Safety specialist: every proposed action is safety-critical and human-approved."""

from __future__ import annotations

from app.agents.base_agent import Assessment, SpecialistAgent, escalate, num
from app.domain.enums import AgentName, EntityType, Severity
from app.domain.models import AgentContext, RecommendedAction


class SafetyAgent(SpecialistAgent):
    name = AgentName.SAFETY
    entity_type = EntityType.SAFETY_EVENT
    source = "safety_events"

    def assess(self, context: AgentContext) -> Assessment:
        r = context.record
        source_severity = Severity.from_value(r.get("severity"))
        risk = num(r.get("risk_score"))
        overdue = r.get("overdue_flag") in (True, 1)
        exposed = int(num(r.get("persons_exposed")))
        severity = source_severity
        if risk >= 70:
            severity = Severity.max(severity, Severity.HIGH)
        if overdue:
            severity = escalate(severity)

        owner = str(r.get("responsible_owner") or "Unassigned")
        facts = [
            f"{r.get('event_type')} at {r.get('vessel_or_terminal')} / {r.get('location')}",
            f"source severity {source_severity.value}, risk score {risk:g}",
            f"{exposed} person(s) exposed",
            "corrective action overdue" if overdue else "corrective action not overdue",
            f"responsible owner: {owner}",
        ]
        evidence = [self.evidence(context, f) for f in (
            "event_type", "severity", "risk_score", "persons_exposed", "overdue_flag",
            "immediate_action", "responsible_owner", "evidence_reference",
        )]

        actions: list[RecommendedAction] = []
        if str(r.get("status", "")).lower() == "closed":
            actions.append(RecommendedAction(action="Verify close-out evidence and effectiveness of controls",
                                             rationale="Event recorded as closed", safety_critical=True))
        else:
            actions.append(RecommendedAction(
                action=f"Verify effectiveness of immediate action: {r.get('immediate_action', 'not recorded')}",
                rationale="Confirm hazard is controlled", safety_critical=True))
            if r.get("recommended_corrective_action"):
                actions.append(RecommendedAction(action=f"Implement corrective action: {r['recommended_corrective_action']}",
                                                 rationale="Prevent recurrence", safety_critical=True))
            if owner.lower() == "unassigned":
                actions.append(RecommendedAction(action="Assign an accountable responsible owner",
                                                 rationale="No owner recorded", safety_critical=True))
            if severity.rank >= Severity.HIGH.rank:
                actions.append(RecommendedAction(action="Escalate to HSE manager / Designated Person Ashore",
                                                 rationale=f"{severity.value} safety event", safety_critical=True))

        return Assessment(severity=severity, headline=f"Safety event {context.entity_id}: {r.get('event_type')}",
                          facts=facts, evidence=evidence, actions=actions)
