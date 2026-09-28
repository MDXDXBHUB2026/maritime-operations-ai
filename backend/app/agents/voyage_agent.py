"""Voyage specialist: ETA variance, berth waiting, speed and fuel versus plan."""

from __future__ import annotations

from datetime import datetime

from app.agents.base_agent import Assessment, SpecialistAgent, num
from app.domain.enums import AgentName, EntityType, Severity
from app.domain.models import AgentContext, RecommendedAction


def _hours_between(start: object, end: object) -> float | None:
    try:
        return (datetime.fromisoformat(str(end)) - datetime.fromisoformat(str(start))).total_seconds() / 3600
    except ValueError:
        return None


class VoyageAgent(SpecialistAgent):
    name = AgentName.VOYAGE
    entity_type = EntityType.VOYAGE_PLAN
    source = "voyage_plans"

    def assess(self, context: AgentContext) -> Assessment:
        r = context.record
        delay = _hours_between(r.get("planned_eta"), r.get("predicted_eta"))
        waiting = num(r.get("estimated_waiting_hours"))
        planned_fuel, predicted_fuel = num(r.get("planned_fuel_tonnes")), num(r.get("predicted_fuel_tonnes"))
        fuel_overrun_pct = ((predicted_fuel - planned_fuel) / planned_fuel * 100) if planned_fuel else 0.0
        current, recommended = num(r.get("current_speed_knots")), num(r.get("recommended_speed_knots"))
        weather = Severity.from_value(r.get("weather_risk"))
        d = delay or 0.0

        if weather == Severity.HIGH and d >= 24:
            severity = Severity.CRITICAL
        elif d >= 12 or weather == Severity.HIGH:
            severity = Severity.HIGH
        elif d >= 4 or waiting >= 6 or fuel_overrun_pct > 5:
            severity = Severity.MEDIUM
        else:
            severity = Severity.LOW

        vessel = r.get("vessel_name", "")
        facts = [
            f"ETA variance {'unknown' if delay is None else f'{delay:+.1f} h'} versus plan",
            f"estimated berth waiting {waiting:g} h",
            f"predicted fuel {predicted_fuel:g} t vs planned {planned_fuel:g} t ({fuel_overrun_pct:+.1f}%)",
            f"current speed {current:g} kn, recommended {recommended:g} kn",
            f"weather risk {r.get('weather_risk')}",
        ]
        evidence = [self.evidence(context, f) for f in (
            "planned_eta", "predicted_eta", "estimated_waiting_hours", "planned_fuel_tonnes",
            "predicted_fuel_tonnes", "current_speed_knots", "recommended_speed_knots", "weather_risk",
        )]

        actions: list[RecommendedAction] = []
        if recommended and abs(current - recommended) >= 0.2:
            actions.append(RecommendedAction(
                action=f"Propose speed adjustment for {vessel} from {current:g} kn to {recommended:g} kn",
                rationale="Planning-system recommended speed; final navigational decision rests with the Master",
                safety_critical=False))
        if waiting > 0:
            actions.append(RecommendedAction(
                action="Coordinate berth window with terminal for just-in-time arrival",
                rationale=f"{waiting:g} h of berth waiting is forecast", safety_critical=False))
        if weather == Severity.HIGH:
            actions.append(RecommendedAction(
                action="Request Master's weather-routing review before any route or speed change",
                rationale="High weather risk on the planned route", safety_critical=True))
        if not actions:
            actions.append(RecommendedAction(action="Maintain current voyage plan",
                                             rationale="Voyage within plan tolerances", safety_critical=False))

        return Assessment(severity=severity, headline=f"Voyage {context.entity_id} ({vessel}) performance versus plan",
                          facts=facts, evidence=evidence, actions=actions)
