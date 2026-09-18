"""Illustrative predictive-maintenance rules."""

from __future__ import annotations

import pandas as pd


def health_class(score: float) -> str:
    return "Healthy" if score >= 80 else "Warning" if score >= 60 else "Critical"


def maintenance_kpis(assets: pd.DataFrame) -> dict[str, str | int]:
    today = pd.Timestamp("2026-07-23")
    exposure = assets.loc[assets["maintenance_status"] != "Completed", "estimated_failure_cost_usd"].sum()
    return {
        "Assets monitored": len(assets),
        "Critical assets": int((assets["health_score"] < 60).sum()),
        "Failures within 30d": int((assets["remaining_useful_life_hours"] < 720).sum()),
        "Overdue maintenance": int((assets["next_planned_maintenance_date"] < today).sum()),
        "Awaiting spare parts": int((assets["spare_part_availability"] == "Unavailable").sum()),
        "Failure exposure": f"${exposure / 1_000_000:.2f}M",
    }

