import React from 'react';
import type { AuditEvent, Decision, DecisionStatus } from '../../services/decisionService';

export function formatUtc(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toISOString().substring(0, 16).replace('T', ' ')} UTC`;
}

const STATUS_CLASS: Record<DecisionStatus, string> = {
  PROPOSED: 'medium',
  UNDER_REVIEW: 'info',
  APPROVED: 'low',
  REJECTED: 'critical',
  EXECUTED: 'low',
  CANCELLED: 'high',
};

export const StatusPill: React.FC<{ status: DecisionStatus }> = ({ status }) => (
  <span className={`pill ${STATUS_CLASS[status]}`} data-testid="decision-status">
    {status.replace('_', ' ')}
  </span>
);

export const SeverityPill: React.FC<{ severity: Decision['severity'] }> = ({ severity }) => (
  <span className={`pill ${severity.toLowerCase()}`}>{severity}</span>
);

export function confidenceText(d: Decision): string {
  if (d.confidence === null || d.confidence === undefined) {
    return 'Not computed (no traceable source value)';
  }
  return `${d.confidence.toFixed(1)}% (source detection confidence)`;
}

export const AuditTimeline: React.FC<{ events: AuditEvent[]; newestFirst?: boolean }> = ({
  events,
  newestFirst = false,
}) => {
  if (events.length === 0) {
    return <div className="decision-muted">No audit events recorded.</div>;
  }
  const ordered = [...events].sort((a, b) =>
    newestFirst ? b.timestamp.localeCompare(a.timestamp) : a.timestamp.localeCompare(b.timestamp)
  );
  return (
    <ol className="decision-timeline" data-testid="decision-audit-timeline">
      {ordered.map((e) => {
        const approval = e.human_approval as {
          approver?: string;
          approved?: boolean;
          approved_by?: string;
        } | null;
        const approverLabel = approval?.approved === false ? 'rejected by' : 'human approver';
        const reason = (e.details?.reason ?? e.details?.comment ?? e.human_approval?.reason) as
          string | undefined;
        return (
          <li key={e.event_id}>
            <div className="decision-timeline-head">
              <strong>{e.action.replace(/_/g, ' ')}</strong>
              <span>{formatUtc(e.timestamp)}</span>
            </div>
            <div className="decision-muted">
              {e.previous_state ?? 'none'} &rarr; {e.new_state ?? 'none'} &middot; by {e.actor}
              {approval?.approver ? ` · ${approverLabel}: ${approval.approver}` : ''}
              {approval?.approved_by ? ` · approved by: ${approval.approved_by}` : ''}
              {reason ? ` · "${reason}"` : ''}
            </div>
          </li>
        );
      })}
    </ol>
  );
};
