import { AuthorityLevel, EntityType } from './organization';
import { OperationalMode } from './capability';

export type AgentStatus =
  | 'AVAILABLE'
  | 'ACTIVE'
  | 'WAITING'
  | 'WAITING_APPROVAL'
  | 'BLOCKED'
  | 'PAUSED'
  | 'DEGRADED'
  | 'OFFLINE'
  | 'ERROR';

export interface AgentTool {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
  isSimulated: boolean;
}

export interface AgentDecisionRecord {
  id: string;
  taskId: string;
  timestamp: string;
  decisionSummary: string;
  rationaleSummary: string;
  evidenceRefs: string[];
  toolCalls: string[];
  policyDecision: string;
  confidence: number;
}

export interface Agent {
  id: string;
  name: string;
  displayName: string;
  entityType: EntityType;
  role: string;
  departmentId: string;
  reportsTo: string; // Actor ID of direct supervisor/manager
  managerId: string; // Explicit human manager responsible for this agent
  status: AgentStatus;
  statusReason: string;
  authorityLevel: AuthorityLevel;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  operationalMode: OperationalMode;
  currentTaskId: string | null;
  requiredCapabilities: string[];
  optionalCapabilities: string[];
  tools: AgentTool[];
  health: number; // 0 - 100
  availability: number; // 0 - 100
  lastHeartbeat: string;
  lastActivity: string;
  tasksToday: number;
  tasksCompleted: number;
  tasksFailed: number;
  tasksEscalated: number;
  qualityScore: number; // 0 - 100
  confidenceScore: number; // 0.0 - 1.0
  slaPerformance: number; // percentage (e.g. 98.5)
  description: string;
  recentDecisions: AgentDecisionRecord[];
}
