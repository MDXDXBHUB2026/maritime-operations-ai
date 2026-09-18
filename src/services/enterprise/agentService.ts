import { Agent } from '../../domain/enterprise';
import { AuditService } from './auditService';
import { CapabilityService } from './capabilityService';
import { EnterpriseStorage } from './enterpriseStorage';
import { EventService } from './eventService';

export interface AgentFilter {
  departmentId?: string;
  status?: string;
  riskLevel?: string;
  operationalMode?: string;
  searchQuery?: string;
}

export interface IAgentService {
  getAgents(filter?: AgentFilter): Agent[];
  getAgent(id: string): Agent | undefined;
  pauseAgent(id: string, reason?: string): Agent | undefined;
  resumeAgent(id: string): Agent | undefined;
  toggleAgentTool(agentId: string, toolId: string, enabled: boolean): Agent | undefined;
}

export const AgentService: IAgentService = {
  getAgents: (filter) => {
    let list = EnterpriseStorage.getAgents();

    // Dynamically recalculate operational modes based on current capabilities
    list = list.map((agent) => {
      const { mode } = CapabilityService.getAgentOperationalMode(agent.requiredCapabilities);
      if (agent.status !== 'PAUSED' && agent.operationalMode !== mode) {
        return { ...agent, operationalMode: mode };
      }
      return agent;
    });

    if (!filter) return list;

    if (filter.departmentId) {
      list = list.filter((a) => a.departmentId === filter.departmentId);
    }
    if (filter.status) {
      list = list.filter((a) => a.status === filter.status);
    }
    if (filter.riskLevel) {
      list = list.filter((a) => a.riskLevel === filter.riskLevel);
    }
    if (filter.operationalMode) {
      list = list.filter((a) => a.operationalMode === filter.operationalMode);
    }
    if (filter.searchQuery) {
      const q = filter.searchQuery.toLowerCase();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.displayName.toLowerCase().includes(q) ||
          a.role.toLowerCase().includes(q) ||
          a.id.toLowerCase().includes(q)
      );
    }
    return list;
  },

  getAgent: (id) => {
    const agent = EnterpriseStorage.getAgents().find((a) => a.id === id);
    if (!agent) return undefined;
    const { mode } = CapabilityService.getAgentOperationalMode(agent.requiredCapabilities);
    return { ...agent, operationalMode: mode };
  },

  pauseAgent: (id, reason = 'Operator manual management pause') => {
    const agents = EnterpriseStorage.getAgents();
    const target = agents.find((a) => a.id === id);
    if (!target) return undefined;

    const oldStatus = target.status;
    target.status = 'PAUSED';
    target.statusReason = reason;
    EnterpriseStorage.setAgents([...agents]);

    EventService.publish({
      eventType: 'AGENT_PAUSED',
      actorId: 'HUMAN_EXECUTIVE',
      actorName: 'Human Management Intervention',
      departmentId: target.departmentId,
      severity: 'HIGH',
      summary: `Agent ${target.displayName} (${target.id}) was paused by management. Reason: ${reason}.`,
      details: { agentId: id, oldStatus, newStatus: 'PAUSED' },
    });

    AuditService.record({
      actorId: 'HUMAN_EXECUTIVE',
      actorName: 'Human Management',
      action: 'PAUSE_AGENT',
      targetType: 'AGENT',
      targetId: id,
      targetName: target.name,
      beforeState: oldStatus,
      afterState: 'PAUSED',
      result: 'SUCCESS',
      reason,
      source: 'SIMULATED_CONTROL_PANEL',
    });

    return target;
  },

  resumeAgent: (id) => {
    const agents = EnterpriseStorage.getAgents();
    const target = agents.find((a) => a.id === id);
    if (!target) return undefined;

    const oldStatus = target.status;
    target.status = target.currentTaskId ? 'ACTIVE' : 'AVAILABLE';
    target.statusReason = 'Resumed by operator. Autonomous execution active.';
    EnterpriseStorage.setAgents([...agents]);

    EventService.publish({
      eventType: 'AGENT_RESUMED',
      actorId: 'HUMAN_EXECUTIVE',
      actorName: 'Human Management Intervention',
      departmentId: target.departmentId,
      severity: 'INFO',
      summary: `Agent ${target.displayName} (${target.id}) was resumed by management.`,
      details: { agentId: id, oldStatus, newStatus: target.status },
    });

    AuditService.record({
      actorId: 'HUMAN_EXECUTIVE',
      actorName: 'Human Management',
      action: 'RESUME_AGENT',
      targetType: 'AGENT',
      targetId: id,
      targetName: target.name,
      beforeState: oldStatus,
      afterState: target.status,
      result: 'SUCCESS',
      reason: 'Manual resume action.',
      source: 'SIMULATED_CONTROL_PANEL',
    });

    return target;
  },

  toggleAgentTool: (agentId, toolId, enabled) => {
    const agents = EnterpriseStorage.getAgents();
    const target = agents.find((a) => a.id === agentId);
    if (!target) return undefined;

    const tool = target.tools.find((t) => t.id === toolId);
    if (!tool) return undefined;

    tool.isEnabled = enabled;
    EnterpriseStorage.setAgents([...agents]);

    EventService.publish({
      eventType: enabled ? 'TOOL_ENABLED' : 'TOOL_DISABLED',
      actorId: 'HUMAN_EXECUTIVE',
      actorName: 'Platform Operations',
      departmentId: target.departmentId,
      severity: enabled ? 'INFO' : 'MEDIUM',
      summary: `Tool ${tool.name} (${tool.id}) for agent ${target.name} set to ${enabled ? 'ENABLED' : 'DISABLED'}.`,
    });

    AuditService.record({
      actorId: 'HUMAN_EXECUTIVE',
      actorName: 'Platform Operations',
      action: enabled ? 'ENABLE_TOOL' : 'DISABLE_TOOL',
      targetType: 'AGENT',
      targetId: agentId,
      targetName: `${target.name} -> ${tool.name}`,
      beforeState: enabled ? 'DISABLED' : 'ENABLED',
      afterState: enabled ? 'ENABLED' : 'DISABLED',
      result: 'SUCCESS',
      source: 'SIMULATED_CONTROL_PANEL',
    });

    return target;
  },
};
