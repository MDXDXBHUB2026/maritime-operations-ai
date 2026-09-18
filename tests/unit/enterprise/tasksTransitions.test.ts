import { describe, it, expect, beforeEach } from 'vitest';
import { TaskService, EnterpriseStorage, AgentService } from '../../../src/services/enterprise';

describe('Task Lifecycle & Operational State Transitions', () => {
  beforeEach(() => {
    EnterpriseStorage.resetAll();
  });

  it('allows requesting independent verification on an eligible task', () => {
    const task = TaskService.getTask('TSK-MNT-301');
    expect(task).toBeDefined();

    const updated = TaskService.requestVerification('TSK-MNT-301');
    expect(updated).toBeDefined();
    expect(updated?.status).toBe('VERIFYING');
    expect(updated?.verificationState).toBe('REQUESTED');

    const fresh = TaskService.getTask('TSK-MNT-301');
    expect(fresh?.status).toBe('VERIFYING');
  });

  it('allows escalating a task and transitions status to ESCALATED', () => {
    const task = TaskService.escalateTask('TSK-MNT-301', 'Critical temperature anomaly exceeding safe limits');
    expect(task).toBeDefined();
    expect(task?.status).toBe('ESCALATED');

    const fresh = TaskService.getTask('TSK-MNT-301');
    expect(fresh?.status).toBe('ESCALATED');
  });

  it('enforces maximum retry policy by blocking task after limit exceeded', () => {
    const task = TaskService.getTask('TSK-MNT-301');
    expect(task).toBeDefined();

    // 1st retry: retryCount -> 1
    const r1 = TaskService.requestRetry('TSK-MNT-301');
    expect(r1?.retryCount).toBe(1);
    expect(r1?.status).toBe('RUNNING');

    // 2nd retry: retryCount -> 2
    const r2 = TaskService.requestRetry('TSK-MNT-301');
    expect(r2?.retryCount).toBe(2);

    // 3rd retry: retryCount -> 3 (equals maxRetries 3)
    const r3 = TaskService.requestRetry('TSK-MNT-301');
    expect(r3?.retryCount).toBe(3);

    // 4th retry: exceeds maxRetries -> BLOCKED
    const r4 = TaskService.requestRetry('TSK-MNT-301');
    expect(r4?.status).toBe('BLOCKED');
  });

  it('allows reassigning a task to a different agent', () => {
    const original = TaskService.getTask('TSK-VOY-201');
    expect(original?.assignedTo).toBe('AGT-VOY-001');

    const reassigned = TaskService.reassignTask('TSK-VOY-201', 'AGT-VOY-002');
    expect(reassigned).toBeDefined();
    expect(reassigned?.assignedTo).toBe('AGT-VOY-002');

    const fresh = TaskService.getTask('TSK-VOY-201');
    expect(fresh?.assignedTo).toBe('AGT-VOY-002');
  });

  it('allows cancelling a task with a reason', () => {
    const cancelled = TaskService.cancelTask('TSK-VOY-201', 'Voyage route was manually aborted by master');
    expect(cancelled).toBeDefined();
    expect(cancelled?.status).toBe('CANCELLED');

    const fresh = TaskService.getTask('TSK-VOY-201');
    expect(fresh?.status).toBe('CANCELLED');
  });

  it('allows pausing and resuming an agent', () => {
    const agent = AgentService.getAgent('AGT-TEC-001');
    expect(agent).toBeDefined();

    const paused = AgentService.pauseAgent('AGT-TEC-001', 'Scheduled simulator maintenance');
    expect(paused).toBeDefined();
    expect(paused?.status).toBe('PAUSED');
    expect(paused?.statusReason).toBe('Scheduled simulator maintenance');

    const resumed = AgentService.resumeAgent('AGT-TEC-001');
    expect(resumed).toBeDefined();
    expect(resumed?.status).toBe('ACTIVE');
  });
});
