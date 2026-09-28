import {
  ActionHistoryEntry,
  AnomalyStatus,
  AutomationStatus,
  MaintenanceStatus,
  OperationalStatus,
  Severity,
  WorkOrder,
} from '../types/maritime';

const PREFIX = 'maritime_ai_state_';

function getStored<T>(key: string, defaultValue: T): T {
  try {
    const data = localStorage.getItem(PREFIX + key);
    return data ? JSON.parse(data) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function setStored<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Could not save state for ${key}:`, err);
  }
}

export const StorageService = {
  // Alert overrides
  getAlertOverrides: (): Record<string, { status?: string; owner?: string; severity?: Severity }> =>
    getStored('alert_overrides', {}),
  saveAlertOverride: (
    alertId: string,
    updates: { status?: string; owner?: string; severity?: Severity }
  ) => {
    const current = StorageService.getAlertOverrides();
    current[alertId] = { ...current[alertId], ...updates };
    setStored('alert_overrides', current);
  },

  // Vessel operational status overrides
  getVesselOverrides: (): Record<string, { operational_status?: OperationalStatus }> =>
    getStored('vessel_overrides', {}),
  saveVesselOverride: (vesselId: string, status: OperationalStatus) => {
    const current = StorageService.getVesselOverrides();
    current[vesselId] = { ...current[vesselId], operational_status: status };
    setStored('vessel_overrides', current);
  },

  // Anomaly overrides and history
  getAnomalyOverrides: (): Record<
    string,
    {
      status?: AnomalyStatus;
      owner?: string;
      severity?: Severity;
      work_order_reference?: string | null;
    }
  > => getStored('anomaly_overrides', {}),
  saveAnomalyOverride: (
    anomalyId: string,
    updates: {
      status?: AnomalyStatus;
      owner?: string;
      severity?: Severity;
      work_order_reference?: string | null;
    }
  ) => {
    const current = StorageService.getAnomalyOverrides();
    current[anomalyId] = { ...current[anomalyId], ...updates };
    setStored('anomaly_overrides', current);
  },
  getAnomalyHistory: (): ActionHistoryEntry[] => getStored('anomaly_history', []),
  addAnomalyHistory: (entry: ActionHistoryEntry) => {
    const current = StorageService.getAnomalyHistory();
    setStored('anomaly_history', [entry, ...current]);
  },

  // Maintenance overrides, session work orders, and history
  getMaintenanceOverrides: (): Record<
    string,
    {
      maintenance_status?: MaintenanceStatus;
      owner?: string;
      spare_part_availability?: string;
      work_order_reference?: string | null;
    }
  > => getStored('maintenance_overrides', {}),
  saveMaintenanceOverride: (
    assetId: string,
    updates: {
      maintenance_status?: MaintenanceStatus;
      owner?: string;
      spare_part_availability?: string;
      work_order_reference?: string | null;
    }
  ) => {
    const current = StorageService.getMaintenanceOverrides();
    current[assetId] = { ...current[assetId], ...updates };
    setStored('maintenance_overrides', current);
  },
  getSessionWorkOrders: (): WorkOrder[] => getStored('session_work_orders', []),
  addSessionWorkOrder: (wo: WorkOrder) => {
    const current = StorageService.getSessionWorkOrders();
    setStored('session_work_orders', [...current, wo]);
  },
  getMaintenanceHistory: (): ActionHistoryEntry[] => getStored('maintenance_history', []),
  addMaintenanceHistory: (entry: ActionHistoryEntry) => {
    const current = StorageService.getMaintenanceHistory();
    setStored('maintenance_history', [entry, ...current]);
  },

  // Voyage overrides, scenarios, and history
  getVoyageOverrides: (): Record<string, { optimisation_status?: string }> =>
    getStored('voyage_overrides', {}),
  saveVoyageOverride: (voyageId: string, status: string) => {
    const current = StorageService.getVoyageOverrides();
    current[voyageId] = { ...current[voyageId], optimisation_status: status };
    setStored('voyage_overrides', current);
  },
  getSavedScenarios: (): Record<string, unknown> => getStored('saved_voyage_scenarios', {}),
  saveVoyageScenario: (voyageId: string, scenarioData: unknown) => {
    const current = StorageService.getSavedScenarios();
    current[voyageId] = scenarioData;
    setStored('saved_voyage_scenarios', current);
  },
  getVoyageHistory: (): ActionHistoryEntry[] => getStored('voyage_history', []),
  addVoyageHistory: (entry: ActionHistoryEntry) => {
    const current = StorageService.getVoyageHistory();
    setStored('voyage_history', [entry, ...current]);
  },

  // Safety overrides and history
  getSafetyOverrides: (): Record<
    string,
    {
      status?: string;
      responsible_owner?: string;
      immediate_action?: string;
      severity?: Severity;
      risk_score?: number;
    }
  > => getStored('safety_overrides', {}),
  saveSafetyOverride: (
    eventId: string,
    updates: {
      status?: string;
      responsible_owner?: string;
      immediate_action?: string;
      severity?: Severity;
      risk_score?: number;
    }
  ) => {
    const current = StorageService.getSafetyOverrides();
    current[eventId] = { ...current[eventId], ...updates };
    setStored('safety_overrides', current);
  },
  getSafetyHistory: (): ActionHistoryEntry[] => getStored('safety_history', []),
  addSafetyHistory: (entry: ActionHistoryEntry) => {
    const current = StorageService.getSafetyHistory();
    setStored('safety_history', [entry, ...current]);
  },

  // Automation overrides and history
  getAutomationOverrides: (): Record<
    string,
    {
      status?: AutomationStatus;
      assigned_owner?: string;
      final_decision?: string | null;
      decision_comment?: string | null;
    }
  > => getStored('automation_overrides', {}),
  saveAutomationOverride: (
    taskId: string,
    updates: {
      status?: AutomationStatus;
      assigned_owner?: string;
      final_decision?: string | null;
      decision_comment?: string | null;
    }
  ) => {
    const current = StorageService.getAutomationOverrides();
    current[taskId] = { ...current[taskId], ...updates };
    setStored('automation_overrides', current);
  },
  getAutomationHistory: (): ActionHistoryEntry[] => getStored('automation_history', []),
  addAutomationHistory: (entry: ActionHistoryEntry) => {
    const current = StorageService.getAutomationHistory();
    setStored('automation_history', [entry, ...current]);
  },

  // Work order counter
  getNextWorkOrderReference: (): string => {
    const current = getStored('wo_counter', 1);
    setStored('wo_counter', current + 1);
    return `WO-2026-${String(current).padStart(4, '0')}`;
  },

  // Reset demo state back to pristine static dataset
  resetDemoState: (): void => {
    const keys = Object.keys(localStorage);
    for (const k of keys) {
      if (k.startsWith(PREFIX)) {
        localStorage.removeItem(k);
      }
    }
  },
};
