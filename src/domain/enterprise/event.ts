export type EnterpriseEventType =
  | 'TASK_CREATED'
  | 'TASK_PLANNED'
  | 'TASK_ASSIGNED'
  | 'TASK_STARTED'
  | 'TOOL_REQUESTED'
  | 'TOOL_SUCCEEDED'
  | 'TOOL_FAILED'
  | 'RECOMMENDATION_CREATED'
  | 'APPROVAL_REQUESTED'
  | 'APPROVAL_GRANTED'
  | 'APPROVAL_REJECTED'
  | 'POLICY_BLOCKED'
  | 'FINDING_CREATED'
  | 'TASK_ESCALATED'
  | 'TASK_COMPLETED'
  | 'TASK_FAILED'
  | 'AGENT_PAUSED'
  | 'AGENT_RESUMED'
  | 'TOOL_DISABLED'
  | 'TOOL_ENABLED'
  | 'HUMAN_OVERRIDE'
  | 'VERIFICATION_REQUESTED'
  | 'VERIFICATION_COMPLETED'
  | 'CAPABILITY_TOGGLED';

export interface EnterpriseEvent {
  eventId: string;
  eventType: EnterpriseEventType;
  actorId: string;
  actorName: string;
  departmentId: string;
  taskId?: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  escalatedTo?: string;
  timestamp: string;
  summary: string;
  details?: Record<string, unknown>;
}
