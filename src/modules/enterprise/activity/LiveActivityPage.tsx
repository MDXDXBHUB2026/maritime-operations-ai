import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import {
  EventService,
  OrganizationService,
  subscribeEnterpriseState,
} from '../../../services/enterprise';
import styles from './LiveActivityPage.module.css';

export const LiveActivityPage: React.FC = () => {
  const [, setTick] = useState(0);

  const [deptFilter, setDeptFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    return subscribeEnterpriseState(() => setTick((t) => t + 1));
  }, []);

  const departments = OrganizationService.getDepartments();
  let events = EventService.getEvents({
    departmentId: deptFilter !== 'ALL' ? deptFilter : undefined,
    severity: severityFilter !== 'ALL' ? severityFilter : undefined,
  });

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    events = events.filter(
      (e) =>
        e.summary.toLowerCase().includes(q) ||
        e.actorName.toLowerCase().includes(q) ||
        e.eventType.toLowerCase().includes(q) ||
        (e.taskId && e.taskId.toLowerCase().includes(q))
    );
  }

  return (
    <div className={styles.container} data-testid="live-activity-page">
      {/* Header */}
      <div className={styles.header}>
        <div>
          <div className="eyebrow">CENTRALIZED AUDIT &amp; REAL-TIME BUS</div>
          <h1>Live Enterprise Activity Stream</h1>
          <p className="subtitle" style={{ marginBottom: 0 }}>
            Unified event stream capturing autonomous agent actions, policy evaluations, and human
            managerial interventions.
          </p>
        </div>
        <div className={styles.streamStatusNotice}>
          <span className="pill info" style={{ animation: 'pulse 2s infinite' }}>
            <span>●</span> BUS LISTENING
          </span>
          <span className={styles.disclaimerText}>Simulated enterprise event stream</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.searchBox}>
          <Search size={16} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search events by summary, actor, or task ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
            aria-label="Search events"
          />
        </div>

        <div className={styles.filterGroup}>
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

          <div className={styles.selectWrapper}>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              aria-label="Filter by severity"
            >
              <option value="ALL">All Severities</option>
              <option value="INFO">INFO</option>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>
        </div>
      </div>

      {/* Event Stream List */}
      <div className={styles.streamCard}>
        {events.length === 0 ? (
          <div className={styles.emptyState}>No events match active filter criteria.</div>
        ) : (
          events.map((evt) => {
            const isCritical = evt.severity === 'CRITICAL';
            const isHigh = evt.severity === 'HIGH';
            const isWarning = evt.severity === 'MEDIUM';

            return (
              <div
                key={evt.eventId}
                className={styles.eventItem}
                style={{
                  borderLeftColor: isCritical
                    ? 'var(--red)'
                    : isHigh
                      ? 'var(--orange)'
                      : isWarning
                        ? 'var(--amber)'
                        : 'var(--line-light)',
                }}
                data-testid={`event-item-${evt.eventId.toLowerCase()}`}
              >
                <div className={styles.eventTop}>
                  <div className={styles.eventMetaLeft}>
                    <span className={styles.eventIdTag}>{evt.eventId}</span>
                    <span className={styles.eventTimestamp}>{evt.timestamp}</span>
                    {evt.taskId && (
                      <span className={styles.eventTaskBadge}>Task: {evt.taskId}</span>
                    )}
                  </div>
                  <div className={styles.eventMetaRight}>
                    <span
                      className={`pill ${
                        isCritical ? 'critical' : isHigh ? 'high' : isWarning ? 'medium' : 'info'
                      }`}
                    >
                      {evt.severity}
                    </span>
                    <span className={styles.eventTypeBadge}>{evt.eventType}</span>
                  </div>
                </div>

                <div className={styles.eventActorRow}>
                  <span className={styles.actorLabel}>Actor:</span>
                  <span className={styles.actorName}>{evt.actorName}</span>
                  <span className={styles.deptCodeTag}>{evt.departmentId}</span>
                  {evt.escalatedTo && (
                    <span className={styles.escalationTag}>
                      &rarr; Escalated to: {evt.escalatedTo}
                    </span>
                  )}
                </div>

                <div className={styles.eventSummary}>{evt.summary}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
