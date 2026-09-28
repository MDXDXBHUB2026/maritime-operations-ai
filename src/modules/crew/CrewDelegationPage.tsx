import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, KeyRound, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../../app/AuthContext';
import { ApiError } from '../../services/apiClient';
import { AuthService, type ManagedUser } from '../../services/authService';
import type { Delegation, RoleName, Site } from '../../services/authSession';
import { AppConfig } from '../../services/config';
import { CrewService, type EligibleDelegate, type SiteCrew } from '../../services/crewService';
import { formatUtc } from '../../components/decisions/decisionUi';

const DOMAIN_LABEL: Record<string, string> = {
  anomaly: 'Anomaly',
  maintenance: 'Maintenance',
  voyage: 'Voyage',
  safety: 'Safety',
};

const STATUS_PILL: Record<string, string> = {
  active: 'low',
  scheduled: 'info',
  suspended: 'high',
  expired: 'medium',
  revoked: 'critical',
  ended: 'medium',
};

function messageOf(err: unknown): string {
  return err instanceof ApiError ? (err.detail ?? err.message) : 'Request failed';
}

/** Value for <input type="datetime-local"> in the browser's local time. */
function localInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIso(local: string): string | undefined {
  if (!local) return undefined;
  const ms = Date.parse(local);
  return Number.isNaN(ms) ? undefined : new Date(ms).toISOString();
}

function period(from: string | null, until: string | null): string {
  if (!from && !until) return 'Open-ended';
  return `${from ? formatUtc(from) : 'now'} → ${until ? formatUtc(until) : 'open'}`;
}

const StatusPill: React.FC<{ status: string }> = ({ status }) => (
  <span className={`pill ${STATUS_PILL[status] ?? 'info'}`}>{status}</span>
);

/**
 * Crew rotation and delegation of approval authority.
 * Everyone sees who holds shipboard authority; administrators schedule handovers; people with
 * approval authority can delegate it for one site, selected domains and a bounded period.
 */
export const CrewDelegationPage: React.FC = () => {
  const { user } = useAuth();
  const apiMode = AppConfig.dataMode === 'api';
  const isAdmin = !!user?.permissions.can_manage_users;
  const approveDomains = user?.permissions.approve_domains ?? [];

  const [crew, setCrew] = useState<SiteCrew[]>([]);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [eligible, setEligible] = useState<EligibleDelegate[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState<Record<string, string>>({});

  const now = Date.now();
  const [delegationForm, setDelegationForm] = useState({
    site_id: '',
    delegate_user_id: '',
    domains: [] as string[],
    valid_from: localInput(now),
    valid_until: localInput(now + 8 * 3_600_000),
    reason: '',
  });
  const [handoverForm, setHandoverForm] = useState({
    site_id: '',
    role: 'master' as RoleName,
    incoming_user_id: '',
    effective_at: '',
    note: '',
  });

  const load = useCallback(async () => {
    if (!apiMode || !user) return;
    try {
      const [c, d] = await Promise.all([CrewService.listCrew(), CrewService.listDelegations()]);
      setCrew(c);
      setDelegations(d);
      if (approveDomains.length > 0) setEligible(await CrewService.eligibleDelegates());
      if (isAdmin) setUsers(await AuthService.listUsers());
      await AuthService.refreshMe();
    } catch (err: unknown) {
      setError(messageOf(err));
    }
    // Keyed on the user id, not the user object: refreshMe() updates the user and would loop.
  }, [apiMode, user?.user_id, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  // Sites the signed-in user can delegate for: their current direct scope (all sites if fleet-wide).
  const delegableSites: Site[] = useMemo(() => {
    if (!user?.scope) return [];
    if (user.scope.fleet_wide) return crew.map((c) => c.site);
    return user.scope.sites;
  }, [user, crew]);

  if (!apiMode) {
    return (
      <div>
        <div className="eyebrow">Authority management</div>
        <h1>Crew &amp; Delegations</h1>
        <div className="card-panel decision-panel" data-testid="crew-static">
          <div className="decision-note">
            Crew rotation and delegation of approval authority are managed by the FastAPI backend.
            Start the frontend with VITE_DATA_MODE=api to use them.
          </div>
        </div>
      </div>
    );
  }

  const act = async (label: string, fn: () => Promise<unknown>) => {
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(label);
      await load();
      return true;
    } catch (err: unknown) {
      setError(messageOf(err));
      return false;
    }
  };

  const submitDelegation = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await act('Delegation created', () =>
      CrewService.createDelegation({
        delegate_user_id: delegationForm.delegate_user_id,
        site_id: delegationForm.site_id,
        domains: delegationForm.domains,
        valid_from: toIso(delegationForm.valid_from),
        valid_until: toIso(delegationForm.valid_until) ?? '',
        reason: delegationForm.reason,
      })
    );
    if (ok) setDelegationForm({ ...delegationForm, reason: '', domains: [] });
  };

  const submitHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await act('Handover scheduled', () =>
      CrewService.handover(handoverForm.site_id, {
        role: handoverForm.role,
        incoming_user_id: handoverForm.incoming_user_id,
        effective_at: toIso(handoverForm.effective_at),
        note: handoverForm.note || undefined,
      })
    );
    if (ok) setHandoverForm({ ...handoverForm, incoming_user_id: '', effective_at: '', note: '' });
  };

  const vessels = crew.filter((c) => c.site.site_type === 'vessel');
  const incomingCandidates = users.filter((u) => u.role === handoverForm.role && u.is_active);
  const assignments = user?.scope?.assignments ?? [];
  const received = user?.scope?.delegations_received ?? [];

  return (
    <div>
      <div className="eyebrow">Authority management</div>
      <h1>Crew &amp; Delegations</h1>
      <p className="subtitle">
        Who holds shipboard authority on each vessel, scheduled crew handovers, and temporary
        delegations of approval authority. Authority is evaluated at the moment of each action.
      </p>

      {notice && <div className="decision-msg-ok">{notice}</div>}
      {error && <div className="decision-msg-err">{error}</div>}

      <div className="card-panel decision-panel" data-testid="my-authority">
        <h3>
          <ShieldCheck size={16} /> My authority
        </h3>
        <div className="detail-grid">
          <div>
            <label>Role</label>
            <div>{user?.role_label}</div>
          </div>
          <div>
            <label>Approval domains</label>
            <div>
              {approveDomains.length ? approveDomains.map((d) => DOMAIN_LABEL[d]).join(', ') : '—'}
            </div>
          </div>
          <div>
            <label>Site scope</label>
            <div>
              {!user?.permissions.can_generate
                ? 'Not applicable for this role'
                : user?.scope?.fleet_wide
                  ? 'Fleet-wide'
                  : assignments.length === 0
                    ? 'No vessel or terminal (standby)'
                    : assignments.map((a) => (
                        <div key={a.site.site_id + a.status}>
                          {a.site.name} <StatusPill status={a.status} />{' '}
                          <span className="live-muted">{period(a.valid_from, a.valid_until)}</span>
                        </div>
                      ))}
            </div>
          </div>
        </div>
        {received.length > 0 && (
          <>
            <h4>Authority delegated to me</h4>
            <ul className="decision-list" data-testid="delegations-received">
              {received.map((d) => (
                <li key={d.delegation_id}>
                  From <strong>{d.delegator}</strong> for {d.site.name} ·{' '}
                  {d.domains.map((x) => DOMAIN_LABEL[x]).join(', ')} ·{' '}
                  {period(d.valid_from, d.valid_until)} <StatusPill status={d.status} />
                  {d.status_note && <div className="decision-muted">{d.status_note}</div>}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {approveDomains.length > 0 && (
        <div className="card-panel decision-panel">
          <h3>
            <KeyRound size={16} /> Delegate my authority
          </h3>
          <div className="decision-note">
            Delegation lends your own approval authority for one site and selected domains for a
            limited period (max 30 days). It stops automatically if you lose that authority, for
            example on crew rotation. It cannot be passed on, and the four-eyes rule still applies.
          </div>
          {delegableSites.length === 0 ? (
            <div className="decision-muted">
              You have no current site assignment, so there is nothing to delegate.
            </div>
          ) : (
            <form onSubmit={submitDelegation} data-testid="delegation-form">
              <div className="decision-toolbar">
                <label>
                  Site
                  <select
                    value={delegationForm.site_id}
                    onChange={(e) =>
                      setDelegationForm({ ...delegationForm, site_id: e.target.value })
                    }
                    required
                    aria-label="Delegation site"
                  >
                    <option value="">Select…</option>
                    {delegableSites.map((s) => (
                      <option key={s.site_id} value={s.site_id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Delegate
                  <select
                    value={delegationForm.delegate_user_id}
                    onChange={(e) =>
                      setDelegationForm({ ...delegationForm, delegate_user_id: e.target.value })
                    }
                    required
                    aria-label="Delegate"
                  >
                    <option value="">Select…</option>
                    {eligible.map((u) => (
                      <option key={u.user_id} value={u.user_id}>
                        {u.display_name} ({u.role_label})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  From
                  <input
                    type="datetime-local"
                    value={delegationForm.valid_from}
                    onChange={(e) =>
                      setDelegationForm({ ...delegationForm, valid_from: e.target.value })
                    }
                    aria-label="Delegation valid from"
                  />
                </label>
                <label>
                  Until
                  <input
                    type="datetime-local"
                    value={delegationForm.valid_until}
                    onChange={(e) =>
                      setDelegationForm({ ...delegationForm, valid_until: e.target.value })
                    }
                    required
                    aria-label="Delegation valid until"
                  />
                </label>
              </div>
              <div className="scope-sites" style={{ margin: '0.5rem 0' }}>
                {approveDomains.map((d) => (
                  <label key={d} className="scope-check">
                    <input
                      type="checkbox"
                      checked={delegationForm.domains.includes(d)}
                      aria-label={`Delegate domain ${d}`}
                      onChange={(e) =>
                        setDelegationForm({
                          ...delegationForm,
                          domains: e.target.checked
                            ? [...delegationForm.domains, d]
                            : delegationForm.domains.filter((x) => x !== d),
                        })
                      }
                    />
                    {DOMAIN_LABEL[d]}
                  </label>
                ))}
              </div>
              <div className="decision-controls">
                <input
                  type="text"
                  value={delegationForm.reason}
                  maxLength={500}
                  placeholder="Reason (e.g. Master ashore for port state meeting)"
                  onChange={(e) => setDelegationForm({ ...delegationForm, reason: e.target.value })}
                  aria-label="Delegation reason"
                  required
                  minLength={5}
                />
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={
                    !delegationForm.site_id ||
                    !delegationForm.delegate_user_id ||
                    delegationForm.domains.length === 0 ||
                    delegationForm.reason.trim().length < 5
                  }
                >
                  Delegate
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="card-panel">
        <h3>{isAdmin ? 'All delegations' : 'My delegations'}</h3>
        {delegations.length === 0 ? (
          <div className="decision-muted">No delegations.</div>
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table" data-testid="delegation-table">
              <thead>
                <tr>
                  <th>Delegation</th>
                  <th>Site · Domains</th>
                  <th>Period</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {delegations.map((d) => {
                  const canRevoke =
                    (isAdmin || d.delegator_user_id === user?.user_id) &&
                    d.status !== 'revoked' &&
                    d.status !== 'expired';
                  return (
                    <tr key={d.delegation_id} data-delegation-id={d.delegation_id}>
                      <td style={{ whiteSpace: 'normal', minWidth: '200px' }}>
                        {d.delegator} → <strong>{d.delegate}</strong>
                        <div className="decision-muted">{d.reason}</div>
                        {d.revoke_reason && (
                          <div className="decision-muted">Revoked: {d.revoke_reason}</div>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'normal' }}>
                        {d.site.name}
                        <div className="decision-muted">
                          {d.domains.map((x) => DOMAIN_LABEL[x]).join(', ')}
                        </div>
                      </td>
                      <td style={{ whiteSpace: 'normal', minWidth: '150px' }}>
                        {period(d.valid_from, d.valid_until)}
                      </td>
                      <td style={{ whiteSpace: 'normal' }}>
                        <StatusPill status={d.status} />
                        {d.status_note && <div className="decision-muted">{d.status_note}</div>}
                      </td>
                      <td>
                        {canRevoke ? (
                          <div className="user-actions">
                            <input
                              type="text"
                              placeholder="Revoke reason"
                              value={revokeReason[d.delegation_id] ?? ''}
                              aria-label="Revoke reason"
                              onChange={(e) =>
                                setRevokeReason({
                                  ...revokeReason,
                                  [d.delegation_id]: e.target.value,
                                })
                              }
                            />
                            <button
                              className="btn btn-danger"
                              disabled={(revokeReason[d.delegation_id] ?? '').trim().length < 3}
                              onClick={() =>
                                act('Delegation revoked', () =>
                                  CrewService.revokeDelegation(
                                    d.delegation_id,
                                    revokeReason[d.delegation_id] ?? ''
                                  )
                                )
                              }
                            >
                              Revoke
                            </button>
                          </div>
                        ) : (
                          <span className="live-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card-panel">
        <h3>
          <Users size={16} /> Crew on board (shipboard authority)
        </h3>
        <div className="data-table-wrapper">
          <table className="data-table" data-testid="crew-table">
            <thead>
              <tr>
                <th>Vessel</th>
                <th>Master</th>
                <th>Chief Engineer</th>
              </tr>
            </thead>
            <tbody>
              {vessels.map((v) => (
                <tr key={v.site.site_id} data-site-id={v.site.site_id}>
                  <td>{v.site.name}</td>
                  {(['master', 'chief_engineer'] as RoleName[]).map((role) => {
                    const holders = v.crew.filter((m) => m.role === role);
                    return (
                      <td key={role} style={{ whiteSpace: 'normal', minWidth: '220px' }}>
                        {holders.length === 0 ? (
                          <span className="live-muted">Not assigned</span>
                        ) : (
                          holders.map((m) => (
                            <div key={m.user_id + m.status}>
                              {m.display_name} <StatusPill status={m.status} />
                              {(m.valid_from || m.valid_until) && (
                                <div className="live-muted">
                                  {period(m.valid_from, m.valid_until)}
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isAdmin && (
        <div className="card-panel decision-panel">
          <h3>
            <ArrowRightLeft size={16} /> Schedule crew handover
          </h3>
          <div className="decision-note">
            The outgoing officer&apos;s authority ends and the incoming officer&apos;s begins at the
            effective time. Leave the time empty for an immediate handover. Delegations granted by
            the outgoing officer stop working at the same moment.
          </div>
          <form onSubmit={submitHandover} className="decision-toolbar" data-testid="handover-form">
            <label>
              Vessel
              <select
                value={handoverForm.site_id}
                onChange={(e) => setHandoverForm({ ...handoverForm, site_id: e.target.value })}
                required
                aria-label="Handover vessel"
              >
                <option value="">Select…</option>
                {vessels.map((v) => (
                  <option key={v.site.site_id} value={v.site.site_id}>
                    {v.site.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Position
              <select
                value={handoverForm.role}
                onChange={(e) =>
                  setHandoverForm({
                    ...handoverForm,
                    role: e.target.value as RoleName,
                    incoming_user_id: '',
                  })
                }
                aria-label="Handover role"
              >
                <option value="master">Master</option>
                <option value="chief_engineer">Chief Engineer</option>
              </select>
            </label>
            <label>
              Incoming officer
              <select
                value={handoverForm.incoming_user_id}
                onChange={(e) =>
                  setHandoverForm({ ...handoverForm, incoming_user_id: e.target.value })
                }
                required
                aria-label="Incoming officer"
              >
                <option value="">Select…</option>
                {incomingCandidates.map((u) => (
                  <option key={u.user_id} value={u.user_id}>
                    {u.display_name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Effective (local time)
              <input
                type="datetime-local"
                value={handoverForm.effective_at}
                onChange={(e) => setHandoverForm({ ...handoverForm, effective_at: e.target.value })}
                aria-label="Handover effective time"
              />
            </label>
            <label>
              Note
              <input
                type="text"
                value={handoverForm.note}
                maxLength={500}
                onChange={(e) => setHandoverForm({ ...handoverForm, note: e.target.value })}
                aria-label="Handover note"
              />
            </label>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={!handoverForm.site_id || !handoverForm.incoming_user_id}
            >
              {handoverForm.effective_at ? 'Schedule handover' : 'Hand over now'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
