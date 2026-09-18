export type CapabilityStatus = 'AVAILABLE' | 'DEGRADED' | 'UNAVAILABLE' | 'SIMULATED';

export type OperationalMode = 'FULL' | 'LIMITED' | 'DEGRADED' | 'UNAVAILABLE';

export interface BusinessCapability {
  id: string;
  code: string;
  name: string;
  category:
    'TELEMETRY' | 'ANALYTICS' | 'INTEGRATION' | 'EXTERNAL_FEED' | 'ASSURANCE' | 'GOVERNANCE';
  status: CapabilityStatus;
  description: string;
  provider: string;
  isSimulated: boolean;
  dependentAgentIds: string[];
}
