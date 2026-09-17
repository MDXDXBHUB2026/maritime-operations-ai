import { Alert, Equipment, SafetyEvent, Vessel, Voyage } from '../types/maritime';

export function healthCategory(score: number): 'Healthy' | 'Warning' | 'Critical' {
  if (score >= 80) return 'Healthy';
  if (score >= 60) return 'Warning';
  return 'Critical';
}

export function equipmentHealthCounts(equipment: Equipment[]): {
  Healthy: number;
  Warning: number;
  Critical: number;
} {
  const counts = { Healthy: 0, Warning: 0, Critical: 0 };
  for (const item of equipment) {
    const cat = healthCategory(item.health_score);
    counts[cat]++;
  }
  return counts;
}

export function dashboardKpis(
  vessels: Vessel[],
  voyages: Voyage[],
  equipment: Equipment[],
  alerts: Alert[],
  safety: SafetyEvent[]
): Record<string, string | number> {
  const activeVessels = vessels.filter((v) =>
    ['Underway', 'At berth', 'In Port', 'At Anchorage'].includes(v.operational_status)
  ).length;

  const criticalAlerts = alerts.filter(
    (a) => a.severity === 'Critical' && a.status !== 'Closed'
  ).length;

  const predictedFailures = equipment.filter(
    (e) => e.predicted_failure_days >= 0 && e.predicted_failure_days <= 30
  ).length;

  const delayedVoyages = voyages.filter(
    (voy) => new Date(voy.predicted_eta) > new Date(voy.planned_eta)
  ).length;

  const potentialSaving =
    voyages.length > 0
      ? voyages.reduce((acc, voy) => acc + (voy.potential_fuel_saving_pct || 0), 0) / voyages.length
      : 0;

  const highRiskSafety = safety.filter(
    (s) => s.risk_level === 'High' && s.status !== 'Closed'
  ).length;

  return {
    'Active vessels': activeVessels,
    'Critical alerts': criticalAlerts,
    'Predicted failures (30d)': predictedFailures,
    'Delayed voyages': delayedVoyages,
    'Potential fuel saving': `${potentialSaving.toFixed(1)}%`,
    'Open high-risk safety': highRiskSafety,
  };
}

export function maintenanceSummary(equipment: Equipment[]): {
  'Due in 7 days': number;
  Overdue: number;
  'Work orders open': number;
} {
  return {
    'Due in 7 days': equipment.filter((e) => e.maintenance_due_days <= 7).length,
    Overdue: equipment.filter((e) => e.maintenance_due_days < 0).length,
    'Work orders open': equipment.filter((e) => e.maintenance_status !== 'Complete').length,
  };
}
