import { Severity } from './maritime';

export type AgentKind = 'anomaly' | 'maintenance' | 'voyage' | 'safety';

export type DecisionStatus =
  'PROPOSED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'CANCELLED';

export interface Evidence {
  source: string;
  record_id: string;
  field: string;
  value: unknown;
  note: string | null;
}

export interface RecommendedAction {
  action: string;
  category: string;
  safety_critical: boolean;
}

export interface AgentRecommendation {
  agent: AgentKind;
  entity_type: string;
  entity_id: string;
  severity: Severity;
  summary: string;
  rationale: string[];
  evidence: Evidence[];
  recommended_actions: RecommendedAction[];
  requires_human_approval: boolean;
  safety_critical: boolean;
  /** Null when no measurable basis exists; see confidence_basis. */
  confidence: number | null;
  confidence_basis: string;
  provider: string;
  provider_fallback_used: boolean;
}

export interface Decision {
  recommendation_id: string;
  status: DecisionStatus;
  agent: AgentKind;
  entity_type: string;
  entity_id: string;
  severity: Severity;
  summary: string;
  requires_human_approval: boolean;
  safety_critical: boolean;
  recommendation: AgentRecommendation;
  created_at: string;
  updated_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_comment: string | null;
  executed_at: string | null;
  execution_result: Record<string, unknown> | null;
}

export interface AuditEvent {
  event_id: string;
  timestamp: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  previous_state: string | null;
  new_state: string | null;
  decision_id: string | null;
  human_approval: Record<string, unknown> | null;
  details: Record<string, unknown> | null;
}
