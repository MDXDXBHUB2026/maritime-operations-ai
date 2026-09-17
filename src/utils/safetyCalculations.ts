import { SafetyEvent } from '../types/maritime';

export function safetyKpis(events: SafetyEvent[]): Record<string, string | number> {
  const openEvents = events.filter((e) => e.status !== 'Closed');
  const critical = openEvents.filter((e) => e.severity === 'Critical').length;
  const nearMisses = events.filter((e) => e.event_type === 'Near miss').length;
  const overdue = events.filter((e) => Boolean(e.overdue_flag)).length;

  const highRiskLocations = new Set(
    events.filter((e) => (e.risk_score || 0) >= 70).map((e) => e.location)
  ).size;

  return {
    'Open safety events': openEvents.length,
    'Critical events': critical,
    'Near misses': nearMisses,
    'Overdue actions': overdue,
    'High-risk locations': highRiskLocations,
    'Days without LTI': 126,
  };
}
