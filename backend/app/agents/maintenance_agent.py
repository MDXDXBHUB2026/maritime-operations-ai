"""Maintenance specialist: condition-based prioritisation from health, failure probability and RUL."""

from __future__ import annotations

from app.agents.base_agent import Assessment, SpecialistAgent, num
from app.domain.enums import AgentName, EntityType, Severity
from app.domain.models import AgentContext, RecommendedAction


def condition_severity(health: float, failure_pct: float, rul_hours: float) -> Severity:
    if rul_hours <= 250 or failure_pct >= 70 or health < 40:
        return Severity.CRITICAL
    if rul_hours <= 750 or failure_pct >= 50 or health < 60:
        return Severity.HIGH
    if rul_hours <= 1500 or failure_pct >= 30 or health < 80:
        return Severity.MEDIUM
    return Severity.LOW


class MaintenanceAgent(SpecialistAgent):
    name = AgentName.MAINTENANCE
    entity_type = EntityType.MAINTENANCE_ASSET
    source = "maintenance_assets"

    def assess(self, context: AgentContext) -> Assessment:
        r = context.record
        health = num(r.get("health_score"))
        failure_pct = num(r.get("failure_probability_percentage"))
        rul = num(r.get("remaining_useful_life_hours"))
        condition = condition_severity(health, failure_pct, rul)
        criticality = Severity.from_value(r.get("criticality"))
        severity = Severity.max(condition, criticality)
        asset = r.get("asset_name", context.entity_id)
        spare = str(r.get("spare_part_availability", "Unknown"))
        history = context.related.get("maintenance_history", [])

        facts = [
            f"health score {health:g}",
            f"failure probability {failure_pct:g}%",
            f"remaining useful life {rul:g} h",
            f"condition severity {condition.value}, asset criticality {criticality.value}",
            f"spare part '{r.get('spare_part_required')}' is {spare}",
            f"{len(history)} historical maintenance record(s)",
        ]
        evidence = [self.evidence(context, f) for f in (
            "health_score", "failure_probability_percentage", "remaining_useful_life_hours",
            "criticality", "predicted_failure_mode", "spare_part_availability", "next_planned_maintenance_date",
        )]

        actions: list[RecommendedAction] = []
        if str(r.get("maintenance_status", "")).lower() == "completed":
            actions.append(RecommendedAction(action="Confirm post-maintenance condition readings",
                                             rationale="Maintenance recorded as completed", safety_critical=False))
        elif severity.rank >= Severity.HIGH.rank:
            actions.append(RecommendedAction(
                action=f"Propose corrective work order for {asset} ({r.get('predicted_failure_mode', 'predicted failure')})",
                rationale=f"{severity.value} priority from condition and criticality",
                safety_critical=severity == Severity.CRITICAL))
        elif severity == Severity.MEDIUM:
            actions.append(RecommendedAction(
                action=f"Schedule condition inspection before {r.get('next_planned_maintenance_date', 'next planned date')}",
                rationale="Degrading condition indicators", safety_critical=False))
        else:
            actions.append(RecommendedAction(action="Continue planned maintenance schedule",
                                             rationale="Condition indicators within normal range", safety_critical=False))
        if spare.lower() != "available" and severity.rank >= Severity.MEDIUM.rank:
            actions.append(RecommendedAction(
                action=f"Request procurement of {r.get('spare_part_required', 'required spare')} (currently {spare})",
                rationale="Spare availability constrains the maintenance window", safety_critical=False))

        return Assessment(severity=severity, headline=f"Maintenance priority for {asset} ({r.get('vessel_or_terminal', '')})",
                          facts=facts, evidence=evidence, actions=actions)
