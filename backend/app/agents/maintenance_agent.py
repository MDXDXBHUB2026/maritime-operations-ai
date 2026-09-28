from app.agents.base_agent import Assessment, BaseAgent, evidence
from app.domain.enums import ActionCategory, AgentKind, Severity
from app.domain.models import AgentContext, Evidence, RecommendedAction

SOURCE = "public/data/maintenance_assets.json"

# Documented rule thresholds (failure probability %, remaining useful life hours).
CRITICAL_FAILURE_PCT, CRITICAL_RUL_HOURS = 60.0, 500.0
HIGH_FAILURE_PCT, HIGH_RUL_HOURS = 40.0, 1000.0
MEDIUM_FAILURE_PCT = 20.0


def classify(failure_pct: float, rul_hours: float) -> Severity:
    if failure_pct >= CRITICAL_FAILURE_PCT or rul_hours < CRITICAL_RUL_HOURS:
        return Severity.CRITICAL
    if failure_pct >= HIGH_FAILURE_PCT or rul_hours < HIGH_RUL_HOURS:
        return Severity.HIGH
    if failure_pct >= MEDIUM_FAILURE_PCT:
        return Severity.MEDIUM
    return Severity.LOW


class MaintenanceAgent(BaseAgent):
    kind = AgentKind.MAINTENANCE
    entity_type = "maintenance_asset"

    def assess(self, context: AgentContext) -> Assessment:
        m = context.record
        failure_pct = float(m["failure_probability_percentage"])
        rul = float(m["remaining_useful_life_hours"])
        severity = classify(failure_pct, rul)
        failure_mode = m.get("predicted_failure_mode") or "the predicted failure mode"
        spare = m.get("spare_part_required") or "required spare part"
        spare_available = str(m.get("spare_part_availability", "")).lower() == "available"
        open_orders = [
            wo
            for wo in context.related.get("work_orders", [])
            if str(wo.get("status", "")).lower() not in {"closed", "completed"}
        ]
        history = context.related.get("maintenance_history", [])

        rationale = [
            f"Failure probability {failure_pct}% and remaining useful life {rul:.0f} h "
            f"classify as {severity.value} under the documented thresholds.",
            f"Health score {m['health_score']}; asset criticality {m['criticality']}.",
            f"Predicted failure mode: {failure_mode}.",
            f"Spare part '{spare}' availability: {m.get('spare_part_availability', 'unknown')}.",
            f"{len(open_orders)} open work order(s); {len(history)} historical maintenance record(s).",
        ]
        ev = [
            evidence(SOURCE, m, "asset_id", "failure_probability_percentage"),
            evidence(SOURCE, m, "asset_id", "remaining_useful_life_hours"),
            evidence(SOURCE, m, "asset_id", "health_score"),
            evidence(SOURCE, m, "asset_id", "criticality"),
            evidence(SOURCE, m, "asset_id", "spare_part_availability"),
            evidence(SOURCE, m, "asset_id", "next_planned_maintenance_date"),
            Evidence(
                source="public/data/work_orders.json",
                record_id=str(m["asset_id"]),
                field="open_work_orders",
                value=[wo.get("work_order_reference") for wo in open_orders],
            ),
        ]

        needs_action = severity.rank >= Severity.MEDIUM.rank
        actions: list[RecommendedAction] = []
        if severity is Severity.CRITICAL:
            actions.append(
                RecommendedAction(
                    action=f"Plan a controlled shutdown window to address {failure_mode}",
                    category=ActionCategory.OPERATIONAL_CHANGE,
                    safety_critical=True,
                )
            )
        if needs_action and not open_orders:
            actions.append(
                RecommendedAction(
                    action="Raise a maintenance work order", category=ActionCategory.WORK_ORDER
                )
            )
        if needs_action and not spare_available:
            actions.append(
                RecommendedAction(
                    action=f"Expedite procurement of {spare}", category=ActionCategory.PROCUREMENT
                )
            )
        if needs_action and str(m.get("owner", "")).lower() in {"", "unassigned"}:
            actions.append(
                RecommendedAction(
                    action="Assign a responsible maintenance owner",
                    category=ActionCategory.ASSIGNMENT,
                )
            )
        if not actions:
            actions.append(
                RecommendedAction(
                    action="Continue condition monitoring per planned schedule",
                    category=ActionCategory.MONITOR,
                )
            )

        return Assessment(
            severity=severity,
            headline=f"{m['asset_name']} predicted {failure_mode} risk",
            entity_label=f"{m['asset_id']} / {m['vessel_or_terminal']}",
            rationale=rationale,
            evidence=ev,
            actions=actions,
            safety_critical=severity is Severity.CRITICAL,
        )
