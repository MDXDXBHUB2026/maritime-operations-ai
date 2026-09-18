import { describe, it, expect, beforeEach } from 'vitest';
import { CapabilityService, AgentService, EnterpriseStorage } from '../../../src/services/enterprise';

describe('Business Capability Registry & Operational Mode Derivation', () => {
  beforeEach(() => {
    EnterpriseStorage.resetAll();
  });

  it('loads all standard business capabilities', () => {
    const caps = CapabilityService.getCapabilities();
    expect(caps.length).toBeGreaterThanOrEqual(10);

    const fleetCap = CapabilityService.getCapability('CAP-FLT-MASTER');
    expect(fleetCap).toBeDefined();
    expect(fleetCap?.status).toBe('AVAILABLE');

    const sensorCap = CapabilityService.getCapability('CAP-SENSOR-IOT');
    expect(sensorCap).toBeDefined();
    expect(sensorCap?.status).toBe('SIMULATED');
  });

  it('evaluates agent mode as FULL when all required capabilities are available/simulated', () => {
    const agent = AgentService.getAgent('AGT-FLT-001'); // Fleet Monitoring Agent
    expect(agent).toBeDefined();
    if (agent) {
      const { mode } = CapabilityService.getAgentOperationalMode(agent.requiredCapabilities);
      expect(mode).toBe('FULL');
    }
  });

  it('evaluates agent mode as DEGRADED when a required capability is toggled to UNAVAILABLE', () => {
    // AGT-FLT-001 has required capability CAP-FLT-MASTER
    CapabilityService.toggleCapabilityStatus('CAP-FLT-MASTER', 'UNAVAILABLE');

    const agent = AgentService.getAgent('AGT-FLT-001');
    expect(agent).toBeDefined();
    if (agent) {
      const { mode } = CapabilityService.getAgentOperationalMode(agent.requiredCapabilities);
      expect(mode).toBe('DEGRADED');
    }
  });

  it('evaluates agent mode as LIMITED when a capability is toggled to DEGRADED', () => {
    CapabilityService.toggleCapabilityStatus('CAP-FLT-MASTER', 'DEGRADED');

    const agent = AgentService.getAgent('AGT-FLT-001');
    expect(agent).toBeDefined();
    if (agent) {
      const { mode } = CapabilityService.getAgentOperationalMode(agent.requiredCapabilities);
      expect(mode).toBe('LIMITED');
    }
  });
});
