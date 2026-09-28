export type DataMode = 'static' | 'api';

export const DEFAULT_API_BASE_URL = 'http://localhost:8000/api/v1';

/** Resolve the data mode. Anything other than an explicit 'api' keeps the static demo behaviour. */
export function resolveDataMode(raw: string | undefined): DataMode {
  return raw?.trim().toLowerCase() === 'api' ? 'api' : 'static';
}

export function resolveApiBaseUrl(raw: string | undefined): string {
  const value = raw?.trim() || DEFAULT_API_BASE_URL;
  return value.replace(/\/+$/, '');
}

const MODE_OVERRIDE_KEY = 'maritime_ai_mode_override';

function browserDemoChosen(): boolean {
  try {
    return sessionStorage.getItem(MODE_OVERRIDE_KEY) === 'static';
  } catch {
    return false;
  }
}

const builtMode = resolveDataMode(import.meta.env.VITE_DATA_MODE);

export const AppConfig: {
  /** Mode the site was built for. */
  builtMode: DataMode;
  /** Mode in use: 'static' when the visitor chose the browser demo or the backend is unreachable. */
  dataMode: DataMode;
  apiBaseUrl: string;
  staticBaseUrl: string;
  /** Why an API-mode build is running as the browser demo, if it is. */
  fallbackReason: string | null;
} = {
  builtMode,
  dataMode: builtMode === 'api' && browserDemoChosen() ? 'static' : builtMode,
  apiBaseUrl: resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
  staticBaseUrl: (import.meta.env.BASE_URL || '/').replace(/\/$/, ''),
  fallbackReason: builtMode === 'api' && browserDemoChosen() ? 'Browser demo selected' : null,
};

/** Switch an API-mode build to the in-browser demo for this tab (no sign-in, no shared data). */
export function chooseBrowserDemo(): void {
  try {
    sessionStorage.setItem(MODE_OVERRIDE_KEY, 'static');
  } catch {
    // storage unavailable: the choice lasts until reload
  }
  window.location.reload();
}

/** Return to the shared backend after choosing the browser demo. */
export function chooseSharedBackend(): void {
  try {
    sessionStorage.removeItem(MODE_OVERRIDE_KEY);
  } catch {
    // ignore
  }
  window.location.reload();
}

/**
 * In API mode, check the backend is reachable before the app starts. If it is not (offline,
 * paused database, cold start beyond the timeout), fall back to the in-browser demo so the site
 * still works.
 */
export async function probeBackend(timeoutMs = 15000): Promise<void> {
  if (AppConfig.dataMode !== 'api') return;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${AppConfig.apiBaseUrl}/health`, { signal: controller.signal });
    if (!res.ok) throw new Error(`health ${res.status}`);
    // A reachable API whose database is down reports status "degraded": use the demo instead.
    const body = (await res.json()) as { status?: string };
    if (body.status !== 'ok') throw new Error(`health ${body.status}`);
  } catch {
    AppConfig.dataMode = 'static';
    AppConfig.fallbackReason = 'Shared backend unreachable';
  } finally {
    window.clearTimeout(timer);
  }
}
