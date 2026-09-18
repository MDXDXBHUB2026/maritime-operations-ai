import { GovernancePolicy, PolicyEvaluationResult, Task } from '../../domain/enterprise';
import { EnterpriseStorage } from './enterpriseStorage';

export interface IPolicyService {
  getPolicies(): GovernancePolicy[];
  getPolicy(id: string): GovernancePolicy | undefined;
  evaluateTask(task: Task): PolicyEvaluationResult[];
}

export const PolicyService: IPolicyService = {
  getPolicies: () => EnterpriseStorage.getPolicies(),

  getPolicy: (id) => EnterpriseStorage.getPolicies().find((p) => p.id === id),

  evaluateTask: (task) => {
    const policies = EnterpriseStorage.getPolicies().filter((p) => p.isActive);
    const results: PolicyEvaluationResult[] = [];

    for (const policy of policies) {
      if (policy.id === 'POL-CRITICAL-EXEC-BLOCK') {
        if (task.risk === 'CRITICAL') {
          results.push({
            allowed: false,
            policyId: policy.id,
            policyName: policy.name,
            enforcement: 'BLOCK',
            reason:
              'Critical task risk prohibits autonomous execution. Requires Director or Executive authorization + Independent Verification sign-off.',
            requiredApproverLevel: 'DIRECTOR',
          });
        }
      } else if (policy.id === 'POL-HIGH-RISK-APPROVAL') {
        if (task.risk === 'HIGH') {
          results.push({
            allowed: false,
            policyId: policy.id,
            policyName: policy.name,
            enforcement: 'REQUIRE_APPROVAL',
            reason: 'High-risk task requires human Manager or Director approval before execution.',
            requiredApproverLevel: 'MANAGER',
          });
        }
      } else if (policy.id === 'POL-LOW-CONFIDENCE-ESCALATE') {
        if (task.confidence < 0.75) {
          results.push({
            allowed: false,
            policyId: policy.id,
            policyName: policy.name,
            enforcement: 'ESCALATE',
            reason: `Confidence score (${(task.confidence * 100).toFixed(0)}%) is below mandatory 75% threshold.`,
            requiredApproverLevel: 'MANAGER',
          });
        }
      } else if (policy.id === 'POL-MAX-RETRY') {
        if (task.retryCount >= task.maxRetries) {
          results.push({
            allowed: false,
            policyId: policy.id,
            policyName: policy.name,
            enforcement: 'BLOCK',
            reason: `Task reached maximum retry limit (${task.retryCount}/${task.maxRetries}). Autonomous retries blocked.`,
            requiredApproverLevel: 'LEAD',
          });
        }
      }
    }

    if (results.length === 0) {
      results.push({
        allowed: true,
        policyId: 'POL-DEFAULT-ALLOW',
        policyName: 'Standard Automated Execution Allowed',
        enforcement: 'ALLOW',
        reason: 'All active deterministic governance checks passed.',
      });
    }

    return results;
  },
};
