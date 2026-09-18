export interface AuditRecord {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: 'AGENT' | 'TASK' | 'APPROVAL' | 'CAPABILITY' | 'POLICY' | 'WORKFLOW';
  targetId: string;
  targetName: string;
  policyId?: string;
  beforeState?: string;
  afterState?: string;
  result: 'SUCCESS' | 'BLOCKED' | 'DENIED';
  reason?: string;
  source: 'SIMULATED_CONTROL_PANEL' | 'AUTOMATION_POLICY_GATE' | 'HUMAN_EXECUTIVE';
}
