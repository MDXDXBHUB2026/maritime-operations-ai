import { ApiClient } from './apiClient';
import { AppConfig } from './config';

/**
 * Client for the backend decision-support workflow (API mode only).
 * Agents propose; a named human reviews/approves/rejects; execution is simulated in Phase 1.
 * Used by the AI Decision Support panels and the AI Decision Centre. The existing
 * localStorage operator workflows remain in place alongside it.
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
  site_id?: string | null;
  site_name?: string | null;
  created_by: string;
  created_by_role?: string | null;
  created_by_user_id?: string | null;
  created_at: string;
  updated_at: string;
  reviewed_by?: string | null;
  decided_by?: string | null;
  decided_by_role?: string | null;
  decided_at?: string | null;
  decision_comment?: string | null;
  execution_mode?: string | null;
}

export interface AuditEvent {
  event_id: string;
  timestamp: string;
  actor: string;
  actor_user_id?: string | null;
  actor_role?: string | null;
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

export interface BackendHealth {
  status: string;
  version: string;
  database: string;
  data_source: string;
  ai_provider: string;
  ai_provider_available: boolean;
}

export interface DecisionQuery {
  entityId?: string;
  status?: DecisionStatus;
  agent?: DecisionDomain;
  limit?: number;
}

function toQuery(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v));
  }
  const text = q.toString();
  return text ? `?${text}` : '';
}

export const DecisionService = {
  isAvailable: () => AppConfig.dataMode === 'api',
  generate: (domain: DecisionDomain, entityId: string) => {
    requireApiMode();
    return ApiClient.post<Decision>(`/decisions/${domain}/${encodeURIComponent(entityId)}`);
  },
  health: () => {
    requireApiMode();
    return ApiClient.get<BackendHealth>('/health');
  },
  list: (query: DecisionQuery = {}) => {
    requireApiMode();
    return ApiClient.get<Decision[]>(
      `/decisions${toQuery({ entity_id: query.entityId, status: query.status, agent: query.agent, limit: query.limit })}`
    );
  },
  get: (id: string) => {
    requireApiMode();
    return ApiClient.get<Decision>(`/decisions/${encodeURIComponent(id)}`);
  },
  review: (id: string, comment?: string) => {
    requireApiMode();
    return ApiClient.post<Decision>(`/decisions/${encodeURIComponent(id)}/review`, { comment });
  },
  approve: (id: string, comment?: string) => {
    requireApiMode();
    return ApiClient.post<Decision>(`/decisions/${encodeURIComponent(id)}/approve`, { comment });
  },
  reject: (id: string, reason: string) => {
    requireApiMode();
    return ApiClient.post<Decision>(`/decisions/${encodeURIComponent(id)}/reject`, { reason });
  },
  execute: (id: string) => {
    requireApiMode();
    return ApiClient.post<Decision>(`/decisions/${encodeURIComponent(id)}/execute`);
  },
  cancel: (id: string, reason: string) => {
    requireApiMode();
    return ApiClient.post<Decision>(`/decisions/${encodeURIComponent(id)}/cancel`, { reason });
  },
  auditEvents: (decisionId?: string, limit?: number) => {
    requireApiMode();
    return ApiClient.get<AuditEvent[]>(
      `/audit-events${toQuery({ decision_id: decisionId, limit })}`
    );
  },
};
