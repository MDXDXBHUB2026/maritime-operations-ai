"""Generate deterministic, realistic-looking fictional maritime datasets."""

from __future__ import annotations

from pathlib import Path
import random

import numpy as np
import pandas as pd


SEED = 42


def generate_data(output_dir: str | Path = "data") -> None:
    """Create all CSV inputs. Data is synthetic and reproducible."""
    random.seed(SEED)
    rng = np.random.default_rng(SEED)
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)

    vessel_names = [
        "MV Horizon Star", "MV Ocean Crest", "MV Meridian", "MV Blue Mariner",
        "MV Atlas Wind", "MV Gulf Pioneer", "MV Seaway Pearl", "MV Northern Light",
        "MV Coral Bridge", "MV Eastern Venture",
    ]
    vessel_types = ["Container Vessel", "Container Vessel", "Bulk Carrier", "Tugboat", "Offshore Service Vessel", "Container Vessel", "Tugboat", "Bulk Carrier", "Offshore Service Vessel", "Container Vessel"]
    locations = [
        (25.24, 55.27, "Dubai Anchorage"), (24.99, 55.05, "Jebel Ali"),
        (26.28, 56.34, "Strait of Hormuz"), (23.61, 58.59, "Muscat"),
        (19.08, 72.88, "Mumbai"), (12.97, 80.24, "Chennai"),
        (1.26, 103.84, "Singapore"), (25.35, 56.36, "Khor Fakkan"),
        (21.49, 39.17, "Jeddah"), (29.38, 48.00, "Kuwait"),
    ]
    destinations = ["Jebel Ali", "Khalifa Port", "Singapore", "Salalah", "Khor Fakkan", "Mumbai", "Jeddah", "Sohar", "Port Klang", "Hamad Port"]
    statuses = ["Underway", "In Port", "Underway", "Delayed", "In Port", "Underway", "At Anchorage", "Under Maintenance", "In Port", "Off-Hire"]
    fuel_status = ["Optimal", "Watch", "Optimal", "Below target", "Optimal", "Watch", "Optimal", "Below target", "Optimal", "Watch"]
    risks = ["Low", "Medium", "Low", "Critical", "Low", "Medium", "Low", "High", "Low", "Medium"]
    now = pd.Timestamp("2026-07-22 08:00")
    departure_ports = ["Sohar", "Jebel Ali", "Khalifa Port", "Muscat", "Mumbai", "Khor Fakkan", "Singapore", "Jeddah", "Salalah", "Kuwait"]
    speeds = [15.8, 0.0, 13.9, 9.2, 0.0, 16.1, 5.8, 0.0, 0.0, 0.0]
    health = [91, 84, 88, 58, 82, 76, 86, 54, 93, 68]
    vessels = pd.DataFrame([
        {
            "vessel_id": f"VES-{i+1:03d}", "vessel_name": name, "vessel_type": vessel_types[i],
            "imo_identifier": f"IMO{9700100 + i * 37}",
            "operational_status": statuses[i], "current_location": locations[i][2],
            "departure_port": departure_ports[i], "destination_port": destinations[i],
            "latitude": locations[i][0], "longitude": locations[i][1], "destination": destinations[i],
            "speed_knots": speeds[i], "draft_metres": round(5.8 + i * 0.62, 1),
            "engine_load_percentage": [76, 12, 69, 88, 9, 81, 48, 5, 8, 3][i],
            "fuel_consumption_tonnes_day": [34.2, 5.1, 27.8, 14.6, 4.7, 36.4, 9.8, 3.2, 4.1, 2.8][i],
            "technical_health_score": health[i], "open_anomalies": [1, 0, 2, 4, 1, 3, 0, 5, 0, 2][i],
            "overdue_work_orders": [0, 0, 1, 2, 0, 1, 0, 3, 0, 1][i],
            "safety_risk_level": risks[i],
            "planned_eta": (now + pd.offsets.Hour(int(14 + i * 7))).isoformat(),
            "predicted_eta": (now + pd.Timedelta(hours=int(18 + i * 7))).isoformat(),
            "fuel_performance_status": fuel_status[i], "risk_level": risks[i],
            "voyage_status": ["On Schedule", "In Port", "On Schedule", "Delayed", "In Port", "Delayed", "On Schedule", "Maintenance", "In Port", "Off-Hire"][i],
        } for i, name in enumerate(vessel_names)
    ])
    vessels.to_csv(output / "vessels.csv", index=False)

    voyage_rows = []
    for i in range(6):
        planned_eta = now + pd.Timedelta(hours=int(30 + i * 13))
        delay_hours = [-2, 5, 0, 9, -1, 4][i]
        planned_fuel = [128, 154, 212, 96, 177, 143][i]
        actual_fuel = [124, 163, 207, 104, 173, 151][i]
        voyage_rows.append({
            "voyage_id": f"VOY-{2401+i}", "vessel_name": vessel_names[i],
            "origin": locations[i][2], "destination": destinations[i],
            "planned_fuel_tonnes": planned_fuel, "actual_fuel_tonnes": actual_fuel,
            "planned_eta": planned_eta.isoformat(),
            "predicted_eta": (planned_eta + pd.Timedelta(hours=int(delay_hours))).isoformat(),
            "potential_fuel_saving_pct": [4.2, 6.8, 3.1, 8.5, 5.4, 7.2][i],
            "progress_pct": [72, 48, 84, 31, 66, 57][i],
        })
    pd.DataFrame(voyage_rows).to_csv(output / "voyages.csv", index=False)

    equipment_types = ["Ship-to-shore crane", "Rubber-tyred gantry", "Terminal tractor", "Reach stacker"]
    equipment_rows = []
    # Fixed score distribution guarantees all three categories are represented.
    scores = list(rng.integers(82, 99, 24)) + list(rng.integers(61, 79, 11)) + list(rng.integers(38, 59, 5))
    rng.shuffle(scores)
    for i in range(40):
        terminal = "North Container Terminal" if i < 20 else "South Container Terminal"
        score = int(scores[i])
        equipment_rows.append({
            "asset_id": f"EQ-{i+1:03d}", "asset_name": f"{equipment_types[i % 4]} {i+1:02d}",
            "equipment_type": equipment_types[i % 4], "terminal": terminal,
            "health_score": score,
            "predicted_failure_days": int(rng.integers(8, 29)) if score < 60 else int(rng.integers(35, 180)),
            "maintenance_due_days": int(rng.integers(-4, 60)),
            "maintenance_status": random.choice(["Scheduled", "Open", "Complete", "Monitoring"]),
            "operating_hours": int(rng.integers(1200, 14800)),
        })
    pd.DataFrame(equipment_rows).to_csv(output / "equipment.csv", index=False)

    alert_specs = [
        ("ALT-001", "Critical", "Predictive Maintenance", "Ship-to-shore crane 08", "Hoist motor temperature trend exceeds limit", "Bearing degradation", "Schedule controlled shutdown and inspect bearing", "Maintenance Lead", "Open"),
        ("ALT-002", "High", "Fleet", "MV Blue Mariner", "Fuel consumption is 8.3% above voyage plan", "Adverse current and hull resistance", "Review speed profile and trim settings", "Fleet Performance", "Under Review"),
        ("ALT-003", "Critical", "Safety Monitoring", "South Container Terminal", "Restricted-zone proximity event detected", "Temporary route obstruction", "Secure area and complete supervisor review", "Safety Manager", "Open"),
        ("ALT-004", "Medium", "Voyage Optimisation", "MV Ocean Crest", "Predicted arrival is five hours behind plan", "Port congestion and headwinds", "Assess revised arrival slot", "Voyage Manager", "Acknowledged"),
        ("ALT-005", "High", "Predictive Maintenance", "Rubber-tyred gantry 26", "Hydraulic pressure variance increasing", "Seal wear", "Inspect hydraulic circuit within 24 hours", "Unassigned", "Open"),
        ("ALT-006", "Low", "Fleet", "MV Gulf Pioneer", "Auxiliary engine load imbalance", "Uneven hotel load", "Monitor and rebalance loads", "Chief Engineer", "Monitoring"),
        ("ALT-007", "High", "Safety Monitoring", "North Container Terminal", "Repeated pedestrian-route deviation", "Wayfinding barrier displaced", "Restore barrier and brief shift team", "Shift Supervisor", "Under Review"),
        ("ALT-008", "Medium", "Automation Centre", "Terminal tractor 15", "Telematics feed intermittent", "Weak network coverage", "Check antenna and access-point coverage", "IT Operations", "Open"),
    ]
    alerts = pd.DataFrame(alert_specs, columns=["alert_id", "severity", "module", "asset", "description", "probable_cause", "recommended_action", "owner", "status"])
    alerts["created_at"] = [(now - pd.Timedelta(hours=int(h))).isoformat() for h in [2, 5, 7, 11, 15, 20, 26, 32]]
    alerts.to_csv(output / "alerts.csv", index=False)

    safety = pd.DataFrame([
        ("SAF-001", "High", "Restricted-zone proximity", "South Container Terminal", "Open", "Safety Manager"),
        ("SAF-002", "Medium", "PPE compliance observation", "North Container Terminal", "Under Review", "Shift Supervisor"),
        ("SAF-003", "Low", "Housekeeping observation", "Workshop A", "Closed", "Facilities Lead"),
        ("SAF-004", "High", "Pedestrian-route deviation", "North Container Terminal", "Under Review", "Shift Supervisor"),
        ("SAF-005", "Medium", "Mooring-area access observation", "Berth 4", "Open", "Marine Supervisor"),
        ("SAF-006", "Low", "Pre-start checklist coaching", "South Container Terminal", "Closed", "Operations Lead"),
    ], columns=["event_id", "risk_level", "event_type", "location", "status", "owner"])
    safety["event_date"] = pd.date_range("2026-07-16", periods=6, freq="D").astype(str)
    safety.to_csv(output / "safety_events.csv", index=False)


if __name__ == "__main__":
    generate_data()
