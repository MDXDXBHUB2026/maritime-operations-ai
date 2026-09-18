import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { ExecutiveDashboardPage } from '../modules/executive/ExecutiveDashboardPage';
import { FleetOverviewPage } from '../modules/fleet/FleetOverviewPage';
import { AnomalyDetectionPage } from '../modules/anomalies/AnomalyDetectionPage';
import { PredictiveMaintenancePage } from '../modules/maintenance/PredictiveMaintenancePage';
import { VoyageOptimisationPage } from '../modules/voyage/VoyageOptimisationPage';
import { SafetyMonitoringPage } from '../modules/safety/SafetyMonitoringPage';
import { AutomationCentrePage } from '../modules/automation/AutomationCentrePage';
import { AssuranceCentrePage } from '../modules/assurance/AssuranceCentrePage';

// AI Enterprise Control Tower Modules
import { ExecutiveCommandCentrePage } from '../modules/enterprise/command-centre/ExecutiveCommandCentrePage';
import { OrganizationPage } from '../modules/enterprise/organization/OrganizationPage';
import { WorkforcePage } from '../modules/enterprise/workforce/WorkforcePage';
import { TaskOperationsPage } from '../modules/enterprise/tasks/TaskOperationsPage';
import { ApprovalInboxPage } from '../modules/enterprise/approvals/ApprovalInboxPage';
import { LiveActivityPage } from '../modules/enterprise/activity/LiveActivityPage';
import { PerformancePage } from '../modules/enterprise/performance/PerformancePage';
import { GovernancePage } from '../modules/enterprise/governance/GovernancePage';

export const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          {/* Maritime Operations Modules */}
          <Route path="dashboard" element={<ExecutiveDashboardPage />} />
          <Route path="fleet" element={<FleetOverviewPage />} />
          <Route path="anomalies" element={<AnomalyDetectionPage />} />
          <Route path="maintenance" element={<PredictiveMaintenancePage />} />
          <Route path="voyage" element={<VoyageOptimisationPage />} />
          <Route path="safety" element={<SafetyMonitoringPage />} />
          <Route path="automation" element={<AutomationCentrePage />} />
          <Route path="assurance" element={<AssuranceCentrePage />} />

          {/* AI Enterprise Control Tower Modules */}
          <Route path="command-centre" element={<ExecutiveCommandCentrePage />} />
          <Route path="organization" element={<OrganizationPage />} />
          <Route path="workforce" element={<WorkforcePage />} />
          <Route path="tasks" element={<TaskOperationsPage />} />
          <Route path="approvals" element={<ApprovalInboxPage />} />
          <Route path="activity" element={<LiveActivityPage />} />
          <Route path="performance" element={<PerformancePage />} />
          <Route path="governance" element={<GovernancePage />} />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};
