import React, { useEffect, useState } from 'react';
import { ActionHistoryEntry, AutomationTask } from '../../types/maritime';
import { DataService } from '../../services/dataService';
import { StorageService } from '../../services/storageService';
import { automationKpis } from '../../utils/automationCalculations';
import { MetricCard } from '../../components/common/MetricCard';
import { BarChart } from '../../components/charts/BarChart';
import { Check, AlertTriangle, ShieldCheck } from 'lucide-react';

const OWNERS = [
  'Unassigned',
  'Digital Operations Analyst',
  'Operations Manager',
  'Fleet Technical Manager',
  'HSE Manager',
  'Finance Analyst',
];

export const AutomationCentrePage: React.FC = () => {
  const [tasks, setTasks] = useState<AutomationTask[]>([]);
  const [history, setHistory] = useState<ActionHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>('All');
  const [selectedSource, setSelectedSource] = useState<string>('All');
  const [selectedRisk, setSelectedRisk] = useState<string>('All');
  const [selectedLevel, setSelectedLevel] = useState<string>('All');
  const [selectedOwner, setSelectedOwner] = useState<string>('All');
  const [selectedApproval, setSelectedApproval] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');

  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [decisionComment, setDecisionComment] = useState<string>('');
  const [assignedOwner, setAssignedOwner] = useState<string>('Unassigned');
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await DataService.getAutomationTasks();
        const overrides = StorageService.getAutomationOverrides();
        const merged = data.map((t) => {
          const ov = overrides[t.task_id];
          return ov ? { ...t, ...ov } : t;
        });

        setTasks(merged);
        setHistory(StorageService.getAutomationHistory());

        if (merged.length > 0) {
          setSelectedTaskId(merged[0].task_id);
          setAssignedOwner(merged[0].assigned_owner || 'Unassigned');
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load automation data.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleAction = (actionName: string, newStatus: string, extras: { owner?: string } = {}) => {
    setActionError(null);
    if (!selectedTaskId) return;

    const current = tasks.find((t) => t.task_id === selectedTaskId);
    if (!current) return;

    const previousStatus = current.status;

    // MANDATORY APPROVAL GUARD
    if (actionName === 'Execute simulated action') {
      if (current.status === 'Rejected') {
        setActionError(`Action blocked for ${selectedTaskId}: Rejected tasks cannot be executed`);
        return;
      }
      if (Boolean(current.human_approval_required) && current.status !== 'Approved') {
        setActionError(
          `Action blocked for ${selectedTaskId}: This task must be approved before execution`
        );
        return;
      }
      if (current.risk_level === 'High' && current.status !== 'Approved') {
        setActionError(
          `Action blocked for ${selectedTaskId}: High-risk tasks require approval before execution`
        );
        return;
      }
    }

    let finalOwner = current.assigned_owner;
    if (extras.owner !== undefined) finalOwner = extras.owner;

    const updates: Partial<AutomationTask> = {
      status: newStatus as AutomationTask['status'],
      assigned_owner: finalOwner,
      final_decision: actionName,
      decision_comment: decisionComment.trim() || '—',
    };

    setTasks((prev) => prev.map((t) => (t.task_id === selectedTaskId ? { ...t, ...updates } : t)));
    StorageService.saveAutomationOverride(selectedTaskId, updates);

    const historyEntry: ActionHistoryEntry = {
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      task: selectedTaskId,
      action: actionName,
      previous_status: previousStatus,
      new_status: newStatus,
      owner: finalOwner,
      comment: decisionComment.trim() || '—',
    };

    StorageService.addAutomationHistory(historyEntry);
    setHistory((prev) => [historyEntry, ...prev]);

    setFlashMessage(`${selectedTaskId}: ${actionName} completed`);
    setDecisionComment('');
    setTimeout(() => setFlashMessage(null), 4000);
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: 'var(--muted)' }}>Loading Automation Centre...</div>
    );
  }

  if (error) {
    return (
      <div className="banner-error">
        <AlertTriangle size={18} />
        <span>{error}</span>
      </div>
    );
  }

  const kpis = automationKpis(tasks);

  // Apply filters
  const filteredTasks = tasks.filter((t) => {
    if (selectedWorkflow !== 'All' && t.workflow_name !== selectedWorkflow) return false;
    if (selectedSource !== 'All' && t.module_source !== selectedSource) return false;
    if (selectedRisk !== 'All' && t.risk_level !== selectedRisk) return false;
    if (selectedLevel !== 'All' && t.automation_level !== selectedLevel) return false;
    if (selectedOwner !== 'All' && t.assigned_owner !== selectedOwner) return false;
    if (selectedApproval !== 'All') {
      const isReq = Boolean(t.human_approval_required);
      if (selectedApproval === 'Yes' && !isReq) return false;
      if (selectedApproval === 'No' && isReq) return false;
    }
    if (selectedStatus !== 'All' && t.status !== selectedStatus) return false;
    return true;
  });

  const selectedTask =
    filteredTasks.find((t) => t.task_id === selectedTaskId) || filteredTasks[0] || tasks[0];

  const workflowsList = ['All', ...Array.from(new Set(tasks.map((t) => t.workflow_name))).sort()];
  const sourcesList = ['All', ...Array.from(new Set(tasks.map((t) => t.module_source))).sort()];
  const levelsList = ['All', ...Array.from(new Set(tasks.map((t) => t.automation_level))).sort()];
  const ownersList = ['All', ...Array.from(new Set(tasks.map((t) => t.assigned_owner))).sort()];
  const statusesList = ['All', ...Array.from(new Set(tasks.map((t) => t.status))).sort()];

  // Awaiting approval tasks
  const awaitingApproval = filteredTasks.filter((t) =>
    ['Awaiting Approval', 'Under Review'].includes(t.status)
  );

  // Chart data: Time-saving by module
  const timeByModule: Record<string, number> = {};
  filteredTasks.forEach((t) => {
    timeByModule[t.module_source] =
      (timeByModule[t.module_source] || 0) + t.estimated_time_saved_minutes;
  });
  const timeData = Object.entries(timeByModule).map(([mod, mins]) => ({
    label: mod.replace(' & Fuel', ''),
    value: Math.round(mins / 60), // in hours
    color: '#25c2d8',
  }));

  // Chart data: Value impact by workflow
  const valueByWorkflow: Record<string, number> = {};
  filteredTasks.forEach((t) => {
    valueByWorkflow[t.workflow_name] =
      (valueByWorkflow[t.workflow_name] || 0) + t.estimated_value_usd;
  });
  const valueData = Object.entries(valueByWorkflow)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([wf, val]) => ({
      label: wf,
      value: Math.round(val / 1000), // in $k
      color: '#4472e8',
    }));

  return (
    <div>
      <div className="eyebrow">HUMAN-CONTROLLED AUTOMATION</div>
      <h1>Operational Automation Centre</h1>
      <p className="subtitle">Review, approve and simulate controlled workflow execution</p>

      <div className="disclaimer-banner">
        This conceptual automation module uses synthetic tasks and recommendations. No production
        action, external message, document or transaction is executed.
      </div>

      {flashMessage && (
        <div className="banner-success">
          <Check size={16} />
          <span>{flashMessage}</span>
        </div>
      )}

      {actionError && (
        <div className="banner-error">
          <AlertTriangle size={16} />
          <span>{actionError}</span>
        </div>
      )}

      {/* KPIs */}
      <div className="grid-6">
        <MetricCard label="Open tasks" value={kpis['Open tasks']} icon="⚡" />
        <MetricCard label="Awaiting approval" value={kpis['Awaiting approval']} icon="⏳" />
        <MetricCard label="Approved today" value={kpis['Approved today']} icon="✓" />
        <MetricCard label="Rejected today" value={kpis['Rejected today']} icon="✕" />
        <MetricCard label="Estimated hours saved" value={kpis['Estimated hours saved']} icon="◷" />
        <MetricCard label="Estimated value" value={kpis['Estimated value']} icon="$" />
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="filter-item">
          <label>Workflow</label>
          <select value={selectedWorkflow} onChange={(e) => setSelectedWorkflow(e.target.value)}>
            {workflowsList.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>Source Module</label>
          <select value={selectedSource} onChange={(e) => setSelectedSource(e.target.value)}>
            {sourcesList.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>Risk Level</label>
          <select value={selectedRisk} onChange={(e) => setSelectedRisk(e.target.value)}>
            <option value="All">All Risk Levels</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>

        <div className="filter-item">
          <label>Automation Level</label>
          <select value={selectedLevel} onChange={(e) => setSelectedLevel(e.target.value)}>
            {levelsList.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>Assigned Owner</label>
          <select value={selectedOwner} onChange={(e) => setSelectedOwner(e.target.value)}>
            {ownersList.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>Approval Required</label>
          <select value={selectedApproval} onChange={(e) => setSelectedApproval(e.target.value)}>
            <option value="All">All</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>

        <div className="filter-item">
          <label>Status</label>
          <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
            {statusesList.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Task Register Table */}
      <div className="card-panel">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem',
          }}
        >
          <h3 style={{ margin: 0 }}>Automation Task Register</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            Showing {filteredTasks.length} of {tasks.length} tasks
          </span>
        </div>

        <div className="data-table-wrapper" style={{ maxHeight: '280px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Task ID</th>
                <th>Workflow Name</th>
                <th>Source Module</th>
                <th>Risk Level</th>
                <th>Approval Req</th>
                <th>Assigned Owner</th>
                <th>Due Date</th>
                <th>Status</th>
                <th>Est Hours Saved</th>
                <th>Est Value</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((t) => (
                <tr
                  key={t.task_id}
                  onClick={() => {
                    setSelectedTaskId(t.task_id);
                    setAssignedOwner(t.assigned_owner || 'Unassigned');
                    setActionError(null);
                  }}
                  className={selectedTask?.task_id === t.task_id ? 'selected' : ''}
                  style={{ cursor: 'pointer' }}
                >
                  <td style={{ fontWeight: 600, color: 'var(--cyan)' }}>{t.task_id}</td>
                  <td style={{ fontWeight: 600 }}>{t.workflow_name}</td>
                  <td>{t.module_source}</td>
                  <td>
                    <span className={`pill ${t.risk_level.toLowerCase()}`}>{t.risk_level}</span>
                  </td>
                  <td>{t.human_approval_required ? 'Yes' : 'No'}</td>
                  <td>{t.assigned_owner}</td>
                  <td>{t.due_date ? t.due_date.substring(0, 10) : '—'}</td>
                  <td>
                    <span
                      className={`pill ${t.status === 'Approved' ? 'low' : t.status === 'Executed' ? 'info' : t.status === 'Rejected' ? 'critical' : 'medium'}`}
                    >
                      {t.status}
                    </span>
                  </td>
                  <td>{(t.estimated_time_saved_minutes / 60).toFixed(1)} h</td>
                  <td>${t.estimated_value_usd.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Awaiting Approval & Charts */}
      <div className="grid-2">
        <div className="card-panel">
          <h3>Tasks Awaiting Approval</h3>
          <div className="data-table-wrapper" style={{ maxHeight: '240px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task ID</th>
                  <th>Workflow</th>
                  <th>Risk</th>
                  <th>Owner</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {awaitingApproval.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                      No tasks awaiting approval.
                    </td>
                  </tr>
                ) : (
                  awaitingApproval.map((t) => (
                    <tr
                      key={t.task_id}
                      onClick={() => {
                        setSelectedTaskId(t.task_id);
                        setAssignedOwner(t.assigned_owner || 'Unassigned');
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ fontWeight: 600, color: 'var(--cyan)' }}>{t.task_id}</td>
                      <td>{t.workflow_name}</td>
                      <td>
                        <span className={`pill ${t.risk_level.toLowerCase()}`}>{t.risk_level}</span>
                      </td>
                      <td>{t.assigned_owner}</td>
                      <td>
                        <span className="pill warning">{t.status}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <BarChart title="Time-Saving Summary (Hours)" data={timeData} height={180} />
          <BarChart title="Value Impact by Workflow ($k)" data={valueData} height={180} />
        </div>
      </div>

      {/* Selected Task Detail & Controlled Process Flow */}
      {selectedTask && (
        <div className="card-panel">
          <h3>
            Task Detail: {selectedTask.task_id} &mdash; {selectedTask.workflow_name}
          </h3>

          {selectedTask.risk_level === 'High' && (
            <div className="banner-error" style={{ marginBottom: '0.75rem' }}>
              <ShieldCheck size={16} />
              <span>High-risk task: approval is mandatory before simulated execution.</span>
            </div>
          )}

          <div className={`alert-card ${selectedTask.risk_level.toLowerCase()}`}>
            <div className="alert-heading">
              <span className={`pill ${selectedTask.risk_level.toLowerCase()}`}>
                {selectedTask.risk_level}
              </span>
              <strong>{selectedTask.workflow_name}</strong>
              <span className="pill info">{selectedTask.status}</span>
            </div>

            <div className="detail-grid">
              <div>
                <label>Source Module</label>
                <div>{selectedTask.module_source}</div>
              </div>
              <div>
                <label>Task</label>
                <div>{selectedTask.task_description}</div>
              </div>
              <div>
                <label>AI-Style Recommendation</label>
                <div>{selectedTask.AI_recommendation}</div>
              </div>
              <div>
                <label>Confidence</label>
                <div>{selectedTask.confidence_score}%</div>
              </div>
              <div>
                <label>Approval Required</label>
                <div>{selectedTask.human_approval_required ? 'Yes' : 'No'}</div>
              </div>
              <div>
                <label>Owner / Due</label>
                <div>
                  {selectedTask.assigned_owner} &middot;{' '}
                  {selectedTask.due_date ? selectedTask.due_date.substring(0, 10) : '—'}
                </div>
              </div>
              <div>
                <label>Time Saved</label>
                <div>{selectedTask.estimated_time_saved_minutes} minutes</div>
              </div>
              <div>
                <label>Estimated Value</label>
                <div>${selectedTask.estimated_value_usd.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* Controlled Process Flow */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h4 style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>
              Controlled Process Flow
            </h4>
            <div
              style={{
                background: '#091424',
                padding: '0.75rem 1rem',
                borderRadius: '6px',
                border: '1px solid var(--line)',
                textAlign: 'center',
                fontWeight: 600,
                color: '#e6eef8',
                letterSpacing: '0.04em',
              }}
            >
              {selectedTask.status === 'Rejected'
                ? 'Created → Under Review → Rejected'
                : 'Created → Under Review → Approved → Executed → Closed'}
            </div>
          </div>

          {/* Actions Bar */}
          <div style={{ marginTop: '1rem' }}>
            <div
              style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}
            >
              <input
                type="text"
                placeholder="Decision comment"
                value={decisionComment}
                onChange={(e) => setDecisionComment(e.target.value)}
                style={{ flex: 1, minWidth: '240px' }}
              />

              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                <select
                  value={assignedOwner}
                  onChange={(e) => setAssignedOwner(e.target.value)}
                  style={{ minWidth: '160px' }}
                >
                  {OWNERS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                <button
                  className="btn"
                  onClick={() => handleAction('Assign owner', 'Assigned', { owner: assignedOwner })}
                >
                  Assign
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                className="btn btn-success"
                onClick={() => handleAction('Approve', 'Approved')}
              >
                Approve
              </button>
              <button className="btn btn-danger" onClick={() => handleAction('Reject', 'Rejected')}>
                Reject
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleAction('Request more information', 'Under Review')}
              >
                More Info
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleAction('Execute simulated action', 'Executed')}
              >
                Execute
              </button>
              <button className="btn" onClick={() => handleAction('Put on hold', 'On Hold')}>
                Hold
              </button>
              <button className="btn" onClick={() => handleAction('Close task', 'Closed')}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval History */}
      <div className="card-panel">
        <h3>Approval History</h3>
        <div className="data-table-wrapper" style={{ maxHeight: '200px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Task ID</th>
                <th>Action</th>
                <th>Previous Status</th>
                <th>New Status</th>
                <th>Owner</th>
                <th>Comment</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                    No automation decisions recorded in this session.
                  </td>
                </tr>
              ) : (
                history.map((h, i) => (
                  <tr key={i}>
                    <td>{h.timestamp}</td>
                    <td>{h.task}</td>
                    <td style={{ fontWeight: 600 }}>{h.action}</td>
                    <td>{h.previous_status}</td>
                    <td>
                      <span className="pill info">{h.new_status}</span>
                    </td>
                    <td>{h.owner}</td>
                    <td>{h.comment}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
