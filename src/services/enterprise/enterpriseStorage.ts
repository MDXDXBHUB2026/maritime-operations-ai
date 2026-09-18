import {
  Agent,
  ApprovalRequest,
  AuditRecord,
  BusinessCapability,
  EnterpriseEvent,
  GovernancePolicy,
  Task,
} from '../../domain/enterprise';
import {
  INITIAL_AGENTS,
  INITIAL_APPROVALS,
  INITIAL_AUDIT_TRAIL,
  INITIAL_CAPABILITIES,
  INITIAL_EVENTS,
  INITIAL_POLICIES,
  INITIAL_TASKS,
} from '../../data/enterprise';

const PREFIX = 'maritime_ai_state_enterprise_';

type Listener = () => void;
const listeners = new Set<Listener>();

export function subscribeEnterpriseState(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyEnterpriseStateChanged(): void {
  listeners.forEach((l) => {
    try {
      l();
    } catch (err) {
      console.error('Error in enterprise state listener:', err);
    }
  });
}

function getItem<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return JSON.parse(JSON.stringify(defaultValue)) as T;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`Error reading enterprise storage key ${key}:`, err);
    return JSON.parse(JSON.stringify(defaultValue)) as T;
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Error writing enterprise storage key ${key}:`, err);
  }
}

export const EnterpriseStorage = {
  getAgents: (): Agent[] => getItem('agents', INITIAL_AGENTS),
  setAgents: (agents: Agent[]): void => {
    setItem('agents', agents);
    notifyEnterpriseStateChanged();
  },

  getTasks: (): Task[] => getItem('tasks', INITIAL_TASKS),
  setTasks: (tasks: Task[]): void => {
    setItem('tasks', tasks);
    notifyEnterpriseStateChanged();
  },

  getApprovals: (): ApprovalRequest[] => getItem('approvals', INITIAL_APPROVALS),
  setApprovals: (approvals: ApprovalRequest[]): void => {
    setItem('approvals', approvals);
    notifyEnterpriseStateChanged();
  },

  getCapabilities: (): BusinessCapability[] => getItem('capabilities', INITIAL_CAPABILITIES),
  setCapabilities: (caps: BusinessCapability[]): void => {
    setItem('capabilities', caps);
    notifyEnterpriseStateChanged();
  },

  getEvents: (): EnterpriseEvent[] => getItem('events', INITIAL_EVENTS),
  setEvents: (events: EnterpriseEvent[]): void => {
    setItem('events', events);
    notifyEnterpriseStateChanged();
  },

  getAuditTrail: (): AuditRecord[] => getItem('audit', INITIAL_AUDIT_TRAIL),
  setAuditTrail: (records: AuditRecord[]): void => {
    setItem('audit', records);
    notifyEnterpriseStateChanged();
  },

  getPolicies: (): GovernancePolicy[] => getItem('policies', INITIAL_POLICIES),
  setPolicies: (policies: GovernancePolicy[]): void => {
    setItem('policies', policies);
    notifyEnterpriseStateChanged();
  },

  resetAll: (): void => {
    const keys = Object.keys(localStorage);
    for (const k of keys) {
      if (k.startsWith(PREFIX)) {
        localStorage.removeItem(k);
      }
    }
    notifyEnterpriseStateChanged();
  },
};
