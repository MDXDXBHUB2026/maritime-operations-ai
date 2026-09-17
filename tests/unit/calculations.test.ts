import { describe, it, expect } from 'vitest';
import { healthCategory, dashboardKpis } from '../../src/utils/calculations';
import { healthBand, fleetKpis } from '../../src/utils/fleetCalculations';
import { deviationPercentage, severityFromDeviation } from '../../src/utils/anomalyCalculations';
import { healthClass, maintenanceKpis } from '../../src/utils/maintenanceCalculations';
import { scenario, voyageKpis } from '../../src/utils/voyageCalculations';
import { safetyKpis } from '../../src/utils/safetyCalculations';
import { automationKpis } from '../../src/utils/automationCalculations';

describe('Calculations Unit Tests', () => {
  it('classifies health categories correctly', () => {
    expect(healthCategory(85)).toBe('Healthy');
    expect(healthCategory(80)).toBe('Healthy');
    expect(healthCategory(79)).toBe('Warning');
    expect(healthCategory(60)).toBe('Warning');
    expect(healthCategory(59)).toBe('Critical');
  });

  it('calculates fleet health bands correctly', () => {
    expect(healthBand(90)).toBe('Healthy');
    expect(healthBand(65)).toBe('Warning');
    expect(healthBand(40)).toBe('Critical');
  });

  it('calculates anomaly deviation and severity correctly', () => {
    expect(deviationPercentage(120, 100)).toBeCloseTo(20);
    expect(deviationPercentage(0, 0)).toBe(0);
    expect(severityFromDeviation(25)).toBe('Critical');
    expect(severityFromDeviation(19, true)).toBe('Critical');
    expect(severityFromDeviation(15)).toBe('High');
    expect(severityFromDeviation(8)).toBe('Medium');
    expect(severityFromDeviation(4)).toBe('Low');
  });

  it('calculates maintenance health class correctly', () => {
    expect(healthClass(85)).toBe('Healthy');
    expect(healthClass(75)).toBe('Warning');
    expect(healthClass(50)).toBe('Critical');
  });

  it('calculates voyage simulation scenario with exact formulas', () => {
    const mockVoyage = {
      voyage_id: 'VOY-001',
      vessel_id: 'VES-001',
      vessel_name: 'Pacific Pioneer',
      departure_port: 'Singapore',
      destination_port: 'Rotterdam',
      departure_time: '2026-07-20T08:00:00Z',
      planned_eta: '2026-08-10T12:00:00Z',
      predicted_eta: '2026-08-10T14:00:00Z',
      route_distance_nm: 8400,
      remaining_distance_nm: 4200,
      planned_speed_knots: 14.0,
      current_speed_knots: 13.5,
      recommended_speed_knots: 13.0,
      planned_fuel_tonnes: 850,
      predicted_fuel_tonnes: 830,
      bunker_price_usd_tonne: 650,
      weather_risk: 'Medium',
      sea_state: 'Moderate',
      wind_factor: 1.05,
      berth_availability_time: '2026-08-10T10:00:00Z',
      estimated_waiting_hours: 4.0,
      estimated_co2_tonnes: 2580,
      optimisation_status: 'Under Review',
      origin_latitude: 1.29,
      origin_longitude: 103.85,
      destination_latitude: 51.95,
      destination_longitude: 4.14,
    };

    const res = scenario(mockVoyage, 13.0, 650, 1.05, 4.0, 1.0, 0.98);
    expect(res.fuel).toBeGreaterThan(0);
    expect(res.cost).toBeCloseTo(res.fuel * 650);
    expect(res.co2).toBeCloseTo(res.fuel * 3.114);
    expect(res.waiting).toBe(4.0);
    expect(res.eta).toContain('2026-08');
  });
});
