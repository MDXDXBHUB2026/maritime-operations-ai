import { BusinessCapability, CapabilityStatus, OperationalMode } from '../../domain/enterprise';
import { AuditService } from './auditService';
import { EnterpriseStorage } from './enterpriseStorage';
import { EventService } from './eventService';

export interface ICapabilityService {
  getCapabilities(): BusinessCapability[];
  getCapability(id: string): BusinessCapability | undefined;
  toggleCapabilityStatus(id: string, newStatus: CapabilityStatus): BusinessCapability | undefined;
  getAgentOperationalMode(requiredCapabilityIds: string[]): {
    mode: OperationalMode;
    missingCapabilityNames: string[];
  };
}

export const CapabilityService: ICapabilityService = {
  getCapabilities: () => EnterpriseStorage.getCapabilities(),

  getCapability: (id) => EnterpriseStorage.getCapabilities().find((c) => c.id === id),

  toggleCapabilityStatus: (id, newStatus) => {
    const caps = EnterpriseStorage.getCapabilities();
    const target = caps.find((c) => c.id === id);
    if (!target) return undefined;

    const oldStatus = target.status;
    target.status = newStatus;
    EnterpriseStorage.setCapabilities([...caps]);

    // Recalculate operational mode for dependent agents
    const agents = EnterpriseStorage.getAgents();
    let agentsUpdated = false;
    for (const agent of agents) {
      if (agent.requiredCapabilities.includes(id)) {
        const { mode } = CapabilityService.getAgentOperationalMode(agent.requiredCapabilities);
        if (agent.operationalMode !== mode) {
          agent.operationalMode = mode;
          agentsUpdated = true;
        }
      }
    }
    if (agentsUpdated) {
      EnterpriseStorage.setAgents([...agents]);
    }

    // Publish event
    EventService.publish({
      eventType: 'CAPABILITY_TOGGLED',
      actorId: 'POL-ENGINE',
      actorName: 'Capability Governance Engine',
      departmentId: 'DEPT-DIGITAL',
      severity: newStatus === 'UNAVAILABLE' ? 'HIGH' : newStatus === 'DEGRADED' ? 'MEDIUM' : 'INFO',
      summary: `Business Capability ${target.name} (${target.code}) transitioned from ${oldStatus} to ${newStatus}.`,
      details: { capabilityId: id, oldStatus, newStatus },
    });

    // Record audit
    AuditService.record({
      actorId: 'POL-ENGINE',
      actorName: 'Capability Registry',
      action: 'TOGGLE_CAPABILITY_STATUS',
      targetType: 'CAPABILITY',
      targetId: id,
      targetName: target.name,
      beforeState: oldStatus,
      afterState: newStatus,
      result: 'SUCCESS',
      reason: `Operator simulated capability transition to ${newStatus}.`,
      source: 'SIMULATED_CONTROL_PANEL',
    });

    return target;
  },

  getAgentOperationalMode: (requiredCapabilityIds) => {
    const caps = EnterpriseStorage.getCapabilities();
    const missing: string[] = [];
    let hasUnavailable = false;
    let hasDegraded = false;

    for (const capId of requiredCapabilityIds) {
      const cap = caps.find((c) => c.id === capId);
      if (!cap || cap.status === 'UNAVAILABLE') {
        hasUnavailable = true;
        missing.push(cap ? cap.name : capId);
      } else if (cap.status === 'DEGRADED' || cap.status === 'SIMULATED') {
        hasDegraded = true;
      }
    }

    if (hasUnavailable) {
      return { mode: 'DEGRADED', missingCapabilityNames: missing };
    }
    if (hasDegraded) {
      return { mode: 'LIMITED', missingCapabilityNames: missing };
    }
    return { mode: 'FULL', missingCapabilityNames: [] };
  },
};
