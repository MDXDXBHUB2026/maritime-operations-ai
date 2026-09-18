import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Shield, XCircle, ArrowUpRight, Info } from 'lucide-react';
import { ApprovalRequest } from '../../../domain/enterprise';
import { ApprovalService, subscribeEnterpriseState } from '../../../services/enterprise';
import { RiskBadge } from '../../../components/enterprise/RiskBadge';
import { SimulatedControlBanner } from '../../../components/enterprise/SimulatedControlBanner';
import styles from './ApprovalInboxPage.module.css';

type InboxTab = 'PENDING' | 'ESCALATED' | 'VERIFICATION' | 'RESOLVED';

export const ApprovalInboxPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<InboxTab>('PENDING');
  const [, setTick] = useState(0);

  // Confirmation modal state for High/Critical risk approvals
  const [confirmingApproval, setConfirmingApproval] = useState<{
    request: ApprovalRequest;
    action: 'APPROVE' | 'REJECT';
  } | null>(null);
  const [decisionComment, setDecisionComment] = useState('');

  useEffect(() => {
    return subscribeEnterpriseState(() => setTick((t) => t + 1));
  }, []);

  const pendingList = ApprovalService.getPendingApprovals();
  const resolvedList = ApprovalService.getResolvedApprovals(20);

  const awaitingList = pendingList.filter((a) => a.status === 'PENDING');
  const escalatedList = pendingList.filter((a) => a.status === 'ESCALATED');
  const verificationList = pendingList.filter((a) => a.status === 'VERIFICATION_REQUESTED');

  const getActiveList = () => {
    switch (activeTab) {
      case 'PENDING':
        return awaitingList;
      case 'ESCALATED':
        return escalatedList;
      case 'VERIFICATION':
        return verificationList;
      case 'RESOLVED':
        return resolvedList;
    }
  };

  const handleOpenApproveModal = (req: ApprovalRequest) => {
    setConfirmingApproval({ request: req, action: 'APPROVE' });
    setDecisionComment('Approved following operational review and evidence verification.');
  };

  const handleOpenRejectModal = (req: ApprovalRequest) => {
    setConfirmingApproval({ request: req, action: 'REJECT' });
    setDecisionComment('Rejected by operational authority due to safety margin policy.');
  };

  const executeDecision = () => {
    if (!confirmingApproval) return;
    const { request, action } = confirmingApproval;

    if (action === 'APPROVE') {
      ApprovalService.approve(
        request.id,
        'ACT-CEO',
        'Capt. Alexander Vance (CEO)',
        decisionComment
      );
    } else {
      ApprovalService.reject(request.id, 'ACT-CEO', 'Capt. Alexander Vance (CEO)', decisionComment);
    }
    setConfirmingApproval(null);
  };

  const handleRequestVerification = (req: ApprovalRequest) => {
    ApprovalService.requestVerification(req.id);
  };

  const handleEscalate = (req: ApprovalRequest) => {
    ApprovalService.escalate(req.id, 'Management priority escalation');
  };

  return (
    <div className={styles.container} data-testid="approval-inbox-page">
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className="eyebrow">DETERMINISTIC GOVERNANCE &amp; HUMAN SIGN-OFF</div>
          <h1>Decision &amp; Approval Inbox</h1>
          <p className="subtitle" style={{ marginBottom: 0 }}>
            Mandatory human review gates for high-risk recommendations, safety interventions, and
            voyage modifications.
          </p>
        </div>
        <div className={styles.metaNotice}>
          <span className="pill warning">HUMAN IN THE LOOP</span>
        </div>
      </div>

      {/* Simulated Control Banner */}
      <SimulatedControlBanner />

      {/* Tabs */}
      <div className={styles.tabNav}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'PENDING' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('PENDING')}
          data-testid="tab-awaiting-approval"
        >
          <span>Awaiting My Approval</span>
          <span className={styles.tabCountBadge}>{awaitingList.length}</span>
        </button>

        <button
          className={`${styles.tabBtn} ${activeTab === 'ESCALATED' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('ESCALATED')}
          data-testid="tab-escalated"
        >
          <span>Escalations</span>
          {escalatedList.length > 0 && (
            <span
              className={styles.tabCountBadge}
              style={{ background: 'var(--red)', color: '#fff' }}
            >
              {escalatedList.length}
            </span>
          )}
        </button>

        <button
          className={`${styles.tabBtn} ${activeTab === 'VERIFICATION' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('VERIFICATION')}
          data-testid="tab-verification"
        >
          <span>Verification Required</span>
          {verificationList.length > 0 && (
            <span className={styles.tabCountBadge}>{verificationList.length}</span>
          )}
        </button>

        <button
          className={`${styles.tabBtn} ${activeTab === 'RESOLVED' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('RESOLVED')}
          data-testid="tab-resolved"
        >
          <span>Recently Resolved ({resolvedList.length})</span>
        </button>
      </div>

      {/* Approval Items List */}
      <div className={styles.approvalList}>
        {getActiveList().length === 0 ? (
          <div className={styles.emptyCard}>
            <CheckCircle2 size={32} style={{ color: 'var(--green)', marginBottom: '0.5rem' }} />
            <h3>No Pending Approvals</h3>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
              All delegated tasks in this queue are nominal. No management sign-offs currently
              pending.
            </p>
          </div>
        ) : (
          getActiveList().map((item) => (
            <div
              key={item.id}
              className={styles.approvalCard}
              data-testid={`approval-card-${item.id.toLowerCase()}`}
            >
              {/* Card Header */}
              <div className={styles.cardHeader}>
                <div>
                  <div className={styles.itemRefRow}>
                    <span className={styles.approvalId}>{item.id}</span>
                    <span>&bull;</span>
                    <span className={styles.taskId}>{item.taskId}</span>
                    <span>&bull;</span>
                    <span className={styles.agentTag}>{item.agentName}</span>
                  </div>
                  <h3 className={styles.itemTitle}>{item.taskTitle}</h3>
                </div>
                <div className={styles.headerBadges}>
                  <RiskBadge risk={item.risk} />
                  <span
                    className={`pill ${item.status === 'APPROVED' ? 'approved' : item.status === 'REJECTED' ? 'critical' : 'warning'}`}
                  >
                    {item.status}
                  </span>
                </div>
              </div>

              {/* Recommended Action */}
              <div className={styles.recommendedBox}>
                <span className={styles.boxLabel}>RECOMMENDED ACTION:</span>
                <p className={styles.actionText}>{item.recommendedAction}</p>
              </div>

              {/* Governance & Policy Reason */}
              <div className={styles.governanceNotice}>
                <Info size={15} style={{ color: 'var(--cyan)', flexShrink: 0 }} />
                <span>
                  <strong>Triggering Policy:</strong> {item.policyName} ({item.policyId}). Reason:{' '}
                  {item.reasonRequired}
                </span>
              </div>

              {/* Detail Grid */}
              <div className={styles.detailGrid}>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Confidence Score:</span>
                  <span style={{ color: 'var(--green)', fontWeight: 600 }}>
                    {(item.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Target Approver:</span>
                  <span style={{ color: 'var(--text-bright)' }}>{item.approverRole}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Business Impact:</span>
                  <span style={{ color: 'var(--muted-light)' }}>{item.impact}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Decision Deadline:</span>
                  <span style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>
                    {item.deadline}
                  </span>
                </div>
              </div>

              {/* Evidence References */}
              <div className={styles.evidenceSection}>
                <span className={styles.evidenceHeading}>
                  Supporting Evidence &amp; Telemetry Logs:
                </span>
                <ul className={styles.evidenceList}>
                  {item.evidence.map((ev, idx) => (
                    <li key={idx}>{ev}</li>
                  ))}
                </ul>
              </div>

              {/* Resolved notes if already decided */}
              {item.decidedAt && (
                <div className={styles.resolutionBox}>
                  <strong>
                    Resolved by {item.decidedBy} at {item.decidedAt}:
                  </strong>{' '}
                  {item.decisionComment}
                </div>
              )}

              {/* Action Buttons (Only for active pending items) */}
              {item.status === 'PENDING' && (
                <div className={styles.actionRow}>
                  <button
                    className={styles.btnApprove}
                    onClick={() => handleOpenApproveModal(item)}
                    data-testid={`btn-approve-${item.id.toLowerCase()}`}
                  >
                    <CheckCircle2 size={14} /> Approve Action
                  </button>

                  <button
                    className={styles.btnReject}
                    onClick={() => handleOpenRejectModal(item)}
                    data-testid={`btn-reject-${item.id.toLowerCase()}`}
                  >
                    <XCircle size={14} /> Reject
                  </button>

                  <button
                    className={styles.btnActionSecondary}
                    onClick={() => handleRequestVerification(item)}
                    data-testid={`btn-verify-${item.id.toLowerCase()}`}
                  >
                    <Shield size={14} /> Request Verification
                  </button>

                  <button
                    className={styles.btnActionSecondary}
                    onClick={() => handleEscalate(item)}
                    data-testid={`btn-escalate-${item.id.toLowerCase()}`}
                  >
                    <ArrowUpRight size={14} /> Escalate
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* High-Risk Approval Confirmation Modal */}
      {confirmingApproval && (
        <div className={styles.modalOverlay} onClick={() => setConfirmingApproval(null)}>
          <div
            className={styles.modal}
            data-testid="approval-confirm-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <AlertTriangle
                  size={20}
                  style={{
                    color: confirmingApproval.action === 'APPROVE' ? 'var(--amber)' : 'var(--red)',
                  }}
                />
                <h3>
                  {confirmingApproval.action === 'APPROVE'
                    ? 'Confirm Operational Approval'
                    : 'Confirm Action Rejection'}
                </h3>
              </div>
              <button
                className={styles.closeBtn}
                onClick={() => setConfirmingApproval(null)}
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>

            <div className={styles.modalBody}>
              <SimulatedControlBanner compact />

              <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text)' }}>
                You are about to{' '}
                <strong
                  style={{
                    color: confirmingApproval.action === 'APPROVE' ? 'var(--green)' : 'var(--red)',
                  }}
                >
                  {confirmingApproval.action}
                </strong>{' '}
                the following recommendation:
              </div>

              <div className={styles.modalTaskCard}>
                <div style={{ fontWeight: 600, color: '#f0f6fc', marginBottom: '0.25rem' }}>
                  {confirmingApproval.request.taskTitle}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--muted-light)' }}>
                  {confirmingApproval.request.recommendedAction}
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  <RiskBadge risk={confirmingApproval.request.risk} size="sm" />
                </div>
              </div>

              <div className={styles.commentField}>
                <label
                  htmlFor="decision-comment"
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--muted)',
                    display: 'block',
                    marginBottom: '0.35rem',
                  }}
                >
                  Management Comment &amp; Audit Rationale:
                </label>
                <textarea
                  id="decision-comment"
                  rows={3}
                  value={decisionComment}
                  onChange={(e) => setDecisionComment(e.target.value)}
                  style={{ width: '100%', resize: 'vertical' }}
                  aria-label="Decision comment"
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.btnCancel} onClick={() => setConfirmingApproval(null)}>
                Cancel
              </button>
              <button
                className={
                  confirmingApproval.action === 'APPROVE'
                    ? styles.btnApproveConfirm
                    : styles.btnRejectConfirm
                }
                onClick={executeDecision}
                data-testid="confirm-decision-btn"
              >
                {confirmingApproval.action === 'APPROVE' ? 'Confirm Sign-Off' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
