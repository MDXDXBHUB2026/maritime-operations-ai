import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ExecutiveCommandCentrePage } from '../../../src/modules/enterprise/command-centre/ExecutiveCommandCentrePage';
import { OrganizationPage } from '../../../src/modules/enterprise/organization/OrganizationPage';
import { WorkforcePage } from '../../../src/modules/enterprise/workforce/WorkforcePage';
import { TaskOperationsPage } from '../../../src/modules/enterprise/tasks/TaskOperationsPage';
import { ApprovalInboxPage } from '../../../src/modules/enterprise/approvals/ApprovalInboxPage';
import { GovernancePage } from '../../../src/modules/enterprise/governance/GovernancePage';
import { EnterpriseStorage } from '../../../src/services/enterprise';

describe('Enterprise Control Tower Component Views', () => {
  beforeEach(() => {
    EnterpriseStorage.resetAll();
  });

  it('renders Executive Command Centre with KPIs and Attention items', () => {
    render(
      <MemoryRouter>
        <ExecutiveCommandCentrePage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('executive-command-centre')).toBeInTheDocument();
    expect(screen.getByText('Executive Command Centre')).toBeInTheDocument();
    expect(screen.getByText(/NEEDS ATTENTION/i)).toBeInTheDocument();
    expect(screen.getByText(/NO ACTION REQUIRED/i)).toBeInTheDocument();
    expect(screen.getByText(/DEPARTMENTAL HEALTH/i)).toBeInTheDocument();
  });

  it('renders Interactive Organization Chart with hierarchy levels', () => {
    render(
      <MemoryRouter>
        <OrganizationPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('organization-page')).toBeInTheDocument();
    expect(screen.getByText('Enterprise Organization Hierarchy')).toBeInTheDocument();
    expect(screen.getByText('Capt. Alexander Vance')).toBeInTheDocument();
    expect(screen.getByText('Athena Executive Advisor')).toBeInTheDocument();
  });

  it('renders AI Workforce Directory with agent cards', () => {
    render(
      <MemoryRouter>
        <WorkforcePage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('workforce-page')).toBeInTheDocument();
    expect(screen.getByText('AI Workforce Directory')).toBeInTheDocument();
    expect(screen.getByText('Predictive Maintenance Agent')).toBeInTheDocument();
    expect(screen.getByText('Voyage Optimisation Agent')).toBeInTheDocument();
  });

  it('renders Task Operations Register with task list', () => {
    render(
      <MemoryRouter>
        <TaskOperationsPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('task-operations-page')).toBeInTheDocument();
    expect(screen.getByText('Task Operations Register')).toBeInTheDocument();
    expect(screen.getByText(/MV Horizon Star ME #3 Exhaust Gas Anomaly/i)).toBeInTheDocument();
  });

  it('renders Decision & Approval Inbox with pending requests', () => {
    render(
      <MemoryRouter>
        <ApprovalInboxPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('approval-inbox-page')).toBeInTheDocument();
    expect(screen.getByText('Decision & Approval Inbox')).toBeInTheDocument();
    expect(screen.getByText(/MV Horizon Star ME #3 Exhaust Gas Anomaly/i)).toBeInTheDocument();
  });

  it('renders Governance and Capability Registry with policies and audit trail', () => {
    render(
      <MemoryRouter>
        <GovernancePage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('governance-page')).toBeInTheDocument();
    expect(screen.getByText('Enterprise Governance & Capability Registry')).toBeInTheDocument();
    expect(screen.getByTestId('tab-capabilities')).toBeInTheDocument();
    expect(screen.getByTestId('tab-policies')).toBeInTheDocument();
    expect(screen.getByTestId('tab-audit-trail')).toBeInTheDocument();
  });
});
