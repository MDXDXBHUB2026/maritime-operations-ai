import { ApiClient } from './apiClient';
import { AppConfig } from './config';

/**
 * Client for the backend decision-support workflow (API mode only).
 * Agents propose; a named human reviews/approves/rejects; execution is simulated in Phase 1.
 * Not yet wired into the UI - the existing localStorage workflows remain in place.
 */
export type DecisionDomain = 'anomaly' | 'maintenance' | 'voyage' | 'safety';
export type DecisionStatus =
  'PROPOSED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'CANCELLED';

export interface DecisionEvidence {
  source: string;
  reference: string;
  field: string;
  value: unknown;
  note?: string | null;
}

export interface DecisionAction {
  action: string;
  rationale: string;
  safety_critical: boolean;
}

export interface Decision {
  recommendation_id: string;
  agent: DecisionDomain;
  entity_type: string;
  entity_id: string;
  status: DecisionStatus;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  summary: string;
  rationale: string;
  evidence: DecisionEvidence[];
  recommended_actions: DecisionAction[];
  confidence: number | null;
  confidence_basis: string;
  requires_human_approval: boolean;
  safety_critical: boolean;
  provider: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  reviewed_by?: string | null;
  decided_by?: string | null;
  decided_at?: string | null;
  decision_comment?: string | null;
  execution_mode?: string | null;
}

export interface AuditEvent {
  event_id: string;
  timestamp: string;
  actor: string;
  action: string;
  entity_type: string;
  entity_id: string;
  previous_state: DecisionStatus | null;
  new_state: DecisionStatus | null;
  decision_id: string | null;
  human_approval: Record<string, unknown> | null;
  details: Record<string, unknown> | null;
}

function requireApiMode(): void {
  if (AppConfig.dataMode !== 'api') {
    throw new Error('Decision workflow requires VITE_DATA_MODE=api and a running backend.');
  }
}

export const DecisionService = {
  isAvailable: () => AppConfig.dataMode === 'api',
  generate: (domain: DecisionDomain, entityId: string, requestedBy: string) => {
    requireApiMode();
    return ApiClient.post<Decision>(`/decisions/${domain}/${encodeURIComponent(entityId)}`, {
      requested_by: requestedBy,
    });
  },
  get: (id: string) => {
    requireApiMode();
    return ApiClient.get<Decision>(`/decisions/${encodeURIComponent(id)}`);
  },
  review: (id: string, reviewer: string, comment?: string) => {
    requireApiMode();
    return ApiClient.post<Decision>(`/decisions/${encodeURIComponent(id)}/review`, {
      reviewer,
      comment,
    });
  },
  approve: (id: string, approver: string, comment?: string) => {
    requireApiMode();
    return ApiClient.post<Decision>(`/decisions/${encodeURIComponent(id)}/approve`, {
      approver,
      comment,
    });
  },
  reject: (id: string, approver: string, reason: string) => {
    requireApiMode();
    return ApiClient.post<Decision>(`/decisions/${encodeURIComponent(id)}/reject`, {
      approver,
      reason,
    });
  },
  auditEvents: (decisionId?: string) => {
    requireApiMode();
    const q = decisionId ? `?decision_id=${encodeURIComponent(decisionId)}` : '';
    return ApiClient.get<AuditEvent[]>(`/audit-events${q}`);
  },
};
