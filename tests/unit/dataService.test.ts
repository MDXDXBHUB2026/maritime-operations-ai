import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveApiBaseUrl, resolveDataMode } from '../../src/services/config';
import { createDataService } from '../../src/services/dataService';

function mockFetch() {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify([{ vessel_id: 'VES-001' }]), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('Data mode configuration', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('defaults to static unless api is explicitly requested', () => {
    expect(resolveDataMode(undefined)).toBe('static');
    expect(resolveDataMode('')).toBe('static');
    expect(resolveDataMode('bogus')).toBe('static');
    expect(resolveDataMode(' API ')).toBe('api');
  });

  it('normalises the API base URL', () => {
    expect(resolveApiBaseUrl(undefined)).toBe('http://localhost:8000/api/v1');
    expect(resolveApiBaseUrl('https://ops.example/api/v1/')).toBe('https://ops.example/api/v1');
  });

  it('static mode reads public/data JSON files', async () => {
    const fetchMock = mockFetch();
    const svc = createDataService('static');
    await svc.getVessels();
    await svc.getVoyagePlans();
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/data\/vessels\.json$/);
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/data\/voyage_plans\.json$/);
  });

  it('api mode reads from the backend endpoints', async () => {
    const fetchMock = mockFetch();
    const svc = createDataService('api');
    const vessels = await svc.getVessels();
    await svc.getAnomalies();
    await svc.getAlerts();
    expect(vessels).toEqual([{ vessel_id: 'VES-001' }]);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:8000/api/v1/vessels');
    expect(fetchMock.mock.calls[1][0]).toBe('http://localhost:8000/api/v1/anomalies');
    expect(fetchMock.mock.calls[2][0]).toBe('http://localhost:8000/api/v1/datasets/alerts');
  });

  it('api mode surfaces structured backend errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { code: 'not_found', message: 'missing' } }), { status: 404 })
      )
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(createDataService('api').getVessels()).rejects.toThrow(/missing/);
  });
});
