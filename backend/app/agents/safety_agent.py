from app.agents.base_agent import Assessment, BaseAgent, evidence
from app.domain.enums import ActionCategory, AgentKind, Severity
from app.domain.models import AgentContext, RecommendedAction

SOURCE = "public/data/safety_events.json"


class SafetyAgent(BaseAgent):
    """Safety events are always treated as safety-critical and always need human approval."""

    kind = AgentKind.SAFETY
    entity_type = "safety_event"

    def assess(self, context: AgentContext) -> Assessment:
        s = context.record
        severity = Severity(s["severity"])
        overdue = bool(s.get("overdue_flag"))
        owner = str(s.get("responsible_owner") or s.get("owner") or "Unassigned")
        persons = int(s.get("persons_exposed") or 0)

        rationale = [
            f"{s['event_type']} at {s['vessel_or_terminal']} ({s.get('location', 'unknown location')}), "
            f"severity {severity.value}, risk score {s['risk_score']}.",
            f"{persons} person(s) exposed; detection source: {s.get('detection_source', 'unknown')}.",
            f"Status {s['status']}; due {s.get('due_date', 'n/a')}; "
            f"{'OVERDUE' if overdue else 'not overdue'}.",
            f"Responsible owner: {owner}.",
        ]
        ev = [
            evidence(SOURCE, s, "event_id", f)
            for f in (
                "severity",
                "risk_score",
                "persons_exposed",
                "status",
                "overdue_flag",
                "evidence_reference",
            )
        ]

        actions = [
            RecommendedAction(
                action=str(s.get("recommended_corrective_action") or "Review and verify controls"),
                category=ActionCategory.INSPECT,
                safety_critical=True,
            )
        ]
        if owner.lower() == "unassigned":
            actions.append(
                RecommendedAction(
                    action="Assign a responsible safety owner", category=ActionCategory.ASSIGNMENT
                )
            )
        if overdue or severity.rank >= Severity.HIGH.rank:
            actions.append(
                RecommendedAction(
                    action="Escalate to the HSE manager / Designated Person Ashore",
                    category=ActionCategory.ESCALATION,
                    safety_critical=True,
                )
            )

        return Assessment(
            severity=severity,
            headline=f"{s['event_type']} requires corrective action review",
            entity_label=f"{s['event_id']} / {s['vessel_or_terminal']}",
            rationale=rationale,
            evidence=ev,
            actions=actions,
            safety_critical=True,
        )
