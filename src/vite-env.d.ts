/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'static' (default, GitHub Pages demo) or 'api' (FastAPI backend). */
  readonly VITE_DATA_MODE?: string;
  /** Backend base URL used in API mode, e.g. http://localhost:8000/api/v1 */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
