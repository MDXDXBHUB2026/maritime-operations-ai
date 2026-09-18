import { TaskRisk } from './task';

export type ApprovalDecision =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'ESCALATED'
  | 'REANALYSIS_REQUESTED'
  | 'VERIFICATION_REQUESTED';

export interface ApprovalRequest {
  id: string;
  taskId: string;
  taskTitle: string;
  agentId: string;
  agentName: string;
  departmentId: string;
  approverId: string; // Target human manager or director
  approverRole: string;
  risk: TaskRisk;
  recommendedAction: string;
  reasonRequired: string;
  confidence: number;
  evidence: string[];
  policyId: string;
  policyName: string;
  impact: string;
  deadline: string;
  status: ApprovalDecision;
  createdAt: string;
  decidedBy?: string;
  decidedAt?: string;
  decisionComment?: string;
  requiresConfirmation: boolean;
}
