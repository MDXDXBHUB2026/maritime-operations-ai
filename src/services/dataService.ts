import {
  Alert,
  Anomaly,
  AutomationTask,
  Equipment,
  MaintenanceAsset,
  MaintenanceHistory,
  SafetyEvent,
  SensorReading,
  Vessel,
  Voyage,
  VoyagePlan,
  WorkOrder,
} from '../types/maritime';
import { apiGet } from './apiClient';
import { DataConfig, resolveDataConfig } from './config';

/** Each dataset is available as a bundled static JSON file and as a backend endpoint. */
const SOURCES = {
  vessels: { file: 'vessels.json', endpoint: '/vessels' },
  voyages: { file: 'voyages.json', endpoint: '/voyages' },
  voyagePlans: { file: 'voyage_plans.json', endpoint: '/voyages/plans' },
  equipment: { file: 'equipment.json', endpoint: '/maintenance/equipment' },
  alerts: { file: 'alerts.json', endpoint: '/alerts' },
  anomalies: { file: 'anomalies.json', endpoint: '/anomalies' },
  sensorReadings: { file: 'sensor_readings.json', endpoint: '/sensor-readings' },
  maintenanceAssets: { file: 'maintenance_assets.json', endpoint: '/maintenance' },
  maintenanceHistory: { file: 'maintenance_history.json', endpoint: '/maintenance/history' },
  workOrders: { file: 'work_orders.json', endpoint: '/maintenance/work-orders' },
  safetyEvents: { file: 'safety_events.json', endpoint: '/safety' },
  automationTasks: { file: 'automation_tasks.json', endpoint: '/automation-tasks' },
} as const;

type Source = (typeof SOURCES)[keyof typeof SOURCES];

async function fetchStaticJson<T>(
  staticBaseUrl: string,
  filename: string,
  fetchImpl?: typeof fetch
): Promise<T[]> {
  const url = `${staticBaseUrl}/data/${filename}`;
  try {
    const res = await (fetchImpl ?? fetch)(url);
    if (!res.ok) {
      throw new Error(`Failed to load ${filename}: ${res.status} ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    console.error(`Error loading data asset ${filename}:`, err);
    throw err;
  }
}

async function fetchFromApi<T>(
  apiBaseUrl: string,
  source: Source,
  fetchImpl?: typeof fetch
): Promise<T[]> {
  try {
    return await apiGet<T[]>(apiBaseUrl, source.endpoint, fetchImpl);
  } catch (err) {
    console.error(`Error loading ${source.endpoint} from backend API:`, err);
    throw err;
  }
}

/**
 * Creates the data service for the given mode.
 * - static: reads the bundled public/data JSON files (GitHub Pages demo, default).
 * - api: reads the same datasets from the FastAPI backend.
 * Components depend only on this interface, never on fetch or the backend directly.
 */
export function createDataService(config: DataConfig, fetchImpl?: typeof fetch) {
  const load = <T>(source: Source): Promise<T[]> =>
    config.mode === 'api'
      ? fetchFromApi<T>(config.apiBaseUrl, source, fetchImpl)
      : fetchStaticJson<T>(config.staticBaseUrl, source.file, fetchImpl);

  return {
    mode: config.mode,
    getVessels: () => load<Vessel>(SOURCES.vessels),
    getVoyages: () => load<Voyage>(SOURCES.voyages),
    getVoyagePlans: () => load<VoyagePlan>(SOURCES.voyagePlans),
    getEquipment: () => load<Equipment>(SOURCES.equipment),
    getAlerts: () => load<Alert>(SOURCES.alerts),
    getAnomalies: () => load<Anomaly>(SOURCES.anomalies),
    getSensorReadings: () => load<SensorReading>(SOURCES.sensorReadings),
    getMaintenanceAssets: () => load<MaintenanceAsset>(SOURCES.maintenanceAssets),
    getMaintenanceHistory: () => load<MaintenanceHistory>(SOURCES.maintenanceHistory),
    getWorkOrders: () => load<WorkOrder>(SOURCES.workOrders),
    getSafetyEvents: () => load<SafetyEvent>(SOURCES.safetyEvents),
    getAutomationTasks: () => load<AutomationTask>(SOURCES.automationTasks),
  };
}

export type DataServiceApi = ReturnType<typeof createDataService>;

export const DataService: DataServiceApi = createDataService(resolveDataConfig());
