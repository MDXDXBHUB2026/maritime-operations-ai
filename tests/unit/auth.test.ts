import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AuthSessionStore,
  approverLabels,
  canDecide,
  type CurrentUser,
} from '../../src/services/authSession';
import { ApiClient, ApiError } from '../../src/services/apiClient';

const chiefEngineer: CurrentUser = {
  user_id: 'u-1',
  username: 'chief.engineer',
  display_name: 'Chief Engineer (demo)',
  role: 'chief_engineer',
  role_label: 'Chief Engineer',
  permissions: {
    can_generate: true,
    can_review: true,
    approve_domains: ['anomaly', 'maintenance'],
    can_manage_users: false,
  },
  approval_matrix: {
    anomaly: [
      { role: 'chief_engineer', label: 'Chief Engineer' },
      { role: 'technical_superintendent', label: 'Technical Superintendent' },
    ],
    voyage: [
      { role: 'master', label: 'Master' },
      { role: 'marine_superintendent', label: 'Marine Superintendent' },
    ],
  },
};

const future = () => new Date(Date.now() + 3_600_000).toISOString();

describe('Auth session store', () => {
  afterEach(() => {
    AuthSessionStore.clear();
    vi.unstubAllGlobals();
  });

  it('stores the session in sessionStorage and notifies subscribers', () => {
    const seen: (string | null)[] = [];
    const unsubscribe = AuthSessionStore.subscribe((s) => seen.push(s?.user.username ?? null));
    AuthSessionStore.set({ token: 'tok', expiresAt: future(), user: chiefEngineer });
    expect(AuthSessionStore.token()).toBe('tok');
    expect(sessionStorage.getItem('maritime_ai_session')).toContain('chief.engineer');
    AuthSessionStore.clear();
    expect(AuthSessionStore.token()).toBeNull();
    expect(seen).toEqual(['chief.engineer', null]);
    unsubscribe();
  });

  it('treats an expired session as signed out', () => {
    AuthSessionStore.set({
      token: 'old',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      user: chiefEngineer,
    });
    expect(AuthSessionStore.get()).toBeNull();
  });

  it('derives approval authority from the role permissions', () => {
    expect(canDecide(chiefEngineer, 'anomaly')).toBe(true);
    expect(canDecide(chiefEngineer, 'voyage')).toBe(false);
    expect(canDecide(null, 'anomaly')).toBe(false);
    expect(approverLabels(chiefEngineer, 'voyage')).toBe('Master or Marine Superintendent');
  });

  it('sends the bearer token and signs out on 401', async () => {
    AuthSessionStore.set({ token: 'tok-123', expiresAt: future(), user: chiefEngineer });
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const auth = (init?.headers as Record<string, string>)?.Authorization;
      return auth === 'Bearer tok-123'
        ? new Response(JSON.stringify({ error: { code: 'unauthorized', message: 'Session is invalid or has expired' } }), { status: 401 })
        : new Response('[]', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const err = await ApiClient.get('/vessels').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(401);
    expect(err.detail).toBe('Session is invalid or has expired');
    expect(AuthSessionStore.get()).toBeNull();
  });

  it('does not sign out on a failed login attempt', async () => {
    AuthSessionStore.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { code: 'unauthorized', message: 'Invalid username or password' } }), {
          status: 401,
        })
      )
    );
    const err = await ApiClient.post('/auth/login', { username: 'x', password: 'y' }).catch((e) => e);
    expect(err.detail).toBe('Invalid username or password');
  });
});
