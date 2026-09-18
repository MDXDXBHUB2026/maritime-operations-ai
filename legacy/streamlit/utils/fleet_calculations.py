"""Transparent summary rules for the synthetic fleet module."""

from __future__ import annotations

import pandas as pd


def fleet_kpis(vessels: pd.DataFrame) -> dict[str, str | int]:
    delayed = (vessels["predicted_eta"] > vessels["planned_eta"]) | (vessels["voyage_status"] == "Delayed")
    return {
        "Total vessels": len(vessels),
        "Vessels underway": int((vessels["operational_status"] == "Underway").sum()),
        "Vessels in port": int((vessels["operational_status"] == "In Port").sum()),
        "Delayed vessels": int(delayed.sum()),
        "Critical risk": int((vessels["safety_risk_level"] == "Critical").sum()),
        "Average fleet health": f"{vessels['technical_health_score'].mean():.1f}",
    }


def health_band(score: float) -> str:
    if score >= 80:
        return "Healthy"
    if score >= 60:
        return "Warning"
    return "Critical"

