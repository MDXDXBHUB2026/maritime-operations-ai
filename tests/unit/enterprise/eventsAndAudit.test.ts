import { describe, it, expect, beforeEach } from 'vitest';
import {
  EventService,
  AuditService,
  EnterpriseStorage,
  ApprovalService,
} from '../../../src/services/enterprise';

describe('Centralized Event Layer & Immutable Audit Trail', () => {
  beforeEach(() => {
    EnterpriseStorage.resetAll();
  });

  it('publishes and retrieves enterprise events with structured payload', () => {
    const initialCount = EventService.getEvents().length;

    EventService.publish({
      eventType: 'RECOMMENDATION_CREATED',
      actorId: 'AGT-VOY-001',
      actorName: 'Voyage Optimisation Agent',
      departmentId: 'DEPT-FLEET-OPS',
      taskId: 'TSK-VOY-201',
      severity: 'LOW',
      summary: 'Synthetic test voyage route recommendation generated',
    });

    const events = EventService.getEvents();
    expect(events.length).toBe(initialCount + 1);

    const latest = events[0];
    expect(latest.eventType).toBe('RECOMMENDATION_CREATED');
    expect(latest.actorName).toBe('Voyage Optimisation Agent');
    expect(latest.summary).toContain('Synthetic test voyage');
  });

  it('filters events by department and event type', () => {
    const fleetEvents = EventService.getEvents({ departmentId: 'DEPT-FLEET-OPS' });
    expect(fleetEvents.every((e) => e.departmentId === 'DEPT-FLEET-OPS')).toBe(true);

    const taskStartedEvents = EventService.getEvents({
      eventType: 'TASK_STARTED',
    });
    expect(taskStartedEvents.every((e) => e.eventType === 'TASK_STARTED')).toBe(true);
  });

  it('creates immutable audit records when approval decisions are made', () => {
    const initialAuditCount = AuditService.getAuditTrail().length;

    // Approve APP-2026-001
    ApprovalService.approve(
      'APP-2026-001',
      'ACT-MGR-TEC',
      'Henrik Lindqvist',
      'Authorised synthetic maintenance work order'
    );

    const updatedAudits = AuditService.getAuditTrail();
    expect(updatedAudits.length).toBeGreaterThan(initialAuditCount);

    const latestAudit = updatedAudits[0];
    expect(latestAudit.action).toBe('APPROVE_HIGH_RISK');
    expect(latestAudit.actorName).toBe('Henrik Lindqvist');
    expect(latestAudit.source).toBe('SIMULATED_CONTROL_PANEL');
  });

  it('records audit events for task reassignments and priority changes', () => {
    AuditService.record({
      action: 'CHANGE_TASK_PRIORITY',
      actorId: 'ACT-DIR-OPS',
      actorName: 'Sarah Jenkins',
      target: 'TSK-VOY-201',
      targetType: 'TASK',
      targetId: 'TSK-VOY-201',
      beforeState: 'MEDIUM',
      afterState: 'HIGH',
      result: 'SUCCESS',
      source: 'SIMULATED_CONTROL_PANEL',
    });

    const records = AuditService.getAuditTrail();
    const match = records.find((r) => r.action === 'CHANGE_TASK_PRIORITY');
    expect(match).toBeDefined();
    expect(match?.actorName).toBe('Sarah Jenkins');
    expect(match?.targetId).toBe('TSK-VOY-201');
  });
});
