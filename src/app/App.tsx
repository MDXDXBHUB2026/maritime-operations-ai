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

export const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<ExecutiveDashboardPage />} />
          <Route path="fleet" element={<FleetOverviewPage />} />
          <Route path="anomalies" element={<AnomalyDetectionPage />} />
          <Route path="maintenance" element={<PredictiveMaintenancePage />} />
          <Route path="voyage" element={<VoyageOptimisationPage />} />
          <Route path="safety" element={<SafetyMonitoringPage />} />
          <Route path="automation" element={<AutomationCentrePage />} />
          <Route path="assurance" element={<AssuranceCentrePage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};
