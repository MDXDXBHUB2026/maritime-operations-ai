import { AutomationTask } from '../types/maritime';

export function automationKpis(tasks: AutomationTask[]): Record<string, string | number> {
  const openTasks = tasks.filter(
    (t) => !['Closed', 'Executed', 'Rejected'].includes(t.status)
  ).length;

  const awaitingApproval = tasks.filter((t) => t.status === 'Awaiting Approval').length;

  let latestDateStr = '';
  for (const t of tasks) {
    const dStr = t.created_timestamp ? t.created_timestamp.substring(0, 10) : '';
    if (dStr > latestDateStr) latestDateStr = dStr;
  }

  const approvedToday = tasks.filter(
    (t) =>
      t.status === 'Approved' &&
      t.created_timestamp &&
      t.created_timestamp.startsWith(latestDateStr)
  ).length;

  const rejectedToday = tasks.filter(
    (t) =>
      t.status === 'Rejected' &&
      t.created_timestamp &&
      t.created_timestamp.startsWith(latestDateStr)
  ).length;

  const totalMinutes = tasks.reduce((acc, t) => acc + (t.estimated_time_saved_minutes || 0), 0);
  const totalValue = tasks.reduce((acc, t) => acc + (t.estimated_value_usd || 0), 0);

  return {
    'Open tasks': openTasks,
    'Awaiting approval': awaitingApproval,
    'Approved today': approvedToday,
    'Rejected today': rejectedToday,
    'Estimated hours saved': (totalMinutes / 60).toFixed(1),
    'Estimated value': `$${Math.round(totalValue).toLocaleString()}`,
  };
}
