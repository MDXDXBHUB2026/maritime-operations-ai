import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  AlertTriangle,
  Shield,
  RotateCcw,
  X,
} from 'lucide-react';
import { TaskPriority, TaskRisk, TaskStatus } from '../../../domain/enterprise';
import {
  AgentService,
  OrganizationService,
  subscribeEnterpriseState,
  TaskService,
} from '../../../services/enterprise';
import { RiskBadge } from '../../../components/enterprise/RiskBadge';
import { StatusBadge } from '../../../components/enterprise/StatusBadge';
import { SimulatedControlBanner } from '../../../components/enterprise/SimulatedControlBanner';
import styles from './TaskOperationsPage.module.css';

export const TaskOperationsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [, setTick] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'ALL');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(searchParams.get('taskId') || null);

  useEffect(() => {
    return subscribeEnterpriseState(() => setTick((t) => t + 1));
  }, []);

  const departments = OrganizationService.getDepartments();
  const agents = AgentService.getAgents();
  const tasks = TaskService.getTasks({
    searchQuery: searchQuery || undefined,
    status: statusFilter !== 'ALL' ? (statusFilter as TaskStatus) : undefined,
    risk: riskFilter !== 'ALL' ? (riskFilter as TaskRisk) : undefined,
    departmentId: deptFilter !== 'ALL' ? deptFilter : undefined,
  });

  const selectedTask = selectedTaskId ? TaskService.getTask(selectedTaskId) : null;

  const handleReassign = (taskId: string, newAgentId: string) => {
    TaskService.reassignTask(taskId, newAgentId);
  };

  const handleChangePriority = (taskId: string, priority: TaskPriority) => {
    TaskService.changePriority(taskId, priority);
  };

  const handleRequestVerification = (taskId: string) => {
    TaskService.requestVerification(taskId);
  };

  const handleEscalate = (taskId: string) => {
    TaskService.escalateTask(taskId, 'Management operational escalation');
  };

  const handleRetry = (taskId: string) => {
    TaskService.requestRetry(taskId);
  };

  const handleCancel = (taskId: string) => {
    TaskService.cancelTask(taskId, 'Operator cancellation from task operations view');
  };

  return (
    <div className={styles.container} data-testid="task-operations-page">
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className="eyebrow">TASK LIFECYCLE &amp; EXECUTION OPERATIONS</div>
          <h1>Task Operations Register</h1>
          <p className="subtitle" style={{ marginBottom: 0 }}>
            Inspect delegated operational tasks, execution states, evidence chains, and supervisory interventions.
          </p>
        </div>
        <div className={styles.headerStats}>
          <span className="pill info">
            <span>●</span> {tasks.length} Tasks Matched
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className={styles.filterBar}>
        <div className={styles.searchBox}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search task by title, ID, vessel..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
            aria-label="Search tasks"
          />
        </div>

        <div className={styles.filterGroup}>
          <div className={styles.selectWrapper}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by task status"
            >
              <option value="ALL">All Statuses</option>
              <option value="RUNNING">RUNNING</option>
              <option value="WAITING_APPROVAL">WAITING_APPROVAL</option>
              <option value="VERIFYING">VERIFYING</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="BLOCKED">BLOCKED</option>
              <option value="ESCALATED">ESCALATED</option>
            </select>
          </div>

          <div className={styles.selectWrapper}>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              aria-label="Filter by task risk"
            >
              <option value="ALL">All Risks</option>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>

          <div className={styles.selectWrapper}>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              aria-label="Filter by department"
            >
              <option value="ALL">All Departments</option>
              {departments
                .filter((d) => d.id !== 'DEPT-EXEC')
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* Task Register Table */}
      <div className={styles.tableCard}>
        <div className={styles.tableResponsive}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Task ID &amp; Title</th>
                <th>Department</th>
                <th>Assigned Agent</th>
                <th>Manager</th>
                <th>Priority</th>
                <th>Risk</th>
                <th>Status</th>
                <th>Confidence</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const agent = AgentService.getAgent(task.assignedTo);
                const manager = OrganizationService.getActor(task.managerId);
                const dept = OrganizationService.getDepartment(task.departmentId);

                return (
                  <tr
                    key={task.taskId}
                    data-testid={`task-row-${task.taskId.toLowerCase()}`}
                    className={selectedTaskId === task.taskId ? styles.selectedRow : ''}
                    onClick={() => setSelectedTaskId(task.taskId)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div>
                        <div className={styles.taskIdText}>{task.taskId}</div>
                        <div className={styles.taskTitleText}>{task.title}</div>
                        {task.relatedVessel && (
                          <div className={styles.taskVesselTag}>Vessel: {task.relatedVessel}</div>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={styles.deptTag}>{dept?.code || task.departmentId}</span>
                    </td>
                    <td>
                      <span className={styles.agentName}>{agent?.name || task.assignedTo}</span>
                    </td>
                    <td>
                      <span className={styles.managerName}>{manager?.name || task.managerId}</span>
                    </td>
                    <td>
                      <span className={`pill ${task.priority === 'URGENT' ? 'critical' : task.priority === 'HIGH' ? 'high' : 'medium'}`}>
                        {task.priority}
                      </span>
                    </td>
                    <td>
                      <RiskBadge risk={task.risk} size="sm" />
                    </td>
                    <td>
                      <StatusBadge status={task.status} type="task" />
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-bright)', fontWeight: 600 }}>
                        {(task.confidence * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button
                        className={styles.detailBtn}
                        onClick={() => setSelectedTaskId(task.taskId)}
                        data-testid={`btn-inspect-${task.taskId.toLowerCase()}`}
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Task Details Drawer */}
      {selectedTask && (
        <div className={styles.drawerOverlay} onClick={() => setSelectedTaskId(null)}>
          <div
            className={styles.drawer}
            data-testid="task-detail-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={styles.drawerHeader}>
              <div>
                <div className="eyebrow">TASK DETAILS &bull; {selectedTask.taskId}</div>
                <h2>{selectedTask.title}</h2>
                <div className={styles.taskCategory}>{selectedTask.category}</div>
              </div>
              <button
                className={styles.closeBtn}
                onClick={() => setSelectedTaskId(null)}
                aria-label="Close task details"
              >
                <X size={20} />
              </button>
            </div>

            {/* Simulated Banner */}
            <div style={{ padding: '0 1.5rem 0.5rem 1.5rem' }}>
              <SimulatedControlBanner compact />
            </div>

            {/* Body */}
            <div className={styles.drawerBody}>
              {/* Management Controls */}
              <div className={styles.controlBox}>
                <h3>SUPERVISORY TASK ACTIONS</h3>
                <div className={styles.controlRow}>
                  {selectedTask.status !== 'VERIFYING' && (
                    <button
                      className={styles.actionBtnVerify}
                      onClick={() => handleRequestVerification(selectedTask.taskId)}
                      data-testid="task-request-verification-btn"
                    >
                      <Shield size={14} /> Request Verification
                    </button>
                  )}

                  {selectedTask.status !== 'ESCALATED' && (
                    <button
                      className={styles.actionBtnEscalate}
                      onClick={() => handleEscalate(selectedTask.taskId)}
                      data-testid="task-escalate-btn"
                    >
                      <AlertTriangle size={14} /> Escalate to Director
                    </button>
                  )}

                  <button
                    className={styles.actionBtnSecondary}
                    onClick={() => handleRetry(selectedTask.taskId)}
                  >
                    <RotateCcw size={14} /> Retry Task
                  </button>

                  <button
                    className={styles.actionBtnDanger}
                    onClick={() => handleCancel(selectedTask.taskId)}
                  >
                    <X size={14} /> Cancel Task
                  </button>
                </div>

                {/* Priority quick toggle */}
                <div className={styles.prioritySelectorRow}>
                  <span className={styles.priorityLabel}>Set Priority:</span>
                  {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as TaskPriority[]).map((p) => (
                    <button
                      key={p}
                      className={`${styles.priorityPillBtn} ${selectedTask.priority === p ? styles.priorityPillActive : ''}`}
                      onClick={() => handleChangePriority(selectedTask.taskId, p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                {/* Worker Reassignment */}
                <div className={styles.prioritySelectorRow} style={{ marginTop: '0.5rem' }}>
                  <span className={styles.priorityLabel}>Reassign Worker:</span>
                  <select
                    value={selectedTask.assignedTo}
                    onChange={(e) => handleReassign(selectedTask.taskId, e.target.value)}
                    aria-label="Reassign agent for task"
                    style={{
                      padding: '0.25rem 0.5rem',
                      background: 'rgba(15, 23, 42, 0.8)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      color: 'var(--text-bright)',
                      fontSize: '0.8rem',
                    }}
                  >
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Task State Matrix */}
              <div className={styles.metaMatrix}>
                <div className={styles.matrixItem}>
                  <span className={styles.matrixLabel}>Task Status:</span>
                  <StatusBadge status={selectedTask.status} type="task" />
                </div>
                <div className={styles.matrixItem}>
                  <span className={styles.matrixLabel}>Risk Rating:</span>
                  <RiskBadge risk={selectedTask.risk} size="sm" />
                </div>
                <div className={styles.matrixItem}>
                  <span className={styles.matrixLabel}>Assigned Agent:</span>
                  <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>
                    {AgentService.getAgent(selectedTask.assignedTo)?.name || selectedTask.assignedTo}
                  </span>
                </div>
                <div className={styles.matrixItem}>
                  <span className={styles.matrixLabel}>Human Manager:</span>
                  <span style={{ color: 'var(--text-bright)', fontWeight: 500 }}>
                    {OrganizationService.getActor(selectedTask.managerId)?.name}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className={styles.drawerSection}>
                <h3>OBJECTIVE &amp; SCOPE</h3>
                <p className={styles.descText}>{selectedTask.description}</p>
              </div>

              {/* Structured Reasoning & Results */}
              {(selectedTask.decisionSummary || selectedTask.resultSummary) && (
                <div className={styles.drawerSection}>
                  <h3>STRUCTURED OPERATIONAL OUTCOMES</h3>
                  {selectedTask.decisionSummary && (
                    <div className={styles.resultItem}>
                      <strong>Recommended Decision:</strong> {selectedTask.decisionSummary}
                    </div>
                  )}
                  {selectedTask.rationaleSummary && (
                    <div className={styles.resultItem}>
                      <strong>Engineering Rationale:</strong> {selectedTask.rationaleSummary}
                    </div>
                  )}
                  {selectedTask.resultSummary && (
                    <div className={styles.resultItem} style={{ borderLeftColor: 'var(--green)' }}>
                      <strong>Execution Outcome:</strong> {selectedTask.resultSummary}
                    </div>
                  )}
                </div>
              )}

              {/* Evidence References */}
              <div className={styles.drawerSection}>
                <h3>EVIDENCE &amp; TELEMETRY LOG REFERENCES</h3>
                <div className={styles.evidenceWrap}>
                  {selectedTask.evidenceRefs.map((ref) => (
                    <span key={ref} className={styles.evidencePill}>
                      {ref}
                    </span>
                  ))}
                </div>
              </div>

              {/* Required Capabilities */}
              <div className={styles.drawerSection}>
                <h3>REQUIRED BUSINESS CAPABILITIES</h3>
                <div className={styles.evidenceWrap}>
                  {selectedTask.requiredCapabilities.map((cap) => (
                    <span key={cap} className="pill info">
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={styles.drawerFooter}>
              <button className={styles.closeDrawerBtn} onClick={() => setSelectedTaskId(null)}>
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
