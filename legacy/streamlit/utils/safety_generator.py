"""Generate synthetic safety events and corrective actions."""

from __future__ import annotations
from pathlib import Path
import numpy as np
import pandas as pd


def generate_safety_data(output_dir: str | Path = "data") -> None:
    rng = np.random.default_rng(208)
    output = Path(output_dir); output.mkdir(parents=True, exist_ok=True)
    types = ["Missing PPE", "Worker and vehicle proximity", "Restricted-area entry", "Unsafe lifting activity", "Person below suspended load", "Vehicle speeding", "Fire or smoke observation", "Oil or chemical spill", "Unsafe working at height", "Fatigue or excessive overtime", "Near miss", "Equipment safety interlock alarm"]
    sources = ["Synthetic camera event", "Operator observation", "Sensor alarm", "Supervisor inspection"]
    sites = ["North Container Terminal", "South Container Terminal", "MV Horizon Star", "MV Meridian"]
    locations = ["Berth 1", "Yard A", "Workshop", "Reefer Stack", "Engine Room", "Access Gate"]
    severities = ["Low", "Medium", "High", "Critical"]
    statuses = ["New", "Acknowledged", "Under Review", "In Progress", "Closed"]
    rows = []
    for i in range(48):
        severity = severities[i % 4]
        exposed = int(rng.integers(1, 8))
        due = pd.Timestamp("2026-07-23") + pd.offsets.Day(int(rng.integers(-12, 25)))
        status = statuses[i % 5]
        overdue = bool(due < pd.Timestamp("2026-07-23") and status != "Closed")
        score = min(100, [18, 38, 65, 85][i % 4] + exposed * 2 + (12 if overdue else 0))
        rows.append({
            "event_id": f"SE-{i+1:04d}", "timestamp": (pd.Timestamp("2026-07-23 08:00") - pd.offsets.Hour(i * 4)).isoformat(),
            "event_type": types[i % len(types)], "detection_source": sources[i % 4], "vessel_or_terminal": sites[i % 4],
            "location": locations[i % 6], "severity": severity, "description": f"Synthetic {types[i % len(types)].lower()} observation for workflow demonstration",
            "persons_exposed": exposed, "immediate_action": "Area made safe and supervisor informed",
            "recommended_corrective_action": "Review conditions, brief personnel and verify controls",
            "responsible_owner": "Unassigned", "due_date": due.date(), "status": status,
            "overdue_flag": overdue, "risk_score": score, "evidence_reference": f"SYN-EVID-{i+1:04d}",
            # Compatibility fields retain the Executive Dashboard safety summary.
            "risk_level": severity, "owner": "Unassigned", "event_date": pd.Timestamp("2026-07-23").date(),
        })
    events = pd.DataFrame(rows)
    events.to_csv(output / "safety_events.csv", index=False)
    events[["event_id","timestamp","event_type","vessel_or_terminal","location","severity","description"]].to_csv(output / "safety_observations.csv", index=False)
    pd.DataFrame([{
        "corrective_action_id": f"CA-{i+1:04d}", "event_id": f"SE-{i+1:04d}",
        "action": "Synthetic corrective action", "owner": "HSE Manager",
        "due_date": rows[i]["due_date"], "status": rows[i]["status"],
    } for i in range(24)]).to_csv(output / "corrective_actions.csv", index=False)


if __name__ == "__main__":
    generate_safety_data()
