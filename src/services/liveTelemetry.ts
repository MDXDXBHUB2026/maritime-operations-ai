import { useEffect, useState } from 'react';
import type { Vessel } from '../types/maritime';

/**
 * Simulated live telemetry.
 *
 * Each vessel "reports" on a fixed cadence (staggered per vessel, like AIS / noon-report feeds).
 * Between reports values are held constant; at each report speed, engine load and fuel rate move
 * within a small, physically plausible band around the dataset baseline. The output is
 * deterministic for a given vessel and time, so every viewer sees the same values.
 */

export const REPORT_INTERVAL_MS = 30_000;
const UNDERWAY_MIN_KNOTS = 0.5;

export interface LiveTelemetry {
  vessel_id: string;
  vessel_name: string;
  operational_status: string;
  underway: boolean;
  speed_knots: number;
  engine_load_percentage: number;
  fuel_consumption_tonnes_day: number;
  latitude: number;
  longitude: number;
  last_report_ms: number;
  next_report_ms: number;
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function round(value: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

export function liveTelemetry(vessel: Vessel, nowMs: number): LiveTelemetry {
  const seed = hash(vessel.vessel_id);
  const phaseMs = seed % REPORT_INTERVAL_MS;
  const lastReport =
    Math.floor((nowMs - phaseMs) / REPORT_INTERVAL_MS) * REPORT_INTERVAL_MS + phaseMs;
  const underway = vessel.speed_knots > UNDERWAY_MIN_KNOTS;

  // Slow oscillation (~6 min period) sampled at report time, plus a small per-report step.
  const t = lastReport / 1000;
  const wave = Math.sin((2 * Math.PI * t) / 360 + (seed % 628) / 100);
  const step = ((hash(`${vessel.vessel_id}:${lastReport}`) % 1000) / 1000 - 0.5) * 0.4;

  const speedFactor = underway ? 1 + 0.02 * wave + 0.005 * step : 1;
  const speed = underway
    ? round(Math.max(vessel.speed_knots * speedFactor, 0), 1)
    : vessel.speed_knots;
  const load = underway
    ? round(
        Math.min(Math.max(vessel.engine_load_percentage * (1 + 0.025 * wave) + step, 0), 100),
        0
      )
    : vessel.engine_load_percentage;
  // Fuel rate scales roughly with the cube of the speed ratio (propeller law).
  const fuel = underway
    ? round(vessel.fuel_consumption_tonnes_day * Math.pow(speedFactor, 3), 1)
    : vessel.fuel_consumption_tonnes_day;

  return {
    vessel_id: vessel.vessel_id,
    vessel_name: vessel.vessel_name,
    operational_status: vessel.operational_status,
    underway,
    speed_knots: speed,
    engine_load_percentage: load,
    fuel_consumption_tonnes_day: fuel,
    latitude: vessel.latitude,
    longitude: vessel.longitude,
    last_report_ms: lastReport,
    next_report_ms: lastReport + REPORT_INTERVAL_MS,
  };
}

/** Re-render on a fixed interval; returns the current wall-clock time in ms. */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
