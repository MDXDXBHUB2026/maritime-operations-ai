import { AgentKind, AuditEvent, Decision } from '../types/decisions';
import { apiGet, apiPost } from './apiClient';
import { DataConfig, resolveDataConfig } from './config';

/**
 * Client for backend decision support (API mode only).
 * Agents propose; a named human reviews, approves or rejects. Nothing here executes
 * operational actions — execution is performed (and currently simulated) by the backend.
 */
export function createDecisionService(config: DataConfig, fetchImpl?: typeof fetch) {
  const base = config.apiBaseUrl;
  const ensureApiMode = () => {
    if (config.mode !== 'api') {
      throw new Error('Decision support requires VITE_DATA_MODE=api and a running backend.');
    }
  };
  const id = (value: string) => encodeURIComponent(value);
  const post = (path: string, body: unknown) => {
    ensureApiMode();
    return apiPost<Decision>(base, path, body, fetchImpl);
  };

  return {
    isAvailable: () => config.mode === 'api',
    generate: (agent: AgentKind, entityId: string, requestedBy?: string): Promise<Decision> =>
      post(`/decisions/${agent}/${id(entityId)}`, requestedBy ? { requested_by: requestedBy } : {}),
    get: (decisionId: string): Promise<Decision> => {
      ensureApiMode();
      return apiGet<Decision>(base, `/decisions/${id(decisionId)}`, fetchImpl);
    },
    review: (decisionId: string, actor: string, comment?: string): Promise<Decision> =>
      post(`/decisions/${id(decisionId)}/review`, { actor, comment }),
    approve: (decisionId: string, actor: string, comment?: string): Promise<Decision> =>
      post(`/decisions/${id(decisionId)}/approve`, { actor, comment }),
    reject: (decisionId: string, actor: string, reason: string): Promise<Decision> =>
      post(`/decisions/${id(decisionId)}/reject`, { actor, reason }),
    listAuditEvents: (decisionId?: string): Promise<AuditEvent[]> => {
      ensureApiMode();
      const query = decisionId ? `?decision_id=${id(decisionId)}` : '';
      return apiGet<AuditEvent[]>(base, `/audit-events${query}`, fetchImpl);
    },
  };
}

export const DecisionService = createDecisionService(resolveDataConfig());
