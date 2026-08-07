"""Generate deterministic fictional anomaly and sensor time-series data."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from utils.anomaly_calculations import deviation_percentage, severity_from_deviation


SEED = 73
BASE_TIME = pd.Timestamp("2026-07-22 16:00")

USE_CASES = {
    "Vessel Main Engine": {
        "parameters": {
            "Exhaust temperature (°C)": (390, 340, 450),
            "Jacket-water temperature (°C)": (82, 72, 92),
            "Vibration (mm/s)": (4.2, 0.0, 7.0),
            "Engine load (%)": (72, 35, 90),
            "Fuel consumption (t/day)": (31, 25, 38),
        },
        "causes": ["Fuel-injector imbalance", "Cooling-flow restriction", "Bearing wear trend"],
        "actions": ["Review engine trend and inspect at next safe opportunity", "Validate sensors and conduct machinery-space inspection"],
        "consequence": "Reduced propulsion efficiency or unplanned engine intervention",
    },
    "Vessel Fuel Performance": {
        "parameters": {
            "Actual fuel consumption (t/day)": (29, 24, 36),
            "Vessel speed (kn)": (15, 11, 19),
            "Draft (m)": (10.8, 8.0, 13.5),
            "Engine load (%)": (70, 35, 90),
            "Simulated weather factor": (1.0, 0.75, 1.25),
        },
        "causes": ["Adverse simulated weather factor", "Hull-resistance trend", "Speed-profile variance"],
        "actions": ["Review speed, trim and simulated weather assumptions", "Compare voyage baseline and validate fuel meters"],
        "consequence": "Higher voyage fuel consumption and arrival-plan variance",
    },
    "Quay Crane": {
        "parameters": {
            "Vibration (mm/s)": (3.5, 0.0, 6.5),
            "Hydraulic pressure (bar)": (215, 185, 245),
            "Motor temperature (°C)": (68, 40, 82),
            "Electrical current (A)": (310, 220, 380),
            "Hoist-cycle time (s)": (96, 75, 120),
        },
        "causes": ["Hoist-drive wear trend", "Hydraulic restriction", "Elevated duty cycle"],
        "actions": ["Inspect crane subsystem during the next controlled pause", "Validate instrumentation and review recent lift cycles"],
        "consequence": "Reduced crane availability or extended container cycle time",
    },
    "Reefer Container": {
        "parameters": {
            "Actual temperature (°C)": (-18, -22, -14),
            "Set-point temperature (°C)": (-18, -22, -14),
            "Supply-air temperature (°C)": (-19, -23, -15),
            "Return-air temperature (°C)": (-16, -20, -12),
            "Power status (%)": (100, 95, 100),
        },
        "causes": ["Door-seal leakage indication", "Airflow restriction", "Intermittent simulated power state"],
        "actions": ["Verify power and inspect reefer condition", "Check set point, airflow and door closure"],
        "consequence": "Potential cargo-temperature excursion if the condition persists",
    },
}


def generate_anomaly_data(output_dir: str | Path = "data") -> None:
    """Create at least 30 anomalies and 24-hour trends for every record."""
    rng = np.random.default_rng(SEED)
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    vessels = ["MV Horizon Star", "MV Ocean Crest", "MV Meridian", "MV Blue Mariner", "MV Atlas Wind", "MV Gulf Pioneer", "MV Seaway Pearl", "MV Northern Light", "MV Coral Bridge", "MV Eastern Venture"]
    terminals = ["North Container Terminal", "South Container Terminal"]
    statuses = ["New", "New", "Acknowledged", "Monitoring", "Inspection Initiated", "Closed", "New", "Acknowledged"]
    rows: list[dict] = []
    sensor_rows: list[dict] = []

    for category_index, (category, spec) in enumerate(USE_CASES.items()):
        parameter_items = list(spec["parameters"].items())
        for item_index in range(8):
            anomaly_number = category_index * 8 + item_index + 1
            anomaly_id = f"ANM-{anomaly_number:04d}"
            parameter, (expected, lower, upper) = parameter_items[item_index % len(parameter_items)]
            # Cover all severity bands predictably while retaining realistic variation.
            target_deviation = [3.8, 8.2, 14.5, 23.0, 10.5, 17.2, 26.0, 5.2][item_index]
            direction = -1 if (item_index + category_index) % 3 == 0 else 1
            current = expected * (1 + direction * target_deviation / 100)
            # Negative temperature baselines require a separate excursion direction.
            if expected < 0:
                current = expected + (abs(expected) * target_deviation / 100 * (1 if item_index % 2 else -1))
            current = round(float(current), 2)
            deviation = round(deviation_percentage(current, expected), 1)
            breach = current < lower or current > upper
            severity = severity_from_deviation(deviation, breach)

            if category.startswith("Vessel"):
                vessel_or_terminal = vessels[(item_index + category_index * 2) % len(vessels)]
                asset_id = f"ENG-{(item_index % 10) + 1:03d}" if category == "Vessel Main Engine" else f"VES-{(item_index % 10) + 1:03d}"
                asset_name = f"{vessel_or_terminal} Main Engine" if category == "Vessel Main Engine" else vessel_or_terminal
                location = "Engine Room" if category == "Vessel Main Engine" else "At sea — simulated route"
            elif category == "Quay Crane":
                vessel_or_terminal = terminals[item_index % 2]
                asset_id = f"QC-{item_index + 1:02d}"
                asset_name = f"Quay Crane {item_index + 1:02d}"
                location = f"Berth {(item_index % 4) + 1}"
            else:
                vessel_or_terminal = terminals[item_index % 2]
                asset_id = f"RF-{2600 + item_index}"
                asset_name = f"Reefer Container RF-{2600 + item_index}"
                location = f"Reefer Stack R{(item_index % 4) + 1}"

            detected = BASE_TIME - pd.offsets.Hour(int(item_index * 5 + category_index * 2))
            confidence = round(float(rng.uniform(78, 98)), 1)
            anomaly_type = ["Threshold breach", "Rate-of-change", "Baseline deviation", "Persistent drift"][item_index % 4]
            rows.append({
                "anomaly_id": anomaly_id, "detected_timestamp": detected.isoformat(),
                "asset_category": category, "asset_id": asset_id, "asset_name": asset_name,
                "location": location, "vessel_or_terminal": vessel_or_terminal,
                "parameter_name": parameter, "current_value": current, "expected_value": expected,
                "lower_threshold": lower, "upper_threshold": upper,
                "deviation_percentage": deviation, "severity": severity, "anomaly_type": anomaly_type,
                "probable_cause": spec["causes"][item_index % len(spec["causes"])],
                "confidence_score": confidence,
                "recommended_action": spec["actions"][item_index % len(spec["actions"])],
                "potential_consequence": spec["consequence"],
                "owner": "Unassigned" if item_index % 3 else "Digital Operations Analyst",
                "status": statuses[item_index], "work_order_reference": "",
            })

            trend_start = detected - pd.offsets.Hour(24)
            for hour in range(25):
                timestamp = trend_start + pd.offsets.Hour(hour)
                progress = hour / 24
                noise_scale = max(abs(expected) * 0.012, (upper - lower) * 0.012)
                actual = expected + rng.normal(0, noise_scale)
                # Build a transparent progressive divergence over the final six hours.
                if hour >= 18:
                    actual += (current - expected) * ((hour - 17) / 7)
                sensor_rows.append({
                    "anomaly_id": anomaly_id, "timestamp": timestamp.isoformat(),
                    "parameter_name": parameter, "actual_reading": round(float(actual), 3),
                    "expected_baseline": expected, "lower_threshold": lower, "upper_threshold": upper,
                    "is_detection_point": hour == 24,
                })

    pd.DataFrame(rows).to_csv(output / "anomalies.csv", index=False)
    pd.DataFrame(sensor_rows).to_csv(output / "sensor_readings.csv", index=False)


if __name__ == "__main__":
    generate_anomaly_data()
