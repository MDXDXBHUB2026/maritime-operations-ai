/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "static" (default, bundled JSON for GitHub Pages) or "api" (FastAPI backend). */
  readonly VITE_DATA_MODE?: string;
  /** Backend base URL for API mode, e.g. http://localhost:8000/api/v1. Never put secrets here. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
