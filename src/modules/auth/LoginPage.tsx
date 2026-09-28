import React, { useEffect, useState } from 'react';
import { Anchor, Lock, LogIn, MonitorSmartphone, UserCheck } from 'lucide-react';
import { AuthService } from '../../services/authService';
import { ApiError } from '../../services/apiClient';
import { chooseBrowserDemo } from '../../services/config';

type DemoAccount = { username: string; display_name: string; role_label: string };

const DEMO_ACCOUNTS: { username: string; role: string; authority: string }[] = [
  { username: 'duty.officer', role: 'Duty Officer', authority: 'Request & review · fleet-wide' },
  { username: 'master', role: 'Master', authority: 'Approve voyage & safety · MV Horizon Star' },
  {
    username: 'chief.engineer',
    role: 'Chief Engineer',
    authority: 'Approve anomaly & maintenance · MV Horizon Star',
  },
  {
    username: 'master.meridian',
    role: 'Master',
    authority: 'Approve voyage & safety · MV Meridian',
  },
  {
    username: 'chief.meridian',
    role: 'Chief Engineer',
    authority: 'Approve anomaly & maintenance · MV Meridian',
  },
  {
    username: 'relief.master',
    role: 'Master',
    authority: 'Standby: no vessel until a crew handover',
  },
  {
    username: 'tech.super',
    role: 'Technical Superintendent',
    authority: 'Approve anomaly & maintenance · fleet-wide',
  },
  {
    username: 'marine.super',
    role: 'Marine Superintendent',
    authority: 'Approve voyage · fleet-wide',
  },
  { username: 'hse.manager', role: 'HSE Manager', authority: 'Approve safety · fleet-wide' },
  { username: 'viewer', role: 'Viewer', authority: 'Read-only' },
  { username: 'admin', role: 'Administrator', authority: 'Manage users & scope (no approvals)' },
];

/** Sign-in screen shown in API mode before any operational data is loaded. */
export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoAccounts, setDemoAccounts] = useState<DemoAccount[]>([]);

  useEffect(() => {
    AuthService.demoAccounts()
      .then(setDemoAccounts)
      .catch(() => setDemoAccounts([]));
  }, []);

  const demoSignIn = async (username: string) => {
    setBusy(true);
    setError(null);
    try {
      await AuthService.demoLogin(username);
    } catch (err: unknown) {
      setError(
        err instanceof ApiError ? (err.detail ?? 'Demo sign-in failed') : 'Backend unreachable'
      );
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await AuthService.login(username.trim(), password);
      setPassword('');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(
          err.status === 401 ? (err.detail ?? 'Sign-in failed') : `Backend error: ${err.detail}`
        );
      } else {
        setError('Backend unreachable. Check that the API server is running.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-shell">
      <div className="login-card" data-testid="login-page">
        <div className="login-brand">
          <Anchor size={22} />
          <div>
            <div className="login-title">MARITIME AI</div>
            <div className="login-subtitle">OPERATIONS CONTROL TOWER</div>
          </div>
        </div>
        <h1 className="login-heading">
          <Lock size={18} /> Sign in
        </h1>
        <p className="live-muted">
          Decisions are recorded against your account and role. Approval authority depends on your
          role.
        </p>
        {demoAccounts.length > 0 && (
          <div className="login-public-demo" data-testid="public-demo-accounts">
            <h2>
              <UserCheck size={16} /> Try it: sign in as a demo role
            </h2>
            <p className="live-muted">
              Shared demo with synthetic data. Decisions and the audit trail are stored in the demo
              PostgreSQL database and are visible to other visitors. Do not enter personal
              information.
            </p>
            <div className="login-demo-grid">
              {demoAccounts.map((a) => (
                <button
                  key={a.username}
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => demoSignIn(a.username)}
                  title={a.display_name}
                >
                  <strong>{a.role_label}</strong>
                  {a.display_name.replace(' (demo)', '') !== a.role_label && (
                    <span className="live-muted">{a.display_name.replace(' (demo)', '')}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        <form onSubmit={submit} className="login-form">
          <label>
            Username
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && (
            <div className="decision-msg-err" role="alert">
              {error}
            </div>
          )}
          <button
            className="btn btn-primary"
            type="submit"
            disabled={busy || !username || !password}
          >
            <LogIn size={15} /> {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <button
          type="button"
          className="btn login-browser-demo"
          onClick={chooseBrowserDemo}
          data-testid="use-browser-demo"
        >
          <MonitorSmartphone size={15} /> Continue without signing in (browser-only demo)
        </button>

        <details className="login-demo">
          <summary>Demo role accounts (synthetic environment)</summary>
          <p className="live-muted">
            Created when the backend starts with <code>DEMO_USERS_PASSWORD</code> set, or with{' '}
            <code>python -m app.cli seed-demo-users</code>. The password is chosen by whoever runs
            the backend and is never stored in the code.
          </p>
          <ul>
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.username}>
                <code>{a.username}</code> · {a.role}
                <span className="live-muted"> · {a.authority}</span>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
};
