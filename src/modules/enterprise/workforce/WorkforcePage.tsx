import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Bot,
  Pause,
  Play,
  RotateCcw,
  Shield,
  X,
} from 'lucide-react';
import {
  AgentService,
  OrganizationService,
  subscribeEnterpriseState,
} from '../../../services/enterprise';
import { RiskBadge } from '../../../components/enterprise/RiskBadge';
import { StatusBadge } from '../../../components/enterprise/StatusBadge';
import { SimulatedControlBanner } from '../../../components/enterprise/SimulatedControlBanner';
import styles from './WorkforcePage.module.css';

export const WorkforcePage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [, setTick] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState(searchParams.get('dept') || 'ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [modeFilter, setModeFilter] = useState('ALL');

  // Selected agent for detailed profile drawer
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  useEffect(() => {
    return subscribeEnterpriseState(() => setTick((t) => t + 1));
  }, []);

  const departments = OrganizationService.getDepartments();
  const agents = AgentService.getAgents({
    searchQuery: searchQuery || undefined,
    departmentId: deptFilter !== 'ALL' ? deptFilter : undefined,
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
    operationalMode: modeFilter !== 'ALL' ? modeFilter : undefined,
  });

  const selectedAgent = selectedAgentId ? AgentService.getAgent(selectedAgentId) : null;

  const handlePause = (agentId: string) => {
    AgentService.pauseAgent(agentId, 'Executive management manual hold');
  };

  const handleResume = (agentId: string) => {
    AgentService.resumeAgent(agentId);
  };

  const handleToggleTool = (agentId: string, toolId: string, enabled: boolean) => {
    AgentService.toggleAgentTool(agentId, toolId, enabled);
  };

  return (
    <div className={styles.container} data-testid="workforce-page">
      {/* Page Header */}
      <div className={styles.header}>
        <div>
          <div className="eyebrow">AI WORKFORCE &amp; AGENT DIRECTORY</div>
          <h1>AI Workforce Directory</h1>
          <p className="subtitle" style={{ marginBottom: 0 }}>
            Supervise, inspect, and govern delegated operational intelligence agents across all enterprise divisions.
          </p>
        </div>
        <div className={styles.workforceCountBadge}>
          <span className={styles.countNum}>{agents.length}</span>
          <span className={styles.countLabel}>Agents Matched</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className={styles.filterToolbar}>
        <div className={styles.searchBox}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search agent by name, role, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
            aria-label="Search agents"
          />
        </div>

        <div className={styles.filterGroup}>
          <div className={styles.selectWrapper}>
            <select
              value={deptFilter}
              onChange={(e) => {
                setDeptFilter(e.target.value);
                if (e.target.value === 'ALL') {
                  searchParams.delete('dept');
                } else {
                  searchParams.set('dept', e.target.value);
                }
                setSearchParams(searchParams);
              }}
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

          <div className={styles.selectWrapper}>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="WAITING">WAITING</option>
              <option value="WAITING_APPROVAL">WAITING_APPROVAL</option>
              <option value="PAUSED">PAUSED</option>
              <option value="DEGRADED">DEGRADED</option>
            </select>
          </div>

          <div className={styles.selectWrapper}>
            <select
              value={modeFilter}
              onChange={(e) => setModeFilter(e.target.value)}
              aria-label="Filter by operational mode"
            >
              <option value="ALL">All Modes</option>
              <option value="FULL">FULL</option>
              <option value="LIMITED">LIMITED</option>
              <option value="DEGRADED">DEGRADED</option>
            </select>
          </div>
        </div>
      </div>

      {/* Agents Table */}
      <div className={styles.tableCard}>
        <div className={styles.tableResponsive}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Agent Identity</th>
                <th>Department</th>
                <th>Manager</th>
                <th>Status</th>
                <th>Mode</th>
                <th>Risk</th>
                <th>Health</th>
                <th>Tasks Done</th>
                <th>Quality</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => {
                const manager = OrganizationService.getActor(agent.managerId);
                const dept = OrganizationService.getDepartment(agent.departmentId);

                return (
                  <tr
                    key={agent.id}
                    data-testid={`agent-row-${agent.id.toLowerCase()}`}
                    className={selectedAgentId === agent.id ? styles.selectedRow : ''}
                    onClick={() => setSelectedAgentId(agent.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div className={styles.agentCell}>
                        <div className={styles.agentIconWrap}>
                          <Bot size={16} />
                        </div>
                        <div>
                          <div className={styles.agentName}>{agent.name}</div>
                          <div className={styles.agentRole}>{agent.role}</div>
                          <div className={styles.agentIdTag}>{agent.id}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={styles.deptBadge}>{dept?.code || agent.departmentId}</span>
                    </td>
                    <td>
                      <div className={styles.managerCell}>
                        <span>{manager?.name || agent.managerId}</span>
                        <span className={styles.managerRole}>{manager?.role}</span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={agent.status} type="agent" />
                    </td>
                    <td>
                      <StatusBadge status={agent.operationalMode} type="mode" />
                    </td>
                    <td>
                      <RiskBadge risk={agent.riskLevel} size="sm" />
                    </td>
                    <td>
                      <div className={styles.healthCell}>
                        <div className={styles.healthBar}>
                          <div
                            className={styles.healthBarFill}
                            style={{
                              width: `${agent.health}%`,
                              background:
                                agent.health > 90
                                  ? 'var(--green)'
                                  : agent.health > 75
                                    ? 'var(--amber)'
                                    : 'var(--red)',
                            }}
                          />
                        </div>
                        <span>{agent.health}%</span>
                      </div>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--cyan)' }}>{agent.tasksCompleted}</strong>
                      <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}> / {agent.tasksToday}</span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-bright)', fontWeight: 600 }}>
                        {agent.qualityScore}%
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className={styles.actionCell}>
                        {agent.status === 'PAUSED' ? (
                          <button
                            className={styles.resumeBtn}
                            onClick={() => handleResume(agent.id)}
                            title="Resume agent autonomous processing"
                            data-testid={`btn-resume-${agent.id.toLowerCase()}`}
                          >
                            <Play size={12} /> Resume
                          </button>
                        ) : (
                          <button
                            className={styles.pauseBtn}
                            onClick={() => handlePause(agent.id)}
                            title="Pause agent autonomous execution"
                            data-testid={`btn-pause-${agent.id.toLowerCase()}`}
                          >
                            <Pause size={12} /> Pause
                          </button>
                        )}
                        <button
                          className={styles.inspectBtn}
                          onClick={() => setSelectedAgentId(agent.id)}
                          title="View agent details and structured decisions"
                        >
                          Profile
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Agent Profile Drawer */}
      {selectedAgent && (
        <div className={styles.drawerOverlay} onClick={() => setSelectedAgentId(null)}>
          <div
            className={styles.drawer}
            data-testid="agent-profile-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className={styles.drawerHeader}>
              <div>
                <div className="eyebrow">AGENT PROFILE &bull; {selectedAgent.id}</div>
                <h2>{selectedAgent.name}</h2>
                <div className={styles.drawerRole}>{selectedAgent.role}</div>
              </div>
              <button
                className={styles.closeBtn}
                onClick={() => setSelectedAgentId(null)}
                aria-label="Close profile drawer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Simulated Banner */}
            <div style={{ padding: '0 1.5rem 0.5rem 1.5rem' }}>
              <SimulatedControlBanner compact />
            </div>

            {/* Drawer Content */}
            <div className={styles.drawerBody}>
              {/* Management Controls Bar */}
              <div className={styles.controlSection}>
                <h3>SUPERVISORY MANAGEMENT CONTROLS</h3>
                <div className={styles.controlButtonsRow}>
                  {selectedAgent.status === 'PAUSED' ? (
                    <button
                      className={styles.controlBtnPlay}
                      onClick={() => handleResume(selectedAgent.id)}
                      data-testid="drawer-resume-btn"
                    >
                      <Play size={14} /> Resume Agent
                    </button>
                  ) : (
                    <button
                      className={styles.controlBtnPause}
                      onClick={() => handlePause(selectedAgent.id)}
                      data-testid="drawer-pause-btn"
                    >
                      <Pause size={14} /> Pause Agent
                    </button>
                  )}

                  <button
                    className={styles.controlBtnSecondary}
                    onClick={() => {
                      alert('Re-analysis requested. Agent will recalculate models against latest telemetry.');
                    }}
                  >
                    <RotateCcw size={14} /> Request Re-Analysis
                  </button>

                  <button
                    className={styles.controlBtnSecondary}
                    onClick={() => {
                      alert('Independent verification requested. Routed to Independent Verification Agent.');
                    }}
                  >
                    <Shield size={14} /> Request Verification
                  </button>
                </div>
              </div>

              {/* Status & Identity Grid */}
              <div className={styles.metaGrid}>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Current Status:</span>
                  <StatusBadge status={selectedAgent.status} type="agent" />
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Operational Mode:</span>
                  <StatusBadge status={selectedAgent.operationalMode} type="mode" />
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Risk Level:</span>
                  <RiskBadge risk={selectedAgent.riskLevel} size="sm" />
                </div>
                <div className={styles.metaItem}>
                  <span className={styles.metaLabel}>Responsible Manager:</span>
                  <span style={{ color: 'var(--text-bright)', fontWeight: 500 }}>
                    {OrganizationService.getActor(selectedAgent.managerId)?.name}
                  </span>
                </div>
              </div>

              {/* Status Reason */}
              <div className={styles.infoBox}>
                <span className={styles.infoLabel}>Current Activity / Status Reason:</span>
                <p className={styles.infoText}>{selectedAgent.statusReason}</p>
              </div>

              {/* Performance Metrics */}
              <div className={styles.drawerSection}>
                <h3>PERFORMANCE &amp; QUALITY METRICS</h3>
                <div className={styles.metricsQuad}>
                  <div className={styles.quadItem}>
                    <span className={styles.quadVal}>{selectedAgent.qualityScore}%</span>
                    <span className={styles.quadLabel}>Quality Score</span>
                  </div>
                  <div className={styles.quadItem}>
                    <span className={styles.quadVal}>{(selectedAgent.confidenceScore * 100).toFixed(0)}%</span>
                    <span className={styles.quadLabel}>Mean Confidence</span>
                  </div>
                  <div className={styles.quadItem}>
                    <span className={styles.quadVal}>{selectedAgent.slaPerformance}%</span>
                    <span className={styles.quadLabel}>SLA Compliance</span>
                  </div>
                  <div className={styles.quadItem}>
                    <span className={styles.quadVal}>{selectedAgent.tasksCompleted}</span>
                    <span className={styles.quadLabel}>Tasks Completed</span>
                  </div>
                </div>
              </div>

              {/* Available Tools */}
              <div className={styles.drawerSection}>
                <h3>OPERATIONAL TOOLS &amp; CAPABILITIES</h3>
                <div className={styles.toolList}>
                  {selectedAgent.tools.map((tool) => (
                    <div key={tool.id} className={styles.toolRow}>
                      <div>
                        <div className={styles.toolName}>{tool.name}</div>
                        <div className={styles.toolDesc}>{tool.description}</div>
                      </div>
                      <button
                        className={tool.isEnabled ? styles.toolBtnEnabled : styles.toolBtnDisabled}
                        onClick={() => handleToggleTool(selectedAgent.id, tool.id, !tool.isEnabled)}
                        title={tool.isEnabled ? 'Disable simulated tool' : 'Enable simulated tool'}
                      >
                        {tool.isEnabled ? 'ENABLED' : 'DISABLED'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Structured Reasoning & Decisions (NO HIDDEN CHAIN OF THOUGHT) */}
              <div className={styles.drawerSection}>
                <h3>RECENT STRUCTURED DECISIONS (Auditable Evidence)</h3>
                {selectedAgent.recentDecisions.length === 0 ? (
                  <div className={styles.emptyDecisions}>
                    No formal supervisory decisions logged in current session.
                  </div>
                ) : (
                  <div className={styles.decisionList}>
                    {selectedAgent.recentDecisions.map((dec) => (
                      <div key={dec.id} className={styles.decisionCard}>
                        <div className={styles.decisionHeader}>
                          <span className={styles.decisionSummary}>{dec.decisionSummary}</span>
                          <span className={styles.decisionConfidence}>
                            {(dec.confidence * 100).toFixed(0)}% Confidence
                          </span>
                        </div>
                        <div className={styles.rationaleBox}>
                          <strong>Rationale:</strong> {dec.rationaleSummary}
                        </div>
                        <div className={styles.evidenceRow}>
                          <span className={styles.evidenceLabel}>Evidence:</span>
                          {dec.evidenceRefs.map((ref) => (
                            <span key={ref} className={styles.evidenceTag}>
                              {ref}
                            </span>
                          ))}
                        </div>
                        <div className={styles.policyRow}>
                          <span>Policy Check:</span>
                          <span style={{ color: 'var(--cyan)' }}>{dec.policyDecision}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer */}
            <div className={styles.drawerFooter}>
              <button className={styles.closeDrawerBtn} onClick={() => setSelectedAgentId(null)}>
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
