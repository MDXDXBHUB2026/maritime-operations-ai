import { AppConfig } from './config';
import { AuthSessionStore } from './authSession';

/** Error raised for non-2xx backend responses, carrying the backend's structured error code. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    /** Backend's human-readable message, suitable for display. */
    public readonly detail?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${AppConfig.apiBaseUrl}${path}`;
  const token = AuthSessionStore.token();
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    let code: string | undefined;
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      code = body?.error?.code;
      message = body?.error?.message ?? message;
    } catch {
      // Non-JSON error body; keep status text.
    }
    // An expired or revoked session signs the user out everywhere in the app.
    if (res.status === 401 && token && !path.startsWith('/auth/login')) {
      AuthSessionStore.clear();
    }
    throw new ApiError(`API request ${path} failed: ${message}`, res.status, code, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const ApiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
};
