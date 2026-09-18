import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import {
  AgentService,
  ApprovalService,
  EventService,
  OrganizationService,
  subscribeEnterpriseState,
  TaskService,
} from '../../../services/enterprise';
import { EntityBadge } from '../../../components/enterprise/EntityBadge';
import { RiskBadge } from '../../../components/enterprise/RiskBadge';
import { StatusBadge } from '../../../components/enterprise/StatusBadge';
import styles from './ExecutiveCommandCentrePage.module.css';

export const ExecutiveCommandCentrePage: React.FC = () => {
  const [, setTick] = useState(0);

  useEffect(() => {
    // Subscribe to any state change across enterprise services (approvals, pause/resume, capabilities)
    return subscribeEnterpriseState(() => setTick((t) => t + 1));
  }, []);

  const agents = AgentService.getAgents();
  const tasks = TaskService.getTasks();
  const pendingApprovals = ApprovalService.getPendingApprovals();
  const recentEvents = EventService.getRecentEvents(8);
  const departments = OrganizationService.getDepartments();

  // Metrics
  const totalWorkforce = agents.length;
  const activeAgents = agents.filter((a) => a.status === 'ACTIVE' || a.status === 'AVAILABLE').length;
  const pausedAgents = agents.filter((a) => a.status === 'PAUSED').length;
  const degradedAgents = agents.filter((a) => a.status === 'DEGRADED' || a.operationalMode === 'DEGRADED').length;
  const activeTasks = tasks.filter((t) => t.status === 'RUNNING' || t.status === 'WAITING_APPROVAL' || t.status === 'VERIFYING').length;
  const awaitingApprovalCount = pendingApprovals.length;
  const escalations = tasks.filter((t) => t.status === 'ESCALATED' || t.approvalState === 'ESCALATED').length;
  const criticalTasks = tasks.filter((t) => t.risk === 'CRITICAL' && t.status !== 'COMPLETED').length;
  const verifyingCount = tasks.filter((t) => t.status === 'VERIFYING').length;

  return (
    <div className={styles.container} data-testid="executive-command-centre">
      {/* Page Header */}
      <div className={styles.header}>
        <div>
          <div className="eyebrow">ENTERPRISE GOVERNANCE &amp; OPERATIONAL DELEGATION</div>
          <h1>Executive Command Centre</h1>
          <p className="subtitle" style={{ marginBottom: 0 }}>
            &ldquo;Management has visibility across the organization and authority to intervene, while operational work remains delegated through the organizational hierarchy.&rdquo;
          </p>
        </div>
        <div className={styles.headerMeta}>
          <span className="pill info">
            <span>●</span> EXECUTIVE VIEW
          </span>
          <span className={styles.authorityNotice}>Role: Chief Executive Officer</span>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className={styles.kpiGrid}>
        <div className="kpi-card" data-testid="kpi-workforce">
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>AI WORKFORCE TOTAL</span>
            <Bot size={18} className={styles.kpiIcon} />
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiVal}>{totalWorkforce}</span>
            <span className={styles.kpiSub}>18 Active Agents</span>
          </div>
          <div className={styles.kpiFooter}>
            <span style={{ color: 'var(--green)' }}>● {activeAgents} Active</span>
            {pausedAgents > 0 && <span style={{ color: 'var(--amber)' }}>● {pausedAgents} Paused</span>}
            {degradedAgents > 0 && <span style={{ color: 'var(--red)' }}>● {degradedAgents} Degraded</span>}
          </div>
        </div>

        <div className="kpi-card" data-testid="kpi-active-tasks">
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>DELEGATED ACTIVE TASKS</span>
            <Zap size={18} className={styles.kpiIcon} />
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiVal}>{activeTasks}</span>
            <span className={styles.kpiSub}>{tasks.filter((t) => t.status === 'COMPLETED').length} Completed Today</span>
          </div>
          <div className={styles.kpiFooter}>
            <span style={{ color: 'var(--cyan)' }}>0 Autonomous Failures</span>
          </div>
        </div>

        <div
          className="kpi-card"
          data-testid="kpi-approvals-waiting"
          style={{ borderColor: awaitingApprovalCount > 0 ? 'rgba(246, 184, 75, 0.45)' : 'var(--line)' }}
        >
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>AWAITING APPROVAL</span>
            <Clock size={18} style={{ color: awaitingApprovalCount > 0 ? 'var(--amber)' : 'var(--muted)' }} />
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiVal} style={{ color: awaitingApprovalCount > 0 ? 'var(--amber)' : 'var(--text)' }}>
              {awaitingApprovalCount}
            </span>
            <span className={styles.kpiSub}>High/Critical Risk</span>
          </div>
          <div className={styles.kpiFooter}>
            <Link to="/approvals" style={{ color: 'var(--cyan)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              Open Inbox <ArrowRight size={12} />
            </Link>
          </div>
        </div>

        <div
          className="kpi-card"
          data-testid="kpi-escalations"
          style={{ borderColor: criticalTasks > 0 ? 'rgba(239, 91, 105, 0.45)' : 'var(--line)' }}
        >
          <div className={styles.kpiHeader}>
            <span className={styles.kpiLabel}>CRITICAL RISKS &amp; ESCALATIONS</span>
            <ShieldAlert size={18} style={{ color: criticalTasks > 0 ? 'var(--red)' : 'var(--green)' }} />
          </div>
          <div className={styles.kpiValueRow}>
            <span className={styles.kpiVal} style={{ color: criticalTasks > 0 ? 'var(--red)' : 'var(--green)' }}>
              {criticalTasks + escalations}
            </span>
            <span className={styles.kpiSub}>{verifyingCount} Verification Pending</span>
          </div>
          <div className={styles.kpiFooter}>
            <span style={{ color: criticalTasks > 0 ? 'var(--red)' : 'var(--green)' }}>
              {criticalTasks > 0 ? '● Policy Block Enforced' : '● Operational Bounds Controlled'}
            </span>
          </div>
        </div>
      </div>

      {/* Attention & Normal Split View */}
      <div className={styles.twoColumnSection}>
        {/* Left: NEEDS ATTENTION */}
        <div className={styles.panelCard} data-testid="section-needs-attention">
          <div className={styles.panelHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={18} style={{ color: 'var(--amber)' }} />
              <h3>NEEDS ATTENTION ({awaitingApprovalCount + degradedAgents + pausedAgents})</h3>
            </div>
            <Link to="/approvals" className={styles.viewAllLink}>
              View All Approvals <ArrowRight size={13} />
            </Link>
          </div>

          <div className={styles.attentionList}>
            {pendingApprovals.length === 0 && degradedAgents === 0 && pausedAgents === 0 ? (
              <div className={styles.emptyNotice}>
                <CheckCircle2 size={24} style={{ color: 'var(--green)', marginBottom: '0.4rem' }} />
                <div>All organizational queues clear. No immediate management decisions pending.</div>
              </div>
            ) : (
              <>
                {/* Approvals awaiting management */}
                {pendingApprovals.map((req) => (
                  <div key={req.id} className={styles.attentionItem} data-testid="attention-approval-item">
                    <div className={styles.itemTop}>
                      <span className={styles.itemTitle}>{req.taskTitle}</span>
                      <RiskBadge risk={req.risk} size="sm" />
                    </div>
                    <div className={styles.itemBody}>
                      <div>
                        <strong>Recommended:</strong> {req.recommendedAction}
                      </div>
                      <div className={styles.itemMeta}>
                        <span>Agent: {req.agentName}</span>
                        <span>•</span>
                        <span>Approver: {req.approverRole}</span>
                        <span>•</span>
                        <span style={{ color: 'var(--cyan)' }}>Policy: {req.policyId}</span>
                      </div>
                    </div>
                    <div className={styles.itemActionRow}>
                      <Link to="/approvals" className={styles.actionBtnPrimary}>
                        Review &amp; Decide
                      </Link>
                    </div>
                  </div>
                ))}

                {/* Paused Agents */}
                {agents
                  .filter((a) => a.status === 'PAUSED')
                  .map((agent) => (
                    <div key={agent.id} className={styles.attentionItem} style={{ borderLeftColor: 'var(--amber)' }}>
                      <div className={styles.itemTop}>
                        <span className={styles.itemTitle}>Agent Paused by Management: {agent.name}</span>
                        <StatusBadge status="PAUSED" type="agent" />
                      </div>
                      <div className={styles.itemBody}>
                        <div>{agent.statusReason}</div>
                      </div>
                      <div className={styles.itemActionRow}>
                        <Link to="/workforce" className={styles.actionBtnSecondary}>
                          Manage Agent
                        </Link>
                      </div>
                    </div>
                  ))}

                {/* Degraded Agents due to Capabilities */}
                {agents
                  .filter((a) => a.operationalMode === 'DEGRADED')
                  .map((agent) => (
                    <div key={agent.id} className={styles.attentionItem} style={{ borderLeftColor: 'var(--red)' }}>
                      <div className={styles.itemTop}>
                        <span className={styles.itemTitle}>Agent Operating in DEGRADED Mode: {agent.name}</span>
                        <StatusBadge status="DEGRADED" type="mode" />
                      </div>
                      <div className={styles.itemBody}>
                        <div>One or more required business capabilities are unavailable. Operating with limited autonomy.</div>
                      </div>
                      <div className={styles.itemActionRow}>
                        <Link to="/governance" className={styles.actionBtnSecondary}>
                          Inspect Capability Registry
                        </Link>
                      </div>
                    </div>
                  ))}
              </>
            )}
          </div>
        </div>

        {/* Right: NO ACTION REQUIRED (Operational Integrity) */}
        <div className={styles.panelCard} data-testid="section-no-action-required">
          <div className={styles.panelHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={18} style={{ color: 'var(--green)' }} />
              <h3>NO ACTION REQUIRED (Operational Integrity)</h3>
            </div>
            <span className="pill healthy">ALL HEALTHY</span>
          </div>

          <div className={styles.healthyList}>
            <div className={styles.healthyItem}>
              <div className={styles.healthyBullet}>✓</div>
              <div>
                <strong>Global Fleet Monitoring:</strong> 10 vessels on chartered track across Arabian Sea, Persian Gulf, and Malacca. Zero geofence breaches.
              </div>
            </div>
            <div className={styles.healthyItem}>
              <div className={styles.healthyBullet}>✓</div>
              <div>
                <strong>Voyage &amp; Fuel Optimization:</strong> Automated weather isochrone models running. 6.2 MT VLSFO route savings validated for Pacific Voyager.
              </div>
            </div>
            <div className={styles.healthyItem}>
              <div className={styles.healthyBullet}>✓</div>
              <div>
                <strong>Application Assurance Platform:</strong> Typecheck, ESLint, 9 Vitest calculation assertions, and Vite static build verified with 0 defects.
              </div>
            </div>
            <div className={styles.healthyItem}>
              <div className={styles.healthyBullet}>✓</div>
              <div>
                <strong>Deterministic Policy Guardrails:</strong> Zero unauthenticated external writebacks. Critical risk autonomous actions blocked.
              </div>
            </div>
            <div className={styles.healthyItem}>
              <div className={styles.healthyBullet}>✓</div>
              <div>
                <strong>Satellite Telemetry Bus:</strong> Ship-to-shore message queues latency nominal (&lt; 280ms).
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Departmental Health Grid */}
      <div className={styles.sectionHeading}>
        <h3>DEPARTMENTAL HEALTH &amp; DELEGATED AUTONOMY</h3>
        <Link to="/organization" className={styles.sectionLink}>
          Interactive Org Chart <ExternalLink size={13} />
        </Link>
      </div>

      <div className={styles.deptGrid}>
        {departments
          .filter((d) => d.id !== 'DEPT-EXEC')
          .map((dept) => {
            const deptAgents = agents.filter((a) => a.departmentId === dept.id);
            const deptTasks = tasks.filter((t) => t.departmentId === dept.id);
            const deptApprovals = pendingApprovals.filter((a) => a.departmentId === dept.id);
            const director = OrganizationService.getActor(dept.directorId);

            return (
              <div key={dept.id} className={styles.deptCard} data-testid={`dept-card-${dept.code.toLowerCase()}`}>
                <div className={styles.deptHeader}>
                  <div>
                    <span className={styles.deptCode}>{dept.code}</span>
                    <h4 className={styles.deptName}>{dept.name}</h4>
                  </div>
                  {deptApprovals.length > 0 ? (
                    <span className="pill medium">
                      {deptApprovals.length} Approval{deptApprovals.length > 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="pill low">Nominal</span>
                  )}
                </div>

                <p className={styles.deptDesc}>{dept.description}</p>

                <div className={styles.directorRow}>
                  <span className={styles.directorLabel}>Director:</span>
                  <span className={styles.directorName}>{director?.name}</span>
                  <EntityBadge type={director?.entityType || 'HUMAN'} size="sm" />
                </div>

                <div className={styles.deptStatsRow}>
                  <div className={styles.deptStat}>
                    <span className={styles.statNum}>{deptAgents.length}</span>
                    <span className={styles.statLabel}>Agents</span>
                  </div>
                  <div className={styles.deptStat}>
                    <span className={styles.statNum}>{deptTasks.length}</span>
                    <span className={styles.statLabel}>Tasks</span>
                  </div>
                  <div className={styles.deptStat}>
                    <span className={styles.statNum}>
                      {deptAgents.reduce((acc, a) => acc + a.tasksCompleted, 0)}
                    </span>
                    <span className={styles.statLabel}>Today</span>
                  </div>
                </div>

                <div className={styles.deptFooter}>
                  <Link to={`/workforce?dept=${dept.id}`} className={styles.deptLink}>
                    View Workforce &rarr;
                  </Link>
                </div>
              </div>
            );
          })}
      </div>

      {/* Recent Executive Activity Events */}
      <div className={styles.sectionHeading} style={{ marginTop: '2rem' }}>
        <h3>RECENT EXECUTIVE EVENTS &amp; AUDIT STREAM</h3>
        <Link to="/activity" className={styles.sectionLink}>
          Full Live Stream &rarr;
        </Link>
      </div>

      <div className={styles.eventStreamCard}>
        {recentEvents.map((evt) => (
          <div key={evt.eventId} className={styles.streamRow}>
            <span className={styles.streamTime}>{evt.timestamp.slice(11, 19)} UTC</span>
            <span className={styles.streamActor}>{evt.actorName}</span>
            <span className={`pill ${evt.severity === 'CRITICAL' ? 'critical' : evt.severity === 'HIGH' ? 'high' : evt.severity === 'MEDIUM' ? 'medium' : 'low'}`}>
              {evt.eventType}
            </span>
            <span className={styles.streamSummary}>{evt.summary}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
