"""Transparent rules used to simulate operational intelligence indicators."""

from __future__ import annotations

import pandas as pd


def health_category(score: float) -> str:
    """Classify equipment health using the documented prototype thresholds."""
    if score >= 80:
        return "Healthy"
    if score >= 60:
        return "Warning"
    return "Critical"


def equipment_health_counts(equipment: pd.DataFrame) -> dict[str, int]:
    """Return the number of assets in each health band."""
    categories = equipment["health_score"].apply(health_category)
    counts = categories.value_counts()
    return {name: int(counts.get(name, 0)) for name in ("Healthy", "Warning", "Critical")}


def dashboard_kpis(
    vessels: pd.DataFrame,
    voyages: pd.DataFrame,
    equipment: pd.DataFrame,
    alerts: pd.DataFrame,
    safety: pd.DataFrame,
) -> dict[str, str | int]:
    """Calculate executive KPIs from simple, explainable prototype rules."""
    active_vessels = int(vessels["operational_status"].isin(["Underway", "At berth", "In Port", "At Anchorage"]).sum())
    critical_alerts = int(((alerts["severity"] == "Critical") & (alerts["status"] != "Closed")).sum())
    predicted_failures = int((equipment["predicted_failure_days"].between(0, 30)).sum())
    delayed_voyages = int((voyages["predicted_eta"] > voyages["planned_eta"]).sum())
    potential_saving = float(voyages["potential_fuel_saving_pct"].mean())
    high_risk_safety = int(((safety["risk_level"] == "High") & (safety["status"] != "Closed")).sum())
    return {
        "Active vessels": active_vessels,
        "Critical alerts": critical_alerts,
        "Predicted failures (30d)": predicted_failures,
        "Delayed voyages": delayed_voyages,
        "Potential fuel saving": f"{potential_saving:.1f}%",
        "Open high-risk safety": high_risk_safety,
    }


def maintenance_summary(equipment: pd.DataFrame) -> dict[str, int]:
    """Summarise scheduled and urgent maintenance work."""
    return {
        "Due in 7 days": int((equipment["maintenance_due_days"] <= 7).sum()),
        "Overdue": int((equipment["maintenance_due_days"] < 0).sum()),
        "Work orders open": int((equipment["maintenance_status"] != "Complete").sum()),
    }
