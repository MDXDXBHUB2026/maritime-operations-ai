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
import { ApiClient } from './apiClient';
import { AppConfig, DataMode } from './config';

async function fetchJson<T>(filename: string): Promise<T[]> {
  const url = `${AppConfig.staticBaseUrl}/data/${filename}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to load ${filename}: ${res.status} ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    console.error(`Error loading data asset ${filename}:`, err);
    throw err;
  }
}

async function fetchApi<T>(path: string): Promise<T[]> {
  try {
    return await ApiClient.get<T[]>(path);
  } catch (err) {
    console.error(`Error loading ${path} from backend API:`, err);
    throw err;
  }
}

/**
 * Each dataset has a static source (public/data, GitHub Pages demo) and an API source
 * (FastAPI backend). Components call DataService only; the mode is chosen at build time.
 */
const SOURCES = {
  vessels: { file: 'vessels.json', api: '/vessels' },
  voyages: { file: 'voyages.json', api: '/datasets/voyages' },
  voyagePlans: { file: 'voyage_plans.json', api: '/voyages' },
  equipment: { file: 'equipment.json', api: '/datasets/equipment' },
  alerts: { file: 'alerts.json', api: '/datasets/alerts' },
  anomalies: { file: 'anomalies.json', api: '/anomalies' },
  sensorReadings: { file: 'sensor_readings.json', api: '/datasets/sensor_readings' },
  maintenanceAssets: { file: 'maintenance_assets.json', api: '/maintenance' },
  maintenanceHistory: { file: 'maintenance_history.json', api: '/datasets/maintenance_history' },
  workOrders: { file: 'work_orders.json', api: '/datasets/work_orders' },
  safetyEvents: { file: 'safety_events.json', api: '/safety' },
  automationTasks: { file: 'automation_tasks.json', api: '/datasets/automation_tasks' },
} as const;

type SourceKey = keyof typeof SOURCES;

export function createDataService(mode: DataMode) {
  const load = <T>(key: SourceKey): Promise<T[]> =>
    mode === 'api' ? fetchApi<T>(SOURCES[key].api) : fetchJson<T>(SOURCES[key].file);

  return {
    mode,
    getVessels: () => load<Vessel>('vessels'),
    getVoyages: () => load<Voyage>('voyages'),
    getVoyagePlans: () => load<VoyagePlan>('voyagePlans'),
    getEquipment: () => load<Equipment>('equipment'),
    getAlerts: () => load<Alert>('alerts'),
    getAnomalies: () => load<Anomaly>('anomalies'),
    getSensorReadings: () => load<SensorReading>('sensorReadings'),
    getMaintenanceAssets: () => load<MaintenanceAsset>('maintenanceAssets'),
    getMaintenanceHistory: () => load<MaintenanceHistory>('maintenanceHistory'),
    getWorkOrders: () => load<WorkOrder>('workOrders'),
    getSafetyEvents: () => load<SafetyEvent>('safetyEvents'),
    getAutomationTasks: () => load<AutomationTask>('automationTasks'),
  };
}

export const DataService = createDataService(AppConfig.dataMode);
