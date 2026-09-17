import { Anomaly, Severity } from '../types/maritime';

export function deviationPercentage(current: number, expected: number): number {
  if (expected === 0) {
    return current === 0 ? 0 : 100;
  }
  return (Math.abs(current - expected) / Math.abs(expected)) * 100;
}

export function severityFromDeviation(deviation: number, thresholdBreach = false): Severity {
  if (deviation > 20 || (thresholdBreach && deviation >= 18)) {
    return 'Critical';
  }
  if (deviation >= 12) {
    return 'High';
  }
  if (deviation >= 6) {
    return 'Medium';
  }
  return 'Low';
}

export function anomalyKpis(anomalies: Anomaly[]): Record<string, string | number> {
  const active = anomalies.filter((a) => a.status !== 'Closed');
  const uniqueAssets = new Set(anomalies.map((a) => a.asset_id)).size;
  const critical = active.filter((a) => a.severity === 'Critical').length;
  const acknowledged = anomalies.filter((a) => a.status === 'Acknowledged').length;

  let latestDateStr = '';
  for (const a of anomalies) {
    const dStr = a.detected_timestamp ? a.detected_timestamp.substring(0, 10) : '';
    if (dStr > latestDateStr) latestDateStr = dStr;
  }

  const newToday = anomalies.filter(
    (a) => a.detected_timestamp && a.detected_timestamp.startsWith(latestDateStr)
  ).length;

  const avgConfidence =
    anomalies.length > 0
      ? anomalies.reduce((acc, a) => acc + (a.confidence_score || 0), 0) / anomalies.length
      : 0;

  return {
    'Assets monitored': uniqueAssets,
    'Active anomalies': active.length,
    'Critical anomalies': critical,
    'New anomalies today': newToday,
    'Acknowledged anomalies': acknowledged,
    'Average confidence': `${avgConfidence.toFixed(1)}%`,
  };
}
