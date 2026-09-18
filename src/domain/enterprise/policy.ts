export type PolicyEnforcement = 'BLOCK' | 'REQUIRE_APPROVAL' | 'ESCALATE' | 'NOTIFY';

export interface GovernancePolicy {
  id: string;
  name: string;
  category: 'RISK' | 'SECURITY' | 'QUALITY' | 'OPERATIONAL';
  enforcement: PolicyEnforcement;
  description: string;
  rulesSummary: string;
  isActive: boolean;
  minApprovalLevel?: 'MANAGER' | 'DIRECTOR' | 'EXECUTIVE';
}

export interface PolicyEvaluationResult {
  allowed: boolean;
  policyId: string;
  policyName: string;
  enforcement: 'ALLOW' | PolicyEnforcement;
  reason: string;
  requiredApproverLevel?: string;
}
