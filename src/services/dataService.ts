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

const BASE_URL = import.meta.env.BASE_URL || '/';

async function fetchJson<T>(filename: string): Promise<T[]> {
  const url = `${BASE_URL.replace(/\/$/, '')}/data/${filename}`;
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

export const DataService = {
  getVessels: () => fetchJson<Vessel>('vessels.json'),
  getVoyages: () => fetchJson<Voyage>('voyages.json'),
  getVoyagePlans: () => fetchJson<VoyagePlan>('voyage_plans.json'),
  getEquipment: () => fetchJson<Equipment>('equipment.json'),
  getAlerts: () => fetchJson<Alert>('alerts.json'),
  getAnomalies: () => fetchJson<Anomaly>('anomalies.json'),
  getSensorReadings: () => fetchJson<SensorReading>('sensor_readings.json'),
  getMaintenanceAssets: () => fetchJson<MaintenanceAsset>('maintenance_assets.json'),
  getMaintenanceHistory: () => fetchJson<MaintenanceHistory>('maintenance_history.json'),
  getWorkOrders: () => fetchJson<WorkOrder>('work_orders.json'),
  getSafetyEvents: () => fetchJson<SafetyEvent>('safety_events.json'),
  getAutomationTasks: () => fetchJson<AutomationTask>('automation_tasks.json'),
};
