export type AssuranceSeverity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational';
export type VerificationStatus =
  'Confirmed' | 'Partially Verified' | 'Observation' | 'Requires Manual Verification';

export interface AssuranceFinding {
  id: string;
  agent: 'QA Agent' | 'Security Agent' | 'Finding Verifier';
  title: string;
  category: string;
  severity: AssuranceSeverity;
  confidence: number;
  verificationStatus: VerificationStatus;
  affectedArea: string;
  description: string;
  evidence: string; // Redacted, e.g. ghp_abcd********wxyz
  impact: string;
  reproductionSteps: string[];
  expectedResult: string;
  actualResult: string;
  remediation: string;
  verificationTest?: string;
  owaspMapping?: string;
  cweMapping?: string;
}

export interface PositiveControl {
  id: string;
  category: string;
  description: string;
  verificationMethod: string;
  status: 'Passed' | 'Active';
}

export interface QACheckResult {
  tool: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  details: string;
  testCount?: number;
  passedCount?: number;
  failedCount?: number;
}

export interface SecurityCheckResult {
  check: string;
  status: 'passed' | 'failed' | 'warning';
  findingsCount: number;
  details: string;
}

export interface AssuranceReport {
  runId: string;
  commitSha: string;
  timestamp: string;
  status: 'PASSED' | 'FAILED' | 'WARNING';
  environment: string;
  summary: {
    totalFindings: number;
    criticalFindings: number;
    highFindings: number;
    mediumFindings: number;
    lowFindings: number;
    informationalFindings: number;
    qaGateStatus: 'PASSED' | 'FAILED';
    securityGateStatus: 'PASSED' | 'FAILED';
    positiveControlsCount: number;
  };
  qa: {
    status: 'PASSED' | 'FAILED';
    checks: Record<string, QACheckResult>;
    totalTests: number;
    passedDailyTests: number;
  };
  security: {
    status: 'PASSED' | 'FAILED' | 'WARNING';
    checks: Record<string, SecurityCheckResult>;
  };
  findings: AssuranceFinding[];
  positiveControls: PositiveControl[];
  remediationRoadmap: {
    priority: number;
    findingId: string;
    action: string;
    timeline: string;
  }[];
}
