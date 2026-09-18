import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Shield, User, Bot, Sparkles, X } from 'lucide-react';
import { Actor, Agent } from '../../../domain/enterprise';
import { AgentService, OrganizationService, TaskService } from '../../../services/enterprise';
import { EntityBadge } from '../../../components/enterprise/EntityBadge';
import { RiskBadge } from '../../../components/enterprise/RiskBadge';
import { StatusBadge } from '../../../components/enterprise/StatusBadge';
import styles from './OrganizationPage.module.css';

export const OrganizationPage: React.FC = () => {
  const [selectedEntity, setSelectedEntity] = useState<{
    type: 'actor' | 'agent';
    data: Actor | Agent;
  } | null>(null);
  const [collapsedDepts, setCollapsedDepts] = useState<Record<string, boolean>>({});

  const departments = OrganizationService.getDepartments();
  const allActors = OrganizationService.getActors();
  const allAgents = AgentService.getAgents();
  const allTasks = TaskService.getTasks();

  const ceo = allActors.find((a) => a.id === 'ACT-CEO');
  const aiAdvisor = allActors.find((a) => a.id === 'ACT-AI-ADV');

  const toggleDept = (deptId: string) => {
    setCollapsedDepts((prev) => ({ ...prev, [deptId]: !prev[deptId] }));
  };

  return (
    <div className={styles.container} data-testid="organization-page">
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className="eyebrow">CORPORATE GOVERNANCE STRUCTURE</div>
          <h1>Enterprise Organization Hierarchy</h1>
          <p className="subtitle" style={{ marginBottom: 0 }}>
            Structured reporting lines connecting Human Leadership, Advisory Intelligence, and
            Delegated AI Workforces.
          </p>
        </div>
        <div className={styles.legendRow}>
          <div className={styles.legendItem}>
            <span className={styles.legendDotHuman} />
            <span>Human Leader</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDotAdvisor} />
            <span>Executive AI Advisor</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.legendDotAgent} />
            <span>Autonomous AI Agent</span>
          </div>
        </div>
      </div>

      {/* Main Hierarchy Tree */}
      <div className={styles.treeContainer}>
        {/* Level 1: CEO & Executive AI Advisor */}
        <div className={styles.levelWrapper}>
          <div className={styles.ceoBlock}>
            {ceo && (
              <div
                className={`${styles.nodeCard} ${styles.ceoCard}`}
                role="button"
                tabIndex={0}
                data-testid="org-node-ceo"
                onClick={() => setSelectedEntity({ type: 'actor', data: ceo })}
                onKeyDown={(e) =>
                  e.key === 'Enter' && setSelectedEntity({ type: 'actor', data: ceo })
                }
              >
                <div className={styles.nodeHeader}>
                  <div className={styles.avatarHuman}>
                    <User size={18} />
                  </div>
                  <div>
                    <div className={styles.nodeName}>{ceo.name}</div>
                    <div className={styles.nodeRole}>{ceo.role}</div>
                  </div>
                </div>
                <div className={styles.nodeFooter}>
                  <EntityBadge type="HUMAN" size="sm" />
                  <span className="pill info">EXECUTIVE</span>
                </div>
              </div>
            )}

            {/* Staff Advisory Branch */}
            {aiAdvisor && (
              <div className={styles.advisorBranch}>
                <div className={styles.advisorLine} />
                <div
                  className={`${styles.nodeCard} ${styles.advisorCard}`}
                  role="button"
                  tabIndex={0}
                  data-testid="org-node-advisor"
                  onClick={() => setSelectedEntity({ type: 'actor', data: aiAdvisor })}
                  onKeyDown={(e) =>
                    e.key === 'Enter' && setSelectedEntity({ type: 'actor', data: aiAdvisor })
                  }
                >
                  <div className={styles.nodeHeader}>
                    <div className={styles.avatarAdvisor}>
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <div className={styles.nodeName}>{aiAdvisor.name}</div>
                      <div className={styles.nodeRole}>{aiAdvisor.role}</div>
                    </div>
                  </div>
                  <div className={styles.nodeFooter}>
                    <EntityBadge type="AI_ADVISOR" size="sm" />
                    <span className="pill info" style={{ color: '#c084fc' }}>
                      STAFF ADVISORY
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Connecting Vertical Trunk */}
        <div className={styles.trunkLine} />

        {/* Level 2: Directors & Delegated Departments */}
        <div className={styles.departmentGrid}>
          {departments
            .filter((d) => d.id !== 'DEPT-EXEC')
            .map((dept) => {
              const director = allActors.find((a) => a.id === dept.directorId);
              const managers = allActors.filter(
                (a) => a.departmentId === dept.id && a.authorityLevel === 'MANAGER'
              );
              const deptAgents = allAgents.filter((a) => a.departmentId === dept.id);
              const isCollapsed = collapsedDepts[dept.id] ?? false;

              return (
                <div
                  key={dept.id}
                  className={styles.deptBranch}
                  data-testid={`org-dept-${dept.code.toLowerCase()}`}
                >
                  {/* Director Node */}
                  {director && (
                    <div
                      className={`${styles.nodeCard} ${styles.directorCard}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedEntity({ type: 'actor', data: director })}
                      onKeyDown={(e) =>
                        e.key === 'Enter' && setSelectedEntity({ type: 'actor', data: director })
                      }
                    >
                      <div className={styles.deptTag}>{dept.name}</div>
                      <div className={styles.nodeHeader}>
                        <div className={styles.avatarHuman}>
                          <User size={16} />
                        </div>
                        <div>
                          <div className={styles.nodeName}>{director.name}</div>
                          <div className={styles.nodeRole}>{director.role}</div>
                        </div>
                      </div>
                      <div className={styles.nodeFooter}>
                        <EntityBadge type="HUMAN" size="sm" />
                        <span className="pill info">DIRECTOR</span>
                      </div>
                    </div>
                  )}

                  <div className={styles.branchLine} />

                  {/* Toggle Managers / Agents Accordion on smaller viewports */}
                  <button
                    className={styles.deptCollapseToggle}
                    onClick={() => toggleDept(dept.id)}
                    aria-label={`Toggle ${dept.name} workforce`}
                  >
                    <span>
                      Workforce ({deptAgents.length} Agents, {managers.length} Managers)
                    </span>
                    {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                  </button>

                  {!isCollapsed && (
                    <div className={styles.managerContainer}>
                      {managers.map((mgr) => {
                        const mgrAgents = deptAgents.filter((a) => a.managerId === mgr.id);

                        return (
                          <div key={mgr.id} className={styles.managerSubBranch}>
                            {/* Manager Node */}
                            <div
                              className={`${styles.nodeCard} ${styles.managerCard}`}
                              role="button"
                              tabIndex={0}
                              onClick={() => setSelectedEntity({ type: 'actor', data: mgr })}
                              onKeyDown={(e) =>
                                e.key === 'Enter' && setSelectedEntity({ type: 'actor', data: mgr })
                              }
                            >
                              <div className={styles.nodeHeader}>
                                <div className={styles.avatarHuman}>
                                  <User size={14} />
                                </div>
                                <div>
                                  <div className={styles.nodeName}>{mgr.name}</div>
                                  <div className={styles.nodeRole}>{mgr.role}</div>
                                </div>
                              </div>
                              <div className={styles.nodeFooter}>
                                <EntityBadge type="HUMAN" size="sm" />
                                <span className="pill info" style={{ fontSize: '0.65rem' }}>
                                  MANAGER
                                </span>
                              </div>
                            </div>

                            {/* Agent Worker Nodes */}
                            <div className={styles.agentsGrid}>
                              {mgrAgents.map((agent) => {
                                const agentTasks = allTasks.filter(
                                  (t) => t.assignedTo === agent.id && t.status !== 'COMPLETED'
                                );

                                return (
                                  <div
                                    key={agent.id}
                                    className={`${styles.nodeCard} ${styles.agentCard}`}
                                    role="button"
                                    tabIndex={0}
                                    data-testid={`agent-node-${agent.id.toLowerCase()}`}
                                    onClick={() =>
                                      setSelectedEntity({ type: 'agent', data: agent })
                                    }
                                    onKeyDown={(e) =>
                                      e.key === 'Enter' &&
                                      setSelectedEntity({ type: 'agent', data: agent })
                                    }
                                  >
                                    <div className={styles.nodeHeader}>
                                      <div className={styles.avatarAgent}>
                                        <Bot size={14} />
                                      </div>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <div className={styles.agentNameText} title={agent.name}>
                                          {agent.name}
                                        </div>
                                        <div className={styles.agentIdText}>{agent.id}</div>
                                      </div>
                                    </div>

                                    <div className={styles.agentMetaRow}>
                                      <StatusBadge status={agent.status} type="agent" />
                                      {agent.riskLevel !== 'LOW' && (
                                        <RiskBadge risk={agent.riskLevel} size="sm" />
                                      )}
                                    </div>

                                    <div className={styles.agentTaskFooter}>
                                      <span style={{ color: 'var(--muted)' }}>
                                        Active Tasks:{' '}
                                        <strong style={{ color: 'var(--cyan)' }}>
                                          {agentTasks.length}
                                        </strong>
                                      </span>
                                      <span style={{ color: 'var(--green)', fontSize: '0.7rem' }}>
                                        {agent.tasksCompleted} done
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}

                      {/* Directly reporting agents (e.g. Independent Verification Agent under Assurance Director) */}
                      {deptAgents.filter((a) => a.managerId === dept.directorId).length > 0 && (
                        <div className={styles.managerSubBranch}>
                          <div className={styles.directReportHeader}>
                            <Shield size={12} style={{ color: 'var(--cyan)' }} />
                            <span>Independent Staff Oversight</span>
                          </div>
                          <div className={styles.agentsGrid}>
                            {deptAgents
                              .filter((a) => a.managerId === dept.directorId)
                              .map((agent) => (
                                <div
                                  key={agent.id}
                                  className={`${styles.nodeCard} ${styles.agentCard}`}
                                  role="button"
                                  tabIndex={0}
                                  data-testid={`agent-node-${agent.id.toLowerCase()}`}
                                  onClick={() => setSelectedEntity({ type: 'agent', data: agent })}
                                  onKeyDown={(e) =>
                                    e.key === 'Enter' &&
                                    setSelectedEntity({ type: 'agent', data: agent })
                                  }
                                >
                                  <div className={styles.nodeHeader}>
                                    <div className={styles.avatarAgent}>
                                      <Bot size={14} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div className={styles.agentNameText} title={agent.name}>
                                        {agent.name}
                                      </div>
                                      <div className={styles.agentIdText}>{agent.id}</div>
                                    </div>
                                  </div>

                                  <div className={styles.agentMetaRow}>
                                    <StatusBadge status={agent.status} type="agent" />
                                    <span className="pill info" style={{ fontSize: '0.65rem' }}>
                                      INDEPENDENT
                                    </span>
                                  </div>

                                  <div className={styles.agentTaskFooter}>
                                    <span style={{ color: 'var(--muted)' }}>
                                      Verification Gate:{' '}
                                      <strong style={{ color: 'var(--green)' }}>Active</strong>
                                    </span>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Entity Details Drawer / Modal */}
      {selectedEntity && (
        <div className={styles.drawerOverlay} onClick={() => setSelectedEntity(null)}>
          <div
            className={styles.drawer}
            data-testid="org-entity-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.drawerHeader}>
              <div>
                <span className="eyebrow">{selectedEntity.type.toUpperCase()} PROFILE</span>
                <h2>{selectedEntity.data.name}</h2>
                <div className={styles.drawerRole}>{selectedEntity.data.role}</div>
              </div>
              <button
                className={styles.closeBtn}
                onClick={() => setSelectedEntity(null)}
                aria-label="Close drawer"
              >
                <X size={20} />
              </button>
            </div>

            <div className={styles.drawerBody}>
              <div className={styles.drawerMetaGrid}>
                <div className={styles.drawerMetaItem}>
                  <span className={styles.drawerMetaLabel}>Entity Type:</span>
                  <EntityBadge type={selectedEntity.data.entityType} />
                </div>
                <div className={styles.drawerMetaItem}>
                  <span className={styles.drawerMetaLabel}>Authority Level:</span>
                  <span className="pill info">{selectedEntity.data.authorityLevel}</span>
                </div>
                <div className={styles.drawerMetaItem}>
                  <span className={styles.drawerMetaLabel}>Department:</span>
                  <span>{selectedEntity.data.departmentId}</span>
                </div>
                {'reportsTo' in selectedEntity.data && selectedEntity.data.reportsTo && (
                  <div className={styles.drawerMetaItem}>
                    <span className={styles.drawerMetaLabel}>Reports To:</span>
                    <span>
                      {OrganizationService.getActor(selectedEntity.data.reportsTo)?.name ||
                        selectedEntity.data.reportsTo}
                    </span>
                  </div>
                )}
              </div>

              <div className={styles.drawerSection}>
                <h3>RESPONSIBILITIES &amp; SCOPE</h3>
                <p className={styles.drawerDesc}>{selectedEntity.data.description}</p>
              </div>

              {selectedEntity.type === 'agent' && (
                <>
                  <div className={styles.drawerSection}>
                    <h3>OPERATIONAL METRICS</h3>
                    <div className={styles.agentMetricsGrid}>
                      <div className={styles.metricBox}>
                        <span className={styles.metricVal}>
                          {(selectedEntity.data as Agent).health}%
                        </span>
                        <span className={styles.metricLabel}>Health</span>
                      </div>
                      <div className={styles.metricBox}>
                        <span className={styles.metricVal}>
                          {(selectedEntity.data as Agent).tasksToday}
                        </span>
                        <span className={styles.metricLabel}>Tasks Today</span>
                      </div>
                      <div className={styles.metricBox}>
                        <span className={styles.metricVal}>
                          {(selectedEntity.data as Agent).tasksCompleted}
                        </span>
                        <span className={styles.metricLabel}>Completed</span>
                      </div>
                      <div className={styles.metricBox}>
                        <span className={styles.metricVal}>
                          {(selectedEntity.data as Agent).qualityScore}%
                        </span>
                        <span className={styles.metricLabel}>Quality Score</span>
                      </div>
                    </div>
                  </div>

                  <div className={styles.drawerSection}>
                    <h3>BUSINESS CAPABILITIES</h3>
                    <div className={styles.tagList}>
                      {(selectedEntity.data as Agent).requiredCapabilities.map((capId) => (
                        <span key={capId} className="pill info">
                          {capId}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {selectedEntity.type === 'actor' && 'permissions' in selectedEntity.data && (
                <div className={styles.drawerSection}>
                  <h3>DELEGATED PERMISSIONS ({selectedEntity.data.permissions.length})</h3>
                  <div className={styles.tagList}>
                    {selectedEntity.data.permissions.map((perm) => (
                      <span key={perm} className={styles.permTag}>
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className={styles.drawerFooter}>
              <button className={styles.closeDrawerBtn} onClick={() => setSelectedEntity(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
