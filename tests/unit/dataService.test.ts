import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../src/services/apiClient';
import { DEFAULT_API_BASE_URL, resolveDataConfig } from '../../src/services/config';
import { createDataService } from '../../src/services/dataService';
import { createDecisionService } from '../../src/services/decisionService';

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => body,
  }) as Response;

describe('resolveDataConfig', () => {
  it('defaults to static mode so the GitHub Pages build is unchanged', () => {
    const config = resolveDataConfig({ BASE_URL: '/maritime-operations-ai/' });
    expect(config).toEqual({
      mode: 'static',
      apiBaseUrl: DEFAULT_API_BASE_URL,
      staticBaseUrl: '/maritime-operations-ai',
    });
  });

  it('selects api mode and normalises the base URL', () => {
    const config = resolveDataConfig({
      VITE_DATA_MODE: 'API',
      VITE_API_BASE_URL: 'http://localhost:8000/api/v1/',
    });
    expect(config.mode).toBe('api');
    expect(config.apiBaseUrl).toBe('http://localhost:8000/api/v1');
  });

  it('falls back to static mode for unknown values', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveDataConfig({ VITE_DATA_MODE: 'graphql' }).mode).toBe('static');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('DataService', () => {
  it('reads bundled JSON files in static mode', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([{ vessel_id: 'VES-001' }]));
    const service = createDataService(
      {
        mode: 'static',
        apiBaseUrl: DEFAULT_API_BASE_URL,
        staticBaseUrl: '/maritime-operations-ai',
      },
      fetchImpl
    );
    await expect(service.getVessels()).resolves.toEqual([{ vessel_id: 'VES-001' }]);
    expect(fetchImpl).toHaveBeenCalledWith('/maritime-operations-ai/data/vessels.json');
  });

  it('reads the same datasets from the backend in api mode', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([]));
    const service = createDataService(
      { mode: 'api', apiBaseUrl: 'http://api.test/api/v1', staticBaseUrl: '' },
      fetchImpl
    );
    const calls: Array<[() => Promise<unknown>, string]> = [
      [service.getVessels, '/vessels'],
      [service.getVoyages, '/voyages'],
      [service.getVoyagePlans, '/voyages/plans'],
      [service.getEquipment, '/maintenance/equipment'],
      [service.getAlerts, '/alerts'],
      [service.getAnomalies, '/anomalies'],
      [service.getSensorReadings, '/sensor-readings'],
      [service.getMaintenanceAssets, '/maintenance'],
      [service.getMaintenanceHistory, '/maintenance/history'],
      [service.getWorkOrders, '/maintenance/work-orders'],
      [service.getSafetyEvents, '/safety'],
      [service.getAutomationTasks, '/automation-tasks'],
    ];
    for (const [call, endpoint] of calls) {
      fetchImpl.mockClear();
      await call();
      expect(fetchImpl.mock.calls[0][0]).toBe(`http://api.test/api/v1${endpoint}`);
      expect(fetchImpl.mock.calls[0][1]).toMatchObject({ method: 'GET' });
    }
  });

  it('surfaces structured backend errors in api mode', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ error: { code: 'not_found', message: 'missing' } }, 404));
    const service = createDataService(
      { mode: 'api', apiBaseUrl: 'http://api.test/api/v1', staticBaseUrl: '' },
      fetchImpl
    );
    await expect(service.getVessels()).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      code: 'not_found',
    });
    error.mockRestore();
  });

  it('reports an unreachable backend as a network ApiError', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const service = createDataService(
      { mode: 'api', apiBaseUrl: 'http://api.test/api/v1', staticBaseUrl: '' },
      fetchImpl
    );
    const result = service.getAlerts();
    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({ code: 'network_error' });
    error.mockRestore();
  });
});

describe('DecisionService', () => {
  it('refuses to call the backend in static mode', () => {
    const service = createDecisionService({
      mode: 'static',
      apiBaseUrl: DEFAULT_API_BASE_URL,
      staticBaseUrl: '',
    });
    expect(service.isAvailable()).toBe(false);
    expect(() => service.generate('anomaly', 'ANM-0001')).toThrow(/VITE_DATA_MODE=api/);
  });

  it('posts approvals with the human actor', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ status: 'APPROVED' }));
    const service = createDecisionService(
      { mode: 'api', apiBaseUrl: 'http://api.test/api/v1', staticBaseUrl: '' },
      fetchImpl
    );
    await service.approve('abc', 'Chief Engineer', 'ok');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://api.test/api/v1/decisions/abc/approve');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ actor: 'Chief Engineer', comment: 'ok' });
  });
});
