"""Export SQLite / CSV datasets to public/data/*.json for GitHub Pages static serving."""

import json
from pathlib import Path
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
PUBLIC_DATA_DIR = PROJECT_ROOT / "public" / "data"

TABLES = [
    "vessels",
    "voyages",
    "equipment",
    "alerts",
    "anomalies",
    "sensor_readings",
    "maintenance_assets",
    "maintenance_history",
    "work_orders",
    "safety_events",
    "safety_observations",
    "corrective_actions",
    "automation_workflows",
    "automation_tasks",
    "approval_history",
    "voyage_plans",
    "fuel_performance",
    "weather_routes",
]

def export_all():
    PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)
    summary = {}
    for table in TABLES:
        csv_file = DATA_DIR / f"{table}.csv"
        if not csv_file.exists():
            print(f"Warning: {csv_file} does not exist.")
            continue
        df = pd.read_csv(csv_file)
        raw_records = df.to_dict(orient="records")
        records = []
        for r in raw_records:
            cleaned = {}
            for k, v in r.items():
                cleaned[k] = None if pd.isna(v) else v
            records.append(cleaned)
        out_file = PUBLIC_DATA_DIR / f"{table}.json"
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(records, f, indent=2)
        summary[table] = len(records)
        print(f"Exported {table}: {len(records)} records -> {out_file}")
    
    print("Data export complete:")
    for k, v in summary.items():
        print(f"  {k}: {v}")

if __name__ == "__main__":
    export_all()
