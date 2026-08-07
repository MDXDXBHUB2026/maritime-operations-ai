"""Explainable prototype rules for maritime anomaly indicators."""

from __future__ import annotations

import pandas as pd


def deviation_percentage(current: float, expected: float) -> float:
    """Return absolute percentage deviation from an expected baseline."""
    if expected == 0:
        return 0.0 if current == 0 else 100.0
    return abs(current - expected) / abs(expected) * 100


def severity_from_deviation(deviation: float, threshold_breach: bool = False) -> str:
    """Classify severity using illustrative, non-engineering prototype rules."""
    if deviation > 20 or (threshold_breach and deviation >= 18):
        return "Critical"
    if deviation >= 12:
        return "High"
    if deviation >= 6:
        return "Medium"
    return "Low"


def anomaly_kpis(anomalies: pd.DataFrame) -> dict[str, str | int]:
    """Calculate anomaly overview metrics from the current session dataset."""
    active = anomalies[anomalies["status"] != "Closed"]
    latest_day = anomalies["detected_timestamp"].dt.date.max()
    return {
        "Assets monitored": int(anomalies["asset_id"].nunique()),
        "Active anomalies": int(len(active)),
        "Critical anomalies": int(((active["severity"] == "Critical")).sum()),
        "New anomalies today": int((anomalies["detected_timestamp"].dt.date == latest_day).sum()),
        "Acknowledged anomalies": int((anomalies["status"] == "Acknowledged").sum()),
        "Average confidence": f"{anomalies['confidence_score'].mean():.1f}%",
    }

