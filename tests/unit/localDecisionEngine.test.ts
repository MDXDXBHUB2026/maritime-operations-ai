import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const read = (name: string) =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../public/data/${name}.json`), 'utf-8'));

vi.mock('../../src/services/dataService', () => ({
  DataService: {
    getAnomalies: async () => read('anomalies'),
    getSensorReadings: async () => read('sensor_readings'),
    getMaintenanceAssets: async () => read('maintenance_assets'),
    getMaintenanceHistory: async () => read('maintenance_history'),
    getVoyagePlans: async () => read('voyage_plans'),
    getSafetyEvents: async () => read('safety_events'),
  },
}));

import { DEMO_PERSONAS, LocalDecisionEngine } from '../../src/services/localDecisionEngine';

const persona = (id: string) => DEMO_PERSONAS.find((p) => p.user_id === id)!;
const operator = persona('demo-operator');
const hse = persona('demo-hse');
const master = persona('demo-master');
const techSupt = persona('demo-tech-supt');
const viewer = persona('demo-viewer');

const safetyEvent = (read('safety_events') as { event_id: string; status: string }[]).find(
  (e) => e.status.toLowerCase() !== 'closed'
)!;

describe('In-browser decision engine (static demo)', () => {
  beforeEach(() => LocalDecisionEngine.reset());

  it('proposes an evidence-backed recommendation and audits it', async () => {
    const d = await LocalDecisionEngine.generate('safety', safetyEvent.event_id, operator);
    expect(d.status).toBe('PROPOSED');
    expect(d.safety_critical).toBe(true);
    expect(d.evidence.length).toBeGreaterThan(0);
    expect(d.rationale).toContain('requires human review');
    const events = await LocalDecisionEngine.auditEvents(d.recommendation_id);
    expect(events.map((e) => e.action)).toEqual(['RECOMMENDATION_CREATED']);
  });

  it('enforces role authority, the four-eyes rule and approval before execution', async () => {
    const d = await LocalDecisionEngine.generate('safety', safetyEvent.event_id, hse);
    const id = d.recommendation_id;
    await expect(LocalDecisionEngine.approve(id, operator)).rejects.toThrow(/requires/);
    await expect(LocalDecisionEngine.approve(id, techSupt)).rejects.toThrow(/requires/);
    await expect(LocalDecisionEngine.approve(id, hse)).rejects.toThrow(/Four-eyes/);
    await expect(LocalDecisionEngine.execute(id, master)).rejects.toThrow(/approval/);
    const approved = await LocalDecisionEngine.approve(id, master, 'Controls verified');
    expect(approved.status).toBe('APPROVED');
    expect(approved.decided_by).toBe(master.display_name);
    const executed = await LocalDecisionEngine.execute(id, master);
    expect(executed.status).toBe('EXECUTED');
    expect(executed.execution_mode).toBe('simulated');
    await expect(LocalDecisionEngine.reject(id, master, 'too late')).rejects.toThrow(/Cannot move/);
    const actions = (await LocalDecisionEngine.auditEvents(id)).map((e) => e.action);
    expect(actions).toEqual(['RECOMMENDATION_CREATED', 'APPROVED', 'EXECUTED_SIMULATED']);
  });

  it('requires a reason to reject and keeps viewers read-only', async () => {
    await expect(
      LocalDecisionEngine.generate('safety', safetyEvent.event_id, viewer)
    ).rejects.toThrow(/cannot request/);
    const d = await LocalDecisionEngine.generate('safety', safetyEvent.event_id, operator);
    await expect(LocalDecisionEngine.review(d.recommendation_id, viewer)).rejects.toThrow(
      /read-only/
    );
    await expect(LocalDecisionEngine.reject(d.recommendation_id, hse, ' ')).rejects.toThrow(
      /reason/
    );
    const rejected = await LocalDecisionEngine.reject(d.recommendation_id, hse, 'Duplicate event');
    expect(rejected.status).toBe('REJECTED');
  });

  it('runs every specialist agent on the dataset', async () => {
    const anomaly = read('anomalies')[0].anomaly_id;
    const asset = read('maintenance_assets')[0].asset_id;
    const voyage = read('voyage_plans')[0].voyage_id;
    for (const [domain, id] of [
      ['anomaly', anomaly],
      ['maintenance', asset],
      ['voyage', voyage],
    ] as const) {
      const d = await LocalDecisionEngine.generate(domain, id, operator);
      expect(d.agent).toBe(domain);
      expect(d.recommended_actions.length).toBeGreaterThan(0);
      expect(['Low', 'Medium', 'High', 'Critical']).toContain(d.severity);
    }
    expect((await LocalDecisionEngine.list()).length).toBe(3);
  });

  it('fails clearly for an unknown record', async () => {
    await expect(LocalDecisionEngine.generate('anomaly', 'ANM-9999', operator)).rejects.toThrow(
      /not found/
    );
  });
});
