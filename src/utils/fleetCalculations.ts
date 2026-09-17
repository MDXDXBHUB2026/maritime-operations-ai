import { Vessel } from '../types/maritime';

export function healthBand(score: number): 'Healthy' | 'Warning' | 'Critical' {
  if (score >= 80) return 'Healthy';
  if (score >= 60) return 'Warning';
  return 'Critical';
}

export function fleetKpis(vessels: Vessel[]): Record<string, string | number> {
  const delayed = vessels.filter((v) => {
    const isDelayedEta = new Date(v.predicted_eta) > new Date(v.planned_eta);
    return isDelayedEta || v.voyage_status === 'Delayed';
  }).length;

  const underway = vessels.filter((v) => v.operational_status === 'Underway').length;
  const inPort = vessels.filter((v) => v.operational_status === 'In Port').length;
  const criticalRisk = vessels.filter((v) => v.safety_risk_level === 'Critical').length;
  const avgHealth =
    vessels.length > 0
      ? vessels.reduce((acc, v) => acc + (v.technical_health_score || 0), 0) / vessels.length
      : 0;

  return {
    'Total vessels': vessels.length,
    'Vessels underway': underway,
    'Vessels in port': inPort,
    'Delayed vessels': delayed,
    'Critical risk': criticalRisk,
    'Average fleet health': avgHealth.toFixed(1),
  };
}
