import React, { useState } from 'react';
import { CheckCircle, Clock, Shield, Award, Bot } from 'lucide-react';
import { AgentService, OrganizationService } from '../../../services/enterprise';
import styles from './PerformancePage.module.css';

export const PerformancePage: React.FC = () => {
  const [selectedDept, setSelectedDept] = useState('ALL');

  const departments = OrganizationService.getDepartments();
  const agents = AgentService.getAgents();

  const filteredAgents =
    selectedDept === 'ALL' ? agents : agents.filter((a) => a.departmentId === selectedDept);

  const totalTasksCompleted = filteredAgents.reduce((acc, a) => acc + a.tasksCompleted, 0);
  const avgQuality = (
    filteredAgents.reduce((acc, a) => acc + a.qualityScore, 0) / (filteredAgents.length || 1)
  ).toFixed(1);
  const avgSla = (
    filteredAgents.reduce((acc, a) => acc + a.slaPerformance, 0) / (filteredAgents.length || 1)
  ).toFixed(1);

  return (
    <div className={styles.container} data-testid="performance-page">
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className="eyebrow">WORKFORCE PRODUCTIVITY &amp; SLA BENCHMARKS</div>
          <h1>AI Workforce Performance Analytics</h1>
          <p className="subtitle" style={{ marginBottom: 0 }}>
            Operational metrics tracking task completion rates, verification success, and
            supervisory turnaround time.
          </p>
        </div>
        <div className={styles.headerNotice}>
          <span className="pill info">
            <span>●</span> SYNTHETIC TELEMETRY
          </span>
          <span className={styles.noticeText}>Illustrative synthetic performance metrics.</span>
        </div>
      </div>

      {/* Filter by Department */}
      <div className={styles.filterRow}>
        <span className={styles.filterLabel}>Scope:</span>
        <button
          className={`${styles.filterPill} ${selectedDept === 'ALL' ? styles.filterPillActive : ''}`}
          onClick={() => setSelectedDept('ALL')}
        >
          Enterprise Fleetwide
        </button>
        {departments
          .filter((d) => d.id !== 'DEPT-EXEC')
          .map((dept) => (
            <button
              key={dept.id}
              className={`${styles.filterPill} ${selectedDept === dept.id ? styles.filterPillActive : ''}`}
              onClick={() => setSelectedDept(dept.id)}
            >
              {dept.name}
            </button>
          ))}
      </div>

      {/* Benchmark KPI Cards */}
      <div className={styles.kpiGrid}>
        <div className="kpi-card">
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>TASKS COMPLETED TODAY</span>
            <CheckCircle size={18} style={{ color: 'var(--green)' }} />
          </div>
          <div className={styles.kpiVal}>{totalTasksCompleted}</div>
          <div className={styles.kpiFoot}>
            <span style={{ color: 'var(--green)' }}>● 100% Success Rate</span>
            <span>0 Unhandled Failures</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>MEAN QUALITY SCORE</span>
            <Award size={18} style={{ color: 'var(--cyan)' }} />
          </div>
          <div className={styles.kpiVal}>{avgQuality}%</div>
          <div className={styles.kpiFoot}>
            <span style={{ color: 'var(--cyan)' }}>Benchmark: &gt; 95%</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>SLA COMPLIANCE</span>
            <Clock size={18} style={{ color: 'var(--amber)' }} />
          </div>
          <div className={styles.kpiVal}>{avgSla}%</div>
          <div className={styles.kpiFoot}>
            <span>Turnaround: ~4.2 mins avg</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className={styles.kpiTop}>
            <span className={styles.kpiLabel}>INDEPENDENT VERIFICATION PASS RATE</span>
            <Shield size={18} style={{ color: '#c084fc' }} />
          </div>
          <div className={styles.kpiVal}>100%</div>
          <div className={styles.kpiFoot}>
            <span style={{ color: 'var(--green)' }}>0 Gate Bypasses</span>
          </div>
        </div>
      </div>

      {/* Agent Performance Table */}
      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h3>AGENT-LEVEL PRODUCTIVITY &amp; ACCURACY MATRIX</h3>
        </div>
        <div className={styles.tableResponsive}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Agent Identity</th>
                <th>Department</th>
                <th>Tasks Today</th>
                <th>Success Rate</th>
                <th>Quality Score</th>
                <th>Confidence</th>
                <th>SLA Adherence</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredAgents.map((agent) => (
                <tr key={agent.id} data-testid={`perf-row-${agent.id.toLowerCase()}`}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Bot size={15} style={{ color: 'var(--cyan)' }} />
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-bright)' }}>
                          {agent.name}
                        </div>
                        <div
                          style={{
                            fontSize: '0.7rem',
                            color: 'var(--cyan)',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {agent.id}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={styles.deptBadge}>{agent.departmentId}</span>
                  </td>
                  <td>
                    <strong>{agent.tasksToday}</strong>
                  </td>
                  <td>
                    <span style={{ color: 'var(--green)', fontWeight: 600 }}>100%</span>
                  </td>
                  <td>
                    <div className={styles.barCell}>
                      <div className={styles.miniBar}>
                        <div
                          className={styles.miniBarFill}
                          style={{ width: `${agent.qualityScore}%`, background: 'var(--cyan)' }}
                        />
                      </div>
                      <span>{agent.qualityScore}%</span>
                    </div>
                  </td>
                  <td>{(agent.confidenceScore * 100).toFixed(0)}%</td>
                  <td>
                    <span style={{ color: 'var(--green)', fontWeight: 600 }}>
                      {agent.slaPerformance}%
                    </span>
                  </td>
                  <td>
                    <span
                      className={`pill ${agent.status === 'PAUSED' ? 'warning' : agent.status === 'DEGRADED' ? 'critical' : 'healthy'}`}
                    >
                      {agent.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
