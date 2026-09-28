/**
 * Minimal HTTP client for the Maritime Operations AI backend.
 * The browser never holds API keys or provider credentials; the backend owns them.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ErrorBody {
  error?: { code?: string; message?: string };
}

export async function apiRequest<T>(
  baseUrl: string,
  path: string,
  init: RequestInit = {},
  fetchImpl?: typeof fetch
): Promise<T> {
  const doFetch = fetchImpl ?? fetch;
  const url = `${baseUrl}${path}`;
  let res: Response;
  try {
    res = await doFetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  } catch (err) {
    throw new ApiError(`Backend unreachable at ${url}: ${String(err)}`, 0, 'network_error');
  }
  if (!res.ok) {
    let body: ErrorBody = {};
    try {
      body = (await res.json()) as ErrorBody;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(
      body.error?.message ?? `Request to ${path} failed: ${res.status} ${res.statusText}`,
      res.status,
      body.error?.code ?? 'http_error'
    );
  }
  return (await res.json()) as T;
}

export function apiGet<T>(baseUrl: string, path: string, fetchImpl?: typeof fetch): Promise<T> {
  return apiRequest<T>(baseUrl, path, { method: 'GET' }, fetchImpl);
}

export function apiPost<T>(
  baseUrl: string,
  path: string,
  body: unknown,
  fetchImpl?: typeof fetch
): Promise<T> {
  return apiRequest<T>(
    baseUrl,
    path,
    { method: 'POST', body: JSON.stringify(body ?? {}) },
    fetchImpl
  );
}
