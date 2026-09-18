import { describe, it, expect, beforeEach } from 'vitest';
import {
  EnterpriseStorage,
  AgentService,
  TaskService,
  CapabilityService,
} from '../../../src/services/enterprise';
import { StorageService } from '../../../src/services/storageService';

describe('Reset State & Demo Isolation', () => {
  beforeEach(() => {
    EnterpriseStorage.resetAll();
  });

  it('restores initial pristine state after multiple state modifications', () => {
    // Modify an agent: pause it
    AgentService.pauseAgent('AGT-FLT-001', 'Test Pause');
    expect(AgentService.getAgent('AGT-FLT-001')?.status).toBe('PAUSED');

    // Modify a task: request retry
    TaskService.requestRetry('TSK-MNT-301');

    // Modify a capability: set unavailable
    CapabilityService.toggleCapabilityStatus('CAP-WEATHER-ROUTE', 'UNAVAILABLE');
    expect(CapabilityService.getCapability('CAP-WEATHER-ROUTE')?.status).toBe('UNAVAILABLE');

    // Call EnterpriseStorage.resetAll() directly
    EnterpriseStorage.resetAll();

    // Verify pristine state restored
    expect(AgentService.getAgent('AGT-FLT-001')?.status).toBe('ACTIVE');
    expect(CapabilityService.getCapability('CAP-WEATHER-ROUTE')?.status).toBe('AVAILABLE');
  });

  it('resets enterprise state through storageService resetDemoState', () => {
    AgentService.pauseAgent('AGT-FLT-001', 'Test Pause');
    expect(AgentService.getAgent('AGT-FLT-001')?.status).toBe('PAUSED');

    // Reset via StorageService.resetDemoState() which resets both maritime and enterprise
    StorageService.resetDemoState();

    expect(AgentService.getAgent('AGT-FLT-001')?.status).toBe('ACTIVE');
  });
});
