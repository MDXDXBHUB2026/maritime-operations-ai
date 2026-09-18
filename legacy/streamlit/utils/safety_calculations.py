"""Illustrative safety risk scoring and summaries."""

from __future__ import annotations
import pandas as pd


def safety_kpis(events: pd.DataFrame) -> dict[str, str | int]:
    open_events = events[events["status"] != "Closed"]
    return {
        "Open safety events": len(open_events),
        "Critical events": int(((open_events["severity"] == "Critical")).sum()),
        "Near misses": int((events["event_type"] == "Near miss").sum()),
        "Overdue actions": int((events["overdue_flag"] == True).sum()),
        "High-risk locations": int(events.loc[events["risk_score"] >= 70, "location"].nunique()),
        "Days without LTI": 126,
    }

