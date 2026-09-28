import React, { useCallback, useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { AuthService, ROLE_OPTIONS, type ManagedUser } from '../../services/authService';
import type { RoleName } from '../../services/authSession';
import { ApiError } from '../../services/apiClient';
import { useAuth } from '../../app/AuthContext';
import { formatUtc } from '../../components/decisions/decisionUi';

function messageOf(err: unknown): string {
  return err instanceof ApiError ? (err.detail ?? err.message) : 'Request failed';
}

/** Account administration (Administrator role). Administrators hold no approval authority. */
export const UserAdminPage: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({
    username: '',
    display_name: '',
    role: 'operator' as RoleName,
    password: '',
  });

  const load = useCallback(async () => {
    try {
      setUsers(await AuthService.listUsers());
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
    } catch (err: unknown) {
      setError(messageOf(err));
    }
  };

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    act(`Created ${form.username}`, async () => {
      await AuthService.createUser({ ...form, username: form.username.trim().toLowerCase() });
      setForm({ username: '', display_name: '', role: 'operator', password: '' });
    });
  };

  return (
    <div>
      <div className="eyebrow">Access control</div>
      <h1>User Administration</h1>
      <p className="subtitle">
        Accounts, roles and access. Role changes and deactivation end the user&apos;s active
        sessions. Every change is written to the audit trail.
      </p>

      {notice && <div className="decision-msg-ok">{notice}</div>}
      {error && <div className="decision-msg-err">{error}</div>}

      <div className="card-panel decision-panel">
        <h3>
          <UserPlus size={16} /> Create account
        </h3>
        <form className="decision-toolbar" onSubmit={create}>
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
              onChange={(e) => setForm({ ...form, role: e.target.value as RoleName })}
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
          <button className="btn btn-primary" type="submit">
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
                <th>Status</th>
                <th>Last sign-in</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const self = u.user_id === user.user_id;
                return (
                  <tr key={u.user_id}>
                    <td>{u.username}</td>
                    <td>{u.display_name}</td>
                    <td>
                      <select
                        value={u.role}
                        disabled={self}
                        aria-label={`Role for ${u.username}`}
                        onChange={(e) =>
                          act(`Role updated for ${u.username}`, () =>
                            AuthService.updateUser(u.user_id, { role: e.target.value as RoleName })
                          )
                        }
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <span className={`pill ${u.is_active ? 'low' : 'critical'}`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>{u.last_login_at ? formatUtc(u.last_login_at) : 'Never'}</td>
                    <td>
                      <button
                        className={`btn ${u.is_active ? 'btn-danger' : 'btn-success'}`}
                        disabled={self}
                        title={self ? 'You cannot deactivate your own account' : undefined}
                        onClick={() =>
                          act(`${u.username} ${u.is_active ? 'deactivated' : 'reactivated'}`, () =>
                            AuthService.updateUser(u.user_id, { is_active: !u.is_active })
                          )
                        }
                      >
                        {u.is_active ? 'Deactivate' : 'Reactivate'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
