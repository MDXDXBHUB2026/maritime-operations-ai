"""Generate synthetic controlled-automation workflow datasets."""

from __future__ import annotations
from pathlib import Path
import pandas as pd


def generate_automation_data(output_dir: str | Path = "data") -> None:
    output = Path(output_dir); output.mkdir(parents=True, exist_ok=True)
    workflows = ["Maintenance work-order drafting", "Alert classification", "Voyage-delay notification", "Berth-plan adjustment recommendation", "Fuel-deviation review", "Safety observation classification", "Corrective-action reminder", "Invoice exception review", "Cargo-document validation", "Reefer inspection request", "Daily management summary preparation", "Spare-parts reorder recommendation"]
    modules = ["Predictive Maintenance", "Anomaly Detection", "Voyage & Fuel Optimisation", "Fleet Overview", "Safety Monitoring", "Automation Centre"]
    levels = ["Level 1: Administrative assistance", "Level 2: Decision recommendation", "Level 3: Controlled execution after approval"]
    risks = ["Low", "Medium", "High"]
    statuses = ["Created", "Under Review", "Awaiting Approval", "Approved", "Rejected", "Executed"]
    rows = []
    for i in range(30):
        workflow = workflows[i % len(workflows)]
        risk = risks[i % 3]
        approval = i % 3 != 0 or risk == "High"
        rows.append({
            "task_id": f"AUT-{i+1:04d}", "created_timestamp": (pd.Timestamp("2026-07-23 08:00") - pd.offsets.Hour(i * 3)).isoformat(),
            "workflow_name": workflow, "module_source": modules[i % len(modules)],
            "vessel_or_terminal": ["Fleet-wide", "North Container Terminal", "South Container Terminal", "MV Horizon Star"][i % 4],
            "asset_or_reference": f"REF-{2600+i}", "task_description": f"Prepare synthetic {workflow.lower()} output",
            "AI_recommendation": "Review the generated draft and approve only after human validation",
            "confidence_score": 72 + (i % 24), "risk_level": risk, "human_approval_required": approval,
            "assigned_owner": ["Unassigned", "Digital Operations Analyst", "Operations Manager"][i % 3],
            "due_date": (pd.Timestamp("2026-07-23") + pd.offsets.Day(i % 10)).date(), "status": statuses[i % len(statuses)],
            "automation_level": levels[i % 3], "estimated_time_saved_minutes": 15 + (i % 8) * 10,
            "estimated_value_usd": 120 + (i % 10) * 275, "final_decision": "", "decision_comment": "",
        })
    tasks = pd.DataFrame(rows)
    tasks.to_csv(output / "automation_tasks.csv", index=False)
    pd.DataFrame({"workflow_name": workflows, "automation_level": [levels[i % 3] for i in range(len(workflows))], "enabled": True}).to_csv(output / "automation_workflows.csv", index=False)
    pd.DataFrame(columns=["timestamp","task_id","action","previous_status","new_status","owner","comment"]).to_csv(output / "approval_history.csv", index=False)


if __name__ == "__main__":
    generate_automation_data()
