"""Generate synthetic voyage, fuel and weather-route datasets."""

from __future__ import annotations

from pathlib import Path
import pandas as pd


def generate_voyage_data(output_dir: str | Path = "data") -> None:
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    names = ["MV Horizon Star", "MV Ocean Crest", "MV Meridian", "MV Blue Mariner", "MV Atlas Wind", "MV Gulf Pioneer", "MV Seaway Pearl", "MV Eastern Venture"]
    ports = [("Sohar", "Jebel Ali"), ("Jebel Ali", "Khalifa Port"), ("Khalifa Port", "Singapore"), ("Muscat", "Salalah"), ("Mumbai", "Khor Fakkan"), ("Khor Fakkan", "Jeddah"), ("Singapore", "Sohar"), ("Kuwait", "Hamad Port")]
    coords = {"Sohar": (24.35, 56.74), "Jebel Ali": (24.99, 55.05), "Khalifa Port": (24.80, 54.65), "Singapore": (1.26, 103.84), "Muscat": (23.61, 58.59), "Salalah": (16.95, 54.00), "Mumbai": (19.08, 72.88), "Khor Fakkan": (25.35, 56.36), "Jeddah": (21.49, 39.17), "Kuwait": (29.38, 48.00), "Hamad Port": (25.02, 51.61)}
    rows = []
    weather = []
    fuel = []
    base = pd.Timestamp("2026-07-23 08:00")
    for i, name in enumerate(names):
        origin, destination = ports[i]
        planned = base + pd.offsets.Hour(30 + i * 9)
        predicted = planned + pd.offsets.Hour([-2, 5, 0, 8, 3, -1, 6, 2][i])
        planned_fuel = [124, 96, 310, 118, 182, 220, 275, 104][i]
        predicted_fuel = round(planned_fuel * [0.96, 1.05, 0.98, 1.09, 1.03, 0.95, 1.06, 0.99][i], 1)
        rows.append({
            "voyage_id": f"VP-{2601+i}", "vessel_id": f"VES-{i+1:03d}", "vessel_name": name,
            "departure_port": origin, "destination_port": destination, "departure_time": (base - pd.offsets.Hour(12+i)).isoformat(),
            "planned_eta": planned.isoformat(), "predicted_eta": predicted.isoformat(), "route_distance_nm": [280, 160, 3400, 520, 980, 1700, 3600, 420][i],
            "remaining_distance_nm": [190, 70, 2610, 410, 620, 1320, 2900, 250][i], "planned_speed_knots": [15, 14, 16, 13, 14.5, 15.5, 16, 14][i],
            "current_speed_knots": [15.2, 13.5, 16.1, 12.2, 14, 15.8, 15.1, 14.2][i],
            "recommended_speed_knots": [14.6, 14.2, 15.5, 12.8, 14.3, 15.0, 15.4, 13.8][i],
            "planned_fuel_tonnes": planned_fuel, "predicted_fuel_tonnes": predicted_fuel, "bunker_price_usd_tonne": 640 + i * 7,
            "weather_risk": ["Low", "Medium", "Low", "High", "Medium", "Low", "High", "Medium"][i], "sea_state": [2,3,2,5,4,2,5,3][i],
            "wind_factor": [1.0,1.08,0.98,1.2,1.1,0.96,1.18,1.05][i], "berth_availability_time": (predicted + pd.offsets.Hour(i % 4)).isoformat(),
            "estimated_waiting_hours": [0,4,1,7,3,0,6,2][i], "estimated_co2_tonnes": round(predicted_fuel * 3.114, 1),
            "optimisation_status": ["Recommended", "Under Review", "Recommended", "New", "Under Review", "Implemented", "New", "Recommended"][i],
            "origin_latitude": coords[origin][0], "origin_longitude": coords[origin][1],
            "destination_latitude": coords[destination][0], "destination_longitude": coords[destination][1],
        })
        fuel.append({"voyage_id": f"VP-{2601+i}", "planned_fuel_tonnes": planned_fuel, "predicted_fuel_tonnes": predicted_fuel, "potential_saving_tonnes": round(max(0, planned_fuel-predicted_fuel),1)})
        weather.append({"voyage_id": f"VP-{2601+i}", "weather_risk": rows[-1]["weather_risk"], "sea_state": rows[-1]["sea_state"], "wind_factor": rows[-1]["wind_factor"]})
    pd.DataFrame(rows).to_csv(output / "voyage_plans.csv", index=False)
    pd.DataFrame(fuel).to_csv(output / "fuel_performance.csv", index=False)
    pd.DataFrame(weather).to_csv(output / "weather_routes.csv", index=False)


if __name__ == "__main__":
    generate_voyage_data()

