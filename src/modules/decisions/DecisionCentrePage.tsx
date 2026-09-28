import React, { useCallback, useEffect, useState } from 'react';
import { Bot, RefreshCw } from 'lucide-react';
import {
  DecisionService,
  type AuditEvent,
  type Decision,
  type DecisionStatus,
} from '../../services/decisionService';
import { MetricCard } from '../../components/common/MetricCard';
import {
  AuditTimeline,
  SeverityPill,
  StatusPill,
  confidenceText,
  formatUtc,
} from '../../components/decisions/decisionUi';

const STATUSES: DecisionStatus[] = [
  'PROPOSED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'EXECUTED',
  'CANCELLED',
];

/** Fleet-wide register of backend decisions and the audit trail (API mode). */
export const DecisionCentrePage: React.FC = () => {
  const apiMode = DecisionService.isAvailable();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [statusFilter, setStatusFilter] = useState<DecisionStatus | ''>('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [selectedAudit, setSelectedAudit] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!apiMode) return;
    setLoading(true);
    setError(null);
    try {
      const [list, events] = await Promise.all([
        DecisionService.list({ status: statusFilter || undefined, limit: 200 }),
        DecisionService.auditEvents(undefined, 50),
      ]);
      setDecisions(list);
      setAudit(events);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load decisions');
    } finally {
      setLoading(false);
    }
  }, [apiMode, statusFilter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!apiMode || !selectedId) return;
    DecisionService.auditEvents(selectedId)
      .then(setSelectedAudit)
      .catch(() => setSelectedAudit([]));
  }, [apiMode, selectedId]);

  const selected = decisions.find((d) => d.recommendation_id === selectedId) ?? null;
  const count = (s: DecisionStatus) => decisions.filter((d) => d.status === s).length;

  return (
    <div>
      <div className="eyebrow">Human-in-the-loop governance</div>
      <h1>AI Decision Centre</h1>
      <p className="subtitle">
        Recommendations proposed by the Manager Agent and its specialist agents, the human decisions
        taken on them, and the audit trail. Execution is simulated.
      </p>

      {!apiMode ? (
        <div className="card-panel decision-panel" data-testid="decision-centre-static">
          <h3>
            <Bot size={16} /> Backend required
          </h3>
          <div className="decision-note">
            The decision register is stored by the FastAPI backend. Run the backend and start the
            frontend with VITE_DATA_MODE=api to use it. The GitHub Pages demo runs without a
            backend, so this register is empty here.
          </div>
        </div>
      ) : (
        <>
          <div className="grid-4">
            <MetricCard label="Decisions loaded" value={decisions.length} badge="DB" />
            <MetricCard
              label="Awaiting decision"
              value={count('PROPOSED') + count('UNDER_REVIEW')}
              badge="DB"
            />
            <MetricCard
              label="Approved / executed"
              value={count('APPROVED') + count('EXECUTED')}
              badge="DB"
            />
            <MetricCard label="Rejected" value={count('REJECTED')} badge="DB" />
          </div>

          <div className="card-panel">
            <div className="live-panel-head">
              <h3>Decision Register</h3>
              <div className="decision-toolbar">
                <label>
                  Status
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as DecisionStatus | '')}
                    aria-label="Filter by status"
                  >
                    <option value="">All</option>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn" onClick={refresh} disabled={loading}>
                  <RefreshCw size={14} /> Refresh
                </button>
              </div>
            </div>
            {error && <div className="decision-msg-err">{error}</div>}
            {decisions.length === 0 && !loading ? (
              <div className="decision-muted">
                No decisions yet. Generate one from the Anomaly, Maintenance, Voyage or Safety
                modules.
              </div>
            ) : (
              <div className="data-table-wrapper">
                <table className="data-table" data-testid="decision-register">
                  <thead>
                    <tr>
                      <th>Created</th>
                      <th>Agent</th>
                      <th>Entity</th>
                      <th>Site</th>
                      <th>Severity</th>
                      <th>Summary</th>
                      <th>Status</th>
                      <th>Decided by</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decisions.map((d) => (
                      <tr
                        key={d.recommendation_id}
                        className={d.recommendation_id === selectedId ? 'selected' : ''}
                        onClick={() => setSelectedId(d.recommendation_id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>{formatUtc(d.created_at)}</td>
                        <td>{d.agent}</td>
                        <td>{d.entity_id}</td>
                        <td>{d.site_name ?? '-'}</td>
                        <td>
                          <SeverityPill severity={d.severity} />
                        </td>
                        <td style={{ whiteSpace: 'normal', minWidth: '260px' }}>{d.summary}</td>
                        <td>
                          <StatusPill status={d.status} />
                        </td>
                        <td>{d.decided_by ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {selected && (
            <div className="card-panel decision-panel">
              <h3>Decision {selected.recommendation_id.substring(0, 8)}</h3>
              <p className="decision-rationale">{selected.rationale}</p>
              <div className="detail-grid">
                <div>
                  <label>Confidence</label>
                  <div>{confidenceText(selected)}</div>
                </div>
                <div>
                  <label>Provider</label>
                  <div>{selected.provider}</div>
                </div>
                <div>
                  <label>Safety-critical</label>
                  <div>{selected.safety_critical ? 'Yes' : 'No'}</div>
                </div>
                <div>
                  <label>Decision comment</label>
                  <div>{selected.decision_comment ?? '-'}</div>
                </div>
              </div>
              <h4>Audit Trail</h4>
              <AuditTimeline events={selectedAudit} />
            </div>
          )}

          <div className="card-panel">
            <h3>Recent Audit Events</h3>
            <AuditTimeline events={audit} newestFirst />
          </div>
        </>
      )}
    </div>
  );
};
