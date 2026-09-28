from app.agents.base_agent import Assessment, BaseAgent, evidence
from app.domain.enums import ActionCategory, AgentKind, Severity
from app.domain.models import AgentContext, Evidence, RecommendedAction

SOURCE = "public/data/anomalies.json"


def _outside(value: float, lower: float, upper: float) -> bool:
    return value < lower or value > upper


class AnomalyAgent(BaseAgent):
    kind = AgentKind.ANOMALY
    entity_type = "anomaly"

    def assess(self, context: AgentContext) -> Assessment:
        a = context.record
        severity = Severity(a["severity"])
        value = float(a["current_value"])
        lower, upper = float(a["lower_threshold"]), float(a["upper_threshold"])
        asset, parameter = a["asset_name"], a["parameter_name"]

        readings = context.related.get("sensor_readings", [])
        breaches = [
            r
            for r in readings
            if _outside(
                float(r["actual_reading"]), float(r["lower_threshold"]), float(r["upper_threshold"])
            )
        ]

        rationale = [
            f"{parameter} reads {value} against an expected {a['expected_value']} "
            f"({a['deviation_percentage']}% deviation).",
            f"Current value is {'outside' if _outside(value, lower, upper) else 'within'} "
            f"the operating band [{lower}, {upper}].",
            f"{len(breaches)} of {len(readings)} recent sensor readings breached the band.",
            f"Dataset probable cause: {a.get('probable_cause', 'unknown')}.",
        ]
        ev = [
            evidence(SOURCE, a, "anomaly_id", "current_value"),
            evidence(SOURCE, a, "anomaly_id", "expected_value"),
            evidence(SOURCE, a, "anomaly_id", "deviation_percentage"),
            evidence(SOURCE, a, "anomaly_id", "severity"),
            evidence(SOURCE, a, "anomaly_id", "probable_cause"),
            Evidence(
                source="public/data/sensor_readings.json",
                record_id=str(a["anomaly_id"]),
                field="threshold_breaches",
                value=f"{len(breaches)}/{len(readings)}",
                note="Readings outside [lower_threshold, upper_threshold]",
            ),
        ]

        if severity is Severity.CRITICAL:
            actions = [
                RecommendedAction(
                    action=f"Inspect {asset} before continued operation",
                    category=ActionCategory.INSPECT,
                    safety_critical=True,
                ),
                RecommendedAction(
                    action="Raise a corrective work order", category=ActionCategory.WORK_ORDER
                ),
                RecommendedAction(
                    action="Notify the chief engineer and technical superintendent",
                    category=ActionCategory.ESCALATION,
                ),
            ]
        elif severity is Severity.HIGH:
            actions = [
                RecommendedAction(
                    action=f"Schedule inspection of {asset} within 24 hours",
                    category=ActionCategory.INSPECT,
                    safety_critical=True,
                ),
                RecommendedAction(
                    action="Raise a corrective work order", category=ActionCategory.WORK_ORDER
                ),
            ]
        elif severity is Severity.MEDIUM:
            actions = [
                RecommendedAction(
                    action=f"Schedule inspection of {asset} at the next maintenance window",
                    category=ActionCategory.INSPECT,
                ),
                RecommendedAction(
                    action=f"Increase monitoring of {parameter}", category=ActionCategory.MONITOR
                ),
            ]
        else:
            actions = [
                RecommendedAction(
                    action=f"Continue monitoring {parameter} trend", category=ActionCategory.MONITOR
                ),
            ]

        detector_score = a.get("confidence_score")
        confidence: float | None = None
        basis = "not_available: source dataset provides no detector score"
        if isinstance(detector_score, (int, float)) and 0 <= detector_score <= 100:
            confidence = round(float(detector_score) / 100, 3)
            basis = (
                "source_detector_score: anomalies.json confidence_score from the upstream "
                "detector, passed through unchanged; not recalculated by this agent"
            )

        return Assessment(
            severity=severity,
            headline=f"{a['anomaly_type']} on {asset} ({parameter})",
            entity_label=f"{a['anomaly_id']} / {a['vessel_or_terminal']}",
            rationale=rationale,
            evidence=ev,
            actions=actions,
            safety_critical=severity.rank >= Severity.HIGH.rank,
            confidence=confidence,
            confidence_basis=basis,
        )
