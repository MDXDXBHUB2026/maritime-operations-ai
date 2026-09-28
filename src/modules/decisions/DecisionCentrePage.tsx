import React, { useCallback, useEffect, useState } from 'react';
import { Bot, RefreshCw, RotateCcw } from 'lucide-react';
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
import {
  DemoPersonaSwitcher,
  useDecisionActor,
} from '../../components/decisions/DemoPersonaSwitcher';
import { DataService } from '../../services/dataService';
import { LocalDecisionEngine } from '../../services/localDecisionEngine';
import type { DecisionDomain } from '../../services/decisionService';

const STATUSES: DecisionStatus[] = [
  'PROPOSED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'EXECUTED',
  'CANCELLED',
];

const OPEN_SEVERITIES = ['critical', 'high'];
const SCAN_LIMIT = 3;

/** Open high-priority items per domain that the Manager Agent routes to its specialists. */
async function fleetScanTargets(): Promise<{ domain: DecisionDomain; id: string }[]> {
  const [anomalies, assets, plans, events] = await Promise.all([
    DataService.getAnomalies(),
    DataService.getMaintenanceAssets(),
    DataService.getVoyagePlans(),
    DataService.getSafetyEvents(),
  ]);
  const open = (status: unknown) => String(status ?? '').toLowerCase() !== 'closed';
  const high = (s: unknown) => OPEN_SEVERITIES.includes(String(s ?? '').toLowerCase());
  return [
    ...anomalies
      .filter((a) => open(a.status) && high(a.severity))
      .slice(0, SCAN_LIMIT)
      .map((a) => ({ domain: 'anomaly' as const, id: a.anomaly_id })),
    ...[...assets]
      .filter((a) => String(a.maintenance_status ?? '').toLowerCase() !== 'completed')
      .sort((a, b) => Number(a.health_score) - Number(b.health_score))
      .slice(0, SCAN_LIMIT)
      .map((a) => ({ domain: 'maintenance' as const, id: a.asset_id })),
    ...[...plans]
      .sort(
        (a, b) =>
          Date.parse(String(b.predicted_eta)) -
          Date.parse(String(b.planned_eta)) -
          (Date.parse(String(a.predicted_eta)) - Date.parse(String(a.planned_eta)))
      )
      .slice(0, SCAN_LIMIT)
      .map((p) => ({ domain: 'voyage' as const, id: p.voyage_id })),
    ...events
      .filter((e) => open(e.status) && high(e.severity))
      .slice(0, SCAN_LIMIT)
      .map((e) => ({ domain: 'safety' as const, id: e.event_id })),
  ];
}

/** Fleet-wide register of decisions and the audit trail (backend, or in-browser demo). */
export const DecisionCentrePage: React.FC = () => {
  const apiMode = DecisionService.isBackend();
  const actor = useDecisionActor();
  const badge = apiMode ? 'DB' : 'BROWSER';
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [statusFilter, setStatusFilter] = useState<DecisionStatus | ''>('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [selectedAudit, setSelectedAudit] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
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
  }, [statusFilter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) return;
    DecisionService.auditEvents(selectedId)
      .then(setSelectedAudit)
      .catch(() => setSelectedAudit([]));
  }, [selectedId, decisions]);

  const scanFleet = async () => {
    setLoading(true);
    setError(null);
    try {
      const targets = await fleetScanTargets();
      for (const t of targets) await DecisionService.generate(t.domain, t.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fleet scan failed');
    } finally {
      setLoading(false);
    }
    await refresh();
  };

  const resetDemo = async () => {
    LocalDecisionEngine.reset();
    setSelectedId('');
    await refresh();
  };

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

      <DemoPersonaSwitcher />
      {!apiMode && (
        <div className="decision-note" data-testid="decision-centre-static">
          <Bot size={14} /> Browser demo: the Manager Agent and its Anomaly, Maintenance, Voyage and
          Safety agents run in this browser with the same rules as the backend. Nothing is sent to a
          server and no operational system is changed.
        </div>
      )}
      <>
        <div className="grid-4">
          <MetricCard label="Decisions loaded" value={decisions.length} badge={badge} />
          <MetricCard
            label="Awaiting decision"
            value={count('PROPOSED') + count('UNDER_REVIEW')}
            badge={badge}
          />
          <MetricCard
            label="Approved / executed"
            value={count('APPROVED') + count('EXECUTED')}
            badge={badge}
          />
          <MetricCard label="Rejected" value={count('REJECTED')} badge={badge} />
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
              {!apiMode && (
                <button
                  className="btn btn-primary"
                  onClick={scanFleet}
                  disabled={loading || !actor?.permissions.can_generate}
                  title={
                    actor?.permissions.can_generate
                      ? 'Manager Agent routes open high-priority items to the specialist agents'
                      : `${actor?.role_label} cannot request recommendations`
                  }
                  data-testid="fleet-scan"
                >
                  <Bot size={14} /> Run fleet scan
                </button>
              )}
              <button className="btn" onClick={refresh} disabled={loading}>
                <RefreshCw size={14} /> Refresh
              </button>
              {!apiMode && decisions.length > 0 && (
                <button className="btn" onClick={resetDemo} disabled={loading}>
                  <RotateCcw size={14} /> Clear demo decisions
                </button>
              )}
            </div>
          </div>
          {error && <div className="decision-msg-err">{error}</div>}
          {decisions.length === 0 && !loading ? (
            <div className="decision-muted">
              No decisions yet.{' '}
              {apiMode
                ? 'Generate one from the Anomaly, Maintenance, Voyage or Safety modules.'
                : 'Run a fleet scan, or generate one from the Anomaly, Maintenance, Voyage or Safety modules.'}
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
    </div>
  );
};
