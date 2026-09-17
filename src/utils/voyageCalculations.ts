import { VoyagePlan } from '../types/maritime';

export interface VoyageScenarioResult {
  eta: string;
  fuel: number;
  cost: number;
  waiting: number;
  co2: number;
}

export function scenario(
  voyage: VoyagePlan,
  speed: number,
  bunker: number,
  weather: number,
  berthDelay: number,
  load: number,
  efficiency: number
): VoyageScenarioResult {
  const safeSpeed = Math.max(speed, 1.0);
  const sailingHours = (voyage.remaining_distance_nm / safeSpeed) * weather;
  const currentSpeed = Math.max(voyage.current_speed_knots, 1.0);
  const baselineHours = Math.max(voyage.remaining_distance_nm / currentSpeed, 1.0);
  const baselineRate = voyage.predicted_fuel_tonnes / baselineHours;

  let fuel =
    baselineRate * sailingHours * Math.pow(safeSpeed / currentSpeed, 2) * load * efficiency;
  fuel = Math.max(fuel, 0);

  const waiting = Math.max(0.0, berthDelay);

  // Reference base: "2026-07-23T08:00:00Z"
  const baseTime = new Date('2026-07-23T08:00:00Z').getTime();
  const totalMs = (sailingHours + waiting) * 3600 * 1000;
  const etaDate = new Date(baseTime + totalMs);

  return {
    eta: etaDate.toISOString(),
    fuel,
    cost: fuel * bunker,
    waiting,
    co2: fuel * 3.114,
  };
}

export function voyageKpis(voyages: VoyagePlan[]): Record<string, string | number> {
  const delayed = voyages.filter((v) => new Date(v.predicted_eta) > new Date(v.planned_eta)).length;

  const savings = voyages.map((v) => Math.max(v.planned_fuel_tonnes - v.predicted_fuel_tonnes, 0));
  const totalSaving = savings.reduce((acc, s) => acc + s, 0);

  const costs = voyages.map((v, i) => savings[i] * v.bunker_price_usd_tonne);
  const totalCost = costs.reduce((acc, c) => acc + c, 0);

  const totalWaiting = voyages.reduce((acc, v) => acc + (v.estimated_waiting_hours || 0), 0);
  const co2Reduction = totalSaving * 3.114;

  return {
    'Active voyages': voyages.length,
    'Delayed voyages': delayed,
    'Fuel-saving opportunity': `${totalSaving.toFixed(1)} t`,
    'Estimated cost saving': `$${Math.round(totalCost).toLocaleString()}`,
    'Avoidable waiting time': `${totalWaiting.toFixed(1)} h`,
    'Estimated CO₂ reduction': `${co2Reduction.toFixed(1)} t`,
  };
}
