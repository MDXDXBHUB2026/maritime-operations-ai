import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  DATASET_REFERENCE_UTC,
  computeOffsetMs,
  rebaseRecords,
  rebaseTimestamp,
  relativeTime,
} from '../../src/services/simulationClock';
import { liveTelemetry, REPORT_INTERVAL_MS } from '../../src/services/liveTelemetry';
import { DecisionPanel } from '../../src/components/decisions/DecisionPanel';
import type { Vessel } from '../../src/types/maritime';

const HOUR = 3_600_000;

describe('Simulation clock rebasing', () => {
  it('uses whole-hour offsets from the dataset reference', () => {
    expect(computeOffsetMs(DATASET_REFERENCE_UTC)).toBe(0);
    expect(computeOffsetMs(DATASET_REFERENCE_UTC + 5.9 * HOUR)).toBe(5 * HOUR);
  });

  it('shifts date-times and dates while preserving their format', () => {
    const offset = 67 * 24 * HOUR + 3 * HOUR;
    expect(rebaseTimestamp('2026-07-23T08:00:00', offset)).toBe('2026-09-28T11:00:00');
    expect(rebaseTimestamp('2026-07-23T08:00', offset)).toBe('2026-09-28T11:00');
    expect(rebaseTimestamp('2026-07-23', offset)).toBe('2026-09-28');
    expect(rebaseTimestamp('VES-001', offset)).toBe('VES-001');
    expect(rebaseTimestamp('Jebel Ali', offset)).toBe('Jebel Ali');
  });

  it('preserves relative timing between records', () => {
    const offset = 1000 * HOUR;
    const [a] = rebaseRecords(
      [{ planned_eta: '2026-07-23T14:00:00', predicted_eta: '2026-07-23T18:00:00', speed: 12 }],
      offset
    );
    const diff = Date.parse(`${a.predicted_eta}Z`) - Date.parse(`${a.planned_eta}Z`);
    expect(diff).toBe(4 * HOUR);
    expect(a.speed).toBe(12);
  });

  it('formats relative times', () => {
    expect(relativeTime(0, 90 * 60_000)).toBe('1h 30m ago');
    expect(relativeTime(2 * 24 * HOUR + HOUR, 0)).toBe('in 2d 1h');
  });
});

describe('Simulated live telemetry', () => {
  const vessel = {
    vessel_id: 'VES-001',
    vessel_name: 'MV Test',
    operational_status: 'Underway',
    speed_knots: 15,
    engine_load_percentage: 76,
    fuel_consumption_tonnes_day: 34,
    latitude: 25,
    longitude: 55,
  } as Vessel;

  it('is deterministic and holds values between reports', () => {
    const t0 = liveTelemetry(vessel, 1_800_000_000_000);
    const again = liveTelemetry(vessel, 1_800_000_000_000);
    expect(again).toEqual(t0);
    const sameCycle = liveTelemetry(vessel, t0.last_report_ms + REPORT_INTERVAL_MS - 1);
    expect(sameCycle.speed_knots).toBe(t0.speed_knots);
    expect(t0.next_report_ms - t0.last_report_ms).toBe(REPORT_INTERVAL_MS);
  });

  it('stays within a plausible band of the baseline', () => {
    for (let i = 0; i < 200; i++) {
      const t = liveTelemetry(vessel, 1_800_000_000_000 + i * REPORT_INTERVAL_MS);
      expect(Math.abs(t.speed_knots - 15)).toBeLessThanOrEqual(0.5);
      expect(t.engine_load_percentage).toBeGreaterThanOrEqual(70);
      expect(t.engine_load_percentage).toBeLessThanOrEqual(82);
    }
  });

  it('does not invent movement for stationary vessels', () => {
    const t = liveTelemetry({ ...vessel, speed_knots: 0 }, 1_800_000_000_000);
    expect(t.underway).toBe(false);
    expect(t.speed_knots).toBe(0);
    expect(t.engine_load_percentage).toBe(76);
  });
});

describe('Decision panel', () => {
  it('explains API mode requirement in the static demo', () => {
    render(<DecisionPanel domain="anomaly" entityId="ANM-0001" entityLabel="ANM-0001" />);
    expect(screen.getByTestId('decision-panel-static')).toHaveTextContent('API mode');
  });
});
