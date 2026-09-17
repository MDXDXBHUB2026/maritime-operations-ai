import React, { useEffect, useState } from 'react';
import { AssuranceReport } from '../../types/assurance';
import { MetricCard } from '../../components/common/MetricCard';
import {
  ShieldCheck,
  CheckCircle2,
  AlertOctagon,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';

const BASE_URL = import.meta.env.BASE_URL || '/';

export const AssuranceCentrePage: React.FC = () => {
  const [report, setReport] = useState<AssuranceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters for findings
  const [severityFilter, setSeverityFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(null);

  const fetchAssuranceReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const url = `${BASE_URL.replace(/\/$/, '')}/assurance/latest.json`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Assurance report not found (${res.status} ${res.statusText})`);
      }
      const data = await res.json();
      if (!data || !data.summary) {
        throw new Error('Malformed assurance report JSON structure');
      }
      setReport(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to load assurance pipeline results.';
      console.warn('Failed to load latest.json from public/assurance:', msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssuranceReport();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--muted)' }}>
        <RefreshCw size={24} className="spin" style={{ marginBottom: '0.75rem' }} />
        <div>Loading Application Assurance Platform data...</div>
      </div>
    );
  }

  // Graceful state for missing / error reports
  if (error || !report) {
    return (
      <div>
        <div className="eyebrow">SOFTWARE QUALITY &amp; SECURITY ASSURANCE</div>
        <h1>Application Assurance Centre</h1>
        <p className="subtitle">
          Continuous quality gates, static security verification, and deterministic CI assurance
          results
        </p>

        <div className="banner-error">
          <AlertOctagon size={18} />
          <div>
            <strong>Assurance Pipeline Data Unavailable</strong>:{' '}
            {error || 'No assurance report found.'}
            <div style={{ fontSize: '0.78rem', marginTop: '0.35rem', color: '#ffd0d6' }}>
              Run the assurance pipeline via CI or locally using <code>npm run assurance</code> to
              generate <code>public/assurance/latest.json</code>.
            </div>
          </div>
        </div>

        <div className="card-panel" style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
          <ShieldCheck size={48} style={{ color: 'var(--muted)', margin: '0 auto 1rem' }} />
          <h3>No Active Report Available</h3>
          <p
            style={{
              maxWidth: '540px',
              margin: '0 auto 1.5rem',
              color: 'var(--muted)',
              fontSize: '0.9rem',
            }}
          >
            The Application Assurance Centre displays deterministic audit findings from GitHub
            Actions or local CLI runs. No test or secret credentials are ever executed inside the
            browser.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={fetchAssuranceReport}>
              <RefreshCw size={14} /> Retry Loading Results
            </button>
            <a
              href="https://github.com/MDXDXBHUB2026/maritime-operations-ai/actions"
              target="_blank"
              rel="noopener noreferrer"
              className="btn"
            >
              <ExternalLink size={14} /> View GitHub Actions
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Filter findings
  const filteredFindings = (report.findings || []).filter((f) => {
    if (severityFilter !== 'All' && f.severity !== severityFilter) return false;
    if (statusFilter !== 'All' && f.verificationStatus !== statusFilter) return false;
    return true;
  });

  return (
    <div>
      <div className="eyebrow">SOFTWARE QUALITY &amp; SECURITY ASSURANCE</div>
      <h1>Application Assurance Centre</h1>
      <p className="subtitle">
        Continuous quality gates, static security verification, and deterministic CI assurance
        results
      </p>

      {/* CI Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.75rem',
          background: 'rgba(16, 29, 47, 0.7)',
          border: '1px solid var(--line)',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          marginBottom: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span
            className={`pill ${report.status === 'PASSED' ? 'low' : report.status === 'WARNING' ? 'medium' : 'critical'}`}
          >
            ● {report.status}
          </span>
          <span style={{ fontSize: '0.85rem', color: '#cddceb' }}>
            Generated by CI assurance pipeline &middot; Run ID: <code>{report.runId}</code>
          </span>
        </div>

        <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
          Commit: <code>{report.commitSha.substring(0, 7)}</code> &middot; Last updated:{' '}
          {new Date(report.timestamp).toLocaleString()}
        </div>
      </div>

      {/* Top 6 KPI Cards */}
      <div className="grid-6">
        <MetricCard
          label="Overall Status"
          value={report.status}
          icon="🛡"
          badge={report.environment.toUpperCase()}
        />
        <MetricCard
          label="QA Gate"
          value={report.summary.qaGateStatus}
          icon="✓"
          badge={`${report.qa.totalTests} TESTS`}
        />
        <MetricCard
          label="Security Gate"
          value={report.summary.securityGateStatus}
          icon="🔒"
          badge="SAFE CI"
        />
        <MetricCard
          label="Critical Findings"
          value={report.summary.criticalFindings}
          icon="!"
          badge="SEV 1"
        />
        <MetricCard
          label="High Findings"
          value={report.summary.highFindings}
          icon="▲"
          badge="SEV 2"
        />
        <MetricCard
          label="Medium Findings"
          value={report.summary.mediumFindings}
          icon="◆"
          badge="SEV 3"
        />
      </div>

      {/* QA & Security Gate Details */}
      <div className="grid-2">
        {/* QA Checks */}
        <div className="card-panel">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.75rem',
            }}
          >
            <h3 style={{ margin: 0 }}>Deterministic QA Agent Status</h3>
            <span className={`pill ${report.qa.status === 'PASSED' ? 'low' : 'critical'}`}>
              {report.qa.status}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {Object.entries(report.qa.checks || {}).map(([key, item]) => (
              <div
                key={key}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.65rem 0.85rem',
                  background: '#091424',
                  borderRadius: '6px',
                  border: '1px solid var(--line)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#e6eef8' }}>
                    {item.tool}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{item.details}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                    {(item.durationMs / 1000).toFixed(1)}s
                  </span>
                  <span
                    className={`pill ${item.status === 'passed' ? 'low' : item.status === 'skipped' ? 'info' : 'critical'}`}
                  >
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Security Checks */}
        <div className="card-panel">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.75rem',
            }}
          >
            <h3 style={{ margin: 0 }}>CI Security Agent Status</h3>
            <span
              className={`pill ${report.security.status === 'PASSED' ? 'low' : report.security.status === 'WARNING' ? 'medium' : 'critical'}`}
            >
              {report.security.status}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {Object.entries(report.security.checks || {}).map(([key, item]) => (
              <div
                key={key}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.65rem 0.85rem',
                  background: '#091424',
                  borderRadius: '6px',
                  border: '1px solid var(--line)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#e6eef8' }}>
                    {item.check}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{item.details}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span
                    className={`pill ${item.status === 'passed' ? 'low' : item.status === 'warning' ? 'medium' : 'critical'}`}
                  >
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Findings Register */}
      <div className="card-panel">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem',
          }}
        >
          <h3 style={{ margin: 0 }}>Assurance Findings Register</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            Showing {filteredFindings.length} of {report.findings.length} findings
          </span>
        </div>

        {/* Filters */}
        <div className="filter-bar" style={{ marginBottom: '1rem' }}>
          <div className="filter-item">
            <label>Severity</label>
            <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
              <option value="All">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
              <option value="Informational">Informational</option>
            </select>
          </div>

          <div className="filter-item">
            <label>Verification Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="All">All Statuses</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Partially Verified">Partially Verified</option>
              <option value="Observation">Observation</option>
              <option value="Requires Manual Verification">Requires Manual Verification</option>
            </select>
          </div>
        </div>

        {filteredFindings.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: '#28c499' }}>
            <CheckCircle2 size={32} style={{ margin: '0 auto 0.5rem' }} />
            <div>No active security or QA findings match the current criteria.</div>
          </div>
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Agent</th>
                  <th>Severity</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Verification Status</th>
                  <th>Affected Area</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredFindings.map((f) => {
                  const isExpanded = expandedFindingId === f.id;
                  return (
                    <React.Fragment key={f.id}>
                      <tr
                        onClick={() => setExpandedFindingId(isExpanded ? null : f.id)}
                        style={{ cursor: 'pointer' }}
                        className={isExpanded ? 'selected' : ''}
                      >
                        <td style={{ fontWeight: 600, color: 'var(--cyan)' }}>{f.id}</td>
                        <td>{f.agent}</td>
                        <td>
                          <span className={`pill ${f.severity.toLowerCase()}`}>{f.severity}</span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{f.title}</td>
                        <td>{f.category}</td>
                        <td>
                          <span className="pill info">{f.verificationStatus}</span>
                        </td>
                        <td>{f.affectedArea}</td>
                        <td>
                          <button
                            style={{ color: 'var(--cyan)', display: 'flex', alignItems: 'center' }}
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Detail Row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} style={{ padding: '1.25rem', background: '#091526' }}>
                            <div
                              style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
                            >
                              <div>
                                <label
                                  style={{
                                    color: '#71869f',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  Description
                                </label>
                                <div
                                  style={{
                                    fontSize: '0.875rem',
                                    color: '#e6eef8',
                                    marginTop: '0.15rem',
                                  }}
                                >
                                  {f.description}
                                </div>
                              </div>

                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                  gap: '0.75rem',
                                }}
                              >
                                <div>
                                  <label
                                    style={{
                                      color: '#71869f',
                                      fontSize: '0.7rem',
                                      fontWeight: 700,
                                      textTransform: 'uppercase',
                                    }}
                                  >
                                    Redacted Evidence
                                  </label>
                                  <pre
                                    style={{
                                      background: '#040b14',
                                      padding: '0.5rem',
                                      borderRadius: '4px',
                                      fontSize: '0.75rem',
                                      color: '#ffd0d6',
                                      overflowX: 'auto',
                                      marginTop: '0.15rem',
                                    }}
                                  >
                                    {f.evidence}
                                  </pre>
                                </div>

                                <div>
                                  <label
                                    style={{
                                      color: '#71869f',
                                      fontSize: '0.7rem',
                                      fontWeight: 700,
                                      textTransform: 'uppercase',
                                    }}
                                  >
                                    Impact
                                  </label>
                                  <div
                                    style={{
                                      fontSize: '0.85rem',
                                      color: '#cbdbea',
                                      marginTop: '0.15rem',
                                    }}
                                  >
                                    {f.impact}
                                  </div>
                                </div>
                              </div>

                              <div>
                                <label
                                  style={{
                                    color: '#71869f',
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  Remediation
                                </label>
                                <div
                                  style={{
                                    fontSize: '0.85rem',
                                    color: '#77e2c3',
                                    marginTop: '0.15rem',
                                  }}
                                >
                                  {f.remediation}
                                </div>
                              </div>

                              <div
                                style={{
                                  display: 'flex',
                                  gap: '1rem',
                                  fontSize: '0.75rem',
                                  color: 'var(--muted)',
                                  marginTop: '0.25rem',
                                }}
                              >
                                {f.owaspMapping && (
                                  <span>
                                    OWASP: <strong>{f.owaspMapping}</strong>
                                  </span>
                                )}
                                {f.cweMapping && (
                                  <span>
                                    CWE: <strong>{f.cweMapping}</strong>
                                  </span>
                                )}
                                <span>
                                  Confidence: <strong>{f.confidence}%</strong>
                                </span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Positive Controls & Remediation Roadmap */}
      <div className="grid-2">
        {/* Positive Controls */}
        <div className="card-panel">
          <h3>Positive Security &amp; QA Controls</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {report.positiveControls.map((pc) => (
              <div
                key={pc.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.65rem 0.85rem',
                  background: '#091424',
                  borderRadius: '6px',
                  border: '1px solid var(--line)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#e6eef8' }}>
                    <span style={{ color: 'var(--cyan)', marginRight: '0.4rem' }}>{pc.id}:</span>
                    {pc.description}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                    {pc.category} &middot; Verified via {pc.verificationMethod}
                  </div>
                </div>
                <span className="pill low">
                  <CheckCircle2 size={12} /> {pc.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Remediation Priorities */}
        <div className="card-panel">
          <h3>Remediation Roadmap</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {report.remediationRoadmap.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                No active remediation priorities pending.
              </div>
            ) : (
              report.remediationRoadmap.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.65rem 0.85rem',
                    background: '#091424',
                    borderRadius: '6px',
                    border: '1px solid var(--line)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: '#1a3754',
                        color: '#25c2d8',
                        fontSize: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                      }}
                    >
                      {item.priority}
                    </span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#e6eef8' }}>
                        {item.action}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                        Target: Finding <code>{item.findingId}</code>
                      </div>
                    </div>
                  </div>
                  <span className="pill info">{item.timeline}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* External Actions (No fake scan button) */}
      <div
        style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}
      >
        <button className="btn btn-primary" onClick={fetchAssuranceReport}>
          <RefreshCw size={14} /> Refresh Latest Results
        </button>
        <a
          href="https://github.com/MDXDXBHUB2026/maritime-operations-ai/actions"
          target="_blank"
          rel="noopener noreferrer"
          className="btn"
        >
          <ExternalLink size={14} /> View GitHub Actions
        </a>
      </div>
    </div>
  );
};
