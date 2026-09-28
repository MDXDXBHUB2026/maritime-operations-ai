import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AuthSessionStore,
  approverLabels,
  canDecide,
  inScope,
  scopeText,
  type CurrentUser,
  type Site,
} from '../../src/services/authSession';
import { scopeProblem } from '../../src/modules/users/ScopeEditor';
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
  scope: {
    fleet_wide: false,
    sites: [{ site_id: 'VES-001', name: 'MV Horizon Star', site_type: 'vessel' }],
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

describe('Site scope (frontend mirror of backend rules)', () => {
  const sites: Site[] = [
    { site_id: 'VES-001', name: 'MV Horizon Star', site_type: 'vessel' },
    { site_id: 'TRM-NORTH', name: 'North Container Terminal', site_type: 'terminal' },
  ];

  it('checks scope by site id or name', () => {
    expect(inScope(chiefEngineer, { siteName: 'MV Horizon Star' })).toBe(true);
    expect(inScope(chiefEngineer, { siteId: 'VES-001' })).toBe(true);
    expect(inScope(chiefEngineer, { siteName: 'MV Meridian' })).toBe(false);
    expect(inScope(chiefEngineer, {})).toBe(false);
    const fleet = { ...chiefEngineer, scope: { fleet_wide: true, sites: [] } };
    expect(inScope(fleet, { siteName: 'Anywhere' })).toBe(true);
    expect(scopeText(chiefEngineer)).toBe('MV Horizon Star');
    expect(scopeText(fleet)).toBe('Fleet-wide');
  });

  it('validates scope per role before submitting', () => {
    expect(scopeProblem('master', { fleetWide: true, siteIds: [] }, sites)).toMatch(/fleet-wide/);
    expect(scopeProblem('master', { fleetWide: false, siteIds: [] }, sites)).toMatch(/vessel/);
    expect(scopeProblem('master', { fleetWide: false, siteIds: ['TRM-NORTH'] }, sites)).toMatch(
      /only be assigned vessels/
    );
    expect(scopeProblem('master', { fleetWide: false, siteIds: ['VES-001'] }, sites)).toBeNull();
    expect(scopeProblem('hse_manager', { fleetWide: false, siteIds: [] }, sites)).toMatch(/fleet-wide/);
    expect(scopeProblem('hse_manager', { fleetWide: false, siteIds: ['TRM-NORTH'] }, sites)).toBeNull();
    expect(scopeProblem('viewer', { fleetWide: false, siteIds: [] }, sites)).toBeNull();
  });
});
