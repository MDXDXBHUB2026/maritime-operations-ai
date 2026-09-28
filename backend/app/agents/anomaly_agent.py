"""Anomaly specialist: evaluates sensor deviations against configured thresholds."""

from __future__ import annotations

from app.agents.base_agent import Assessment, SpecialistAgent, num
from app.domain.enums import AgentName, ConfidenceBasis, EntityType, Severity
from app.domain.models import AgentContext, RecommendedAction


class AnomalyAgent(SpecialistAgent):
    name = AgentName.ANOMALY
    entity_type = EntityType.ANOMALY
    source = "anomalies"

    def assess(self, context: AgentContext) -> Assessment:
        r = context.record
        current, lower, upper = num(r.get("current_value")), num(r.get("lower_threshold")), num(r.get("upper_threshold"))
        breach = current < lower or current > upper
        source_severity = Severity.from_value(r.get("severity"))
        severity = Severity.max(source_severity, Severity.HIGH) if breach else source_severity
        asset = r.get("asset_name", context.entity_id)
        parameter = r.get("parameter_name", "parameter")

        readings = context.related.get("sensor_readings", [])
        detection_points = sum(1 for x in readings if x.get("is_detection_point") in (True, 1))

        facts = [
            f"{parameter} = {current} (expected {r.get('expected_value')}, band {lower}-{upper})",
            f"deviation {r.get('deviation_percentage')}%",
            "value outside threshold band" if breach else "value inside threshold band",
            f"source severity {source_severity.value}",
            f"{len(readings)} sensor readings, {detection_points} detection point(s)",
        ]
        evidence = [
            self.evidence(context, "current_value"),
            self.evidence(context, "lower_threshold"),
            self.evidence(context, "upper_threshold"),
            self.evidence(context, "deviation_percentage"),
            self.evidence(context, "severity", note="severity recorded by source system"),
            self.evidence(context, "probable_cause"),
        ]
        if readings:
            evidence.append(
                self.evidence(context, "anomaly_id", note=f"{len(readings)} related sensor_readings, {detection_points} flagged")
            )

        high = severity.rank >= Severity.HIGH.rank
        if str(r.get("status", "")).lower() == "closed":
            actions = [RecommendedAction(action="Verify closure evidence; no further action proposed",
                                         rationale="Anomaly is already closed in the source register", safety_critical=False)]
        elif high:
            actions = [
                RecommendedAction(action=f"Raise inspection work-order request for {asset}",
                                  rationale=f"{severity.value} anomaly on {parameter}", safety_critical=True),
                RecommendedAction(action=f"Notify {r.get('owner') or 'responsible engineer'} for immediate review",
                                  rationale="High-severity deviations require accountable review", safety_critical=False),
            ]
        elif severity == Severity.MEDIUM:
            actions = [RecommendedAction(action=f"Increase monitoring of {parameter} and verify sensor calibration",
                                         rationale="Moderate deviation without confirmed breach", safety_critical=False)]
        else:
            actions = [RecommendedAction(action="Continue monitoring and review trend at next watch",
                                         rationale="Low deviation within tolerance", safety_critical=False)]
        if r.get("recommended_action") and str(r.get("status", "")).lower() != "closed":
            actions.append(RecommendedAction(action=f"Source-system recommendation: {r['recommended_action']}",
                                             rationale="Carried forward from the detection system", safety_critical=high))

        confidence = r.get("confidence_score")
        has_conf = isinstance(confidence, (int, float)) and 0 <= confidence <= 100
        return Assessment(
            severity=severity,
            headline=f"{parameter} anomaly on {asset} ({r.get('vessel_or_terminal', 'unknown location')})",
            facts=facts,
            evidence=evidence,
            actions=actions,
            confidence=float(confidence) if has_conf else None,
            confidence_basis=ConfidenceBasis.SOURCE_DETECTION_CONFIDENCE if has_conf else ConfidenceBasis.NOT_COMPUTED,
        )
