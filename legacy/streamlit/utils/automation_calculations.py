"""Summary calculations for controlled automation tasks."""

from __future__ import annotations
import pandas as pd


def automation_kpis(tasks: pd.DataFrame) -> dict[str, str | int]:
    latest = tasks["created_timestamp"].dt.date.max()
    return {
        "Open tasks": int((~tasks["status"].isin(["Closed", "Executed", "Rejected"])).sum()),
        "Awaiting approval": int((tasks["status"] == "Awaiting Approval").sum()),
        "Approved today": int(((tasks["status"] == "Approved") & (tasks["created_timestamp"].dt.date == latest)).sum()),
        "Rejected today": int(((tasks["status"] == "Rejected") & (tasks["created_timestamp"].dt.date == latest)).sum()),
        "Estimated hours saved": f"{tasks['estimated_time_saved_minutes'].sum()/60:.1f}",
        "Estimated value": f"${tasks['estimated_value_usd'].sum():,.0f}",
    }

