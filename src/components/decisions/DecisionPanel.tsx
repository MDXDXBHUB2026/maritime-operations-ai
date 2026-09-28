import React, { useCallback, useEffect, useState } from 'react';
import { Bot, ShieldAlert } from 'lucide-react';
import {
  DecisionService,
  type AuditEvent,
  type Decision,
  type DecisionDomain,
} from '../../services/decisionService';
import { ApiError } from '../../services/apiClient';
import {
  activeDelegation,
  approverLabels,
  canDecide,
  inScope,
  scopeText,
} from '../../services/authSession';
import { AuthService } from '../../services/authService';
import { useAuth } from '../../app/AuthContext';
import { AuditTimeline, SeverityPill, StatusPill, confidenceText, formatUtc } from './decisionUi';

interface DecisionPanelProps {
  domain: DecisionDomain;
  entityId: string;
  entityLabel: string;
  /** Vessel or terminal the selected item belongs to (for the site-scope check). */
  siteName?: string;
}

const OPEN_STATES = ['PROPOSED', 'UNDER_REVIEW'];

/**
 * AI Decision Support panel: an agent proposes; the signed-in user acts within their role's
 * authority and site scope (reviews, approves or rejects), and execution is simulated. Every
 * transition is recorded by the backend audit trail.
 * In STATIC mode (GitHub Pages) it only explains how to enable the workflow.
 */
export const DecisionPanel: React.FC<DecisionPanelProps> = ({
  domain,
  entityId,
  entityLabel,
  siteName,
}) => {
  const apiMode = DecisionService.isAvailable();
  const { user } = useAuth();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [active, setActive] = useState<Decision | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const loadAudit = useCallback(async (decisionId: string) => {
    setEvents(await DecisionService.auditEvents(decisionId));
  }, []);

  useEffect(() => {
    if (!apiMode || !entityId) return;
    // Pick up delegations or crew handovers made since sign-in.
    AuthService.refreshMe().catch(() => undefined);
    let cancelled = false;
    setActive(null);
    setEvents([]);
    setMessage(null);
    setNote('');
    DecisionService.list({ entityId, agent: domain, limit: 20 })
      .then(async (list) => {
        if (cancelled) return;
        setDecisions(list);
        if (list.length > 0) {
          setActive(list[0]);
          const audit = await DecisionService.auditEvents(list[0].recommendation_id);
          if (!cancelled) setEvents(audit);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setMessage({ kind: 'err', text: errorText(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [apiMode, domain, entityId]);

  if (!apiMode) {
    return (
      <div className="card-panel decision-panel" data-testid="decision-panel-static">
        <h3>
          <Bot size={16} /> AI Decision Support
        </h3>
        <div className="decision-note">
          Backend decision support is available in API mode only (VITE_DATA_MODE=api with the
          FastAPI backend running). This static demo keeps its browser-local workflow.
        </div>
      </div>
    );
  }

  const canGenerate = !!user?.permissions.can_generate;
  const canReview = !!user?.permissions.can_review;
  // Delegated authority (for this site and domain) counts like the delegator's own authority.
  const decisionSiteRef = active
    ? { siteId: active.site_id, siteName: active.site_name }
    : { siteName };
  const delegation = activeDelegation(user, decisionSiteRef, domain);
  const directAuthority = canDecide(user, domain) && inScope(user, decisionSiteRef);
  const mayDecide = canDecide(user, domain) || !!delegation;
  const requiredRoles = approverLabels(user, domain) || 'an authorised approver';
  // Four-eyes: the requester of a safety-critical decision cannot approve it.
  const fourEyesBlocked =
    !!active?.safety_critical && !!user && active?.created_by_user_id === user.user_id;
  // Site scope: requests use the selected item's site; actions use the decision's recorded site.
  const myScope = scopeText(user);
  const requestInScope =
    inScope(user, { siteName }) || !!activeDelegation(user, { siteName }, domain);
  const decisionSite = active?.site_name ?? siteName ?? 'this site';
  const decisionInScope = active ? inScope(user, decisionSiteRef) || !!delegation : requestInScope;
  const outOfScopeText = `Outside your scope: ${decisionSite} is not covered by your authority (${myScope}).`;

  const run = async (label: string, fn: () => Promise<Decision>) => {
    setBusy(true);
    setMessage(null);
    try {
      const updated = await fn();
      setActive(updated);
      setDecisions((prev) => [
        updated,
        ...prev.filter((d) => d.recommendation_id !== updated.recommendation_id),
      ]);
      await loadAudit(updated.recommendation_id);
      setNote('');
      setMessage({ kind: 'ok', text: `${label}: decision is now ${updated.status}` });
    } catch (err: unknown) {
      setMessage({ kind: 'err', text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  const select = async (id: string) => {
    const found = decisions.find((d) => d.recommendation_id === id) ?? null;
    setActive(found);
    setMessage(null);
    if (found) {
      try {
        await loadAudit(found.recommendation_id);
      } catch (err: unknown) {
        setMessage({ kind: 'err', text: errorText(err) });
      }
    }
  };

  const status = active?.status;

  return (
    <div className="card-panel decision-panel" data-testid="decision-panel">
      <h3>
        <Bot size={16} /> AI Decision Support: {entityLabel}
      </h3>
      <div className="decision-note">
        Agents propose; people decide within their role. You are signed in as{' '}
        <strong>{user?.display_name ?? 'unknown'}</strong> ({user?.role_label ?? 'no role'}; scope:{' '}
        {myScope}). Approval of {domain} decisions requires {requiredRoles} for{' '}
        {siteName ?? 'the site'}. Execution is simulated and every state change is audited.
      </div>

      <div className="decision-toolbar">
        <button
          className="btn btn-primary"
          disabled={busy || !canGenerate || !requestInScope}
          title={
            !canGenerate
              ? `${user?.role_label} cannot request recommendations`
              : !requestInScope
                ? outOfScopeText
                : undefined
          }
          onClick={() =>
            run('Recommendation generated', () => DecisionService.generate(domain, entityId))
          }
        >
          Generate AI recommendation
        </button>
        {decisions.length > 1 && (
          <label>
            Previous recommendations
            <select
              value={active?.recommendation_id ?? ''}
              onChange={(e) => select(e.target.value)}
              aria-label="Previous recommendations"
            >
              {decisions.map((d) => (
                <option key={d.recommendation_id} value={d.recommendation_id}>
                  {formatUtc(d.created_at)} · {d.status}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {!canGenerate && (
        <div className="decision-muted" data-testid="decision-role-note">
          Your role ({user?.role_label}) has read-only access to AI recommendations.
        </div>
      )}
      {delegation && !directAuthority && (
        <div className="decision-delegation-note" data-testid="decision-delegation-note">
          Acting under delegation from <strong>{delegation.delegator}</strong> for{' '}
          {delegation.site.name} ({delegation.domains.join(', ')}) until{' '}
          {formatUtc(delegation.valid_until)}. Your actions are recorded on their behalf.
        </div>
      )}
      {canGenerate && !decisionInScope && (
        <div className="decision-scope-note" data-testid="decision-scope-note">
          {outOfScopeText} You can view this item but not request, review or decide on it.
        </div>
      )}

      {message && (
        <div
          className={message.kind === 'ok' ? 'decision-msg-ok' : 'decision-msg-err'}
          role="status"
          data-testid="decision-message"
        >
          {message.text}
        </div>
      )}

      {active && (
        <div className={`decision-card ${active.severity.toLowerCase()}`}>
          <div className="alert-heading">
            <SeverityPill severity={active.severity} />
            <strong>{active.summary}</strong>
            <StatusPill status={active.status} />
          </div>
          {active.safety_critical && (
            <div className="decision-safety">
              <ShieldAlert size={14} /> Safety-critical: cannot be executed without human approval.
            </div>
          )}
          <p className="decision-rationale">{active.rationale}</p>

          <div className="detail-grid">
            <div>
              <label>Agent</label>
              <div>{active.agent}</div>
            </div>
            <div>
              <label>Site</label>
              <div data-testid="decision-site">{active.site_name ?? 'Unresolved'}</div>
            </div>
            <div>
              <label>Confidence</label>
              <div>{confidenceText(active)}</div>
            </div>
            <div>
              <label>Narrative Provider</label>
              <div>{active.provider}</div>
            </div>
            <div>
              <label>Requested By</label>
              <div>{active.created_by}</div>
            </div>
            <div>
              <label>Decided By</label>
              <div>{active.decided_by ?? 'Pending human decision'}</div>
            </div>
            <div>
              <label>Execution</label>
              <div>{active.execution_mode ?? 'Not executed'}</div>
            </div>
          </div>

          <h4>Proposed Actions</h4>
          <ul className="decision-list">
            {active.recommended_actions.map((a, i) => (
              <li key={i}>
                <span>{a.action}</span>
                {a.safety_critical && <span className="pill high">safety-critical</span>}
                <div className="decision-muted">{a.rationale}</div>
              </li>
            ))}
          </ul>

          <h4>Evidence</h4>
          <ul className="decision-list decision-evidence">
            {active.evidence.map((e, i) => (
              <li key={i}>
                <code>
                  {e.source}/{e.reference}.{e.field}
                </code>{' '}
                = {String(e.value)}
                {e.note ? <span className="decision-muted"> ({e.note})</span> : null}
              </li>
            ))}
          </ul>

          {status && OPEN_STATES.includes(status) && (
            <div className="decision-controls">
              <input
                type="text"
                value={note}
                maxLength={1000}
                placeholder="Decision comment (required to reject)"
                onChange={(e) => setNote(e.target.value)}
                aria-label="Decision comment"
              />
              {status === 'PROPOSED' && (
                <button
                  className="btn"
                  disabled={busy || !canReview || !decisionInScope}
                  onClick={() =>
                    run('Review started', () =>
                      DecisionService.review(active.recommendation_id, note || undefined)
                    )
                  }
                >
                  Start review
                </button>
              )}
              <button
                className="btn btn-success"
                disabled={busy || !mayDecide || fourEyesBlocked || !decisionInScope}
                title={
                  !mayDecide
                    ? `Requires ${requiredRoles}`
                    : fourEyesBlocked
                      ? 'Four-eyes rule: another authorised person must approve'
                      : undefined
                }
                onClick={() =>
                  run('Approved', () =>
                    DecisionService.approve(active.recommendation_id, note || undefined)
                  )
                }
              >
                Approve decision
              </button>
              <button
                className="btn btn-danger"
                disabled={busy || !mayDecide || !decisionInScope || note.trim().length < 3}
                title={
                  !mayDecide
                    ? `Requires ${requiredRoles}`
                    : note.trim().length < 3
                      ? 'A rejection reason is required'
                      : undefined
                }
                onClick={() =>
                  run('Rejected', () =>
                    DecisionService.reject(active.recommendation_id, note.trim())
                  )
                }
              >
                Reject decision
              </button>
              {!mayDecide && (
                <span className="decision-muted" data-testid="decision-authority-note">
                  Approval requires {requiredRoles}.
                </span>
              )}
              {mayDecide && fourEyesBlocked && (
                <span className="decision-muted" data-testid="decision-four-eyes-note">
                  Four-eyes rule: you requested this safety-critical recommendation, so another
                  authorised person must approve it.
                </span>
              )}
            </div>
          )}
          {status === 'APPROVED' && (
            <div className="decision-controls">
              <button
                className="btn btn-primary"
                disabled={busy || !mayDecide || !decisionInScope}
                title={mayDecide ? undefined : `Requires ${requiredRoles}`}
                onClick={() =>
                  run('Simulated execution', () =>
                    DecisionService.execute(active.recommendation_id)
                  )
                }
              >
                Execute (simulated)
              </button>
              <span className="decision-muted">
                Approved by {active.decided_by} at {formatUtc(active.decided_at)}. No operational
                system is changed.
              </span>
            </div>
          )}

          <h4>Audit Trail</h4>
          <AuditTimeline events={events} />
        </div>
      )}
    </div>
  );
};

function errorText(err: unknown): string {
  if (err instanceof ApiError) return err.detail ?? err.message;
  return err instanceof Error ? err.message : 'Backend request failed';
}
