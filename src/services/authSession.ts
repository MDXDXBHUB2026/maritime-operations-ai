/**
 * Browser-side session state for API mode.
 *
 * The bearer token is kept in sessionStorage (scoped to the tab, cleared when it closes) rather
 * than localStorage. It is an opaque, server-revocable token; the backend stores only its hash.
 */

export type RoleName =
  | 'viewer'
  | 'operator'
  | 'chief_engineer'
  | 'master'
  | 'technical_superintendent'
  | 'marine_superintendent'
  | 'hse_manager'
  | 'admin';

export interface Permissions {
  can_generate: boolean;
  can_review: boolean;
  approve_domains: string[];
  can_manage_users: boolean;
}

export interface Site {
  site_id: string;
  name: string;
  site_type: 'vessel' | 'terminal';
}

export interface Scope {
  fleet_wide: boolean;
  sites: Site[];
}

export interface CurrentUser {
  user_id: string;
  username: string;
  display_name: string;
  role: RoleName;
  role_label: string;
  permissions: Permissions;
  scope: Scope;
  approval_matrix: Record<string, { role: RoleName; label: string }[]>;
}

export interface AuthSession {
  token: string;
  expiresAt: string;
  user: CurrentUser;
}

const KEY = 'maritime_ai_session';
type Listener = (session: AuthSession | null) => void;
const listeners = new Set<Listener>();

function read(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed.token || Date.parse(parsed.expiresAt) <= Date.now()) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

let current: AuthSession | null = read();

export const AuthSessionStore = {
  get: (): AuthSession | null => {
    if (current && Date.parse(current.expiresAt) <= Date.now()) {
      AuthSessionStore.clear();
    }
    return current;
  },
  token: (): string | null => AuthSessionStore.get()?.token ?? null,
  set: (session: AuthSession): void => {
    current = session;
    try {
      sessionStorage.setItem(KEY, JSON.stringify(session));
    } catch {
      // Storage unavailable (private mode); session lives in memory only.
    }
    listeners.forEach((l) => l(current));
  },
  updateUser: (user: CurrentUser): void => {
    if (current) AuthSessionStore.set({ ...current, user });
  },
  clear: (): void => {
    current = null;
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      // ignore
    }
    listeners.forEach((l) => l(null));
  },
  subscribe: (listener: Listener): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function canDecide(user: CurrentUser | null | undefined, domain: string): boolean {
  return !!user && user.permissions.approve_domains.includes(domain);
}

/** Site scope check mirroring the backend: fleet-wide, or the site is assigned. */
export function inScope(
  user: CurrentUser | null | undefined,
  site: { siteId?: string | null; siteName?: string | null }
): boolean {
  if (!user?.scope) return false;
  if (user.scope.fleet_wide) return true;
  return user.scope.sites.some(
    (s) => (site.siteId && s.site_id === site.siteId) || (site.siteName && s.name === site.siteName)
  );
}

export function scopeText(user: CurrentUser | null | undefined): string {
  if (!user?.scope) return '';
  if (user.scope.fleet_wide) return 'Fleet-wide';
  return user.scope.sites.map((s) => s.name).join(', ') || 'No site assigned';
}

export function approverLabels(user: CurrentUser | null | undefined, domain: string): string {
  const roles = user?.approval_matrix?.[domain] ?? [];
  return roles.map((r) => r.label).join(' or ');
}
