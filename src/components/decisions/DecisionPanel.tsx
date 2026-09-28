import React, { useCallback, useEffect, useState } from 'react';
import { Bot, ShieldAlert } from 'lucide-react';
import {
  DecisionService,
  type AuditEvent,
  type Decision,
  type DecisionDomain,
} from '../../services/decisionService';
import { StorageService } from '../../services/storageService';
import {
  AuditTimeline,
  SeverityPill,
  StatusPill,
  confidenceText,
  formatUtc,
  isValidActor,
} from './decisionUi';

interface DecisionPanelProps {
  domain: DecisionDomain;
  entityId: string;
  entityLabel: string;
}

const OPEN_STATES = ['PROPOSED', 'UNDER_REVIEW'];

/**
 * AI Decision Support panel: an agent proposes, a named human reviews and approves or rejects,
 * and execution is simulated. Every transition is recorded by the backend audit trail.
 * In STATIC mode (GitHub Pages) it only explains how to enable the workflow.
 */
export const DecisionPanel: React.FC<DecisionPanelProps> = ({ domain, entityId, entityLabel }) => {
  const apiMode = DecisionService.isAvailable();
  const [operator, setOperator] = useState<string>(() => StorageService.getOperatorName());
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

  const operatorValid = isValidActor(operator);

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

  const updateOperator = (value: string) => {
    setOperator(value);
    StorageService.saveOperatorName(value.trim());
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

  const name = operator.trim();
  const status = active?.status;

  return (
    <div className="card-panel decision-panel" data-testid="decision-panel">
      <h3>
        <Bot size={16} /> AI Decision Support: {entityLabel}
      </h3>
      <div className="decision-note">
        Agents propose; a named person decides. Execution is simulated in this phase and every state
        change is written to the audit trail.
      </div>

      <div className="decision-toolbar">
        <label>
          Your name (recorded as actor)
          <input
            type="text"
            value={operator}
            maxLength={80}
            placeholder="e.g. Chief Engineer A. Rahman"
            onChange={(e) => updateOperator(e.target.value)}
            aria-label="Decision operator name"
          />
        </label>
        <button
          className="btn btn-primary"
          disabled={busy || !operatorValid}
          onClick={() =>
            run('Recommendation generated', () => DecisionService.generate(domain, entityId, name))
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
      {!operatorValid && (
        <div className="decision-muted">
          Enter your name to generate or decide on a recommendation.
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
                  disabled={busy || !operatorValid}
                  onClick={() =>
                    run('Review started', () =>
                      DecisionService.review(active.recommendation_id, name, note || undefined)
                    )
                  }
                >
                  Start review
                </button>
              )}
              <button
                className="btn btn-success"
                disabled={busy || !operatorValid}
                onClick={() =>
                  run('Approved', () =>
                    DecisionService.approve(active.recommendation_id, name, note || undefined)
                  )
                }
              >
                Approve decision
              </button>
              <button
                className="btn btn-danger"
                disabled={busy || !operatorValid || note.trim().length < 3}
                title={note.trim().length < 3 ? 'A rejection reason is required' : undefined}
                onClick={() =>
                  run('Rejected', () =>
                    DecisionService.reject(active.recommendation_id, name, note.trim())
                  )
                }
              >
                Reject decision
              </button>
            </div>
          )}
          {status === 'APPROVED' && (
            <div className="decision-controls">
              <button
                className="btn btn-primary"
                disabled={busy || !operatorValid}
                onClick={() =>
                  run('Simulated execution', () =>
                    DecisionService.execute(active.recommendation_id, name)
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
  return err instanceof Error ? err.message : 'Backend request failed';
}
