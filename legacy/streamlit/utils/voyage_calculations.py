"""Illustrative voyage and fuel scenario calculations."""

from __future__ import annotations

import pandas as pd


def scenario(voyage: pd.Series, speed: float, bunker: float, weather: float, berth_delay: float, load: float, efficiency: float) -> dict[str, float | pd.Timestamp]:
    speed = max(speed, 1.0)
    sailing_hours = voyage["remaining_distance_nm"] / speed * weather
    baseline_rate = voyage["predicted_fuel_tonnes"] / max(voyage["remaining_distance_nm"] / voyage["current_speed_knots"], 1)
    fuel = baseline_rate * sailing_hours * (speed / voyage["current_speed_knots"]) ** 2 * load * efficiency
    fuel = max(fuel, 0)
    waiting = max(0.0, berth_delay)
    eta = pd.Timestamp("2026-07-23 08:00") + pd.to_timedelta(sailing_hours + waiting, unit="h")
    return {
        "eta": eta, "fuel": fuel, "cost": fuel * bunker, "waiting": waiting,
        "co2": fuel * 3.114,
    }


def voyage_kpis(voyages: pd.DataFrame) -> dict[str, str | int]:
    saving = (voyages["planned_fuel_tonnes"] - voyages["predicted_fuel_tonnes"]).clip(lower=0)
    cost = saving * voyages["bunker_price_usd_tonne"]
    return {
        "Active voyages": len(voyages),
        "Delayed voyages": int((voyages["predicted_eta"] > voyages["planned_eta"]).sum()),
        "Fuel-saving opportunity": f"{saving.sum():.1f} t",
        "Estimated cost saving": f"${cost.sum():,.0f}",
        "Avoidable waiting time": f"{voyages['estimated_waiting_hours'].sum():.1f} h",
        "Estimated CO₂ reduction": f"{(saving.sum() * 3.114):.1f} t",
    }

