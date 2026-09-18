import { describe, it, expect } from 'vitest';
import { PolicyService, TaskService } from '../../../src/services/enterprise';
import { Task } from '../../../src/domain/enterprise';

describe('Deterministic Governance Policies', () => {
  it('loads all standard governance policies', () => {
    const policies = PolicyService.getPolicies();
    expect(policies.length).toBeGreaterThanOrEqual(5);

    const highRiskPol = PolicyService.getPolicy('POL-HIGH-RISK-APPROVAL');
    expect(highRiskPol).toBeDefined();
    expect(highRiskPol?.enforcement).toBe('REQUIRE_APPROVAL');

    const execBlockPol = PolicyService.getPolicy('POL-CRITICAL-EXEC-BLOCK');
    expect(execBlockPol).toBeDefined();
    expect(execBlockPol?.enforcement).toBe('BLOCK');

    const lowConfPol = PolicyService.getPolicy('POL-LOW-CONFIDENCE-ESCALATE');
    expect(lowConfPol).toBeDefined();

    const maxRetryPol = PolicyService.getPolicy('POL-MAX-RETRY');
    expect(maxRetryPol).toBeDefined();
  });

  it('evaluates task with low confidence (< 0.75) as ESCALATE', () => {
    const syntheticTask: Task = {
      taskId: 'TASK-TEST-LOW-CONF',
      title: 'Low Confidence Route Test',
      description: 'Test low confidence scenario',
      category: 'Voyage',
      departmentId: 'DEPT-FLEET-OPS',
      createdBy: 'AGT-VOY-001',
      assignedTo: 'AGT-VOY-001',
      managerId: 'ACT-MGR-VOY',
      priority: 'MEDIUM',
      risk: 'LOW',
      status: 'RUNNING',
      deadline: '2026-07-25T00:00:00Z',
      confidence: 0.55, // Low confidence
      requiresApproval: false,
      approvalState: 'NONE',
      evidenceRefs: [],
      requiredCapabilities: [],
      verificationState: 'NONE',
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date().toISOString(),
    };

    const results = PolicyService.evaluateTask(syntheticTask);
    const escalateResult = results.find((r) => r.enforcement === 'ESCALATE');
    expect(escalateResult).toBeDefined();
    expect(escalateResult?.policyId).toBe('POL-LOW-CONFIDENCE-ESCALATE');
    expect(escalateResult?.reason).toContain('Confidence score (55%) is below mandatory 75% threshold');
  });

  it('evaluates CRITICAL risk task as BLOCK / human director authorization required', () => {
    const criticalTask: Task = {
      taskId: 'TASK-TEST-CRITICAL',
      title: 'Critical Emergency Override Test',
      description: 'Test critical risk scenario',
      category: 'Safety',
      departmentId: 'DEPT-SAFETY',
      createdBy: 'AGT-SAF-001',
      assignedTo: 'AGT-SAF-001',
      managerId: 'ACT-MGR-SAF',
      priority: 'URGENT',
      risk: 'CRITICAL',
      status: 'WAITING_APPROVAL',
      deadline: '2026-07-25T00:00:00Z',
      confidence: 0.95,
      requiresApproval: true,
      approvalState: 'PENDING',
      evidenceRefs: [],
      requiredCapabilities: [],
      verificationState: 'REQUESTED',
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date().toISOString(),
    };

    const results = PolicyService.evaluateTask(criticalTask);
    const blockResult = results.find((r) => r.enforcement === 'BLOCK');
    expect(blockResult).toBeDefined();
    expect(blockResult?.policyId).toBe('POL-CRITICAL-EXEC-BLOCK');
    expect(blockResult?.requiredApproverLevel).toBe('DIRECTOR');
  });

  it('evaluates HIGH risk task as REQUIRE_APPROVAL', () => {
    const highRiskTask = TaskService.getTask('TSK-MNT-301');
    expect(highRiskTask).toBeDefined();
    if (highRiskTask) {
      const results = PolicyService.evaluateTask(highRiskTask);
      const approvalResult = results.find((r) => r.enforcement === 'REQUIRE_APPROVAL');
      expect(approvalResult).toBeDefined();
      expect(approvalResult?.policyId).toBe('POL-HIGH-RISK-APPROVAL');
    }
  });
});
