import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppConfig, probeBackend } from '../../src/services/config';

describe('Shared backend fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    AppConfig.dataMode = 'static';
    AppConfig.fallbackReason = null;
  });

  it('keeps API mode when the backend health check succeeds', async () => {
    AppConfig.dataMode = 'api';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"status":"ok"}', { status: 200 }))
    );
    await probeBackend(1000);
    expect(AppConfig.dataMode).toBe('api');
    expect(AppConfig.fallbackReason).toBeNull();
  });

  it('falls back to the in-browser demo when the backend is unreachable', async () => {
    AppConfig.dataMode = 'api';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      })
    );
    await probeBackend(1000);
    expect(AppConfig.dataMode).toBe('static');
    expect(AppConfig.fallbackReason).toMatch(/unreachable/);
  });

  it('falls back when the backend is up but its database is not', async () => {
    AppConfig.dataMode = 'api';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"status":"degraded"}', { status: 200 }))
    );
    await probeBackend(1000);
    expect(AppConfig.dataMode).toBe('static');
  });

  it('falls back when the backend reports an error', async () => {
    AppConfig.dataMode = 'api';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('down', { status: 503 }))
    );
    await probeBackend(1000);
    expect(AppConfig.dataMode).toBe('static');
  });
});
