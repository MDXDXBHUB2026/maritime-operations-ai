export type DataMode = 'static' | 'api';

export interface DataConfig {
  mode: DataMode;
  /** Base URL of the FastAPI backend, e.g. http://localhost:8000/api/v1 (API mode only). */
  apiBaseUrl: string;
  /** Vite base path used to locate the bundled public/data JSON files (static mode). */
  staticBaseUrl: string;
}

export const DEFAULT_API_BASE_URL = 'http://localhost:8000/api/v1';

interface DataEnv {
  VITE_DATA_MODE?: string;
  VITE_API_BASE_URL?: string;
  BASE_URL?: string;
}

/**
 * Resolves the data mode from Vite build-time environment variables.
 * Anything other than an explicit "api" keeps the static GitHub Pages behaviour.
 */
export function resolveDataConfig(env: DataEnv = import.meta.env): DataConfig {
  const requested = (env.VITE_DATA_MODE ?? '').trim().toLowerCase();
  if (requested && requested !== 'static' && requested !== 'api') {
    console.warn(`Unknown VITE_DATA_MODE "${env.VITE_DATA_MODE}", falling back to static mode.`);
  }
  return {
    mode: requested === 'api' ? 'api' : 'static',
    apiBaseUrl: (env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL).replace(/\/+$/, ''),
    staticBaseUrl: (env.BASE_URL || '/').replace(/\/+$/, ''),
  };
}
