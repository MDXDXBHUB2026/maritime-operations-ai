export type TaskStatus =
  | 'CREATED'
  | 'PLANNED'
  | 'ASSIGNED'
  | 'RUNNING'
  | 'WAITING_APPROVAL'
  | 'BLOCKED'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'ESCALATED';

export type TaskRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type ApprovalState = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'ESCALATED';

export type VerificationState = 'NONE' | 'REQUESTED' | 'VERIFIED' | 'FAILED';

export interface Task {
  taskId: string;
  title: string;
  description: string;
  category: string;
  departmentId: string;
  createdBy: string; // Actor ID who initiated or requested
  assignedTo: string; // Agent ID actively executing
  managerId: string; // Responsible Human Manager ID
  priority: TaskPriority;
  risk: TaskRisk;
  status: TaskStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  deadline: string;
  confidence: number; // 0.0 - 1.0
  requiresApproval: boolean;
  approvalState: ApprovalState;
  approvalId?: string;
  evidenceRefs: string[];
  relatedVessel?: string;
  relatedAsset?: string;
  relatedVoyage?: string;
  relatedAlert?: string;
  relatedFinding?: string;
  requiredCapabilities: string[];
  verificationState: VerificationState;
  resultSummary?: string;
  decisionSummary?: string;
  rationaleSummary?: string;
  policyDecision?: string;
  retryCount: number;
  maxRetries: number;
}
