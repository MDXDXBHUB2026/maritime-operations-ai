import { MaintenanceAsset } from '../types/maritime';

export function healthClass(score: number): 'Healthy' | 'Warning' | 'Critical' {
  if (score >= 80) return 'Healthy';
  if (score >= 60) return 'Warning';
  return 'Critical';
}

export function maintenanceKpis(assets: MaintenanceAsset[]): Record<string, string | number> {
  const today = new Date('2026-07-23');
  const criticalCount = assets.filter((a) => a.health_score < 60).length;
  const failures30d = assets.filter((a) => a.remaining_useful_life_hours < 720).length;
  const overdue = assets.filter((a) => new Date(a.next_planned_maintenance_date) < today).length;
  const awaitingSpares = assets.filter((a) => a.spare_part_availability === 'Unavailable').length;

  const exposure = assets
    .filter((a) => a.maintenance_status !== 'Completed')
    .reduce((acc, a) => acc + (a.estimated_failure_cost_usd || 0), 0);

  return {
    'Assets monitored': assets.length,
    'Critical assets': criticalCount,
    'Failures within 30d': failures30d,
    'Overdue maintenance': overdue,
    'Awaiting spare parts': awaitingSpares,
    'Failure exposure': `$${(exposure / 1000000).toFixed(2)}M`,
  };
}
