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

export const AppConfig = {
  dataMode: resolveDataMode(import.meta.env.VITE_DATA_MODE),
  apiBaseUrl: resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
  staticBaseUrl: (import.meta.env.BASE_URL || '/').replace(/\/$/, ''),
};
