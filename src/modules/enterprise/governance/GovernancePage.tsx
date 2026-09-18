import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Cpu,
  FileText,
  Lock,
} from 'lucide-react';
import { CapabilityStatus } from '../../../domain/enterprise';
import {
  AuditService,
  CapabilityService,
  PolicyService,
  subscribeEnterpriseState,
} from '../../../services/enterprise';
import { SimulatedControlBanner } from '../../../components/enterprise/SimulatedControlBanner';
import styles from './GovernancePage.module.css';

type GovTab = 'CAPABILITIES' | 'POLICIES' | 'AUDIT';

export const GovernancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<GovTab>('CAPABILITIES');
  const [, setTick] = useState(0);

  useEffect(() => {
    return subscribeEnterpriseState(() => setTick((t) => t + 1));
  }, []);

  const capabilities = CapabilityService.getCapabilities();
  const policies = PolicyService.getPolicies();
  const auditTrail = AuditService.getAuditTrail(50);

  const handleToggleCapability = (capId: string, currentStatus: CapabilityStatus) => {
    // Cycle between AVAILABLE -> DEGRADED -> UNAVAILABLE -> AVAILABLE
    const nextStatus: CapabilityStatus =
      currentStatus === 'AVAILABLE'
        ? 'DEGRADED'
        : currentStatus === 'DEGRADED'
          ? 'UNAVAILABLE'
          : 'AVAILABLE';

    CapabilityService.toggleCapabilityStatus(capId, nextStatus);
  };

  return (
    <div className={styles.container} data-testid="governance-page">
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className="eyebrow">GOVERNANCE &bull; POLICY &bull; CAPABILITIES &bull; AUDIT</div>
          <h1>Enterprise Governance &amp; Capability Registry</h1>
          <p className="subtitle" style={{ marginBottom: 0 }}>
            Vendor-neutral business capability registries, deterministic policy guardrails, and immutable audit logs.
          </p>
        </div>
        <div>
          <span className="pill healthy">GOVERNANCE ACTIVE</span>
        </div>
      </div>

      <SimulatedControlBanner />

      {/* Tabs */}
      <div className={styles.tabNav}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'CAPABILITIES' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('CAPABILITIES')}
          data-testid="tab-capabilities"
        >
          <Cpu size={16} />
          <span>Capability Registry ({capabilities.length})</span>
        </button>

        <button
          className={`${styles.tabBtn} ${activeTab === 'POLICIES' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('POLICIES')}
          data-testid="tab-policies"
        >
          <ShieldCheck size={16} />
          <span>Governance Policies ({policies.length})</span>
        </button>

        <button
          className={`${styles.tabBtn} ${activeTab === 'AUDIT' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('AUDIT')}
          data-testid="tab-audit-trail"
        >
          <FileText size={16} />
          <span>Immutable Audit Trail ({auditTrail.length})</span>
        </button>
      </div>

      {/* Tab 1: Capability Registry */}
      {activeTab === 'CAPABILITIES' && (
        <div className={styles.sectionWrap} data-testid="capability-registry-section">
          <div className={styles.sectionInfo}>
            <p>
              Agents depend on abstract <strong>Business Capabilities</strong> rather than vendor-specific APIs. Toggle capability availability below to observe automatic agent operational mode degradation (FULL &rarr; LIMITED &rarr; DEGRADED).
            </p>
          </div>

          <div className={styles.capGrid}>
            {capabilities.map((cap) => (
              <div
                key={cap.id}
                className={styles.capCard}
                data-testid={`cap-card-${cap.code.toLowerCase()}`}
              >
                <div className={styles.capHeader}>
                  <div>
                    <span className={styles.capCode}>{cap.code}</span>
                    <h3 className={styles.capName}>{cap.name}</h3>
                  </div>
                  <span
                    className={`pill ${
                      cap.status === 'AVAILABLE'
                        ? 'healthy'
                        : cap.status === 'DEGRADED'
                          ? 'warning'
                          : cap.status === 'UNAVAILABLE'
                            ? 'critical'
                            : 'info'
                    }`}
                  >
                    {cap.status}
                  </span>
                </div>

                <p className={styles.capDesc}>{cap.description}</p>

                <div className={styles.providerRow}>
                  <span className={styles.providerLabel}>Provider:</span>
                  <span className={styles.providerName}>{cap.provider}</span>
                  {cap.isSimulated && <span className="pill info" style={{ fontSize: '0.65rem' }}>SIMULATED</span>}
                </div>

                <div className={styles.dependentAgentsRow}>
                  <span className={styles.depLabel}>Dependent Agents ({cap.dependentAgentIds.length}):</span>
                  <div className={styles.depList}>
                    {cap.dependentAgentIds.map((agId) => (
                      <span key={agId} className={styles.depTag}>
                        {agId}
                      </span>
                    ))}
                  </div>
                </div>

                <div className={styles.capActions}>
                  <button
                    className={styles.toggleStatusBtn}
                    onClick={() => handleToggleCapability(cap.id, cap.status)}
                    data-testid={`btn-toggle-cap-${cap.code.toLowerCase()}`}
                  >
                    <span>Cycle Status (Current: {cap.status})</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Policy Register */}
      {activeTab === 'POLICIES' && (
        <div className={styles.sectionWrap} data-testid="policies-section">
          <div className={styles.sectionInfo}>
            <p>
              Deterministic governance policies enforced across task execution, risk thresholds, and autonomous actions.
            </p>
          </div>

          <div className={styles.policyList}>
            {policies.map((pol) => (
              <div
                key={pol.id}
                className={styles.policyCard}
                data-testid={`policy-card-${pol.id.toLowerCase()}`}
              >
                <div className={styles.policyTop}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <ShieldCheck size={18} style={{ color: 'var(--cyan)' }} />
                    <div>
                      <span className={styles.policyIdTag}>{pol.id}</span>
                      <h3 className={styles.policyTitle}>{pol.name}</h3>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span
                      className={`pill ${
                        pol.enforcement === 'BLOCK'
                          ? 'critical'
                          : pol.enforcement === 'REQUIRE_APPROVAL'
                            ? 'warning'
                            : 'info'
                      }`}
                    >
                      {pol.enforcement}
                    </span>
                    <span className="pill healthy">ACTIVE</span>
                  </div>
                </div>

                <p className={styles.policyDesc}>{pol.description}</p>

                <div className={styles.rulesBox}>
                  <strong>Deterministic Rule:</strong> {pol.rulesSummary}
                </div>

                {pol.minApprovalLevel && (
                  <div className={styles.minLevelRow}>
                    <Lock size={12} style={{ color: 'var(--muted)' }} />
                    <span>
                      Minimum Authority Required:{' '}
                      <strong style={{ color: 'var(--cyan)' }}>{pol.minApprovalLevel}</strong>
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Immutable Audit Trail */}
      {activeTab === 'AUDIT' && (
        <div className={styles.sectionWrap} data-testid="audit-trail-section">
          <div className={styles.sectionInfo}>
            <p>
              Tamper-proof, read-only ledger recording all supervisory decisions, capability toggles, workflow overrides, and policy evaluations.
            </p>
          </div>

          <div className={styles.auditTableCard}>
            <div className={styles.tableResponsive}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Actor</th>
                    <th>Target</th>
                    <th>Policy Ref</th>
                    <th>Transition (Before &rarr; After)</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {auditTrail.map((rec) => (
                    <tr key={rec.id} data-testid={`audit-row-${rec.id.toLowerCase()}`}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--muted)' }}>
                        {rec.timestamp}
                      </td>
                      <td>
                        <span className={styles.actionTag}>{rec.action}</span>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{rec.actorName}</td>
                      <td>
                        <div>
                          <span style={{ color: 'var(--cyan)', fontSize: '0.72rem' }}>
                            [{rec.targetType}]
                          </span>{' '}
                          <span style={{ color: 'var(--text)' }}>{rec.targetName}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.72rem', color: 'var(--muted-light)' }}>
                          {rec.policyId || '—'}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                          {rec.beforeState || '—'} &rarr;{' '}
                          <strong style={{ color: 'var(--text-bright)' }}>{rec.afterState || '—'}</strong>
                        </span>
                      </td>
                      <td>
                        <span
                          className={`pill ${
                            rec.result === 'SUCCESS' ? 'healthy' : 'critical'
                          }`}
                        >
                          {rec.result}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
