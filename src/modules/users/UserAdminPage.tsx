import React, { useCallback, useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import {
  AuthService,
  ROLE_OPTIONS,
  SCOPED_ROLES,
  type ManagedUser,
} from '../../services/authService';
import type { RoleName, Site } from '../../services/authSession';
import { ApiError } from '../../services/apiClient';
import { useAuth } from '../../app/AuthContext';
import { formatUtc } from '../../components/decisions/decisionUi';
import { ScopeEditor, defaultScope, scopeProblem, type ScopeValue } from './ScopeEditor';

function messageOf(err: unknown): string {
  return err instanceof ApiError ? (err.detail ?? err.message) : 'Request failed';
}

function scopeLabel(u: ManagedUser): string {
  if (!SCOPED_ROLES.includes(u.role)) return 'n/a';
  if (u.fleet_wide) return 'Fleet-wide';
  return u.sites.map((s) => s.name).join(', ') || 'None (no authority)';
}

interface EditState {
  userId: string;
  role: RoleName;
  scope: ScopeValue;
}

/**
 * Account administration (Administrator role). Administrators hold no approval authority.
 * Role and site scope are edited together because approval authority depends on both.
 */
export const UserAdminPage: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [form, setForm] = useState({
    username: '',
    display_name: '',
    role: 'operator' as RoleName,
    password: '',
  });
  const [formScope, setFormScope] = useState<ScopeValue>(defaultScope('operator'));

  const load = useCallback(async () => {
    try {
      const [u, s] = await Promise.all([AuthService.listUsers(), AuthService.listSites()]);
      setUsers(u);
      setSites(s);
    } catch (err: unknown) {
      setError(messageOf(err));
    }
  }, []);

  useEffect(() => {
    if (user?.permissions.can_manage_users) load();
  }, [user, load]);

  if (!user?.permissions.can_manage_users) {
    return (
      <div className="card-panel">
        <h3>User Administration</h3>
        <div className="decision-msg-err">Administrator role required.</div>
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

  const scopePayload = (role: RoleName, scope: ScopeValue) =>
    SCOPED_ROLES.includes(role)
      ? { fleet_wide: scope.fleetWide, site_ids: scope.fleetWide ? [] : scope.siteIds }
      : { fleet_wide: false, site_ids: [] };

  const formProblem = scopeProblem(form.role, formScope, sites);

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    act(`Created ${form.username}`, async () => {
      await AuthService.createUser({
        ...form,
        username: form.username.trim().toLowerCase(),
        ...scopePayload(form.role, formScope),
      });
      setForm({ username: '', display_name: '', role: 'operator', password: '' });
      setFormScope(defaultScope('operator'));
    });
  };

  const startEdit = (u: ManagedUser) =>
    setEditing({
      userId: u.user_id,
      role: u.role,
      scope: { fleetWide: u.fleet_wide, siteIds: u.sites.map((s) => s.site_id) },
    });

  const saveEdit = async (u: ManagedUser) => {
    if (!editing) return;
    const ok = await act(`Updated ${u.username}`, () =>
      AuthService.updateUser(u.user_id, {
        ...(editing.role !== u.role ? { role: editing.role } : {}),
        ...scopePayload(editing.role, editing.scope),
      })
    );
    if (ok) setEditing(null);
  };

  return (
    <div>
      <div className="eyebrow">Access control</div>
      <h1>User Administration</h1>
      <p className="subtitle">
        Accounts, roles and site scope. Masters and Chief Engineers act only for their assigned
        vessels; shore roles are fleet-wide or limited to chosen sites. Role changes and
        deactivation end the user&apos;s sessions; every change is audited.
      </p>

      {notice && <div className="decision-msg-ok">{notice}</div>}
      {error && <div className="decision-msg-err">{error}</div>}

      <div className="card-panel decision-panel">
        <h3>
          <UserPlus size={16} /> Create account
        </h3>
        <form className="user-create-form" onSubmit={create} data-testid="user-create-form">
          <div className="decision-toolbar">
            <label>
              Username
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="e.g. j.smith"
                required
              />
            </label>
            <label>
              Display name
              <input
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                required
              />
            </label>
            <label>
              Role
              <select
                value={form.role}
                onChange={(e) => {
                  const role = e.target.value as RoleName;
                  setForm({ ...form, role });
                  setFormScope(defaultScope(role));
                }}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Initial password
              <input
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                minLength={10}
                required
              />
            </label>
          </div>
          <div className="scope-block">
            <span className="scope-title">Site scope</span>
            <ScopeEditor
              role={form.role}
              sites={sites}
              value={formScope}
              onChange={setFormScope}
              idPrefix="create"
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={!!formProblem}>
            Create
          </button>
        </form>
        <div className="decision-muted">
          Password policy: at least 10 characters with upper- and lower-case letters and a digit.
        </div>
      </div>

      <div className="card-panel">
        <h3>Accounts</h3>
        <div className="data-table-wrapper">
          <table className="data-table" data-testid="user-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Display name</th>
                <th>Role</th>
                <th>Site scope</th>
                <th>Status</th>
                <th>Last sign-in</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const self = u.user_id === user.user_id;
                const isEditing = editing?.userId === u.user_id;
                const editProblem =
                  isEditing && editing ? scopeProblem(editing.role, editing.scope, sites) : null;
                return (
                  <React.Fragment key={u.user_id}>
                    <tr data-username={u.username}>
                      <td>{u.username}</td>
                      <td style={{ whiteSpace: 'normal', minWidth: '150px' }}>{u.display_name}</td>
                      <td style={{ whiteSpace: 'normal' }}>{u.role_label}</td>
                      <td style={{ whiteSpace: 'normal' }}>{scopeLabel(u)}</td>
                      <td>
                        <span className={`pill ${u.is_active ? 'low' : 'critical'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ whiteSpace: 'normal', minWidth: '110px' }}>
                        {u.last_login_at ? formatUtc(u.last_login_at) : 'Never'}
                      </td>
                      <td>
                        <div className="user-actions">
                          <button
                            className="btn"
                            disabled={self}
                            title={self ? 'You cannot change your own role or scope' : undefined}
                            onClick={() => (isEditing ? setEditing(null) : startEdit(u))}
                          >
                            {isEditing ? 'Close' : 'Edit role & scope'}
                          </button>
                          <button
                            className={`btn ${u.is_active ? 'btn-danger' : 'btn-success'}`}
                            disabled={self}
                            title={self ? 'You cannot deactivate your own account' : undefined}
                            onClick={() =>
                              act(
                                `${u.username} ${u.is_active ? 'deactivated' : 'reactivated'}`,
                                () => AuthService.updateUser(u.user_id, { is_active: !u.is_active })
                              )
                            }
                          >
                            {u.is_active ? 'Deactivate' : 'Reactivate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isEditing && editing && (
                      <tr className="user-edit-row">
                        <td colSpan={7}>
                          <div className="user-edit" data-testid="user-edit">
                            <label>
                              Role
                              <select
                                value={editing.role}
                                aria-label={`Role for ${u.username}`}
                                onChange={(e) => {
                                  const role = e.target.value as RoleName;
                                  setEditing({ ...editing, role, scope: defaultScope(role) });
                                }}
                              >
                                {ROLE_OPTIONS.map((r) => (
                                  <option key={r.value} value={r.value}>
                                    {r.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <div className="scope-block">
                              <span className="scope-title">Site scope</span>
                              <ScopeEditor
                                role={editing.role}
                                sites={sites}
                                value={editing.scope}
                                onChange={(scope) => setEditing({ ...editing, scope })}
                                idPrefix={u.username}
                              />
                            </div>
                            <button
                              className="btn btn-primary"
                              disabled={!!editProblem}
                              onClick={() => saveEdit(u)}
                            >
                              Save
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
