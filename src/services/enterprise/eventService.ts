import { EnterpriseEvent } from '../../domain/enterprise';
import { EnterpriseStorage } from './enterpriseStorage';

export interface EventFilter {
  departmentId?: string;
  actorId?: string;
  eventType?: string;
  severity?: string;
  taskId?: string;
}

export interface IEventService {
  publish(eventData: Omit<EnterpriseEvent, 'eventId' | 'timestamp'>): EnterpriseEvent;
  getEvents(filter?: EventFilter): EnterpriseEvent[];
  getRecentEvents(limit?: number): EnterpriseEvent[];
}

export const EventService: IEventService = {
  publish: (eventData) => {
    const current = EnterpriseStorage.getEvents();
    const eventId = `EVT-${String(Date.now()).slice(-6)}${Math.floor(Math.random() * 100)}`;
    const newEvent: EnterpriseEvent = {
      ...eventData,
      eventId,
      timestamp: new Date().toISOString(),
    };
    EnterpriseStorage.setEvents([newEvent, ...current]);
    return newEvent;
  },

  getEvents: (filter) => {
    let list = EnterpriseStorage.getEvents();
    if (!filter) return list;

    if (filter.departmentId) {
      list = list.filter((e) => e.departmentId === filter.departmentId);
    }
    if (filter.actorId) {
      list = list.filter((e) => e.actorId === filter.actorId);
    }
    if (filter.eventType) {
      list = list.filter((e) => e.eventType === filter.eventType);
    }
    if (filter.severity) {
      list = list.filter((e) => e.severity === filter.severity);
    }
    if (filter.taskId) {
      list = list.filter((e) => e.taskId === filter.taskId);
    }
    return list;
  },

  getRecentEvents: (limit = 10) => {
    return EnterpriseStorage.getEvents().slice(0, limit);
  },
};
