"""Generate fictional vessel and terminal maintenance datasets."""

from __future__ import annotations

from pathlib import Path
import numpy as np
import pandas as pd


def generate_maintenance_data(output_dir: str | Path = "data") -> None:
    rng = np.random.default_rng(104)
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    categories = ["Main Engine", "Auxiliary Engine", "Generator", "Pump", "Turbocharger", "Quay Crane", "Terminal Tractor", "Reefer Power Unit"]
    manufacturers = ["Maritech Works", "Oceanic Systems", "Nordic Power", "Harbour Dynamics"]
    locations = ["Engine Room", "Machinery Space", "Generator Deck", "Pump Room", "Berth 2", "Yard A", "Reefer Stack"]
    vessels = [f"MV {name}" for name in ["Horizon Star", "Ocean Crest", "Meridian", "Blue Mariner", "Atlas Wind", "Gulf Pioneer"]]
    terminals = ["North Container Terminal", "South Container Terminal"]
    modes = ["Bearing degradation", "Cooling efficiency loss", "Seal leakage", "Electrical insulation deterioration", "Hydraulic pressure loss"]
    statuses = ["Monitoring", "Inspection Scheduled", "New", "In Progress", "Completed"]
    assets = []
    for i in range(48):
        category = categories[i % len(categories)]
        score = int(rng.integers(42, 99))
        failure = round(min(95, max(4, 105 - score + rng.uniform(-8, 10))), 1)
        rul = int(max(35, score * 18 + rng.integers(-500, 400)))
        site = terminals[i % 2] if category in {"Quay Crane", "Terminal Tractor", "Reefer Power Unit"} else vessels[i % len(vessels)]
        next_date = pd.Timestamp("2026-07-23") + pd.offsets.Day(int(rng.integers(-25, 95)))
        assets.append({
            "asset_id": f"MA-{i+1:03d}", "asset_name": f"{category} {i+1:02d}", "asset_category": category,
            "vessel_or_terminal": site, "location": locations[i % len(locations)], "manufacturer": manufacturers[i % 4],
            "running_hours": int(rng.integers(900, 28000)), "last_maintenance_date": (next_date - pd.offsets.Day(int(rng.integers(90, 300)))).date(),
            "next_planned_maintenance_date": next_date.date(), "health_score": score,
            "failure_probability_percentage": failure, "remaining_useful_life_hours": rul,
            "criticality": ["Low", "Medium", "High", "Critical"][i % 4], "predicted_failure_mode": modes[i % len(modes)],
            "recommended_action": "Inspect condition indicators and validate during a controlled maintenance window",
            "spare_part_required": ["Bearing kit", "Seal kit", "Filter set", "Sensor module"][i % 4],
            "spare_part_availability": ["Available", "Low Stock", "Unavailable"][i % 3],
            "estimated_downtime_hours": int(rng.integers(4, 72)), "estimated_failure_cost_usd": int(rng.integers(15000, 380000)),
            "maintenance_status": statuses[i % len(statuses)], "owner": "Unassigned", "work_order_reference": "",
        })
    pd.DataFrame(assets).to_csv(output / "maintenance_assets.csv", index=False)
    work_orders = pd.DataFrame([{
        "work_order_reference": f"WO-2026-{i+1:04d}", "asset_id": f"MA-{i+1:03d}",
        "created_date": (pd.Timestamp("2026-07-01") + pd.offsets.Day(i)).date(),
        "status": ["Open", "In Progress", "Completed"][i % 3], "owner": "Maintenance Planning",
    } for i in range(12)])
    work_orders.to_csv(output / "work_orders.csv", index=False)
    history = pd.DataFrame([{
        "history_id": f"MH-{i+1:04d}", "asset_id": f"MA-{i % 48 + 1:03d}",
        "maintenance_date": (pd.Timestamp("2025-08-01") + pd.offsets.Day(i * 11)).date(),
        "maintenance_type": ["Inspection", "Preventive Service", "Corrective Repair"][i % 3],
        "finding": ["No defect found", "Wear within illustrative tolerance", "Component replaced"][i % 3],
        "downtime_hours": int(rng.integers(2, 30)),
    } for i in range(80)])
    history.to_csv(output / "maintenance_history.csv", index=False)


if __name__ == "__main__":
    generate_maintenance_data()

