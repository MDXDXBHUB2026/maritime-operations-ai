from datetime import datetime

from app.agents.base_agent import Assessment, BaseAgent, evidence
from app.domain.enums import ActionCategory, AgentKind, Severity
from app.domain.models import AgentContext, RecommendedAction

SOURCE = "public/data/voyage_plans.json"

DELAY_HOURS_MEDIUM = 6.0
FUEL_OVERRUN_PCT_MEDIUM = 5.0
SPEED_DELTA_KNOTS = 0.3


def _hours_between(start: object, end: object) -> float | None:
    try:
        delta = datetime.fromisoformat(str(end)) - datetime.fromisoformat(str(start))
    except ValueError:
        return None
    return delta.total_seconds() / 3600


class VoyageAgent(BaseAgent):
    kind = AgentKind.VOYAGE
    entity_type = "voyage_plan"

    def assess(self, context: AgentContext) -> Assessment:
        v = context.record
        planned_fuel = float(v["planned_fuel_tonnes"])
        predicted_fuel = float(v["predicted_fuel_tonnes"])
        fuel_delta_pct = (
            round((predicted_fuel - planned_fuel) / planned_fuel * 100, 1) if planned_fuel else 0.0
        )
        delay_h = _hours_between(v.get("planned_eta"), v.get("predicted_eta"))
        current, recommended = float(v["current_speed_knots"]), float(v["recommended_speed_knots"])
        waiting_h = float(v.get("estimated_waiting_hours") or 0)
        weather = str(v.get("weather_risk", "Unknown"))
        high_weather = weather.lower() == "high"

        if high_weather:
            severity = Severity.HIGH
        elif (delay_h is not None and delay_h >= DELAY_HOURS_MEDIUM) or (
            fuel_delta_pct >= FUEL_OVERRUN_PCT_MEDIUM
        ):
            severity = Severity.MEDIUM
        else:
            severity = Severity.LOW

        rationale = [
            f"Predicted fuel {predicted_fuel} t vs planned {planned_fuel} t ({fuel_delta_pct:+}%).",
            (
                f"Predicted ETA deviates {delay_h:+.1f} h from plan."
                if delay_h is not None
                else "ETA deviation could not be computed from the dataset."
            ),
            f"Current speed {current} kn; dataset recommended speed {recommended} kn.",
            f"Weather risk {weather}; estimated berth waiting {waiting_h:.0f} h.",
        ]
        ev = [
            evidence(SOURCE, v, "voyage_id", f)
            for f in (
                "planned_fuel_tonnes",
                "predicted_fuel_tonnes",
                "planned_eta",
                "predicted_eta",
                "current_speed_knots",
                "recommended_speed_knots",
                "weather_risk",
                "estimated_waiting_hours",
            )
        ]

        actions: list[RecommendedAction] = []
        if abs(current - recommended) >= SPEED_DELTA_KNOTS:
            actions.append(
                RecommendedAction(
                    action=(
                        f"Propose speed adjustment from {current} kn to {recommended} kn "
                        "for the Master's consideration"
                    ),
                    category=ActionCategory.OPERATIONAL_CHANGE,
                    safety_critical=high_weather,
                )
            )
        if waiting_h > 0:
            actions.append(
                RecommendedAction(
                    action=f"Coordinate just-in-time arrival with the port to avoid ~{waiting_h:.0f} h waiting",
                    category=ActionCategory.OPERATIONAL_CHANGE,
                )
            )
        if high_weather:
            actions.append(
                RecommendedAction(
                    action="Review weather routing with the Master before any route change",
                    category=ActionCategory.ESCALATION,
                    safety_critical=True,
                )
            )
        if not actions:
            actions.append(
                RecommendedAction(
                    action="Maintain current voyage plan and monitor",
                    category=ActionCategory.MONITOR,
                )
            )

        return Assessment(
            severity=severity,
            headline=(
                f"Voyage {v['voyage_id']} {v.get('departure_port', '')} to "
                f"{v.get('destination_port', '')} optimisation review"
            ),
            entity_label=f"{v['voyage_id']} / {v['vessel_name']}",
            rationale=rationale,
            evidence=ev,
            actions=actions,
            safety_critical=high_weather,
            extra_facts={"fuel_delta_pct": fuel_delta_pct, "eta_delta_hours": delay_h},
        )
