import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AssuranceCentrePage } from '../../src/modules/assurance/AssuranceCentrePage';
import { AssuranceReport } from '../../src/types/assurance';

const mockReport: AssuranceReport = {
  runId: 'test_run_123',
  commitSha: 'a1b2c3d',
  timestamp: '2026-09-17T20:00:00.000Z',
  status: 'PASSED',
  environment: 'Test Environment',
  summary: {
    totalFindings: 1,
    criticalFindings: 0,
    highFindings: 0,
    mediumFindings: 1,
    lowFindings: 0,
    informationalFindings: 0,
    qaGateStatus: 'PASSED',
    securityGateStatus: 'PASSED',
    positiveControlsCount: 2,
  },
  qa: {
    status: 'PASSED',
    checks: {
      unit_tests: {
        tool: 'vitest',
        status: 'passed',
        durationMs: 120,
        details: '5 of 5 unit tests passed',
      },
    },
    totalTests: 5,
    passedDailyTests: 5,
  },
  security: {
    status: 'PASSED',
    checks: {
      secret_scan: {
        check: 'hardcoded secret scan',
        status: 'passed',
        findingsCount: 0,
        details: '0 exposed secrets',
      },
    },
  },
  findings: [
    {
      id: 'SEC-TEST-001',
      agent: 'Security Agent',
      title: 'Sample Test Finding',
      category: 'Static Analysis',
      severity: 'Medium',
      confidence: 0.9,
      verificationStatus: 'Confirmed',
      affectedArea: 'src/modules/test.tsx',
      description: 'Test finding description',
      evidence: 'test_evidence_ghp_abcd********wxyz',
      impact: 'Test impact',
      reproductionSteps: ['Step 1'],
      expectedResult: 'Expected safe',
      actualResult: 'Actual warning',
      remediation: 'Remediate test',
    },
  ],
  positiveControls: [
    {
      id: 'PC-REDACT-001',
      category: 'Secret Redaction',
      description: 'Secret redaction test verification',
      verificationMethod: 'redactSecret() check',
      status: 'Passed',
    },
  ],
  remediationRoadmap: [
    {
      priority: 1,
      findingId: 'SEC-TEST-001',
      action: 'Remediate test finding',
      timeline: 'Current Milestone',
    },
  ],
};

describe('AssuranceCentrePage Component Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading indicator and then successfully displays valid assurance report', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockReport,
    } as Response);

    render(<AssuranceCentrePage />);

    expect(screen.getByText(/Loading Application Assurance Platform data/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Application Assurance Centre/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/test_run_123/i)).toBeInTheDocument();
    expect(screen.getByText(/Sample Test Finding/i)).toBeInTheDocument();
    expect(screen.getByText(/PC-REDACT-001/i)).toBeInTheDocument();
  });

  it('handles missing assurance report (404) gracefully with error state', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    } as Response);

    render(<AssuranceCentrePage />);

    await waitFor(() => {
      expect(screen.getByText(/Assurance Pipeline Data Unavailable/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Retry Loading Results/i)).toBeInTheDocument();
    expect(screen.getByText(/View GitHub Actions/i)).toBeInTheDocument();
  });

  it('handles malformed JSON structure gracefully without crashing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ unexpectedKey: true }),
    } as Response);

    render(<AssuranceCentrePage />);

    await waitFor(() => {
      expect(screen.getByText(/Assurance Pipeline Data Unavailable/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Malformed assurance report JSON structure/i)).toBeInTheDocument();
  });

  it('correctly displays normalized finding confidence formatted as percentage (90%, not 0.9%)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockReport,
    } as Response);

    render(<AssuranceCentrePage />);

    await waitFor(() => {
      expect(screen.getByText(/Sample Test Finding/i)).toBeInTheDocument();
    });

    // Expand finding detail
    const row = screen.getByText(/Sample Test Finding/i).closest('tr');
    expect(row).toBeInTheDocument();
    fireEvent.click(row!);

    await waitFor(() => {
      expect(screen.getByText(/Confidence:/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/90%/i)).toBeInTheDocument();
    expect(screen.queryByText(/0\.9%/)).not.toBeInTheDocument();
  });
});
