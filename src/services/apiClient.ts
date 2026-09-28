import { AppConfig } from './config';

/** Error raised for non-2xx backend responses, carrying the backend's structured error code. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${AppConfig.apiBaseUrl}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
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
    throw new ApiError(`API request ${path} failed: ${message}`, res.status, code);
  }
  return (await res.json()) as T;
}

export const ApiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
};
